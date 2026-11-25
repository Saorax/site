import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useMediaQuery } from 'react-responsive';
import { AddedBadge, ImageWithLoader, RawDataDetails, getAddedPatch, getPatchFilterCounts, getPatchGroups, patchFilterMatches, PatchOptions } from './comp/LoadingImage';
import { ListTools, SourceLine, hasSources, sortSourceFilterValues, sourceFilterValues, useDataView, useGameNames } from '../../ui';
import { DENSE_CARD, VirtualCardGrid } from './comp/VirtualCardGrid';
import { FilterOption, FilterPanel, FilterSelect, FilterToggle, IconChip, NoMatches, countFilters } from './comp/FilterPanel';
import { pageSlugForLabel, readArrayParam, readBoolParam, writeArrayParam, writeBoolParam, writeStringParam } from './comp/urlQuery';
import { FieldGrid, PopupFullDataFooter, PopupViewBar, StoreDataSection, storeExportColumns } from './metadata';

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
const EMOJI_SORTS = [
  { value: 'ArrayIndexDesc', label: 'Newest First' },
  { value: 'ArrayIndexAsc', label: 'Oldest first' },
  { value: 'AlphaAsc', label: 'Name, A to Z' },
  { value: 'AlphaDesc', label: 'Name, Z to A' },
  { value: 'CostDesc', label: 'Mammoth Coins, high to low' },
  { value: 'CostAsc', label: 'Mammoth Coins, low to high' },
  { value: 'EmojiIDDesc', label: 'Emoji ID, high to low' },
  { value: 'EmojiIDAsc', label: 'Emoji ID, low to high' },
  { value: 'StoreIDDesc', label: 'Store ID, high to low' },
  { value: 'StoreIDAsc', label: 'Store ID, low to high' },
];

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
          c.mc += Number(it.IdolCost) || Number(it.IdolSaleCost) || 0;
          c.gold += Number(it.GoldCost) || Number(it.GoldSaleCost) || 0;
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
    const sum = (c) => (c.mc || c.mcSale || 0) + (c.gold || c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((s, v) => s + v, 0);
    return sum(a.Costs) - sum(b.Costs);
  });
  return processed;
}

