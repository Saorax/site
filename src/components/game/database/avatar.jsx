import { host } from '../../../stuff';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { useMediaQuery } from 'react-responsive';

function uniqueValues(array, path) {
  const values = new Set();
  array.forEach(item => {
    let val = item;
    for (const key of Array.isArray(path) ? path : [path]) {
      if (Array.isArray(val)) {
        val = val.flatMap(v => v?.[key]);
      } else {
        val = val?.[key];
      }
      if (!val) break;
    }
    if (Array.isArray(val)) {
      val.forEach(v => values.add(v));
    } else if (val) {
      values.add(val);
    }
  });
  return [...values].filter(Boolean);
}
function getRankedLabel(avatarName) {
  if (avatarName === 'RankedValhallanFallen') return 'Fallen out of Valhallan';
  if (avatarName === 'RankedValhallan') return 'Valhallan';
  if (!avatarName.startsWith('Ranked')) return null;

  const rank = avatarName.replace(/(\d+)$/g, '').replace('Ranked', '');
  const seasons = avatarName.match(/(\d+)$/)?.[0] || 1;

  if (!rank || !seasons) return null;

  const rankFormatted = rank.replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${rankFormatted} for ${seasons} season${seasons > 1 ? 's' : ''}`;
}
const rankColors = {
  diamond: 'bg-indigo-500 dark:bg-indigo-700',   // #423196
  platinum: 'bg-blue-500 dark:blue-700',      // #1a5481
  gold: 'bg-red-600 dark:bg-red-800',         // #920224f2
  competitor: 'bg-stone-500 dark:bg-stone-700',    // #554e47fe
  valhallan: 'bg-sky-300 dark:bg-sky-500', // #aaafedfc
  fallen: 'bg-violet-300 dark:bg-violet-500' // #a3abf3 
};
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

function getTextColor(hexColor) {
  const hex = hexColor.replace('0x', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 128 ? '#000000' : '#ffffff';
}

function useOptionCounts(avatars, filters, helpers) {
  const applyFilters = useCallback((avatar, excludeKey) => {
    for (const [key, filterVal] of Object.entries(filters)) {
      if (key === excludeKey || !filterVal) continue;

      if (key === 'BPSeason') {
        if (filterVal === 'AllBP' && !avatar.bp) return false;
        if (filterVal !== 'AllBP' && helpers.BPSeason(avatar) !== filterVal) return false;
        continue;
      }

      if (key === 'Skirmish') {
        if (filterVal === 'AllSkirmish' && !avatar.skirmish) return false;
        if (filterVal === 'Winning' && (!avatar.skirmish || !avatar.skirmish.reward.ForWinningFaction)) return false;
        continue;
      }

      if (key === 'StoreOnly' && !avatar.store?.length) return false;
      if (key === 'Entitlement' && !avatar.entitlement) return false;
      if (key === 'TimedEvent' && helpers.TimedEvent(avatar) !== filterVal) return false;
      if (typeof helpers[key] === 'function') {
        if (helpers[key](avatar) !== filterVal) return false;
      }
    }
    return true;
  }, [filters, helpers]);

  return useMemo(() => {
    const counts = {
      Cohort: {}, TimedPromotion: {}, StoreID: {}, StoreLabel: {}, PromoType: {}, BPSeason: {}, Entitlement: {}, Skirmish: {}, TimedEvent: {},
      AllBP: 0, StoreOnly: 0, AllSkirmish: 0, Winning: 0, DLC: 0, Bundle: 0
    };

    avatars.forEach(avatar => {
      if (!applyFilters(avatar)) return;

      counts.AllBP += avatar.bp ? 1 : 0;
      counts.StoreOnly += avatar.store?.length > 0 ? 1 : 0;
      counts.AllSkirmish += avatar.skirmish ? 1 : 0;
      counts.DLC += avatar.entitlement ? 1 : 0;
      counts.Bundle += helpers.Bundle(avatar) ? 1 : 0;
      counts.Winning += (avatar.skirmish && avatar.skirmish.reward.ForWinningFaction) ? 1 : 0;

      ['Cohort', 'TimedPromotion', 'StoreID', 'StoreLabel', 'PromoType', 'BPSeason', 'Entitlement', 'Skirmish', 'TimedEvent'].forEach(key => {
        const val = helpers[key](avatar);
        if (val) counts[key][val] = (counts[key][val] || 0) + 1;
      });
    });

    return counts;
  }, [avatars, filters, helpers, applyFilters]);
}

export function AvatarStoreView({ avatars, langs }) {
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [sortType, setSortType] = useState('ArrayIndexDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterPromo, setFilterPromo] = useState('');
  const [filterStoreID, setFilterStoreID] = useState('');
  const [storeOnly, setStoreOnly] = useState(false);
  const [filterStoreLabel, setFilterStoreLabel] = useState('');
  const [filterPromoType, setFilterPromoType] = useState('');
  const [filterTimedPromotion, setFilterTimedPromotion] = useState('');
  const [filterBPSeason, setFilterBPSeason] = useState('');
  const [filterEntitlement, setFilterEntitlement] = useState(false);
  const [filterSkirmish, setFilterSkirmish] = useState('');
  const [filterTimedEvent, setFilterTimedEvent] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const topRef = useRef(null);
  const filterSectionRef = useRef(null);
  const detailPanelRef = useRef(null);
  const [filterBundle, setFilterBundle] = useState(false);
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const isInitialMount = useRef(true);
  const filtersChanged = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else if (isMobile) {
      setSelectedAvatar(null);
      filtersChanged.current = true;
    }
  }, [
    filterCohort, filterPromo, filterStoreID, storeOnly, filterStoreLabel,
    filterPromoType, filterTimedPromotion, filterBPSeason, filterEntitlement,
    filterSkirmish, filterTimedEvent, debouncedSearch, sortType, isMobile
  ]);

  const helpers = useMemo(() => ({
    Cohort: a => a.store?.[0]?.Cohort ?? '',
    TimedPromotion: a => a.store?.[0]?.TimedPromotion ?? '',
    StoreID: a => a.store?.[0]?.StoreID ?? -1,
    StoreLabel: a => a.store?.[0]?.Label ?? '',
    PromoType: a => a.promo?.Type ?? '',
    TimedEvent: a => a.timedEvent?.TimedEventName ?? '',
    BPSeason: a => a.bp?.ID ?? '',
    Entitlement: a => !!a.entitlement,
    Bundle: a => !!(a.store?.some(s => s.Type === 'Bundle')),
    Skirmish: a => {
      if (a.skirmish && a.skirmish.reward.ForWinningFaction) return 'Winning';
      if (a.skirmish) return 'AllSkirmish';
      return '';
    }
  }), []);

  const cohorts = useMemo(() => uniqueValues(avatars, ['store', 'Cohort']), [avatars]);
  const promotions = useMemo(() => uniqueValues(avatars, ['store', 'TimedPromotion']), [avatars]);
  const storeLabels = useMemo(() => uniqueValues(avatars, ['store', 'Label']), [avatars]);
  const promoTypes = useMemo(() => uniqueValues(avatars, ['promo', 'Type']), [avatars]);
  const timedEvents = useMemo(() => uniqueValues(avatars, ['timedEvent', 'TimedEventName']), [avatars]);
  const bpSeasons = useMemo(() => {
    return [
      ...new Set(
        avatars
          .filter(t => t.bp && t.bp.ID)
          .map(t => t.bp.ID)
      ),
    ].sort((a, b) => {
      const getNum = id => parseInt(id.replace('BP', '').split('-')[0]);
      const nA = getNum(a), nB = getNum(b);
      if (nA !== nB) return nA - nB;
      return a.localeCompare(b);
    });
  }, [avatars]);

  const optionCounts = useOptionCounts(
    avatars,
    {
      Cohort: filterCohort,
      TimedPromotion: filterPromo,
      StoreID: filterStoreID,
      StoreLabel: filterStoreLabel,
      PromoType: filterPromoType,
      TimedEvent: filterTimedEvent,
      BPSeason: filterBPSeason,
      Entitlement: filterEntitlement,
      Skirmish: filterSkirmish,
      StoreOnly: storeOnly
    },
    helpers
  );

  const getDisplayNameKey = a => a.store?.[0]?.DisplayNameKey ?? a.avatarData.DisplayNameKey ?? '';
  const getDescriptionKey = a => a.store?.[0]?.DescriptionKey ?? a.avatarData.DisplayNameKey ?? '';
  const getIdolCost = a => a.store?.[0]?.IdolCost ?? '';
  const getStoreID = a => a.store?.[0]?.StoreID ?? -1;
  const getCohort = a => a.store?.[0]?.Cohort ?? '';
  const getLabel = a => a.store?.[0]?.Label ?? '';
  const getTimedPromotion = a => a.store?.[0]?.TimedPromotion ?? '';
  const getPromoType = a => a.promo?.Type ?? '';
  const getTimedEventName = a => a.timedEvent?.TimedEventName ?? '';
  const getBPSeason = a => a.bp?.ID ?? '';

  const filteredAvatars = useMemo(() => {
    const search = debouncedSearch.toLowerCase();

    const passesSearch = (avatar) => {
      const fields = [
        langs.content[getDisplayNameKey(avatar)] || '',
        avatar.store?.map(s => s.StoreName).join(' ') || '',
        avatar.store?.map(s => s.Item).join(' ') || '',
        avatar.store?.map(s => s.Label).join(' ') || '',
        avatar.store?.map(s => s.TimedPromotion).join(' ') || '',
        avatar.store?.map(s => s.SearchTags).join(' ') || '',
        avatar.promo?.StoreName || '',
        avatar.promo?.Item || '',
        avatar.promo?.Label || '',
        avatar.bp?.Item || '',
        avatar.bp?.ID || '',
        avatar.bp?.DescriptionKey || '',
        avatar.store?.map(s => String(s.StoreID)).join(' ') || '',
        avatar.store?.map(s => String(s.IdolCost)).join(' ') || '',
        avatar.store?.map(s => String(s.GoldCost)).join(' ') || '',
        avatar.store?.map(s => String(s.RankedPointsCost)).join(' ') || '',
        avatar.store?.map(s => String(s.Cohort)).join(' ') || '',
        avatar.store?.map(s => String(s.Popularity)).join(' ') || '',
        avatar.store?.map(s => String(s.Type)).join(' ') || '',
        avatar.store?.map(s => String(s.NonRefundable)).join(' ') || '',
        avatar.store?.map(s => String(s.AcctLevelReq)).join(' ') || '',
        avatar.store?.map(s => String(s.HeroLevelReq)).join(' ') || '',
        avatar.store?.map(s => String(s.SpecialCurrencyType)).join(' ') || '',
        avatar.store?.map(s => String(s.SpecialCurrencyCost)).join(' ') || '',
        avatar.store?.map(s => String(s.MissionTags)).join(' ') || '',
        avatar.store?.map(s => String(s.RequiredStoreType)).join(' ') || '',
        avatar.store?.map(s => String(s.ThirdPartyLogo)).join(' ') || '',
        avatar.avatarData.AvatarName || '',
        avatar.avatarData.IconName || '',
        avatar.avatarData.BitmapFileName || '',
        avatar.avatarData.InventoryOrderID || '',
        avatar.avatarData.InventorySubOrderID || '',
        avatar.entitlement?.EntitlementName || '',
        avatar.entitlement?.DisplayNameKey || '',
        avatar.skirmish?.reward?.ForFaction || '',
        avatar.timedEvent?.TimedEventName || '',
        avatar.timedEvent?.EventCenterHeaderKey || '',
        getRankedLabel(avatar.avatarData.AvatarName) || ''
      ].map(f => f && typeof f === 'string' ? f.toLowerCase() : '');
      return !search || fields.some(f => f.includes(search));
    };

    return avatars.filter(avatar => {
      if (!passesSearch(avatar)) return false;
      if (filterCohort && helpers.Cohort(avatar) !== filterCohort) return false;
      if (filterPromo && helpers.TimedPromotion(avatar) !== filterPromo) return false;
      if (filterStoreID && helpers.StoreID(avatar) !== filterStoreID) return false;
      if (filterStoreLabel && helpers.StoreLabel(avatar) !== filterStoreLabel) return false;
      if (filterPromoType && helpers.PromoType(avatar) !== filterPromoType) return false;
      if (filterTimedPromotion && helpers.TimedPromotion(avatar) !== filterTimedPromotion) return false;
      if (filterTimedEvent && helpers.TimedEvent(avatar) !== filterTimedEvent) return false;
      if (filterBundle && !avatar.store?.some(s => s.Type === 'Bundle')) return false;
      if (filterBPSeason) {
        if (filterBPSeason === 'AllBP' && !avatar.bp) return false;
        if (filterBPSeason !== 'AllBP' && helpers.BPSeason(avatar) !== filterBPSeason) return false;
      }
      if (filterEntitlement && !avatar.entitlement) return false;
      if (filterSkirmish) {
        if (filterSkirmish === 'AllSkirmish' && !avatar.skirmish) return false;
        if (filterSkirmish === 'Winning' && (!avatar.skirmish || !avatar.skirmish.reward.ForWinningFaction)) return false;
      }
      if (storeOnly && !avatar.store?.length) return false;
      return true;
    }).sort((a, b) => {
      const idxA = typeof a.ArrayIndex === 'number' ? a.ArrayIndex : parseInt(a.ArrayIndex) || 0;
      const idxB = typeof b.ArrayIndex === 'number' ? b.ArrayIndex : parseInt(b.ArrayIndex) || 0;
      const nameA = langs.content[getDisplayNameKey(a)] || '';
      const nameB = langs.content[getDisplayNameKey(b)] || '';
      const costA = parseInt(getIdolCost(a)) || 0;
      const costB = parseInt(getIdolCost(b)) || 0;
      const storeA = parseInt(getStoreID(a)) || 0;
      const storeB = parseInt(getStoreID(b)) || 0;
      const avatarA = parseInt(a.avatarData.AvatarID) || 0;
      const avatarB = parseInt(b.avatarData.AvatarID) || 0;
      const popA = parseInt(a.store?.[0]?.Popularity) || 0;
      const popB = parseInt(b.store?.[0]?.Popularity) || 0;
      const orderA = parseInt(a.avatarData.InventoryOrderID) || 0;
      const orderB = parseInt(b.avatarData.InventoryOrderID) || 0;
      const subOrderA = parseInt(a.avatarData.InventorySubOrderID) || 0;
      const subOrderB = parseInt(b.avatarData.InventorySubOrderID) || 0;
      switch (sortType) {
        case 'ArrayIndexAsc': return idxA - idxB;
        case 'ArrayIndexDesc': return idxB - idxA;
        case 'AvatarIDAsc': return avatarA - avatarB;
        case 'AvatarIDDesc': return avatarB - avatarA;
        case 'StoreIDAsc': return storeA - storeB;
        case 'StoreIDDesc': return storeB - storeA;
        case 'AlphaAsc': return nameA.localeCompare(nameB);
        case 'AlphaDesc': return nameB.localeCompare(nameA);
        case 'CostAsc': return costA - costB;
        case 'CostDesc': return costB - costA;
        case 'PopularityAsc': return popA - popB;
        case 'PopularityDesc': return popB - popA;
        case 'InventoryOrderAsc':
          if (orderA !== orderB) return orderA - orderB;
          return subOrderA - subOrderB;
        case 'InventoryOrderDesc':
          if (orderA !== orderB) return orderB - orderA;
          return subOrderB - subOrderA;
        default: return 0;
      }
    });
  }, [
    avatars, debouncedSearch, sortType, filterCohort, filterPromo, filterStoreID, storeOnly,
    filterStoreLabel, filterPromoType, filterTimedPromotion, filterBPSeason, filterEntitlement, filterBundle,
    filterSkirmish, filterTimedEvent, langs, helpers
  ]);

  const handleFilterChange = useCallback((setter, value) => {
    setter(value);
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!selectedAvatar) return;
    const url = `${window.location.origin}${window.location.pathname}?avatar=${selectedAvatar.avatarData.AvatarID}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback('Link Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }, [selectedAvatar]);

  useEffect(() => {
    if (avatars.length === 0 || filteredAvatars.length === 0) return;
    if (isMobile && filtersChanged.current) {
      filtersChanged.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const avatarId = params.get('avatar') ? String(params.get('avatar')) : null;
    let avatar = null;
    if (avatarId) {
      avatar = filteredAvatars.find(t => String(t.avatarData.AvatarID) === avatarId);
    }
    if (!avatar && !isMobile) {
      avatar = filteredAvatars[0];
    }
    setSelectedAvatar(avatar);
  }, [avatars, filteredAvatars, isMobile]);

  useEffect(() => {
    if (isMobile && selectedAvatar && !filteredAvatars.some(t => t.avatarData.AvatarID === selectedAvatar.avatarData.AvatarID)) {
      setSelectedAvatar(null);
    }
  }, [filteredAvatars, isMobile, selectedAvatar]);

  useEffect(() => {
    const currentParams = new URLSearchParams();
    if (selectedAvatar) {
      currentParams.set('avatar', String(selectedAvatar.avatarData.AvatarID));
    }
    const newUrl = currentParams.toString() ? `${window.location.pathname}?${currentParams}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const avatarId = params.get('avatar') ? String(params.get('avatar')) : null;
      if (avatarId && filteredAvatars.length > 0) {
        const avatar = filteredAvatars.find(t => String(t.avatarData.AvatarID) === avatarId);
        if (avatar) {
          setSelectedAvatar(avatar);
        } else if (!isMobile) {
          setSelectedAvatar(filteredAvatars[0]);
        } else {
          setSelectedAvatar(null);
        }
      } else if (!isMobile) {
        setSelectedAvatar(filteredAvatars[0]);
      } else {
        setSelectedAvatar(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedAvatar, filteredAvatars, isMobile]);

  const resetFilters = useCallback(() => {
    setSortType('ArrayIndexDesc');
    setSearchQuery('');
    setFilterCohort('');
    setFilterPromo('');
    setFilterStoreID('');
    setStoreOnly(false);
    setFilterStoreLabel('');
    setFilterPromoType('');
    setFilterTimedPromotion('');
    setFilterBPSeason('');
    setFilterEntitlement(false);
    setFilterSkirmish('');
    setFilterTimedEvent('');
    if (isMobile) {
      setSelectedAvatar(null);
      filtersChanged.current = true;
    } else {
      setSelectedAvatar(filteredAvatars[0] || null);
    }
  }, [filteredAvatars, isMobile]);

  function getProcessedStoreData(avatar) {
    let storeData = avatar.store || [];
    storeData = [...new Map(storeData.map(sd => [sd.StoreID, sd])).values()];
    storeData = storeData.map(sd => {
      let costs = {
        mc: 0,
        mcSale: 0,
        gold: 0,
        glory: 0,
        special: {}
      };
      if (sd.Type === 'Bundle' && Array.isArray(sd.ItemList) && sd.ItemList.length > 0) {
        if (sd.IdolCost != 0 && sd.IdolCost != '' || sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') {
          if (sd.IdolCost != 0 && sd.IdolCost != '') {
            costs.mc = Number(sd.IdolCost);
          }
          if (sd.IdolSaleCost != 0 && sd.IdolSaleCost != '') {
            costs.mcSale = Number(sd.IdolSaleCost);
          }
        } else {
          sd.ItemList.forEach(item => {
            if (item.IdolCost != 0 && item.IdolCost != '') {
              costs.mc += Number(item.IdolCost);
            }
            if (item.IdolSaleCost != 0 && item.IdolSaleCost != '') {
              costs.mc += Number(item.IdolSaleCost);
            }
            if (item.GoldCost != 0 && item.GoldCost != '') {
              costs.gold += Number(item.GoldCost);
            }
            if (item.GoldSaleCost != 0 && item.GoldSaleCost != '') {
              costs.gold += Number(item.GoldSaleCost);
            }
            if (item.RankedPointsCost != 0 && item.RankedPointsCost != '') {
              costs.glory += Number(item.RankedPointsCost);
            }
            if (item.SpecialCurrencyCost != 0 && item.SpecialCurrencyCost != '' && item.SpecialCurrencyType) {
              costs.special[item.SpecialCurrencyType] = (costs.special[item.SpecialCurrencyType] || 0) + Number(item.SpecialCurrencyCost);
            }
          });
          if (sd.IdolBundleDiscount) {
            costs.mc = Math.floor(costs.mc * (sd.IdolBundleDiscount ?? 1));
          }
          if (sd.GoldBundleDiscount) {
            costs.gold = Math.floor(costs.gold * (sd.GoldBundleDiscount ?? 1));
          }
          if (sd.RankedPointsBundleDiscount) {
            costs.glory = Math.floor(costs.glory * (sd.RankedPointsBundleDiscount ?? 1));
          }
          if (sd.SpecialCurrencyBundleDiscount) {
            for (let currencyType in costs.special) {
              costs.special[currencyType] = Math.floor(costs.special[currencyType] * (sd.SpecialCurrencyBundleDiscount ?? 1));
            }
          }
        }
      } else {
        if (sd.IdolCost && sd.IdolCost != 0 && sd.IdolCost !== '') {
          costs.mc = Number(sd.IdolCost);
        }
        if (sd.IdolSaleCost && sd.IdolSaleCost != 0 && sd.IdolSaleCost !== '') {
          costs.mcSale = Number(sd.IdolSaleCost);
        }
        if (sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') {
          costs.gold = Number(sd.GoldCost);
        }
        if (sd.GoldSaleCost && sd.GoldSaleCost != 0 && sd.GoldSaleCost !== '') {
          costs.gold = Number(sd.GoldSaleCost);
        }
        if (sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') {
          costs.glory = Number(sd.RankedPointsCost);
        }
        if (sd.SpecialCurrencyCost && sd.SpecialCurrencyCost != 0 && sd.SpecialCurrencyCost !== '' && sd.SpecialCurrencyType) {
          costs.special[sd.SpecialCurrencyType] = Number(sd.SpecialCurrencyCost);
        }
      }
      return { ...sd, Costs: costs };
    });
    return storeData.sort((a, b) => {
      const sumA = a.Costs.mc + a.Costs.mcSale + a.Costs.gold + a.Costs.glory + Object.values(a.Costs.special).reduce((sum, val) => sum + val, 0);
      const sumB = b.Costs.mc + b.Costs.mcSale + b.Costs.gold + b.Costs.glory + Object.values(b.Costs.special).reduce((sum, val) => sum + val, 0);
      return sumA - sumB;
    });
  }

  function genStoreData(store) {
    return store.map((sd, idx) => (
      <div key={`store-${idx}`}>
        <span className="text-lg text-gray-900 dark:text-white">Store Data {sd.Type === 'Bundle' ? '(Bundle)' : '(Avatar)'}</span>
        <div className="grid grid-cols-2 gap-2 text-lg">
          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
            <span className="font-bold text-gray-600 dark:text-gray-300">Store Name</span>
            <span className="text-gray-900 dark:text-white">{sd.StoreName}</span>
          </div>
          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
            <span className="font-bold text-gray-600 dark:text-gray-300">Store ID</span>
            <span className="text-gray-900 dark:text-white">{sd.StoreID}</span>
          </div>
          {sd.Type === 'Bundle' && sd.ItemList && sd.ItemList.length > 0 ? (
            <div className="col-span-2 flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Bundle Cost</span>
              <div className="flex flex-wrap items-center gap-2">
                {sd.Costs.mc > 0 && (
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
                {Object.entries(sd.Costs.special).map(([currencyType, cost], sIdx) => cost > 0 && (
                  <div key={`special-${sIdx}`} className="flex items-center gap-1">
                    <img
                      src={`${host}/game/getGfx/storeIcon/${currencyType}`}
                      className="h-5 inline"
                      onError={e => (e.target.src = `${host}/game/getGfx/storeIcon/mc`)}
                    />
                    <span className="text-gray-900 dark:text-white">{cost}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {(sd.Costs.mc > 0 || sd.IdolCost != 0 && sd.IdolCost != '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Coin Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.mc || sd.IdolCost}</span>
                  </div>
                </div>
              )}
              {sd.Costs.mcSale > 0 && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Mammoth Sale Price</span>
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/mc`} className="h-5 inline" />
                    <span className="line-through text-red-600 dark:text-red-400">{sd.Costs.mc || sd.IdolCost}</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{sd.Costs.mcSale}</span>
                  </div>
                </div>
              )}
              {(sd.Costs.gold > 0 || sd.GoldCost && sd.GoldCost != 0 && sd.GoldCost !== '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.gold || sd.GoldCost}</span>
                  </div>
                </div>
              )}
              {sd.GoldSaleCost && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Sale Price</span>
                  <div className="flex items-center gap-1">
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 inline" />
                    <span className="line-through text-red-600 dark:text-red-400">{sd.GoldCost}</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{sd.GoldSaleCost}</span>
                  </div>
                </div>
              )}
              {sd.GoldBundleDiscount && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Gold Bundle Discount</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.GoldBundleDiscount}</span>
                  </div>
                </div>
              )}
              {(sd.Costs.glory > 0 || sd.RankedPointsCost && sd.RankedPointsCost != 0 && sd.RankedPointsCost !== '') && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Glory Cost</span>
                  <div>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="h-5 pr-1 inline" />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.glory || sd.RankedPointsCost}</span>
                  </div>
                </div>
              )}
              {sd.SpecialCurrencyType && (sd.Costs.special[sd.SpecialCurrencyType] || sd.SpecialCurrencyCost) && (
                <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                  <span className="font-bold text-gray-600 dark:text-gray-300">{sd.SpecialCurrencyType} Cost</span>
                  <div>
                    <img
                      src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`}
                      className="h-5 pr-1 inline"
                      onError={e => (e.target.src = `${host}/game/getGfx/storeIcon/mc`)}
                    />
                    <span className="text-gray-900 dark:text-white">{sd.Costs.special[sd.SpecialCurrencyType] || sd.SpecialCurrencyCost}</span>
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
              <span className="text-gray-900 dark:text-white">{sd.Label}</span>
            </div>
          )}
          {sd.TimedPromotion && (
            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
              <span className="font-bold text-gray-600 dark:text-gray-300">Timed Promotion</span>
              <span className="text-gray-900 dark:text-white">{sd.TimedPromotion}</span>
            </div>
          )}
        </div>
      </div>
    ));
  }

  const Row = ({ index, data }) => {
    const avatar = data[index];
    const [imgLoading, setImgLoading] = useState(true);
    const storeData = getProcessedStoreData(avatar);
    const skirmish = avatar.skirmish;
    let backgroundStyle = {};
    let textColor = '#ffffff';
    if (skirmish) {
      const factions = skirmish.factionsData;
      const color1 = factions[0]?.FactionColor.replace('0x', '#') || '#000000';
      const color2 = factions[1]?.FactionColor.replace('0x', '#') || '#000000';
      textColor = getTextColor(factions[0]?.FactionColor || '0x000000');
      backgroundStyle = {
        background: `linear-gradient(45deg, ${color1} 50%, ${color2} 50%)`,
        color: textColor
      };
    }

    return (
      <div className={viewMode === 'grid' ? 'p-1 w-full h-[260px]' : 'p-0 px-2 h-[160px]'}>
        <div
          className={`bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 p-3 transition-all duration-200 ${selectedAvatar?.avatarData.AvatarID === avatar.avatarData.AvatarID ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${viewMode === 'grid' ? 'flex flex-col items-center text-center h-full' : 'flex'}`}
          onClick={() => {
            setSelectedAvatar(avatar);
            filtersChanged.current = false;
          }}
        >
          <div className={`flex rounded-lg items-center justify-center  relative`}>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 bg-opacity-80 z-10 rounded-lg">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
                </svg>
              </div>
            )}
            <img
              src={`${host}/game/animAvatar/${avatar.avatarData.AvatarID}`}
              className="h-32 w-32 object-contain"
              onLoad={() => setImgLoading(false)}

            />
          </div>
          <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center mt-2' : 'ml-4'}`}>
            <div className={`flex flex-col gap-1 ${viewMode === 'grid' ? 'items-center text-center' : ''}`}>
              {viewMode !== 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!avatar.store?.length && !avatar.bp && !avatar.entitlement && !avatar.skirmish && !avatar.promo && !avatar.timedEvent && !getRankedLabel(avatar.avatarData.AvatarName) && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {(() => {
                    const rankedLabel = getRankedLabel(avatar.avatarData.AvatarName);
                    if (rankedLabel) {
                      let color = rankColors.competitor;
                      if (avatar.avatarData.AvatarName.startsWith('RankedDiamond')) color = rankColors.diamond;
                      else if (avatar.avatarData.AvatarName.startsWith('RankedPlatinum')) color = rankColors.platinum;
                      else if (avatar.avatarData.AvatarName.startsWith('RankedGold')) color = rankColors.gold;
                      else if (avatar.avatarData.AvatarName === 'RankedValhallan') color = rankColors.valhallan;
                      else if (avatar.avatarData.AvatarName === 'RankedValhallanFallen') color = rankColors.fallen;
                      return (
                        <div className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>
                          {rankedLabel}
                        </div>
                      );
                    }
                  })()}
                  {avatar.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Battle Pass Season ${avatar.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {avatar.promo && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`Promo Code${!avatar.store?.length && !avatar.bp && !avatar.entitlement && !avatar.skirmish && !avatar.timedEvent ? ' Only' : ''}`}
                    </div>
                  )}
                  {avatar.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${langs.content[avatar.entitlement.DisplayNameKey]?.replace('!', '') || avatar.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {avatar.timedEvent && (
                    <div className="bg-orange-400 dark:bg-orange-600 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {`${avatar.timedEvent.TimedEventName} Event`}
                    </div>
                  )}
                  {skirmish && (
                    <div
                      className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={backgroundStyle}
                    >
                      <span>{`${langs.content[skirmish.factionsData.find(r => r.FactionName == skirmish.reward.ForFaction).DisplayNameKey]}${skirmish.reward.ForWinningFaction ? ' Faction Win' : ' Faction'}`}</span>
                    </div>
                  )}
                  {avatar.store?.length > 0 && (() => {
                    const labels = [...new Set(avatar.store.map(s => s.Label).filter(Boolean))];
                    return labels.map((label, idx) => (
                      <div key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-xs font-bold px-2 py-0.5 rounded-lg`}>
                        {label === "LastChance" ? "No Longer Purchasable" : label}
                      </div>
                    ));
                  })()}
                  {avatar.store?.length > 0 && (() => {
                    const promos = [...new Set(avatar.store.map(s => s.TimedPromotion).filter(Boolean))];
                    return promos.map((promo, idx) => (
                      <div key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        {formatLabel(promo)}
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className={`flex flex-row items-center gap-2 text-gray-900 dark:text-white font-bold ${viewMode === 'grid' ? 'text-base' : 'text-lg'}`}>
                <span className={viewMode === 'grid' ? 'truncate max-w-[10rem]' : ''}>{langs.content[avatar.avatarData.DisplayNameKey] || avatar.avatarData.AvatarName}</span>
              </div>
              {viewMode === 'grid' && (
                <div className="flex flex-wrap gap-1">
                  {!avatar.store?.length && !avatar.bp && !avatar.entitlement && !avatar.skirmish && !avatar.promo && !avatar.timedEvent && !getRankedLabel(avatar.avatarData.AvatarName) && (
                    <div className="bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      Not Obtainable
                    </div>
                  )}
                  {(() => {
                    const rankedLabel = getRankedLabel(avatar.avatarData.AvatarName);
                    if (rankedLabel) {
                      let color = rankColors.competitor;
                      if (avatar.avatarData.AvatarName.startsWith('RankedDiamond')) color = rankColors.diamond;
                      else if (avatar.avatarData.AvatarName.startsWith('RankedPlatinum')) color = rankColors.platinum;
                      else if (avatar.avatarData.AvatarName.startsWith('RankedGold')) color = rankColors.gold;
                      else if (avatar.avatarData.AvatarName === 'RankedValhallan') color = rankColors.valhallan;
                      else if (avatar.avatarData.AvatarName === 'RankedValhallanFallen') color = rankColors.fallen;
                      return (
                        <div className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded-lg`}>
                          {rankedLabel}
                        </div>
                      );
                    }
                  })()}
                  {avatar.promo && !avatar.store?.length && !avatar.bp && !avatar.entitlement && !avatar.skirmish && !avatar.timedEvent && (
                    <div className="bg-violet-600 dark:bg-violet-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Promo Code Only`}
                    </div>
                  )}
                  {avatar.bp && (
                    <div className="bg-emerald-600 dark:bg-emerald-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`Battle Pass Season ${avatar.bp.ID.replace('BP', '').replace('-', ' ')}`}
                    </div>
                  )}
                  {avatar.entitlement && (
                    <div className="bg-amber-400 dark:bg-amber-700 text-black dark:text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {`${langs.content[avatar.entitlement.DisplayNameKey]?.replace('!', '') || avatar.entitlement.EntitlementName} DLC`}
                    </div>
                  )}
                  {skirmish && (
                    <div
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={backgroundStyle}
                    >
                      <span>{`${langs.content[skirmish.factionsData.find(r => r.FactionName == skirmish.reward.ForFaction).DisplayNameKey]}${skirmish.reward.ForWinningFaction ? ' Faction Win' : ' Faction'}`}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-gray-900 flex flex-wrap items-center gap-x-3 dark:text-white">
              {storeData.map((sd, idx) => {
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
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" />
                      <span>{bundleCost}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400"> (Bundle)</span>
                    </div>
                  );
                }
                if (sd.IdolCost && sd.IdolCost != 0) {
                  return (
                    <div key={`idol-${idx}`}>
                      <img src={`${host}/game/getGfx/storeIcon/mc`} className="inline h-4 mr-1" />
                      <span>{sd.IdolCost}</span>
                    </div>
                  );
                }
                return null;
              })}
              {storeData.map((sd, idx) =>
                sd.GoldCost && (
                  <div key={`gold-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/gold`} className="inline h-4 mr-1" />
                    <span>{sd.GoldCost}</span>
                  </div>
                )
              )}
              {storeData.map((sd, idx) =>
                sd.RankedPointsCost && (
                  <div key={`glory-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/glory`} className="inline h-4 mr-1" />
                    <span>{sd.RankedPointsCost}</span>
                  </div>
                )
              )}
              {storeData.map((sd, idx) =>
                sd.SpecialCurrencyType && (
                  <div key={`special-${idx}`}>
                    <img src={`${host}/game/getGfx/storeIcon/${sd.SpecialCurrencyType}`} className="inline h-4 mr-1" />
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
    <div className="flex flex-col lg:flex-row h-full" style={{ fontFamily: langs.font || 'BHLatinBold' }}>
      <div ref={topRef} className="flex-1 p-2 bg-gray-100 dark:bg-slate-900 lg:w-[35%] h-full">
        <div ref={filterSectionRef} className="space-y-4 mb-4">
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
              {Object.values(optionCounts.TimedPromotion).some(count => count > 0) && (
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
              {Object.values(optionCounts.StoreLabel).some(count => count > 0) && (
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
              {Object.values(optionCounts.TimedEvent).some(count => count > 0) && (
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
              {(optionCounts.AllBP > 0 || Object.values(optionCounts.BPSeason).some(count => count > 0)) && (
                <select
                  value={filterBPSeason}
                  onChange={e => handleFilterChange(setFilterBPSeason, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Battle Pass</option>
                  {optionCounts.AllBP > 0 && <option value="AllBP">All Battle Pass Avatars ({optionCounts.AllBP})</option>}
                  {bpSeasons.filter(season => optionCounts.BPSeason[season] > 0).map(season => (
                    <option key={season} value={season}>
                      {season.replace('BP', 'Season ')} ({optionCounts.BPSeason[season]})
                    </option>
                  ))}
                </select>
              )}
              {(optionCounts.AllSkirmish > 0 || optionCounts.Winning > 0) && (
                <select
                  value={filterSkirmish}
                  onChange={e => handleFilterChange(setFilterSkirmish, e.target.value)}
                  className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg px-4 py-1 border border-gray-300 dark:border-slate-600 min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="">Skirmish Avatars</option>
                  {optionCounts.AllSkirmish > 0 && <option value="AllSkirmish">All Skirmish Avatars ({optionCounts.AllSkirmish})</option>}
                  {optionCounts.Winning > 0 && <option value="Winning">Winning Avatars ({optionCounts.Winning})</option>}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-4 lg:flex-row w-full items-center">
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={storeOnly}
                  onChange={() => handleFilterChange(setStoreOnly, !storeOnly)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                Store Avatars Only ({optionCounts.StoreOnly || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={filterEntitlement}
                  onChange={() => handleFilterChange(setFilterEntitlement, !filterEntitlement)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                DLC Avatars ({optionCounts.DLC || 0})
              </label>
              <label className="text-gray-900 dark:text-white flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={!!filterBundle}
                  onChange={() => handleFilterChange(setFilterBundle, !filterBundle)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                Bundles Only ({optionCounts.Bundle || 0})
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
                placeholder="Search Avatars"
                className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg pl-10 pr-4 py-1 border border-gray-300 dark:border-slate-600 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>
            <div className="flex justify-between items-center w-full sm:w-auto py-2 gap-4">
              <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">
                Showing {filteredAvatars.length} Avatar{filteredAvatars.length !== 1 ? 's' : ''}
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
              <option value="AvatarIDDesc">Avatar ID (Desc)</option>
              <option value="AvatarIDAsc">Avatar ID (Asc)</option>
              <option value="StoreIDDesc">Store ID (Desc)</option>
              <option value="StoreIDAsc">Store ID (Asc)</option>
              <option value="AlphaAsc">Alphabetical (A-Z)</option>
              <option value="AlphaDesc">Alphabetical (Z-A)</option>
              <option value="CostDesc">Mammoth Cost (Desc)</option>
              <option value="CostAsc">Mammoth Cost (Asc)</option>
              <option value="PopularityDesc">Popularity (Desc)</option>
              <option value="PopularityAsc">Popularity (Asc)</option>
              <option value="InventoryOrderAsc">Inventory Order (Asc)</option>
              <option value="InventoryOrderDesc">Inventory Order (Desc)</option>
            </select>
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        <div className="h-[100vh]">
          {viewMode === 'list' ? (
            <Virtuoso
              data={filteredAvatars}
              totalCount={filteredAvatars.length}
              itemContent={(index, avatar) => <Row index={index} data={filteredAvatars} />}
            />
          ) : (
            <VirtuosoGrid
              data={filteredAvatars}
              totalCount={filteredAvatars.length}
              listClassName="grid grid-cols-2 lg:grid-cols-3"
              itemClassName="avatar-grid-item"
              itemContent={(index, avatar) => <Row index={index} data={filteredAvatars} />}
              useWindowScroll={false}
            />
          )}
        </div>
      </div>
      <div ref={detailPanelRef} className={`h-full lg:w-[65%] fixed inset-0 bg-black bg-opacity-50 z-50 lg:static lg:bg-transparent lg:border-l lg:border-gray-300 lg:dark:border-slate-600 lg:flex lg:flex-col lg:gap-4 lg:shadow-none ${selectedAvatar ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white dark:bg-slate-900 p-2 h-full overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden text-gray-900 dark:text-white"
              onClick={() => setSelectedAvatar(null)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            {isMobile && selectedAvatar && (
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
          {selectedAvatar ? (
            <div className="gap-2 flex flex-col">
              <div className="flex flex-col gap-2 pb-3 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{langs.content[selectedAvatar.avatarData.DisplayNameKey] || selectedAvatar.avatarData.AvatarName}</span>
                  </div>
                </div>
                {langs.content[getDescriptionKey(selectedAvatar)] && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {langs.content[getDescriptionKey(selectedAvatar)]}
                  </div>
                )}

                {selectedAvatar.store?.flatMap(s => splitTags(s.SearchTags)).filter(Boolean).length > 0 && (
                  <div className="flex flex-col flex-wrap">
                    <span className="text-gray-900 dark:text-white">Store Search Tags</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...new Set(selectedAvatar.store.flatMap(s => splitTags(s.SearchTags)).filter(Boolean))].map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 dark:bg-slate-700 rounded-full px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const rankedLabel = getRankedLabel(selectedAvatar.avatarData.AvatarName);
                      if (rankedLabel) {
                        let color = rankColors.competitor;
                        if (selectedAvatar.avatarData.AvatarName.startsWith('RankedDiamond')) color = rankColors.diamond;
                        else if (selectedAvatar.avatarData.AvatarName.startsWith('RankedPlatinum')) color = rankColors.platinum;
                        else if (selectedAvatar.avatarData.AvatarName.startsWith('RankedGold')) color = rankColors.gold;
                        else if (selectedAvatar.avatarData.AvatarName === 'RankedValhallan') color = rankColors.valhallan;
                        else if (selectedAvatar.avatarData.AvatarName === 'RankedValhallanFallen') color = rankColors.fallen;
                        return (
                          <div className={`${color} text-white text-sm font-bold px-3 py-1 rounded-lg`}>
                            {rankedLabel}
                          </div>
                        );
                      }
                    })()}
                    {selectedAvatar.promo && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-purple-500 dark:bg-purple-700 text-gray-900 dark:text-white">
                        Promo Type: {selectedAvatar.promo.Type}
                      </span>
                    )}
                    {selectedAvatar.bp && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-emerald-500 dark:bg-emerald-700 text-gray-900 dark:text-white">
                        Battle Pass Season {selectedAvatar.bp.ID.replace('BP', '').replace('-', ' ')} (Tier {selectedAvatar.bp.Tier})
                      </span>
                    )}
                    {selectedAvatar.timedEvent && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-orange-500 dark:bg-orange-600 text-gray-900 dark:text-white">
                        {selectedAvatar.timedEvent.TimedEventName} Event
                      </span>
                    )}
                    {selectedAvatar.entitlement && (
                      <span className="text-sm px-3 py-1 rounded-lg bg-amber-500 dark:bg-amber-700 text-gray-900 dark:text-white">
                        {langs.content[selectedAvatar.entitlement.DisplayNameKey]?.replace('!', '') || selectedAvatar.entitlement.EntitlementName} DLC
                      </span>
                    )}
                    {selectedAvatar.skirmish && (
                      <span
                        className="text-sm px-3 py-1 rounded-lg"
                        style={{
                          background: `linear-gradient(45deg, ${selectedAvatar.skirmish.factionsData[0]?.FactionColor.replace('0x', '#') || '#000000'} 50%, ${selectedAvatar.skirmish.factionsData[1]?.FactionColor.replace('0x', '#') || '#000000'} 50%)`,
                          color: getTextColor(selectedAvatar.skirmish.factionsData[0]?.FactionColor || '0x000000')
                        }}
                      >
                        {`${langs.content[selectedAvatar.skirmish.factionsData.find(r => r.FactionName == selectedAvatar.skirmish.reward.ForFaction).DisplayNameKey]}${selectedAvatar.skirmish.reward.ForWinningFaction ? ' Faction Win' : ' Faction'}`}
                      </span>
                    )}
                    {selectedAvatar.store?.length > 0 && (() => {
                      const labels = [...new Set(selectedAvatar.store.map(s => s.Label).filter(Boolean))];
                      return labels.map((label, idx) => (
                        <span key={idx} className={`${label === "New" ? "bg-yellow-300 dark:bg-yellow-500" : label === "LastChance" ? "bg-red-500 dark:bg-red-700" : "bg-cyan-400 dark:bg-cyan-600"} text-black text-sm px-3 py-1 rounded-lg`}>
                          {label === "LastChance" ? "No Longer Purchasable" : label}
                        </span>
                      ));
                    })()}
                    {selectedAvatar.store?.length > 0 && (() => {
                      const promos = [...new Set(selectedAvatar.store.map(s => s.TimedPromotion).filter(Boolean))];
                      return promos.map((promo, idx) => (
                        <span key={idx} className="bg-rose-400 dark:bg-rose-700 text-black dark:text-white text-sm px-3 py-1 rounded-lg">
                          {formatLabel(promo)}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
                {selectedAvatar.avatarData.AvatarName === 'RankedValhallan' || selectedAvatar.avatarData.AvatarName === 'RankedValhallanFallen' ? (
                  <div className="flex flex-col gap-2 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                    <span className="text-lg text-gray-900 dark:text-white">Valhallan Requirements</span>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300">
                      <li>Be in Diamond</li>
                      <li>100 or more wins</li>
                      <li>Be top ranked in your respective region:
                        <ul className="list-disc list-inside ml-4">
                          <li>Top 150: US East & Europe</li>
                          <li>Top 100: Brazil</li>
                          <li>Top 50: Southeast Asia & US West</li>
                          <li>Top 25: Australia, Japan, Middle East</li>
                          <li>Top 15: South Africa</li>
                        </ul>
                      </li>
                      <li>Valhallan is not obtainable during the first 2 weeks of the season</li>
                      <li>If you are out of the Valhallan range after 9am UTC, you will be given the Fallen Valhallan Avatar</li>
                      <li>Valhallan and Fallen Valhallan Avatar act as 1 avatar, you can only have one or the other</li>
                      <li>You keep the Fallen Valhallan Avatar forever once you've gotten it once, even after a season reset</li>
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="order-2 lg:order-1 lg:w-1/2 flex flex-col gap-4 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg">
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-lg text-gray-900 dark:text-white">Avatar Data</span>
                      <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Avatar Name</span>
                          <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.AvatarName}</span>
                        </div>
                        <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Avatar ID</span>
                          <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.AvatarID}</span>
                        </div>
                        {selectedAvatar.avatarData.InventoryOrderID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Inventory Order ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.InventoryOrderID}</span>
                          </div>
                        )}
                        {selectedAvatar.avatarData.InventorySubOrderID && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Inventory Sub Order ID</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.InventorySubOrderID}</span>
                          </div>
                        )}
                        {selectedAvatar.avatarData.GrantedManually && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Granted Manually</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.GrantedManually}</span>
                          </div>
                        )}
                        {selectedAvatar.avatarData.ImplicitOwnership && (
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Implicit Ownership</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.avatarData.ImplicitOwnership}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {getProcessedStoreData(selectedAvatar).length > 0 && genStoreData(getProcessedStoreData(selectedAvatar))}
                    {selectedAvatar.timedEvent && (
                      <div>
                        <span className="text-lg text-gray-900 dark:text-white">Timed Event Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.timedEvent.TimedEventName}</span>
                          </div>
                          {selectedAvatar.timedEvent.TimedEventID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Timed Event ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.timedEvent.TimedEventID}</span>
                            </div>
                          )}
                          {selectedAvatar.timedEvent.EventCenterHeaderKey && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Event Header</span>
                              <span className="text-gray-900 dark:text-white">{langs.content[selectedAvatar.timedEvent.EventCenterHeaderKey] || selectedAvatar.timedEvent.EventCenterHeaderKey}</span>
                            </div>
                          )}
                          {selectedAvatar.timedEvent.EventRewardCurrency && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Reward Currency</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.timedEvent.EventRewardCurrency}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedAvatar.entitlement && (
                      <div>
                        <span className="text-lg text-gray-900 dark:text-white">Entitlement Data</span>
                        <div className="grid grid-cols-2 gap-2 text-lg mt-2">
                          <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                            <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement Name</span>
                            <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.EntitlementName}</span>
                          </div>
                          {selectedAvatar.entitlement.EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.EntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.SteamAppID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Steam App ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.SteamAppID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.SonyEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.SonyEntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.SonyProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Sony Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.SonyProductID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.NintendoConsumableID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Consumable ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.NintendoConsumableID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.NintendoEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Nintendo Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.NintendoEntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.XB1EntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.XB1EntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.XB1ProductID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Product ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.XB1ProductID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.XB1StoreID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">XB1 Store ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.XB1StoreID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.AppleEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Apple Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.AppleEntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.AndroidEntitlementID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Android Entitlement ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.AndroidEntitlementID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.UbiConnectID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.UbiConnectID}</span>
                            </div>
                          )}
                          {selectedAvatar.entitlement.UbiConnectPackageID && (
                            <div className="flex flex-col bg-gray-100 dark:bg-slate-900 p-2 rounded-2xl">
                              <span className="font-bold text-gray-600 dark:text-gray-300">Ubi Connect Package ID</span>
                              <span className="text-gray-900 dark:text-white">{selectedAvatar.entitlement.UbiConnectPackageID}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
                <div className='order-1 lg:order-2 lg:w-1/2 flex flex-col gap-4 dark:bg-slate-800 bg-gray-100 p-2 rounded-lg'>
                  <span className="text-lg text-gray-900 dark:text-white">Avatar Image</span>
                  <div className=' items-center flex flex-col'>
                    <img src={`${host}/game/animAvatar/${selectedAvatar.avatarData.AvatarID}`} className="h-96" alt={selectedAvatar.avatarData.AvatarName} loading="lazy" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 italic">Select an Avatar to see details</div>
          )}
        </div>
      </div>
    </div>
  );
}