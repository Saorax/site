import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useMediaQuery } from 'react-responsive';
import { AddedBadge, ImageWithLoader, RawDataDetails, getAddedPatch, getPatchFilterCounts, getPatchGroups, patchFilterMatches, PatchOptions } from './comp/LoadingImage';
import { ChainPill, ChainStages, ListTools, SourceLine, groupChains, hasSources, sortSourceFilterValues, sourceFilterValues, useChainLookup, useDataView } from '../../ui';
import { VirtualCardGrid } from './comp/VirtualCardGrid';
import { FilterOption, FilterPanel, FilterSelect, FilterToggle, IconChip, NoMatches, countFilters } from './comp/FilterPanel';
import { bundleMammothPrice } from './comp/prices';
import { pageSlugForLabel, readArrayParam, readBoolParam, writeArrayParam, writeBoolParam, writeStringParam } from './comp/urlQuery';
import { FieldGrid, PopupFullDataFooter, PopupViewBar, StoreDataSection, chainExportColumn, storeExportColumns } from './metadata';

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
    if (Array.isArray(val)) {
      values.push(...val.filter(Boolean));
    } else if (val !== undefined && val !== null) {
      values.push(val);
    }
  });
  return [...new Set(values)];
}

const SKIN_SORTS = [
  { value: 'ArrayIndexDesc', label: 'Newest First' },
  { value: 'ArrayIndexAsc', label: 'Oldest first' },
  { value: 'AlphaAsc', label: 'Name, A to Z' },
  { value: 'AlphaDesc', label: 'Name, Z to A' },
  { value: 'CostDesc', label: 'Mammoth Coins, high to low' },
  { value: 'CostAsc', label: 'Mammoth Coins, low to high' },
  { value: 'HeroIDAsc', label: 'Legend, first to last' },
  { value: 'HeroIDDesc', label: 'Legend, last to first' },
  { value: 'CostumeIDDesc', label: 'Costume ID, high to low' },
  { value: 'CostumeIDAsc', label: 'Costume ID, low to high' },
  { value: 'StoreIDDesc', label: 'Store ID, high to low' },
  { value: 'StoreIDAsc', label: 'Store ID, low to high' },
];

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

function useOptionCounts(skins, filters, helpers) {
  return useMemo(() => {
    const counts = {
      HeroID: {},
      Cohort: {},
      TimedPromotion: {},
      Rarity: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      ChestName: {},
      CostumeIndex: {},
      BPSeason: {},
      Entitlement: {},
      How: {},
      AllChests: 0,
      AllChestExclusives: 0,
      AllBP: 0,
      StoreOnly: 0,
      DLC: 0,
      Upgrades: 0,
    };

    const applyFilters = (skin, excludeKey) => {
      for (const [key, filterVal] of Object.entries(filters)) {
        if (key === excludeKey) continue;
        if (key === 'ChestName' && filterVal) {
          if (filterVal === 'AllChests') {
            if (!skin.chest) return false;
          } else if (filterVal === 'AllChestExclusives') {
            if (!(skin.chest && Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0))) return false;
          } else {
            if (helpers.ChestName(skin) !== filterVal) return false;
          }
        } else if (key === 'BPSeason' && filterVal) {
          if (filterVal === 'AllBP') {
            if (!skin.bp) return false;
          } else {
            if (helpers.BPSeason(skin) !== filterVal) return false;
          }
        } else if (key === 'StoreOnly' && filterVal) {
          if (!Array.isArray(skin.store) || skin.store.length === 0) return false;
        } else if (key === 'Entitlement' && filterVal) {
          if (!skin.entitlement) return false;
        } else if (key === 'Upgrades') {
          if (filterVal && !helpers.Chain(skin)) return false;
        } else if (key === 'How') {
          if (filterVal && !helpers.How(skin).includes(filterVal)) return false;
        } else if (Array.isArray(filterVal) && filterVal.length && !filterVal.includes(helpers[key](skin))) {
          return false;
        } else if (!Array.isArray(filterVal) && filterVal && helpers[key](skin) !== filterVal) {
          return false;
        }
      }
      return true;
    };

    skins.forEach(skin => {
      const passesAll = applyFilters(skin, null);
      if (passesAll) {
        counts.AllChests += skin.chest ? 1 : 0;
        counts.AllChestExclusives += (skin.chest && Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0)) ? 1 : 0;
        counts.AllBP += skin.bp ? 1 : 0;
        counts.StoreOnly += (Array.isArray(skin.store) && skin.store.length > 0) ? 1 : 0;
        counts.DLC += skin.entitlement ? 1 : 0;
        counts.Upgrades += helpers.Chain(skin)?.stage === 1 ? 1 : 0;
      }
      ['HeroID', 'Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'ChestName', 'CostumeIndex', 'BPSeason', 'Entitlement'].forEach(key => {
        if (applyFilters(skin, key)) {
          const val = helpers[key](skin);
          if (val) counts[key][val] = (counts[key][val] || 0) + 1;
        }
      });
      if (applyFilters(skin, 'How')) {
        helpers.How(skin).forEach(val => { counts.How[val] = (counts.How[val] || 0) + 1; });
      }
    });

    return counts;
  }, [skins, filters, helpers]);
}

