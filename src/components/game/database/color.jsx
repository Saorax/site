import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
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
      StoreOnly: 0,
      AllBP: 0,
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
      }
      ['Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement'].forEach(k => {
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
export function ColorSchemeStoreView({ colors, langs }) {
  const data = useMemo(
    () => (Array.isArray(colors) ? colors : []).map(c => ({ ...c, store: normalizeStore(c) })),
    [colors]
  );
  const [selectedColor, setSelectedColor] = useState(null);
  const [sortType, setSortType] = useState('OrderIDDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [viewMode, setViewMode] = useState('list');
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
    filterBPSeason, filterEntitlement, debouncedSearch, sortType, viewMode, isMobile
  ]);
  useEffect(() => {
    if (isInitialMount.current) isInitialMount.current = false;
    else if (isMobile) { setSelectedColor(null); filtersChanged.current = true; }
  }, [
    filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType,
    filterBPSeason, filterEntitlement, debouncedSearch, sortType, isMobile
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
  }, [selectedColor, filterHeight]);
  const helpers = useMemo(() => ({
    Cohort: e => uniq(normalizeStore(e).map(s => s.Cohort).filter(Boolean)),
    TimedPromotion: e => uniq(normalizeStore(e).map(s => s.TimedPromotion).filter(Boolean)),
    StoreID: e => uniq(normalizeStore(e).map(s => s.StoreID).filter(v => v !== undefined && v !== null && v !== '')),
    StoreLabel: e => uniq(normalizeStore(e).map(s => s.Label).filter(Boolean)),
    PromoType: e => e.promo?.Type ?? '',
    BPSeason: e => e.bp?.ID ?? '',
    Entitlement: e => !!e.entitlement
  }), []);
  const getDisplayNameKey = e => (normalizeStore(e)[0]?.DisplayNameKey) ?? e.colorData?.DisplayNameKey ?? '';
  const getDescriptionKey = e => (normalizeStore(e)[0]?.DescriptionKey) ?? e.colorData?.DescriptionKey ?? '';
  const getOrderID = (e) => parseInt(e?.colorData?.OrderID, 10) || 0;
  const cohorts = useMemo(() => uniqueValues(data, ['store', 'Cohort']), [data]);
  const promotions = useMemo(() => uniqueValues(data, ['store', 'TimedPromotion']), [data]);
  const storeLabels = useMemo(() => uniqueValues(data, ['store', 'Label']), [data]);
  const promoTypes = useMemo(() => uniqueValues(data, ['promo', 'Type']), [data]);
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
      StoreOnly: storeOnly
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
      const fields = [
        langs.content?.[getDisplayNameKey(e)] || '',
        langs.content?.[getDescriptionKey(e)] || '',
        e.colorData?.ColorSchemeName || '',
        String(e.colorData?.ColorSchemeID || ''),
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
      const nameA = (langs.content?.[getDisplayNameKey(a)] || a.colorData?.ColorSchemeName || '').toString();
      const nameB = (langs.content?.[getDisplayNameKey(b)] || b.colorData?.ColorSchemeName || '').toString();
      const idA = Number(a.colorData?.ColorSchemeID) || 0;
      const idB = Number(b.colorData?.ColorSchemeID) || 0;
      const minStoreId = e => {
        const s = normalizeStore(e);
        if (!s.length) return 0;
        return Math.min(...s.map(sd => Number(sd.StoreID) || 0));
      };
      const orderA = getOrderID(a);
      const orderB = getOrderID(b);
      switch (sortType) {
        case 'OrderIDAsc': return orderA - orderB;
        case 'OrderIDDesc': return orderB - orderA;
        case 'ColorSchemeIDAsc': return idA - idB;
        case 'ColorSchemeIDDesc': return idB - idA;
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
    filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, langs
  ]);
  useEffect(() => {
    if (data.length === 0 || filtered.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('color') ? String(params.get('color')) : null;
    let item = null;
    if (idParam) item = filtered.find(e => String(e.colorData?.ColorSchemeID) === idParam);
    if (!item && !isMobile) item = filtered[0];
    setSelectedColor(item || null);
  }, [data, filtered, isMobile]);
  useEffect(() => {
    if (isMobile && selectedColor && !filtered.some(e => e.colorData?.ColorSchemeID === selectedColor.colorData?.ColorSchemeID)) {
      setSelectedColor(null);
    }
  }, [filtered, isMobile, selectedColor]);
  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedColor) currentParams.set('color', String(selectedColor.colorData?.ColorSchemeID));
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('color') ? String(params.get('color')) : null;
      if (idParam && filtered.length > 0) {
        const item = filtered.find(e => String(e.colorData?.ColorSchemeID) === idParam);
        if (item) setSelectedColor(item);
        else if (!isMobile) setSelectedColor(filtered[0] || null);
        else setSelectedColor(null);
      } else if (!isMobile) setSelectedColor(filtered[0] || null);
      else setSelectedColor(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedColor, filtered, isMobile]);
  const handleFilterChange = useCallback((setter, value) => { setter(value); }, []);
  const resetFilters = useCallback(() => {
    setSortType('OrderIDDesc');
    setSearchQuery('');
    setFilterCohort('');
    setFilterPromo('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    if (isMobile) { setSelectedColor(null); filtersChanged.current = true; }
    else { setSelectedColor(filtered[0] || null); }
  }, [filtered, isMobile]);
  const handleCopyLink = useCallback(() => {
    if (!selectedColor) return;
    const url = `${window.location.origin}${window.location.pathname}?color=${selectedColor.colorData?.ColorSchemeID}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, [selectedColor]);
  const handleImgError = e => { e.currentTarget.style.display = 'none'; };
  const Row = ({ index, data }) => {
    const item = data[index];
    const storeData = getProcessedStoreData(item);
    const isSelected = selectedColor?.colorData?.ColorSchemeID === item.colorData?.ColorSchemeID;
    const bgHex = (item.colorData?.IndicatorColor || '0x000000').slice(2);
    const bgColor = `#${bgHex}`;
    const r = parseInt(bgColor.substr(1, 2), 16);
    const g = parseInt(bgColor.substr(3, 2), 16);
    const b = parseInt(bgColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    const textColor = luminance > 128 ? '#000000' : '#ffffff';
    return (
      <div
        className={viewMode === 'grid' ? 'p-1 w-full h-[245px]' : 'p-0 px-2 h-[160px]'}
        onClick={() => { setSelectedColor(item); filtersChanged.current = false; }}
      >
        <div
          className={`rounded-lg cursor-pointer p-3 transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center' : 'flex'}`}
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          <div className="flex rounded-lg items-center justify-center relative">
            <img
              src={`${host}/game/getGfx/UI_Icons/${item.colorData?.IconName}`}
              className="h-32 w-32 object-contain"
              onError={handleImgError}
              alt=""
              loading="lazy"
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              <div className={`mt-1 flex justify-start font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <span className={viewMode === 'grid' ? 'truncate max-w-[11rem]' : ''}>
                  {langs.content?.[getDisplayNameKey(item)] || item.colorData?.ColorSchemeName}
                </span>
              </div>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!item.store?.length && !item.bp && !item.promo && !item.entitlement && (
                    <div className="bg-gray-500/70 text-white text-xs font-bold px-2 py-0.5 rounded-lg">Not Obtainable</div>
                  )}
                  {item.bp && (
                    <div className="bg-emerald-600 text-black text-xs font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(item.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
                  )}
                  {item.promo && (
                    <div className="bg-violet-600 text-black text-xs font-bold px-2 py-0.5 rounded-lg">{`Promo Code${!item.store?.length && !item.bp && !item.entitlement ? ' Only' : ''}`}</div>
                  )}
                  {item.entitlement && (
                    <div className="bg-amber-400 text-black text-xs font-bold px-2 py-0.5 rounded-lg">
                      {(langs.content?.[item.entitlement.DisplayNameKey]?.replace('!', '') || item.entitlement.EntitlementName) + ' DLC'}
                    </div>
                  )}
                  {item.store?.length > 0 && uniq(item.store.map(s => s.Label).filter(Boolean)).map((label, idx) => (
                    <div key={idx} className={`${label === "New" ? "bg-yellow-300" : label === "LastChance" ? "bg-red-500" : "bg-cyan-400"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>{label === "LastChance" ? "No Longer Purchasable" : label}</div>
                  ))}
                  {item.store?.length > 0 && uniq(item.store.map(s => s.TimedPromotion ?? '').filter(Boolean)).map((promo, idx) => (
                    <div key={idx} className="bg-rose-400 text-black text-xs font-bold px-2 py-0.5 rounded-lg">{formatLabel(promo)}</div>
                  ))}
                  {item.timedEvent && (
                    <div className="bg-orange-500 text-black text-xs font-bold px-2 py-0.5 rounded-lg">{item.timedEvent.TimedEventName} Event</div>
                  )}
                </div>
              )}
              {viewMode === 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {item.bp && (
                    <div className="bg-emerald-600 text-black text-[10px] font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(item.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3">
              {storeData.map((sd, idx) => (
                <div key={`costs-${idx}`} className="flex flex-wrap gap-2">
                  {sd.Costs.mc > 0 && (
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} loading="lazy" />
                      <span>{sd.Costs.mc}</span>
                    </div>
                  )}
                  {sd.Costs.gold > 0 && (
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} loading="lazy" />
                      <span>{sd.Costs.gold}</span>
                    </div>
                  )}
                  {sd.Costs.glory > 0 && (
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} loading="lazy" />
                      <span>{sd.Costs.glory}</span>
                    </div>
                  )}
                  {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                    <div key={`special-${sIdx}`}>
                      <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} loading="lazy" />
                      <span>{cost}</span>
                    </div>
                  ))}
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
      <div className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full lg:border-r lg:border-gray-300 lg:dark:border-slate-600">
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
              {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
                <select
                  value={filterBPSeason}
                  onChange={e => handleFilterChange(setFilterBPSeason, e.target.value)}
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Colors ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>{String(season).replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                Store Colors Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                DLC Colors ({optionCounts.DLC || 0})
              </label>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setViewMode('list')}
                  className={`cursor-pointer p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`}
                  title="List View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`cursor-pointer p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`}
                  title="Grid View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"></path></svg>
                </button>
                <button
                  onClick={resetFilters}
                  aria-label="Reset all filters"
                  className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 7a2 2 0 012-2h3m11 2a2 2 0 00-2-2h-3m0 0V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7v10a2 2 0 002 2h3m11-12v10a2 2 0 01-2 2h-3m-6 0h6"></path></svg>
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-4 flex-col mb-4">
            <div className="lg:flex gap-4 items-center">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M10 18a8 8 0 110-16 8 8 0 010 16z"></path></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
                  placeholder="Search Colors"
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[260px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
              </div>
              <div className="relative">
                <select
                  value={sortType}
                  onChange={e => setSortType(e.target.value)}
                  className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[220px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none pr-8"
                >
                  <option value="OrderIDDesc">Order ID (Desc)</option>
                  <option value="OrderIDAsc">Order ID (Asc)</option>
                  <option value="ColorSchemeIDDesc">Color ID (Desc)</option>
                  <option value="ColorSchemeIDAsc">Color ID (Asc)</option>
                  <option value="StoreIDDesc">Store ID (Desc)</option>
                  <option value="StoreIDAsc">Store ID (Asc)</option>
                  <option value="AlphaAsc">Alphabetical (A–Z)</option>
                  <option value="AlphaDesc">Alphabetical (Z–A)</option>
                  <option value="CostAsc">Mammoth Cost (Asc)</option>
                  <option value="CostDesc">Mammoth Cost (Desc)</option>
                </select>
                <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
        <div className="h-[100vh] overflow-y-auto" style={{ height: listHeight }}>
          {viewMode === 'list' ? (
            <Virtuoso
              data={filtered}
              totalCount={filtered.length}
              itemContent={(index) => <Row index={index} data={filtered} />}
            />
          ) : (
            <VirtuosoGrid
              data={filtered}
              totalCount={filtered.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemContent={(index) => <Row index={index} data={filtered} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedColor ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button className="lg:hidden text-gray-900 dark:text-white cursor-pointer" onClick={() => setSelectedColor(null)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedColor && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="cursor-pointer bg-blue-500 dark:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg">Copy Link</button>
              </div>
            )}
          </div>
          {selectedColor ? (
            <div className="gap-2 flex flex-col">
              <div
                className="flex flex-col gap-2 pb-3 p-2 rounded-lg"
                style={{
                  backgroundColor: `#${(selectedColor.colorData?.IndicatorColor || '0x000000').slice(2)}`,
                  color: (() => {
                    const bg = `#${(selectedColor.colorData?.IndicatorColor || '0x000000').slice(2)}`;
                    const r = parseInt(bg.substr(1, 2), 16);
                    const g = parseInt(bg.substr(3, 2), 16);
                    const b = parseInt(bg.substr(5, 2), 16);
                    const lum = (0.299 * r + 0.587 * g + 0.114 * b);
                    return lum > 128 ? '#000000' : '#ffffff';
                  })()
                }}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={`${host}/game/getGfx/UI_Icons/${selectedColor.colorData?.IconName}`}
                    className="h-16 w-16 object-contain"
                    onError={handleImgError}
                    alt=""
                    loading="lazy"
                  />
                  <span className="text-2xl font-bold">
                    {langs.content?.[getDisplayNameKey(selectedColor)] || selectedColor.colorData?.ColorSchemeName}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  {langs.content?.[getDescriptionKey(selectedColor)] && (
                    <div>{langs.content[getDescriptionKey(selectedColor)]}</div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedColor.promo && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-purple-500/80">Promo Type: {selectedColor.promo.Type}</span>
                  )}
                  {selectedColor.bp && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500/80">
                      Battle Pass Season {String(selectedColor.bp.ID).replace('BP', '').replace('-', '')}{selectedColor.bp.Tier ? ` (Tier ${selectedColor.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedColor.entitlement && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-amber-500/80">
                      {(langs.content?.[selectedColor.entitlement.DisplayNameKey]?.replace('!', '') || selectedColor.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedColor.store?.length > 0 && [...new Set(selectedColor.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "bg-yellow-300/90" : label === "LastChance" ? "bg-red-500/90" : "bg-cyan-400/90"} text-black text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'No Longer Purchasable' : label}
                    </span>
                  ))}
                  {selectedColor.store?.length > 0 && [...new Set(selectedColor.store.map(s => s.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                    <span key={idx} className="text-sm px-3 py-1 rounded-lg bg-rose-500/80">{formatLabel(promo)}</span>
                  ))}
                  {selectedColor.timedEvent && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-orange-500/80">
                      {selectedColor.timedEvent.TimedEventName} Event
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="lg:w-1/2 flex flex-col gap-2">
                  <div className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Color Scheme Data</span>
                    <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Name</span>
                        <span className="text-gray-900 dark:text-white">{selectedColor.colorData?.ColorSchemeName}</span>
                      </div>
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">ID</span>
                        <span className="text-gray-900 dark:text-white">{selectedColor.colorData?.ColorSchemeID}</span>
                      </div>
                      {selectedColor.colorData?.IconName && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Icon</span>
                          <span className="text-gray-900 dark:text-white">{selectedColor.colorData?.IconName}</span>
                        </div>
                      )}
                      {selectedColor.colorData?.IndicatorColor && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Indicator</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="rounded-lg w-8 h-8 border border-gray-300 dark:border-slate-700"
                              style={{ backgroundColor: `#${selectedColor.colorData.IndicatorColor.slice(2)}` }}
                            />
                            <span className="text-gray-900 dark:text-white">{`#${selectedColor.colorData.IndicatorColor.slice(2)}`}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Order ID</span>
                        <span className="text-gray-900 dark:text-white">{getOrderID(selectedColor)}</span>
                      </div>
                    </div>
                  </div>
                  {getProcessedStoreData(selectedColor).map((sd, idx) => (
                    <div key={`store-${idx}`} className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                      <span className="text-lg text-gray-900 dark:text-white">Store Data{sd.Type === 'Bundle' ? ' (Bundle)' : ''}</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        {sd.StoreName && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Store Name</span>
                            <span className="text-gray-900 dark:text-white">{sd.StoreName}</span>
                          </div>
                        )}
                        {(sd.StoreID !== undefined && sd.StoreID !== null && sd.StoreID !== '') && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Store ID</span>
                            <span className="text-gray-900 dark:text-white">{sd.StoreID}</span>
                          </div>
                        )}
                        {sd.Item && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Item</span>
                            <span className="text-gray-900 dark:text-white">{sd.Item}</span>
                          </div>
                        )}
                        {sd.Type && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Type</span>
                            <span className="text-gray-900 dark:text-white">{sd.Type}</span>
                          </div>
                        )}
                        {sd.Label && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Store Label</span>
                            <span className="text-gray-900 dark:text-white">{sd.Label === 'LastChance' ? 'No Longer Purchasable' : sd.Label}</span>
                          </div>
                        )}
                        {sd.TimedPromotion && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Promotion</span>
                            <span className="text-gray-900 dark:text-white">{formatLabel(sd.TimedPromotion)}</span>
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
                        {sd.SearchTags && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg col-span-2">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Search Tags</span>
                            <span className="text-gray-900 dark:text-white">{sd.SearchTags}</span>
                          </div>
                        )}
                        {sd.ItemList && sd.ItemList.length > 0 ? (
                          <div className="col-span-2">
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Bundle Cost</span>
                              <div className="flex flex-wrap items-center gap-4">
                                {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} loading="lazy" />
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
                                {(sd.Costs.gold > 0 || sd.Costs.goldSale > 0) && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    {sd.Costs.goldSale > 0 ? (
                                      <>
                                        <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.gold}</span>
                                        <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.goldSale}</span>
                                      </>
                                    ) : (
                                      <span className="text-gray-900 dark:text-white">{sd.Costs.gold}</span>
                                    )}
                                  </div>
                                )}
                                {sd.Costs.glory > 0 && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    <span className="text-gray-900 dark:text-white">{sd.Costs.glory}</span>
                                  </div>
                                )}
                                {Object.entries(sd.Costs.special).map(([currencyType, cost]) => cost > 0 && (
                                  <div key={`sp-bundle-${currencyType}`} className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${currencyType}`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    <span className="text-gray-900 dark:text-white">{cost}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            {(sd.IdolCost && sd.IdolCost !== 0 && sd.IdolCost !== '') && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="text-gray-900 dark:text-white">{sd.IdolCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.IdolSaleCost && sd.IdolSaleCost !== 0 && sd.IdolSaleCost !== '') && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                  <span className="line-through text-red-600 dark:text-red-400">{sd.IdolCost}</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold">{sd.IdolSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.GoldCost && sd.GoldCost !== 0 && sd.GoldCost !== '') && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="text-gray-900 dark:text-white">{sd.GoldCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.GoldSaleCost && sd.GoldSaleCost !== 0 && sd.GoldSaleCost !== '') && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                  <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.RankedPointsCost && sd.RankedPointsCost !== 0 && sd.RankedPointsCost !== '') && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="text-gray-900 dark:text-white">{sd.RankedPointsCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.SpecialCurrencyType && sd.SpecialCurrencyCost) && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-300">{sd.SpecialCurrencyType} Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${sd.SpecialCurrencyType}`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="text-gray-900 dark:text-white">{sd.SpecialCurrencyCost}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="lg:w-1/2 flex flex-col gap-2">
                  <div className="flex flex-col gap-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                    <span className="text-2xl text-gray-900 dark:text-white">Color Details</span>
                    <div className="flex flex-col text-sm gap-4 overflow-y-auto h-72">
                      {[
                        { category: 'Hair', items: [
                          { label: 'Light', key: 'HairLt_Swap' },
                          { label: '', key: 'Hair_Swap' },
                          { label: 'Dark', key: 'HairDk_Swap' },
                        ]},
                        { category: 'Body 1', items: [
                          { label: 'Very Light', key: 'Body1VL_Swap' },
                          { label: 'Light', key: 'Body1Lt_Swap' },
                          { label: '', key: 'Body1_Swap' },
                          { label: 'Dark', key: 'Body1Dk_Swap' },
                          { label: 'Very Dark', key: 'Body1VD_Swap' },
                          { label: 'Accent', key: 'Body1Acc_Swap' },
                        ]},
                        { category: 'Body 2', items: [
                          { label: 'Very Light', key: 'Body2VL_Swap' },
                          { label: 'Light', key: 'Body2Lt_Swap' },
                          { label: '', key: 'Body2_Swap' },
                          { label: 'Dark', key: 'Body2Dk_Swap' },
                          { label: 'Very Dark', key: 'Body2VD_Swap' },
                          { label: 'Accent', key: 'Body2Acc_Swap' },
                        ]},
                        { category: 'Special', items: [
                          { label: 'Very Light', key: 'SpecialVL_Swap' },
                          { label: 'Light', key: 'SpecialLt_Swap' },
                          { label: '', key: 'Special_Swap' },
                          { label: 'Dark', key: 'SpecialDk_Swap' },
                          { label: 'Very Dark', key: 'SpecialVD_Swap' },
                          { label: 'Accent', key: 'SpecialAcc_Swap' },
                        ]},
                        { category: 'Cloth', items: [
                          { label: 'Very Light', key: 'ClothVL_Swap' },
                          { label: 'Light', key: 'ClothLt_Swap' },
                          { label: '', key: 'Cloth_Swap' },
                          { label: 'Dark', key: 'ClothDk_Swap' },
                        ]},
                        { category: 'Weapon', items: [
                          { label: 'Very Light', key: 'WeaponVL_Swap' },
                          { label: 'Light', key: 'WeaponLt_Swap' },
                          { label: '', key: 'Weapon_Swap' },
                          { label: 'Dark', key: 'WeaponDk_Swap' },
                          { label: 'Accent', key: 'WeaponAcc_Swap' },
                        ]},
                      ].map(({ category, items }) => (
                        <div key={category} className="bg-white dark:bg-slate-900 p-2 rounded-2xl">
                          <div className="bg-gray-100 dark:bg-slate-800 p-2 rounded-2xl">
                            <span className="text-lg text-gray-900 dark:text-white">{category}</span>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                              {items.map(({ label, key }) => {
                                const hexColor = selectedColor.colorData?.[key];
                                if (!hexColor || hexColor.length < 8) return null;
                                const r = parseInt(hexColor.substr(2, 2), 16);
                                const g = parseInt(hexColor.substr(4, 2), 16);
                                const b = parseInt(hexColor.substr(6, 2), 16);
                                const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                                const tc = luminance > 128 ? '#000000' : '#ffffff';
                                return (
                                  <div key={key} className="flex flex-col p-2 rounded-2xl" style={{ backgroundColor: `#${hexColor.substr(2)}`, color: tc }}>
                                    <span className="font-bold text-base">{category} {label}</span>
                                    <code className="font-bold break-all text-lg">{hexColor}</code>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedColor.colorData?.ExcludeOpponentTeamColor && (
                    <div className="flex flex-col gap-2 mt-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                      <span className="text-2xl text-gray-900 dark:text-white">Opponent Color Exclusions</span>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <span>
                          If your opponent(s) are using any of these colors while you're using{' '}
                          <span className="inline-flex gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {langs.content[selectedColor.colorData.DisplayNameKey] || selectedColor.colorData.ColorSchemeName}
                            </span>
                          </span>
                          , they will use a fallback color scheme, to prevent some skins blending into the map, and/or to prevent confusion on who is the enemy when playing gamemodes other than 1v1.
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-lg text-gray-700 dark:text-gray-200">Fallback Color: </span>
                        <div className="flex items-center gap-2">
                          <img
                            src={`${host}/game/getGfx/UI_Icons/${(colors.find(r => r.colorData.ColorSchemeName == selectedColor.colorData.FallbackOpponentTeamColor) || {}).colorData?.IconName}`}
                            className="h-7"
                            loading="lazy"
                          />
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {(() => {
                              const cd = colors.find(r => r.colorData.ColorSchemeName == selectedColor.colorData.FallbackOpponentTeamColor);
                              if (!cd) return selectedColor.colorData.FallbackOpponentTeamColor;
                              return langs.content[getDisplayNameKey(cd)] || cd.colorData.ColorSchemeName;
                            })()}
                          </span>
                        </div>
                      </div>
                      <hr className="my-0.5" />
                      <span className="text-lg text-gray-700 dark:text-gray-200">Color List</span>
                      <div className="col-span-2 flex flex-wrap gap-2 mt-1">
                        {selectedColor.colorData.ExcludeOpponentTeamColor.split(',').map((colorName, idx) => {
                          const colorData = colors.find(r => r.colorData.ColorSchemeName == colorName);
                          if (!colorData) return null;
                          const bg = `#${colorData.colorData.IndicatorColor.slice(2)}`;
                          const rr = parseInt(bg.substr(1, 2), 16);
                          const gg = parseInt(bg.substr(3, 2), 16);
                          const bb = parseInt(bg.substr(5, 2), 16);
                          const lum = (0.299 * rr + 0.587 * gg + 0.114 * bb);
                          const tc = lum > 128 ? '#000000' : '#ffffff';
                          return (
                            <div key={idx} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: bg, color: tc }}>
                              <img src={`${host}/game/getGfx/UI_Icons/${colorData.colorData.IconName}`} className="h-6" loading="lazy" />
                              <span className="text-lg font-bold">{langs.content[getDisplayNameKey(colorData)] || colorData.colorData.ColorSchemeName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {Array.isArray(selectedColor.levelExclusion) && selectedColor.levelExclusion.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                      <span className="text-2xl text-gray-900 dark:text-white">Level Exclusions</span>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 ">
                        <span>
                          If you are using{' '}
                          <span className="inline-flex gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {langs.content[selectedColor.colorData.DisplayNameKey] || selectedColor.colorData.ColorSchemeName}
                            </span>
                          </span>
                          {' '} on these maps, your opponent(s) will see you with the fallback color scheme.
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-lg text-center items-stretch max-h-64 overflow-y-auto mt-2">
                        {selectedColor.levelExclusion.map((exclusion, idx) => (
                          <div key={idx} className="flex flex-col bg-gray-200 dark:bg-slate-900 p-2 rounded-2xl h-full items-center">
                            <span className="text-gray-900 dark:text-white flex-grow flex items-center">{exclusion.DisplayName}</span>
                            <img
                              src={`${host}/game/images/images/thumbnails/${exclusion.ThumbnailPNGFile}`}
                              className="rounded-lg mt-2 w-full h-32 object-cover"
                              alt={exclusion.DisplayName}
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 italic">Select a Color Scheme to see details</div>
          )}
        </div>
      </div>
    </div>
  );
}
