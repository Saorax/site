import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';



function uniqueValues(array, path) {
  if (typeof path === 'string') {
    return [...new Set(array.map(item => item?.[path]).filter(Boolean))];
  }
  const values = [];
  array.forEach(item => {
    let val = item;
    for (let i = 0; i < path.length; i++) {
      if (Array.isArray(val)) {
        val = val.flatMap(v => v?.[path[i]]);
      } else if (val && typeof val === 'object' && path[i] in val) {
        val = val[path[i]];
      } else {
        val = undefined;
        break;
      }
    }
    if (Array.isArray(val)) values.push(...val.filter(Boolean));
    else if (val !== undefined && val !== null) values.push(val);
  });
  return [...new Set(values)];
}

function formatLabel(label) {
  if (!label) return '';
  return label.replace(/([a-z])([A-Z])/g, '$1 $2');
}

const splitTags = (tags) => {
  if (!tags) return [];
  const result = [];
  let buffer = '';
  let insideQuotes = false;
  for (let char of tags) {
    if (char === "'") insideQuotes = !insideQuotes;
    if (char === ',' && !insideQuotes) {
      result.push(buffer.trim().replace(/^'+|'+$/g, ''));
      buffer = '';
    } else {
      buffer += char;
    }
  }
  if (buffer.length > 0) result.push(buffer.trim().replace(/^'+|'+$/g, ''));
  return result;
};

function useOptionCounts(podiums, filters, helpers) {
  return useMemo(() => {
    const counts = {
      Cohort: {},
      TimedPromotion: {},
      Rarity: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      BPSeason: {},
      Entitlement: {},
      TimedEvent: {},
      StoreOnly: 0,
      AllBP: 0,
      DLC: 0
    };

    const applyFilters = (p, excludeKey) => {
      for (const [key, filterVal] of Object.entries(filters)) {
        if (key === excludeKey) continue;
        if (!filterVal) continue;
        if (key === 'BPSeason') {
          if (filterVal === 'AllBP') {
            if (!p.bp) return false;
          } else if (helpers.BPSeason(p) !== filterVal) return false;
        } else if (key === 'StoreOnly') {
          if (!Array.isArray(p.store) || p.store.length === 0) return false;
        } else if (key === 'Entitlement') {
          if (!p.entitlement) return false;
        } else if (helpers[key] && helpers[key](p) !== filterVal) {
          return false;
        }
      }
      return true;
    };

    podiums.forEach(p => {
      if (applyFilters(p, null)) {
        counts.AllBP += p.bp ? 1 : 0;
        counts.StoreOnly += (Array.isArray(p.store) && p.store.length > 0) ? 1 : 0;
        counts.DLC += p.entitlement ? 1 : 0;
      }
      ['Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'TimedEvent'].forEach(key => {
        if (applyFilters(p, key)) {
          const val = helpers[key](p);
          if (val) counts[key][val] = (counts[key][val] || 0) + 1;
        }
      });
    });

    return counts;
  }, [podiums, filters, helpers]);
}

