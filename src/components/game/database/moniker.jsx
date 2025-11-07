// titles.jsx
import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';

function uniq(a) { return [...new Set(a)]; }
function uniqueValues(array, path) {
  const keys = Array.isArray(path) ? path : [path];
  const out = [];
  array.forEach(item => {
    let val = item;
    for (let i = 0; i < keys.length; i++) {
      if (Array.isArray(val)) val = val.flatMap(v => (v ? v[keys[i]] : undefined));
      else if (val && typeof val === 'object' && keys[i] in val) val = val[keys[i]];
      else { val = undefined; break; }
    }
    if (Array.isArray(val)) out.push(...val.filter(Boolean));
    else if (val !== undefined && val !== null && val !== '') out.push(val);
  });
  return [...new Set(out)];
}
function formatLabel(s) { return s ? String(s).replace(/([a-z])([A-Z])/g, '$1 $2') : ''; }
const splitTags = (tags) => {
  if (!tags) return [];
  const r = []; let b = ''; let q = false;
  for (let c of tags) { if (c === "'") q = !q; if (c === ',' && !q) { r.push(b.trim().replace(/^'+|'+$/g, '')); b = ''; } else b += c; }
  if (b.length) r.push(b.trim().replace(/^'+|'+$/g, ''));
  return r.filter(Boolean);
};

function normalizeStore(entity) {
  return Array.isArray(entity.store) ? entity.store : (entity.store ? [entity.store] : []);
}

function getProcessedStoreData(entity) {
  let store = normalizeStore(entity);
  const dedup = new Map();
  store.forEach(sd => {
    const id = sd.StoreID ?? `${sd.StoreName || ''}-${sd.Label || ''}-${sd.TimedPromotion || ''}-${sd.Type || ''}`;
    if (!dedup.has(id)) dedup.set(id, sd);
  });
  const processed = [...dedup.values()].map(sd => {
    const c = { mc: 0, mcSale: 0, gold: 0, goldSale: 0, glory: 0, special: {} };
    if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
      if ((sd.IdolCost && sd.IdolCost !== '0') || (sd.IdolSaleCost && sd.IdolSaleCost !== '0')) {
        if (sd.IdolCost && sd.IdolCost !== '0') c.mc = Number(sd.IdolCost);
        if (sd.IdolSaleCost && sd.IdolSaleCost !== '0') c.mcSale = Number(sd.IdolSaleCost);
      } else {
        sd.ItemList.forEach(it => {
          if (it.IdolCost && it.IdolCost !== '0') c.mc += Number(it.IdolCost);
          if (it.IdolSaleCost && it.IdolSaleCost !== '0') c.mc += Number(it.IdolSaleCost);
          if (it.GoldCost && it.GoldCost !== '0') c.gold += Number(it.GoldCost);
          if (it.GoldSaleCost && it.GoldSaleCost !== '0') c.gold += Number(it.GoldSaleCost);
          if (it.RankedPointsCost && it.RankedPointsCost !== '0') c.glory += Number(it.RankedPointsCost);
          if (it.SpecialCurrencyCost && it.SpecialCurrencyCost !== '0' && it.SpecialCurrencyType) {
            c.special[it.SpecialCurrencyType] = (c.special[it.SpecialCurrencyType] || 0) + Number(it.SpecialCurrencyCost);
          }
        });
        if (sd.IdolBundleDiscount) c.mc = Math.floor(c.mc * (sd.IdolBundleDiscount || 1));
        if (sd.GoldBundleDiscount) c.gold = Math.floor(c.gold * (sd.GoldBundleDiscount || 1));
        if (sd.RankedPointsBundleDiscount) c.glory = Math.floor(c.glory * (sd.RankedPointsBundleDiscount || 1));
        if (sd.SpecialCurrencyBundleDiscount) Object.keys(c.special).forEach(k => c.special[k] = Math.floor(c.special[k] * (sd.SpecialCurrencyBundleDiscount || 1)));
      }
    } else {
      if (sd.IdolCost && sd.IdolCost !== '0') c.mc = Number(sd.IdolCost);
      if (sd.IdolSaleCost && sd.IdolSaleCost !== '0') c.mcSale = Number(sd.IdolSaleCost);
      if (sd.GoldCost && sd.GoldCost !== '0') c.gold = Number(sd.GoldCost);
      if (sd.GoldSaleCost && sd.GoldSaleCost !== '0') c.goldSale = Number(sd.GoldSaleCost);
      if (sd.RankedPointsCost && sd.RankedPointsCost !== '0') c.glory = Number(sd.RankedPointsCost);
      if (sd.SpecialCurrencyCost && sd.SpecialCurrencyCost !== '0' && sd.SpecialCurrencyType) c.special[sd.SpecialCurrencyType] = Number(sd.SpecialCurrencyCost);
    }
    return { ...sd, Costs: c };
  });
  processed.sort((a, b) => {
    const sum = (c) => (c.mc || 0) + (c.mcSale || 0) + (c.gold || 0) + (c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((s, v) => s + v, 0);
    return sum(a.Costs) - sum(b.Costs);
  });
  return processed;
}

