import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useMediaQuery } from 'react-responsive';
import { AddedBadge, ImageWithLoader, RawDataDetails, getAddedPatch, getPatchFilterCounts, getPatchGroups, patchFilterMatches, PatchOptions } from './comp/LoadingImage';
import { ChainPill, ChainStages, ListTools, SourceLine, groupChains, hasSources, sortSourceFilterValues, sourceFilterValues, useChainLookup, useDataView, weaponName } from '../../ui';
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

const WEAPON_SORTS = [
  { value: 'ArrayIndexDesc', label: 'Newest First' },
  { value: 'ArrayIndexAsc', label: 'Oldest first' },
  { value: 'AlphaAsc', label: 'Name, A to Z' },
  { value: 'AlphaDesc', label: 'Name, Z to A' },
  { value: 'CostDesc', label: 'Mammoth Coins, high to low' },
  { value: 'CostAsc', label: 'Mammoth Coins, low to high' },
  { value: 'WeaponSkinIDDesc', label: 'Weapon skin ID, high to low' },
  { value: 'WeaponSkinIDAsc', label: 'Weapon skin ID, low to high' },
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

function useOptionCounts(weapons, filters, helpers) {
  return useMemo(() => {
    const counts = {
      BaseWeapon: {},
      OwnerHero: {},
      Cohort: {},
      Rarity: {},
      StoreID: {},
      StoreLabel: {},
      PromoType: {},
      ChestName: {},
      BPSeason: {},
      Entitlement: {},
      How: {},
      StoreOnly: 0,
      AllChests: 0,
      AllChestExclusives: 0,
      AllBP: 0,
      DLC: 0,
      IndividualWeapons: 0,
      Upgrades: 0
    };
    const filterKeys = [
      'BaseWeapon', 'OwnerHero', 'Cohort', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'ChestName', 'BPSeason', 'Entitlement'
    ];
    const applyFilters = (weapon, excludeKey) => {
      for (const [key, filterVal] of Object.entries(filters)) {
        if (key === excludeKey) continue;
        if (key === 'ChestName' && filterVal) {
          if (filterVal === 'AllChests') {
            if (!weapon.skin?.chest) return false;
          } else if (filterVal === 'AllChestExclusives') {
            if (!(weapon.skin?.chest && Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0))) return false;
          } else {
            if (helpers.ChestName(weapon) !== filterVal) return false;
          }
        } else if (key === 'BPSeason' && filterVal) {
          if (filterVal === 'AllBP') {
            if (!weapon.bp && !weapon.skin?.bp) return false;
          } else {
            if (helpers.BPSeason(weapon) !== filterVal) return false;
          }
        } else if (key === 'Upgrades') {
          if (filterVal && !helpers.Chain(weapon)) return false;
        } else if (key === 'IndividualWeapons' && filterVal) {
          if (weapon.skin?.OwnerHero) return false;
        } else if (key === 'StoreOnly' && filterVal) {
          if ((!Array.isArray(weapon.store) || weapon.store.length === 0) && (!Array.isArray(weapon.skin?.store) || weapon.skin.store.length === 0)) return false;
        } else if (key === 'Entitlement' && filterVal) {
          if (!weapon.entitlement && !weapon.skin?.entitlement) return false;
        } else if (key === 'How') {
          if (filterVal && !helpers.How(weapon).includes(filterVal)) return false;
        } else if (key === 'PromoType' && filterVal) {
          if (helpers.PromoType(weapon) !== filterVal) return false;
        } else if (Array.isArray(filterVal) && filterVal.length && !filterVal.includes(helpers[key](weapon))) {
          return false;
        } else if (!Array.isArray(filterVal) && filterVal) {
          if (key === 'StoreLabel') {
            const allLabels = [
              ...(Array.isArray(weapon.store) ? weapon.store : []),
              ...(Array.isArray(weapon.skin?.store) ? weapon.skin.store : [])
            ].map(sd => sd.Label).filter(Boolean);
            if (!allLabels.includes(filterVal)) return false;
          } else {
            if (helpers[key](weapon) !== filterVal) return false;
          }
        }
      }
      return true;
    };
    weapons.forEach(weapon => {
      const passesAll = applyFilters(weapon, null);
      if (passesAll) {
        counts.AllBP += (weapon.bp || weapon.skin?.bp) ? 1 : 0;
        counts.StoreOnly += (Array.isArray(weapon.store) && weapon.store.length > 0) || (Array.isArray(weapon.skin?.store) && weapon.skin.store.length > 0) ? 1 : 0;
        counts.AllChests += (weapon.skin?.chest) ? 1 : 0;
        counts.AllChestExclusives += (weapon.skin?.chest && Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0)) ? 1 : 0;
        counts.DLC += (weapon.entitlement || weapon.skin?.entitlement) ? 1 : 0;
        counts.IndividualWeapons += weapon.skin?.OwnerHero ? 0 : 1;
        counts.Upgrades += helpers.Chain(weapon)?.stage === 1 ? 1 : 0;
      }
      filterKeys.forEach(key => {
        if (applyFilters(weapon, key)) {
          if (key === 'StoreLabel') {
            [
              ...(Array.isArray(weapon.store) ? weapon.store : []),
              ...(Array.isArray(weapon.skin?.store) ? weapon.skin.store : [])
            ].forEach(sd => {
              if (sd && sd.Label) counts.StoreLabel[sd.Label] = (counts.StoreLabel[sd.Label] || 0) + 1;
            });
            if (weapon.weaponData?.Label) counts.StoreLabel[weapon.weaponData.Label] = (counts.StoreLabel[weapon.weaponData.Label] || 0) + 1;
            if (weapon.promo?.Label) counts.StoreLabel[weapon.promo.Label] = (counts.StoreLabel[weapon.promo.Label] || 0) + 1;
            if (weapon.bp?.Label) counts.StoreLabel[weapon.bp.Label] = (counts.StoreLabel[weapon.bp.Label] || 0) + 1;
            if (weapon.skin?.promo?.Label) counts.StoreLabel[weapon.skin.promo.Label] = (counts.StoreLabel[weapon.skin.promo.Label] || 0) + 1;
            if (weapon.skin?.bp?.Label) counts.StoreLabel[weapon.skin.bp.Label] = (counts.StoreLabel[weapon.skin.bp.Label] || 0) + 1;
          } else if (key === 'BaseWeapon') {
            const val = weapon.weaponData.BaseWeapon;
            if (val) counts.BaseWeapon[val] = (counts.BaseWeapon[val] || 0) + 1;
          } else if (key === 'OwnerHero') {
            const val = weapon.skin?.OwnerHero;
            if (val) counts.OwnerHero[val] = (counts.OwnerHero[val] || 0) + 1;
          } else {
            const val = helpers[key](weapon);
            if (val) counts[key][val] = (counts[key][val] || 0) + 1;
          }
        }
      });
      if (applyFilters(weapon, 'How')) {
        helpers.How(weapon).forEach(val => { counts.How[val] = (counts.How[val] || 0) + 1; });
      }
    });
    return counts;
  }, [weapons, filters, helpers]);
}

