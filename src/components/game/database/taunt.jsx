import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';

function uniqueValues(array, path) {
  const values = new Set();
  array.forEach(item => {
    let val = item;
    for (const key of Array.isArray(path) ? path : [path]) {
      if (Array.isArray(val)) {
        val = val.flatMap(v => v?.[key]);
      } else {
        val = val?.[key];
      }
      if (!val) break;
    }
    if (Array.isArray(val)) {
      val.forEach(v => values.add(v));
    } else if (val) {
      values.add(val);
    }
  });
  return [...values].filter(Boolean);
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

function useOptionCounts(taunts, filters, helpers) {
  const applyFilters = useCallback((taunt, excludeKey) => {
    for (const [key, filterVal] of Object.entries(filters)) {
      if (key === excludeKey || !filterVal) continue;

      if (key === 'BPSeason') {
        if (filterVal === 'AllBP' && !taunt.bp) return false;
        if (filterVal !== 'AllBP' && helpers.BPSeason(taunt) !== filterVal) return false;
        continue;
      }

      if (key === 'TeamTaunt') {
        if (filterVal === 'yes' && !helpers.TeamTaunt(taunt)) return false;
        if (filterVal === 'no' && helpers.TeamTaunt(taunt)) return false;
        continue;
      }

      if (key === 'StoreOnly' && !taunt.store?.length) return false;
      if (key === 'Entitlement' && !taunt.entitlement) return false;
      if (key === 'TimedEvent' && helpers.TimedEvent(taunt) !== filterVal) return false;
      if (key === 'Bundle' && filterVal === true && !helpers.Bundle(taunt)) return false;
      if (typeof helpers[key] === 'function' && key !== 'Bundle') {
        if (helpers[key](taunt) !== filterVal) return false;
      }
    }
    return true;
  }, [filters, helpers]);

  return useMemo(() => {
    const counts = {
      Cohort: {},
      TimedPromotion: {},
      Rarity: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      BPSeason: {},
      TeamTaunt: { yes: 0, no: 0 },
      Entitlement: {},
      TimedEvent: {},
      StoreOnly: 0,
      AllBP: 0,
      Bundle: 0,
      DLC: 0,
    };

    taunts.forEach(taunt => {
      if (!applyFilters(taunt)) return;

      counts.AllBP += taunt.bp ? 1 : 0;
      counts.StoreOnly += taunt.store?.length > 0 ? 1 : 0;
      counts.DLC += taunt.entitlement ? 1 : 0;
      counts.TeamTaunt.yes += helpers.TeamTaunt(taunt) ? 1 : 0;
      counts.TeamTaunt.no += !helpers.TeamTaunt(taunt) ? 1 : 0;
      if (helpers.Bundle(taunt)) {
        counts.Bundle += 1;
      }
      ['Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'TimedEvent'].forEach(key => {
        const val = helpers[key](taunt);
        if (val) counts[key][val] = (counts[key][val] || 0) + 1;
      });
    });

    return counts;
  }, [taunts, filters, helpers, applyFilters]);
}