function minCost(entity) {
  const s = getProcessedStoreData(entity);
  if (!s.length) return Number.MAX_SAFE_INTEGER;
  const c = s[0].Costs;
  return (c.mc || c.mcSale || 0) + (c.gold || c.goldSale || 0) + (c.glory || 0) + Object.values(c.special || {}).reduce((x, y) => x + y, 0);
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
      How: {},
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
      ['Category', 'Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'How'].forEach(k => {
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
  const dataFull = useDataView().full;
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
  const [filterHow, setFilterHow] = useState('');
  const [filterBundle, setFilterBundle] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [filterPatch, setFilterPatch] = useState('');
  const patchGroups = useMemo(() => getPatchGroups(data), [data]);
  const patchCounts = useMemo(() => getPatchFilterCounts(data), [data]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const topRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const filtersChanged = useRef(false);
  const urlHydrated = useRef(false);
  const urlSyncing = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    urlSyncing.current = true;
    setSearchQuery(params.get('search') || '');
    setDebouncedSearch(params.get('search') || '');
    setSortType(params.get('sort') || 'ArrayIndexDesc');
    setFilterCategory(readArrayParam(params, 'category'));
    setFilterCohort(params.get('cohort') || '');
    setFilterPromo(params.get('promo') || '');
    setFilterStoreID(params.get('store') || '');
    setStoreOnly(readBoolParam(params, 'storeOnly'));
    setFilterStoreLabel(params.get('storeLabel') || '');
    setFilterPromoType(params.get('promoType') || '');
    setFilterBPSeason(params.get('battlePass') || '');
    setFilterEntitlement(readBoolParam(params, 'entitlement'));
    setFilterHow(params.get('how') || '');
    setFilterBundle(readBoolParam(params, 'bundle'));
    setFilterPatch(params.get('patch') || '');
    urlHydrated.current = true;
    window.setTimeout(() => {
      urlSyncing.current = false;
    }, 0);
  }, []);

  const helpers = useMemo(() => ({
    Category: e => e.emojiData?.Category ?? '',
    Cohort: e => uniq(normalizeStore(e).map(s => s.Cohort).filter(Boolean)),
    TimedPromotion: e => uniq(normalizeStore(e).map(s => s.TimedPromotion).filter(Boolean)),
    StoreID: e => uniq(normalizeStore(e).map(s => s.StoreID).filter(v => v !== undefined && v !== null && v !== '')),
    StoreLabel: e => uniq(normalizeStore(e).map(s => s.Label).filter(Boolean)),
    PromoType: e => e.promo?.Type ?? '',
    BPSeason: e => e.bp?.ID ?? '',
    Entitlement: e => !!e.entitlement,
    How: sourceFilterValues,
    Bundle: e => normalizeStore(e).some(s => s.Type === 'Bundle'),
    Patch: getAddedPatch
  }), []);

  const getDisplayNameKey = e => (normalizeStore(e)[0]?.DisplayNameKey) ?? e.emojiData?.DisplayNameKey ?? '';
  const gameNames = useGameNames();
  const emojiTitle = e => gameNames.emojis?.[e?.emojiData?.EmojiID] || langs.content?.[getDisplayNameKey(e)] || e?.emojiData?.EmojiName || '';
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
      How: filterHow,
      StoreOnly: storeOnly,
      Bundle: filterBundle,
      Patch: filterPatch
    },
    helpers
  );

  const exportColumns = useMemo(() => [
    { key: 'name', label: 'Emoji', value: emojiTitle },
    { key: 'category', label: 'Category', value: (emoji) => emoji.emojiData?.Category },
    { key: 'emojiId', label: 'Emoji ID', value: (emoji) => emoji.emojiData?.EmojiID },
    { key: 'codeName', label: 'Code name', value: (emoji) => emoji.emojiData?.EmojiName },
    ...storeExportColumns,
  ], [langs, gameNames]);
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const arr = data.filter(e => {
      if (filterPatch && !patchFilterMatches(getAddedPatch(e), filterPatch)) return false;
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
      if (filterHow && !sourceFilterValues(e).includes(filterHow)) return false;
      if (storeOnly && !normalizeStore(e).length) return false;
      if (filterBundle && !normalizeStore(e).some(s => s.Type === 'Bundle')) return false;
      const fields = [
        emojiTitle(e),
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
      const nameA = emojiTitle(a).toString();
      const nameB = emojiTitle(b).toString();
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
    filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterBundle, filterPatch, langs, gameNames
  ]);

  useEffect(() => {
    if (data.length === 0 || filtered.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const emojiId = params.get('emoji') ? String(params.get('emoji')) : null;
    let emoji = null;
    if (emojiId) emoji = filtered.find(e => String(e.emojiData?.EmojiID) === emojiId);
    setSelectedEmoji(emoji || null);
  }, [data, filtered, isMobile]);

  useEffect(() => {
    if (selectedEmoji && !filtered.some(e => e.emojiData?.EmojiID === selectedEmoji.emojiData?.EmojiID)) {
      setSelectedEmoji(null);
    }
  }, [filtered, isMobile, selectedEmoji]);

  useEffect(() => {
    if (!urlHydrated.current || urlSyncing.current) return;
    const currentParams = new URLSearchParams();
    currentParams.set('page', pageSlugForLabel('Emojis'));
    if (selectedEmoji) currentParams.set('emoji', String(selectedEmoji.emojiData?.EmojiID));
    writeStringParam(currentParams, 'search', searchQuery.trim());
    writeStringParam(currentParams, 'sort', sortType, 'ArrayIndexDesc');
    writeArrayParam(currentParams, 'category', filterCategory);
    writeStringParam(currentParams, 'cohort', filterCohort);
    writeStringParam(currentParams, 'promo', filterPromo);
    writeStringParam(currentParams, 'store', filterStoreID);
    writeBoolParam(currentParams, 'storeOnly', storeOnly);
    writeStringParam(currentParams, 'storeLabel', filterStoreLabel);
    writeStringParam(currentParams, 'promoType', filterPromoType);
    writeStringParam(currentParams, 'battlePass', filterBPSeason);
    writeBoolParam(currentParams, 'entitlement', filterEntitlement);
    writeStringParam(currentParams, 'how', filterHow);
    writeBoolParam(currentParams, 'bundle', filterBundle);
    writeStringParam(currentParams, 'patch', filterPatch);
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const emojiId = params.get('emoji') ? String(params.get('emoji')) : null;
      if (emojiId && filtered.length > 0) {
        const emoji = filtered.find(e => String(e.emojiData?.EmojiID) === emojiId);
        if (emoji) setSelectedEmoji(emoji);
        else setSelectedEmoji(null);
      } else setSelectedEmoji(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedEmoji, filtered, isMobile, searchQuery, sortType, filterCategory, filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterBundle, filterPatch]);

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
    setFilterHow('');
    setFilterPatch('');
    setFilterBundle(false);
    setSelectedEmoji(null); filtersChanged.current = true;
  }, [filtered, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedEmoji) return;
    const url = `${window.location.origin}${window.location.pathname}?emoji=${selectedEmoji.emojiData?.EmojiID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link copied');
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
    const sourced = hasSources(emoji);
    return (
      <div
        className={`flex h-full w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
        onClick={() => { setSelectedEmoji(emoji); filtersChanged.current = false; }}
      >
        <ImageWithLoader src={`${host}/game/animEmoji/${emoji.emojiData?.EmojiID}`} alt="" className="aspect-square w-full rounded-lg bg-slate-950/80" imgClassName="h-full w-full object-contain" />
        <span className="line-clamp-2 max-w-full break-words text-sm font-bold leading-tight text-white" title={emojiTitle(emoji)}>{emojiTitle(emoji)}</span>
        <AddedBadge item={emoji} className="max-w-full flex-wrap justify-center" />
        {sourced && <SourceLine sources={emoji.sources} phoneCompact className="max-w-full" />}
        {!sourced && emoji.bp && (
          <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(emoji.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
        )}
        {!sourced && storeData.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-white">
            {storeData.map((sd, idx) => (
              <div key={`costs-${idx}`} className="flex flex-wrap gap-2">
                {sd.Type === 'Bundle' ? (
                  <>
                    {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.mc || sd.Costs.mcSale}</span>
                        <span className="text-xs text-slate-400"> (Bundle)</span>
                      </div>
                    )}
                    {sd.Costs.gold > 0 && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.gold}</span>
                        <span className="text-xs text-slate-400"> (Bundle)</span>
                      </div>
                    )}
                    {sd.Costs.glory > 0 && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.glory}</span>
                        <span className="text-xs text-slate-400"> (Bundle)</span>
                      </div>
                    )}
                    {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                      <div key={`special-${sIdx}`}>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/UI_Currencies/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{cost}</span>
                        <span className="text-xs text-slate-400"> (Bundle)</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {sd.Costs.mc > 0 && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.mc}</span>
                      </div>
                    )}
                    {sd.Costs.gold > 0 && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.gold}</span>
                      </div>
                    )}
                    {sd.Costs.glory > 0 && (
                      <div>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{sd.Costs.glory}</span>
                      </div>
                    )}
                    {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                      <div key={`special-${sIdx}`}>
                        <img loading="lazy" decoding="async" src={`${host}/game/getGfx/UI_Currencies/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                        <span>{cost}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="w-full min-w-0 flex-1">
        <FilterPanel
          search={searchQuery}
          onSearch={(value) => handleFilterChange(setSearchQuery, value)}
          searchPlaceholder="Search Emojis"
          sort={sortType}
          onSort={setSortType}
          sortOptions={EMOJI_SORTS}
          shown={filtered.length}
          total={data.length}
          noun="emojis"
          tools={<ListTools filename="brawlhalla-emojis" rows={filtered} columns={exportColumns} />}
          activeCount={countFilters([filterCategory, filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterPatch, filterBundle])}
          onReset={resetFilters}
          chips={categories.some(cat => optionCounts.Category[cat] > 0) && categories
            .filter(cat => optionCounts.Category[cat] > 0)
            .map(cat => {
              const firstEmoji = getFirstEmojiForCategory(data, cat);
              if (!firstEmoji) return null;
              const selected = filterCategory.includes(cat);
              return (
                <IconChip
                  key={cat}
                  selected={selected}
                  onClick={() => handleFilterChange(setFilterCategory, selected ? filterCategory.filter(c => c !== cat) : [...filterCategory, cat])}
                  title={cat}
                  count={optionCounts.Category[cat] || 0}
                >
                  <ImageWithLoader src={`${host}/game/animEmoji/${firstEmoji.emojiData?.EmojiID}`} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" small onError={handleImgError} />
                </IconChip>
              );
            })}
          selects={<>
            {Object.values(optionCounts.How).some(count => count > 0) && (
              <FilterSelect label="How to get" value={filterHow} onChange={(value) => handleFilterChange(setFilterHow, value)}>
                {sortSourceFilterValues(Object.keys(optionCounts.How)).filter(n => optionCounts.How[n] > 0).map(n => <FilterOption key={n} value={n} count={optionCounts.How[n]} />)}
              </FilterSelect>
            )}
            {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
              <FilterSelect label="Battle Pass" value={filterBPSeason} onChange={(value) => handleFilterChange(setFilterBPSeason, value)}>
                {optionCounts.AllBP > 0 && <FilterOption value="AllBP" label="Any season" count={optionCounts.AllBP} />}
                {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => <FilterOption key={season} value={season} label={`Season ${String(season).replace(/^BP/, '')}`} count={optionCounts.BPSeason[season]} />)}
              </FilterSelect>
            )}
            {Object.values(optionCounts.TimedPromotion).some(count => count > 0) && (
              <FilterSelect label="Promotion" value={filterPromo} onChange={(value) => handleFilterChange(setFilterPromo, value)}>
                {promotions.filter(p => optionCounts.TimedPromotion[p] > 0).map(p => <FilterOption key={p} value={p} label={formatLabel(p)} count={optionCounts.TimedPromotion[p]} />)}
              </FilterSelect>
            )}
            {Object.values(optionCounts.StoreLabel).some(count => count > 0) && (
              <FilterSelect label="Store Label" value={filterStoreLabel} onChange={(value) => handleFilterChange(setFilterStoreLabel, value)}>
                {storeLabels.filter(n => optionCounts.StoreLabel[n] > 0).map(n => <FilterOption key={n} value={n} count={optionCounts.StoreLabel[n]} />)}
              </FilterSelect>
            )}
            {Object.values(optionCounts.PromoType).some(count => count > 0) && (
              <FilterSelect label="Promo code" value={filterPromoType} onChange={(value) => handleFilterChange(setFilterPromoType, value)}>
                {promoTypes.filter(n => optionCounts.PromoType[n] > 0).map(n => <FilterOption key={n} value={n} count={optionCounts.PromoType[n]} />)}
              </FilterSelect>
            )}
            {patchGroups.length > 0 && (
              <FilterSelect label="Patch" value={filterPatch} onChange={(value) => handleFilterChange(setFilterPatch, value)}>
                <PatchOptions groups={patchGroups} counts={patchCounts} />
              </FilterSelect>
            )}
            {(dataFull || filterCohort) && Object.values(optionCounts.Cohort).some(count => count > 0) && (
              <FilterSelect label="Store cohort" value={filterCohort} onChange={(value) => handleFilterChange(setFilterCohort, value)}>
                {cohorts.filter(c => optionCounts.Cohort[c] > 0).map(c => <FilterOption key={c} value={c} label={formatLabel(c)} count={optionCounts.Cohort[c]} />)}
              </FilterSelect>
            )}
          </>}
          toggles={<>
            <FilterToggle label="In the store" count={optionCounts.StoreOnly || 0} checked={storeOnly} onChange={(value) => handleFilterChange(setStoreOnly, value)} />
            <FilterToggle label="DLC" count={optionCounts.DLC || 0} checked={filterEntitlement} onChange={(value) => handleFilterChange(setFilterEntitlement, value)} />
            <FilterToggle label="In bundles" count={optionCounts.Bundle || 0} checked={!!filterBundle} onChange={(value) => handleFilterChange(setFilterBundle, value)} />
          </>}
        />
        <VirtualCardGrid
          items={filtered}
          empty={<NoMatches noun="emojis" onReset={resetFilters} />}
          minCard={DENSE_CARD}
          getKey={(emoji, index) => emoji?.emojiData?.EmojiID || index}
          renderItem={(emoji, index) => Row({ index, data: filtered })}
        />
      </div>
      <div className={`fixed inset-0 bg-black/70 z-[110] ${selectedEmoji ? 'flex items-stretch justify-center p-0 sm:items-center sm:p-3' : 'hidden'}`} onClick={() => setSelectedEmoji(null)}> 
        <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto overscroll-contain app-scrollbar rounded-none border p-2 shadow-2xl border-slate-700 bg-slate-950 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:p-3 lg:p-3" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Close details"
            className="absolute right-3 top-3 z-10 rounded-lg p-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setSelectedEmoji(null)}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-11">
            <PopupViewBar />
            {isMobile && selectedEmoji && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="cursor-pointer bg-blue-600 text-white font-bold py-1 px-3 rounded-lg">Copy Link</button>
                {copyFeedback && <span className="text-sm text-slate-300">{copyFeedback}</span>}
              </div>
            )}
          </div>
          {selectedEmoji ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
              <div className="xl:col-span-2 flex flex-col gap-2 pb-3 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <img loading="lazy" decoding="async"
                    src={`${host}/game/animEmoji/${selectedEmoji.emojiData?.EmojiID}`}
                    className="h-16 w-16 object-contain"
                    onError={handleImgError}
                    alt=""
                  />
                  <span className="text-xl font-bold text-white sm:text-2xl">
                    {emojiTitle(selectedEmoji)}
                  </span>
                </div>
                {langs.content?.[getDescriptionKey(selectedEmoji)] && (
                  <div className="max-w-prose text-slate-300 text-sm">
                    {langs.content[getDescriptionKey(selectedEmoji)]}
                  </div>
                )}
                {dataFull && Array.isArray(selectedEmoji.store) && selectedEmoji.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col">
                    <span className="text-white">Store Search Tags</span>
                    <div className="mt-1 flex max-w-full flex-wrap gap-2 pb-1">
                      {[...new Set(selectedEmoji.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-slate-800 rounded-full px-3 py-1 text-xs font-bold text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex max-w-full flex-wrap gap-2 pb-1">
                  {selectedEmoji.promo && !hasSources(selectedEmoji) && (
                    <span className="text-sm px-3 py-1 rounded-lg border border-purple-300/40 bg-purple-500/20 text-purple-100">Promo Type: {selectedEmoji.promo.Type}</span>
                  )}
                  {selectedEmoji.bp && !hasSources(selectedEmoji) && (
                    <span className="text-sm px-3 py-1 rounded-lg border border-emerald-300/40 bg-emerald-500/20 text-emerald-100">
                      Battle Pass Season {String(selectedEmoji.bp.ID).replace('BP', '').replace('-', ' ')}{selectedEmoji.bp.Tier ? ` (Tier ${selectedEmoji.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedEmoji.entitlement && !hasSources(selectedEmoji) && (
                    <span className="text-sm px-3 py-1 rounded-lg border border-amber-300/40 bg-amber-500/20 text-amber-100">
                      {(langs.content?.[selectedEmoji.entitlement.DisplayNameKey]?.replace('!', '') || selectedEmoji.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedEmoji.store?.length > 0 && [...new Set(selectedEmoji.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'Last Chance' : label}
                    </span>
                  ))}
                  {selectedEmoji.store?.length > 0 && [...new Set(selectedEmoji.store.map(s => s.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                    <span key={idx} className="text-sm px-3 py-1 rounded-lg border border-rose-300/40 bg-rose-500/20 text-rose-100">{formatLabel(promo)}</span>
                  ))}
                </div>
              </div>
              <div className="contents">
                <div className="xl:col-start-2 xl:row-start-2 w-full flex flex-col gap-2">
                  <StoreDataSection rows={selectedEmoji.store} langs={langs} sources={selectedEmoji.sources} />
                  <FieldGrid data={selectedEmoji.emojiData} langs={langs} title="Emoji Data" />
                  <FieldGrid data={selectedEmoji.entitlement} langs={langs} title="Entitlement Data" />
                  {false && <div className="relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                    <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Emoji Data</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Emoji Name</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.emojiData?.EmojiName}</span>
                      </div>
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Emoji ID</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.emojiData?.EmojiID}</span>
                      </div>
                      {selectedEmoji.emojiData?.Category && (
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Category</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.emojiData?.Category}</span>
                        </div>
                      )}
                      {selectedEmoji.emojiData?.DefaultUnlocked && (
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Default Unlocked</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{String(selectedEmoji.emojiData?.DefaultUnlocked)}</span>
                        </div>
                      )}
                    </div>
                  </div>}
                  {false && getProcessedStoreData(selectedEmoji).map((sd, idx) => (
                    <div key={`store-${idx}`} className="relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                      <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Store data{sd.Type === 'Bundle' ? ' (Bundle)' : ''}</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Store Name</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreName}</span>
                        </div>
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Store ID</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreID}</span>
                        </div>
                        {sd.ItemList && sd.ItemList.length > 0 ? (
                          <div className='flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2'>
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Bundle price</span>
                            <div className="flex items-center gap-1">
                              <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                              <span className="line-through text-red-400">{
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
                              <span className="text-green-400 font-bold">{Math.floor((sd.ItemList.map((item, itemIdx) => {
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
                          <div className='col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3'>
                            {(sd.IdolCost != 0 && sd.IdolCost != '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Coin price</span>
                                <div>
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.IdolCost}</span>
                                </div>
                              </div>
                            )}
                            {sd.IdolSaleCost && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Coin sale price</span>
                                <div className="flex items-center gap-1">
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                  <span className="line-through text-red-400">{sd.IdolCost}</span>
                                  <span className="text-green-400 font-bold">{sd.IdolSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {sd.GoldCost && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold price</span>
                                <div>
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.GoldCost}</span>
                                </div>
                              </div>
                            )}
                            {sd.GoldSaleCost && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Sale Price</span>
                                <div className="flex items-center gap-1">
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} />
                                  <span className="line-through text-red-400">{sd.GoldCost}</span>
                                  <span className="text-green-400 font-bold">{sd.GoldSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {sd.GoldBundleDiscount && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Bundle Discount</span>
                                <div>
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.GoldBundleDiscount}</span>
                                </div>
                              </div>
                            )}
                            {sd.RankedPointsCost && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Glory price</span>
                                <div>
                                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.RankedPointsCost}</span>
                                </div>
                              </div>
                            )}
                            {sd.SpecialCurrencyType && sd.SpecialCurrencyCost && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">{sd.SpecialCurrencyType} Cost</span>
                                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.SpecialCurrencyCost}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {sd.Cohort && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Cohort</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Cohort}</span>
                          </div>
                        )}
                        {sd.Popularity && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Popularity</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Popularity}</span>
                          </div>
                        )}
                        {sd.Label && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Label</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Label === 'LastChance' ? 'Last Chance' : sd.Label}</span>
                          </div>
                        )}
                        {sd.TimedPromotion && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Timed Promotion</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{formatLabel(sd.TimedPromotion)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {false && selectedEmoji.entitlement && (
                    <div className='relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm'>
                      <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Entitlement Data</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement Name</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.EntitlementName}</span>
                        </div>
                        {selectedEmoji.entitlement.EntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.EntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SteamAppID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Steam App ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.SteamAppID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SonyEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.SonyEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.SonyProductID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Product ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.SonyProductID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.NintendoConsumableID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Consumable ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.NintendoConsumableID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.NintendoEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.NintendoEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1EntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.XB1EntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1ProductID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Product ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.XB1ProductID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.XB1StoreID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Store ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.XB1StoreID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.AppleEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Apple Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.AppleEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.AndroidEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Android Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.AndroidEntitlementID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.UbiConnectID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.UbiConnectID}</span>
                          </div>
                        )}
                        {selectedEmoji.entitlement.UbiConnectPackageID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect Package ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedEmoji.entitlement.UbiConnectPackageID}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="xl:col-start-1 xl:row-start-2 w-full flex flex-col gap-2 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                  <span className="text-base text-white sm:text-lg">Image Data</span>
                  <div className="mt-2 flex justify-center rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                    <img loading="lazy" decoding="async"
                      src={`${host}/game/animEmoji/${selectedEmoji.emojiData?.EmojiID}`}
                      className="max-w-64 h-auto"
                      onError={handleImgError}
                      alt=""
                    />
                  </div>
                </div>
              </div>
              <RawDataDetails data={selectedEmoji} filename={`emojis-${selectedEmoji?.emojiData?.EmojiID || 'item'}`} />
            </div>
          ) : (
            <div className="text-center text-slate-300 italic">Pick an emoji</div>
          )}
          {selectedEmoji && <PopupFullDataFooter />}
        </div>
      </div>
    </div>
  );
}
