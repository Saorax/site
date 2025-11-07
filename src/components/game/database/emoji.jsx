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
      Category: {},
      Cohort: {},
      TimedPromotion: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      BPSeason: {},
      Entitlement: {},
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
      ['Category', 'Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement'].forEach(k => {
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

function getFirstEmojiForCategory(emojis, category) {
  return emojis.find(emoji => emoji.emojiData?.Category === category);
}

export function EmojiStoreView({ emojis, langs }) {
  const data = useMemo(() => (Array.isArray(emojis) ? emojis : []).map(e => ({ ...e, store: normalizeStore(e) })), [emojis]);

  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState([]);
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterBundle, setFilterBundle] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const topRef = useRef(null);
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
    filterCategory, filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType,
    filterBPSeason, filterEntitlement, filterBundle, debouncedSearch, sortType, viewMode, isMobile
  ]);

  useEffect(() => {
    if (isInitialMount.current) isInitialMount.current = false;
    else if (isMobile) { setSelectedEmoji(null); filtersChanged.current = true; }
  }, [
    filterCategory, filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType,
    filterBPSeason, filterEntitlement, filterBundle, debouncedSearch, sortType, isMobile
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
  }, [selectedEmoji, filterHeight]);

  const helpers = useMemo(() => ({
    Category: e => e.emojiData?.Category ?? '',
    Cohort: e => uniq(normalizeStore(e).map(s => s.Cohort).filter(Boolean)),
    TimedPromotion: e => uniq(normalizeStore(e).map(s => s.TimedPromotion).filter(Boolean)),
    StoreID: e => uniq(normalizeStore(e).map(s => s.StoreID).filter(v => v !== undefined && v !== null && v !== '')),
    StoreLabel: e => uniq(normalizeStore(e).map(s => s.Label).filter(Boolean)),
    PromoType: e => e.promo?.Type ?? '',
    BPSeason: e => e.bp?.ID ?? '',
    Entitlement: e => !!e.entitlement,
    Bundle: e => normalizeStore(e).some(s => s.Type === 'Bundle')
  }), []);

  const getDisplayNameKey = e => (normalizeStore(e)[0]?.DisplayNameKey) ?? e.emojiData?.DisplayNameKey ?? '';
  const getDescriptionKey = e => (normalizeStore(e)[0]?.DescriptionKey) ?? e.emojiData?.DescriptionKey ?? '';

  const categories = useMemo(() => uniqueValues(data, ['emojiData', 'Category']), [data]);
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
      Category: filterCategory,
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      StoreOnly: storeOnly,
      Bundle: filterBundle
    },
    helpers
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const arr = data.filter(e => {
      if (filterCategory.length && !filterCategory.includes(e.emojiData?.Category)) return false;
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
      const fields = [
        langs.content?.[getDisplayNameKey(e)] || '',
        langs.content?.[getDescriptionKey(e)] || '',
        e.emojiData?.EmojiName || '',
        String(e.emojiData?.EmojiID || ''),
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
      const nameA = (langs.content?.[getDisplayNameKey(a)] || a.emojiData?.EmojiName || '').toString();
      const nameB = (langs.content?.[getDisplayNameKey(b)] || b.emojiData?.EmojiName || '').toString();
      const idA = parseInt(a.emojiData?.EmojiID || 0, 10) || 0;
      const idB = parseInt(b.emojiData?.EmojiID || 0, 10) || 0;
      const minStoreId = e => {
        const s = normalizeStore(e);
        if (!s.length) return 0;
        return Math.min(...s.map(sd => parseInt(sd.StoreID || 0, 10) || 0));
      };
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'EmojiIDAsc': return idA - idB;
        case 'EmojiIDDesc': return idB - idA;
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
    data, debouncedSearch, sortType, filterCategory, filterCohort, filterPromo, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterBundle, langs
  ]);

  useEffect(() => {
    if (data.length === 0 || filtered.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const emojiId = params.get('emoji') ? String(params.get('emoji')) : null;
    let emoji = null;
    if (emojiId) emoji = filtered.find(e => String(e.emojiData?.EmojiID) === emojiId);
    if (!emoji && !isMobile) emoji = filtered[0];
    setSelectedEmoji(emoji || null);
  }, [data, filtered, isMobile]);

  useEffect(() => {
    if (isMobile && selectedEmoji && !filtered.some(e => e.emojiData?.EmojiID === selectedEmoji.emojiData?.EmojiID)) {
      setSelectedEmoji(null);
    }
  }, [filtered, isMobile, selectedEmoji]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedEmoji) currentParams.set('emoji', String(selectedEmoji.emojiData?.EmojiID));
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const emojiId = params.get('emoji') ? String(params.get('emoji')) : null;
      if (emojiId && filtered.length > 0) {
        const emoji = filtered.find(e => String(e.emojiData?.EmojiID) === emojiId);
        if (emoji) setSelectedEmoji(emoji);
        else if (!isMobile) setSelectedEmoji(filtered[0] || null);
        else setSelectedEmoji(null);
      } else if (!isMobile) setSelectedEmoji(filtered[0] || null);
      else setSelectedEmoji(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedEmoji, filtered, isMobile]);

  const handleFilterChange = useCallback((setter, value) => { setter(value); }, []);
  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterCategory([]);
    setFilterCohort('');
    setFilterPromo('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    setFilterBundle(false);
    if (isMobile) { setSelectedEmoji(null); filtersChanged.current = true; }
    else { setSelectedEmoji(filtered[0] || null); }
  }, [filtered, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedEmoji) return;
    const url = `${window.location.origin}${window.location.pathname}?emoji=${selectedEmoji.emojiData?.EmojiID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('No Link Copied');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedEmoji]);

  const handleImgError = e => { e.currentTarget.style.display = 'none'; };

  const Row = ({ index, data }) => {
    const emoji = data[index];
    const storeData = getProcessedStoreData(emoji);
    const isSelected = selectedEmoji?.emojiData?.EmojiID === emoji.emojiData?.EmojiID;
    return (
      <div
        className={viewMode === 'grid' ? 'p-1 w-full h-[245px]' : 'p-0 px-2 h-[160px]'}
        onClick={() => { setSelectedEmoji(emoji); filtersChanged.current = false; }}
      >
        <div className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center' : 'flex'}`}>
          <div className="flex rounded-lg items-center justify-center relative">
            <img
              src={`${host}/game/animEmoji/${emoji.emojiData?.EmojiID}`}
              className="h-32 w-32 object-contain"
              onError={handleImgError}
              alt=""
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              <div className={`mt-1 flex justify-start text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <span className={viewMode === 'grid' ? 'truncate max-w-[11rem]' : ''}>{langs.content?.[getDisplayNameKey(emoji)] || emoji.emojiData?.EmojiName}</span>
              </div>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!emoji.store?.length && !emoji.bp && !emoji.promo && !emoji.entitlement && (emoji.emojiData?.DefaultUnlocked?.toString()?.toLowerCase() !== 'true') && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">Not Obtainable</div>
                  )}
                  {emoji.emojiData?.DefaultUnlocked?.toString()?.toLowerCase() === 'true' && (
                    <div className="bg-teal-500 dark:bg-teal-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">Default Emoji</div>
                  )}
                  {emoji.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(emoji.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
                  )}
                  {emoji.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{`Promo Code${!emoji.store?.length && !emoji.bp && !emoji.entitlement ? ' Only' : ''}`}</div>
                  )}
                  {emoji.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{(langs.content?.[emoji.entitlement.DisplayNameKey]?.replace('!', '') || emoji.entitlement.EntitlementName) + ' DLC'}</div>
                  )}
                  {emoji.store?.length > 0 && uniq(emoji.store.map(s => s.Label).filter(Boolean)).map((label, idx) => (
                    <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>{label === "LastChance" ? "No Longer Purchasable" : label}</div>
                  ))}
                  {emoji.store?.length > 0 && uniq(emoji.store.map(s => s.TimedPromotion ?? '').filter(Boolean)).map((promo, idx) => (
                    <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">{formatLabel(promo)}</div>
                  ))}
                </div>
              )}
              {viewMode === 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {emoji.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(emoji.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
                  )}
                </div>
              )}
            </div>
            <div className="text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white">
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
          </div></div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full lg:border-r lg:border-gray-300 lg:dark:border-slate-600">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
          <div className="flex flex-wrap gap-2 items-center overflow-x-auto pt-2">
            {categories
              .filter(cat => optionCounts.Category[cat] > 0)
              .map(cat => {
                const firstEmoji = getFirstEmojiForCategory(data, cat);
                if (!firstEmoji) return null;
                return (
                  <div key={cat} className="relative">
                    <img
                      src={`${host}/game/animEmoji/${firstEmoji.emojiData?.EmojiID}`}
                      className={`h-12 w-12 object-contain rounded-lg cursor-pointer ${filterCategory.includes(cat) ? '' : 'opacity-40'}`}
                      onClick={() => handleFilterChange(setFilterCategory, filterCategory.includes(cat) ? filterCategory.filter(c => c !== cat) : [...filterCategory, cat])}
                      title={cat}
                      onError={handleImgError}
                    />
                    <span className="absolute top-0.5 -right-2 bg-blue-500 text-white text-xs rounded-full px-1">{optionCounts.Category[cat] || 0}</span>
                  </div>
                );
              })}
          </div>
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
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Emojis ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>{String(season).replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                Store Emojis Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                DLC Emojis ({optionCounts.DLC || 0})
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
                placeholder="Search Emojis"
                className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
              Showing {filtered.length} Emoji{filtered.length !== 1 ? 's' : ''}
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
          <div className="relative">
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value)}
              className="cursor-pointer bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none"
            >
              <option value="ArrayIndexDesc">Default Sorting (Desc)</option>
              <option value="ArrayIndexAsc">Default Sorting (Asc)</option>
              <option value="EmojiIDDesc">Emoji ID (Desc)</option>
              <option value="EmojiIDAsc">Emoji ID (Asc)</option>
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
        <div className="h-[100vh] overflow-y-auto">
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
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedEmoji ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button className="lg:hidden text-gray-900 dark:text-white cursor-pointer" onClick={() => setSelectedEmoji(null)}>
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedEmoji && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="cursor-pointer bg-blue-500 dark:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg">Copy Link</button>
                {copyFeedback && <span className="text-sm text-gray-900 dark:text-gray-300">{copyFeedback}</span>}
              </div>
            )}
          </div>
          {selectedEmoji ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <img
                    src={`${host}/game/animEmoji/${selectedEmoji.emojiData?.EmojiID}`}
                    className="h-16 w-16 object-contain"
                    onError={handleImgError}
                    alt=""
                  />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {langs.content?.[getDisplayNameKey(selectedEmoji)] || selectedEmoji.emojiData?.EmojiName}
                  </span>
                </div>
                {langs.content?.[getDescriptionKey(selectedEmoji)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedEmoji)]}
                  </div>
                )}
                {Array.isArray(selectedEmoji.store) && selectedEmoji.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedEmoji.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {selectedEmoji.promo && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">Promo Type: {selectedEmoji.promo.Type}</span>
                  )}
                  {selectedEmoji.bp && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                      Battle Pass Season {String(selectedEmoji.bp.ID).replace('BP', '').replace('-', ' ')}{selectedEmoji.bp.Tier ? ` (Tier ${selectedEmoji.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedEmoji.entitlement && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                      {(langs.content?.[selectedEmoji.entitlement.DisplayNameKey]?.replace('!', '') || selectedEmoji.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedEmoji.store?.length > 0 && [...new Set(selectedEmoji.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'No Longer Purchasable' : label}
                    </span>
                  ))}
                  {selectedEmoji.store?.length > 0 && [...new Set(selectedEmoji.store.map(s => s.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                    <span key={idx} className="text-sm px-3 py-1 rounded-lg bg-rose-500 dark:bg-rose-700 text-gray-900 dark:text-white">{formatLabel(promo)}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="lg:w-1/2 flex flex-col gap-2">
                  <div className="dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Emoji Data</span>
                    <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Emoji Name</span>
                        <span className="text-gray-900 dark:text-white">{selectedEmoji.emojiData?.EmojiName}</span>
                      </div>
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-300">Emoji ID</span>
                        <span className="text-gray-900 dark:text-white">{selectedEmoji.emojiData?.EmojiID}</span>
                      </div>
                      {selectedEmoji.emojiData?.Category && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Category</span>
                          <span className="text-gray-900 dark:text-white">{selectedEmoji.emojiData?.Category}</span>
                        </div>
                      )}
                      {selectedEmoji.emojiData?.DefaultUnlocked && (
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Default Unlocked</span>
                          <span className="text-gray-900 dark:text-white">{String(selectedEmoji.emojiData?.DefaultUnlocked)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {getProcessedStoreData(selectedEmoji).map((sd, idx) => (
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
                                }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0)}
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-bold">{Math.floor((sd.ItemList.map((item, itemIdx) => {
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
                  {selectedEmoji.entitlement && (
                    <div className='dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                      <span className="text-lg text-gray-900 dark:text-white">Entitlement Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.EntitlementName}</span>
                        </div>
                        {selectedEmoji.entitlement.EntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.EntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SteamAppID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Steam App ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.SteamAppID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SonyEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Sony Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.SonyEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SonyProductID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Sony Product ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.SonyProductID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.NintendoConsumableID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Consumable ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.NintendoConsumableID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.NintendoEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.NintendoEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1EntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.XB1EntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1ProductID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Product ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.XB1ProductID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1StoreID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Store ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.XB1StoreID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.AppleEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Apple Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.AppleEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.AndroidEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Android Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.AndroidEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.UbiConnectID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.UbiConnectID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.UbiConnectPackageID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect Package ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedEmoji.entitlement.UbiConnectPackageID}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="lg:w-1/2 flex flex-col gap-2 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <span className="text-gray-900 dark:text-white text-lg">Image Data</span>
                  <div className="mt-2 flex justify-center bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <img
                      src={`${host}/game/animEmoji/${selectedEmoji.emojiData?.EmojiID}`}
                      className="max-w-64 h-auto"
                      onError={handleImgError}
                      alt=""
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 italic">Select an emoji to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
