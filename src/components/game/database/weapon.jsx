import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';

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
      StoreOnly: 0,
      AllChests: 0,
      AllChestExclusives: 0,
      AllBP: 0,
      DLC: 0,
      IndividualWeapons: 0
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
        } else if (key === 'IndividualWeapons' && filterVal) {
          if (weapon.skin?.OwnerHero) return false;
        } else if (key === 'StoreOnly' && filterVal) {
          if ((!Array.isArray(weapon.store) || weapon.store.length === 0) && (!Array.isArray(weapon.skin?.store) || weapon.skin.store.length === 0)) return false;
        } else if (key === 'Entitlement' && filterVal) {
          if (!weapon.entitlement && !weapon.skin?.entitlement) return false;
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
    });
    return counts;
  }, [weapons, filters, helpers]);
}

export function WeaponStoreView({ weapons, langs, legends }) {
  const [selectedWeapon, setSelectedWeapon] = useState(null);
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
  const [currentAnimation, setCurrentAnimation] = useState({ anim: '', urlType: 'all' });
  const [copyFeedback, setCopyFeedback] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterHeight, setFilterHeight] = useState(0);
  const [listHeight, setListHeight] = useState(400);
  const [filterIndividualWeapons, setFilterIndividualWeapons] = useState(false);
  const topRef = useRef(null);
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
    if (filterSectionRef.current) {
      setFilterHeight(filterSectionRef.current.offsetHeight);
    }
  }, [
    filterBaseWeapons, filterOwnerHeroes, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, debouncedSearch, sortType, isMobile, filterIndividualWeapons
  ]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (isMobile) {
      setSelectedWeapon(null);
      filtersChanged.current = true;
    }
  }, [
    filterBaseWeapons, filterOwnerHeroes, filterCohort, filterPromo, filterRarity, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, debouncedSearch, sortType, isMobile, filterIndividualWeapons
  ]);

  useEffect(() => {
    const updateHeight = () => {
      const viewportHeight = window.innerHeight;
      const detailHeight = detailPanelRef.current ? detailPanelRef.current.offsetHeight : 0;
      const availableHeight = Math.max(viewportHeight, detailHeight) - filterHeight;
      setListHeight(availableHeight > 200 ? availableHeight : 200);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [selectedWeapon, filterHeight]);

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
    Entitlement: w => !!(w.entitlement || w.skin?.entitlement)
  }), []);

  const weaponsWithIndex = useMemo(
    () => weapons.map((w, i) => ({ ...w, ArrayIndex: i })),
    [weapons]
  );

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
      IndividualWeapons: filterIndividualWeapons
    },
    helpers
  );

  const getPromo = w => w.promo || w.skin?.promo || null;
  const getBP = w => w.bp || w.skin?.bp || null;
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
  const getWeaponName = w => w.weaponData.WeaponSkinName;

  const filteredWeapons = useMemo(() => {
    const search = debouncedSearch.toLowerCase();
    return weaponsWithIndex.filter(weapon => {
      if (filterBaseWeapons.length && !filterBaseWeapons.includes(weapon.weaponData.BaseWeapon)) return false;
      if (filterOwnerHeroes.length && !filterOwnerHeroes.includes(weapon.skin?.OwnerHero)) return false;
      if (filterCohort && getCohort(weapon) !== filterCohort) return false;
      if (filterRarity && getRarity(weapon) !== filterRarity) return false;
      if (filterStoreID && getStoreID(weapon) !== filterStoreID) return false;
      if (filterIndividualWeapons && weapon.skin?.OwnerHero) return false;
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
      if (storeOnly && (!Array.isArray(weapon.store) || weapon.store.length === 0) && (!Array.isArray(weapon.skin?.store) || weapon.skin.store.length === 0)) return false;
      const fields = [
        langs.content[getDisplayNameKey(weapon)] || '',
        weapon.store?.StoreName || '',
        weapon.store?.Item || '',
        weapon.weaponData.WeaponSkinName || '',
        weapon.weaponData.BaseWeapon || '',
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
    filterStoreLabel, filterPromoType, filterChestName, filterBPSeason, filterEntitlement, langs, filterIndividualWeapons
  ]);

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
      weapon = filteredWeapons.find(w => String(w.weaponData.WeaponSkinID) === weaponId);
    }
    if (!weapon && !isMobile) {
      weapon = filteredWeapons[0];
    }
    setSelectedWeapon(weapon);
    setCurrentAnimation({ anim: '', urlType: 'all' });
  }, [weapons, filteredWeapons, isMobile]);

  useEffect(() => {
    if (isMobile && selectedWeapon && !filteredWeapons.some(w => w.weaponData.WeaponSkinID === selectedWeapon.weaponData.WeaponSkinID)) {
      setSelectedWeapon(null);
    }
  }, [filteredWeapons, isMobile, selectedWeapon]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedWeapon) {
      currentParams.set('weapon', String(selectedWeapon.weaponData.WeaponSkinID));
    }
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const weaponId = params.get('weapon') ? String(params.get('weapon')) : null;
      if (weaponId && filteredWeapons.length > 0) {
        const weapon = filteredWeapons.find(w => String(w.weaponData.WeaponSkinID) === weaponId);
        if (weapon) {
          setSelectedWeapon(weapon);
        } else if (!isMobile) {
          setSelectedWeapon(filteredWeapons[0]);
        } else {
          setSelectedWeapon(null);
        }
      } else if (!isMobile) {
        setSelectedWeapon(filteredWeapons[0]);
      } else {
        setSelectedWeapon(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedWeapon, filteredWeapons, isMobile]);

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
    setFilterIndividualWeapons(false);
    if (isMobile) {
      setSelectedWeapon(null);
      filtersChanged.current = true;
    } else {
      setSelectedWeapon(filteredWeapons[0] || null);
    }
    setCurrentAnimation({ anim: '', urlType: 'all' });
  }, [filteredWeapons, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedWeapon) return;
    const url = `${window.location.origin}${window.location.pathname}?weapon=${selectedWeapon.weaponData.WeaponSkinID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
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
    if (!specialRarities.includes(rarity)) return { className: 'bg-gray-100 dark:bg-slate-900 p-3' };
    const isMythic = rarity === 'Mythic';
    const svgSet = isMythic ? svgStyles.Mythic : svgStyles.Other;
    return {
      className: 'relative rounded-lg text-center p-3',
      style: {
        backgroundImage: `url(${svgSet.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'dark:brightness-110',
      },
    };
  };

  const handleImgError = e => { e.target.style.display = 'none'; };

  const Row = ({ index, data }) => {
    const weapon = data[index];
    const rarity = getRarity(weapon);
    const allStores = [
      ...(Array.isArray(weapon.store) ? weapon.store : []),
      ...(Array.isArray(weapon.skin?.store) ? weapon.skin.store : [])
    ];

    const labels = [...new Set(allStores.map(sd => sd.Label).filter(Boolean))];
    const timedPromos = [...new Set(allStores.map(sd => sd.TimedPromotion).filter(Boolean))];

    const bundleStore = allStores.find(sd => sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0);
    let bundleCost = null;
    if (bundleStore) {
      const total = bundleStore.ItemList
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
      bundleCost = bundleStore.IdolBundleDiscount ? Math.floor(total * bundleStore.IdolBundleDiscount) : total;
    }

    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[360px]' : 'p-0 px-2 h-[185px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedWeapon?.weaponData?.WeaponSkinID === weapon.weaponData?.WeaponSkinID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => {
            setSelectedWeapon(weapon);
            setCurrentAnimation({ anim: '', urlType: 'all' });
            filtersChanged.current = false;
          }}
        >
          <div className={`flex p-2 rounded-lg items-center justify-center ${getRarityStyles(weapon.weaponData?.Rarity).className}`} style={getRarityStyles(weapon.weaponData?.Rarity).style}>
            <img
              src={`${host}/game/anim/weapon/${weapon.weaponData.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.weaponData.BaseWeapon}Pose/all`}
              className="h-32 w-32 object-contain"
              onError={handleImgError}
            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            {viewMode === 'list' && (
              <div className={`flex flex-wrap gap-1 my-1`}>
                {(weapon.bp || weapon.skin?.bp) && (
                  <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${(weapon.bp || weapon.skin?.bp).ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}
                {(weapon.promo || weapon.skin?.promo) && (
                  <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${!allStores.length && !weapon.bp && !weapon.skin?.bp && !weapon.entitlement && !weapon.skin?.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {(weapon.entitlement || weapon.skin?.entitlement) && (
                  <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[(weapon.entitlement || weapon.skin?.entitlement).DisplayNameKey]?.replace('!', '') || (weapon.entitlement || weapon.skin?.entitlement).EntitlementName} DLC`}
                  </div>
                )}
                {(weapon.skin?.chest) && (
                  <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[weapon.skin.chest.DisplayNameKey]} Exclusive` : langs.content[weapon.skin.chest.DisplayNameKey]}
                  </div>
                )}
                {labels.length > 0 && labels.map((label, idx) => (
                  <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "No Longer Purchasable" : label}
                  </div>
                ))}
                {timedPromos.length > 0 && timedPromos.map((promo, idx) => (
                  <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))}
              </div>
            )}
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>

              <div className={`flex flex-row items-center gap-2 text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <img src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.weaponData.BaseWeapon}/1`} className="inline h-7" onError={handleImgError} />
                <span className={viewMode === 'grid' ? 'truncate max-w-[10rem]' : ''}>{langs.content[weapon.weaponData.DisplayNameKey] || weapon.weaponData.WeaponSkinName}</span>
              </div>
              {weapon.skin && (
                <div className={`flex flex-row items-center gap-2 text-gray-700 dark:text-gray-300 font-bold ${viewMode === 'grid' ? 'text-sm justify-center' : 'text-base'}`}>
                  <img src={`${host}/game/getGfx/${weapon.skin.CostumeIconFileName}/${weapon.skin.CostumeIcon}`} className="inline h-6" onError={handleImgError} />
                  <span>{langs.content[weapon.skin.DisplayNameKey]}</span>
                </div>
              )}
            </div>

            <div className={`text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white`}>
              {allStores.map((sd, idx) =>
                sd.IdolCost && (
                  <div key={`idol-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.IdolCost}</span>
                  </div>
                )
              )}
              {allStores.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {allStores.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {allStores.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.SpecialCurrencyCost}</span>
                  </div>
                )
              )}
              {allStores
                .filter(sd => sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0)
                .map((bundleStore, idx) => {
                  const total = bundleStore.ItemList
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
                  const bundleCost = bundleStore.IdolBundleDiscount ? Math.floor(total * bundleStore.IdolBundleDiscount) : total;
                  return (
                    <div key={`bundle-${idx}`}>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                    </div>
                  );
                })
              }
            </div>
            {viewMode === 'grid' && (
              <div className={`flex flex-col gap-1 my-1`}>
                {(weapon.bp || weapon.skin?.bp) && (
                  <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${(weapon.bp || weapon.skin?.bp).ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}
                {(weapon.promo || weapon.skin?.promo) && (
                  <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${!allStores.length && !weapon.bp && !weapon.skin?.bp && !weapon.entitlement && !weapon.skin?.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {(weapon.entitlement || weapon.skin?.entitlement) && (
                  <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[(weapon.entitlement || weapon.skin?.entitlement).DisplayNameKey]?.replace('!', '') || (weapon.entitlement || weapon.skin?.entitlement).EntitlementName} DLC`}
                  </div>
                )}
                {(weapon.skin?.chest) && (
                  <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(weapon.skin?.store) && weapon.skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[weapon.skin.chest.DisplayNameKey]} Exclusive` : langs.content[weapon.skin.chest.DisplayNameKey]}
                  </div>
                )}
                {labels.length > 0 && labels.map((label, idx) => (
                  <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "No Longer Purchasable" : label}
                  </div>
                ))}
                {/*timedPromos.length > 0 && timedPromos.map((promo, idx) => (
                  <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))*/}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
          {baseWeapons
            .filter(id => optionCounts.BaseWeapon[id] > 0).length > 0 && (
              <div className="flex flex-wrap gap-2 items-center overflow-x-auto pt-2">
                {baseWeapons
                  .filter(id => optionCounts.BaseWeapon[id] > 0)
                  .map((id) => (
                    <div key={id} className="relative">
                      <img
                        src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${id}/1`}
                        className={`h-8 w-8 object-contain rounded-lg cursor-pointer ${filterBaseWeapons.includes(id) ? '' : 'opacity-40'}`}
                        onClick={() => handleFilterChange(setFilterBaseWeapons, filterBaseWeapons.includes(id) ? filterBaseWeapons.filter(hid => hid !== id) : [...filterBaseWeapons, id])}
                        title={formatLabel(id)}
                        onError={handleImgError}
                      />
                      <span className="absolute top-0.5 -right-2 bg-blue-500 text-white text-xs rounded-full px-1">{optionCounts.BaseWeapon[id]}</span>
                    </div>
                  ))}
              </div>
            )}

          {ownerHeroes.filter(hero => optionCounts.OwnerHero[hero] > 0).length > 0 && (
            <div className="flex flex-wrap gap-2 items-center overflow-x-auto">
              {ownerHeroes
                .filter(hero => optionCounts.OwnerHero[hero] > 0)
                .map((hero) => {
                  const legend = legends.find(l => l.heroData?.HeroName === hero);
                  const icon = legend?.costumeType?.CostumeIcon;
                  const iconFile = legend?.costumeType?.CostumeIconFileName;
                  return (
                    <div key={hero} className="relative">
                      <img
                        src={icon && iconFile ? `${host}/game/getGfx/${iconFile}/${icon}` : ''}
                        className={`h-8 w-8 object-contain rounded-lg cursor-pointer ${filterOwnerHeroes.includes(hero) ? '' : 'opacity-40'}`}
                        onClick={() => handleFilterChange(setFilterOwnerHeroes, filterOwnerHeroes.includes(hero) ? filterOwnerHeroes.filter(hid => hid !== hero) : [...filterOwnerHeroes, hero])}
                        title={legend ? langs.content[legend.DisplayNameKey] : hero}
                        onError={handleImgError}
                      />
                      <span className="absolute top-0.5 -right-2 bg-blue-500 text-white text-xs rounded-full px-1">{optionCounts.OwnerHero[hero]}</span>
                    </div>
                  );
                })}
            </div>
          )}

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
              {Object.values(optionCounts.Rarity).some(count => count > 0) && (
                <select
                  value={filterRarity}
                  onChange={e => handleFilterChange(setFilterRarity, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">All Rarities</option>
                  {rarities.filter(r => optionCounts.Rarity[r] > 0).map(r => (
                    <option key={r}
                      value={r}>{formatLabel(r)} ({optionCounts.Rarity[r]})</option>
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
                  {storeLabels.map(n => (
                    <option key={n} value={n} disabled={optionCounts.StoreLabel[n] === 0}>
                      {n} ({optionCounts.StoreLabel[n] || 0})
                    </option>
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
                  {optionCounts.AllChests > 0 && <option value="AllChests">All Chest Skins ({optionCounts.AllChests})</option>}
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
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Weapons ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                Store Weapons Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                DLC Weapons ({optionCounts.DLC || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={filterIndividualWeapons} onChange={() => setFilterIndividualWeapons(v => !v)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                Individual Weapons Only ({optionCounts.IndividualWeapons || 0})
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
                placeholder="Search Weapon Skins"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className='flex justify-between items-center w-full sm:w-auto py-2 gap-4'>
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
                Showing {filteredWeapons.length} Weapon{filteredWeapons.length !== 1 ? 's' : ''}
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
              <option value="WeaponSkinIDDesc">Weapon ID (Desc)</option>
              <option value="WeaponSkinIDAsc">Weapon ID (Asc)</option>
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
              data={filteredWeapons}
              totalCount={filteredWeapons.length}
              itemContent={(index, weapon) => <Row index={index} data={filteredWeapons} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredWeapons}
              totalCount={filteredWeapons.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="weapon-grid-item"
              itemContent={(index, weapon) => <Row index={index} data={filteredWeapons} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedWeapon ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden text-gray-900 dark:text-white"
              onClick={() => setSelectedWeapon(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedWeapon && (
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
          {selectedWeapon ? (
            <div className='gap-2 flex flex-col'>
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <img
                    src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${selectedWeapon.weaponData.BaseWeapon}/1`}
                    className="h-8 w-8 object-contain"
                    onError={handleImgError}
                  />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[selectedWeapon.weaponData.DisplayNameKey] || selectedWeapon.weaponData.WeaponSkinName}</span>
                </div>
                {selectedWeapon.skin && (
                  <div className="flex items-center gap-2 mt-2">
                    <img
                      src={`${host}/game/getGfx/${selectedWeapon.skin.CostumeIconFileName}/${selectedWeapon.skin.CostumeIcon}`}
                      className="h-8 w-8 object-contain"
                      onError={handleImgError}
                    />
                    <span className="text-xl text-gray-900 dark:text-white">{langs.content[selectedWeapon.skin.DisplayNameKey]}</span>
                  </div>
                )}
                {langs.content[getDescriptionKey(selectedWeapon)] && (
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    {langs.content[getDescriptionKey(selectedWeapon)]}
                  </div>
                )}
                {[...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])]
                  .flatMap(sd => splitTags(sd.SearchTags))
                  .filter(Boolean).length > 0 && (
                    <div className="flex flex-col flex-wrap">
                      <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {[...new Set(
                          [...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])]
                            .flatMap(sd => splitTags(sd.SearchTags))
                            .filter(Boolean)
                        )].map((tag, idx) => (
                          <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {selectedWeapon.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedWeapon.promo.Type}
                      </span>
                    )}
                    {selectedWeapon.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedWeapon.bp.ID?.replace('BP', '').replace('-', ' ')}{selectedWeapon.bp.Tier ? ` (Tier ${selectedWeapon.bp.Tier})` : ''}
                      </span>
                    )}
                    {selectedWeapon.skin?.chest && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">
                        {`${langs.content[`ChanceBoxType_${selectedWeapon.skin.chest.ChanceBoxName}_DisplayName`] || selectedWeapon.skin.chest.ChanceBoxName} (${selectedWeapon.skin.chest.ExclusiveItems.split(',').includes(selectedWeapon.skin?.store?.StoreName || selectedWeapon.skin?.costumeData?.CostumeName) ? 'Exclusive' : 'Common'})`}
                      </span>
                    )}
                    {selectedWeapon.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {`${langs.content[selectedWeapon.entitlement.DisplayNameKey]?.replace('!', '') || selectedWeapon.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="lg:w-1/2 flex flex-col gap-4 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <div>
                    <span className="text-lg text-gray-900 dark:text-white">Weapon Data</span>
                    <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-400">Weapon Name</span>
                        <span className="text-gray-900 dark:text-white">{selectedWeapon.weaponData.WeaponSkinName}</span>
                      </div>
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-400">Weapon ID</span>
                        <span className="text-gray-900 dark:text-white">{selectedWeapon.weaponData.WeaponSkinID}</span>
                      </div>
                      <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                        <span className="font-bold text-gray-600 dark:text-gray-400">Base Weapon</span>
                        <span className="text-gray-900 dark:text-white">{formatLabel(selectedWeapon.weaponData.BaseWeapon)}</span>
                      </div>
                    </div>
                  </div>
                  {([...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])].length > 0) && (
                    <div className='flex flex-col gap-4'>
                      {[...(Array.isArray(selectedWeapon.store) ? selectedWeapon.store : []), ...(Array.isArray(selectedWeapon.skin?.store) ? selectedWeapon.skin.store : [])].map((sd, idx) => (
                        <div key={idx}>
                          <span className="text-lg text-gray-900 dark:text-white">Store Data{sd.Type === 'Bundle' ? ' (Bundle)' : ' (Weapon)'}</span>
                          <div className="grid grid-cols-2 gap-2 text-lg">
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-400">Store Name</span>
                              <span className="text-gray-900 dark:text-white">{sd.StoreName}</span>
                            </div>
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-400">Store ID</span>
                              <span className="text-gray-900 dark:text-white">{sd.StoreID}</span>
                            </div>
                            {sd.ItemList && sd.ItemList.length > 0 ? (
                              <div className='flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg'>
                                <span className="font-bold text-gray-600 dark:text-gray-400">Bundle Cost</span>
                                <div className="flex items-center gap-1">
                                  <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                  <span className="line-through text-red-600 dark:text-red-400">{
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
                                  <span className="text-green-600 dark:text-green-400 font-bold">{Math.floor(
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
                              <div className='col-span-2 grid grid-cols-2 gap-2'>
                                {(sd.IdolCost != 0 && sd.IdolCost != '') && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Mammoth Coin Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.IdolCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.IdolSaleCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Mammoth Sale Price</span>
                                    <div className="flex items-center gap-1">
                                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                                      <span className="line-through text-red-600 dark:text-red-400">{sd.IdolCost}</span>
                                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.IdolSaleCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Gold Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.GoldCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldSaleCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-800 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Gold Sale Price</span>
                                    <div className="flex items-center gap-1">
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} />
                                      <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.GoldBundleDiscount && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Gold Bundle Discount</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.GoldBundleDiscount}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.RankedPointsCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">Glory Cost</span>
                                    <div>
                                      <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} />
                                      <span className="text-gray-900 dark:text-white">{sd.RankedPointsCost}</span>
                                    </div>
                                  </div>
                                )}
                                {sd.SpecialCurrencyType && sd.SpecialCurrencyCost && (
                                  <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                    <span className="font-bold text-gray-600 dark:text-gray-400">{sd.SpecialCurrencyType} Cost</span>
                                    <span className="text-gray-900 dark:text-white">{sd.SpecialCurrencyCost}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {sd.Cohort && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-400">Cohort</span>
                                <span className="text-gray-900 dark:text-white">{sd.Cohort}</span>
                              </div>
                            )}
                            {sd.Popularity && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-400">Popularity</span>
                                <span className="text-gray-900 dark:text-white">{sd.Popularity}</span>
                              </div>
                            )}
                            {sd.Rarity && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-400">Rarity</span>
                                <span className="text-gray-900 dark:text-white">{sd.Rarity}</span>
                              </div>
                            )}
                            {sd.Label && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-400">Label</span>
                                <span className="text-gray-900 dark:text-white">{sd.Label}</span>
                              </div>
                            )}
                            {sd.TimedPromotion && (
                              <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                                <span className="font-bold text-gray-600 dark:text-gray-400">Timed Promotion</span>
                                <span className="text-gray-900 dark:text-white">{sd.TimedPromotion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedWeapon.entitlement && (
                    <div>
                      <span className="text-lg text-gray-900 dark:text-white">Entitlement Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-400">Entitlement Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.EntitlementName}</span>
                        </div>
                        {selectedWeapon.entitlement.EntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.EntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SteamAppID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Steam App ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.SteamAppID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SonyEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Sony Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.SonyEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.SonyProductID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Sony Product ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.SonyProductID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.NintendoConsumableID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Nintendo Consumable ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.NintendoConsumableID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.NintendoEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Nintendo Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.NintendoEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1EntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">XB1 Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.XB1EntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1ProductID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">XB1 Product ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.XB1ProductID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.XB1StoreID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">XB1 Store ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.XB1StoreID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.AppleEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Apple Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.AppleEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.AndroidEntitlementID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Android Entitlement ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.AndroidEntitlementID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.UbiConnectID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Ubi Connect ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.UbiConnectID}</span>
                          </div>
                        )}
                        {selectedWeapon.entitlement.UbiConnectPackageID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-400">Ubi Connect Package ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedWeapon.entitlement.UbiConnectPackageID}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="lg:w-1/2 flex flex-col gap-2 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <span className='text-gray-900 dark:text-white text-lg'>Weapon Images</span>
                  <div className="mt-2 flex justify-center bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <img
                      src={`${host}/game/anim/weapon/${selectedWeapon.weaponData.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${selectedWeapon.weaponData.BaseWeapon}Pose/all`}
                      className="max-h-96"
                      onError={handleImgError}
                      alt={selectedWeapon.weaponData.WeaponSkinName}
                    />
                  </div>
                  <div className="mt-2 flex justify-center bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                    <img
                      src={`${host}/game/anim/weapon/${selectedWeapon.weaponData.WeaponSkinID}/Animation_${selectedWeapon.weaponData.BaseWeapon == 'Pistol' ? 'Pistols' : selectedWeapon.weaponData.BaseWeapon == 'RocketLance' ? 'Lance' : selectedWeapon.weaponData.BaseWeapon}/${selectedWeapon.weaponData.BaseWeapon == 'Sword' ? 'a__1HandRearAnimation' : `a__${selectedWeapon.weaponData.BaseWeapon}Animation`}/All/all`}
                      className="max-w-full h-auto"
                      onError={handleImgError}
                      alt={selectedWeapon.weaponData.WeaponSkinName}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400 italic">Select a weapon to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}