function minCost(entity) {
  const s = getProcessedStoreData(entity);
  if (!s.length) return Number.MAX_SAFE_INTEGER;
  const c = s[0].Costs;
  return (c.mc || 0) + (c.mcSale || 0) + (c.gold || 0) + (c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((x, y) => x + y, 0);
}

function useOptionCounts(items, filters, helpers) {
  return useMemo(() => {
    const counts = {
      Cohort: {},
      TimedPromotion: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      BPSeason: {},
      Entitlement: {},
      Color: {},
      StoreOnly: 0,
      AllBP: 0,
      Bundle: 0,
      DLC: 0
    };
    const applyFilters = (e, excludeKey) => {
      for (const [key, val] of Object.entries(filters)) {
        if (key === excludeKey) continue;
        if (val === '' || val === false || (Array.isArray(val) && val.length === 0)) continue;
        if (key === 'BPSeason') {
          if (val === 'AllBP') { if (!e.bp) return false; }
          else if (helpers.BPSeason(e) !== val) return false;
        } else if (key === 'StoreOnly') {
          if (!normalizeStore(e).length) return false;
        } else if (key === 'Entitlement') {
          if (!e.entitlement) return false;
        } else if (key === 'Bundle') {
          if (!helpers.Bundle(e)) return false;
        } else if (key === 'Color') {
          if (helpers.Color(e) !== val) return false;
        } else if (Array.isArray(val)) {
          const hv = helpers[key](e);
          const arr = Array.isArray(hv) ? hv : [hv];
          if (!arr.some(v => val.includes(v))) return false;
        } else {
          const hv = helpers[key](e);
          const arr = Array.isArray(hv) ? hv : [hv];
          if (!arr.includes(val)) return false;
        }
      }
      return true;
    };
    items.forEach(e => {
      if (applyFilters(e, null)) {
        counts.StoreOnly += normalizeStore(e).length ? 1 : 0;
        counts.AllBP += e.bp ? 1 : 0;
        counts.DLC += e.entitlement ? 1 : 0;
        counts.Bundle += helpers.Bundle(e) ? 1 : 0;
      }
      ['Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'Color'].forEach(k => {
        if (applyFilters(e, k)) {
          const hv = helpers[k](e);
          const values = Array.isArray(hv) ? hv.filter(Boolean) : (hv ? [hv] : []);
          values.forEach(v => { counts[k][v] = (counts[k][v] || 0) + 1; });
        }
      });
    });
    return counts;
  }, [items, filters, helpers]);
}

