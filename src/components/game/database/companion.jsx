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

function useOptionCounts(companions, filters, helpers) {
  const applyFilters = useCallback((companion, excludeKey) => {
    for (const [key, filterVal] of Object.entries(filters)) {
      if (key === excludeKey || !filterVal) continue;

      if (key === 'ChestName') {
        if (filterVal === 'AllChests' && !companion.chest) return false;
        if (filterVal === 'AllChestExclusives' && !(companion.chest && (Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).some(sd => sd.IdolCost == 0))) return false;
        if (filterVal !== 'AllChests' && filterVal !== 'AllChestExclusives' && helpers.ChestName(companion) !== filterVal) return false;
        continue;
      }

      if (key === 'BPSeason') {
        if (filterVal === 'AllBP' && !companion.bp) return false;
        if (filterVal !== 'AllBP' && helpers.BPSeason(companion) !== filterVal) return false;
        continue;
      }

      if (key === 'StoreOnly' && !(Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).length) return false;
      if (key === 'Entitlement' && !companion.entitlement) return false;
      if (Array.isArray(filterVal) && !filterVal.includes(helpers[key](companion))) return false;
      if (!Array.isArray(filterVal) && helpers[key](companion) !== filterVal) return false;
    }
    return true;
  }, [filters, helpers]);

  return useMemo(() => {
    const counts = {
      Cohort: {}, TimedPromotion: {}, Rarity: {}, StoreID: {}, StoreLabel: {}, PromoType: {}, ChestName: {}, BPSeason: {}, Entitlement: {},
      AllChests: 0, AllChestExclusives: 0, AllBP: 0, StoreOnly: 0,
    };

    companions.forEach(companion => {
      if (!applyFilters(companion)) return;

      counts.AllChests += companion.chest ? 1 : 0;
      counts.AllChestExclusives += (companion.chest && (Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).some(sd => sd.IdolCost == 0)) ? 1 : 0;
      counts.AllBP += companion.bp ? 1 : 0;
      counts.StoreOnly += (Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).length > 0 ? 1 : 0;

      ['Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'ChestName', 'BPSeason', 'Entitlement'].forEach(key => {
        const val = helpers[key](companion);
        if (val) counts[key][val] = (counts[key][val] || 0) + 1;
      });
    });

    return counts;
  }, [companions, filters, helpers, applyFilters]);
}

function getAnimButtonRows() {
  const animations = [
    { key: 'ActOut', label: 'Act Out', anim: 'ActOut', urlType: 'all' },
    { key: 'DodgeAir', label: 'Dodge Air', anim: 'DodgeAir', urlType: 'all' },
    { key: 'Emote', label: 'Emote', anim: 'Emote', urlType: 'all' },
    { key: 'FallFast', label: 'Fall Fast', anim: 'FallFast', urlType: 'all' },
    { key: 'FallTurn', label: 'Fall Turn', anim: 'FallTurn', urlType: 'all' },
    { key: 'HitReact', label: 'Hit React', anim: 'HitReact', urlType: 'all' },
    { key: 'Jump', label: 'Jump', anim: 'Jump', urlType: 'all' },
    { key: 'Leave', label: 'Leave', anim: 'Leave', urlType: 'all' },
    { key: 'LookDown', label: 'Look Down', anim: 'LookDown', urlType: 'all' },
    { key: 'LookUp', label: 'Look Up', anim: 'LookUp', urlType: 'all' },
    { key: 'Ready', label: 'Ready', anim: 'Ready', urlType: 'all' },
    { key: 'ReadyTurn', label: 'Ready Turn', anim: 'ReadyTurn', urlType: 'all' },
    { key: 'RespawnFall', label: 'Respawn Fall', anim: 'RespawnFall', urlType: 'all' },
  ];

  const rows = [];
  for (let i = 0; i < animations.length; i += 4) {
    rows.push(animations.slice(i, i + 4));
  }
  return rows;
}

