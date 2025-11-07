import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';

function uniq(arr) {
  return [...new Set(arr)];
}

function uniqueValues(array, path) {
  const keys = typeof path === 'string' ? [path] : path;
  const values = [];
  array.forEach(item => {
    let val = item;
    for (let i = 0; i < keys.length; i++) {
      if (Array.isArray(val)) {
        val = val.flatMap(v => (v ? v[keys[i]] : undefined));
      } else if (val && typeof val === 'object' && keys[i] in val) {
        val = val[keys[i]];
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
  return String(label).replace(/([a-z])([A-Z])/g, '$1 $2');
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
  return result.filter(Boolean);
};

function getTextColor(hexColor) {
  const hex = String(hexColor || '').replace('0x', '').padEnd(6, '0').slice(0, 6);
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 128 ? '#000000' : '#ffffff';
}

function getProcessedStoreData(theme) {
  let storeData = Array.isArray(theme.store) ? theme.store : (theme.store ? [theme.store] : []);
  const seen = new Set();
  storeData = storeData.filter(sd => {
    const id = sd.StoreID ?? `${sd.StoreName || ''}-${sd.Label || ''}-${sd.TimedPromotion || ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const processed = storeData.map(sd => {
    const costs = { mc: 0, mcSale: 0, gold: 0, goldSale: 0, glory: 0, special: {} };
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
      if (sd.SpecialCurrencyType && sd.SpecialCurrencyCost) {
        costs.special[sd.SpecialCurrencyType] = Number(sd.SpecialCurrencyCost);
      }
      if (sd.GoldCost != 0 && sd.GoldCost != '') costs.gold = Number(sd.GoldCost);
      if (sd.GoldSaleCost != 0 && sd.GoldSaleCost != '') costs.goldSale = Number(sd.GoldSaleCost);
      if (sd.RankedPointsCost != 0 && sd.RankedPointsCost != '') costs.glory = Number(sd.RankedPointsCost);
    } else {
      if (sd.IdolCost != 0 && sd.IdolCost != '') costs.mc = Number(sd.IdolCost);
      if (sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') costs.mcSale = Number(sd.IdolSaleCost);
      if (sd.GoldCost != 0 && sd.GoldCost != '') costs.gold = Number(sd.GoldCost);
      if (sd.GoldSaleCost != 0 && sd.GoldSaleCost != '') costs.goldSale = Number(sd.GoldSaleCost);
      if (sd.RankedPointsCost != 0 && sd.RankedPointsCost != '') costs.glory = Number(sd.RankedPointsCost);
      if (sd.SpecialCurrencyType && sd.SpecialCurrencyCost) {
        costs.special[sd.SpecialCurrencyType] = Number(sd.SpecialCurrencyCost);
      }
    }
    return { ...sd, Costs: costs };
  });
  processed.sort((a, b) => {
    const sum = (c) => (c.mc || 0) + (c.mcSale || 0) + (c.gold || 0) + (c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((s, v) => s + v, 0);
    return sum(a.Costs) - sum(b.Costs);
  });
  return processed;
}

function useOptionCounts(themes, filters, helpers) {
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
    const applyFilters = (t, excludeKey) => {
      for (const [key, val] of Object.entries(filters)) {
        if (key === excludeKey) continue;
        if (!val) continue;
        if (key === 'BPSeason') {
          if (val === 'AllBP') { if (!t.bp) return false; }
          else if (helpers.BPSeason(t) !== val) return false;
        } else if (key === 'StoreOnly') {
          if (!Array.isArray(t.store) || t.store.length === 0) return false;
        } else if (key === 'Entitlement') {
          if (!t.entitlement) return false;
        } else if (key === 'TimedEvent') {
          if (helpers.TimedEvent(t) !== val) return false;
        } else {
          if (helpers[key](t) !== val) return false;
        }
      }

      return true;
    };
    themes.forEach(t => {
      if (applyFilters(t, null)) {
        counts.AllBP += t.bp ? 1 : 0;
        counts.StoreOnly += (Array.isArray(t.store) && t.store.length > 0) ? 1 : 0;
        counts.DLC += t.entitlement ? 1 : 0;
      }
      ['Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'TimedEvent'].forEach(k => {
        if (applyFilters(t, k)) {
          const val = helpers[k](t);
          if (val) counts[k][val] = (counts[k][val] || 0) + 1;
        }
      });
    });
    return counts;
  }, [themes, filters, helpers]);
}

export function UIThemeStoreView({ themes, langs }) {
  const themesNorm = useMemo(() => (Array.isArray(themes) ? themes : []).map(t => ({
    ...t,
    store: Array.isArray(t.store) ? t.store : (t.store ? [t.store] : [])
  })), [themes]);

  const [selectedTheme, setSelectedTheme] = useState(null);
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('KillplateAsset');

  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const topRef = useRef(null);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);

  const helpers = useMemo(() => ({
    Cohort: t => (Array.isArray(t.store) && t.store[0]?.Cohort) ?? '',
    TimedPromotion: t => (Array.isArray(t.store) && t.store[0]?.TimedPromotion) ?? '',
    Rarity: t => (Array.isArray(t.store) && t.store[0]?.Rarity) ?? '',
    StoreID: t => (Array.isArray(t.store) && t.store[0]?.StoreID) ?? -1,
    StoreLabel: t => (Array.isArray(t.store) && t.store[0]?.Label) ?? '',
    PromoType: t => (t.promo?.Type ?? ''),
    BPSeason: t => (t.bp?.ID ?? ''),
    Entitlement: t => !!t.entitlement,
    TimedEvent: t => (t.timedEvent?.TimedEventName ?? '')
  }), []);

  const filters = useMemo(() => ({
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
  }), [filterCohort, filterPromo, filterRarity, filterStoreID, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterTimedEvent, storeOnly]);

  const cohorts = useMemo(() => uniqueValues(themesNorm, ['store', 'Cohort']), [themesNorm]);
  const promotions = useMemo(() => uniqueValues(themesNorm, ['store', 'TimedPromotion']), [themesNorm]);
  const rarities = useMemo(() => uniqueValues(themesNorm, ['store', 'Rarity']), [themesNorm]);
  const storeLabels = useMemo(() => uniqueValues(themesNorm, ['store', 'Label']), [themesNorm]);
  const promoTypes = useMemo(() => uniqueValues(themesNorm, ['promo', 'Type']), [themesNorm]);
  const timedEvents = useMemo(() => uniqueValues(themesNorm, ['timedEvent', 'TimedEventName']), [themesNorm]);
  const bpSeasons = useMemo(() => {
    return uniq(themesNorm.filter(t => t.bp && t.bp.ID).map(t => t.bp.ID)).sort((a, b) => {
      const n = x => parseInt(String(x).replace('BP', '').split('-')[0], 10);
      return n(a) === n(b) ? String(a).localeCompare(String(b)) : n(a) - n(b);
    });
  }, [themesNorm]);

  const optionCounts = useOptionCounts(
    themesNorm,
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

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 250); return () => clearTimeout(t); }, [searchQuery]);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; }
    else if (isMobile) { setSelectedTheme(null); filtersChanged.current = true; }
  }, [filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterTimedEvent, debouncedSearch, sortType, isMobile]);

  const getDisplayNameKey = t => (Array.isArray(t.store) && t.store[0]?.DisplayNameKey) ?? t.themeData?.DisplayNameKey ?? '';
  const getDescriptionKey = t => (Array.isArray(t.store) && t.store[0]?.DescriptionKey) ?? t.themeData?.DescriptionKey ?? '';

  const filteredThemes = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const arr = themesNorm.filter(t => {
      if (filterCohort && helpers.Cohort(t) !== filterCohort) return false;
      if (filterRarity && helpers.Rarity(t) !== filterRarity) return false;
      if (filterStoreID && String(helpers.StoreID(t)) !== String(filterStoreID)) return false;
      if (filterStoreLabel && helpers.StoreLabel(t) !== filterStoreLabel) return false;
      if (filterPromoType && helpers.PromoType(t) !== filterPromoType) return false;
      if (filterPromo !== '' && helpers.TimedPromotion(t) !== filterPromo) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP') { if (!t.bp) return false; }
        else if (helpers.BPSeason(t) !== filterBPSeason) return false;
      }
      if (filterEntitlement && !t.entitlement) return false;
      if (filterTimedEvent && helpers.TimedEvent(t) !== filterTimedEvent) return false;
      if (storeOnly && (!Array.isArray(t.store) || t.store.length === 0)) return false;
      const fields = [
        langs.content?.[getDisplayNameKey(t)] || '',
        langs.content?.[getDescriptionKey(t)] || '',
        t.themeData?.PlayerThemeName || '',
        t.themeData?.PlayerThemeID || '',
        Array.isArray(t.store) ? t.store.map(sd => sd.StoreName).join(' ') : '',
        Array.isArray(t.store) ? t.store.map(sd => sd.Item).join(' ') : '',
        Array.isArray(t.store) ? t.store.map(sd => sd.Label).join(' ') : '',
        Array.isArray(t.store) ? t.store.map(sd => sd.TimedPromotion).join(' ') : '',
        Array.isArray(t.store) ? t.store.map(sd => sd.SearchTags).join(' ') : '',
        t.promo?.StoreName || '',
        t.promo?.Item || '',
        t.promo?.Label || '',
        t.bp?.Item || '',
        t.bp?.ID || '',
        t.bp?.DescriptionKey || '',
        t.entitlement?.EntitlementName || '',
        t.entitlement?.DisplayNameKey || '',
        t.timedEvent?.TimedEventName || '',
        Array.isArray(t.store) ? t.store.map(sd => String(sd.StoreID || '')).join(' ') : '',
        Array.isArray(t.store) ? t.store.map(sd => String(sd.IdolCost || '')).join(' ') : '',
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(q));
    }).sort((a, b) => {
      const idx = (t) => (typeof t.ArrayIndex === 'number' ? t.ArrayIndex : (parseInt(t.ArrayIndex, 10) || 0));
      const idxA = idx(a);
      const idxB = idx(b);
      const nameA = (langs.content?.[getDisplayNameKey(a)] || a.themeData?.PlayerThemeName || '').toString();
      const nameB = (langs.content?.[getDisplayNameKey(b)] || b.themeData?.PlayerThemeName || '').toString();
      const idA = parseInt(a.themeData?.PlayerThemeID || 0, 10) || 0;
      const idB = parseInt(b.themeData?.PlayerThemeID || 0, 10) || 0;
      const minStoreId = t => {
        if (!Array.isArray(t.store) || t.store.length === 0) return 0;
        return Math.min(...t.store.map(sd => parseInt(sd.StoreID || 0, 10) || 0));
      };
      const costVal = t => {
        const s = getProcessedStoreData(t);
        if (s.length === 0) return Number.MAX_SAFE_INTEGER;
        const c = s[0].Costs;
        return (c.mc || 0) + (c.mcSale || 0) + (c.gold || 0) + (c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((s, v) => s + v, 0);
      };
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'ThemeIDAsc': return idA - idB;
        case 'ThemeIDDesc': return idB - idA;
        case 'StoreIDAsc': return minStoreId(a) - minStoreId(b);
        case 'StoreIDDesc': return minStoreId(b) - minStoreId(a);
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costVal(a) - costVal(b);
        case 'CostDesc': return costVal(b) - costVal(a);
        default: return 0;
      }
    });
    return arr;
  }, [themesNorm, debouncedSearch, sortType, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterTimedEvent, langs, helpers]);

  useEffect(() => {
    if (themesNorm.length === 0 || filteredThemes.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const themeId = params.get('theme') ? String(params.get('theme')) : null;
    let t = null;
    if (themeId) t = filteredThemes.find(x => String(x.themeData?.PlayerThemeID) === themeId);
    if (!t && !isMobile) t = filteredThemes[0];
    setSelectedTheme(t || null);
  }, [themesNorm, filteredThemes, isMobile]);

  useEffect(() => {
    if (isMobile && selectedTheme && !filteredThemes.some(t => t.themeData?.PlayerThemeID === selectedTheme.themeData?.PlayerThemeID)) {
      setSelectedTheme(null);
    }
  }, [filteredThemes, isMobile, selectedTheme]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedTheme) currentParams.set('theme', String(selectedTheme.themeData?.PlayerThemeID));
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const themeId = params.get('theme') ? String(params.get('theme')) : null;
      if (themeId && filteredThemes.length > 0) {
        const t = filteredThemes.find(x => String(x.themeData?.PlayerThemeID) === themeId);
        if (t) setSelectedTheme(t);
        else if (!isMobile) setSelectedTheme(filteredThemes[0] || null);
        else setSelectedTheme(null);
      } else if (!isMobile) setSelectedTheme(filteredThemes[0] || null);
      else setSelectedTheme(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTheme, filteredThemes, isMobile]);

  const handleFilterChange = useCallback((setter, value) => { setter(value); }, []);

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
    if (isMobile) { setSelectedTheme(null); filtersChanged.current = true; }
    else { setSelectedTheme(filteredThemes[0] || null); }
  }, [filteredThemes, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedTheme) return;
    const url = `${window.location.origin}${window.location.pathname}?theme=${selectedTheme.themeData?.PlayerThemeID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedTheme]);

  const Row = ({ index, data }) => {
    const theme = data[index];
    const [imgLoading, setImgLoading] = useState(true);
    const storeData = getProcessedStoreData(theme);
    const hasStore = Array.isArray(theme.store) && theme.store.length > 0;
    const skirmish = theme.skirmish;
    let backgroundStyle = {};
    if (skirmish) {
      const factions = skirmish.factionsData || [];
      const color1 = (factions[0]?.FactionColor || '0x000000').replace('0x', '#');
      const color2 = (factions[1]?.FactionColor || '0x000000').replace('0x', '#');
      backgroundStyle = { background: `linear-gradient(45deg, ${color1} 50%, ${color2} 50%)`, color: getTextColor(factions[0]?.FactionColor || '0x000000') };
    }
    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[260px]' : 'p-0 px-2 h-[160px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedTheme?.themeData?.PlayerThemeID === theme.themeData?.PlayerThemeID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => { setSelectedTheme(theme); filtersChanged.current = false; }}
        >
          <div className="flex rounded-lg items-center justify-center relative">
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                </svg>
              </div>
            )}
            <img
              src={`${host}/game/animUi/${theme.themeData?.PlayerThemeID}/StoreAllItems`}
              className="h-32 max-w-48 object-contain"
              onLoad={() => setImgLoading(false)}
              onError={e => e.currentTarget.style.display = 'none'}
              alt=""
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!hasStore && !theme.bp && !theme.promo && !theme.entitlement && !theme.timedEvent && !skirmish && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">Not Obtainable</div>
                  )}

                  {theme.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Promo Code${!hasStore && !theme.bp && !theme.entitlement && !theme.timedEvent ? ' Only' : ''}`}</div>
                  )}
                  {theme.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{(langs.content?.[theme.entitlement.DisplayNameKey]?.replace('!', '') || theme.entitlement.EntitlementName) + ' DLC'}</div>
                  )}
                  {theme.timedEvent && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`${theme.timedEvent.TimedEventName} Event`}</div>
                  )}
                  {hasStore && [...new Set(theme.store.map(s => s.Label).filter(Boolean))].map((label, idx) => (
                    <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>{label === "LastChance" ? "No Longer Purchasable" : label}</div>
                  ))}
                  {hasStore && [...new Set(theme.store.map(s => s.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                    <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{formatLabel(promo)}</div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {skirmish && (
                  <div className="text-xs font-bold px-2 py-0.5 rounded-lg" style={backgroundStyle}>
                    {(langs.content?.[skirmish.factionsData?.find(r => r.FactionName === skirmish.reward.ForFaction)?.DisplayNameKey] || skirmish.reward.ForFaction) + (skirmish.reward.ForWinningFaction ? ' Faction Win' : ' Faction')}
                  </div>
                )}
                {theme.bp && (
                  <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(theme.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
                )}
              </div>

              <div className="mt-1 flex justify-start text-gray-900 dark:text-white font-bold text-lg">
                <span>{langs.content?.[getDisplayNameKey(theme)] || theme.themeData?.PlayerThemeName}</span>
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
                              onError={e => (e.currentTarget.src = `${host}/game/getGfx/storeIcon/mc`)}
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

  const countText = `Showing ${filteredThemes.length} Theme${filteredThemes.length !== 1 ? 's' : ''}`;

  const getAssetIconUrl = (t) => {
    const assetName = t?.themeData?.[selectedAsset];
    if (!assetName) return '';
    return `${host}/game/getGfx/UI_Icons/${assetName}`;
  };

  return (
    <div className="h-full flex flex-col lg:flex-row" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-center">
            <div className="bg-gray-200 dark:bg-slate-800 p-2 rounded-lg flex flex-wrap gap-2 items-center">
              {Object.values(optionCounts.Cohort).some(c => c > 0) && (
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
              {Object.values(optionCounts.TimedPromotion).some(c => c > 0) && (
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
              {Object.values(optionCounts.Rarity).some(c => c > 0) && (
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
              {Object.values(optionCounts.StoreLabel).some(c => c > 0) && (
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
              {Object.values(optionCounts.PromoType).some(c => c > 0) && (
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
              {Object.values(optionCounts.TimedEvent).some(c => c > 0) && (
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
              {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(c => c > 0)) && (
                <select
                  value={filterBPSeason}
                  onChange={e => handleFilterChange(setFilterBPSeason, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Themes ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>{String(season).replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                Store Themes Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                DLC Themes ({optionCounts.DLC || 0})
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
                placeholder="Search Themes"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="flex justify-between items-center w-full sm:w-auto py-2 gap-4">
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">{countText}</div>
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
              <option value="ThemeIDDesc">Theme ID (Desc)</option>
              <option value="ThemeIDAsc">Theme ID (Asc)</option>
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

        <div className="h-[100vh]">
          {viewMode === 'list' ? (
            <Virtuoso
              data={filteredThemes}
              totalCount={filteredThemes.length}
              itemContent={(index) => <Row index={index} data={filteredThemes} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredThemes}
              totalCount={filteredThemes.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="ui-grid-item"
              itemContent={(index) => <Row index={index} data={filteredThemes} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>

      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedTheme ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button className="lg:hidden text-gray-900 dark:text-white" onClick={() => setSelectedTheme(null)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedTheme && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="bg-blue-500 dark:bg-blue-600 text-white font-bold px-3 py-1 rounded-lg">Copy Link</button>
                {copyFeedback && <span className="text-sm text-gray-900 dark:text-white">{copyFeedback}</span>}
              </div>
            )}
          </div>

          {selectedTheme ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {langs.content?.[getDisplayNameKey(selectedTheme)] || selectedTheme.themeData?.PlayerThemeName}
                    </span>
                  </div>
                </div>
                {langs.content?.[getDescriptionKey(selectedTheme)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedTheme)]}
                  </div>
                )}
                {Array.isArray(selectedTheme.store) && selectedTheme.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedTheme.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {selectedTheme.promo && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">Promo Type: {selectedTheme.promo.Type}</span>
                  )}
                  {selectedTheme.bp && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                      Battle Pass Season {String(selectedTheme.bp.ID).replace('BP', '').replace('-', ' ')}{selectedTheme.bp.Tier ? ` (Tier ${selectedTheme.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedTheme.entitlement && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                      {(langs.content?.[selectedTheme.entitlement.DisplayNameKey]?.replace('!', '') || selectedTheme.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedTheme.timedEvent && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">
                      {`${selectedTheme.timedEvent.TimedEventName} Event`}
                    </span>
                  )}
                  {selectedTheme.skirmish && (
                    <span
                      className="text-sm px-3 py-1 rounded-lg"
                      style={{
                        background: (() => {
                          const f = selectedTheme.skirmish.factionsData || [];
                          const c1 = (f[0]?.FactionColor || '0x000000').replace('0x', '#');
                          const c2 = (f[1]?.FactionColor || '0x000000').replace('0x', '#');
                          return `linear-gradient(45deg, ${c1} 50%, ${c2} 50%)`;
                        })(),
                        color: getTextColor(selectedTheme.skirmish.factionsData?.[0]?.FactionColor || '0x000000')
                      }}
                    >
                      {(langs.content?.[selectedTheme.skirmish.factionsData?.find(r => r.FactionName === selectedTheme.skirmish.reward.ForFaction)?.DisplayNameKey] || selectedTheme.skirmish.reward.ForFaction) + (selectedTheme.skirmish.reward.ForWinningFaction ? ' Faction Win' : ' Faction')}
                    </span>
                  )}
                  {Array.isArray(selectedTheme.store) && [...new Set(selectedTheme.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'No Longer Purchasable' : label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-2">
                <div className="order-2 lg:order-1 lg:w-1/2 flex flex-col gap-2">
                  <div className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Theme Data</span>
                    <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Theme Name</span>
                        <span className="text-gray-900 dark:text-white">{selectedTheme.themeData?.PlayerThemeName}</span>
                      </div>
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Theme ID</span>
                        <span className="text-gray-900 dark:text-white">{selectedTheme.themeData?.PlayerThemeID}</span>
                      </div>
                      {selectedTheme.themeData?.KillplateAsset && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Killplate Asset</span>
                          <span className="text-gray-900 dark:text-white">{selectedTheme.themeData.KillplateAsset}</span>
                        </div>
                      )}
                      {selectedTheme.themeData?.NameplateAsset && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Nameplate Asset</span>
                          <span className="text-gray-900 dark:text-white">{selectedTheme.themeData.NameplateAsset}</span>
                        </div>
                      )}
                      {selectedTheme.themeData?.ScoreplateAsset && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Scoreplate Asset</span>
                          <span className="text-gray-900 dark:text-white">{selectedTheme.themeData.ScoreplateAsset}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {Array.isArray(selectedTheme.store) && getProcessedStoreData(selectedTheme).map((sd, idx) => (
                    <div key={`store-${idx}`} className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                      <span className="text-lg text-gray-900 dark:text-white">Store Data {sd.Type === 'Bundle' ? '(Bundle)' : '(Theme)'}</span>
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
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Bundle Cost</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
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
                              {Object.entries(sd.Costs.special).map(([type, cost], i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/${type}`} className="h-5 inline" onError={e => (e.currentTarget.src = `${host}/game/getGfx/storeIcon/mc`)} />
                                  <span className="text-gray-900 dark:text-white">{cost}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" />
                                  {sd.Costs.mcSale > 0 ? (
                                    <>
                                      <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc}</span>
                                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
                                    </>
                                  ) : (
                                    <span className="text-gray-900 dark:text-white">{sd.Costs.mc}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {sd.Costs.gold > 0 && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                                  <span className="text-gray-900 dark:text-white">{sd.Costs.gold}</span>
                                </div>
                              </div>
                            )}
                            {sd.Costs.glory > 0 && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" />
                                  <span className="text-gray-900 dark:text-white">{sd.Costs.glory}</span>
                                </div>
                              </div>
                            )}
                            {Object.keys(sd.Costs.special).length > 0 && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Special Currency</span>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(sd.Costs.special).map(([type, cost], i) => (
                                    <span key={i} className="text-gray-900 dark:text-white">{type}: {cost}</span>
                                  ))}
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
                        {sd.Rarity && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Rarity</span>
                            <span className="text-gray-900 dark:text-white">{sd.Rarity}</span>
                          </div>
                        )}
                        {sd.Label && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Label</span>
                            <span className="text-gray-900 dark:text-white">{sd.Label === 'LastChance' ? 'No Longer Purchasable' : sd.Label}</span>
                          </div>
                        )}
                        {sd.TimedPromotion && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Promotion</span>
                            <span className="text-gray-900 dark:text-white">{formatLabel(sd.TimedPromotion)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedTheme.timedEvent && (
                    <div className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                      <span className="text-lg text-gray-900 dark:text-white">Timed Event Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedTheme.timedEvent.TimedEventName}</span>
                        </div>
                        {selectedTheme.timedEvent.TimedEventID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedTheme.timedEvent.TimedEventID}</span>
                          </div>
                        )}
                        {selectedTheme.timedEvent.EventCenterHeaderKey && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Event Header</span>
                            <span className="text-gray-900 dark:text-white">{langs.content?.[selectedTheme.timedEvent.EventCenterHeaderKey] || selectedTheme.timedEvent.EventCenterHeaderKey}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="order-1 lg:order-2 lg:w-1/2 flex flex-col gap-2">
                  <div className="dark:bg-slate-800 bg-gray-100 flex flex-col gap-2 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Image Data</span>
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ['KillplateAsset', 'Killplate (in-game)'],
                          ['NameplateAsset', 'Nameplate (loading)'],
                          ['ScoreplateAsset', 'Scoreplate (end-screen)']
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedAsset(key)}
                            className={`py-1 px-3 rounded-lg w-full text-sm font-bold transition-all duration-100 ${selectedAsset === key ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-100 dark:bg-slate-900 rounded-lg flex justify-center">
                      <img
                        src={getAssetIconUrl(selectedTheme)}
                        className="h-96 object-contain"
                        alt=""
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400 italic">Select a theme to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