function getAnimButtonRows(animTypes, overAnim) {
  const rows = [];
  const hasOther = animTypes.idleOther && animTypes.selectedOther;
  const mainRow = [
    animTypes.idleOther && { key: 'idleOther', label: 'Idle (Main)', anim: animTypes.idleOther, urlType: 'all' },
    animTypes.selectedOther && { key: 'selectedOther', label: 'Selected (Main)', anim: animTypes.selectedOther, urlType: 'all' },
    animTypes.selectedOther && { key: 'selectedOtherLoop', label: 'Selected Loop (Main)', anim: animTypes.selectedOther, urlType: 'loop' },
    overAnim && overAnim.idle && {
      key: 'idleExtended',
      label: `Idle Extended`,
      anim: overAnim.idle,
      urlType: 'all'
    }
  ].filter(Boolean);

  const otherRow = hasOther ? [
    { key: 'idle', label: 'Idle (Other)', anim: animTypes.idle, urlType: 'all' },
    { key: 'selected', label: 'Selected (Other)', anim: animTypes.selected, urlType: 'all' },
    { key: 'selectedLoop', label: 'Selected Loop (Other)', anim: animTypes.selected, urlType: 'loop' }
  ] : [];

  if (!hasOther) {
    rows.push([
      { key: 'idle', label: 'Idle', anim: animTypes.idle, urlType: 'all' },
      { key: 'selected', label: 'Selected', anim: animTypes.selected, urlType: 'all' },
      { key: 'selectedLoop', label: 'Selected Loop', anim: animTypes.selected, urlType: 'loop' },
      overAnim && overAnim.idle && {
        key: 'idleExtended',
        label: `Idle Extended`,
        anim: overAnim.idle,
        urlType: 'all'
      }
    ].filter(Boolean));
  } else {
    rows.push(mainRow);
    if (otherRow.length) rows.push(otherRow);
  }
  return rows;
}

