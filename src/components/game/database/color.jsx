import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useMediaQuery } from 'react-responsive';
import { AddedBadge, ImageWithLoader, RawDataDetails, getAddedPatch, getPatchFilterCounts, getPatchGroups, patchFilterMatches, PatchOptions } from './comp/LoadingImage';
import { ListTools, SourceLine, hasSources, sortSourceFilterValues, sourceFilterValues, useDataView } from '../../ui';
import { DENSE_CARD, VirtualCardGrid } from './comp/VirtualCardGrid';
import { FilterOption, FilterPanel, FilterSelect, FilterToggle, IconChip, NoMatches, countFilters } from './comp/FilterPanel';
import { pageSlugForLabel, readBoolParam, writeBoolParam, writeStringParam } from './comp/urlQuery';
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
const COLOR_SORTS = [
  { value: 'OrderIDDesc', label: 'Game order, last first' },
  { value: 'OrderIDAsc', label: 'Game order' },
  { value: 'AlphaAsc', label: 'Name, A to Z' },
  { value: 'AlphaDesc', label: 'Name, Z to A' },
  { value: 'CostDesc', label: 'Mammoth Coins, high to low' },
  { value: 'CostAsc', label: 'Mammoth Coins, low to high' },
  { value: 'ColorSchemeIDDesc', label: 'Color ID, high to low' },
  { value: 'ColorSchemeIDAsc', label: 'Color ID, low to high' },
  { value: 'StoreIDDesc', label: 'Store ID, high to low' },
  { value: 'StoreIDAsc', label: 'Store ID, low to high' },
];