export function WeaponStoreView({ weapons, langs, legends }) {
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const dataFull = useDataView().full;
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBaseWeapons, setFilterBaseWeapons] = useState([]);
  const [filterOwnerHeroes, setFilterOwnerHeroes] = useState([]);
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
  const [filterHow, setFilterHow] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [viewMode] = useState('grid');
  const [filterPatch, setFilterPatch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterIndividualWeapons, setFilterIndividualWeapons] = useState(false);
  const [filterUpgrades, setFilterUpgrades] = useState(false);
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
    setFilterBaseWeapons(readArrayParam(params, 'baseWeapon'));
    setFilterOwnerHeroes(readArrayParam(params, 'ownerHero'));
    setFilterCohort(params.get('cohort') || '');
    setFilterPromo(params.get('promo') || '');
    setFilterRarity(params.get('rarity') || '');
    setFilterStoreID(params.get('store') || '');
    setStoreOnly(readBoolParam(params, 'storeOnly'));
    setFilterStoreLabel(params.get('storeLabel') || '');
    setFilterPromoType(params.get('promoType') || '');
    setFilterChestName(params.get('chest') || '');
    setFilterBPSeason(params.get('battlePass') || '');
    setFilterEntitlement(readBoolParam(params, 'entitlement'));
    setFilterHow(params.get('how') || '');
    setFilterPatch(params.get('patch') || '');
    setFilterIndividualWeapons(readBoolParam(params, 'individualWeapons'));
    setFilterUpgrades(readBoolParam(params, 'upgrades'));
    urlHydrated.current = true;
    window.setTimeout(() => {
      urlSyncing.current = false;
    }, 0);
  }, []);

  const chainLookup = useChainLookup(weapons, (w) => w?.weaponData?.WeaponSkinName);
  const chainOf = useCallback((w) => chainLookup.get(w?.weaponData?.WeaponSkinName), [chainLookup]);
  const helpers = useMemo(() => ({
    BaseWeapon: w => w.weaponData.BaseWeapon,
    OwnerHero: w => w.skin?.OwnerHero,
    Cohort: w => w.weaponData.Cohort ?? w.store?.Cohort ?? w.promo?.Cohort ?? w.bp?.Cohort ?? w.skin?.store?.Cohort ?? w.skin?.promo?.Cohort ?? w.skin?.bp?.Cohort ?? '',
    Rarity: w => w.weaponData.Rarity ?? w.store?.Rarity ?? w.promo?.Rarity ?? w.bp?.Rarity ?? w.skin?.store?.Rarity ?? w.skin?.promo?.Rarity ?? w.skin?.bp?.Rarity ?? '',
    StoreID: w => w.weaponData.StoreID ?? w.store?.StoreID ?? w.promo?.StoreID ?? w.bp?.StoreID ?? w.skin?.store?.StoreID ?? w.skin?.promo?.StoreID ?? w.skin?.bp?.StoreID ?? -1,
    StoreLabel: w => w.weaponData.Label ?? w.store?.Label ?? w.promo?.Label ?? w.bp?.Label ?? w.skin?.store?.Label ?? w.skin?.promo?.Label ?? w.skin?.bp?.Label ?? '',
    PromoType: w => w.promo?.Type ?? w.skin?.promo?.Type ?? '',
    ChestName: w => w.skin?.chest?.ChanceBoxName ?? '',
    BPSeason: w => w.bp?.ID ?? w.skin?.bp?.ID ?? '',
    Entitlement: w => !!(w.entitlement || w.skin?.entitlement),
    How: sourceFilterValues,
    Chain: chainOf,
    Patch: getAddedPatch
  }), [chainOf]);

  const weaponsWithIndex = useMemo(
    () => weapons.map((w, i) => ({ ...w, ArrayIndex: i })),
    [weapons]
  );
  const patchGroups = useMemo(() => getPatchGroups(weaponsWithIndex), [weaponsWithIndex]);
  const patchCounts = useMemo(() => getPatchFilterCounts(weaponsWithIndex), [weaponsWithIndex]);

  const baseWeapons = useMemo(() => uniqueValues(weaponsWithIndex, ['weaponData', 'BaseWeapon']), [weaponsWithIndex]);
  const ownerHeroes = useMemo(() => uniqueValues(weaponsWithIndex, ['skin', 'OwnerHero']).filter(Boolean), [weaponsWithIndex]);
  const cohorts = useMemo(() => {
    const cohortSet = new Set([
      ...uniqueValues(weaponsWithIndex, ['weaponData', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['store', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['promo', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['bp', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'store', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'promo', 'Cohort']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'bp', 'Cohort'])
    ]);
    return [...cohortSet].filter(Boolean);
  }, [weaponsWithIndex]);
  const rarities = useMemo(() => {
    const raritySet = new Set([
      ...uniqueValues(weaponsWithIndex, ['weaponData', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['store', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['promo', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['bp', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'store', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'promo', 'Rarity']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'bp', 'Rarity'])
    ]);
    return [...raritySet].filter(Boolean);
  }, [weaponsWithIndex]);
  const storeLabels = useMemo(() => {
    const labelSet = new Set();
    weaponsWithIndex.forEach(w => {
      [
        ...(Array.isArray(w.store) ? w.store : []),
        ...(Array.isArray(w.skin?.store) ? w.skin.store : [])
      ].forEach(sd => {
        if (sd && sd.Label) labelSet.add(sd.Label);
      });
      if (w.weaponData?.Label) labelSet.add(w.weaponData.Label);
      if (w.promo?.Label) labelSet.add(w.promo.Label);
      if (w.bp?.Label) labelSet.add(w.bp.Label);
      if (w.skin?.promo?.Label) labelSet.add(w.skin.promo.Label);
      if (w.skin?.bp?.Label) labelSet.add(w.skin.bp.Label);
    });
    return [...labelSet].filter(Boolean);
  }, [weaponsWithIndex]);
  const promoTypes = useMemo(() => {
    const typeSet = new Set([
      ...uniqueValues(weaponsWithIndex, ['promo', 'Type']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'promo', 'Type'])
    ]);
    return [...typeSet].filter(Boolean);
  }, [weaponsWithIndex]);
  const chestNames = useMemo(() => {
    const chestSet = new Set([
      ...uniqueValues(weaponsWithIndex, ['skin', 'chest', 'ChanceBoxName'])
    ]);
    return [...chestSet].filter(Boolean);
  }, [weaponsWithIndex]);
  const bpSeasons = useMemo(() => {
    const seasonSet = new Set([
      ...uniqueValues(weaponsWithIndex, ['bp', 'ID']),
      ...uniqueValues(weaponsWithIndex, ['skin', 'bp', 'ID'])
    ]);
    return [...seasonSet].filter(Boolean).sort((a, b) => {
      const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
      const nA = getNum(a), nB = getNum(b);
      if (nA !== nB) return nA - nB;
      return a.localeCompare(b);
    });
  }, [weaponsWithIndex]);

  const optionCounts = useOptionCounts(
    weaponsWithIndex,
    {
      BaseWeapon: filterBaseWeapons,
      OwnerHero: filterOwnerHeroes,
      Cohort: filterCohort,
      Rarity: filterRarity,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      ChestName: filterChestName,
      BPSeason: filterBPSeason,
      StoreOnly: storeOnly,
      Entitlement: filterEntitlement,
      How: filterHow,
      IndividualWeapons: filterIndividualWeapons,
      Upgrades: filterUpgrades,
      Patch: filterPatch
    },
    helpers
  );

  const getStoreID = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].StoreID
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].StoreID
        : w.weaponData.StoreID ?? w.promo?.StoreID ?? w.bp?.StoreID ?? w.skin?.promo?.StoreID ?? w.skin?.bp?.StoreID ?? -1;

  const getDisplayNameKey = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].DisplayNameKey
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].DisplayNameKey
        : w.weaponData.DisplayNameKey ?? w.promo?.DisplayNameKey ?? w.bp?.DisplayNameKey ?? w.skin?.promo?.DisplayNameKey ?? w.skin?.bp?.DisplayNameKey;

  const getDescriptionKey = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].DescriptionKey
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].DescriptionKey
        : w.weaponData.DescriptionKey ?? w.promo?.DescriptionKey ?? w.bp?.DescriptionKey ?? w.skin?.promo?.DescriptionKey ?? w.skin?.bp?.DescriptionKey;

  const getIdolCost = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].IdolCost
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].IdolCost
        : w.weaponData.IdolCost ?? w.promo?.IdolCost ?? w.bp?.IdolCost ?? w.skin?.promo?.IdolCost ?? w.skin?.bp?.IdolCost ?? '';

  const getCohort = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].Cohort
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].Cohort
        : w.weaponData.Cohort ?? w.promo?.Cohort ?? w.bp?.Cohort ?? w.skin?.promo?.Cohort ?? w.skin?.bp?.Cohort ?? '';

  const getRarity = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].Rarity
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].Rarity
        : w.weaponData.Rarity ?? w.promo?.Rarity ?? w.bp?.Rarity ?? w.skin?.promo?.Rarity ?? w.skin?.bp?.Rarity ?? '';

  const getLabel = w =>
    Array.isArray(w.store) && w.store.length > 0
      ? w.store[0].Label
      : Array.isArray(w.skin?.store) && w.skin.store.length > 0
        ? w.skin.store[0].Label
        : w.weaponData.Label ?? w.promo?.Label ?? w.bp?.Label ?? w.skin?.promo?.Label ?? w.skin?.bp?.Label ?? '';

  const getPromoType = w => w.promo?.Type ?? w.skin?.promo?.Type ?? '';
  const getChestName = w => w.skin?.chest?.ChanceBoxName ?? '';
  const getBPSeason = w => w.bp?.ID ?? w.skin?.bp?.ID ?? '';

  const filteredWeapons = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return weaponsWithIndex.filter(weapon => {
      if (filterPatch && !patchFilterMatches(getAddedPatch(weapon), filterPatch)) return false;
      if (filterBaseWeapons.length && !filterBaseWeapons.includes(weapon.weaponData.BaseWeapon)) return false;
      if (filterOwnerHeroes.length && !filterOwnerHeroes.includes(weapon.skin?.OwnerHero)) return false;
      if (filterCohort && getCohort(weapon) !== filterCohort) return false;
      if (filterRarity && getRarity(weapon) !== filterRarity) return false;
      if (filterStoreID && getStoreID(weapon) !== filterStoreID) return false;
      if (filterIndividualWeapons && weapon.skin?.OwnerHero) return false;
      if (filterUpgrades && !chainOf(weapon)) return false;
      const allStoreLabels = [
        ...(Array.isArray(weapon.store) ? weapon.store : []),
        ...(Array.isArray(weapon.skin?.store) ? weapon.skin.store : [])
      ].map(sd => sd.Label).filter(Boolean);

      if (filterStoreLabel && !allStoreLabels.includes(filterStoreLabel)) return false;
      if (filterPromoType && getPromoType(weapon) !== filterPromoType) return false;
      if (filterChestName) {
        if (filterChestName === 'AllChests') {
          if (!weapon.skin?.chest) return false;
        } else if (filterChestName === 'AllChestExclusives') {
          if (!(weapon.skin?.chest && Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0))) return false;
        } else {
          if (getChestName(weapon) !== filterChestName) return false;
        }
      }
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP') {
          if (!weapon.bp && !weapon.skin?.bp) return false;
        } else {
          if (getBPSeason(weapon) !== filterBPSeason) return false;
        }
      }
      if (filterEntitlement && !weapon.entitlement && !weapon.skin?.entitlement) return false;
      if (filterHow && !sourceFilterValues(weapon).includes(filterHow)) return false;
      if (storeOnly && (!Array.isArray(weapon.store) || weapon.store.length === 0) && (!Array.isArray(weapon.skin?.store) || weapon.skin.store.length === 0)) return false;
      const fields = [
        langs.content[getDisplayNameKey(weapon)] || '',
        weapon.store?.StoreName || '',
        weapon.store?.Item || '',
        weapon.weaponData.WeaponSkinName || '',
        weapon.weaponData.BaseWeapon || '',
        weaponName(weapon.weaponData.BaseWeapon),
        weapon.skin?.OwnerHero || '',
        weapon.weaponData.Description || '',
        (weapon.store?.SearchTags || ''),
        getLabel(weapon) || '',
        getCohort(weapon) || '',
        getRarity(weapon) || '',
        getPromoType(weapon) || '',
        getChestName(weapon) || '',
        getBPSeason(weapon) || '',
        String(getStoreID(weapon) || ''),
        String(getIdolCost(weapon) || ''),
        String(weapon.weaponData.WeaponSkinID || ''),
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    }).sort((a, b) => {
      const idxA = typeof a.ArrayIndex === 'number' ? a.ArrayIndex : parseInt(a.ArrayIndex) || 0;
      const idxB = typeof b.ArrayIndex === 'number' ? b.ArrayIndex : parseInt(b.ArrayIndex) || 0;
      const nameA = langs.content[getDisplayNameKey(a)] || '';
      const nameB = langs.content[getDisplayNameKey(b)] || '';
      const costA = parseInt(getIdolCost(a)) || 0;
      const costB = parseInt(getIdolCost(b)) || 0;
      const storeA = parseInt(getStoreID(a)) || 0;
      const storeB = parseInt(getStoreID(b)) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'WeaponSkinIDAsc': return parseInt(a.weaponData.WeaponSkinID) - parseInt(b.weaponData.WeaponSkinID);
        case 'WeaponSkinIDDesc': return parseInt(b.weaponData.WeaponSkinID) - parseInt(a.weaponData.WeaponSkinID);
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        default: return 0;
      }
    });
  }, [
    weaponsWithIndex, debouncedSearch, sortType, filterBaseWeapons, filterOwnerHeroes, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, filterHow, filterPatch, langs, filterIndividualWeapons, filterUpgrades, chainOf
  ]);
  const cardWeapons = useMemo(() => groupChains(filteredWeapons, chainOf), [filteredWeapons, chainOf]);
  const totalWeaponCards = useMemo(() => groupChains(weapons || [], chainOf).length, [weapons, chainOf]);
  const shownChainIds = useMemo(() => new Set(filteredWeapons.map((w) => chainOf(w)?.id).filter(Boolean)), [filteredWeapons, chainOf]);
  const exportColumns = useMemo(() => [
    { key: 'name', label: 'Weapon Skin', value: (weapon) => langs.content[weapon.weaponData?.DisplayNameKey] || weapon.weaponData?.WeaponSkinName },
    { key: 'weapon', label: 'Weapon', value: (weapon) => (weapon.weaponData?.BaseWeapon ? weaponName(weapon.weaponData.BaseWeapon) : '') },
    { key: 'comesWith', label: 'Comes with', value: (weapon) => (weapon.skin?.DisplayNameKey ? langs.content[weapon.skin.DisplayNameKey] || '' : '') },
    { key: 'weaponSkinId', label: 'Weapon skin ID', value: (weapon) => weapon.weaponData?.WeaponSkinID },
    { key: 'codeName', label: 'Code name', value: (weapon) => weapon.weaponData?.WeaponSkinName },
    chainExportColumn(chainOf),
    ...storeExportColumns,
  ], [langs, chainOf]);
  const findListedWeapon = useCallback((weaponId) => {
    const direct = filteredWeapons.find(w => String(w.weaponData.WeaponSkinID) === weaponId);
    if (direct) return direct;
    const stage = weaponsWithIndex.find(w => String(w.weaponData.WeaponSkinID) === weaponId);
    return stage && shownChainIds.has(chainOf(stage)?.id) ? stage : null;
  }, [filteredWeapons, weaponsWithIndex, shownChainIds, chainOf]);
  const isListedWeapon = useCallback((weapon) => !!weapon && (filteredWeapons.some(w => w.weaponData.WeaponSkinID === weapon.weaponData.WeaponSkinID) || shownChainIds.has(chainOf(weapon)?.id)), [filteredWeapons, shownChainIds, chainOf]);
  const pickStage = useCallback((stage) => {
    const weapon = weaponsWithIndex.find(w => w.weaponData?.WeaponSkinName === stage.name);
    if (weapon) setSelectedWeapon(weapon);
  }, [weaponsWithIndex]);

  const handleFilterChange = useCallback((setter, value) => {
    setter(value);
  }, []);

  useEffect(() => {
    if (weapons.length === 0 || filteredWeapons.length === 0) return;
    if (isMobile && filtersChanged.current) {
      filtersChanged.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const weaponId = params.get('weapon') ? String(params.get('weapon')) : null;
    let weapon = null;
    if (weaponId) {
      weapon = findListedWeapon(weaponId);
    }
    setSelectedWeapon(weapon);
  }, [weapons, filteredWeapons, isMobile]);

  useEffect(() => {
    if (selectedWeapon && !isListedWeapon(selectedWeapon)) {
      setSelectedWeapon(null);
    }
  }, [filteredWeapons, isMobile, selectedWeapon, isListedWeapon]);

  useEffect(() => {
    if (!urlHydrated.current || urlSyncing.current) return;
    const currentParams = new URLSearchParams();
    currentParams.set('page', pageSlugForLabel('Weapon Skins'));
    if (selectedWeapon) {
      currentParams.set('weapon', String(selectedWeapon.weaponData.WeaponSkinID));
    }
    writeStringParam(currentParams, 'search', searchQuery.trim());
    writeStringParam(currentParams, 'sort', sortType, 'ArrayIndexDesc');
    writeArrayParam(currentParams, 'baseWeapon', filterBaseWeapons);
    writeArrayParam(currentParams, 'ownerHero', filterOwnerHeroes);
    writeStringParam(currentParams, 'cohort', filterCohort);
    writeStringParam(currentParams, 'promo', filterPromo);
    writeStringParam(currentParams, 'rarity', filterRarity);
    writeStringParam(currentParams, 'store', filterStoreID);
    writeBoolParam(currentParams, 'storeOnly', storeOnly);
    writeStringParam(currentParams, 'storeLabel', filterStoreLabel);
    writeStringParam(currentParams, 'promoType', filterPromoType);
    writeStringParam(currentParams, 'chest', filterChestName);
    writeStringParam(currentParams, 'battlePass', filterBPSeason);
    writeBoolParam(currentParams, 'entitlement', filterEntitlement);
    writeStringParam(currentParams, 'how', filterHow);
    writeStringParam(currentParams, 'patch', filterPatch);
    writeBoolParam(currentParams, 'individualWeapons', filterIndividualWeapons);
    writeBoolParam(currentParams, 'upgrades', filterUpgrades);
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const weaponId = params.get('weapon') ? String(params.get('weapon')) : null;
      if (weaponId && filteredWeapons.length > 0) {
        const weapon = findListedWeapon(weaponId);
        if (weapon) {
          setSelectedWeapon(weapon);
        } else {
          setSelectedWeapon(null);
        }
      } else {
          setSelectedWeapon(null);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedWeapon, filteredWeapons, isMobile, searchQuery, sortType, filterBaseWeapons, filterOwnerHeroes, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, filterHow, filterPatch, filterIndividualWeapons, filterUpgrades, findListedWeapon]);

  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterBaseWeapons([]);
    setFilterOwnerHeroes([]);
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
    setFilterHow('');
    setFilterPatch('');
    setFilterIndividualWeapons(false);
    setFilterUpgrades(false);
    setSelectedWeapon(null);
    filtersChanged.current = true;
  }, [filteredWeapons, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedWeapon) return;
    const url = `${window.location.origin}${window.location.pathname}?weapon=${selectedWeapon.weaponData.WeaponSkinID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link copied');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback("Couldn't copy");
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedWeapon]);

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

  const handleImgError = e => { e.target.style.display = 'none'; };

  const Row = ({ index, data }) => {
    const weapon = data[index];
    const allStores = [
      ...(Array.isArray(weapon.store) ? weapon.store : []),
      ...(Array.isArray(weapon.skin?.store) ? weapon.skin.store : [])
    ];

    const labels = [...new Set(allStores.map(sd => sd.Label).filter(Boolean))];
    const timedPromos = [...new Set(allStores.map(sd => sd.TimedPromotion).filter(Boolean))];

    const ownStores = Array.isArray(weapon.store) ? weapon.store : [];
    const comesWithSkin = !ownStores.length && Array.isArray(weapon.skin?.store) && weapon.skin.store.length > 0;

    return (
      <div className={viewMode === 'grid' ? 'h-full w-full' : 'p-0 px-2 min-h-[185px]'}>
        <div
          className={`relative h-full self-start text-left bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer p-2 pt-10 sm:pt-12 transition border border-slate-700 shadow-sm hover:-translate-y-0.5 ${selectedWeapon?.weaponData?.WeaponSkinID === weapon.weaponData?.WeaponSkinID || (chainOf(weapon) && chainOf(weapon)?.id === chainOf(selectedWeapon)?.id) ? 'ring-2 ring-blue-400' : ''} flex flex-col`}
          onClick={() => {
            setSelectedWeapon(weapon);
            filtersChanged.current = false;
          }}
        >
          {viewMode === 'grid' && (
            <div className="mb-2 flex max-w-full flex-col items-center gap-1 px-1 text-center sm:px-2">
              <div className="flex flex-row items-center justify-center gap-1.5 text-sm font-bold leading-tight text-white sm:gap-2 sm:text-base">
                <img loading="lazy" decoding="async" src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.weaponData.BaseWeapon}/1`} className="inline h-5 shrink-0 sm:h-7" onError={handleImgError} />
                <span className="break-words">{langs.content[weapon.weaponData.DisplayNameKey] || weapon.weaponData.WeaponSkinName}</span>
              </div>
              {weapon.skin && (
                <div className="flex flex-row items-center justify-center gap-1.5 text-xs font-bold leading-tight text-slate-300 sm:gap-2 sm:text-sm">
                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${weapon.skin.CostumeIconFileName}/${weapon.skin.CostumeIcon}`} className="inline h-5 shrink-0 sm:h-6" onError={handleImgError} />
                  <span className="break-words">{langs.content[weapon.skin.DisplayNameKey]}</span>
                </div>
              )}
            </div>
          )}
          <div className={`flex p-2 rounded-lg items-center justify-center ${getRarityStyles(weapon.weaponData?.Rarity).className}`} style={getRarityStyles(weapon.weaponData?.Rarity).style}>
            <ImageWithLoader src={`${host}/game/anim/weapon/${weapon.weaponData.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.weaponData.BaseWeapon}Pose/all`} alt="" className="h-24 w-24 rounded-lg bg-slate-950/80 sm:h-32 sm:w-32" />
          </div>
          <div className="flex-1 flex w-full flex-col items-center text-center mt-2 min-w-0">
            {viewMode === 'list' && !hasSources(weapon) && (
              <div className="flex w-full max-w-full flex-wrap justify-center gap-1 pb-1">
                {(weapon.bp || weapon.skin?.bp) && (
                  <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${(weapon.bp || weapon.skin?.bp).ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}
                {(weapon.promo || weapon.skin?.promo) && (
                  <div className="border border-violet-300/40 bg-violet-500/20 text-violet-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${!allStores.length && !weapon.bp && !weapon.skin?.bp && !weapon.entitlement && !weapon.skin?.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {(weapon.entitlement || weapon.skin?.entitlement) && (
                  <div className="border border-amber-300/40 bg-amber-500/20 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[(weapon.entitlement || weapon.skin?.entitlement).DisplayNameKey]?.replace('!', '') || (weapon.entitlement || weapon.skin?.entitlement).EntitlementName} DLC`}
                  </div>
                )}
                {(weapon.skin?.chest) && (
                  <div className="border border-orange-300/40 bg-orange-500/20 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[weapon.skin.chest.DisplayNameKey]} Exclusive` : langs.content[weapon.skin.chest.DisplayNameKey]}
                  </div>
                )}
                {labels.length > 0 && labels.map((label, idx) => (
                  <div key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "Last Chance" : label}
                  </div>
                ))}
                {timedPromos.length > 0 && timedPromos.map((promo, idx) => (
                  <div key={idx} className="border border-rose-300/40 bg-rose-500/20 text-rose-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1">

              <div className={`flex-row items-center gap-2 text-white font-bold ${viewMode === 'grid' ? 'hidden' : 'flex text-lg'}`}>
                <img loading="lazy" decoding="async" src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.weaponData.BaseWeapon}/1`} className="inline h-7" onError={handleImgError} />
                <span >{langs.content[weapon.weaponData.DisplayNameKey] || weapon.weaponData.WeaponSkinName}</span>
              </div>
              <AddedBadge item={weapon} className="absolute left-1/2 top-2 z-10 -translate-x-1/2 pointer-events-none" />
              {weapon.skin && (
                <div className={`flex-row items-center gap-2 text-slate-300 font-bold ${viewMode === 'grid' ? 'hidden' : 'flex text-base'}`}>
                  <img loading="lazy" decoding="async" src={`${host}/game/getGfx/${weapon.skin.CostumeIconFileName}/${weapon.skin.CostumeIcon}`} className="inline h-6" onError={handleImgError} />
                  <span>{langs.content[weapon.skin.DisplayNameKey]}</span>
                </div>
              )}
            </div>

            {hasSources(weapon) && <SourceLine sources={weapon.sources} phoneCompact className="mt-1" />}
            {chainOf(weapon) && <div className="mt-1 flex justify-center"><ChainPill chain={chainOf(weapon)} /></div>}
            <div className={`${hasSources(weapon) ? 'hidden' : 'flex'} flex-wrap items-center justify-center gap-x-3 text-white`}>
              {comesWithSkin && <span className="text-xs font-semibold text-slate-400">Comes with {langs.content[weapon.skin.DisplayNameKey] || 'its skin'}</span>}
              {ownStores.map((sd, idx) =>
                sd.Type !== 'Bundle' && Number(sd.IdolCost) > 0 && (
                  <div key={`idol-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.IdolCost}</span>
                  </div>
                )
              )}
              {ownStores.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {ownStores.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {ownStores.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.SpecialCurrencyCost}</span>
                  </div>
                )
              )}
              {ownStores
                .filter(sd => sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0)
                .map((bundleStore, idx) => {
                  const bundleCost = bundleMammothPrice(bundleStore);
                  if (!bundleCost) return null;
                  return (
                    <div key={`bundle-${idx}`}>
                      <img loading="lazy" decoding="async" src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-slate-400"> (Bundle)</span>
                    </div>
                  );
                })
              }
            </div>
            {viewMode === 'grid' && !hasSources(weapon) && (
              <div className="order-first my-1 flex w-full max-w-full flex-wrap justify-center gap-1 pb-1">
                {(weapon.bp || weapon.skin?.bp) && (
                  <div className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${(weapon.bp || weapon.skin?.bp).ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}
                {(weapon.promo || weapon.skin?.promo) && (
                  <div className="border border-violet-300/40 bg-violet-500/20 text-violet-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${!allStores.length && !weapon.bp && !weapon.skin?.bp && !weapon.entitlement && !weapon.skin?.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {(weapon.entitlement || weapon.skin?.entitlement) && (
                  <div className="border border-amber-300/40 bg-amber-500/20 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[(weapon.entitlement || weapon.skin?.entitlement).DisplayNameKey]?.replace('!', '') || (weapon.entitlement || weapon.skin?.entitlement).EntitlementName} DLC`}
                  </div>
                )}
                {(weapon.skin?.chest) && (
                  <div className="border border-orange-300/40 bg-orange-500/20 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[weapon.skin.chest.DisplayNameKey]} Exclusive` : langs.content[weapon.skin.chest.DisplayNameKey]}
                  </div>
                )}
                {labels.length > 0 && labels.map((label, idx) => (
                  <div key={idx} className={`${label === "New" ? "border-yellow-300/40 bg-yellow-500/20 text-yellow-100" : label === "LastChance" ? "border-red-300/40 bg-red-500/20 text-red-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"} border text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "Last Chance" : label}
                  </div>
                ))}
                {timedPromos.length > 0 && timedPromos.map((promo, idx) => (
                  <div key={idx} className="border border-rose-300/40 bg-rose-500/20 text-rose-100 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))}
              </div>
            )}
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
          searchPlaceholder="Search Weapon Skins"
          sort={sortType}
          onSort={setSortType}
          sortOptions={WEAPON_SORTS}
          shown={cardWeapons.length}
          total={totalWeaponCards}
          noun="weapon skins"
          tools={<ListTools filename="brawlhalla-weapon-skins" rows={filteredWeapons} columns={exportColumns} />}
          activeCount={countFilters([filterBaseWeapons, filterOwnerHeroes, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly, filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, filterHow, filterPatch, filterIndividualWeapons, filterUpgrades])}
          onReset={resetFilters}
          chips={(baseWeapons.some(id => optionCounts.BaseWeapon[id] > 0) || ownerHeroes.some(hero => optionCounts.OwnerHero[hero] > 0)) && <>
            {baseWeapons
              .filter(id => optionCounts.BaseWeapon[id] > 0)
              .map((id) => {
                const selected = filterBaseWeapons.includes(id);
                return (
                  <IconChip
                    key={id}
                    selected={selected}
                    onClick={() => handleFilterChange(setFilterBaseWeapons, selected ? filterBaseWeapons.filter(hid => hid !== id) : [...filterBaseWeapons, id])}
                    title={weaponName(id)}
                    count={optionCounts.BaseWeapon[id]}
                  >
                    <ImageWithLoader src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${id}/1`} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" small onError={handleImgError} />
                  </IconChip>
                );
              })}
            {baseWeapons.some(id => optionCounts.BaseWeapon[id] > 0) && ownerHeroes.some(hero => optionCounts.OwnerHero[hero] > 0) && <span aria-hidden="true" className="basis-full" />}
            {ownerHeroes
              .filter(hero => optionCounts.OwnerHero[hero] > 0)
              .map((hero) => {
                const legend = legends.find(l => l.heroData?.HeroName === hero);
                const icon = legend?.costumeType?.CostumeIcon;
                const iconFile = legend?.costumeType?.CostumeIconFileName;
                const selected = filterOwnerHeroes.includes(hero);
                return (
                  <IconChip
                    key={hero}
                    selected={selected}
                    onClick={() => handleFilterChange(setFilterOwnerHeroes, selected ? filterOwnerHeroes.filter(hid => hid !== hero) : [...filterOwnerHeroes, hero])}
                    title={legend ? langs.content[legend.DisplayNameKey] || hero : hero}
                    count={optionCounts.OwnerHero[hero]}
                  >
                    <ImageWithLoader src={icon && iconFile ? `${host}/game/getGfx/${iconFile}/${icon}` : ''} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" small onError={handleImgError} />
                  </IconChip>
                );
              })}
          </>}
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
            {Object.values(optionCounts.StoreLabel).some(count => count > 0) && (
              <FilterSelect label="Store Label" value={filterStoreLabel} onChange={(value) => handleFilterChange(setFilterStoreLabel, value)}>
                {storeLabels.map(n => <FilterOption key={n} value={n} count={optionCounts.StoreLabel[n] || 0} disabled={optionCounts.StoreLabel[n] === 0} />)}
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
            <FilterToggle label="Not from a legend skin" count={optionCounts.IndividualWeapons || 0} checked={filterIndividualWeapons} onChange={(value) => setFilterIndividualWeapons(value)} />
            {(optionCounts.Upgrades > 0 || filterUpgrades) && <FilterToggle label="Has upgrades" count={optionCounts.Upgrades || 0} checked={filterUpgrades} onChange={(value) => handleFilterChange(setFilterUpgrades, value)} />}
          </>}
        />
        <VirtualCardGrid
          items={cardWeapons}
          empty={<NoMatches noun="weapon skins" onReset={resetFilters} />}
          maxColumns={5}
          getKey={(weapon, index) => weapon?.weaponData?.WeaponSkinID || index}
          renderItem={(weapon, index) => Row({ index, data: cardWeapons })}
        />
      </div>
      <div className={`fixed inset-0 bg-black/70 z-[110] ${selectedWeapon ? 'flex items-stretch justify-center p-0 sm:items-center sm:p-3' : 'hidden'}`} onClick={() => setSelectedWeapon(null)}> 
        <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto overscroll-contain app-scrollbar rounded-none border p-2 shadow-2xl border-slate-700 bg-slate-950 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:p-3 lg:p-3" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Close details"
            className="absolute right-3 top-3 z-10 rounded-lg p-2 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setSelectedWeapon(null)}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-11">
            <PopupViewBar />
            {isMobile && selectedWeapon && (
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
          {selectedWeapon ? (
            <div className='grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start'>
              <div className="xl:col-span-2 flex flex-col gap-2 pb-3 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <img loading="lazy" decoding="async"
                    src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${selectedWeapon.weaponData.BaseWeapon}/1`}
                    className="h-8 w-8 object-contain"
                    onError={handleImgError}
                  />
                  <span className="text-2xl font-bold text-white">{langs.content[selectedWeapon.weaponData.DisplayNameKey] || selectedWeapon.weaponData.WeaponSkinName}</span>
                </div>
                {selectedWeapon.skin && (
                  <div className="flex items-center gap-2 mt-2">
                    <img loading="lazy" decoding="async"
                      src={`${host}/game/getGfx/${selectedWeapon.skin.CostumeIconFileName}/${selectedWeapon.skin.CostumeIcon}`}
                      className="h-8 w-8 object-contain"
                      onError={handleImgError}
                    />
                    <span className="text-xl text-white">{langs.content[selectedWeapon.skin.DisplayNameKey]}</span>
                  </div>
                )}
                {langs.content[getDescriptionKey(selectedWeapon)] && (
                  <div className="max-w-prose text-slate-400 text-sm">
                    {langs.content[getDescriptionKey(selectedWeapon)]}
                  </div>
                )}
                <ChainStages chain={chainOf(selectedWeapon)} onPick={pickStage} full={dataFull} firstLabel="Base Weapon" />
                {dataFull && [...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])]
                  .flatMap(sd => splitTags(sd.SearchTags))
                  .filter(Boolean).length > 0 && (
                    <div className="flex flex-col">
                      <span className="text-white">Store Search Tags</span>
                      <div className="mt-1 flex max-w-full flex-wrap gap-2 pb-1">
                        {[...new Set(
                          [...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])]
                            .flatMap(sd => splitTags(sd.SearchTags))
                            .filter(Boolean)
                        )].map((tag, idx) => (
                          <span key={idx} className="bg-slate-800 rounded-full px-3 py-1 text-xs font-bold text-white">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                <div className="flex flex-col gap-3">
                  <div className="flex max-w-full flex-wrap gap-2 pb-1">
                    {selectedWeapon.promo && !hasSources(selectedWeapon) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-purple-300/40 bg-purple-500/20 text-purple-100">
                        Promo Type: {selectedWeapon.promo.Type}
                      </span>
                    )}
                    {selectedWeapon.bp && !hasSources(selectedWeapon) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-emerald-300/40 bg-emerald-500/20 text-emerald-100">
                        Battle Pass Season {selectedWeapon.bp.ID?.replace('BP', '').replace('-', ' ')}{selectedWeapon.bp.Tier ? ` (Tier ${selectedWeapon.bp.Tier})` : ''}
                      </span>
                    )}
                    {selectedWeapon.skin?.chest && !hasSources(selectedWeapon) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-orange-300/40 bg-orange-500/20 text-orange-100">
                        {`${langs.content[`ChanceBoxType_${selectedWeapon.skin.chest.ChanceBoxName}_DisplayName`] || selectedWeapon.skin.chest.ChanceBoxName} (${selectedWeapon.skin.chest.ExclusiveItems.split(',').includes(selectedWeapon.skin?.store?.StoreName || selectedWeapon.skin?.costumeData?.CostumeName) ? 'Exclusive' : 'Common'})`}
                      </span>
                    )}
                    {selectedWeapon.entitlement && !hasSources(selectedWeapon) && (
                      <span className="text-sm px-3 py-1 rounded-lg border border-amber-300/40 bg-amber-500/20 text-amber-100">
                        {`${langs.content[selectedWeapon.entitlement.DisplayNameKey]?.replace('!', '') || selectedWeapon.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="contents">
                <div className="xl:col-start-2 xl:row-start-2 w-full flex flex-col gap-3 relative">
                  <StoreDataSection rows={[...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])]} langs={langs} sources={selectedWeapon.sources} />
                  <FieldGrid data={selectedWeapon.weaponData} langs={langs} title="Weapon Data" />
                  <FieldGrid data={selectedWeapon.entitlement} langs={langs} title="Entitlement Data" />
                  {false && (<div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                    <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Weapon Data</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Weapon Name</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.weaponData.WeaponSkinName}</span>
                      </div>
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Weapon ID</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.weaponData.WeaponSkinID}</span>
                      </div>
                      <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Base Weapon</span>
                        <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{weaponName(selectedWeapon.weaponData.BaseWeapon)}</span>
                      </div>
                    </div>
                  </div>)}
                  {false && ([...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])].length > 0) && (
                    <div className='flex flex-col gap-3'>
                      {[...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])].map((sd, idx) => (
                        <div key={idx} className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                          <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Store data{sd.Type === 'Bundle' ? ' (Bundle)' : ' (Weapon)'}</span>
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
                                    sd.ItemList.map(item => {
                                      if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                                      if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                                      if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                                      if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                                      if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                                      if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                                      if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                                    }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0)
                                  }</span>
                                  <span className="text-green-400 font-bold">{Math.floor(
                                    sd.ItemList.map(item => {
                                      if (item.IdolCost != 0 && item.IdolCost != '') return item.IdolCost;
                                      if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') return item.IdolSaleCost;
                                      if (item.GoldCost != 0 && item.GoldCost != '') return item.GoldCost;
                                      if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') return item.GoldSaleCost;
                                      if (item.GoldBundleDiscount != 0 && item.GoldBundleDiscount != '') return item.GoldBundleDiscount;
                                      if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') return item.RankedPointsCost;
                                      if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '') return item.SpecialCurrencyCost;
                                    }).reduce((total, num) => parseFloat(total) + parseFloat(num), 0) * sd.IdolBundleDiscount
                                  )}</span>
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
                            {sd.Rarity && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Rarity</span>
                                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Rarity}</span>
                              </div>
                            )}
                            {sd.Label && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Label</span>
                                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Label}</span>
                              </div>
                            )}
                            {sd.TimedPromotion && (
                              <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                                <span className="text-[11px] uppercase tracking-wide text-slate-400">Timed Promotion</span>
                                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.TimedPromotion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {false && selectedWeapon.entitlement && (
                    <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                      <span className="text-sm font-bold uppercase tracking-wide text-blue-200">Entitlement Data</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement Name</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.EntitlementName}</span>
                        </div>
                        {selectedWeapon.entitlement.EntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.EntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SteamAppID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Steam App ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.SteamAppID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SonyEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.SonyEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SonyProductID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Product ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.SonyProductID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.NintendoConsumableID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Consumable ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.NintendoConsumableID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.NintendoEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.NintendoEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1EntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.XB1EntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1ProductID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Product ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.XB1ProductID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1StoreID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Store ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.XB1StoreID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.AppleEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Apple Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.AppleEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.AndroidEntitlementID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Android Entitlement ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.AndroidEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.UbiConnectID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.UbiConnectID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.UbiConnectPackageID && (
                          <div className="flex flex-col rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect Package ID</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedWeapon.entitlement.UbiConnectPackageID}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="xl:col-start-1 xl:row-start-2 w-full flex flex-col gap-2 relative rounded-2xl bg-slate-900/80 border border-slate-700 p-3 shadow-sm">
                  <span className='text-white text-lg'>Weapon Images</span>
                  <div className="mt-2 flex justify-center rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                    <ImageWithLoader
                      src={`${host}/game/anim/weapon/${selectedWeapon.weaponData.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${selectedWeapon.weaponData.BaseWeapon}Pose/all`}
                      className="min-h-80 w-full rounded-lg bg-slate-950/80"
                      imgClassName="max-h-96 max-w-full object-contain"
                      onError={handleImgError}
                      alt={selectedWeapon.weaponData.WeaponSkinName}
                    />
                  </div>
                  <div className="mt-2 flex justify-center rounded-xl bg-slate-950/60 border border-slate-700 p-2">
                    <ImageWithLoader
                      src={`${host}/game/anim/weapon/${selectedWeapon.weaponData.WeaponSkinID}/Animation_${selectedWeapon.weaponData.BaseWeapon == 'Pistol' ? 'Pistols' : selectedWeapon.weaponData.BaseWeapon == 'RocketLance' ? 'Lance' : selectedWeapon.weaponData.BaseWeapon}/${selectedWeapon.weaponData.BaseWeapon == 'Sword' ? 'a__1HandRearAnimation' : `a__${selectedWeapon.weaponData.BaseWeapon}Animation`}/All/all`}
                      className="min-h-80 w-full rounded-lg bg-slate-950/80"
                      imgClassName="max-w-full h-auto object-contain"
                      onError={handleImgError}
                      alt={selectedWeapon.weaponData.WeaponSkinName}
                    />
                  </div>
                </div>
              </div>
              <RawDataDetails data={selectedWeapon} filename={`weapon-skins-${selectedWeapon?.weaponData?.WeaponSkinID || 'item'}`} />
            </div>
          ) : (
            <div className="text-center text-slate-400 italic">Pick a weapon skin</div>
          )}
          {selectedWeapon && <PopupFullDataFooter />}
        </div>
      </div>
    </div>
  );
}
