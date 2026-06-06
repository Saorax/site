import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';
import { AddedBadge, ImageWithLoader, RawDataDetails, AppScroller, getAddedPatch, getPatchFilterCounts, getPatchGroups, patchFilterMatches, PatchFilterSelect } from './comp/LoadingImage';

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
      AllChests: 0,
      AllChestExclusives: 0,
      AllBP: 0,
      StoreOnly: 0,
      DLC: 0,
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
      }
      ['HeroID', 'Cohort', 'TimedPromotion', 'Rarity', 'StoreID', 'StoreLabel', 'PromoType', 'ChestName', 'CostumeIndex', 'BPSeason', 'Entitlement'].forEach(key => {
        if (applyFilters(skin, key)) {
          const val = helpers[key](skin);
          if (val) counts[key][val] = (counts[key][val] || 0) + 1;
        }
      });
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
  const [currentAnimation, setCurrentAnimation] = useState({ anim: '', urlType: 'all' });
  const [copyFeedback, setCopyFeedback] = useState('');
  const topRef = useRef(null);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const [filterHeight, setFilterHeight] = useState(0);
  const [listHeight, setListHeight] = useState(400);
  const [viewMode] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterPatch, setFilterPatch] = useState('');
  const patchGroups = useMemo(() => getPatchGroups(skins), [skins]);
  const patchCounts = useMemo(() => getPatchFilterCounts(skins), [skins]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (filterSectionRef.current) {
      setFilterHeight(filterSectionRef.current.offsetHeight);
    }
  }, [
    filterHeroIDs,
    filterCohort,
    filterPromo,
    filterRarity,
    filterStoreID,
    storeOnly,
    filterStoreLabel,
    filterPromoType,
    filterChestName,
    filterCostumeIndex,
    filterBPSeason,
    filterEntitlement, filterPatch, debouncedSearch,
    sortType,
    isMobile
  ]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (isMobile) {
      setSelectedSkin(null);
      filtersChanged.current = true;
    }
  }, [
    filterHeroIDs,
    filterCohort,
    filterPromo,
    filterRarity,
    filterStoreID,
    storeOnly,
    filterStoreLabel,
    filterPromoType,
    filterChestName,
    filterCostumeIndex,
    filterBPSeason,
    filterEntitlement, filterPatch, debouncedSearch,
    sortType,
    isMobile
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
  }, [selectedSkin, filterHeight]);

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
    Patch: getAddedPatch
  }), []);

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
  const getBPSeason = s => s.bp?.ID ?? '';
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
    filterStoreLabel, filterPromoType, filterChestName, filterCostumeIndex, filterBPSeason, filterEntitlement, filterPatch, langs
  ]);
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
      skin = filteredSkins.find(s => String(s.costumeData?.CostumeID) === skinId);
    }
    setSelectedSkin(skin);
    setCurrentAnimation({ anim: skin?.animTypes?.idleOther || skin?.animTypes?.idle || '', urlType: 'all' });
  }, [skins, filteredSkins, isMobile]);

  useEffect(() => {
    if (selectedSkin && !filteredSkins.some(s => s.costumeData?.CostumeID === selectedSkin.costumeData?.CostumeID)) {
      setSelectedSkin(null);
    }
  }, [filteredSkins, isMobile, selectedSkin]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedSkin) {
      currentParams.set('skin', String(selectedSkin.costumeData?.CostumeID));
    }
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const skinId = params.get('skin') ? String(params.get('skin')) : null;
      if (skinId && filteredSkins.length > 0) {
        const skin = filteredSkins.find(s => String(s.costumeData?.CostumeID) === skinId);
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
  }, [selectedSkin, filteredSkins, isMobile]);

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
    setFilterPatch('');
    setSelectedSkin(null);
    filtersChanged.current = true;
    setCurrentAnimation({ anim: '', urlType: 'all' });
  }, [filteredSkins, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (!selectedSkin) return;
    const url = `${window.location.origin}${window.location.pathname}?skin=${selectedSkin.costumeData?.CostumeID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
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
      <div className={viewMode === 'grid' ? 'p-1 w-full' : 'p-0 px-2 min-h-[215px]'} >
        <div
          className={`relative self-start text-left bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer p-3 pt-10 transition border border-gray-200 dark:border-slate-700 min-h-52 shadow-sm hover:-translate-y-0.5 ${selectedSkin?.costumeData?.CostumeID === skin.costumeData?.CostumeID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} flex flex-col`}
          onClick={() => {
            setSelectedSkin(skin);
            setCurrentAnimation({ anim: skin.animTypes?.idleOther || skin.animTypes?.idle || '', urlType: 'all' });
            filtersChanged.current = false;
          }}
        >
          {heroData && (
            <div className="absolute left-2 top-2 z-10 flex max-w-[58%] items-center gap-1.5 rounded-lg bg-gray-100/90 px-2 py-1 text-left text-xs font-bold text-gray-800 shadow-sm dark:bg-slate-900/90 dark:text-gray-100">
              <img src={`${host}/game/getGfx/${heroData?.costumeType?.CostumeIconFileName}/${heroData?.costumeType?.CostumeIcon}`} className="h-6 w-6 shrink-0 object-contain" onError={handleImgError} />
              <span className="min-w-0 whitespace-nowrap">{langs.content[heroData?.DisplayNameKey] || heroData?.DisplayNameKey} Skin</span>
            </div>
          )}
          {viewMode === 'grid' && (
            <div className="mb-2 flex max-w-full flex-row items-center justify-center gap-2 px-2 text-base font-bold text-gray-900 dark:text-white">
              <img src={`${host}/game/getGfx/${skin.costumeData?.CostumeIconFileName}/${skin.costumeData?.CostumeIcon}`} className="inline h-7 shrink-0" onError={handleImgError} />
              <span className="break-words">{langs.content[getDisplayNameKey(skin)] || skin.costumeData?.CostumeName}</span>
            </div>
          )}
          <div className="flex w-full items-center justify-center gap-2">
            <div className={`flex p-2 rounded-lg items-center justify-center ${getRarityStyles(Array.isArray(skin.store) && skin.store[0]?.Rarity).className}`} style={getRarityStyles(Array.isArray(skin.store) && skin.store[0]?.Rarity).style}>
              <ImageWithLoader src={`${host}/game/anim/char/${skin.HeroID}-${skin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${skin.animTypes.selectedOther || skin.animTypes.selected}/loop`} alt="" className="h-36 w-36 rounded-lg bg-slate-900/80" />
            </div>
            {skin.weapons.length > 0 && (
              <div className="flex flex-col gap-2">
                {skin.weapons.slice(0, 2).map((weapon) => (
                  <div key={weapon.WeaponSkinID} className="bg-gray-100 p-1 dark:bg-slate-900 flex rounded-lg">
                    <img
                      src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                      className="h-16 w-16 object-contain"
                      onError={handleImgError}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex w-full flex-col items-center text-center mt-2 min-w-0">
            <div className="flex flex-col gap-1">
              {viewMode != 'grid' && (
                <div className="flex max-w-full flex-nowrap justify-center gap-1 overflow-x-auto app-scrollbar pb-1 [&>*]:shrink-0">
                  {(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.promo && !skin.entitlement && (
                    <div className={`${skin.costumeData.CostumeName === "Collectors" ? "bg-red-700 dark:bg-red-800" : "bg-gray-500 dark:bg-gray-600"} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>
                      {skin.costumeData.CostumeName === "Collectors" ? "Collectors Pack Exclusive" : "Not Obtainable"}
                    </div>
                  )}
                  {skin.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${skin.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {skin.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.entitlement ? ' Only' : ''}`}
                    </div>
                  )}
                  {skin.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[skin.entitlement.DisplayNameKey]?.replace('!', '') || skin.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {skin.chest && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {(Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[skin.chest.DisplayNameKey]} Exclusive` : langs.content[skin.chest.DisplayNameKey]}
                    </div>
                  )}
                  {Array.isArray(skin.store) && (() => {
                    const labels = [...new Set(skin.store.map(sd => sd.Label).filter(Boolean))];
                    return labels.length > 0 && labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "No Longer Purchasable" : label}
                      </div>
                    ));
                  })()}
                  {Array.isArray(skin.store) && (() => {
                    const promos = [...new Set(skin.store.map(sd => sd.TimedPromotion ?? '').filter(v => v !== ''))];
                    return promos.length > 0 && promos.map((promo, idx) => (
                      <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className={`flex-row items-center gap-2 text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'hidden' : 'flex text-lg'}`}>
                <img src={`${host}/game/getGfx/${skin.costumeData?.CostumeIconFileName}/${skin.costumeData?.CostumeIcon}`} className="inline h-7" onError={handleImgError} />
                <span >{langs.content[getDisplayNameKey(skin)] || skin.costumeData?.CostumeName}</span>
              </div>
              <AddedBadge item={skin} className="absolute right-2 top-2 z-10 pointer-events-none" />

              {viewMode == 'grid' && <div className="flex w-full max-w-full flex-nowrap justify-center gap-1 overflow-x-auto app-scrollbar pb-1 [&>*]:shrink-0">
                {(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.promo && !skin.entitlement && (
                  <div className={`${skin.costumeData.CostumeName === "Collectors" ? "bg-red-700 dark:bg-red-800" : "bg-gray-500 dark:bg-gray-600"} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {skin.costumeData.CostumeName === "Collectors" ? "Collectors Pack Exclusive" : "Not Obtainable"}
                  </div>
                )}
                {skin.bp && (
                  <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Battle Pass Season ${skin.bp.ID.replace('BP', '').replace('-', ' ')}`}
                  </div>
                )}

                {skin.promo && (
                  <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`Promo Code${(!Array.isArray(skin.store) || skin.store.length === 0) && !skin.bp && !skin.entitlement ? ' Only' : ''}`}
                  </div>
                )}
                {skin.entitlement && (
                  <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {`${langs.content[skin.entitlement.DisplayNameKey]?.replace('!', '') || skin.entitlement.EntitlementName} DLC`}
                  </div>
                )}
                {skin.chest && (
                  <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {(Array.isArray(skin.store) && skin.store.some(sd => sd.IdolCost == 0)) ? `${langs.content[skin.chest.DisplayNameKey]} Exclusive` : langs.content[skin.chest.DisplayNameKey]}
                  </div>
                )}
                {Array.isArray(skin.store) && [...new Set(skin.store.map(sd => sd.Label).filter(Boolean))].map((label, idx) => (
                  <div key={`label-${idx}`} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                    {label === "LastChance" ? "No Longer Purchasable" : label}
                  </div>
                ))}
                {Array.isArray(skin.store) && [...new Set(skin.store.map(sd => sd.TimedPromotion ?? '').filter(Boolean))].map((promo, idx) => (
                  <div key={`promo-${idx}`} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {formatLabel(promo)}
                  </div>
                ))}
              </div>}
            </div>

            <div className={`text-gray-900 flex items-center gap-4 dark:text-white`}>
              {Array.isArray(skin.store) && skin.store.map((sd, idx) => {
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
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                    </div>
                  );
                }
                if (sd.IdolCost && sd.IdolCost != 0) {
                  return (
                    <div key={`idol-${idx}`}>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" onError={handleImgError} />
                      <span>{sd.IdolCost}</span>
                    </div>
                  );
                }
                return null;
              })}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" onError={handleImgError} />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {Array.isArray(skin.store) && skin.store.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img src={`${host}/game/getGfx/UI_Icons/a_Currency_${sd.SpecialCurrencyType}`} className="inline h-4 mr-1" onError={handleImgError} />
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
  function genStoreData() {
    return selectedSkin.store.map((sd, idx) => {
      return (
        <div className='relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm'>
          <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Store Data {sd.Type == 'Bundle' ? '(Bundle)' : '(Skin)'}</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Store Name</span>
              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreName}</span>
            </div>
            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Store ID</span>
              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.StoreID}</span>
            </div>
            {sd.ItemList && sd.ItemList.length > 0 ? (
              <div className='flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3'>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Bundle Cost</span>
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
              <div className='col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3'>
                {(sd.IdolCost != 0 && sd.IdolCost != '') && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Coin Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" onError={handleImgError} />
                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.IdolCost}</span>
                    </div>
                  </div>
                )}
                {sd.IdolSaleCost && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Mammoth Sale Price</span>
                    <div className="flex items-center gap-1">
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" onError={handleImgError} />
                      <span className="line-through text-red-600 dark:text-red-400">{sd.IdolCost}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.IdolSaleCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldCost && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.GoldCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldSaleCost && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Sale Price</span>
                    <div className="flex items-center gap-1">
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" onError={handleImgError} />
                      <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                    </div>
                  </div>
                )}
                {sd.GoldBundleDiscount && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Gold Bundle Discount</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" onError={handleImgError} />
                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.GoldBundleDiscount}</span>
                    </div>
                  </div>
                )}
                {sd.RankedPointsCost && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Glory Cost</span>
                    <div>
                      <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" onError={handleImgError} />
                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.RankedPointsCost}</span>
                    </div>
                  </div>
                )}
                {sd.SpecialCurrencyType && sd.SpecialCurrencyCost && (
                  <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{sd.SpecialCurrencyType} Cost</span>
                    <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.SpecialCurrencyCost}</span>
                  </div>
                )}
              </div>
            )}
            {sd.Cohort && (
              <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Cohort</span>
                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Cohort}</span>
              </div>
            )}
            {sd.Popularity && (
              <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Popularity</span>
                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Popularity}</span>
              </div>
            )}


            {sd.Rarity && (
              <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Rarity</span>
                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Rarity}</span>
              </div>
            )}
            {sd.Label && (
              <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Label</span>
                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.Label}</span>
              </div>
            )}
            {sd.TimedPromotion && (
              <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Timed Promotion</span>
                <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{sd.TimedPromotion}</span>
              </div>
            )}
            {/*sd.ItemList && sd.ItemList.length > 0 && (
              <div className="flex flex-col col-span-2 rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Bundle Includes</span>
                <div className='flex flex-wrap gap-2'>
                  {sd.ItemList.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                      <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{langs.content[item.DisplayNameKey]}</span>
                    </div>))}
                </div>
              </div>
            )*/}
          </div>
        </div >
      )
    })
  }
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100 dark:bg-slate-900" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-3 lg:p-4 bg-gray-100 dark:bg-slate-900 w-full h-full">
        <div ref={filterSectionRef} className="space-y-4 mb-4 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
          <button onClick={() => setFiltersOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg bg-gray-100 dark:bg-slate-700 px-3 py-2 text-left text-sm font-bold text-gray-900 dark:text-white">
            <span>Filters</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">{filtersOpen ? 'Hide' : 'Show'}</span>
          </button>
          {filtersOpen && (<>
          <div className="flex flex-wrap gap-2 items-center overflow-x-auto app-scrollbar pt-2">
            {heroIDs
              .filter(id => optionCounts.HeroID[id] > 0)
              .map((id) => {
                const heroData = legends.find(r => r.heroData.HeroID == id);
                const icon = heroData?.costumeType?.CostumeIcon;
                const iconFile = heroData?.costumeType?.CostumeIconFileName;
                if (!icon || !iconFile) return null;
                return (
                  <div key={id} className="relative">
                    <img
                      src={`${host}/game/getGfx/${iconFile}/${icon}`}
                      className={`h-8 w-8 object-contain rounded-lg cursor-pointer ${filterHeroIDs.includes(id) ? '' : 'opacity-40'}`}
                      onClick={() => handleFilterChange(setFilterHeroIDs, filterHeroIDs.includes(id) ? filterHeroIDs.filter(hid => hid !== id) : [...filterHeroIDs, id])}
                      title={`${langs.content[heroData.DisplayNameKey]} (ID ${id})`}
                      onError={handleImgError}
                    />
                    <span className="absolute top-0.5 -right-2 bg-blue-500 text-white text-xs rounded-full px-1">{optionCounts.HeroID[id]}</span>
                  </div>
                );
              })}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {Object.values(optionCounts.Cohort).some(count => count > 0) && (
                <select
                  value={filterCohort}
                  onChange={e => handleFilterChange(setFilterCohort, e.target.value)}
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
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
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
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
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
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
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
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
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
                >
                  <option value="">Promo Codes</option>
                  {promoTypes.filter(n => optionCounts.PromoType[n] > 0).map(n => (
                    <option key={n} value={n}>{n} ({optionCounts.PromoType[n]})</option>
                  ))}
                </select>
              )}
              {Object.values(optionCounts.CostumeIndex).some(count => count > 0) && (
                <select
                  value={filterCostumeIndex}
                  onChange={e => handleFilterChange(setFilterCostumeIndex, e.target.value)}
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
                >
                  <option value="">Costume Index</option>
                  {costumeIndexes.filter(n => optionCounts.CostumeIndex[n] > 0).map(n => (
                    <option key={n} value={n}>{n} ({optionCounts.CostumeIndex[n]})</option>
                  ))}
                </select>
              )}
              {(optionCounts.AllChests > 0 || optionCounts.AllChestExclusives > 0 || Object.values(optionCounts.ChestName).some(count => count > 0)) && (
                <select
                  value={filterChestName}
                  onChange={e => handleFilterChange(setFilterChestName, e.target.value)}
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
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
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 cursor-pointer"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Skins ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-4 items-center">
                <label className="inline-flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                  <input type="checkbox" checked={storeOnly} onChange={() => handleFilterChange(setStoreOnly, !storeOnly)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Store Skins Only ({optionCounts.StoreOnly || 0})
                </label>
                <label className="inline-flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                  <input type="checkbox" checked={filterEntitlement} onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  DLC Skins ({optionCounts.DLC || 0})
                </label>
              </div>
              {patchGroups.length > 0 && (
                <PatchFilterSelect
                  value={filterPatch}
                  onChange={(value) => handleFilterChange(setFilterPatch, value)}
                  groups={patchGroups}
                  counts={patchCounts}
                />
              )}

              <button onClick={resetFilters} aria-label="Reset all filters" className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Reset Filters
              </button>
            </div>
          </div>
          </>)}

          <div className="lg:flex lg:flex-col gap-4">
            <div className="order-first flex justify-between items-center w-full sm:w-auto py-2 gap-4">
            <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
              Showing {filteredSkins.length} Skin{filteredSkins.length !== 1 ? 's' : ''}
            </div>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
                placeholder="Search Skins"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold placeholder:font-semibold rounded-lg pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
          </div>
          <div className="relative">
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value)}
              className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white text-sm font-semibold w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none cursor-pointer"
            >
              <option value="ArrayIndexDesc">Default Sorting (Desc)</option>
              <option value="ArrayIndexAsc">Default Sorting (Asc)</option>
              <option value="CostumeIDDesc">Costume ID (Desc)</option>
              <option value="CostumeIDAsc">Costume ID (Asc)</option>
              <option value="StoreIDDesc">Store ID (Desc)</option>
              <option value="StoreIDAsc">Store ID (Asc)</option>
              <option value="AlphaAsc">Alphabetical (A-Z)</option>
              <option value="AlphaDesc">Alphabetical (Z-A)</option>
              <option value="CostDesc">Mammoth Cost (Desc)</option>
              <option value="CostAsc">Mammoth Cost (Asc)</option>
              <option value="HeroIDDesc">Legend (Desc)</option>
              <option value="HeroIDAsc">Legend (Asc)</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        <div className='h-[calc(100dvh-9rem)] min-h-[22rem]'>
          <VirtuosoGrid
              data={filteredSkins}
              totalCount={filteredSkins.length}
              listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2"
              itemClassName="skin-grid-item"
              itemContent={(index, skin) => <Row index={index} data={filteredSkins} />}
              components={{ Scroller: AppScroller }}
              useWindowScroll={false}
            />
        </div>
      </div>
      <div ref={detailPanelRef} className={`fixed inset-0 bg-black/70 z-50 ${selectedSkin ? 'flex items-stretch justify-center p-0 sm:items-center sm:p-4' : 'hidden'}`} onClick={() => setSelectedSkin(null)}> 
        <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto app-scrollbar rounded-none border border-gray-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:p-3 lg:gap-4 lg:p-4" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <button
              className="text-gray-900 dark:text-white"
              onClick={() => setSelectedSkin(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedSkin && (
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
          {selectedSkin ? (
            <div className='grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start'>
              <div className="xl:col-span-2 flex flex-col gap-2 pb-3 relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  {selectedSkin.costumeData?.ReplacementPortrait && (
                    <img
                      src={`${host}/game/getGfx/${selectedSkin.costumeData.ReplacementPortraitFileName}/${selectedSkin.costumeData.ReplacementPortrait}M`}
                      className="h-16"
                      onError={handleImgError}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    {selectedSkin.costumeData?.CrossoverGem && (
                      <img
                        src={`${host}/game/getGfx/${selectedSkin.costumeData.CrossoverGemFileName}/${selectedSkin.costumeData.CrossoverGem}`}
                        className="h-8 w-8 object-contain"
                        onError={handleImgError}
                      />
                    )}
                    <img
                      src={`${host}/game/getGfx/${selectedSkin.costumeData.CostumeIconFileName}/${selectedSkin.costumeData.CostumeIcon}`}
                      className="h-8 w-8 object-contain"
                      onError={handleImgError}
                    />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[getDisplayNameKey(selectedSkin)] || selectedSkin.costumeData?.CostumeName}</span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedSkin)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedSkin)]}
                  </div>
                )}
                {Array.isArray(selectedSkin.store) && selectedSkin.store.flatMap(sd => splitTags(sd.SearchTags)).filter(Boolean).length > 0 && (
                  <div>
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="mt-1 flex max-w-full flex-nowrap gap-2 overflow-x-auto app-scrollbar pb-1 [&>*]:shrink-0">
                      {[
                        ...new Set(
                          selectedSkin.store
                            .flatMap(sd => splitTags(sd.SearchTags))
                            .filter(Boolean)
                        )
                      ].map((tag, idx) => (
                        <span key={idx} className="shrink-0 bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto app-scrollbar pb-1 [&>*]:shrink-0">
                    {selectedSkin.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedSkin.promo.Type}
                      </span>
                    )}
                    {selectedSkin.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedSkin.bp.ID.replace('BP', '').replace('-', ' ')} (Tier {selectedSkin.bp.Tier})
                      </span>
                    )}
                    {selectedSkin.chest && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-700 text-gray-900 dark:text-white">
                        {`${langs.content[`ChanceBoxType_${selectedSkin.chest.ChanceBoxName}_DisplayName`] || selectedSkin.chest.ChanceBoxName} (${selectedSkin.chest.ExclusiveItems.split(',').includes(selectedSkin.store?.StoreName || selectedSkin.costumeData.CostumeName) ? 'Exclusive' : 'Common'})`}
                      </span>
                    )}
                    {selectedSkin.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {`${langs.content[selectedSkin.entitlement.DisplayNameKey]?.replace('!', '') || selectedSkin.entitlement.EntitlementName} DLC`}
                      </span>
                    )}
                    {selectedSkin.costumeData.CostumeName === 'Collectors' && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-red-700 dark:bg-red-800 text-gray-900 dark:text-white">
                        Collectors Pack Exclusive
                      </span>
                    )}
                    {Array.isArray(selectedSkin.store) && (() => {
                      const labels = [...new Set(selectedSkin.store.map(sd => sd.Label).filter(Boolean))];
                      return labels.length > 0 && labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "No Longer Purchasable" : label}
                        </span>
                      ));
                    })()}
                    {Array.isArray(selectedSkin.store) && (() => {
                      const promos = [...new Set(selectedSkin.store.map(sd => sd.TimedPromotion).filter(Boolean))];
                      return promos.length > 0 && promos.map((promo, idx) => (
                        <span key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-sm px-3 py-1 rounded-lg">
                          {formatLabel(promo)}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="contents">
                <div className="xl:col-start-2 xl:row-start-2 w-full flex flex-col gap-4 ">
                  <div className="flex flex-col gap-2">
                    <div className='relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm'>
                      <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Costume Data</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Costume Name</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.CostumeName}</span>
                        </div>
                        <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Costume ID</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.CostumeID}</span>
                        </div>
                        <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Costume Index</span>
                          <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.CostumeIndex}</span>
                        </div>
                        {selectedSkin.costumeData.UpgradesTo && (
                          <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Upgrades To</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.costumeData.UpgradesTo}</span>
                          </div>
                        )}
                        {selectedSkin.costumeData.MissionTags && (
                          <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3 col-span-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Mission Tags</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">
                              {selectedSkin.costumeData.MissionTags.map((tag, i) => (
                                <span key={i} className="mr-2">{langs.content[`LegendTag_${tag}`]}</span>
                              ))}
                            </span>
                          </div>
                        )}
                        {selectedSkin.costumeData.HomeField && (
                          <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3 col-span-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Home Field</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">
                              {selectedSkin.costumeData.HomeField.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {Array.isArray(selectedSkin.store) && selectedSkin.store.length > 0 && genStoreData(selectedSkin.store)}
                    {selectedSkin.entitlement && (
                      <div className='relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm'>
                        <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Entitlement Data</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement Name</span>
                            <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.EntitlementName}</span>
                          </div>
                          {selectedSkin.entitlement.EntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.EntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SteamAppID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Steam App ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SteamAppID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SonyEntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SonyEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.SonyProductID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Sony Product ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.SonyProductID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.NintendoConsumableID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Consumable ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.NintendoConsumableID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.NintendoEntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Nintendo Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.NintendoEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1EntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1EntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1ProductID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Product ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1ProductID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.XB1StoreID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">XB1 Store ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.XB1StoreID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.AppleEntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Apple Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.AppleEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.AndroidEntitlementID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Android Entitlement ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.AndroidEntitlementID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.UbiConnectID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.UbiConnectID}</span>
                            </div>
                          )}
                          {selectedSkin.entitlement.UbiConnectPackageID && (
                            <div className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                              <span className="text-[11px] uppercase tracking-wide text-slate-400">Ubi Connect Package ID</span>
                              <span className="mt-1 text-sm text-white break-words whitespace-pre-wrap">{selectedSkin.entitlement.UbiConnectPackageID}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="order-[-1] xl:order-none xl:col-start-1 xl:row-start-2 w-full flex flex-col gap-2 relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
                  <span className='text-gray-900 dark:text-white text-lg'>Animation/Image Data</span>
                  {getAnimButtonRows(selectedSkin.animTypes || {}, selectedSkin.animTypes.overAnim).map((row, i) => (
                    <div key={i} className="flex max-w-full flex-nowrap gap-2 overflow-x-auto app-scrollbar pb-1 [&>*]:shrink-0">
                      {row.map(btn => (
                        <button
                          key={btn.key}
                          onClick={() => setCurrentAnimation({ anim: btn.anim, urlType: btn.urlType })}
                          className={`flex-1 py-1 px-3 rounded-lg text-sm font-bold transition-colors duration-200 ${currentAnimation.anim === btn.anim && currentAnimation.urlType === btn.urlType
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600'
                            }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="mt-2 flex justify-center rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                    {currentAnimation.anim && (
                      <ImageWithLoader
                        src={`${host}/game/anim/char/${selectedSkin.HeroID}-${selectedSkin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${currentAnimation.anim}/${currentAnimation.urlType}`}
                        className="min-h-80 w-full rounded-lg bg-slate-900/80"
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
                          <div key={weapon.WeaponSkinID} className="flex flex-col rounded-lg bg-slate-950/70 border border-slate-700 p-3">
                            <div className='flex items-center gap-2 mb-2'>
                              <img
                                src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.BaseWeapon}/1`}
                                className="h-8 w-8 object-contain"
                                onError={handleImgError}
                              />
                              <span className="text-[11px] uppercase tracking-wide text-slate-400 text-lg">{langs.content[weapon.DisplayNameKey]}</span>
                            </div>
                            <ImageWithLoader
                              src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                              className="h-64 w-full rounded-lg bg-slate-900/80"
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
              <RawDataDetails data={selectedSkin} />
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 italic">Select a skin to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