export function CompanionStoreView({ companions, langs }) {
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterChestName, setFilterChestName] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState({ anim: 'Ready', urlType: 'all' });
  const [animationType, setAnimationType] = useState('all');
  const [copyFeedback, setCopyFeedback] = useState('');
  const topRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const [viewMode, setViewMode] = useState('list');
  const [animLoading, setAnimLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);



  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (isMobile) {
      setSelectedCompanion(null);
      filtersChanged.current = true;
    }
  }, [
    filterCohort,
    filterPromo,
    filterRarity,
    filterStoreID,
    storeOnly,
    filterStoreLabel,
    filterPromoType,
    filterChestName,
    filterBPSeason,
    filterEntitlement,
    debouncedSearch,
    sortType,
    isMobile,
  ]);

  const helpers = useMemo(() => ({
    Cohort: c => (Array.isArray(c.store) ? c.store[0]?.Cohort : c.exclusive?.store?.[0]?.Cohort) ?? '',
    TimedPromotion: c => (Array.isArray(c.store) ? c.store[0]?.TimedPromotion : c.exclusive?.store?.[0]?.TimedPromotion) ?? '',
    Rarity: c => (Array.isArray(c.store) ? c.store[0]?.Rarity : c.exclusive?.store?.[0]?.Rarity) ?? '',
    StoreID: c => (Array.isArray(c.store) ? c.store[0]?.StoreID : c.exclusive?.store?.[0]?.StoreID) ?? -1,
    StoreLabel: c => (Array.isArray(c.store) ? c.store[0]?.Label : c.exclusive?.store?.[0]?.Label) ?? '',
    PromoType: c => c.promo?.Type ?? '',
    ChestName: c => c.chest?.ChanceBoxName ?? '',
    BPSeason: c => c.bp?.ID ?? '',
    Entitlement: c => !!c.entitlement,
  }), []);

  const cohorts = useMemo(() => uniqueValues(companions, ['store', 'Cohort']).concat(uniqueValues(companions, ['exclusive', 'store', 'Cohort'])), [companions]);
  const promotions = useMemo(() => uniqueValues(companions, ['store', 'TimedPromotion']).concat(uniqueValues(companions, ['exclusive', 'store', 'TimedPromotion'])), [companions]);
  const rarities = useMemo(() => uniqueValues(companions, ['store', 'Rarity']).concat(uniqueValues(companions, ['exclusive', 'store', 'Rarity'])), [companions]);
  const storeLabels = useMemo(() => uniqueValues(companions, ['store', 'Label']).concat(uniqueValues(companions, ['exclusive', 'store', 'Label'])), [companions]);
  const promoTypes = useMemo(() => uniqueValues(companions, ['promo', 'Type']), [companions]);
  const chestNames = useMemo(() => uniqueValues(companions, ['chest', 'ChanceBoxName']), [companions]);
  const bpSeasons = useMemo(() => {
    return [
      ...new Set(
        companions
          .filter(c => c.bp && c.bp.ID)
          .map(c => c.bp.ID)
      ),
    ].sort((a, b) => {
      const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
      const nA = getNum(a), nB = getNum(b);
      if (nA !== nB) return nA - nB;
      return a.localeCompare(b);
    });
  }, [companions]);

  const optionCounts = useOptionCounts(
    companions,
    {
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      Rarity: filterRarity,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      ChestName: filterChestName,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      StoreOnly: storeOnly,
    },
    helpers
  );

  const getDisplayNameKey = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.DisplayNameKey ?? c.companionData?.DisplayNameKey ?? '';
  };
  const getCohort = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.Cohort ?? '';
  };
  const getDescriptionKey = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.DescriptionKey ?? c.companionData?.DescriptionKey ?? '';
  };
  const getIdolCost = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.IdolCost ?? '';
  };
  const getStoreID = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.StoreID ?? -1;
  };
  const getRarity = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.Rarity ?? '';
  };
  const getLabel = c => {
    const storeData = Array.isArray(c.store) ? c.store : c.exclusive?.store || [];
    return storeData[0]?.Label ?? '';
  };
  const getPromoType = c => c.promo?.Type ?? '';
  const getBPSeason = c => c.bp?.ID ?? '';
  const getChestName = c => c.chest?.ChanceBoxName ?? '';

  const filteredCompanions = useMemo(() => {
    const search = debouncedSearch.toLowerCase();

    const passesSearch = (companion) => {
      const allStores = Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || [];
      const fields = [
        langs.content[getDisplayNameKey(companion)] || '',
        langs.content[companion.companionData?.DisplayNameKey] || '',
        allStores.map(sd => sd.StoreName).join(' '),
        allStores.map(sd => sd.Item).join(' '),
        companion.companionData?.CompanionName || '',
        allStores.map(sd => sd.Label).join(' '),
        allStores.map(sd => sd.TimedPromotion).join(' '),
        allStores.map(sd => sd.SearchTags).join(' '),
        companion.promo?.StoreName || '',
        companion.promo?.Item || '',
        companion.promo?.Label || '',
        companion.bp?.Item || '',
        companion.bp?.ID || '',
        companion.bp?.DescriptionKey || '',
        companion.chest?.ChanceBoxName || '',
        companion.chest?.DisplayNameKey || '',
        companion.entitlement?.EntitlementName || '',
        companion.entitlement?.DisplayNameKey || '',
        String(companion.companionData?.CompanionID || ''),
        allStores.map(sd => sd.StoreID).join(' '),
        allStores.map(sd => sd.IdolCost).join(' '),
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    };

    return companions.filter(companion => {
      if (!passesSearch(companion)) return false;
      if (filterCohort && helpers.Cohort(companion) !== filterCohort) return false;
      if (filterPromo && helpers.PromoType(companion) !== filterPromo) return false;
      if (filterRarity && helpers.Rarity(companion) !== filterRarity) return false;
      if (filterStoreID && helpers.StoreID(companion) !== filterStoreID) return false;
      if (filterStoreLabel && helpers.StoreLabel(companion) !== filterStoreLabel) return false;
      if (filterPromoType && helpers.PromoType(companion) !== filterPromoType) return false;
      if (filterChestName) {
        if (filterChestName === 'AllChests' && !companion.chest) return false;
        if (filterChestName === 'AllChestExclusives' && !(Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).some(sd => sd.IdolCost == 0)) return false;
        if (filterChestName !== 'AllChests' && filterChestName !== 'AllChestExclusives' && helpers.ChestName(companion) !== filterChestName) return false;
      }
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP' && !companion.bp) return false;
        if (filterBPSeason !== 'AllBP' && helpers.BPSeason(companion) !== filterBPSeason) return false;
      }
      if (filterEntitlement && !companion.entitlement) return false;
      if (storeOnly && !(Array.isArray(companion.store) ? companion.store : companion.exclusive?.store || []).length) return false;
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
      const companionA = parseInt(a.companionData?.CompanionID) || 0;
      const companionB = parseInt(b.companionData?.CompanionID) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        case 'CompanionIDAsc': return companionA - companionB;
        case 'CompanionIDDesc': return companionB - companionA;
        default: return 0;
      }
    });
  }, [
    companions, debouncedSearch, sortType, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, langs, helpers
  ]);

  const handleFilterChange = useCallback((setter, value) => {
    setter(value);
  }, []);

  useEffect(() => {
    if (companions.length === 0 || filteredCompanions.length === 0) return;
    if (isMobile && filtersChanged.current) {
      filtersChanged.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const companionId = params.get('companion') ? String(params.get('companion')) : null;
    let companion = null;
    if (companionId) {
      companion = filteredCompanions.find(c => String(c.companionData?.CompanionID) === companionId);
    }
    if (!companion && !isMobile) {
      companion = filteredCompanions[0];
    }
    setSelectedCompanion(companion);
    setCurrentAnimation({ anim: 'Ready', urlType: 'all' });
    setAnimationType('all');
  }, [companions, filteredCompanions, isMobile]);

  useEffect(() => {
    if (isMobile && selectedCompanion && !filteredCompanions.some(c => c.companionData?.CompanionID === selectedCompanion.companionData?.CompanionID)) {
      setSelectedCompanion(null);
    }
  }, [filteredCompanions, isMobile, selectedCompanion]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedCompanion) {
      currentParams.set('companion', String(selectedCompanion.companionData?.CompanionID));
    }
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const companionId = params.get('companion') ? String(params.get('companion')) : null;
      if (companionId && filteredCompanions.length > 0) {
        const companion = filteredCompanions.find(c => String(c.companionData?.CompanionID) === companionId);
        if (companion) {
          setSelectedCompanion(companion);
        } else if (!isMobile) {
          setSelectedCompanion(filteredCompanions[0]);
        } else {
          setSelectedCompanion(null);
        }
      } else if (!isMobile) {
        setSelectedCompanion(filteredCompanions[0]);
      } else {
        setSelectedCompanion(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCompanion, filteredCompanions, isMobile]);

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
    setFilterChestName('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    if (isMobile) {
      setSelectedCompanion(null);
      filtersChanged.current = true;
    } else {
      setSelectedCompanion(filteredCompanions[0] || null);
    }
    setCurrentAnimation({ anim: 'Ready', urlType: 'all' });
    setAnimationType('all');
  }, [filteredCompanions, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedCompanion) return;
    const url = `${window.location.origin}${window.location.pathname}?companion=${selectedCompanion.companionData?.CompanionID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedCompanion]);

  const Row = ({ index, data }) => {
    const companion = data[index];
    const [imgLoading, setImgLoading] = useState(true);
    let storeData = [...companion?.store ?? [], ...companion.exclusive?.store ?? []];
    storeData = [...new Map(storeData.map(sd => [sd.StoreID, sd])).values()];
    storeData = storeData.map(sd => {
      let total = 0;
      if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
        total = sd.ItemList
          .map(item => {
            if (item.IdolCost != 0 && item.IdolCost != '') return Number(item.IdolCost);
            if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return Number(item.IdolSaleCost);
            if (item.GoldCost != 0 && item.GoldCost != '') return Number(item.GoldCost);
            if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return Number(item.GoldSaleCost);
            if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return Number(item.GoldBundleDiscount);
            if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return Number(item.RankedPointsCost);
            if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return Number(item.SpecialCurrencyCost);
            return 0;
          })
          .reduce((sum, num) => sum + num, 0);
        if (sd.IdolBundleDiscount) total = Math.floor(total * sd.IdolBundleDiscount);
      } else {
        if (sd.IdolCost && sd.IdolCost != 0 && sd.IdolCost !== '') total = Number(sd.IdolCost);
        else if (sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') total = Number(sd.GoldCost);
        else if (sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') total = Number(sd.RankedPointsCost);
        else if (sd.SpecialCurrencyCost && sd.SpecialCurrencyCost != 0 && sd.SpecialCurrencyCost !== '') total = Number(sd.SpecialCurrencyCost);
      }
      return { ...sd, TotalCost: total };
    });
    storeData = storeData.sort((a, b) => a.TotalCost - b.TotalCost);

    console.log(companion.companionData.CompanionID, storeData, companion.exclusive?.store)
    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[340px]' : 'p-0 px-2 h-[185px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedCompanion?.companionData?.CompanionID === companion.companionData?.CompanionID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => {
            setSelectedCompanion(companion);
            setCurrentAnimation({ anim: 'Ready', urlType: 'all' });
            setAnimationType('all');
            filtersChanged.current = false;
          }}
        >
          <div className={`flex p-3 rounded-lg items-center justify-center bg-gray-100 dark:bg-slate-900 relative`}>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                </svg>
              </div>
            )}
            <img
              src={`${host}/game/animCompanion/${companion.companionData?.CompanionID}/Ready/all`}
              className="h-32 w-32 object-contain"
              onLoad={() => setImgLoading(false)}
              
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {storeData.length == 0 && !companion.bp && !companion.promo && !companion.entitlement && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {companion.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${companion.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {companion.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${(!storeData.length && !companion.bp && !companion.entitlement) ? ' Only' : ''}`}
                    </div>
                  )}
                  {companion.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[companion.entitlement.DisplayNameKey]?.replace('!', '') || companion.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {companion.chest && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {(storeData.some(sd => sd.IdolCost == 0)) ? `${langs.content[companion.chest.DisplayNameKey]} Exclusive` : langs.content[companion.chest.DisplayNameKey]}
                    </div>
                  )}
                  {storeData.length > 0 && (() => {
                    const labels = [...new Set(storeData.map(sd => sd.Label).filter(Boolean))];
                    return labels.length > 0 && labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "No Longer Purchasable" : label}
                      </div>
                    ));
                  })()}
                  {storeData.length > 0 && (() => {
                    const promos = [...new Set(storeData.map(sd => sd.TimedPromotion).filter(Boolean))];
                    return promos.length > 0 && promos.map((promo, idx) => (
                      <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className={`flex flex-row items-center gap-2 text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <img src={`${host}/game/getGfx/${companion.companionData?.IconFileName}/${companion.companionData?.IconName}`} className="inline h-7"  />
                <span className={viewMode === 'grid' ? 'truncate max-w-[10rem]' : ''}>{langs.content[getDisplayNameKey(companion)] || companion.companionData?.CompanionName}</span>
              </div>
              {viewMode === 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {storeData.length == 0 && !companion.bp && !companion.promo && !companion.entitlement && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {companion.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Battle Pass Season ${companion.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {companion.promo && (!storeData.length) && !companion.bp && !companion.entitlement && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Promo Code Only`}
                    </div>
                  )}
                  {companion.chest && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {(storeData.some(sd => sd.IdolCost == 0)) ? `${langs.content[companion.chest.DisplayNameKey]} Exclusive` : langs.content[companion.chest.DisplayNameKey]}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={`text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white`}>
              {storeData.map((sd, idx) => {
                if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
                  const total = sd.ItemList
                    .map(item => {
                      if (item.IdolCost != 0 && item.IdolCost != '') return Number(item.IdolCost);
                      if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return Number(item.IdolSaleCost);
                      if (item.GoldCost != 0 && item.GoldCost != '') return Number(item.GoldCost);
                      if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return Number(item.GoldSaleCost);
                      if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return Number(item.GoldBundleDiscount);
                      if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return Number(item.RankedPointsCost);
                      if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return Number(item.SpecialCurrencyCost);
                      return 0;
                    })
                    .reduce((sum, num) => sum + num, 0);
                  const bundleCost = sd.IdolBundleDiscount ? Math.floor(total * sd.IdolBundleDiscount) : total;
                  return (
                    <div key={`bundle-${idx}`}>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1"  />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                    </div>
                  );
                }
                console.log(sd)
                if (sd.IdolCost && sd.IdolCost != 0) {
                  return (
                    <div key={`idol-${idx}`}>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1"  />
                      <span>{sd.IdolCost}</span>
                      {sd.Type == "Costume" && <span className="text-xs text-gray-500 dark:text-gray-400"> (Skin)</span>}
                    </div>
                  );
                }
                return null;
              })}
              {storeData.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1"  />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {storeData.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1"  />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {storeData.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`} className="inline h-4 mr-1"  />
                    <span>{sd.SpecialCurrencyCost}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div >
    );
  };
  function getProcessedStoreData(companion) {
    let storeData = [...companion?.store ?? [], ...companion.exclusive?.store ?? []];
    storeData = [...new Map(storeData.map(sd => [sd.StoreID, sd])).values()];
    storeData = storeData.map(sd => {
      let total = 0;
      if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
        total = sd.ItemList
          .map(item => {
            if (item.IdolCost != 0 && item.IdolCost != '') return Number(item.IdolCost);
            if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return Number(item.IdolSaleCost);
            if (item.GoldCost != 0 && item.GoldCost != '') return Number(item.GoldCost);
            if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return Number(item.GoldSaleCost);
            if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return Number(item.GoldBundleDiscount);
            if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return Number(item.RankedPointsCost);
            if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return Number(item.SpecialCurrencyCost);
            return 0;
          })
          .reduce((sum, num) => sum + num, 0);
        if (sd.IdolBundleDiscount) total = Math.floor(total * sd.IdolBundleDiscount);
      } else {
        if (sd.IdolCost && sd.IdolCost != 0 && sd.IdolCost !== '') total = Number(sd.IdolCost);
        else if (sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') total = Number(sd.GoldCost);
        else if (sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') total = Number(sd.RankedPointsCost);
        else if (sd.SpecialCurrencyCost && sd.SpecialCurrencyCost != 0 && sd.SpecialCurrencyCost !== '') total = Number(sd.SpecialCurrencyCost);
      }
      return { ...sd, TotalCost: total };
    });
    storeData = storeData.sort((a, b) => a.TotalCost - b.TotalCost);
    return storeData;
  }
  function genStoreData(store, isExclusive = false) {
    return store.map((sd, idx) => {
      return (
        <div key={`store-${isExclusive ? 'exclusive-' : ''}${idx}`}>
          <span className="text-lg text-gray-900 dark:text-white">Store Data {sd.Type == 'Bundle' ? '(Bundle)' : sd.Type == 'Costume' ? '(Skin)' : '(Companion)'}</span>
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
                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline"  />
                  <span className="line-through text-red-600 dark:text-red-400">{
                    sd.ItemList.map((item) => {
                      if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                      if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                      if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                      if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                      if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                      if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                      if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                    }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0)}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-bold">{Math.floor((sd.ItemList.map((item) => {
                    if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                    if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                    if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                    if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                    if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                    if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                    if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                  }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0) * sd.IdolBundleDiscount).toFixed(2))}</span>
                </div>
              </div>
            ) : (
              <div className='col-span-2 grid grid-cols-2 gap-2'>
                {(sd.IdolCost != 0 && sd.IdolCost != '') && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline"  />
                      <span className="text-gray-900 dark:text-white">{sd.IdolCost}</span>
                    </div>
                  </div>
                )}
                {sd.IdolSaleCost && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                    <div className="flex items-center gap-1">
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline"  />
                      <span className="line-through text-red-600 dark:text-red-400">{sd.IdolCost}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.IdolSaleCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldCost && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline"  />
                      <span className="text-gray-900 dark:text-white">{sd.GoldCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldSaleCost && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                    <div className="flex items-center gap-1">
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline"  />
                      <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldBundleDiscount && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Gold Bundle Discount</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline"  />
                      <span className="text-gray-900 dark:text-white">{sd.GoldBundleDiscount}</span>
                    </div>
                  </div>
                )}
                {sd.RankedPointsCost && (
                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline"  />
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
    });
  }

  function genExclusiveData(exclusive) {
    return (
      <div>
        <span className="text-lg text-gray-900 dark:text-white">Exclusive Data</span>
        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
          {exclusive.costumeData?.CostumeName && (
            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Costume Name</span>
              <span className="text-gray-900 dark:text-white">{exclusive.costumeData.CostumeName}</span>
            </div>
          )}
          {exclusive.costumeData?.CostumeID && (
            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Costume ID</span>
              <span className="text-gray-900 dark:text-white">{exclusive.costumeData.CostumeID}</span>
            </div>
          )}
          {exclusive.costumeData?.OwnerHero && (
            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Owner Hero</span>
              <span className="text-gray-900 dark:text-white">{exclusive.costumeData.OwnerHero}</span>
            </div>
          )}
          {exclusive.costumeData?.IsCrossover && (
            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Is Crossover</span>
              <span className="text-gray-900 dark:text-white">{exclusive.costumeData.IsCrossover}</span>
            </div>
          )}
        </div>
      </div>
    );
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
              {(optionCounts.AllChests > 0 || optionCounts.AllChestExclusives > 0 || Object.values(optionCounts.ChestName).some(count => count > 0)) && (
                <select
                  value={filterChestName}
                  onChange={e => handleFilterChange(setFilterChestName, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Chests</option>
                  {optionCounts.AllChests > 0 && <option value="AllChests">All Chest Companions ({optionCounts.AllChests})</option>}
                  {optionCounts.AllChestExclusives > 0 && <option value="AllChestExclusives">All Chest Exclusives ({optionCounts.AllChestExclusives})</option>}
                  {chestNames.filter(n => optionCounts.ChestName[n] > 0).map(n => (
                    <option key={n} value={n}>
                      {langs.content[`ChanceBoxType_${n}_DisplayName`] || n} ({optionCounts.ChestName[n]})
                    </option>
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
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Companions ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-row w-full items-center">
              <div className="flex gap-4 items-center">
                <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                  <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Store Companions Only
                </label>
                <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                  <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  DLC Companions
                </label>
              </div>
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
                placeholder="Search Companions"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className='flex justify-between items-center w-full sm:w-auto py-2 gap-4'>
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
                Showing {filteredCompanions.length} Companion{filteredCompanions.length !== 1 ? 's' : ''}
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
              <option value="CompanionIDDesc">Companion ID (Desc)</option>
              <option value="CompanionIDAsc">Companion ID (Asc)</option>
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
              data={filteredCompanions}
              totalCount={filteredCompanions.length}
              itemContent={(index, companion) => <Row index={index} data={filteredCompanions} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredCompanions}
              totalCount={filteredCompanions.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="companion-grid-item"
              itemContent={(index, companion) => <Row index={index} data={filteredCompanions} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedCompanion ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden text-gray-900 dark:text-white"
              onClick={() => setSelectedCompanion(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedCompanion && (
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
          {selectedCompanion ? (
            <div className='gap-2 flex flex-col'>
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={`${host}/game/getGfx/${selectedCompanion.companionData?.IconFileName}/${selectedCompanion.companionData?.IconName}`}
                      className="h-8 w-8 object-contain"
                      
                    />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[getDisplayNameKey(selectedCompanion)] || selectedCompanion.companionData?.CompanionName}</span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedCompanion)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedCompanion)]}
                  </div>
                )}
                {((Array.isArray(selectedCompanion.store) && selectedCompanion.store.flatMap(sd => splitTags(sd.SearchTags)).filter(Boolean).length > 0) || (selectedCompanion.exclusive?.store && selectedCompanion.exclusive.store.flatMap(sd => splitTags(sd.SearchTags)).filter(Boolean).length > 0)) && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[
                        ...new Set(
                          (selectedCompanion.store || selectedCompanion.exclusive?.store || [])
                            .flatMap(sd => splitTags(sd.SearchTags))
                            .filter(Boolean)
                        )
                      ].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {selectedCompanion.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedCompanion.promo.Type}
                      </span>
                    )}
                    {selectedCompanion.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedCompanion.bp.ID.replace('BP', '').replace('-', ' ')} (Tier {selectedCompanion.bp.Tier})
                      </span>
                    )}
                    {selectedCompanion.chest && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">
                        {`${langs.content[`ChanceBoxType_${selectedCompanion.chest.ChanceBoxName}_DisplayName`] || selectedCompanion.chest.ChanceBoxName} (${selectedCompanion.chest.ExclusiveItems.split(',').includes((selectedCompanion.store || selectedCompanion.exclusive?.store || [])[0]?.StoreName || selectedCompanion.companionData.CompanionName) ? 'Exclusive' : 'Common'})`}
                      </span>
                    )}
                    {selectedCompanion.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {`${langs.content[selectedCompanion.entitlement.DisplayNameKey]?.replace('!', '') || selectedCompanion.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                    {(selectedCompanion.store || selectedCompanion.exclusive?.store || []).length > 0 && (() => {
                      const storeData = selectedCompanion.store || selectedCompanion.exclusive?.store || [];
                      const labels = [...new Set(storeData.map(sd => sd.Label).filter(Boolean))];
                      return labels.length > 0 && labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "No Longer Purchasable" : label}
                        </span>
                      ));
                    })()}
                    {(selectedCompanion.store || selectedCompanion.exclusive?.store || []).length > 0 && (() => {
                      const storeData = selectedCompanion.store || selectedCompanion.exclusive?.store || [];
                      const promos = [...new Set(storeData.map(sd => sd.TimedPromotion).filter(Boolean))];
                      return promos.length > 0 && promos.map((promo, idx) => (
                        <span key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-sm px-3 py-1 rounded-lg">
                          {formatLabel(promo)}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="order-2 lg:order-1 lg:w-1/2 flex flex-col gap-4 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-lg text-gray-900 dark:text-white">Companion Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Companion Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.CompanionName}</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Companion ID</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.CompanionID}</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Curiosity Trait</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.CuriosityTrait}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">0-10; how likely are they to investigate items or wander around on their own?</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Fearfulness Trait</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.FearfulnessTrait}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">0-10; how likely are they to hide from spawnbot flybys?</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Loyalty Trait</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.LoyaltyTrait}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">0-10; do they prefer to stay by the player? (10 means they never wander on their own or follow other companions)</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Social Trait</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.SocialTrait}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">0-10; how likely are they to try to follow another companion around?</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Physics</span>
                          <span className="text-gray-900 dark:text-white">{selectedCompanion.companionData.Physics}</span>
                        </div>
                      </div>
                    </div>
                    {getProcessedStoreData(selectedCompanion).length > 0 && genStoreData(getProcessedStoreData(selectedCompanion))}
                    {selectedCompanion.timedEvent && (
                      <div>
                        <span className="text-lg text-gray-900 dark:text-white">Timed Event Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedCompanion.timedEvent.TimedEventName}</span>
                          </div>
                          {selectedCompanion.timedEvent.TimedEventID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.timedEvent.TimedEventID}</span>
                            </div>
                          )}
                          {selectedCompanion.timedEvent.EventCenterHeaderKey && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Event Header</span>
                              <span className="text-gray-900 dark:text-white">{langs.content[selectedCompanion.timedEvent.EventCenterHeaderKey] || selectedCompanion.timedEvent.EventCenterHeaderKey}</span>
                            </div>
                          )}
                          {selectedCompanion.timedEvent.EventRewardCurrency && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Reward Currency</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.timedEvent.EventRewardCurrency}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedCompanion.entitlement && (
                      <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                        <span className="text-lg text-gray-900 dark:text-white">Entitlement Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.EntitlementName}</span>
                          </div>
                          {selectedCompanion.entitlement.EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.EntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.SteamAppID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Steam App ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.SteamAppID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.SonyEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.SonyEntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.SonyProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.SonyProductID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.NintendoConsumableID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Consumable ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.NintendoConsumableID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.NintendoEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.NintendoEntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.XB1EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.XB1EntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.XB1ProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.XB1ProductID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.XB1StoreID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Store ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.XB1StoreID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.AppleEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Apple Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.AppleEntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.AndroidEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Android Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.AndroidEntitlementID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.UbiConnectID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.UbiConnectID}</span>
                            </div>
                          )}
                          {selectedCompanion.entitlement.UbiConnectPackageID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect Package ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedCompanion.entitlement.UbiConnectPackageID}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="order-1 lg:order-2 lg:w-1/2 flex flex-col gap-4 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <div className="flex flex-col gap-2">
                    <span className="text-lg text-gray-900 dark:text-white">Animations</span>
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      {animLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                          <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                          </svg>
                        </div>
                      )}
                      <img
                        key={`${selectedCompanion.companionData?.CompanionID}-${currentAnimation.anim}-${animationType}`}
                        src={`${host}/game/animCompanion/${selectedCompanion.companionData?.CompanionID}/${currentAnimation.anim}/${animationType}`}
                        className="absolute top-0 left-0 w-full h-full rounded-lg object-contain"
                        onLoad={() => setAnimLoading(false)}
                        
                        style={{ opacity: animLoading ? 0 : 1, transition: 'opacity 0.2s' }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-base text-gray-600 dark:text-gray-300">Animation Frames</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAnimationType('all');
                            setAnimLoading(true);
                          }}
                          className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${animationType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                        >
                          All Frames
                        </button>
                        <button
                          onClick={() => {
                            setAnimationType('loop');
                            setAnimLoading(true);
                          }}
                          className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${animationType === 'loop' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                        >
                          Looped Frames
                        </button>
                      </div>
                      <span className="text-base text-gray-600 dark:text-gray-300">Animation Type</span>
                      {getAnimButtonRows().map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-2">
                          {row.map(button => (
                            <button
                              key={button.key}
                              onClick={() => {
                                setCurrentAnimation({ anim: button.anim, urlType: button.urlType });
                                setAnimLoading(true);
                              }}
                              className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${currentAnimation.anim === button.anim ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                            >
                              {button.label}
                            </button>
                          ))}
                        </div>
                      ))}

                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500 dark:text-gray-400 text-lg">Select a companion to view details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}