export function SkinStoreView({ skins, legends, langs }) {
  const [selectedSkin, setSelectedSkin] = useState(null);
  const dataFull = useDataView().full;
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHeroIDs, setFilterHeroIDs] = useState([]);
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterChestName, setFilterChestName] = useState('');
  const [filterCostumeIndex, setFilterCostumeIndex] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterHow, setFilterHow] = useState('');
  const [filterUpgrades, setFilterUpgrades] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState({ anim: '', urlType: 'all' });
  const [copyFeedback, setCopyFeedback] = useState('');
  const topRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const filtersChanged = useRef(false);
  const urlHydrated = useRef(false);
  const urlSyncing = useRef(false);
  const [viewMode] = useState('grid');
  const [filterPatch, setFilterPatch] = useState('');
  const patchGroups = useMemo(() => getPatchGroups(skins), [skins]);
  const patchCounts = useMemo(() => getPatchFilterCounts(skins), [skins]);
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
    setFilterHeroIDs(readArrayParam(params, params.has('hero') ? 'hero' : 'legend'));
    setFilterCohort(params.get('cohort') || '');
    setFilterPromo(params.get('promo') || '');
    setFilterRarity(params.get('rarity') || '');
    setFilterStoreID(params.get('store') || '');
    setStoreOnly(readBoolParam(params, 'storeOnly'));
    setFilterStoreLabel(params.get('storeLabel') || '');
    setFilterPromoType(params.get('promoType') || '');
    setFilterChestName(params.get('chest') || '');
    setFilterCostumeIndex(params.get('costumeIndex') || '');
    setFilterBPSeason(params.get('battlePass') || '');
    setFilterEntitlement(readBoolParam(params, 'entitlement'));
    setFilterHow(params.get('how') || '');
    setFilterUpgrades(readBoolParam(params, 'upgrades'));
    setFilterPatch(params.get('patch') || '');
    urlHydrated.current = true;
    window.setTimeout(() => {
      urlSyncing.current = false;
    }, 0);
  }, []);

  const chainLookup = useChainLookup(skins, (s) => s?.costumeData?.CostumeName);
  const chainOf = useCallback((s) => chainLookup.get(s?.costumeData?.CostumeName), [chainLookup]);
  const helpers = useMemo(() => ({
    HeroID: s => s.HeroID,
    Cohort: s => (Array.isArray(s.store) && s.store[0]?.Cohort) ?? '',
    TimedPromotion: s => (Array.isArray(s.store) && s.store[0]?.TimedPromotion) ?? '',
    Rarity: s => (Array.isArray(s.store) && s.store[0]?.Rarity) ?? '',
    StoreID: s => (Array.isArray(s.store) && s.store[0]?.StoreID) ?? -1,
    StoreLabel: s => (Array.isArray(s.store) && s.store[0]?.Label) ?? '',
    PromoType: s => s.promo?.Type ?? '',
    ChestName: s => s.chest?.ChanceBoxName ?? '',
    CostumeIndex: s => s.costumeData?.CostumeIndex ?? '',
    BPSeason: s => s.bp?.ID ?? '',
    Entitlement: s => !!s.entitlement,
    How: sourceFilterValues,
    Chain: chainOf,
    Patch: getAddedPatch
  }), [chainOf]);

  const svgStyles = {
    Mythic: {
      background: host + '/game/getGfx/shop/mythic-bg',
      border: host + '/game/getGfx/shop/mythic-border',
    },
    Other: {
      background: host + '/game/getGfx/shop/epic-bg',
      border: host + '/game/getGfx/shop/epic-border',
    },
  };

  const getRarityStyles = (rarity) => {
    const specialRarities = ['Epic', 'EpicCrossover', 'Crossover', 'Mythic'];
    if (!specialRarities.includes(rarity)) return { className: 'bg-slate-950 p-3' };
    const isMythic = rarity === 'Mythic';
    const svgSet = isMythic ? svgStyles.Mythic : svgStyles.Other;
    return {
      className: 'relative rounded-lg text-center p-3',
      style: {
        backgroundImage: `url(${svgSet.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness-110',
      },
    };
  };
  const heroIDs = useMemo(() => uniqueValues(skins, 'HeroID'), [skins]);
  const cohorts = useMemo(() => uniqueValues(skins, ['store', 'Cohort']), [skins]);
  const promotions = useMemo(() => uniqueValues(skins, ['store', 'TimedPromotion']), [skins]);
  const rarities = useMemo(() => uniqueValues(skins, ['store', 'Rarity']), [skins]);
  const storeLabels = useMemo(() => uniqueValues(skins, ['store', 'Label']), [skins]);
  const promoTypes = useMemo(() => uniqueValues(skins, ['promo', 'Type']), [skins]);
  const chestNames = useMemo(() => uniqueValues(skins, ['chest', 'ChanceBoxName']), [skins]);
  const costumeIndexes = useMemo(() => uniqueValues(skins, ['costumeData', 'CostumeIndex']), [skins]);
  const bpSeasons = useMemo(() => {
    return [
      ...new Set(
        skins
          .filter(s => s.bp && s.bp.ID)
          .map(s => s.bp.ID)
      ),
    ].sort((a, b) => {
      const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
      const nA = getNum(a), nB = getNum(b);
      if (nA !== nB) return nA - nB;
      return a.localeCompare(b);
    });
  }, [skins]);

  const optionCounts = useOptionCounts(
    skins,
    {
      HeroID: filterHeroIDs,
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      Rarity: filterRarity,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      ChestName: filterChestName,
      CostumeIndex: filterCostumeIndex,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      How: filterHow,
      Upgrades: filterUpgrades,
      StoreOnly: storeOnly,
      Patch: filterPatch
    },
    helpers
  );

  const getDisplayNameKey = s => (Array.isArray(s.store) && s.store[0]?.DisplayNameKey) ?? s.costumeData?.DisplayNameKey ?? '';
  const getCohort = s => (Array.isArray(s.store) && s.store[0]?.Cohort) ?? '';
  const getDescriptionKey = s => (Array.isArray(s.store) && s.store[0]?.DescriptionKey) ?? s.costumeData?.DescriptionKey ?? '';
  const getIdolCost = s => (Array.isArray(s.store) && s.store[0]?.IdolCost) ?? '';
  const getStoreID = s => (Array.isArray(s.store) && s.store[0]?.StoreID) ?? -1;
  const getRarity = s => (Array.isArray(s.store) && s.store[0]?.Rarity) ?? '';
  const getLabel = s => (Array.isArray(s.store) && s.store[0]?.Label) ?? '';
  const getPromoType = s => s.promo?.Type ?? '';
  const getTimedPromotions = s =>
    Array.isArray(s.store)
      ? s.store.map(sd => (sd?.TimedPromotion ?? '')).filter(v => v !== '')
      : [];
  const getChestName = s => s.chest?.ChanceBoxName ?? '';
  const getCostumeIndex = s => s.costumeData?.CostumeIndex ?? '';

  const filteredSkins = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return skins.filter(skin => {
      if (filterPatch && !patchFilterMatches(getAddedPatch(skin), filterPatch)) return false;
      if (filterHeroIDs.length && !filterHeroIDs.includes(skin.HeroID)) return false;
      if (filterCohort && getCohort(skin) !== filterCohort) return false;
      if (filterRarity && getRarity(skin) !== filterRarity) return false;
      if (filterStoreID && getStoreID(skin) !== filterStoreID) return false;
      if (filterStoreLabel && getLabel(skin) !== filterStoreLabel) return false;
      if (filterPromoType && getPromoType(skin) !== filterPromoType) return false;
      if (filterPromo !== '' && !getTimedPromotions(skin).includes(filterPromo)) return false;
      if (filterChestName) {
        if (filterChestName === 'AllChests') {
          if (!skin.chest) return false;
        } else if (filterChestName === 'AllChestExclusives') {
          if (!(skin.chest && Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0))) return false;
        } else {
          if (getChestName(skin) !== filterChestName) return false;
        }
      }
      if (filterCostumeIndex && getCostumeIndex(skin) !== filterCostumeIndex) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP') {
          if (!skin.bp) return false;
        } else {
          if (!skin.bp || skin.bp.ID !== filterBPSeason) return false;
        }
      }
      if (filterEntitlement && !skin.entitlement) return false;
      if (filterHow && !sourceFilterValues(skin).includes(filterHow)) return false;
      if (filterUpgrades && !chainOf(skin)) return false;
      if (storeOnly && (!Array.isArray(skin.store) || skin.store.length === 0)) return false;
      const fields = [
        langs.content[getDisplayNameKey(skin)] || '',
        langs.content[skin.costumeData?.DisplayNameKey] || '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.StoreName).join(' ') : '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.Item).join(' ') : '',
        skin.costumeData?.CostumeName || '',
        skin.costumeData?.OwnerHero || '',
        skin.costumeData?.Description || '',
        (skin.costumeData?.MissionTags || []).join(' '),
        (skin.costumeData?.HomeField || []).join(' '),
        skin.costumeData?.ParentCrossover || '',
        skin.costumeData?.ReplacementHeroName || '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.Label).join(' ') : '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.TimedPromotion).join(' ') : '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.SearchTags).join(' ') : '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.ThirdPartyLogo).join(' ') : '',
        skin.promo?.StoreName || '',
        skin.promo?.Item || '',
        skin.promo?.Label || '',
        skin.bp?.Item || '',
        skin.bp?.ID || '',
        skin.bp?.DescriptionKey || '',
        skin.chest?.ChanceBoxName || '',
        skin.chest?.DisplayNameKey || '',
        skin.entitlement?.EntitlementName || '',
        skin.entitlement?.DisplayNameKey || '',
        String(skin.costumeData?.CostumeID || ''),
        Array.isArray(skin.store) ? skin.store.map(sd => sd.StoreID).join(' ') : '',
        Array.isArray(skin.store) ? skin.store.map(sd => sd.IdolCost).join(' ') : '',
        String(skin.HeroID || ''),
        String(skin.SkinInt || ''),
        String(skin.costumeData?.RosterOrderID || ''),
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    }).sort((a, b) => {
      const idxA = typeof a.ArrayIndex === 'number' ? a.ArrayIndex : parseInt(a.ArrayIndex) || 0;
      const idxB = typeof b.ArrayIndex === 'number' ? b.ArrayIndex : parseInt(b.ArrayIndex) || 0;
      const nameA = langs.content[getDisplayNameKey(a)] || '';
      const nameB = langs.content[getDisplayNameKey(b)] || '';
      const costA = parseInt(getIdolCost(a)) || 0;
      const costB = parseInt(getIdolCost(b)) || 0;
      const heroA = parseInt(a.HeroID) || 0;
      const heroB = parseInt(b.HeroID) || 0;
      const storeA = parseInt(getStoreID(a)) || 0;
      const storeB = parseInt(getStoreID(b)) || 0;
      const costumeA = parseInt(a.costumeData?.CostumeID) || 0;
      const costumeB = parseInt(b.costumeData?.CostumeID) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        case 'HeroIDAsc': return heroA - heroB;
        case 'HeroIDDesc': return heroB - heroA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        case 'CostumeIDAsc': return costumeA - costumeB;
        case 'CostumeIDDesc': return costumeB - costumeA;
        default: return 0;
      }
    });
  }, [
    skins, debouncedSearch, sortType, filterHeroIDs, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterChestName, filterCostumeIndex, filterBPSeason, filterEntitlement, filterHow, filterUpgrades, filterPatch, langs, chainOf
  ]);
  const cardSkins = useMemo(() => groupChains(filteredSkins, chainOf), [filteredSkins, chainOf]);
  const totalSkinCards = useMemo(() => groupChains(skins || [], chainOf).length, [skins, chainOf]);
  const shownChainIds = useMemo(() => new Set(filteredSkins.map((s) => chainOf(s)?.id).filter(Boolean)), [filteredSkins, chainOf]);
  const exportColumns = useMemo(() => {
    const legendName = (skin) => {
      const hero = legends.find(r => r.heroData.HeroID == skin.HeroID);
      return hero ? langs.content[hero.DisplayNameKey] || langs.content[hero.heroData?.DisplayNameKey] || hero.heroData?.HeroName || '' : '';
    };
    return [
      { key: 'name', label: 'Skin', value: (skin) => langs.content[skin.costumeData?.DisplayNameKey] || skin.costumeData?.CostumeName },
      { key: 'legend', label: 'Legend', value: legendName },
      { key: 'costumeId', label: 'Costume ID', value: (skin) => skin.costumeData?.CostumeID },
      { key: 'codeName', label: 'Code name', value: (skin) => skin.costumeData?.CostumeName },
      chainExportColumn(chainOf),
      ...storeExportColumns,
    ];
  }, [legends, langs, chainOf]);
  const findListedSkin = useCallback((skinId) => {
    const direct = filteredSkins.find(s => String(s.costumeData?.CostumeID) === skinId);
    if (direct) return direct;
    const stage = skins.find(s => String(s.costumeData?.CostumeID) === skinId);
    return stage && shownChainIds.has(chainOf(stage)?.id) ? stage : null;
  }, [filteredSkins, skins, shownChainIds, chainOf]);
  const isListedSkin = useCallback((skin) => !!skin && (filteredSkins.some(s => s.costumeData?.CostumeID === skin.costumeData?.CostumeID) || shownChainIds.has(chainOf(skin)?.id)), [filteredSkins, shownChainIds, chainOf]);
  const pickStage = useCallback((stage) => {
    const skin = skins.find(s => s.costumeData?.CostumeName === stage.name);
    if (!skin) return;
    setSelectedSkin(skin);
    setCurrentAnimation({ anim: skin.animTypes?.idleOther || skin.animTypes?.idle || '', urlType: 'all' });
  }, [skins]);
  const handleFilterChange = useCallback((setter, value) => {
    setter(value);
  }, []);

  useEffect(() => {
    if (skins.length === 0 || filteredSkins.length === 0) return;
    if (isMobile && filtersChanged.current) {
      filtersChanged.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const skinId = params.get('skin') ? String(params.get('skin')) : null;
    let skin = null;
    if (skinId) {
      skin = findListedSkin(skinId);
    }
    setSelectedSkin(skin);
    setCurrentAnimation({ anim: skin?.animTypes?.idleOther || skin?.animTypes?.idle || '', urlType: 'all' });
  }, [skins, filteredSkins, isMobile]);

  useEffect(() => {
    if (selectedSkin && !isListedSkin(selectedSkin)) {
      setSelectedSkin(null);
    }
  }, [filteredSkins, isMobile, selectedSkin, isListedSkin]);

  useEffect(() => {
    if (!urlHydrated.current || urlSyncing.current) return;
    const currentParams = new URLSearchParams();
    currentParams.set('page', pageSlugForLabel('Skins'));
    if (selectedSkin) {
      currentParams.set('skin', String(selectedSkin.costumeData?.CostumeID));
    }
    writeStringParam(currentParams, 'search', searchQuery.trim());
    writeStringParam(currentParams, 'sort', sortType, 'ArrayIndexDesc');
    writeArrayParam(currentParams, 'hero', filterHeroIDs);
    writeStringParam(currentParams, 'cohort', filterCohort);
    writeStringParam(currentParams, 'promo', filterPromo);
    writeStringParam(currentParams, 'rarity', filterRarity);
    writeStringParam(currentParams, 'store', filterStoreID);
    writeBoolParam(currentParams, 'storeOnly', storeOnly);
    writeStringParam(currentParams, 'storeLabel', filterStoreLabel);
    writeStringParam(currentParams, 'promoType', filterPromoType);
    writeStringParam(currentParams, 'chest', filterChestName);
    writeStringParam(currentParams, 'costumeIndex', filterCostumeIndex);
    writeStringParam(currentParams, 'battlePass', filterBPSeason);
    writeBoolParam(currentParams, 'entitlement', filterEntitlement);
    writeStringParam(currentParams, 'how', filterHow);
    writeBoolParam(currentParams, 'upgrades', filterUpgrades);
    writeStringParam(currentParams, 'patch', filterPatch);
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const skinId = params.get('skin') ? String(params.get('skin')) : null;
      if (skinId && filteredSkins.length > 0) {
        const skin = findListedSkin(skinId);
        if (skin) {
          setSelectedSkin(skin);
        } else {
          setSelectedSkin(null);
        }
      } else {
          setSelectedSkin(null);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSkin, filteredSkins, isMobile, searchQuery, sortType, filterHeroIDs, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterChestName, filterCostumeIndex, filterBPSeason, filterEntitlement, filterHow, filterUpgrades, filterPatch, findListedSkin]);

  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterHeroIDs([]);
    setFilterCohort('');
    setFilterPromo('');
    setFilterRarity('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterChestName('');
    setFilterCostumeIndex('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    setFilterHow('');
    setFilterUpgrades(false);
    setFilterPatch('');
    setSelectedSkin(null);
    filtersChanged.current = true;
    setCurrentAnimation({ anim: '', urlType: 'all' });
  }, [filteredSkins, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedSkin) return;
    const url = `${window.location.origin}${window.location.pathname}?skin=${selectedSkin.costumeData?.CostumeID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link copied');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback("Couldn't copy");
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedSkin]);

  const handleImgError = e => {
    e.target.style.display = 'none';
  };

  const Row = ({ index, data }) => {
    const skin = data[index];
    const heroData = legends.find(r => r.heroData.HeroID == skin.HeroID);
    return (
      <div className={viewMode === 'grid' ? 'h-full w-full' : 'p-0 px-2 min-h-[215px]'} >
        <div
          className={`relative h-full self-start text-left bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer p-2 pt-9 sm:pt-2 transition border border-slate-700 shadow-sm hover:-translate-y-0.5 ${selectedSkin?.costumeData?.CostumeID === skin.costumeData?.CostumeID || (chainOf(skin) && chainOf(skin)?.id === chainOf(selectedSkin)?.id) ? 'ring-2 ring-blue-400' : ''} flex flex-col`}
          onClick={() => {
            setSelectedSkin(skin);
            setCurrentAnimation({ anim: skin.animTypes?.idleOther || skin.animTypes?.idle || '', urlType: 'all' });
            filtersChanged.current = false;
          }}
        >
          <div className="mb-1 hidden min-h-8 items-start justify-between gap-2 sm:flex">
            {heroData && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs font-bold shadow-sm bg-slate-950/90 text-slate-100">
                <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${heroData?.costumeType?.CostumeIconFileName}/${heroData?.costumeType?.CostumeIcon}`} className="h-6 w-6 shrink-0 object-contain" onError={handleImgError} />
                <span className="hidden min-w-0 whitespace-normal sm:inline">{langs.content[heroData?.DisplayNameKey] || heroData?.DisplayNameKey} Skin</span>
              </div>
            )}
            <AddedBadge item={skin} className="hidden shrink-0 sm:inline-flex" />
          </div>
          <div className="absolute right-2 top-2 z-10 sm:hidden">
            <AddedBadge item={skin} showDate={false} showPatchLabel={false} className="pointer-events-none" />
          </div>
          {heroData && (
            <div className="absolute left-2 top-2 z-10 flex items-center justify-center rounded-lg p-1 text-left text-xs font-bold shadow-sm bg-slate-950/90 text-slate-100 sm:hidden">
              <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${heroData?.costumeType?.CostumeIconFileName}/${heroData?.costumeType?.CostumeIcon}`} className="h-6 w-6 shrink-0 object-contain" onError={handleImgError} />
            </div>
          )}
          {viewMode === 'grid' && (
            <div className="mb-1 flex max-w-full flex-row items-center justify-center gap-1.5 px-1 text-sm font-bold leading-tight text-white sm:gap-2 sm:px-2 sm:text-base">
              <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${skin.costumeData?.CostumeIconFileName}/${skin.costumeData?.CostumeIcon}`} className="inline h-5 shrink-0 sm:h-7" onError={handleImgError} />
              <span className="break-words">{langs.content[getDisplayNameKey(skin)] || skin.costumeData?.CostumeName}</span>
            </div>
          )}
          <div className="flex w-full flex-row items-center justify-center gap-2 max-sm:flex-col">
            <div className={`flex p-2 rounded-lg items-center justify-center ${getRarityStyles(Array.isArray(skin.store) && skin.store[0]?.Rarity).className}`} style={getRarityStyles(Array.isArray(skin.store) && skin.store[0]?.Rarity).style}>
              <ImageWithLoader src={`${host}/game/anim/char/${skin.HeroID}-${skin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${skin.animTypes.selectedOther || skin.animTypes.selected}/loop`} alt="" className="h-28 w-28 rounded-lg bg-slate-950/80 sm:h-36 sm:w-36" />
            </div>
            {skin.weapons.length > 0 && (
              <div className="flex flex-col gap-2 max-sm:flex-row">
                {skin.weapons.slice(0, 2).map((weapon) => (
                  <div key={weapon.WeaponSkinID} className="p-1 bg-slate-950 flex rounded-lg">
                    <img loading="lazy" decoding="async"
                      src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                      className="h-12 w-12 object-contain sm:h-16 sm:w-16"
                      onError={handleImgError}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex w-full flex-col items-center text-center mt-2 min-w-0">
            <div className="flex flex-col gap-1">
              {viewMode != 'grid' && hasSources(skin) && <SourceLine sources={skin.sources} phoneCompact className="pb-1" />}
              {viewMode != 'grid' && !hasSources(skin) && (
                <div className="flex max-w-full flex-wrap justify-center gap-1 pb-1">
                  {(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.promo && !skin.entitlement && (
                    <div className={`${skin.costumeData.CostumeName === "Collectors" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-slate-400/40 bg-slate-500/20 text-slate-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                      {skin.costumeData.CostumeName === "Collectors" ? "Collectors Pack Exclusive" : "Not Obtainable"}
                    </div>
                  )}
                  {skin.bp && (
                    <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${skin.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {skin.promo && (
                    <div className="border border-violet-300/40 bg-violet-500/20 text-violet-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.entitlement ? ' Only' : ''}`}
                    </div>
                  )}
                  {skin.entitlement && (
                    <div className="border border-amber-300/40 bg-amber-500/20 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[skin.entitlement.DisplayNameKey]?.replace('!', '') || skin.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {skin.chest && (
                    <div className="border border-orange-300/40 bg-orange-500/20 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                      {(Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[skin.chest.DisplayNameKey]} Exclusive` : langs.content[skin.chest.DisplayNameKey]}
                    </div>
                  )}
                  {Array.isArray(skin.store) && (() => {
                    const labels = [...new Set(skin.store.map(sd => sd.Label).filter(Boolean))];
                    return labels.length > 0 && labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "Last Chance" : label}
                      </div>
                    ));
                  })()}
                  {Array.isArray(skin.store) && (() => {
                    const promos = [...new Set(skin.store.map(sd => sd.TimedPromotion ?? '').filter(v => v !== ''))];
                    return promos.length > 0 && promos.map((promo, idx) => (
                      <div key={idx} className="border border-rose-300/40 bg-rose-500/20 text-rose-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className={`flex-row items-center gap-2 text-white font-bold ${viewMode === 'grid' ? 'hidden' : 'flex text-lg'}`}>
                <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${skin.costumeData?.CostumeIconFileName}/${skin.costumeData?.CostumeIcon}`} className="inline h-7" onError={handleImgError} />
                <span >{langs.content[getDisplayNameKey(skin)] || skin.costumeData?.CostumeName}</span>
              </div>
              {chainOf(skin) && <div className="flex justify-center pb-1"><ChainPill chain={chainOf(skin)} /></div>}
              {viewMode == 'grid' && hasSources(skin) && <SourceLine sources={skin.sources} phoneCompact className="pb-1" />}
              {viewMode == 'grid' && !hasSources(skin) && <div className="flex w-full max-w-full flex-wrap justify-center gap-1 pb-1">
                {(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.promo && !skin.entitlement && (
                  <div className={`${skin.costumeData.CostumeName === "Collectors" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-slate-400/40 bg-slate-500/20 text-slate-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {skin.costumeData.CostumeName === "Collectors" ? "Collectors Pack Exclusive" : "Not Obtainable"}
                  </div>
                )}
                {skin.bp && (
                  <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${skin.bp.ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}

                {skin.promo && (
                  <div className="border border-violet-300/40 bg-violet-500/20 text-violet-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {skin.entitlement && (
                  <div className="border border-amber-300/40 bg-amber-500/20 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[skin.entitlement.DisplayNameKey]?.replace('!', '') || skin.entitlement.EntitlementName} DLC`}
                  </div>
                )}
                {skin.chest && (
                  <div className="border border-orange-300/40 bg-orange-500/20 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[skin.chest.DisplayNameKey]} Exclusive` : langs.content[skin.chest.DisplayNameKey]}
                  </div>
                )}
                {Array.isArray(skin.store) && [...new Set(skin.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                  <div key={`label-${idx}`} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "Last Chance" : label}
                  </div>
                ))}
                {Array.isArray(skin.store) && [...new Set(skin.store.map(sd => sd.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                  <div key={`promo-${idx}`} className="border border-rose-300/40 bg-rose-500/20 text-rose-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))}
              </div>}
            </div>

            <div className={`${hasSources(skin) ? 'hidden' : 'flex'} items-center gap-3 text-white`}>
              {Array.isArray(skin.store) && skin.store.map((sd, idx) => {
                if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
                  const bundleCost = bundleMammothPrice(sd);
                  if (!bundleCost) return null;
                  return (
                    <div key={`bundle-${idx}`}>
                      <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-slate-400"> (Bundle)</span>
                    </div>
                  );
                }
                if (sd.IdolCost && sd.IdolCost != 0) {
                  return (
                    <div key={`idol-${idx}`}>
                      <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{sd.IdolCost}</span>
                    </div>
                  );
                }
                return null;
              })}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/UI_Currencies/a_Currency_${sd.SpecialCurrencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.SpecialCurrencyCost}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col lg:flex-row" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="w-full min-w-0 flex-1">
        <FilterPanel
          search={searchQuery}
          onSearch={(value) => handleFilterChange(setSearchQuery, value)}
          searchPlaceholder="Search Skins"
          sort={sortType}
          onSort={setSortType}
          sortOptions={SKIN_SORTS}
          shown={cardSkins.length}
          total={totalSkinCards}
          noun="skins"
          tools={<ListTools filename="brawlhalla-skins" rows={filteredSkins} columns={exportColumns} />}
          activeCount={countFilters([filterHeroIDs, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterChestName, filterCostumeIndex, filterBPSeason, filterEntitlement, filterHow, filterUpgrades, filterPatch])}
          onReset={resetFilters}
          chips={heroIDs.some(id => optionCounts.HeroID[id] > 0) && heroIDs
            .filter(id => optionCounts.HeroID[id] > 0)
            .map((id) => {
              const heroData = legends.find(r => r.heroData.HeroID == id);
              const icon = heroData?.costumeType?.CostumeIcon;
              const iconFile = heroData?.costumeType?.CostumeIconFileName;
              if (!icon || !iconFile) return null;
              const selected = filterHeroIDs.includes(id);
              return (
                <IconChip
                  key={id}
                  selected={selected}
                  onClick={() => handleFilterChange(setFilterHeroIDs, selected ? filterHeroIDs.filter(hid => hid !== id) : [...filterHeroIDs, id])}
                  title={langs.content[heroData.DisplayNameKey] || heroData.heroData?.HeroName}
                  count={optionCounts.HeroID[id]}
                >
                  <ImageWithLoader src={`${host}/game/getGfx/${iconFile}/${icon}`} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" small onError={handleImgError} />
                </IconChip>
              );
            })}
          selects={<>
            {Object.values(optionCounts.How).some(count => count > 0) && (
              <FilterSelect label="How to get" value={filterHow} onChange={(value) => handleFilterChange(setFilterHow, value)}>
                {sortSourceFilterValues(Object.keys(optionCounts.How)).filter(n => optionCounts.How[n] > 0).map(n => <FilterOption key={n} value={n} count={optionCounts.How[n]} />)}
              </FilterSelect>
            )}
            {Object.values(optionCounts.Rarity).some(count => count > 0) && (
              <FilterSelect label="Rarity" value={filterRarity} onChange={(value) => handleFilterChange(setFilterRarity, value)}>
                {rarities.filter(r => optionCounts.Rarity[r] > 0).map(r => <FilterOption key={r} value={r} label={formatLabel(r)} count={optionCounts.Rarity[r]} />)}
              </FilterSelect>
            )}
            {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
              <FilterSelect label="Battle Pass" value={filterBPSeason} onChange={(value) => handleFilterChange(setFilterBPSeason, value)}>
                {optionCounts.AllBP > 0 && <FilterOption value="AllBP" label="Any season" count={optionCounts.AllBP} />}
                {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => <FilterOption key={season} value={season} label={`Season ${String(season).replace(/^BP/, '')}`} count={optionCounts.BPSeason[season]} />)}
              </FilterSelect>
            )}
            {(optionCounts.AllChests > 0 || optionCounts.AllChestExclusives > 0 || Object.values(optionCounts.ChestName).some(count => count > 0)) && (
              <FilterSelect label="Chest" value={filterChestName} onChange={(value) => handleFilterChange(setFilterChestName, value)}>
                {optionCounts.AllChests > 0 && <FilterOption value="AllChests" label="Any chest" count={optionCounts.AllChests} />}
                {optionCounts.AllChestExclusives > 0 && <FilterOption value="AllChestExclusives" label="Chest exclusives" count={optionCounts.AllChestExclusives} />}
                {chestNames.filter(n => optionCounts.ChestName[n] > 0).map(n => <FilterOption key={n} value={n} label={langs.content[`ChanceBoxType_${n}_DisplayName`] || n} count={optionCounts.ChestName[n]} />)}
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
            {(dataFull || filterCostumeIndex) && Object.values(optionCounts.CostumeIndex).some(count => count > 0) && (
              <FilterSelect label="Costume Index" value={filterCostumeIndex} onChange={(value) => handleFilterChange(setFilterCostumeIndex, value)}>
                {costumeIndexes.filter(n => optionCounts.CostumeIndex[n] > 0).map(n => <FilterOption key={n} value={n} count={optionCounts.CostumeIndex[n]} />)}
              </FilterSelect>
            )}
          </>}
          toggles={<>
            <FilterToggle label="In the store" count={optionCounts.StoreOnly || 0} checked={storeOnly} onChange={(value) => handleFilterChange(setStoreOnly, value)} />
            <FilterToggle label="DLC" count={optionCounts.DLC || 0} checked={filterEntitlement} onChange={(value) => handleFilterChange(setFilterEntitlement, value)} />
            {(optionCounts.Upgrades > 0 || filterUpgrades) && <FilterToggle label="Has upgrades" count={optionCounts.Upgrades || 0} checked={filterUpgrades} onChange={(value) => handleFilterChange(setFilterUpgrades, value)} />}
          </>}
        />
        <VirtualCardGrid
          items={cardSkins}
          empty={<NoMatches noun="skins" onReset={resetFilters} />}
          getKey={(skin, index) => skin?.costumeData?.CostumeID || index}
          renderItem={(skin, index) => Row({ index, data: cardSkins })}
        />
      </div>
      <div className={`fixed inset-0 bg-black/70 z-[110] ${selectedSkin ? 'flex items-stretch justify-center p-0 sm:items-center sm:p-3' : 'hidden'}`} onClick={() => setSelectedSkin(null)}> 
        <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto overscroll-contain app-scrollbar rounded-none border p-2 shadow-2xl border-slate-700 bg-slate-950 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:p-3 lg:p-3" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Close details"
            className="absolute right-3 top-3 z-10 rounded-lg p-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setSelectedSkin(null)}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-11">
            <PopupViewBar />
            {isMobile && selectedSkin && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handleCopyLink}
                  className="bg-blue-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-blue-500 transition-colors duration-200"
                >
                  Copy link
                </button>
                {copyFeedback && (
                  <span className="text-sm text-slate-300">{copyFeedback}</span>
                )}
              </div>
            )}
          </div>
          {selectedSkin ? (
            <div className='grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start'>
              <div className="xl:col-span-2 flex flex-col gap-2 pb-3 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  {selectedSkin.costumeData?.ReplacementPortrait && (
                    <img loading="lazy" decoding="async"
                      src={`${host}/game/getGfx/${selectedSkin.costumeData.ReplacementPortraitFileName}/${selectedSkin.costumeData.ReplacementPortrait}M`}
                      className="h-16"
                      onError={handleImgError}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    {selectedSkin.costumeData?.CrossoverGem && (
                      <img loading="lazy" decoding="async"
                        src={`${host}/game/getGfx/${selectedSkin.costumeData.CrossoverGemFileName}/${selectedSkin.costumeData.CrossoverGem}`}
                        className="h-8 w-8 object-contain"
                        onError={handleImgError}
                      />
                    )}
                    <img loading="lazy" decoding="async"
                      src={`${host}/game/getGfx/${selectedSkin.costumeData.CostumeIconFileName}/${selectedSkin.costumeData.CostumeIcon}`}
                      className="h-8 w-8 object-contain"
                      onError={handleImgError}
                    />
                    <span className="text-2xl font-bold text-white">{langs.content[getDisplayNameKey(selectedSkin)] || selectedSkin.costumeData?.CostumeName}</span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedSkin)] && (
                  <div className="max-w-prose text-slate-300 text-sm">
                    {langs.content[getDescriptionKey(selectedSkin)]}
                  </div>
                )}
                <ChainStages chain={chainOf(selectedSkin)} onPick={pickStage} full={dataFull} firstLabel="Base skin" />
                {dataFull && Array.isArray(selectedSkin.store) && selectedSkin.store.flatMap(sd => splitTags(sd.SearchTags)).filter(Boolean).length > 0 && (
                  <div>
                    <span className="text-white">Store Search Tags</span>
                    <div className="mt-1 flex max-w-full flex-wrap gap-2 pb-1">
                      {[
                        ...new Set(
                          selectedSkin.store
                            .flatMap(sd => splitTags(sd.SearchTags))
                            .filter(Boolean)
                        )
                      ].map((tag, idx) => (
                        <span key={idx} className="shrink-0 bg-slate-800 rounded-full px-3 py-1 text-xs font-bold text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <div className="flex max-w-full flex-wrap gap-2 pb-1">
                    {String(selectedSkin.costumeData?.MissionTags || '').split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-lg px-3 py-1 text-sm font-bold bg-slate-800 text-white">
                        {langs.content?.[`LegendTag_${tag}`] || formatLabel(tag)}
                      </span>
                    ))}
                    {selectedSkin.promo && !hasSources(selectedSkin) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-purple-300/40 bg-purple-500/20 text-purple-100">
                        Promo Type: {selectedSkin.promo.Type}
                      </span>
                    )}
                    {selectedSkin.bp && !hasSources(selectedSkin) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-emerald-300/40 bg-emerald-500/20 text-emerald-100">
                        Battle Pass Season {selectedSkin.bp.ID.replace('BP', '').replace('-', ' ')} (Tier {selectedSkin.bp.Tier})
                      </span>
                    )}
                    {selectedSkin.chest && !hasSources(selectedSkin) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-orange-300/40 bg-orange-500/20 text-orange-100">
                        {`${langs.content[`ChanceBoxType_${selectedSkin.chest.ChanceBoxName}_DisplayName`] || selectedSkin.chest.ChanceBoxName} (${selectedSkin.chest.ExclusiveItems.split(',').includes(selectedSkin.store?.StoreName || selectedSkin.costumeData.CostumeName) ? 'Exclusive' : 'Common'})`}
                      </span>
                    )}
                    {selectedSkin.entitlement && !hasSources(selectedSkin) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-amber-300/40 bg-amber-500/20 text-amber-100">
                        {`${langs.content[selectedSkin.entitlement.DisplayNameKey]?.replace('!', '') || selectedSkin.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                    {selectedSkin.costumeData.CostumeName === 'Collectors' && !hasSources(selectedSkin) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-red-300/40 bg-red-500/20 text-red-100">
                        Collectors Pack Exclusive
                      </span>
                    )}
                    {Array.isArray(selectedSkin.store) && (() => {
                      const labels = [...new Set(selectedSkin.store.map(sd => sd.Label).filter(Boolean))];
                      return labels.length > 0 && labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "Last Chance" : label}
                        </span>
                      ));
                    })()}
                    {Array.isArray(selectedSkin.store) && !hasSources(selectedSkin) && (() => {
                      const promos = [...new Set(selectedSkin.store.map(sd => sd.TimedPromotion).filter(Boolean))];
                      return promos.length > 0 && promos.map((promo, idx) => (
                        <span key={idx} className="border border-rose-300/40 bg-rose-500/20 text-rose-100 text-sm px-3 py-1 rounded-lg">
                          {formatLabel(promo)}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="contents">
                <div className="xl:col-start-2 xl:row-start-2 w-full flex flex-col gap-3 ">
                  <div className="flex flex-col gap-2">
                    {(hasSources(selectedSkin) || (Array.isArray(selectedSkin.store) && selectedSkin.store.length > 0)) && <StoreDataSection rows={selectedSkin.store} langs={langs} sources={selectedSkin.sources} />}
                    <FieldGrid data={selectedSkin.costumeData} langs={langs} title="Costume Data" exclude={['CostumeIndex', 'MissionTags', 'WeaponSkins']} />
                    <FieldGrid data={selectedSkin.entitlement} langs={langs} title="Entitlement Data" />
                    {false && (<div className='relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm'>
                      <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Costume Data</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Costume Name</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.CostumeName}</span>
                        </div>
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Costume ID</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.CostumeID}</span>
                        </div>
                        {selectedSkin.costumeData.UpgradesTo && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Upgrades To</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.UpgradesTo}</span>
                          </div>
                        )}
                        {selectedSkin.costumeData.HomeField && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2 col-span-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Home Field</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">
                              {selectedSkin.costumeData.HomeField.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>)}
                    {false && selectedSkin.entitlement && (
                      <div className='relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm'>
                        <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Entitlement Data</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement Name</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.EntitlementName}</span>
                          </div>
                          {selectedSkin.entitlement.EntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.EntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SteamAppID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Steam App ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SteamAppID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SonyEntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SonyEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SonyProductID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Product ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SonyProductID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.NintendoConsumableID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Consumable ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.NintendoConsumableID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.NintendoEntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.NintendoEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1EntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1EntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1ProductID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Product ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1ProductID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1StoreID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Store ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1StoreID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.AppleEntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Apple Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.AppleEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.AndroidEntitlementID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Android Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.AndroidEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.UbiConnectID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.UbiConnectID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.UbiConnectPackageID && (
                            <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect Package ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.UbiConnectPackageID}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="xl:col-start-1 xl:row-start-2 w-full flex flex-col gap-2 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                  <span className='text-white text-lg'>Animation and image data</span>
                  {getAnimButtonRows(selectedSkin.animTypes || {}, selectedSkin.animTypes.overAnim).map((row, i) => (
                    <div key={i} className="flex max-w-full flex-wrap gap-2 pb-1">
                      {row.map(btn => (
                        <button
                          key={btn.key}
                          onClick={() => setCurrentAnimation({ anim: btn.anim, urlType: btn.urlType })}
                          className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${currentAnimation.anim === btn.anim && currentAnimation.urlType === btn.urlType
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="mt-2 flex justify-center rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                    {currentAnimation.anim && (
                      <ImageWithLoader
                        src={`${host}/game/anim/char/${selectedSkin.HeroID}-${selectedSkin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${currentAnimation.anim}/${currentAnimation.urlType}`}
                        className="min-h-80 w-full rounded-lg bg-slate-950/80"
                        imgClassName="max-w-full h-auto object-contain"
                        onError={handleImgError}
                        alt={`${langs.content && langs.content[getDisplayNameKey(selectedSkin)] || selectedSkin.costumeData?.CostumeName} animation`}
                      />
                    )}
                  </div>
                  {selectedSkin.weapons.length > 0 && (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedSkin.weapons.slice(0, 2).map((weapon, index) => (
                          <div key={weapon.WeaponSkinID} className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <div className='flex items-center gap-2 mb-2'>
                              <img loading="lazy" decoding="async"
                                src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.BaseWeapon}/1`}
                                className="h-8 w-8 object-contain"
                                onError={handleImgError}
                              />
                              <span className="text-[11px] uppercase tracking-wide text-slate-400 text-lg">{langs.content[weapon.DisplayNameKey]}</span>
                            </div>
                            <ImageWithLoader
                              src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                              className="h-64 w-full rounded-lg bg-slate-950/80"
                              imgClassName="max-h-64 max-w-64 object-contain"
                              onError={handleImgError}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <RawDataDetails data={selectedSkin} filename={`skins-${selectedSkin?.costumeData?.CostumeID || 'item'}`} />
            </div>
          ) : (
            <div className="text-center text-slate-300 italic">Pick a skin</div>
          )}
          {selectedSkin && <PopupFullDataFooter />}
        </div>
      </div>
    </div>
  );
}