function formatLabel(s) { return s ? String(s).replace(/([a-z])([A-Z])/g, '$1 $2') : ''; }
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
      ['Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'How'].forEach(k => {
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
export function ColorSchemeStoreView({ colors, skins = [], langs }) {
  const data = useMemo(
    () => (Array.isArray(colors) ? colors : []).map(c => ({ ...c, store: normalizeStore(c) })),
    [colors]
  );
  const previewSkins = useMemo(
    () => (Array.isArray(skins) ? skins : []).filter((skin) =>
      skin?.costumeData?.OwnerHero !== 'DEFAULT_CHARACTER'
      && skin?.HeroName !== 'DEFAULT_CHARACTER'
      && skin?.HeroID != null
      && skin?.SkinInt != null
      && (skin?.animTypes?.selectedOther || skin?.animTypes?.selected)
    ),
    [skins]
  );
  const previewSkinByColor = useMemo(() => {
    if (!previewSkins.length) return new Map();
    return new Map(data.map((color) => [
      String(color.colorData?.ColorSchemeID),
      previewSkins[Math.floor(Math.random() * previewSkins.length)],
    ]));
  }, [data, previewSkins]);
  const [selectedColor, setSelectedColor] = useState(null);
  const dataFull = useDataView().full;
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
  const [filterHow, setFilterHow] = useState('');
  const [filterPatch, setFilterPatch] = useState('');
  const patchGroups = useMemo(() => getPatchGroups(data), [data]);
  const patchCounts = useMemo(() => getPatchFilterCounts(data), [data]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
    setSortType(params.get('sort') || 'OrderIDDesc');
    setFilterCohort(params.get('cohort') || '');
    setFilterPromo(params.get('promo') || '');
    setFilterStoreID(params.get('store') || '');
    setStoreOnly(readBoolParam(params, 'storeOnly'));
    setFilterStoreLabel(params.get('storeLabel') || '');
    setFilterPromoType(params.get('promoType') || '');
    setFilterBPSeason(params.get('battlePass') || '');
    setFilterEntitlement(readBoolParam(params, 'entitlement'));
    setFilterHow(params.get('how') || '');
    setFilterPatch(params.get('patch') || '');
    urlHydrated.current = true;
    window.setTimeout(() => {
      urlSyncing.current = false;
    }, 0);
  }, []);
  const helpers = useMemo(() => ({
    Cohort: e => uniq(normalizeStore(e).map(s => s.Cohort).filter(Boolean)),
    TimedPromotion: e => uniq(normalizeStore(e).map(s => s.TimedPromotion).filter(Boolean)),
    StoreID: e => uniq(normalizeStore(e).map(s => s.StoreID).filter(v => v !== undefined && v !== null && v !== '')),
    StoreLabel: e => uniq(normalizeStore(e).map(s => s.Label).filter(Boolean)),
    PromoType: e => e.promo?.Type ?? '',
    BPSeason: e => e.bp?.ID ?? '',
    Entitlement: e => !!e.entitlement,
    How: sourceFilterValues,
    Patch: getAddedPatch
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
      How: filterHow,
      StoreOnly: storeOnly,
      Patch: filterPatch
    },
    helpers
  );
  const exportColumns = useMemo(() => [
    { key: 'name', label: 'Color', value: (color) => langs.content[color.colorData?.DisplayNameKey] || color.colorData?.ColorSchemeName },
    { key: 'colorSchemeId', label: 'Color ID', value: (color) => color.colorData?.ColorSchemeID },
    { key: 'codeName', label: 'Code name', value: (color) => color.colorData?.ColorSchemeName },
    { key: 'orderId', label: 'Order ID', value: (color) => color.colorData?.OrderID },
    ...storeExportColumns,
  ], [langs]);
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const arr = data.filter(e => {
      if (filterPatch && !patchFilterMatches(getAddedPatch(e), filterPatch)) return false;
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
    filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterPatch, langs
  ]);
  useEffect(() => {
    if (data.length === 0 || filtered.length === 0) return;
    if (isMobile && filtersChanged.current) { filtersChanged.current = false; return; }
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('color') ? String(params.get('color')) : null;
    let item = null;
    if (idParam) item = filtered.find(e => String(e.colorData?.ColorSchemeID) === idParam);
    setSelectedColor(item || null);
  }, [data, filtered, isMobile]);
  useEffect(() => {
    if (selectedColor && !filtered.some(e => e.colorData?.ColorSchemeID === selectedColor.colorData?.ColorSchemeID)) {
      setSelectedColor(null);
    }
  }, [filtered, isMobile, selectedColor]);
  useEffect(() => {
    if (!urlHydrated.current || urlSyncing.current) return;
    const currentParams = new URLSearchParams();
    currentParams.set('page', pageSlugForLabel('Colors'));
    if (selectedColor) currentParams.set('color', String(selectedColor.colorData?.ColorSchemeID));
    writeStringParam(currentParams, 'search', searchQuery.trim());
    writeStringParam(currentParams, 'sort', sortType, 'OrderIDDesc');
    writeStringParam(currentParams, 'cohort', filterCohort);
    writeStringParam(currentParams, 'promo', filterPromo);
    writeStringParam(currentParams, 'store', filterStoreID);
    writeBoolParam(currentParams, 'storeOnly', storeOnly);
    writeStringParam(currentParams, 'storeLabel', filterStoreLabel);
    writeStringParam(currentParams, 'promoType', filterPromoType);
    writeStringParam(currentParams, 'battlePass', filterBPSeason);
    writeBoolParam(currentParams, 'entitlement', filterEntitlement);
    writeStringParam(currentParams, 'how', filterHow);
    writeStringParam(currentParams, 'patch', filterPatch);
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('color') ? String(params.get('color')) : null;
      if (idParam && filtered.length > 0) {
        const item = filtered.find(e => String(e.colorData?.ColorSchemeID) === idParam);
        if (item) setSelectedColor(item);
        else setSelectedColor(null);
      } else setSelectedColor(null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedColor, filtered, isMobile, searchQuery, sortType, filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterPatch]);
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
    setFilterHow('');
    setFilterPatch('');
    setSelectedColor(null); filtersChanged.current = true;
  }, [filtered, isMobile]);
  const handleCopyLink = useCallback(() => {
    if (!selectedColor) return;
    const url = `${window.location.origin}${window.location.pathname}?color=${selectedColor.colorData?.ColorSchemeID}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, [selectedColor]);
  const handleImgError = e => { e.currentTarget.style.display = 'none'; };
  const Row = ({ index, data }) => {
    const item = data[index];
    const previewSkin = previewSkinByColor.get(String(item.colorData?.ColorSchemeID)) || null;
    const previewAnim = previewSkin?.animTypes?.selectedOther || previewSkin?.animTypes?.selected;
    const previewSrc = previewSkin && previewAnim
      ? `${host}/game/anim/char/${previewSkin.HeroID}-${previewSkin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${previewAnim}/loop/${item.colorData?.ColorSchemeID || 0}`
      : null;
    const storeData = getProcessedStoreData(item);
    const isSelected = selectedColor?.colorData?.ColorSchemeID === item.colorData?.ColorSchemeID;
    const bgHex = (item.colorData?.IndicatorColor || '0x000000').slice(2);
    const bgColor = `#${bgHex}`;
    const r = parseInt(bgColor.substr(1, 2), 16);
    const g = parseInt(bgColor.substr(3, 2), 16);
    const b = parseInt(bgColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    const textColor = luminance > 128 ? '#000000' : '#ffffff';
    const badgeStyle = {
      color: textColor,
      backgroundColor: luminance > 128 ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.18)',
      boxShadow: luminance > 128 ? '0 0 0 1px rgba(0, 0, 0, 0.18)' : '0 0 0 1px rgba(255, 255, 255, 0.25)',
    };
    const sourced = hasSources(item);
    const name = langs.content?.[getDisplayNameKey(item)] || item.colorData?.ColorSchemeName;
    return (
      <div
        className={`flex h-full w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-slate-700 p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:brightness-125 ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
        style={{ backgroundColor: bgColor, color: textColor }}
        onClick={() => { setSelectedColor(item); filtersChanged.current = false; }}
      >
        {previewSrc && (
          <ImageWithLoader
            src={previewSrc}
            alt=""
            className="aspect-square w-full rounded-lg bg-slate-950/80"
            imgClassName="h-full w-full object-contain"
          />
        )}
        <div className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-slate-950/80 px-1.5 py-1 text-xs font-bold leading-tight text-white sm:justify-start sm:text-left sm:text-sm">
          <ImageWithLoader
            src={`${host}/game/getGfx/UI_Icons/${item.colorData?.IconName}`}
            alt=""
            className="hidden h-7 w-7 shrink-0 bg-transparent sm:flex"
            imgClassName="h-full w-full object-contain"
            small
          />
          <span className="line-clamp-2 min-w-0 break-words" title={name}>{name}</span>
        </div>
        <AddedBadge item={item} style={badgeStyle} showDate={!isMobile} className="max-w-full flex-wrap justify-center" />
        {sourced && <SourceLine sources={item.sources} phoneCompact className="max-w-full" />}
        {!sourced && item.bp && (
          <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-lg">{`Battle Pass Season ${String(item.bp.ID).replace('BP', '').replace('-', ' ')}`}</div>
        )}
        {!sourced && storeData.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 text-sm">
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
                    <img src={`${host}/game/getGfx/UI_Currencies/a_Currency_${currencyType}`} className="inline h-4 mr-1" onError={handleImgError} loading="lazy" />
                    <span>{cost}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="flex flex-col lg:flex-row" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div className="w-full min-w-0 flex-1">
        <FilterPanel
          search={searchQuery}
          onSearch={(value) => handleFilterChange(setSearchQuery, value)}
          searchPlaceholder="Search Colors"
          sort={sortType}
          onSort={setSortType}
          sortOptions={COLOR_SORTS}
          shown={filtered.length}
          total={data.length}
          noun="colors"
          tools={<div className="flex flex-wrap items-center gap-2"><ListTools filename="brawlhalla-colors" rows={filtered} columns={exportColumns} /><a href="/game/colors" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-blue-500">Open the color creator</a></div>}
          activeCount={countFilters([filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterBPSeason, filterEntitlement, filterHow, filterPatch])}
          onReset={resetFilters}
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
          </>}
        />
        <VirtualCardGrid
          items={filtered}
          empty={<NoMatches noun="colors" onReset={resetFilters} />}
          minCard={DENSE_CARD}
          getKey={(item, index) => item?.colorData?.ColorSchemeID || index}
          renderItem={(item, index) => Row({ index, data: filtered })}
        />
      </div>
      <div className={`fixed inset-0 bg-black/70 z-[110] ${selectedColor ? 'flex items-stretch justify-center p-0 sm:items-center sm:p-3' : 'hidden'}`} onClick={() => setSelectedColor(null)}> 
        <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto overscroll-contain app-scrollbar rounded-none border p-2 shadow-2xl border-slate-700 bg-slate-950 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:p-3 lg:p-3" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Close details"
            className="absolute right-3 top-3 z-10 rounded-lg p-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setSelectedColor(null)}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-11">
            <PopupViewBar />
            {isMobile && selectedColor && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleCopyLink} className="cursor-pointer bg-blue-600 text-white font-bold py-1 px-3 rounded-lg">Copy Link</button>
              </div>
            )}
          </div>
          {selectedColor ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
              <div
                className="xl:col-span-2 flex flex-col gap-2 pb-3 p-2 rounded-lg"
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
                  <span className="text-xl font-bold sm:text-2xl">
                    {langs.content?.[getDisplayNameKey(selectedColor)] || selectedColor.colorData?.ColorSchemeName}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  {langs.content?.[getDescriptionKey(selectedColor)] && (
                    <div className="max-w-prose">{langs.content[getDescriptionKey(selectedColor)]}</div>
                  )}
                </div>
                <div className="flex max-w-full flex-wrap gap-2 pb-1">
                  {selectedColor.promo && !hasSources(selectedColor) && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-purple-500/80">Promo Type: {selectedColor.promo.Type}</span>
                  )}
                  {selectedColor.bp && !hasSources(selectedColor) && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500/80">
                      Battle Pass Season {String(selectedColor.bp.ID).replace('BP', '').replace('-', '')}{selectedColor.bp.Tier ? ` (Tier ${selectedColor.bp.Tier})` : ''}
                    </span>
                  )}
                  {selectedColor.entitlement && !hasSources(selectedColor) && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-amber-500/80">
                      {(langs.content?.[selectedColor.entitlement.DisplayNameKey]?.replace('!', '') || selectedColor.entitlement.EntitlementName) + ' DLC'}
                    </span>
                  )}
                  {selectedColor.store?.length > 0 && [...new Set(selectedColor.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                    <span key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-sm px-3 py-1 rounded-lg`}>
                      {label === 'LastChance' ? 'Last Chance' : label}
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
              <div className="contents">
                <div className="xl:col-start-2 xl:row-start-2 w-full flex flex-col gap-2">
                  {selectedColor.colorData?.ExcludeOpponentTeamColor && (
                    <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                      <span className="text-lg text-white sm:text-2xl">Opponent Color Exclusions</span>
                      <div className="flex items-center text-sm text-slate-300 rounded-lg bg-slate-950 border border-slate-700 p-2">
                        <span>
                          An opponent using one of these colors while you use{' '}
                          <span className="inline-flex gap-2">
                            <span className="font-bold text-white">
                              {langs.content[selectedColor.colorData.DisplayNameKey] || selectedColor.colorData.ColorSchemeName}
                            </span>
                          </span>
                          {' '}gets the fallback color below.
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 rounded-lg bg-slate-950 border border-slate-700 p-2">
                        <span className="text-base text-slate-200 sm:text-lg">Fallback Color</span>
                        <div className="flex items-center gap-2 rounded-lg bg-slate-900 p-2">
                          <img
                            src={`${host}/game/getGfx/UI_Icons/${(colors.find(r => r.colorData.ColorSchemeName == selectedColor.colorData.FallbackOpponentTeamColor) || {}).colorData?.IconName}`}
                            className="h-7"
                            loading="lazy"
                          />
                          <span className="text-base font-bold text-white sm:text-lg">
                            {(() => {
                              const cd = colors.find(r => r.colorData.ColorSchemeName == selectedColor.colorData.FallbackOpponentTeamColor);
                              if (!cd) return selectedColor.colorData.FallbackOpponentTeamColor;
                              return langs.content[getDisplayNameKey(cd)] || cd.colorData.ColorSchemeName;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950 border border-slate-700 p-2">
                        <span className="text-base text-slate-200 sm:text-lg">Color List</span>
                        <div className="col-span-2 flex flex-wrap gap-2 mt-2">
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
                              <div key={idx} className="flex items-center gap-2 rounded-lg p-2 border border-white/10 shadow-sm" style={{ backgroundColor: bg, color: tc }}>
                                <img src={`${host}/game/getGfx/UI_Icons/${colorData.colorData.IconName}`} className="h-6" loading="lazy" />
                                <span className="text-base font-bold sm:text-lg">{langs.content[getDisplayNameKey(colorData)] || colorData.colorData.ColorSchemeName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  <StoreDataSection rows={selectedColor.store} langs={langs} sources={selectedColor.sources} />
                  <FieldGrid
                    data={selectedColor.colorData}
                    langs={langs}
                    title="Color Scheme Data"
                    exclude={[
                      'ColorSchemeName',
                      'DisplayNameKey',
                      'IconName',
                      'IconFileName',
                      'IndicatorColor',
                      'ExcludeOpponentTeamColor',
                      'FallbackOpponentTeamColor',
                      ...Object.keys(selectedColor.colorData || {}).filter((key) => key.endsWith('_Swap')),
                    ]}
                  />
                  <FieldGrid data={selectedColor.entitlement} langs={langs} title="Entitlement Data" />
                  {false && <div className="relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                    <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Color Scheme Data</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Name</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedColor.colorData?.ColorSchemeName}</span>
                      </div>
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">ID</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedColor.colorData?.ColorSchemeID}</span>
                      </div>
                      {selectedColor.colorData?.IconName && (
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Icon</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedColor.colorData?.IconName}</span>
                        </div>
                      )}
                      {selectedColor.colorData?.IndicatorColor && (
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Indicator</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="rounded-lg w-8 h-8 border border-slate-700"
                              style={{ backgroundColor: `#${selectedColor.colorData.IndicatorColor.slice(2)}` }}
                            />
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{`#${selectedColor.colorData.IndicatorColor.slice(2)}`}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Order ID</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{getOrderID(selectedColor)}</span>
                      </div>
                    </div>
                  </div>}
                  {false && getProcessedStoreData(selectedColor).map((sd, idx) => (
                    <div key={`store-${idx}`} className="relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                      <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Store data{sd.Type === 'Bundle' ? ' (Bundle)' : ''}</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {sd.StoreName && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Store Name</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreName}</span>
                          </div>
                        )}
                        {(sd.StoreID !== undefined && sd.StoreID !== null && sd.StoreID !== '') && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Store ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreID}</span>
                          </div>
                        )}
                        {sd.Item && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Item</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Item}</span>
                          </div>
                        )}
                        {sd.Type && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Type</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Type}</span>
                          </div>
                        )}
                        {sd.Label && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Store Label</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Label === 'LastChance' ? 'Last Chance' : sd.Label}</span>
                          </div>
                        )}
                        {sd.TimedPromotion && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Timed Promotion</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{formatLabel(sd.TimedPromotion)}</span>
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
                        {sd.SearchTags && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2 col-span-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Search Tags</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.SearchTags}</span>
                          </div>
                        )}
                        {sd.ItemList && sd.ItemList.length > 0 ? (
                          <div className="col-span-2">
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Bundle price</span>
                              <div className="flex flex-wrap items-center gap-3">
                                {(sd.Costs.mc > 0 || sd.Costs.mcSale > 0) && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    {sd.Costs.mcSale > 0 ? (
                                      <>
                                        <span className="line-through text-red-400">{sd.Costs.mc}</span>
                                        <span className="text-green-400 font-bold">{sd.Costs.mcSale}</span>
                                      </>
                                    ) : (
                                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Costs.mc}</span>
                                    )}
                                  </div>
                                )}
                                {(sd.Costs.gold > 0 || sd.Costs.goldSale > 0) && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    {sd.Costs.goldSale > 0 ? (
                                      <>
                                        <span className="line-through text-red-400">{sd.Costs.gold}</span>
                                        <span className="text-green-400 font-bold">{sd.Costs.goldSale}</span>
                                      </>
                                    ) : (
                                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Costs.gold}</span>
                                    )}
                                  </div>
                                )}
                                {sd.Costs.glory > 0 && (
                                  <div className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Costs.glory}</span>
                                  </div>
                                )}
                                {Object.entries(sd.Costs.special).map(([currencyType, cost]) => cost > 0 && (
                                  <div key={`sp-bundle-${currencyType}`} className="flex items-center gap-1">
                                    <img src={`${host}/game/getGfx/UI_Currencies/a_Currency_${currencyType}`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                    <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{cost}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(sd.IdolCost && sd.IdolCost !== 0 && sd.IdolCost !== '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Coin price</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.IdolCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.IdolSaleCost && sd.IdolSaleCost !== 0 && sd.IdolSaleCost !== '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Coin sale price</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                  <span className="line-through text-red-400">{sd.IdolCost}</span>
                                  <span className="text-green-400 font-bold">{sd.IdolSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.GoldCost && sd.GoldCost !== 0 && sd.GoldCost !== '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold price</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.GoldCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.GoldSaleCost && sd.GoldSaleCost !== 0 && sd.GoldSaleCost !== '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Sale Price</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} loading="lazy" />
                                  <span className="line-through text-red-400">{sd.GoldCost}</span>
                                  <span className="text-green-400 font-bold">{sd.GoldSaleCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.RankedPointsCost && sd.RankedPointsCost !== 0 && sd.RankedPointsCost !== '') && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Glory price</span>
                                <div>
                                  <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.RankedPointsCost}</span>
                                </div>
                              </div>
                            )}
                            {(sd.SpecialCurrencyType && sd.SpecialCurrencyCost) && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">{sd.SpecialCurrencyType} Cost</span>
                                <div>
                                  <img src={`${host}/game/getGfx/UI_Currencies/a_Currency_${sd.SpecialCurrencyType}`} className="h-5 pr-1 inline" onError={handleImgError} loading="lazy" />
                                  <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.SpecialCurrencyCost}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="xl:col-start-1 xl:row-start-2 w-full flex flex-col gap-2  rounded-lg">
                  <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                    <span className="text-lg text-white sm:text-2xl">Color Details</span>
                    <div className="flex flex-col text-sm gap-3">
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
                        <div key={category} className="rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <div className="flex flex-col gap-3">
                            <span className="text-sm font-bold uppercase tracking-wide text-blue-200">{category}</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2 mt-2">
                              {items.map(({ label, key }) => {
                                const hexColor = selectedColor.colorData?.[key];
                                if (!hexColor || hexColor.length < 8) return null;
                                const r = parseInt(hexColor.substr(2, 2), 16);
                                const g = parseInt(hexColor.substr(4, 2), 16);
                                const b = parseInt(hexColor.substr(6, 2), 16);
                                const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                                const tc = luminance > 128 ? '#000000' : '#ffffff';
                                return (
                                  <div key={key} className="flex flex-col p-3 rounded-2xl border border-white/10 shadow-sm" style={{ backgroundColor: `#${hexColor.substr(2)}`, color: tc }}>
                                    <span className="text-sm font-bold sm:text-base">{category} {label}</span>
                                    <code className="break-all text-sm font-bold sm:text-lg">{hexColor}</code>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {Array.isArray(selectedColor.levelExclusion) && selectedColor.levelExclusion.length > 0 && (
                    <div className="flex flex-col gap-3 mt-2 rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                      <span className="text-lg text-white sm:text-2xl">Map exclusions</span>
                      <div className="flex items-center text-sm text-slate-300 rounded-lg bg-slate-950 border border-slate-700 p-2">
                        <span>
                          These maps exclude{' '}
                          <span className="font-bold text-white">
                            {langs.content[selectedColor.colorData.DisplayNameKey] || selectedColor.colorData.ColorSchemeName}
                          </span>
                          .
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 items-stretch gap-2 text-center text-sm sm:text-lg md:grid-cols-3">
                        {selectedColor.levelExclusion.map((exclusion, idx) => (
                          <div key={idx} className="flex flex-col bg-slate-950 border border-slate-700 p-2 rounded-2xl h-full items-center">
                            <span className="text-white flex-grow flex items-center">{exclusion.DisplayName}</span>
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
              <RawDataDetails data={selectedColor} filename={`colors-${selectedColor?.colorData?.ColorSchemeID || 'item'}`} />
            </div>
          ) : (
            <div className="text-center text-slate-300 italic">Pick a color scheme</div>
          )}
          {selectedColor && <PopupFullDataFooter />}
        </div>
      </div>
    </div>
  );
}