// ---- store processing (ported from taunt.jsx, adapted for podium) ----
function getProcessedStoreData(podium) {
  let storeData = podium.store || [];
  // de-dup by StoreID
  storeData = [...new Map(storeData.map(sd => [sd.StoreID, sd])).values()];
  storeData = storeData.map(sd => {
    let costs = {
      mc: 0,
      mcSale: 0,
      gold: 0,
      glory: 0,
      special: {}
    };
    if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
      if ((sd.IdolCost != 0 && sd.IdolCost != '') || (sd.IdolSaleCost != 0 && sd.IdolSaleCost != '')) {
        if (sd.IdolCost != 0 && sd.IdolCost != '') costs.mc = Number(sd.IdolCost);
        if (sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') costs.mcSale = Number(sd.IdolSaleCost);
      } else {
        sd.ItemList.forEach(item => {
          if (item.IdolCost != 0 && item.IdolCost != '') costs.mc += Number(item.IdolCost);
          if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') costs.mc += Number(item.IdolSaleCost);
          if (item.GoldCost != 0 && item.GoldCost != '') costs.gold += Number(item.GoldCost);
          if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') costs.gold += Number(item.GoldSaleCost);
          if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') costs.glory += Number(item.RankedPointsCost);
          if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '' && item.SpecialCurrencyType) {
            costs.special[item.SpecialCurrencyType] = (costs.special[item.SpecialCurrencyType] || 0) + Number(item.SpecialCurrencyCost);
          }
        });
        if (sd.IdolBundleDiscount) costs.mc = Math.floor(costs.mc * (sd.IdolBundleDiscount ?? 1));
        if (sd.GoldBundleDiscount) costs.gold = Math.floor(costs.gold * (sd.GoldBundleDiscount ?? 1));
        if (sd.RankedPointsBundleDiscount) costs.glory = Math.floor(costs.glory * (sd.RankedPointsBundleDiscount ?? 1));
        if (sd.SpecialCurrencyBundleDiscount) {
          for (let currencyType in costs.special) {
            costs.special[currencyType] = Math.floor(costs.special[currencyType] * (sd.SpecialCurrencyBundleDiscount ?? 1));
          }
        }
      }
    } else {
      if (sd.IdolCost && sd.IdolCost != 0 && sd.IdolCost !== '') costs.mc = Number(sd.IdolCost);
      if (sd.IdolSaleCost && sd.IdolSaleCost != 0 && sd.IdolSaleCost !== '') costs.mcSale = Number(sd.IdolSaleCost);
      if (sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') costs.gold = Number(sd.GoldCost);
      if (sd.GoldSaleCost && sd.GoldSaleCost != 0 && sd.GoldSaleCost !== '') costs.gold = Number(sd.GoldSaleCost);
      if (sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') costs.glory = Number(sd.RankedPointsCost);
      if (sd.SpecialCurrencyCost && sd.SpecialCurrencyCost != 0 && sd.SpecialCurrencyCost !== '' && sd.SpecialCurrencyType) {
        costs.special[sd.SpecialCurrencyType] = Number(sd.SpecialCurrencyCost);
      }
    }
    return { ...sd, Costs: costs };
  });
  return storeData.sort((a, b) => {
    const sumA = a.Costs.mc + a.Costs.mcSale + a.Costs.gold + a.Costs.glory + Object.values(a.Costs.special).reduce((sum, val) => sum + val, 0);
    const sumB = b.Costs.mc + b.Costs.mcSale + b.Costs.gold + b.Costs.glory + Object.values(b.Costs.special).reduce((sum, val) => sum + val, 0);
    return sumA - sumB;
  });
}

export function PodiumStoreView({ podiums, langs }) {
  // normalize store to array
  const podiumsNorm = useMemo(() => podiums.map(p => ({
    ...p,
    store: Array.isArray(p.store) ? p.store : (p.store ? [p.store] : [])
  })), [podiums]);

  const [selectedPodium, setSelectedPodium] = useState(null);
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterTimedEvent, setFilterTimedEvent] = useState('');
  const [viewMode, setViewMode] = useState('list');

  // animation state mirrors taunt button design: top toggle (All/Loop) + grid of choices
  const [animLoading, setAnimLoading] = useState(false);
  const [framesMode, setFramesMode] = useState('all'); // 'all' | 'loop'
  const [currentAnim, setCurrentAnim] = useState('Ready'); // Ready | LockIn | Victory | Defeat
  const [teamSelection, setTeamSelection] = useState('Default'); // Default | Blue Team | Red Team

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const topRef = useRef(null);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 250); return () => clearTimeout(t); }, [searchQuery]);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; }
    else if (isMobile) { setSelectedPodium(null); filtersChanged.current = true; }
  }, [filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterTimedEvent, debouncedSearch, sortType, isMobile]);

  const helpers = useMemo(() => ({
    Cohort: p => (Array.isArray(p.store) && p.store[0]?.Cohort) ?? '',
    TimedPromotion: p => (Array.isArray(p.store) && p.store[0]?.TimedPromotion) ?? '',
    Rarity: p => (Array.isArray(p.store) && p.store[0]?.Rarity) ?? '',
    StoreID: p => (Array.isArray(p.store) && p.store[0]?.StoreID) ?? -1,
    StoreLabel: p => (Array.isArray(p.store) && p.store[0]?.Label) ?? '',
    PromoType: p => p.promo?.Type ?? '',
    BPSeason: p => p.bp?.ID ?? '',
    Entitlement: p => !!p.entitlement,
    TimedEvent: p => p.timedEvent?.TimedEventName ?? ''
  }), []);

  const cohorts = useMemo(() => uniqueValues(podiumsNorm, ['store', 'Cohort']), [podiumsNorm]);
  const promotions = useMemo(() => uniqueValues(podiumsNorm, ['store', 'TimedPromotion']), [podiumsNorm]);
  const rarities = useMemo(() => uniqueValues(podiumsNorm, ['store', 'Rarity']), [podiumsNorm]);
  const storeLabels = useMemo(() => uniqueValues(podiumsNorm, ['store', 'Label']), [podiumsNorm]);
  const promoTypes = useMemo(() => uniqueValues(podiumsNorm, ['promo', 'Type']), [podiumsNorm]);
  const timedEvents = useMemo(() => uniqueValues(podiumsNorm, ['timedEvent', 'TimedEventName']), [podiumsNorm]);
  const bpSeasons = useMemo(() => {
    return [...new Set(podiumsNorm.filter(p => p.bp && p.bp.ID).map(p => p.bp.ID))]
      .sort((a, b) => {
        const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
        const nA = getNum(a), nB = getNum(b);
        if (nA !== nB) return nA - nB;
        return a.localeCompare(b);
      });
  }, [podiumsNorm]);

  const optionCounts = useOptionCounts(
    podiumsNorm,
    {
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      Rarity: filterRarity,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      TimedEvent: filterTimedEvent,
      StoreOnly: storeOnly
    },
    helpers
  );

  const getDisplayNameKey = p => (Array.isArray(p.store) && p.store[0]?.DisplayNameKey) ?? p.podiumData?.DisplayNameKey ?? '';
  const getDescriptionKey = p => (Array.isArray(p.store) && p.store[0]?.DescriptionKey) ?? p.podiumData?.DescriptionKey ?? '';

  const filteredPodiums = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return podiumsNorm.filter(p => {
      if (filterCohort && helpers.Cohort(p) !== filterCohort) return false;
      if (filterRarity && helpers.Rarity(p) !== filterRarity) return false;
      if (filterStoreID && helpers.StoreID(p) !== filterStoreID) return false;
      if (filterStoreLabel && helpers.StoreLabel(p) !== filterStoreLabel) return false;
      if (filterPromoType && helpers.PromoType(p) !== filterPromoType) return false;
      if (filterPromo !== '' && helpers.TimedPromotion(p) !== filterPromo) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP') { if (!p.bp) return false; }
        else if (helpers.BPSeason(p) !== filterBPSeason) return false;
      }
      if (filterEntitlement && !p.entitlement) return false;
      if (filterTimedEvent && helpers.TimedEvent(p) !== filterTimedEvent) return false;
      if (storeOnly && (!Array.isArray(p.store) || p.store.length === 0)) return false;

      const fields = [
        langs.content[getDisplayNameKey(p)] || '',
        langs.content[getDescriptionKey(p)] || '',
        p.podiumData?.PodiumName || '',
        p.podiumData?.PodiumID || '',
        Array.isArray(p.store) ? p.store.map(sd => sd.StoreName).join(' ') : '',
        Array.isArray(p.store) ? p.store.map(sd => sd.Item).join(' ') : '',
        Array.isArray(p.store) ? p.store.map(sd => sd.Label).join(' ') : '',
        Array.isArray(p.store) ? p.store.map(sd => sd.TimedPromotion).join(' ') : '',
        Array.isArray(p.store) ? p.store.map(sd => sd.SearchTags).join(' ') : '',
        p.promo?.StoreName || '',
        p.promo?.Item || '',
        p.promo?.Label || '',
        p.bp?.Item || '',
        p.bp?.ID || '',
        p.bp?.DescriptionKey || '',
        p.entitlement?.EntitlementName || '',
        p.entitlement?.DisplayNameKey || '',
        p.timedEvent?.TimedEventName || '',
        Array.isArray(p.store) ? p.store.map(sd => sd.StoreID).join(' ') : '',
        Array.isArray(p.store) ? p.store.map(sd => sd.IdolCost).join(' ') : '',
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    }).sort((a, b) => {
      const idxA = typeof a.ArrayIndex === 'number' ? a.ArrayIndex : parseInt(a.ArrayIndex) || 0;
      const idxB = typeof b.ArrayIndex === 'number' ? b.ArrayIndex : parseInt(b.ArrayIndex) || 0;
      const nameA = langs.content[getDisplayNameKey(a)] || '';
      const nameB = langs.content[getDisplayNameKey(b)] || '';
      const costA = (getProcessedStoreData(a)[0]?.Costs?.mc || 0);
      const costB = (getProcessedStoreData(b)[0]?.Costs?.mc || 0);
      const storeA = parseInt(helpers.StoreID(a)) || 0;
      const storeB = parseInt(helpers.StoreID(b)) || 0;
      const podiumA = parseInt(a.podiumData?.PodiumID) || 0;
      const podiumB = parseInt(b.podiumData?.PodiumID) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'PodiumIDAsc': return podiumA - podiumB;
        case 'PodiumIDDesc': return podiumB - podiumA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        default: return 0;
      }
    });
  }, [podiumsNorm, debouncedSearch, sortType, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterTimedEvent, langs, helpers]);

  const handleFilterChange = useCallback((setter, value) => { setter(value); }, []);

  useEffect(() => {
    if (podiumsNorm.length === 0 || filteredPodiums.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const podiumId = params.get('podium') ? String(params.get('podium')) : null;
    let podium = null;
    if (podiumId) podium = filteredPodiums.find(p => String(p.podiumData?.PodiumID) === podiumId);
    if (!podium && !isMobile) podium = filteredPodiums[0];
    setSelectedPodium(podium);
    setFramesMode('all');
    setCurrentAnim('Ready');
    setTeamSelection('Default');
  }, [podiumsNorm, filteredPodiums, isMobile]);

  useEffect(() => {
    if (isMobile && selectedPodium && !filteredPodiums.some(p => p.podiumData?.PodiumID === selectedPodium.podiumData?.PodiumID)) {
      setSelectedPodium(null);
    }
  }, [filteredPodiums, isMobile, selectedPodium]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedPodium) currentParams.set('podium', String(selectedPodium.podiumData?.PodiumID));
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const podiumId = params.get('podium') ? String(params.get('podium')) : null;
      if (podiumId && filteredPodiums.length > 0) {
        const podium = filteredPodiums.find(p => String(p.podiumData?.PodiumID) === podiumId);
        if (podium) setSelectedPodium(podium);
        else if (!isMobile) setSelectedPodium(filteredPodiums[0]);
        else setSelectedPodium(null);
      } else if (!isMobile) setSelectedPodium(filteredPodiums[0]);
      else setSelectedPodium(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPodium, filteredPodiums, isMobile]);

  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterCohort('');
    setFilterPromo('');
    setFilterRarity('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    setFilterTimedEvent('');
    if (isMobile) { setSelectedPodium(null); filtersChanged.current = true; }
    else { setSelectedPodium(filteredPodiums[0] || null); }
    setFramesMode('all');
    setCurrentAnim('Ready');
    setTeamSelection('Default');
  }, [filteredPodiums, isMobile]);

  const Row = ({ index, data }) => {
    const podium = data[index];
    const [imgLoading, setImgLoading] = useState(true);
    const storeData = getProcessedStoreData(podium);

    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[260px]' : 'p-0 px-2 h-[160px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedPodium?.podiumData?.PodiumID === podium.podiumData?.PodiumID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => {
            setSelectedPodium(podium);
            setFramesMode('all');
            setCurrentAnim('Ready');
            setTeamSelection('Default');
            filtersChanged.current = false;
          }}
        >
          <div className={`flex rounded-lg items-center justify-center relative`}>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                </svg>
              </div>
            )}
            <img
              src={`${host}/game/animPodium/${podium.podiumData?.PodiumID}/all/Ready`}
              className="h-32 w-32 object-contain"
              onLoad={() => setImgLoading(false)}
              onError={e => e.target.style.display = 'none'}
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!podium.store?.length && !podium.bp && !podium.promo && !podium.entitlement && !podium.timedEvent && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {podium.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${podium.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {podium.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${!podium.store?.length && !podium.bp && !podium.entitlement && !podium.timedEvent ? ' Only' : ''}`}
                    </div>
                  )}
                  {podium.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[podium.entitlement.DisplayNameKey]?.replace('!', '') || podium.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {podium.timedEvent && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${podium.timedEvent.TimedEventName} Event`}
                    </div>
                  )}
                  {podium.powerData?.TeamTauntPower && (
                    <div className="bg-blue-400 dark:bg-blue-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Team Power
                    </div>
                  )}
                  {podium.store?.length > 0 && (() => {
                    const labels = [...new Set(podium.store.map(s => s.Label).filter(Boolean))];
                    return labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "No Longer Purchasable" : label}
                      </div>
                    ));
                  })()}
                  {podium.store?.length > 0 && (() => {
                    const promos = [...new Set(podium.store.map(s => s.TimedPromotion ?? '').filter(Boolean))];
                    return promos.map((promo, idx) => (
                      <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className="mt-1 flex justify-start text-gray-900 dark:text-white font-bold text-lg">
                <span>{langs.content[getDisplayNameKey(podium)] || podium.podiumData?.PodiumName}</span>
              </div>
              <div className="text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white">
                {storeData.map((sd, idx) => (
                  <div key={`costs-${idx}`} className="flex flex-wrap gap-2">
                    {(sd.Type === 'Bundle' && (sd.Costs.mc > 0 || sd.Costs.mcSale > 0)) ? (
                      <div>
                        <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" />
                        {sd.Costs.mcSale > 0 ? (
                          <>
                            <span className="line-through text-gray-500 dark:text-gray-400">{sd.Costs.mc}</span>
                            <span className="text-gray-900 dark:text-white font-bold">{sd.Costs.mcSale}</span>
                          </>
                        ) : (
                          <span>{sd.Costs.mc}</span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                      </div>
                    ) : (
                      <>
                        {sd.Costs.mc > 0 && (
                          <div>
                            <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" />
                            <span>{sd.Costs.mc}</span>
                            {sd.Type === 'Bundle' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>}
                          </div>
                        )}
                        {sd.Costs.gold > 0 && (
                          <div>
                            <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" />
                            <span>{sd.Costs.gold}</span>
                            {sd.Type === 'Bundle' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>}
                          </div>
                        )}
                        {sd.Costs.glory > 0 && (
                          <div>
                            <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" />
                            <span>{sd.Costs.glory}</span>
                            {sd.Type === 'Bundle' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>}
                          </div>
                        )}
                        {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                          <div key={`special-${sIdx}`}>
                            <img
                              src={`${host}/game/getGfx/storeIcon/${currencyType}`}
                              className="inline h-4 mr-1"
                              onError={e => (e.target.src = `${host}/game/getGfx/storeIcon/mc`)}
                            />
                            <span>{cost}</span>
                            {sd.Type === 'Bundle' && <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getAnimUrl = (p) => {
    if (!p?.podiumData?.PodiumID) return '';
    let suffix = '';
    if (teamSelection === 'Red Team' && p.podiumData?.CustomArtTeamRed) suffix = `/${p.podiumData.CustomArtTeamRed}`;
    else if (teamSelection === 'Blue Team' && p.podiumData?.CustomArtTeamBlue) suffix = `/${p.podiumData.CustomArtTeamBlue}`;
    return `${host}/game/animPodium/${p.podiumData.PodiumID}/${framesMode}/${currentAnim}${suffix}`;
  };

  const handleCopyLink = useCallback(() => {
    if (!selectedPodium) return;
    const url = `${window.location.origin}${window.location.pathname}?podium=${selectedPodium.podiumData?.PodiumID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedPodium]);

  const handleImgError = e => { e.target.style.display = 'none'; };

  return (
    <div className="h-full flex flex-col lg:flex-row" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-center">
            <div className="bg-gray-200 dark:bg-slate-800 p-2 rounded-lg flex flex-wrap gap-2 items-center">
              {Object.values(optionCounts.Cohort).some(count => count > 0) && (
                <select
                  value={filterCohort}
                  onChange={e => handleFilterChange(setFilterCohort, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Cohorts</option>
                  {cohorts.filter(c => optionCounts.Cohort[c] > 0).map(c => (
                    <option key={c} value={c}>{formatLabel(c)} ({optionCounts.Cohort[c]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.TimedPromotion).some(count => count > 0) && (
                <select
                  value={filterPromo}
                  onChange={e => handleFilterChange(setFilterPromo, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Promotions</option>
                  {promotions.filter(p => optionCounts.TimedPromotion[p] > 0).map(p => (
                    <option key={p} value={p}>{formatLabel(p)} ({optionCounts.TimedPromotion[p]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.Rarity).some(count => count > 0) && (
                <select
                  value={filterRarity}
                  onChange={e => handleFilterChange(setFilterRarity, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">All Rarities</option>
                  {rarities.filter(r => optionCounts.Rarity[r] > 0).map(r => (
                    <option key={r} value={r}>{formatLabel(r)} ({optionCounts.Rarity[r]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.StoreLabel).some(count => count > 0) && (
                <select
                  value={filterStoreLabel}
                  onChange={e => handleFilterChange(setFilterStoreLabel, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Store Label</option>
                  {storeLabels.filter(n => optionCounts.StoreLabel[n] > 0).map(n => (
                    <option key={n} value={n}>{n} ({optionCounts.StoreLabel[n]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.PromoType).some(count => count > 0) && (
                <select
                  value={filterPromoType}
                  onChange={e => handleFilterChange(setFilterPromoType, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Promo Codes</option>
                  {promoTypes.filter(n => optionCounts.PromoType[n] > 0).map(n => (
                    <option key={n} value={n}>{n} ({optionCounts.PromoType[n]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.TimedEvent).some(count => count > 0) && (
                <select
                  value={filterTimedEvent}
                  onChange={e => handleFilterChange(setFilterTimedEvent, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Timed Events</option>
                  {timedEvents.filter(t => optionCounts.TimedEvent[t] > 0).map(t => (
                    <option key={t} value={t}>{t} ({optionCounts.TimedEvent[t]})</option>
                  ))}
                </select>
              )}
              {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
                <select
                  value={filterBPSeason}
                  onChange={e => handleFilterChange(setFilterBPSeason, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Podiums ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                Store Podiums Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                DLC Podiums ({optionCounts.DLC || 0})
              </label>
              <button onClick={resetFilters} aria-label="Reset all filters" className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col mb-2">
          <div className='lg:flex gap-4 items-center'>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
                placeholder="Search Podiums"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="flex justify-between items-center w-full sm:w-auto py-2 gap-4">
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
                Showing {filteredPodiums.length} Podium{filteredPodiums.length !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`cursor-pointer p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`}
                  title="List View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`cursor-pointer p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`}
                  title="Grid View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zm-10 10h6v6H4v-6zm10 0h6v6h-6v-6z"></path></svg>
                </button>
              </div>
            </div></div>
          <div className="relative">
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value)}
              className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none"
            >
              <option value="ArrayIndexDesc">Default Sorting (Desc)</option>
              <option value="ArrayIndexAsc">Default Sorting (Asc)</option>
              <option value="PodiumIDDesc">Podium ID (Desc)</option>
              <option value="PodiumIDAsc">Podium ID (Asc)</option>
              <option value="StoreIDDesc">Store ID (Desc)</option>
              <option value="StoreIDAsc">Store ID (Asc)</option>
              <option value="AlphaAsc">Alphabetical (A-Z)</option>
              <option value="AlphaDesc">Alphabetical (Z-A)</option>
              <option value="CostDesc">Mammoth Cost (Desc)</option>
              <option value="CostAsc">Mammoth Cost (Asc)</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        <div className='h-[100vh]'>
          {viewMode === 'list' ? (
            <Virtuoso
              data={filteredPodiums}
              totalCount={filteredPodiums.length}
              itemContent={(index, p) => <Row index={index} data={filteredPodiums} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredPodiums}
              totalCount={filteredPodiums.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="podium-grid-item"
              itemContent={(index, p) => <Row index={index} data={filteredPodiums} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>

      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedPodium ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button className="lg:hidden text-gray-900 dark:text-white" onClick={() => setSelectedPodium(null)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedPodium && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="bg-blue-500 dark:bg-blue-600 text-white font-bold px-3 py-1 rounded-lg">Copy Link</button>
                {copyFeedback && <span className="text-sm text-gray-900 dark:text-white">{copyFeedback}</span>}
              </div>
            )}
          </div>

          {selectedPodium ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {langs.content[getDisplayNameKey(selectedPodium)] || selectedPodium.podiumData?.PodiumName}
                    </span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedPodium)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedPodium)]}
                  </div>
                )}
                {Array.isArray(selectedPodium.store) && selectedPodium.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedPodium.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {selectedPodium.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedPodium.promo.Type}
                      </span>
                    )}
                    {selectedPodium.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedPodium.bp.ID.replace('BP', '').replace('-', ' ')}{selectedPodium.bp.Tier ? ` (Tier ${selectedPodium.bp.Tier})` : ''}
                      </span>
                    )}
                    {selectedPodium.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {`${langs.content[selectedPodium.entitlement.DisplayNameKey]?.replace('!', '') || selectedPodium.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                    {selectedPodium.store?.length > 0 && (() => {
                      const labels = [...new Set(selectedPodium.store.map(sd => sd.Label).filter(Boolean))];
                      return labels.length > 0 && labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "No Longer Purchasable" : label}
                        </span>
                      ));
                    })()}
                    {selectedPodium.timedEvent && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">
                        {`${selectedPodium.timedEvent.TimedEventName} Event`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-2">
                <div className="order-2 lg:order-1 lg:w-1/2 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                      <span className="text-lg text-gray-900 dark:text-white">Podium Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Podium Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedPodium.podiumData?.PodiumName}</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Podium ID</span>
                          <span className="text-gray-900 dark:text-white">{selectedPodium.podiumData?.PodiumID}</span>
                        </div>
                        {selectedPodium.podiumData?.AnimRig && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Anim Rig</span>
                            <span className="text-gray-900 dark:text-white">{selectedPodium.podiumData?.AnimRig}</span>
                          </div>
                        )}
                        {selectedPodium.podiumData?.UpgradesTo && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Upgrades To</span>
                            <span className="text-gray-900 dark:text-white">{selectedPodium.podiumData?.UpgradesTo}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {Array.isArray(selectedPodium.store) && selectedPodium.store.map((sd, idx) => {
                      return (
                        <div key={`store-${idx}`} className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                          <span className="text-lg text-gray-900 dark:text-white">Store Data {sd.Type == 'Bundle' ? '(Bundle)' : '(Podium)'}</span>
                          <div className="grid grid-cols-2 gap-2 text-lg">
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Store Name</span>
                              <span className="text-gray-900 dark:text-white">{sd.StoreName}</span>
                            </div>
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Store ID</span>
                              <span className="text-gray-900 dark:text-white">{sd.StoreID}</span>
                            </div>

                            {sd.ItemList && sd.ItemList.length > 0 ? (
                              <div className='flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg'>
                                <span className="font-bold text-gray-600 dark:text-gray-300">Bundle Cost</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                  <span className="line-through text-red-600 dark:text-red-400">{
                                    sd.ItemList.map((item, itemIdx) => {
                                      if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                                      if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                                      if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                                      if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                                      if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                                      if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                                      if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                                    }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0)
                                  }</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold">{Math.floor((sd.ItemList.map((item, itemIdx) => {
                                    if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                                    if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                                    if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                                    if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                                    if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                                    if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                                    if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                                  }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0) * (sd.IdolBundleDiscount ? sd.IdolBundleDiscount : 1)))}</span>
                                </div>
                              </div>
                            ) : (
                              <div className='col-span-2 grid grid-cols-2 gap-2'>
                                {(sd.IdolCost != 0 && sd.IdolCost != '') && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.IdolCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.IdolSaleCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                                    <div className="flex items-center gap-1">
                                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                      <span className="line-through text-red-600 dark:text-red-400">{sd.IdolCost}</span>
                                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.IdolSaleCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.GoldCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldSaleCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                                    <div className="flex items-center gap-1">
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} />
                                      <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldBundleDiscount && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Bundle Discount</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.GoldBundleDiscount}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.RankedPointsCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.RankedPointsCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.SpecialCurrencyType && sd.SpecialCurrencyCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-300">{sd.SpecialCurrencyType} Cost</span>
                                    <span className="text-gray-900 dark:text-white">{sd.SpecialCurrencyCost}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {sd.Cohort && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Cohort</span>
                                <span className="text-gray-900 dark:text-white">{sd.Cohort}</span>
                              </div>
                            )}
                            {sd.Popularity && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Popularity</span>
                                <span className="text-gray-900 dark:text-white">{sd.Popularity}</span>
                              </div>
                            )}
                            {sd.Rarity && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Rarity</span>
                                <span className="text-gray-900 dark:text-white">{sd.Rarity}</span>
                              </div>
                            )}
                            {sd.Label && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Label</span>
                                <span className="text-gray-900 dark:text-white">{sd.Label}</span>
                              </div>
                            )}
                            {sd.TimedPromotion && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Timed Promotion</span>
                                <span className="text-gray-900 dark:text-white">{sd.TimedPromotion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {selectedPodium.timedEvent && (
                      <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                        <span className="text-lg text-gray-900 dark:text-white">Timed Event Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedPodium.timedEvent.TimedEventName}</span>
                          </div>
                          {selectedPodium.timedEvent.TimedEventID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedPodium.timedEvent.TimedEventID}</span>
                            </div>
                          )}
                          {selectedPodium.timedEvent.EventCenterHeaderKey && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Event Header</span>
                              <span className="text-gray-900 dark:text-white">{langs.content[selectedPodium.timedEvent.EventCenterHeaderKey] || selectedPodium.timedEvent.EventCenterHeaderKey}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="order-1 lg:order-2 lg:w-1/2 flex flex-col gap-2">
                  <div className='dark:bg-slate-800 bg-gray-100 flex flex-col gap-2 p-2 rounded-lg'>
                    <span className="text-lg text-gray-900 dark:text-white">Animation Data</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setFramesMode('all'); setAnimLoading(true); }}
                        className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-all duration-100 ${framesMode === 'all' ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                      >
                        All Frames
                      </button>
                      <button
                        onClick={() => { setFramesMode('loop'); setAnimLoading(true); }}
                        className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-all duration-100 ${framesMode === 'loop' ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                      >
                        Looped Frames
                      </button>
                    </div>

                    <div className="mt-2 flex justify-center relative">
                      {animLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                          <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                          </svg>
                        </div>
                      )}
                      <img
                        src={getAnimUrl(selectedPodium)}
                        className="h-96"
                        onLoad={() => setAnimLoading(false)}
                        onError={e => e.target.style.display = 'none'}
                        style={{ opacity: animLoading ? 0 : 1, transition: 'opacity 0.2s' }}
                        alt={`${langs.content && langs.content[getDisplayNameKey(selectedPodium)] || selectedPodium.podiumData?.PodiumName} animation`}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div>
                        <span className="text-base dark:text-white text-gray-900">Podium Color</span>
                        <div className="w-full grid grid-cols-3 gap-2">
                          {['Default', 'Blue Team', 'Red Team'].map(team => (
                            <button
                              key={team}
                              onClick={() => { setTeamSelection(team); setAnimLoading(true); }}
                              className={`py-1 px-3 rounded-lg w-full text-sm font-bold transition-all duration-100 ${teamSelection === team ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                            >
                              {team}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-base dark:text-white text-gray-900">Podium Animations</span>
                        <div className="grid grid-cols-2 gap-2">
                          {['Ready', 'LockIn', 'Victory', 'Defeat'].map(anim => (
                            <button
                              key={anim}
                              onClick={() => { setCurrentAnim(anim); setAnimLoading(true); }}
                              className={`py-1 px-3 rounded-lg w-full text-sm font-bold transition-all duration-100 ${currentAnim === anim ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                            >
                              {anim === 'LockIn' ? 'Lock In' : anim}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400 italic">Select a podium to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