export function TitlesStoreView({ titles, langs }) {
  const data = useMemo(() => (Array.isArray(titles) ? titles : []).map(e => ({ ...e, store: normalizeStore(e) })), [titles]);

  const [selectedTitle, setSelectedTitle] = useState(null);
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterBundle, setFilterBundle] = useState(false);
  const [filterColor, setFilterColor] = useState('');
  const [openColor, setOpenColor] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);
  const [listHeight, setListHeight] = useState(400);
  const [filterHeight, setFilterHeight] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (filterSectionRef.current) setFilterHeight(filterSectionRef.current.offsetHeight);
  }, [
    filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType,
    filterBPSeason, filterEntitlement, filterBundle, filterColor, debouncedSearch, sortType, isMobile
  ]);

  useEffect(() => {
    if (isInitialMount.current) isInitialMount.current = false;
    else if (isMobile) { setSelectedTitle(null); filtersChanged.current = true; }
  }, [
    filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType,
    filterBPSeason, filterEntitlement, filterBundle, filterColor, debouncedSearch, sortType, isMobile
  ]);

  useEffect(() => {
    const updateHeight = () => {
      const viewportHeight = window.innerHeight;
      const detailHeight = detailPanelRef.current ? detailPanelRef.current.offsetHeight : 0;
      const available = Math.max(viewportHeight, detailHeight) - filterHeight;
      setListHeight(available > 240 ? available : 240);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [selectedTitle, filterHeight]);

  const helpers = useMemo(() => ({
    Cohort: e => uniq(normalizeStore(e).map(s => s.Cohort).filter(Boolean)),
    TimedPromotion: e => uniq(normalizeStore(e).map(s => s.TimedPromotion).filter(Boolean)),
    StoreID: e => uniq(normalizeStore(e).map(s => s.StoreID).filter(v => v !== undefined && v !== null && v !== '')),
    StoreLabel: e => uniq(normalizeStore(e).map(s => s.Label).filter(Boolean)),
    PromoType: e => e.promo?.Type ?? '',
    BPSeason: e => e.bp?.ID ?? '',
    Entitlement: e => !!e.entitlement,
    Bundle: e => normalizeStore(e).some(s => s.Type === 'Bundle'),
    Color: e => (e.monikerData?.Color ? String(e.monikerData.Color).replace('0x', '#') : '')
  }), []);

  // Always use monikerData keys. No store fallbacks.
  const getDisplayNameKey = e => e.monikerData?.DisplayNameKey ?? '';
  const getDescriptionKey = e => e.monikerData?.DescriptionKey ?? '';

  const cohorts = useMemo(() => uniqueValues(data, ['store', 'Cohort']), [data]);
  const promotions = useMemo(() => uniqueValues(data, ['store', 'TimedPromotion']), [data]);
  const storeLabels = useMemo(() => uniqueValues(data, ['store', 'Label']), [data]);
  const promoTypes = useMemo(() => uniqueValues(data, ['promo', 'Type']), [data]);
  const colorsAll = useMemo(() => uniq(data.map(helpers.Color).filter(Boolean)), [data, helpers]);

  const bpSeasons = useMemo(() => {
    return uniq(data.filter(e => e.bp && e.bp.ID).map(e => e.bp.ID)).sort((a, b) => {
      const n = x => parseInt(String(x).replace('BP', '').split('-')[0], 10);
      return n(a) === n(b) ? String(a).localeCompare(String(b)) : n(a) - n(b);
    });
  }, [data]);

  const optionCounts = useOptionCounts(
    data,
    {
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      StoreOnly: storeOnly,
      Bundle: filterBundle,
      Color: filterColor
    },
    helpers
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const arr = data.filter(e => {
      if (filterCohort && !normalizeStore(e).some(s => s.Cohort === filterCohort)) return false;
      if (filterPromo && !normalizeStore(e).some(s => s.TimedPromotion === filterPromo)) return false;
      if (filterStoreID && !normalizeStore(e).some(s => String(s.StoreID) === String(filterStoreID))) return false;
      if (filterStoreLabel && !normalizeStore(e).some(s => s.Label === filterStoreLabel)) return false;
      if (filterPromoType && (e.promo?.Type !== filterPromoType)) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP') { if (!e.bp) return false; }
        else if ((e.bp?.ID ?? '') !== filterBPSeason) return false;
      }
      if (filterEntitlement && !e.entitlement) return false;
      if (storeOnly && !normalizeStore(e).length) return false;
      if (filterBundle && !normalizeStore(e).some(s => s.Type === 'Bundle')) return false;
      if (filterColor && helpers.Color(e) !== filterColor) return false;

      const fields = [
        langs.content?.[getDisplayNameKey(e)] || '',
        langs.content?.[getDescriptionKey(e)] || '',
        e.monikerData?.MonikerName || '',
        String(e.monikerData?.MonikerID || ''),
        normalizeStore(e).map(sd => sd.StoreName).join(' '),
        normalizeStore(e).map(sd => sd.Item).join(' '),
        normalizeStore(e).map(sd => sd.Label).join(' '),
        normalizeStore(e).map(sd => sd.TimedPromotion).join(' '),
        normalizeStore(e).map(sd => sd.SearchTags).join(' '),
        e.promo?.StoreName || '',
        e.promo?.Item || '',
        e.promo?.Label || '',
        e.bp?.Item || '',
        e.bp?.ID || '',
        e.bp?.DescriptionKey || '',
        e.entitlement?.EntitlementName || '',
        e.entitlement?.DisplayNameKey || '',
        normalizeStore(e).map(sd => String(sd.StoreID || '')).join(' '),
        normalizeStore(e).map(sd => String(sd.IdolCost || '')).join(' ')
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(q));
    }).sort((a, b) => {
      const idx = (e) => (typeof e.ArrayIndex === 'number' ? e.ArrayIndex : (parseInt(e.ArrayIndex, 10) || 0));
      const idxA = idx(a), idxB = idx(b);
      const nameA = (langs.content?.[getDisplayNameKey(a)] || a.monikerData?.MonikerName || '').toString();
      const nameB = (langs.content?.[getDisplayNameKey(b)] || b.monikerData?.MonikerName || '').toString();
      const idA = parseInt(a.monikerData?.MonikerID || 0, 10) || 0;
      const idB = parseInt(b.monikerData?.MonikerID || 0, 10) || 0;
      const minStoreId = e => {
        const s = normalizeStore(e);
        if (!s.length) return 0;
        return Math.min(...s.map(sd => parseInt(sd.StoreID || 0, 10) || 0));
      };
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'TitleIDAsc': return idA - idB;
        case 'TitleIDDesc': return idB - idA;
        case 'StoreIDAsc': return minStoreId(a) - minStoreId(b);
        case 'StoreIDDesc': return minStoreId(b) - minStoreId(a);
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return minCost(a) - minCost(b);
        case 'CostDesc': return minCost(b) - minCost(a);
        default: return 0;
      }
    });
    return arr;
  }, [
    data, debouncedSearch, sortType, filterCohort, filterPromo, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterBundle, filterColor, langs, helpers
  ]);

  useEffect(() => {
    if (data.length === 0 || filtered.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('title') ? String(params.get('title')) : null;
    let item = null;
    if (idParam) item = filtered.find(e => String(e.monikerData?.MonikerID) === idParam);
    if (!item && !isMobile) item = filtered[0];
    setSelectedTitle(item || null);
  }, [data, filtered, isMobile]);

  useEffect(() => {
    if (isMobile && selectedTitle && !filtered.some(e => e.monikerData?.MonikerID === selectedTitle.monikerData?.MonikerID)) {
      setSelectedTitle(null);
    }
  }, [filtered, isMobile, selectedTitle]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedTitle) currentParams.set('title', String(selectedTitle.monikerData?.MonikerID));
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('title') ? String(params.get('title')) : null;
      if (idParam && filtered.length > 0) {
        const item = filtered.find(e => String(e.monikerData?.MonikerID) === idParam);
        if (item) setSelectedTitle(item);
        else if (!isMobile) setSelectedTitle(filtered[0] || null);
        else setSelectedTitle(null);
      } else if (!isMobile) setSelectedTitle(filtered[0] || null);
      else setSelectedTitle(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedTitle, filtered, isMobile]);

  const handleFilterChange = useCallback((setter, value) => { setter(value); }, []);
  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterCohort('');
    setFilterPromo('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    setFilterBundle(false);
    setFilterColor('');
    if (isMobile) { setSelectedTitle(null); filtersChanged.current = true; }
    else { setSelectedTitle(filtered[0] || null); }
  }, [filtered, isMobile]);

  const handleImgError = e => { e.currentTarget.style.display = 'none'; };

  const Row = ({ index, data }) => {
    const item = data[index];
    const storeData = getProcessedStoreData(item);
    const isSelected = selectedTitle?.monikerData?.MonikerID === item.monikerData?.MonikerID;
    const color = (item.monikerData?.Color || '').replace('0x', '#');

    return (
      <div
        className="p-1"
        onClick={() => { setSelectedTitle(item); filtersChanged.current = false; }}
      >
        <div className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} flex min-w-[280px] max-w-full`}>
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col gap-1">
              <div className="mt-1 flex justify-start font-bold text-lg">
                <span className="truncate" style={{ color }}>{langs.content?.[getDisplayNameKey(item)] || item.monikerData?.MonikerName}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.bp && (
                  <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Battle Pass ${String(item.bp.ID).replace('BP', 'Season ').replace('-', ' ')}`}</div>
                )}
                {item.promo && (
                  <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Promo Code${!item.store?.length && !item.bp && !item.entitlement ? ' Only' : ''}`}</div>
                )}
                {item.entitlement && (
                  <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{(langs.content?.[item.entitlement.DisplayNameKey]?.replace('!', '') || item.entitlement.EntitlementName) + ' DLC'}</div>
                )}
                {item.monikerData?.ImplicitOwnership?.toLocaleLowerCase() == 'true' && (
                  <div className="bg-sky-400 dark:bg-sky-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">Implicit Ownership</div>
                )}
                {item.monikerData?.GrantedManually?.toLocaleLowerCase() == 'true' && (
                  <div className="bg-orange-400 dark:bg-orange-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">Granted Manually</div>
                )}
                {item.store?.length > 0 && uniq(item.store.map(s => s.Label).filter(Boolean)).map((label, idx) => (
                  <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>{label === "LastChance" ? "No Longer Purchasable" : label}</div>
                ))}
                {item.store?.length > 0 && uniq(item.store.map(s => s.TimedPromotion ?? '').filter(Boolean)).map((promo, idx) => (
                  <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{formatLabel(promo)}</div>
                ))}
              </div>
            </div>
            <div className="text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white mt-1">
              {storeData.map((sd, idx) => (
                <div key={`costs-${idx}`} className="flex flex-wrap gap-2">
                  {sd.Type === 'Bundle' ? (
                    <>
                      {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                          {sd.Costs.mcSale > 0 ? (
                            <>
                              <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc}</span>
                              <span className="text-green-600 dark:text-green-400 font-bold ml-1">{sd.Costs.mcSale}</span>
                            </>
                          ) : (
                            <span>{sd.Costs.mc}</span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                        </div>
                      )}
                      {sd.Costs.gold > 0 && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{sd.Costs.gold}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                        </div>
                      )}
                      {sd.Costs.glory > 0 && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{sd.Costs.glory}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                        </div>
                      )}
                      {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                        <div key={`special-${sIdx}`}>
                          <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{cost}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {sd.Costs.mc > 0 && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{sd.Costs.mc}</span>
                        </div>
                      )}
                      {sd.Costs.gold > 0 && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{sd.Costs.gold}</span>
                        </div>
                      )}
                      {sd.Costs.glory > 0 && (
                        <div>
                          <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{sd.Costs.glory}</span>
                        </div>
                      )}
                      {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                        <div key={`special-${sIdx}`}>
                          <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                          <span>{cost}</span>
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

  return (
    <div className="flex flex-col lg:flex-row h-full" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      {/* LIST/FILTER SIDE — 65% */}
      <div className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[65%] h-full lg:border-r lg:border-gray-300 lg:dark:border-slate-600">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-center">
            <div className="bg-gray-200 dark:bg-slate-800 p-2 rounded-lg flex flex-wrap gap-2 items-center">
              {Object.values(optionCounts.Cohort).some(count => count > 0) && (
                <select
                  value={filterCohort}
                  onChange={e => handleFilterChange(setFilterCohort, e.target.value)}
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
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
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Promotions</option>
                  {promotions.filter(p => optionCounts.TimedPromotion[p] > 0).map(p => (
                    <option key={p} value={p}>{formatLabel(p)} ({optionCounts.TimedPromotion[p]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.StoreLabel).some(count => count > 0) && (
                <select
                  value={filterStoreLabel}
                  onChange={e => handleFilterChange(setFilterStoreLabel, e.target.value)}
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
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
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Promo Codes</option>
                  {promoTypes.filter(n => optionCounts.PromoType[n] > 0).map(n => (
                    <option key={n} value={n}>{n} ({optionCounts.PromoType[n]})</option>
                  ))}
                </select>
              )}
              {colorsAll.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenColor(v => !v)}
                    className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-3 py-1 border border-gray-300 dark:border-slate-600 min-w-[180px] text-left flex items-center gap-2"
                  >
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: filterColor || 'transparent', outline: filterColor ? 'none' : '1px solid rgba(0,0,0,0.2)' }}
                    />
                    <span>{filterColor || 'Color'}</span>
                  </button>
                  {openColor && (
                    <div className="dark:text-white text-gray-900 absolute z-20 mt-1 max-h-72 overflow-auto bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg w-56 p-1">
                      <button
                        className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                        onClick={() => { setFilterColor(''); setOpenColor(false); }}
                      >
                        <span className="inline-block w-4 h-4 rounded border border-gray-300 dark:border-slate-600 bg-transparent" />
                        <span>All Colors ({Object.values(optionCounts.Color).reduce((a, b) => a + b, 0)})</span>
                      </button>
                      {colorsAll
                        .filter(c => (optionCounts.Color[c] || 0) > 0 || filterColor === c)
                        .map(c => (
                          <button
                            key={c}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                            onClick={() => { setFilterColor(c); setOpenColor(false); }}
                          >
                            <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: c }} />
                            <span className="flex-1 truncate">{c}</span>
                            <span className="">({optionCounts.Color[c] || 0})</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
                <select
                  value={filterBPSeason}
                  onChange={e => handleFilterChange(setFilterBPSeason, e.target.value)}
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Items ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>{String(season).replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                Store Titles Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                DLC Titles ({optionCounts.DLC || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={!!filterBundle} onChange={() => handleFilterChange(setFilterBundle, !filterBundle)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                Bundles Only ({optionCounts.Bundle || 0})
              </label>
              <button onClick={resetFilters} aria-label="Reset all filters" className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Reset Filters
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-4 flex-col mb-4">
          <div className="lg:flex gap-4 items-center">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
                placeholder="Search Titles"
                className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
              Showing {filtered.length} Title{filtered.length !== 1 ? 's' : ''}
            </div>
            <div className="relative">
              <select
                value={sortType}
                onChange={e => setSortType(e.target.value)}
                className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none"
              >
                <option value="ArrayIndexDesc">Default Sorting (Desc)</option>
                <option value="ArrayIndexAsc">Default Sorting (Asc)</option>
                <option value="TitleIDDesc">Title ID (Desc)</option>
                <option value="TitleIDAsc">Title ID (Asc)</option>
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
        </div>

        {/* Wrapped list only. */}
        <div style={{ height: listHeight }} className="overflow-y-auto">
          <VirtuosoGrid
            data={filtered}
            totalCount={filtered.length}
            listClassName="flex flex-wrap gap-1"
            itemContent={(index) => (
              <div className="w-auto max-w-full">
                <Row index={index} data={filtered} />
              </div>
            )}
            useWindowScroll={false}
          />
        </div>
      </div>

      {/* DETAIL SIDE — 35% */}
      <div ref={detailPanelRef} className={`h-full lg:w-[35%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedTitle ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button className="lg:hidden text-gray-900 dark:text-white cursor-pointer" onClick={() => setSelectedTitle(null)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          {selectedTitle ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: (selectedTitle.monikerData?.Color || '').replace('0x', '#') }}>
                    {langs.content?.[getDisplayNameKey(selectedTitle)] || selectedTitle.monikerData?.MonikerName}
                  </span>
                </div>
                {langs.content?.[getDescriptionKey(selectedTitle)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedTitle)]}
                  </div>
                )}
                {Array.isArray(selectedTitle.store) && selectedTitle.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedTitle.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {selectedTitle.promo && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">Promo Type: {selectedTitle.promo.Type}</span>
                  )}
                  {selectedTitle.bp && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                      Battle Pass Season {String(selectedTitle.bp.ID).replace('BP', '').replace('-', ' ')}{selectedTitle.bp.Tier ? ` (Tier ${selectedTitle.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedTitle.entitlement && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                      {(langs.content?.[selectedTitle.entitlement.DisplayNameKey]?.replace('!', '') || selectedTitle.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedTitle.monikerData?.ImplicitOwnership === 'true' && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-sky-500 dark:bg-sky-700 text-gray-900 dark:text-white">Implicit Ownership</span>
                  )}
                  {selectedTitle.monikerData?.GrantedManually === 'true' && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">Granted Manually</span>
                  )}
                  {selectedTitle.store?.length > 0 && [...new Set(selectedTitle.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'No Longer Purchasable' : label}
                    </span>
                  ))}
                  {selectedTitle.store?.length > 0 && [...new Set(selectedTitle.store.map(s => s.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                    <span key={idx} className="text-sm px-3 py-1 rounded-lg bg-rose-500 dark:bg-rose-700 text-gray-900 dark:text-white">{formatLabel(promo)}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <span className="text-lg text-gray-900 dark:text-white">Title Data</span>
                  <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                    <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                      <span className="font-bold text-gray-600 dark:text-gray-300">Name</span>
                      <span className="text-gray-900 dark:text-white">{selectedTitle.monikerData?.MonikerName}</span>
                    </div>
                    <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                      <span className="font-bold text-gray-600 dark:text-gray-300">ID</span>
                      <span className="text-gray-900 dark:text-white">{selectedTitle.monikerData?.MonikerID}</span>
                    </div>
                    {selectedTitle.monikerData?.Color && (
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Color</span>
                        <span className="text-gray-900 dark:text-white" style={{ color: (selectedTitle.monikerData.Color || '').replace('0x', '#') }}>
                          {(selectedTitle.monikerData.Color || '').replace('0x', '#')}
                        </span>
                      </div>
                    )}
                    {selectedTitle.monikerData?.InventoryNameKey && (
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Inventory Key</span>
                        <span className="text-gray-900 dark:text-white">{selectedTitle.monikerData.InventoryNameKey}</span>
                      </div>
                    )}
                    {selectedTitle.monikerData?.ImplicitOwnership && (
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Implicit Ownership</span>
                        <span className="text-gray-900 dark:text-white">{String(selectedTitle.monikerData.ImplicitOwnership)}</span>
                      </div>
                    )}
                    {selectedTitle.monikerData?.GrantedManually && (
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Granted Manually</span>
                        <span className="text-gray-900 dark:text-white">{String(selectedTitle.monikerData.GrantedManually)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {getProcessedStoreData(selectedTitle).map((sd, idx) => (
                  <div key={`store-${idx}`} className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Store Data{sd.Type === 'Bundle' ? ' (Bundle)' : ''}</span>
                    <div className="grid grid-cols-2 gap-2 text-lg mt-2">
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
                          <div className="flex items-center gap-1">
                            <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                            <span className="line-through text-red-600 dark:text-red-400">{
                              sd.ItemList.map((item) => {
                                if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                                if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                                if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                                if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                                if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                                if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                                if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                                return 0;
                              }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0)
                            }</span>
                            <span className="text-green-600 dark:text-green-400 font-bold">{Math.floor((sd.ItemList.map((item) => {
                              if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                              if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                              if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                              if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                              if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                              if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                              if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                              return 0;
                            }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0) * (sd.IdolBundleDiscount || 1)).toFixed(2))}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="col-span-2 grid grid-cols-2 gap-2">
                          {(sd.Costs.mc > 0) && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                              <div>
                                <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} />
                                <span className="text-gray-900 dark:text-white">{sd.Costs.mc}</span>
                              </div>
                            </div>
                          )}
                          {(sd.Costs.mcSale > 0) && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                              <div className="flex items-center gap-1">
                                <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc}</span>
                                <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
                              </div>
                            </div>
                          )}
                          {(sd.Costs.gold > 0) && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                              <div>
                                <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                <span className="text-gray-900 dark:text-white">{sd.Costs.gold}</span>
                              </div>
                            </div>
                          )}
                          {(sd.Costs.goldSale > 0) && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                              <div className="flex items-center gap-1">
                                <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} />
                                <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.gold}</span>
                                <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.goldSale}</span>
                              </div>
                            </div>
                          )}
                          {(sd.Costs.glory > 0) && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                              <div>
                                <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} />
                                <span className="text-gray-900 dark:text-white">{sd.Costs.glory}</span>
                              </div>
                            </div>
                          )}
                          {Object.keys(sd.Costs.special).length > 0 && (
                            <div className="col-span-2 flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Special Currency</span>
                              <div className="flex flex-wrap gap-3 mt-1">
                                {Object.entries(sd.Costs.special).map(([type, cost], i) => (
                                  <span key={i} className="text-gray-900 dark:text-white flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${type}`} className="h-5 inline" onError={handleImgError} />
                                    <span>{type}: {cost}</span>
                                  </span>
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
              </div>
            </div>
          ) : (
            <div className="text-gray-900 dark:text-white">Select a Title</div>
          )}
        </div>
      </div>
    </div>
  );
}