export function TauntStoreView({ taunts, langs }) {
  const [selectedTaunt, setSelectedTaunt] = useState(null);
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
  const [filterTeamTaunt, setFilterTeamTaunt] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterTimedEvent, setFilterTimedEvent] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [currentAnimation, setCurrentAnimation] = useState('Default');
  const [randomAnimIndex, setRandomAnimIndex] = useState('player1');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [animLoading, setAnimLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const topRef = useRef(null);
  const [filterBundle, setFilterBundle] = useState(false);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (isMobile) {
      setSelectedTaunt(null);
      filtersChanged.current = true;
    }
  }, [
    filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel,
    filterPromoType, filterBPSeason, filterTeamTaunt, filterEntitlement, filterTimedEvent,
    debouncedSearch, sortType, isMobile
  ]);

  const helpers = useMemo(() => ({
    Cohort: t => t.store?.[0]?.Cohort ?? '',
    TimedPromotion: t => t.store?.[0]?.TimedPromotion ?? '',
    Rarity: t => t.store?.[0]?.Rarity ?? '',
    StoreID: t => t.store?.[0]?.StoreID ?? -1,
    StoreLabel: t => t.store?.[0]?.Label ?? '',
    PromoType: t => t.promo?.Type ?? '',
    BPSeason: t => t.bp?.ID ?? '',
    TeamTaunt: t => !!t.powerData?.TeamTauntPower,
    Entitlement: t => !!t.entitlement,
    TimedEvent: t => t.timedEvent?.TimedEventName ?? '',
    Bundle: t => !!(t.store?.some(s => s.Type === 'Bundle'))
  }), []);

  const cohorts = useMemo(() => uniqueValues(taunts, ['store', 'Cohort']), [taunts]);
  const promotions = useMemo(() => uniqueValues(taunts, ['store', 'TimedPromotion']), [taunts]);
  const rarities = useMemo(() => uniqueValues(taunts, ['store', 'Rarity']), [taunts]);
  const storeLabels = useMemo(() => uniqueValues(taunts, ['store', 'Label']), [taunts]);
  const promoTypes = useMemo(() => uniqueValues(taunts, ['promo', 'Type']), [taunts]);
  const timedEvents = useMemo(() => uniqueValues(taunts, ['timedEvent', 'TimedEventName']), [taunts]);
  const bpSeasons = useMemo(() => {
    return [
      ...new Set(
        taunts
          .filter(t => t.bp && t.bp.ID)
          .map(t => t.bp.ID)
      ),
    ].sort((a, b) => {
      const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
      const nA = getNum(a), nB = getNum(b);
      if (nA !== nB) return nA - nB;
      return a.localeCompare(b);
    });
  }, [taunts]);

  const optionCounts = useOptionCounts(
    taunts,
    {
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      Rarity: filterRarity,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      BPSeason: filterBPSeason,
      TeamTaunt: filterTeamTaunt,
      StoreOnly: storeOnly,
      Entitlement: filterEntitlement,
      TimedEvent: filterTimedEvent,
      Bundle: filterBundle
    },
    helpers
  );

  const getDisplayNameKey = t => t.store?.[0]?.DisplayNameKey ?? t.DisplayNameKey;
  const getDescriptionKey = t => t.store?.[0]?.DescriptionKey ?? t.DescriptionKey;
  const getIdolCost = t => t.store?.[0]?.IdolCost ?? '';
  const getStoreID = t => t.store?.[0]?.StoreID ?? -1;
  const getRarity = t => t.store?.[0]?.Rarity ?? '';
  const getLabel = t => t.store?.[0]?.Label ?? '';
  const getPromoType = t => t.promo?.Type ?? '';
  const getBPSeason = t => t.bp?.ID ?? '';
  const getTimedEventName = t => t.timedEvent?.TimedEventName ?? '';
  const getPowerName = t => t.PowerName;

  const filteredTaunts = useMemo(() => {
    const search = debouncedSearch.toLowerCase();

    const passesSearch = (taunt) => {
      const fields = [
        langs.content[getDisplayNameKey(taunt)] || '',
        taunt.store?.map(s => s.StoreName).join(' ') || '',
        taunt.store?.map(s => s.Item).join(' ') || '',
        taunt.store?.map(s => s.Label).join(' ') || '',
        taunt.store?.map(s => s.TimedPromotion).join(' ') || '',
        taunt.store?.map(s => s.SearchTags).join(' ') || '',
        taunt.promo?.StoreName || '',
        taunt.promo?.Item || '',
        taunt.promo?.Label || '',
        taunt.bp?.Item || '',
        taunt.bp?.ID || '',
        taunt.bp?.DescriptionKey || '',
        taunt.store?.map(s => String(s.StoreID)).join(' ') || '',
        taunt.store?.map(s => String(s.IdolCost)).join(' ') || '',
        taunt.store?.map(s => String(s.GoldCost)).join(' ') || '',
        taunt.store?.map(s => String(s.RankedPointsCost)).join(' ') || '',
        taunt.store?.map(s => String(s.Rarity)).join(' ') || '',
        taunt.store?.map(s => String(s.Cohort)).join(' ') || '',
        taunt.store?.map(s => String(s.Popularity)).join(' ') || '',
        taunt.entitlement?.EntitlementName || '',
        taunt.entitlement?.DisplayNameKey || '',
        taunt.timedEvent?.TimedEventName || '',
        taunt.timedEvent?.EventCenterHeaderKey || '',
        taunt.TauntName || '',
        taunt.PowerName || '',
        String(taunt.TauntID || '')
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    };

    return taunts.filter(taunt => {
      if (!passesSearch(taunt)) return false;
      if (filterCohort && helpers.Cohort(taunt) !== filterCohort) return false;
      if (filterPromo && helpers.TimedPromotion(taunt) !== filterPromo) return false;
      if (filterRarity && helpers.Rarity(taunt) !== filterRarity) return false;
      if (filterStoreID && helpers.StoreID(taunt) !== filterStoreID) return false;
      if (filterStoreLabel && helpers.StoreLabel(taunt) !== filterStoreLabel) return false;
      if (filterPromoType && helpers.PromoType(taunt) !== filterPromoType) return false;
      if (filterTimedEvent && helpers.TimedEvent(taunt) !== filterTimedEvent) return false;
      if (filterBundle && !taunt.store?.some(s => s.Type === 'Bundle')) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP' && !taunt.bp) return false;
        if (filterBPSeason !== 'AllBP' && helpers.BPSeason(taunt) !== filterBPSeason) return false;
      }
      if (filterTeamTaunt) {
        if (filterTeamTaunt === 'yes' && !taunt.powerData?.TeamTauntPower) return false;
        if (filterTeamTaunt === 'no' && taunt.powerData?.TeamTauntPower) return false;
      }
      if (filterEntitlement && !taunt.entitlement) return false;
      if (storeOnly && !taunt.store?.length) return false;
      return true;
    }).sort((a, b) => {
      const idxA = typeof a.ArrayIndex === 'number' ? a.ArrayIndex : parseInt(a.ArrayIndex) || 0;
      const idxB = typeof b.ArrayIndex === 'number' ? b.ArrayIndex : parseInt(b.ArrayIndex) || 0;
      const nameA = langs.content[getDisplayNameKey(a)] || '';
      const nameB = langs.content[getDisplayNameKey(b)] || '';
      const costA = parseInt(getIdolCost(a)) || 0;
      const costB = parseInt(getIdolCost(b)) || 0;
      const storeA = parseInt(getStoreID(a)) || 0;
      const storeB = parseInt(getStoreID(b)) || 0;
      const tauntA = parseInt(a.TauntID) || 0;
      const tauntB = parseInt(b.TauntID) || 0;
      const rarityA = getRarity(a) || '';
      const rarityB = getRarity(b) || '';
      const popA = parseInt(a.store?.[0]?.Popularity) || 0;
      const popB = parseInt(b.store?.[0]?.Popularity) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'TauntIDAsc': return tauntA - tauntB;
        case 'TauntIDDesc': return tauntB - tauntA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        case 'RarityAsc': return rarityA.localeCompare(rarityB);
        case 'RarityDesc': return rarityB.localeCompare(rarityA);
        case 'PopularityAsc': return popA - popB;
        case 'PopularityDesc': return popB - popA;
        default: return 0;
      }
    });
  }, [
    taunts, debouncedSearch, sortType, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterBPSeason, filterTeamTaunt, filterEntitlement, filterTimedEvent, filterBundle, langs, helpers
  ]);

  const handleFilterChange = useCallback((setter, value) => {
    setter(value);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!selectedTaunt) return;
    const url = `${window.location.origin}${window.location.pathname}?taunt=${selectedTaunt.TauntID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedTaunt]);

  useEffect(() => {
    if (taunts.length === 0 || filteredTaunts.length === 0) return;
    if (isMobile && filtersChanged.current) {
      filtersChanged.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tauntId = params.get('taunt') ? String(params.get('taunt')) : null;
    let taunt = null;
    if (tauntId) {
      taunt = filteredTaunts.find(t => String(t.TauntID) === tauntId);
    }
    if (!taunt && !isMobile) {
      taunt = filteredTaunts[0];
    }
    setSelectedTaunt(taunt);
    setCurrentAnimation('Default');
    setRandomAnimIndex('player1');
  }, [taunts, filteredTaunts, isMobile]);

  useEffect(() => {
    if (isMobile && selectedTaunt && !filteredTaunts.some(t => t.TauntID === selectedTaunt.TauntID)) {
      setSelectedTaunt(null);
    }
  }, [filteredTaunts, isMobile, selectedTaunt]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedTaunt) {
      currentParams.set('taunt', String(selectedTaunt.TauntID));
    }
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tauntId = params.get('taunt') ? String(params.get('taunt')) : null;
      if (tauntId && filteredTaunts.length > 0) {
        const taunt = filteredTaunts.find(t => String(t.TauntID) === tauntId);
        if (taunt) {
          setSelectedTaunt(taunt);
        } else if (!isMobile) {
          setSelectedTaunt(filteredTaunts[0]);
        } else {
          setSelectedTaunt(null);
        }
      } else if (!isMobile) {
        setSelectedTaunt(filteredTaunts[0]);
      } else {
        setSelectedTaunt(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTaunt, filteredTaunts, isMobile]);

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
    setFilterTeamTaunt('');
    setFilterEntitlement(false);
    setFilterBundle(false);
    setFilterTimedEvent('');
    if (isMobile) {
      setSelectedTaunt(null);
      filtersChanged.current = true;
    } else {
      setSelectedTaunt(filteredTaunts[0] || null);
    }
    setCurrentAnimation('Default');
    setRandomAnimIndex('player1');
  }, [filteredTaunts, isMobile]);

  function getProcessedStoreData(taunt) {
    let storeData = taunt.store || [];
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
        if (sd.IdolCost != 0 && sd.IdolCost != '' || sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') {
          if (sd.IdolCost != 0 && sd.IdolCost != '') {
            costs.mc = Number(sd.IdolCost);
          }
          if (sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') {
            costs.mcSale = Number(sd.IdolSaleCost);
          }
        } else {
          sd.ItemList.forEach(item => {
            if (item.IdolCost != 0 && item.IdolCost != '') {
              costs.mc += Number(item.IdolCost);
            }
            if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') {
              costs.mc += Number(item.IdolSaleCost);
            }
            if (item.GoldCost != 0 && item.GoldCost != '') {
              costs.gold += Number(item.GoldCost);
            }
            if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') {
              costs.gold += Number(item.GoldSaleCost);
            }
            if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') {
              costs.glory += Number(item.RankedPointsCost);
            }
            if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '' && item.SpecialCurrencyType) {
              costs.special[item.SpecialCurrencyType] = (costs.special[item.SpecialCurrencyType] || 0) + Number(item.SpecialCurrencyCost);
            }
          });
          if (sd.IdolBundleDiscount) {
            costs.mc = Math.floor(costs.mc * (sd.IdolBundleDiscount ?? 1));
          }
          if (sd.GoldBundleDiscount) {
            costs.gold = Math.floor(costs.gold * (sd.GoldBundleDiscount ?? 1));
          }
          if (sd.RankedPointsBundleDiscount) {
            costs.glory = Math.floor(costs.glory * (sd.RankedPointsBundleDiscount ?? 1));
          }
          if (sd.SpecialCurrencyBundleDiscount) {
            for (let currencyType in costs.special) {
              costs.special[currencyType] = Math.floor(costs.special[currencyType] * (sd.SpecialCurrencyBundleDiscount ?? 1));
            }
          }
        }
      } else {
        if (sd.IdolCost && sd.IdolCost != 0 && sd.IdolCost !== '') {
          costs.mc = Number(sd.IdolCost);
        }
        if (sd.IdolSaleCost && sd.IdolSaleCost != 0 && sd.IdolSaleCost !== '') {
          costs.mcSale = Number(sd.IdolSaleCost);
        }
        if (sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') {
          costs.gold = Number(sd.GoldCost);
        }
        if (sd.GoldSaleCost && sd.GoldSaleCost != 0 && sd.GoldSaleCost !== '') {
          costs.gold = Number(sd.GoldSaleCost);
        }
        if (sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') {
          costs.glory = Number(sd.RankedPointsCost);
        }
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

  function genStoreData(store) {
    return store.map((sd, idx) => (
      <div key={`store-${idx}`}  className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
        <span className="text-lg text-gray-900 dark:text-white">Store Data {sd.Type === 'Bundle' ? '(Bundle)' : '(Taunt)'}</span>
        <div className="grid grid-cols-2 gap-2 text-lg">
          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
            <span className="font-bold text-gray-600 dark:text-gray-300">Store Name</span>
            <span className="text-gray-900 dark:text-white">{sd.StoreName}</span>
          </div>
          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
            <span className="font-bold text-gray-600 dark:text-gray-300">Store ID</span>
            <span className="text-gray-900 dark:text-white">{sd.StoreID}</span>
          </div>
          {sd.Type === 'Bundle' && sd.ItemList && sd.ItemList.length > 0 ? (
            <div className="col-span-2 flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Bundle Cost</span>
              <div className="flex flex-wrap items-center gap-2">
                {sd.Costs.mc > 0 && (
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" />
                    {sd.Costs.mcSale > 0 ? (
                      <>
                        <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc}</span>
                        <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
                      </>
                    ) : (
                      <span className="text-gray-900 dark:text-white">{sd.Costs.mc}</span>
                    )}
                  </div>
                )}
                {sd.Costs.gold > 0 && (
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.gold}</span>
                  </div>
                )}
                {sd.Costs.glory > 0 && (
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.glory}</span>
                  </div>
                )}
                {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                  <div key={`special-${sIdx}`} className="flex items-center gap-1">
                    <img
                      src={`${host}/game/getGfx/storeIcon/${currencyType}`}
                      className="h-5 inline"
                      onError={e => (e.target.src = `${host}/game/getGfx/storeIcon/mc`)}
                    />
                    <span className="text-gray-900 dark:text-white">{cost}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {(sd.Costs.mc > 0 || sd.IdolCost != 0 && sd.IdolCost != '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.mc || sd.IdolCost}</span>
                  </div>
                </div>
              )}
              {sd.Costs.mcSale > 0 && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" />
                    <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc || sd.IdolCost}</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
                  </div>
                </div>
              )}
              {(sd.Costs.gold > 0 || sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.gold || sd.GoldCost}</span>
                  </div>
                </div>
              )}
              {sd.GoldSaleCost && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" />
                    <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                  </div>
                </div>
              )}
              {sd.GoldBundleDiscount && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Bundle Discount</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.GoldBundleDiscount}</span>
                  </div>
                </div>
              )}
              {(sd.Costs.glory > 0 || sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.glory || sd.RankedPointsCost}</span>
                  </div>
                </div>
              )}
              {sd.SpecialCurrencyType && (sd.Costs.special[sd.SpecialCurrencyType] || sd.SpecialCurrencyCost) && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">{sd.SpecialCurrencyType} Cost</span>
                  <div>
                    <img
                      src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`}
                      className="h-5 pr-1 inline"
                      onError={e => (e.target.src = `${host}/game/getGfx/storeIcon/mc`)}
                    />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.special[sd.SpecialCurrencyType] || sd.SpecialCurrencyCost}</span>
                  </div>
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
    ));
  }

  const Row = ({ index, data }) => {
    const taunt = data[index];
    const [imgLoading, setImgLoading] = useState(true);
    const storeData = getProcessedStoreData(taunt);

    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[260px]' : 'p-0 px-2 h-[160px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedTaunt?.TauntID === taunt.TauntID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => {
            setSelectedTaunt(taunt);
            setCurrentAnimation('Default');
            setRandomAnimIndex('player1');
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
              src={`${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${getPowerName(taunt)}/loop`}
              className="h-32 w-32 object-contain"
              onLoad={() => setImgLoading(false)}
              onError={e => e.target.style.display = 'none'}
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!taunt.store?.length && !taunt.bp && !taunt.promo && !taunt.entitlement && !taunt.timedEvent && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {taunt.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${taunt.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {taunt.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${!taunt.store?.length && !taunt.bp && !taunt.entitlement && !taunt.timedEvent ? ' Only' : ''}`}
                    </div>
                  )}
                  {taunt.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[taunt.entitlement.DisplayNameKey]?.replace('!', '') || taunt.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {taunt.timedEvent && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${taunt.timedEvent.TimedEventName} Event`}
                    </div>
                  )}
                  {taunt.powerData?.TeamTauntPower && (
                    <div className="bg-blue-400 dark:bg-blue-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Team Taunt
                    </div>
                  )}
                  {taunt.store?.length > 0 && (() => {
                    const labels = [...new Set(taunt.store.map(s => s.Label).filter(Boolean))];
                    return labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "No Longer Purchasable" : label}
                      </div>
                    ));
                  })()}
                  {taunt.store?.length > 0 && (() => {
                    const promos = [...new Set(taunt.store.map(s => s.TimedPromotion).filter(Boolean))];
                    return promos.map((promo, idx) => (
                      <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className={`flex flex-row items-center gap-2 text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <span className={viewMode === 'grid' ? 'truncate max-w-[10rem]' : ''}>{langs.content[taunt.DisplayNameKey] || taunt.TauntName}</span>
              </div>
              {viewMode === 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!taunt.store?.length && !taunt.bp && !taunt.promo && !taunt.entitlement && !taunt.timedEvent && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {taunt.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Battle Pass Season ${taunt.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {taunt.promo && !taunt.store?.length && !taunt.bp && !taunt.entitlement && !taunt.timedEvent && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Promo Code Only`}
                    </div>
                  )}
                  {taunt.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`${langs.content[taunt.entitlement.DisplayNameKey]?.replace('!', '') || taunt.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {taunt.timedEvent && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`${taunt.timedEvent.TimedEventName} Event`}
                    </div>
                  )}
                  {taunt.powerData?.TeamTauntPower && (
                    <div className="bg-blue-400 dark:bg-blue-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Team Taunt
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white">
              {storeData.map((sd, idx) => (
                <div key={`costs-${idx}`} className="flex flex-wrap gap-2">
                  {(sd.Type === 'Bundle' && (sd.Costs.mc > 0 || sd.Costs.mcSale > 0)) ? (
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" />
                      {sd.Costs.mcSale > 0 ? (
                        <>
                          <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc}</span>
                          <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
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
    );
  };

  let randomPowers = [];
  if (selectedTaunt?.RandomPowers) {
    randomPowers = selectedTaunt.RandomPowers.split(',').map(s => s.trim()).filter(Boolean);
  }

  return (
    <div className="flex flex-col lg:flex-row h-full" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
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
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Taunts ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
              {(optionCounts.TeamTaunt.yes > 0 || optionCounts.TeamTaunt.no > 0) && (
                <select
                  value={filterTeamTaunt}
                  onChange={e => handleFilterChange(setFilterTeamTaunt, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Taunt Type</option>
                  {optionCounts.TeamTaunt.no > 0 && <option value="no">Non-Team Taunt ({optionCounts.TeamTaunt.no})</option>}
                  {optionCounts.TeamTaunt.yes > 0 && <option value="yes">Team Taunt ({optionCounts.TeamTaunt.yes})</option>}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={storeOnly}
                  onChange={() => handleFilterChange(setStoreOnly, !storeOnly)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                Store Taunts Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={filterEntitlement}
                  onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                DLC Taunts ({optionCounts.DLC || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={!!filterBundle}
                  onChange={() => handleFilterChange(setFilterBundle, !filterBundle)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                Bundles Only ({optionCounts.Bundle || 0})
              </label>
              <button onClick={resetFilters} aria-label="Reset all filters" className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Reset Filters
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col mb-2">
          <div className="lg:flex gap-4 items-center">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
                placeholder="Search Taunts"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="flex justify-between items-center w-full sm:w-auto py-2 gap-4">
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
                Showing {filteredTaunts.length} Taunt{filteredTaunts.length !== 1 ? 's' : ''}
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
            </div>
          </div>
          <div className="relative">
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value)}
              className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none"
            >
              <option value="ArrayIndexDesc">Default Sorting (Desc)</option>
              <option value="ArrayIndexAsc">Default Sorting (Asc)</option>
              <option value="TauntIDDesc">Taunt ID (Desc)</option>
              <option value="TauntIDAsc">Taunt ID (Asc)</option>
              <option value="StoreIDDesc">Store ID (Desc)</option>
              <option value="StoreIDAsc">Store ID (Asc)</option>
              <option value="AlphaAsc">Alphabetical (A-Z)</option>
              <option value="AlphaDesc">Alphabetical (Z-A)</option>
              <option value="CostDesc">Mammoth Cost (Desc)</option>
              <option value="CostAsc">Mammoth Cost (Asc)</option>
              <option value="RarityDesc">Rarity (Desc)</option>
              <option value="RarityAsc">Rarity (Asc)</option>
              <option value="PopularityDesc">Popularity (Desc)</option>
              <option value="PopularityAsc">Popularity (Asc)</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        <div className="h-[100vh]">
          {viewMode === 'list' ? (
            <Virtuoso
              data={filteredTaunts}
              totalCount={filteredTaunts.length}
              itemContent={(index, taunt) => <Row index={index} data={filteredTaunts} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredTaunts}
              totalCount={filteredTaunts.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="taunt-grid-item"
              itemContent={(index, taunt) => <Row index={index} data={filteredTaunts} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedTaunt ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden text-gray-900 dark:text-white"
              onClick={() => setSelectedTaunt(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedTaunt && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handleCopyLink}
                  className="bg-blue-500 dark:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors duration-200"
                >
                  Copy Link
                </button>
                {copyFeedback && (
                  <span className="text-sm text-gray-900 dark:text-gray-300">{copyFeedback}</span>
                )}
              </div>
            )}
          </div>
          {selectedTaunt ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[getDisplayNameKey(selectedTaunt)] || selectedTaunt.TauntName}</span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedTaunt)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedTaunt)]}
                  </div>
                )}
                {selectedTaunt.store?.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedTaunt.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {selectedTaunt.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedTaunt.promo.Type}
                      </span>
                    )}
                    {selectedTaunt.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedTaunt.bp.ID.replace('BP', '').replace('-', ' ')} (Tier {selectedTaunt.bp.Tier})
                      </span>
                    )}
                    {selectedTaunt.timedEvent && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-600 text-gray-900 dark:text-white">
                        {selectedTaunt.timedEvent.TimedEventName} Event
                      </span>
                    )}
                    {selectedTaunt.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {langs.content[selectedTaunt.entitlement.DisplayNameKey]?.replace('!', '') || selectedTaunt.entitlement.EntitlementName} DLC
                      </span>
                    )}
                    {selectedTaunt.powerData?.TeamTauntPower && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-blue-400 dark:bg-blue-700 text-gray-900 dark:text-white">
                        Team Taunt
                      </span>
                    )}
                    {selectedTaunt.store?.length > 0 && (() => {
                      const labels = [...new Set(selectedTaunt.store.map(s => s.Label).filter(Boolean))];
                      return labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "No Longer Purchasable" : label}
                        </span>
                      ));
                    })()}
                    {selectedTaunt.store?.length > 0 && (() => {
                      const promos = [...new Set(selectedTaunt.store.map(s => s.TimedPromotion).filter(Boolean))];
                      return promos.map((promo, idx) => (
                        <span key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-sm px-3 py-1 rounded-lg">
                          {formatLabel(promo)}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="order-2 lg:order-1 lg:w-1/2 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                      <span className="text-lg text-gray-900 dark:text-white">Taunt Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Taunt Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedTaunt.TauntName}</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Taunt ID</span>
                          <span className="text-gray-900 dark:text-white">{selectedTaunt.TauntID}</span>
                        </div>
                        {selectedTaunt.PowerName && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Power Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedTaunt.PowerName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {getProcessedStoreData(selectedTaunt).length > 0 && genStoreData(getProcessedStoreData(selectedTaunt))}
                    {selectedTaunt.timedEvent && (
                      <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                        <span className="text-lg text-gray-900 dark:text-white">Timed Event Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedTaunt.timedEvent.TimedEventName}</span>
                          </div>
                          {selectedTaunt.timedEvent.TimedEventID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.timedEvent.TimedEventID}</span>
                            </div>
                          )}
                          {selectedTaunt.timedEvent.EventCenterHeaderKey && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Event Header</span>
                              <span className="text-gray-900 dark:text-white">{langs.content[selectedTaunt.timedEvent.EventCenterHeaderKey] || selectedTaunt.timedEvent.EventCenterHeaderKey}</span>
                            </div>
                          )}
                          {selectedTaunt.timedEvent.EventRewardCurrency && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Reward Currency</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.timedEvent.EventRewardCurrency}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedTaunt.entitlement && (
                      <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                        <span className="text-lg text-gray-900 dark:text-white">Entitlement Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.EntitlementName}</span>
                          </div>
                          {selectedTaunt.entitlement.EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.EntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.SteamAppID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Steam App ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.SteamAppID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.SonyEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.SonyEntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.SonyProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.SonyProductID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.NintendoConsumableID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Consumable ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.NintendoConsumableID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.NintendoEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.NintendoEntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.XB1EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.XB1EntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.XB1ProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.XB1ProductID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.XB1StoreID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Store ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.XB1StoreID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.AppleEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Apple Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.AppleEntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.AndroidEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Android Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.AndroidEntitlementID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.UbiConnectID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.UbiConnectID}</span>
                            </div>
                          )}
                          {selectedTaunt.entitlement.UbiConnectPackageID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect Package ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedTaunt.entitlement.UbiConnectPackageID}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="order-1 lg:order-2 lg:w-1/2 flex flex-col gap-2 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <span className="text-lg text-gray-900 dark:text-white">Animation Data</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCurrentAnimation('Default');
                        setAnimLoading(true);
                      }}
                      className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${currentAnimation === 'Default' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                    >
                      All Frames
                    </button>
                    <button
                      onClick={() => {
                        setCurrentAnimation('Loop');
                        setAnimLoading(true);
                      }}
                      className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${currentAnimation === 'Loop' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
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
                      src={`${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${selectedTaunt?.powerData?.TeamTauntPower?.PowerName && randomAnimIndex === 'player2'
                        ? selectedTaunt.powerData.TeamTauntPower.PowerName
                        : (randomPowers.length && typeof randomAnimIndex === 'number' && randomAnimIndex < randomPowers.length)
                          ? randomPowers[randomAnimIndex]
                          : selectedTaunt.PowerName
                        }/${currentAnimation === 'Loop' ? 'loop' : 'all'}`}
                      className="h-96"
                      onLoad={() => setAnimLoading(false)}
                      onError={e => e.target.style.display = 'none'}
                      style={{ opacity: animLoading ? 0 : 1, transition: 'opacity 0.2s' }}
                      alt={`${langs.content && langs.content[getDisplayNameKey(selectedTaunt)] || selectedTaunt.TauntName} animation`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedTaunt?.powerData?.TeamTauntPower?.PowerName && (
                      <div>
                        <span className="text-base dark:text-white text-gray-900">Player Animation</span>
                        <div className="w-full flex gap-2">
                          <button
                            onClick={() => {
                              setRandomAnimIndex('player1');
                              setAnimLoading(true);
                            }}
                            className={`py-1 px-3 w-full rounded-lg text-sm font-bold transition-colors duration-200 ${randomAnimIndex === 'player1' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                          >
                            1st Player
                          </button>
                          <button
                            onClick={() => {
                              setRandomAnimIndex('player2');
                              setAnimLoading(true);
                            }}
                            className={`py-1 px-3 w-full rounded-lg text-sm font-bold transition-colors duration-200 ${randomAnimIndex === 'player2' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                          >
                            2nd Player
                          </button>
                        </div>
                      </div>
                    )}
                    {randomPowers.length > 0 && (
                      <div>
                        <span className="text-base dark:text-white text-gray-900">Random Animations</span>
                        <div className="grid grid-cols-2 gap-2">
                          {randomPowers.map((power, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setRandomAnimIndex(idx);
                                setAnimLoading(true);
                              }}
                              className={`py-1 px-3 rounded-lg w-full text-sm font-bold transition-colors duration-200 ${randomAnimIndex === idx ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                            >
                              {power}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 italic">Select a taunt to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}