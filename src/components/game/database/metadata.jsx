import { host } from '../../../stuff';
import { memo, useEffect, useMemo, useState } from 'react';
import { ImageWithLoader } from './comp/LoadingImage';

const moneyFields = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY', 'BRL', 'MXN'];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(value) {
  if (Array.isArray(value)) return value.some(clean);
  if (typeof value === 'object' && value !== null) return false;
  const normalized = String(value ?? '').trim();
  return normalized !== '' && normalized !== '--' && normalized !== '-' && normalized.toLowerCase() !== 'undefined' && normalized.toLowerCase() !== 'null';
}

function cleanList(values) {
  return asArray(values).flat(Infinity).filter(clean).map((value) => String(value).trim());
}

function label(value, langs) {
  if (!clean(value)) return '';
  return langs?.content?.[value] || String(value).replace(/([a-z])([A-Z])/g, '$1 $2');
}

function displayName(key, fallback, langs) {
  if (clean(key)) return langs?.content?.[key] || key;
  return fallback || '';
}

function hex(value, fallback = '#334155') {
  return clean(value) ? String(value).replace('0x', '#') : fallback;
}

function textColor(bg) {
  const c = hex(bg, '#334155').replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? '#0f172a' : '#fff';
}

const splitTags = (tags) => {
  if (!tags) return [];
  const result = [];
  let buffer = '';
  let quoted = false;
  for (const char of String(tags)) {
    if (char === "'") quoted = !quoted;
    if (char === ',' && !quoted) {
      result.push(buffer.trim().replace(/^'+|'+$/g, ''));
      buffer = '';
    } else {
      buffer += char;
    }
  }
  if (buffer) result.push(buffer.trim().replace(/^'+|'+$/g, ''));
  return result.filter(Boolean);
};

function normalizedType(type) {
  const value = String(type || '').toLowerCase();
  if (['hero', 'legend'].includes(value)) return 'Hero';
  if (['costumes', 'costume', 'skin'].includes(value)) return 'Costume';
  if (['weaponskins', 'weaponskin'].includes(value)) return 'WeaponSkin';
  if (['avatars', 'avatar'].includes(value)) return 'Avatar';
  if (['emojis', 'emoji'].includes(value)) return 'Emoji';
  if (['spawnbot', 'sidekick'].includes(value)) return 'SpawnBot';
  if (['trail', 'traileffect', 'koeffect'].includes(value)) return 'KOEffect';
  if (['emittergroup', 'emittertrail', 'smoketrail'].includes(value)) return 'EmitterGroup';
  if (['universalcolorscheme', 'randomcolor', 'colorscheme'].includes(value)) return 'ColorScheme';
  if (['playertheme'].includes(value)) return 'PlayerTheme';
  if (['border', 'seasonborder'].includes(value)) return 'Border';
  if (['mammothcoins', 'idols'].includes(value)) return 'MammothCoins';
  if (['battlepointsmult', 'battlepoints', 'battlepassxp'].includes(value)) return 'BattlePassXP';
  return type || 'Item';
}

function currencyIcon(type) {
  if (['MammothCoins', 'Idols'].includes(normalizedType(type))) return `${host}/game/getGfx/storeIcon/mc`;
  return null;
}

function storeRows(item) {
  return asArray(item?.store || item?.bundleData || item?.promoData || item?.entitlementData).filter(Boolean);
}

function storeTags(item) {
  return [...new Set(storeRows(item).flatMap((row) => splitTags(row.SearchTags)))];
}

function num(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemCostValue(item, field) {
  return num(item?.[field]);
}

function storeCostBadges(storeData) {
  const rows = [];
  const add = (type, value, saleValue = 0) => {
    if (value > 0 || saleValue > 0) rows.push({ type, value, saleValue });
  };
  add('mc', itemCostValue(storeData, 'IdolCost'), itemCostValue(storeData, 'IdolSaleCost'));
  add('gold', itemCostValue(storeData, 'GoldCost'), itemCostValue(storeData, 'GoldSaleCost'));
  add('glory', itemCostValue(storeData, 'RankedPointsCost'));
  if (clean(storeData?.SpecialCurrencyType)) add(storeData.SpecialCurrencyType, itemCostValue(storeData, 'SpecialCurrencyCost'));
  return rows;
}

function isHeroBundleItem(item) {
  return normalizedType(item?.Type || item?.type || item?.storeData?.Type) === 'Hero';
}

function bundlePurchaseCosts(store) {
  const rows = [];
  if (clean(store?.SpecialCurrencyType) && num(store?.SpecialCurrencyCost) > 0) {
    rows.push({ type: store.SpecialCurrencyType, value: num(store.SpecialCurrencyCost) });
  }
  if (num(store?.IdolCost) > 0 || num(store?.IdolSaleCost) > 0) {
    rows.push({ type: 'mc', value: num(store.IdolCost), saleValue: num(store.IdolSaleCost) });
  }
  return rows;
}

function bundleItemBaseCost(item) {
  const direct = storeCostBadges(item).filter((cost) => !(isHeroBundleItem(item) && cost.type === 'gold'));
  const discount = !isHeroBundleItem(item) ? num(item?.GoldBundleDiscount) : 0;
  return discount > 0 ? [{ type: 'gold', value: discount }] : direct;
}

function bundleItemDiscountedCost(item, store) {
  return bundleItemBaseCost(item).map((cost) => {
    const discount =
      cost.type === 'mc' ? num(store?.IdolBundleDiscount) :
      cost.type === 'gold' ? num(store?.GoldBundleDiscount) :
      cost.type === 'glory' ? num(store?.RankedPointsBundleDiscount) :
      num(store?.SpecialCurrencyBundleDiscount);
    return discount && discount !== 1 ? { ...cost, saleValue: Math.floor(cost.value * discount) } : cost;
  });
}

function bundleTotalCost(bundle) {
  const store = bundle?.bundleData || {};
  const direct = bundlePurchaseCosts(store);
  const totals = {};
  for (const entry of asArray(store.ItemList)) {
    for (const cost of bundleItemBaseCost(entry)) {
      totals[cost.type] = (totals[cost.type] || 0) + (cost.saleValue || cost.value || 0);
    }
  }
  if (direct.length) {
    return direct.map((cost) => {
      const discount =
        cost.type === 'mc' ? num(store.IdolBundleDiscount) :
        cost.type === 'gold' ? num(store.GoldBundleDiscount) :
        cost.type === 'glory' ? num(store.RankedPointsBundleDiscount) :
        num(store.SpecialCurrencyBundleDiscount);
      const inferredFullValue = discount && discount !== 1 ? Math.round((cost.saleValue || cost.value || 0) / discount) : 0;
      const fullValue = totals[cost.type] || inferredFullValue || 0;
      const bundleValue = cost.saleValue || cost.value || 0;
      return fullValue > bundleValue ? { ...cost, value: fullValue, saleValue: bundleValue } : cost;
    });
  }
  const discounts = {
    mc: num(store.IdolBundleDiscount) || 1,
    gold: num(store.GoldBundleDiscount) || 1,
    glory: num(store.RankedPointsBundleDiscount) || 1,
  };
  return Object.entries(totals)
    .map(([type, value]) => ({ type, value, saleValue: discounts[type] && discounts[type] !== 1 ? Math.floor(value * discounts[type]) : 0 }))
    .filter((cost) => cost.value > 0 || cost.saleValue > 0);
}

function CurrencyBadge({ cost, small = false }) {
  const src = ['mc', 'gold', 'glory'].includes(cost.type)
    ? `${host}/game/getGfx/storeIcon/${cost.type}`
    : [`${host}/game/getGfx/storeIcon/${cost.type}`, `${host}/game/getGfx/UI_Icons/a_Currency_${cost.type}`, `${host}/game/getGfx/storeIcon/mc`];
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white font-bold ${small ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}>
      <ImageWithLoader src={src} className={`${small ? 'h-4 w-4' : 'h-5 w-5'} bg-transparent`} imgClassName="max-h-full max-w-full object-contain" small />
      {cost.saleValue > 0 ? (
        <>
          <span className="line-through text-red-600 dark:text-red-400">{cost.value}</span>
          <span className="text-green-700 dark:text-green-400">{cost.saleValue}</span>
        </>
      ) : (
        <span>{cost.value}</span>
      )}
    </span>
  );
}

function CostBadges({ costs, small = false }) {
  const visible = asArray(costs).filter((cost) => cost && (cost.value > 0 || cost.saleValue > 0));
  if (!visible.length) return null;
  return <div className="flex flex-wrap gap-1">{visible.map((cost, index) => <CurrencyBadge key={`${cost.type}-${index}`} cost={cost} small={small} />)}</div>;
}

function discountPercent(cost) {
  if (!cost?.saleValue || !cost?.value || cost.saleValue >= cost.value) return null;
  return Math.max(1, Math.round((1 - cost.saleValue / cost.value) * 100));
}

function DiscountLabels({ costs }) {
  const labels = asArray(costs)
    .map((cost) => {
      const percent = discountPercent(cost);
      return percent ? { ...cost, percent } : null;
    })
    .filter(Boolean);
  if (!labels.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {labels.map((cost, index) => (
        <span key={`${cost.type}-${index}`} className="rounded-lg bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 text-xs font-bold">
          {cost.percent}% off {cost.type === 'mc' ? 'Mammoth Coins' : cost.type}
        </span>
      ))}
    </div>
  );
}

function itemLabel(entry, langs) {
  const resolved = entry?.resolved;
  const type = normalizedType(itemType(entry));
  if (type === 'MammothCoins') return `${entry?.amount || entry?.item || entry?.rewardData?.Amount || 0} Mammoth Coins`;
  if (type === 'BattlePassXP') return `${entry?.rewardData?.Amount || entry?.amount || ''}${entry?.rewardData?.Amount ? '% ' : ''}Battle Pass XP`;
  const key =
    resolved?.costumeData?.DisplayNameKey ||
    resolved?.weaponData?.DisplayNameKey ||
    resolved?.avatarData?.DisplayNameKey ||
    resolved?.podiumData?.DisplayNameKey ||
    resolved?.themeData?.DisplayNameKey ||
    resolved?.emojiData?.DisplayNameKey ||
    resolved?.companionData?.DisplayNameKey ||
    resolved?.spawnBotData?.DisplayNameKey ||
    resolved?.koEffectData?.DisplayNameKey ||
    resolved?.emitterTrailData?.DisplayNameKey ||
    resolved?.monikerData?.DisplayNameKey ||
    resolved?.colorData?.DisplayNameKey ||
    resolved?.themeData?.DisplayNameKey ||
    resolved?.heroData?.DisplayNameKey ||
    resolved?.DisplayNameKey;
  if (clean(key)) return label(key, langs);
  return entry?.item || entry?.storeData?.Item || entry?.storeData?.StoreName || '';
}

function itemType(entry) {
  return normalizedType(entry?.type || entry?.storeData?.Type || entry?.rewardData?.Type || entry?.rewardData?.Acquirable?.split(':')?.[0] || 'Item');
}

function itemImage(entry) {
  const resolved = entry?.resolved;
  const type = itemType(entry);
  const currency = currencyIcon(type);
  if (currency) return currency;
  if (!resolved) {
    if (entry?.rewardData?.IconName) {
      const folder = String(entry.rewardData.IconName).startsWith('a_BPIcon') ? 'UI_BattlePass' : 'UI_Icons';
      return `${host}/game/getGfx/${folder}/${entry.rewardData.IconName}`;
    }
    return null;
  }

  if (resolved.costumeData && resolved.HeroID && resolved.SkinInt) {
    const anim = resolved.animTypes?.selectedOther || resolved.animTypes?.selected || 'SelectedRandom';
    return `${host}/game/anim/char/${resolved.HeroID}-${resolved.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${anim}/loop`;
  }
  if (resolved.weaponData?.WeaponSkinID) {
    const weapon = resolved.weaponData.BaseWeapon || 'Sword';
    return `${host}/game/anim/weapon/${resolved.weaponData.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon}Pose/loop`;
  }
  if (resolved.avatarData?.AvatarID) return `${host}/game/animAvatar/${resolved.avatarData.AvatarID}`;
  if (resolved.emojiData?.EmojiID) return `${host}/game/animEmoji/${resolved.emojiData.EmojiID}`;
  if (resolved.podiumData?.PodiumID) return `${host}/game/animPodium/${resolved.podiumData.PodiumID}/loop/Ready`;
  if (resolved.PowerName) return `${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${resolved.PowerName}/loop`;
  if (resolved.colorData?.IconName) return `${host}/game/getGfx/UI_Icons/${resolved.colorData.IconName}`;
  if (resolved.themeData?.PlayerThemeID) return `${host}/game/animUi/${resolved.themeData.PlayerThemeID}/StoreAllItems`;
  if (resolved.companionData?.CompanionID) return `${host}/game/animCompanion/${resolved.companionData.CompanionID}/Ready/loop`;
  if (resolved.spawnBotData?.SpawnBotID) return `${host}/game/anim/spawnbot/${resolved.spawnBotData.SpawnBotID}/Animation_Robot/a__AnimationRobot/Ready/loop`;
  if (resolved.koEffectData?.TrailEffectID) return `${host}/game/animTrail/${resolved.koEffectData.TrailEffectID}`;
  if (resolved.emitterTrailData?.EmitterGroupID) return `${host}/game/animSmokeTrail/${resolved.emitterTrailData.EmitterGroupID}`;
  if (resolved.TrailEffectID) return `${host}/game/animTrail/${resolved.TrailEffectID}`;
  if (resolved.heroData?.HeroID) return `${host}${resolved.image || `/game/getGfx/${resolved.costumeType?.CostumeIconFileName}/${resolved.costumeType?.CostumeIcon}`}`;
  if (resolved.themeData?.SeasonBorderID) return `${host}/game/animBorder/${resolved.themeData.SeasonBorderID}`;
  if (resolved.themeData?.IconName) return `${host}/game/getGfx/UI_Icons/${resolved.themeData.IconName}`;
  if (entry?.rewardData?.IconName) {
    const folder = String(entry.rewardData.IconName).startsWith('a_BPIcon') ? 'UI_BattlePass' : 'UI_Icons';
    return `${host}/game/getGfx/${folder}/${entry.rewardData.IconName}`;
  }
  return null;
}

function itemKey(entry, index) {
  return `${itemType(entry)}-${entry?.item || entry?.storeData?.Item || entry?.storeData?.StoreName || index}`;
}

function MonikerChip({ entry, langs, large = false }) {
  const moniker = entry?.resolved?.monikerData;
  const color = hex(moniker?.Color, '#e2e8f0');
  return (
    <div className={`rounded-lg bg-slate-900/80 border border-slate-700 ${large ? 'px-5 py-4 text-xl' : 'px-3 py-2 text-sm'} font-bold text-center`} style={{ color }}>
      {itemLabel(entry, langs)}
    </div>
  );
}

const ItemThumb = memo(function ItemThumb({ entry, langs, small = false }) {
  const type = itemType(entry).toLowerCase();
  const isBorder = type === 'border' || entry?.resolved?.themeData?.SeasonBorderID;
  if (type === 'moniker' || entry?.resolved?.monikerData) {
    return <MonikerChip entry={entry} langs={langs} large={!small} />;
  }

  const src = itemImage(entry);
  return (
    <div className={`${small ? (isBorder ? 'h-24 w-16' : 'h-16 w-16') : (isBorder ? 'min-h-80 w-full max-w-2xl' : 'h-28 w-28')} rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0`}>
      {src ? (
        <ImageWithLoader src={src} alt={itemLabel(entry, langs)} className="h-full w-full" small={small} />
      ) : (
        <span className="text-xs text-slate-400 px-2 text-center">{itemType(entry)}</span>
      )}
    </div>
  );
});

function ItemStrip({ items, langs, small = false, limit = 24 }) {
  const visible = asArray(items).filter(Boolean).slice(0, limit);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {visible.map((entry, index) => (
        <div key={itemKey(entry, index)} className="group">
          <ItemThumb entry={entry} langs={langs} small={small} />
          {!small && <div className="mt-1 text-center text-xs text-slate-300">{itemLabel(entry, langs)}</div>}
        </div>
      ))}
    </div>
  );
}

function FieldGrid({ data, langs, title = 'Raw Fields', exclude = [] }) {
  const rows = Object.entries(data || {})
    .filter(([key, value]) => !exclude.includes(key) && clean(value))
    .filter(([, value]) => !(Array.isArray(value) && value.length === 0));
  if (!rows.length) return null;
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-slate-950/70 border border-slate-700 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{key}</div>
            <div className="mt-1 text-sm text-white break-words whitespace-pre-wrap">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RawDataSection({ data, title = 'Raw Data' }) {
  if (!data) return null;
  return (
    <details className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
      <summary className="cursor-pointer select-none text-lg font-bold text-gray-900 dark:text-white">{title}</summary>
      <pre className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs text-gray-900 dark:text-gray-100">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function Section({ title, children, action }) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function TagChips({ tags }) {
  const visible = [...new Set(cleanList(tags))];
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-gray-300 dark:bg-slate-700 text-gray-900 dark:text-white">{tag}</span>
      ))}
    </div>
  );
}

function FilterShell({ title, count, total, search, setSearch, sort, setSort, filters, setFilters, filterDefs, filterOptions, filterCounts, viewMode, setViewMode }) {
  const dropdownFilters = filterDefs.filter((filter) => filter.type !== 'toggle');
  const toggleFilters = filterDefs.filter((filter) => filter.type === 'toggle');
  const [filtersOpen, setFiltersOpen] = useState(true);
  return (
    <div className="space-y-4 mb-4 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
      <button onClick={() => setFiltersOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg bg-gray-100 dark:bg-slate-700 px-3 py-2 text-left text-sm font-bold text-gray-900 dark:text-white">
        <span>Filters</span>
        <span className="text-xs text-gray-500 dark:text-gray-300">{filtersOpen ? 'Hide' : 'Show'}</span>
      </button>
      {filtersOpen && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {dropdownFilters.map((filter) => (
              <select
                key={filter.key}
                value={filters[filter.key] || ''}
                onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">{filter.label}</option>
                {(filterOptions[filter.key] || []).map((value) => <option key={value} value={value}>{value} ({filterCounts?.[filter.key]?.[value] || 0})</option>)}
              </select>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toggleFilters.map((filter) => (
              <label key={filter.key} className="inline-flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                <input type="checkbox" checked={!!filters[filter.key]} onChange={() => setFilters((current) => ({ ...current, [filter.key]: !current[filter.key] }))} className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer" />
                {filter.label} ({filterCounts?.[filter.key]?.__toggle || 0})
              </label>
            ))}
            <button onClick={() => setFilters({})} aria-label="Reset all filters" className="cursor-pointer flex items-center gap-2 text-sm bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Reset Filters
            </button>
          </div>
        </div>
      )}
      <div className="lg:flex lg:flex-col gap-4">
        <div className="flex justify-between items-center w-full sm:w-auto py-2 gap-4">
          <div className="text-lg text-blue-600 dark:text-blue-400 font-bold">Showing {count} of {total}</div>
          <div className="flex gap-2">
            <button onClick={() => setViewMode('list')} className={`cursor-pointer p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`} title="List View">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            </button>
            <button onClick={() => setViewMode('grid')} className={`cursor-pointer p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'}`} title="Grid View">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zm-10 10h6v6H4v-6zm10 0h6v6h-6v-6z"></path></svg>
            </button>
          </div>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${title}`}
            className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold placeholder:font-semibold rounded-lg pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
          />
        </div>
        <div className="relative">
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold rounded-lg px-4 py-2 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none cursor-pointer">
            <option value="indexDesc">Default Sorting (Desc)</option>
            <option value="indexAsc">Default Sorting (Asc)</option>
            <option value="name">Alphabetical (A-Z)</option>
            <option value="idDesc">ID (Desc)</option>
            <option value="idAsc">ID (Asc)</option>
          </select>
          <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  );
}

function DatabaseView({ title, description, items, langs, config }) {
  const data = useMemo(() => asArray(items), [items]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(config.defaultSort || 'indexDesc');
  const [filters, setFilters] = useState({});
  const [viewMode, setViewMode] = useState('list');

  const filterDefs = config.filters || [];
  const filterOptions = useMemo(() => {
    const output = {};
    for (const filter of filterDefs) {
      if (filter.type === 'toggle') continue;
      const values = new Set();
      data.forEach((item) => asArray(filter.value(item)).filter(clean).forEach((value) => values.add(String(value))));
      output[filter.key] = [...values].sort((a, b) => a.localeCompare(b));
    }
    return output;
  }, [data, filterDefs]);

  const matchesFilters = (item, query, excludeKey = null) => {
    if (query && !config.search(item, langs).join(' ').toLowerCase().includes(query)) return false;
    for (const filter of filterDefs) {
      if (filter.key === excludeKey) continue;
      const chosen = filters[filter.key];
      if (!chosen) continue;
      if (filter.type === 'toggle') {
        if (!filter.value(item)) return false;
        continue;
      }
      if (!asArray(filter.value(item)).map(String).includes(chosen)) return false;
    }
    return true;
  };

  const filterCounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const output = {};
    for (const filter of filterDefs) {
      output[filter.key] = {};
      data.forEach((item) => {
        if (!matchesFilters(item, query, filter.key)) return;
        if (filter.type === 'toggle') {
          if (filter.value(item)) output[filter.key].__toggle = (output[filter.key].__toggle || 0) + 1;
          return;
        }
        asArray(filter.value(item)).filter(clean).map(String).forEach((value) => {
          output[filter.key][value] = (output[filter.key][value] || 0) + 1;
        });
      });
    }
    return output;
  }, [config, data, filterDefs, filters, langs, search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data
      .filter((item) => {
        return matchesFilters(item, query);
      })
      .sort((a, b) => {
        if (sort === 'name') return config.name(a, langs).localeCompare(config.name(b, langs));
        if (sort === 'idAsc') return Number(config.id(a) || 0) - Number(config.id(b) || 0);
        if (sort === 'idDesc') return Number(config.id(b) || 0) - Number(config.id(a) || 0);
        const aIndex = config.index?.(a) ?? Number(a.ArrayIndex || 0);
        const bIndex = config.index?.(b) ?? Number(b.ArrayIndex || 0);
        return sort === 'indexAsc' ? aIndex - bIndex : bIndex - aIndex;
      });
  }, [config, data, filterDefs, filters, langs, search, sort]);

  useEffect(() => {
    setSelected(filtered[0] || null);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-3 lg:p-4" style={{ fontFamily: langs?.font || 'BHLatinBold' }}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-[35%] flex flex-col">
          <FilterShell
            title={title}
            description={description}
            count={filtered.length}
            total={data.length}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            filters={filters}
            setFilters={setFilters}
            filterDefs={filterDefs}
            filterOptions={filterOptions}
            filterCounts={filterCounts}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-2 2xl:grid-cols-3 gap-3' : 'flex flex-col gap-2'} max-h-[calc(100vh-12rem)] overflow-y-auto pr-1`}>
            {filtered.map((item, index) => (
              <button key={`${config.id(item)}-${index}`} onClick={() => setSelected(item)} className={`${selected === item ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} text-left bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl p-3 transition border border-gray-200 dark:border-slate-700 ${viewMode === 'grid' ? 'min-h-52 shadow-sm hover:-translate-y-0.5' : ''}`}>
                {config.card(item, langs, viewMode)}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:w-[65%] flex flex-col gap-4">
          {selected ? config.detail(selected, langs) : (
            <div className="rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-500 dark:text-gray-400">
              Select an item to inspect it.
            </div>
          )}
          {selected && <RawDataSection data={selected} />}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle, badges, hero, description, tags }) {
  const visibleBadges = cleanList(badges);
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex flex-col gap-5">
        <div className="min-w-0">
          {subtitle && <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>
          {description && <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</div>}
          {visibleBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleBadges.map((badge, index) => (
                <span key={`${badge}-${index}`} className="inline-flex rounded-full bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 px-3 py-1 text-xs font-bold">{badge}</span>
              ))}
            </div>
          )}
          <div className="mt-2"><TagChips tags={tags} /></div>
        </div>
        {hero && <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 flex items-center justify-center">{hero}</div>}
      </div>
    </div>
  );
}

function bundleItems(bundle) {
  return asArray(bundle.items);
}

function bundleTags(bundle) {
  return [...new Set([
    ...splitTags(bundle?.bundleData?.SearchTags),
    ...bundleItems(bundle).flatMap((entry) => splitTags(entry?.storeData?.SearchTags)),
  ])];
}

function bundleConfig(sourceLabel = 'Bundles') {
  return {
    id: (item) => item.bundleData?.StoreID,
    name: (item, langs) => displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs),
    search: (item, langs) => [item.bundleData?.StoreName, item.bundleData?.DisplayNameKey, item.bundleData?.DescriptionKey, label(item.bundleData?.DisplayNameKey, langs), label(item.bundleData?.DescriptionKey, langs), bundleItems(item).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'source', label: 'Source', value: (item) => item.source },
      { key: 'rarity', label: 'Rarity', value: (item) => item.bundleData?.Rarity },
      { key: 'tag', label: 'Store Tags', value: bundleTags },
      { key: 'type', label: 'Contains Type', value: (item) => bundleItems(item).map(itemType) },
    ],
    card: (item, langs, viewMode) => (
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">{displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs)}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">{bundleItems(item).length} items</div>
          <CostBadges costs={bundleTotalCost(item)} small />
        </div>
        <div className="mt-2"><TagChips tags={bundleTags(item).slice(0, 5)} /></div>
        <div className={`mt-3 flex flex-wrap gap-2 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
          {bundleItems(item).slice(0, viewMode === 'grid' ? 8 : 10).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
        {bundleItems(item).length > (viewMode === 'grid' ? 8 : 10) && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">+{bundleItems(item).length - (viewMode === 'grid' ? 8 : 10)} more</div>}
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs)} subtitle={`${item.source || sourceLabel} bundle`} description={label(item.bundleData?.DescriptionKey, langs)} tags={bundleTags(item)} badges={[item.source || sourceLabel, item.bundleData?.Rarity, `${bundleItems(item).length} items`]} />
        <BundlePricing bundle={item} langs={langs} />
        <Section title="Items"><ItemStrip items={bundleItems(item)} langs={langs} /></Section>
        <FieldGrid data={item.bundleData} langs={langs} exclude={['ItemList']} />
      </>
    ),
  };
}

function BundlePricing({ bundle, langs }) {
  const costs = bundleTotalCost(bundle);
  const items = asArray(bundle?.bundleData?.ItemList);
  if (!costs.length && !items.some((item) => bundleItemBaseCost(item).length)) return null;
  return (
    <Section title="Pricing">
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bundle Cost</div>
          <CostBadges costs={costs} />
          <DiscountLabels costs={costs} />
        </div>
        {items.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Per Item</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item, index) => {
                const entry = bundleItems(bundle).find((candidate) => candidate.item === (item.Item || item.StoreName)) || { type: item.Type, item: item.Item || item.StoreName };
                return (
                  <div key={`${item.StoreName || item.Item}-${index}`} className="rounded-lg bg-gray-100 dark:bg-slate-900 p-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{itemLabel(entry, langs)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.StoreName || item.Item}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CostBadges costs={bundleItemDiscountedCost(item, bundle.bundleData)} small />
                      <DiscountLabels costs={bundleItemDiscountedCost(item, bundle.bundleData)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

const configs = {
  chests: {
    id: (item) => item.chestData?.ChanceBoxID,
    name: (item, langs) => label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs),
    search: (item, langs) => [item.chestData?.ChanceBoxName, label(item.chestData?.DisplayNameKey, langs), ...asArray(item.commonItems).map((entry) => itemLabel({ ...entry, type: 'Costume' }, langs)), ...asArray(item.exclusiveItems).map((entry) => itemLabel({ ...entry, type: 'Costume' }, langs))],
    filters: [
      { key: 'status', label: 'Availability', value: (item) => item.chestData?.EndTime ? 'Limited/Ended' : 'Current' },
    ],
    card: (item, langs) => (
      <div className="flex gap-3">
        <div className="h-24 w-24 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
          <img src={`${host}/game/animChest/${item.chestData?.ChanceBoxID}/StoreIdle/loop`} alt={label(item.chestData?.DisplayNameKey, langs)} className="max-h-full max-w-full object-contain" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs)}</div>
          <div className="mt-2 flex gap-1 overflow-hidden">
            {asArray(item.exclusiveItems).slice(0, 4).map((entry, index) => <ItemThumb key={entry.item || index} entry={{ ...entry, type: 'Costume' }} langs={langs} small />)}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.itemCount} skins</div>
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs)}
          subtitle={item.chestData?.ChanceBoxName}
          badges={[`${item.itemCount} skins`, item.chestData?.EndTime ? 'Limited/Ended' : 'Current']}
          hero={<ImageWithLoader src={`${host}/game/animChest/${item.chestData?.ChanceBoxID}/StoreIdle/loop`} className="min-h-80 w-full rounded-lg bg-slate-900/80" imgClassName="max-h-[70vh] max-w-full object-contain" />}
        />
        <Section title="Exclusive Skins"><ItemStrip items={asArray(item.exclusiveItems).map((entry) => ({ ...entry, type: 'Costume' }))} langs={langs} /></Section>
        <Section title="Common Skins"><ItemStrip items={asArray(item.commonItems).map((entry) => ({ ...entry, type: 'Costume' }))} langs={langs} /></Section>
        <FieldGrid data={item.chestData} langs={langs} exclude={['CommonItems', 'ExclusiveItems']} />
      </>
    ),
  },
  bundles: bundleConfig('Store'),
  promos: {
    id: (item) => item.promoData?.StoreID,
    name: (item, langs) => displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs),
    search: (item, langs) => [item.promoData?.StoreName, item.promoData?.Type, label(item.promoData?.DisplayNameKey, langs), asArray(item.items).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'type', label: 'Type', value: (item) => item.promoData?.Type },
      { key: 'rarity', label: 'Rarity', value: (item) => item.promoData?.Rarity },
      { key: 'geo', label: 'Geo Locked', type: 'toggle', value: (item) => clean(item.promoData?.GeoLockedCountries) },
    ],
    card: (item, langs, viewMode) => (
      <div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{item.promoData?.Type}</div>
        </div>
        <div className={`mt-3 flex flex-wrap gap-2 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
          {asArray(item.items).slice(0, item.promoData?.Type === 'Bundle' ? 8 : 1).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs)} subtitle={item.promoData?.Type} badges={[item.promoData?.Type, item.promoData?.Rarity, clean(item.promoData?.GeoLockedCountries) && `Geo: ${item.promoData.GeoLockedCountries}`]} />
        <TagChips tags={splitTags(item.promoData?.SearchTags)} />
        <Section title={item.promoData?.Type === 'Bundle' ? 'Bundle Items' : 'Reward'}><ItemStrip items={item.items} langs={langs} /></Section>
        <FieldGrid data={item.promoData} langs={langs} />
      </>
    ),
  },
  purchases: {
    id: (item) => item.entitlementData?.EntitlementID,
    name: (item, langs) => label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs),
    search: (item, langs) => [item.entitlementData?.EntitlementName, label(item.entitlementData?.DisplayNameKey, langs), entitlementItems(item).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item.entitlementData?.BattlePassSeason || item.entitlementData?.DeluxeBattlePassSeason },
      { key: 'itemType', label: 'Contains Type', value: (item) => entitlementItems(item).map(itemType) },
      { key: 'priced', label: 'Has Pricing', type: 'toggle', value: (item) => asArray(item.steamPurchases).some((purchase) => moneyFields.some((field) => clean(purchase[field]))) },
    ],
    card: (item, langs, viewMode) => (
      <div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs)}</div>
          {entitlementItems(item).length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400">{entitlementItems(item).length} items</div>}
        </div>
        <div className={`mt-3 flex flex-wrap gap-2 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
          {entitlementItems(item).slice(0, 8).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs)} subtitle={item.entitlementData?.EntitlementName} badges={[item.entitlementData?.Idols && `${item.entitlementData.Idols} Mammoth Coins`, entitlementItems(item).length > 0 && `${entitlementItems(item).length} items`]} />
        {entitlementItems(item).length > 0 && <Section title="Included Items"><ItemStrip items={entitlementItems(item)} langs={langs} /></Section>}
        <Pricing purchases={item.steamPurchases} />
        <FieldGrid data={item.entitlementData} langs={langs} />
      </>
    ),
  },
  borders: {
    id: (item) => item.themeData?.SeasonBorderID,
    name: (item, langs) => label(item.themeData?.DisplayNameKey || item.themeData?.SeasonBorderName, langs),
    search: (item, langs) => [
      item.themeData?.SeasonBorderName,
      item.themeData?.SeasonBorderID,
      label(item.themeData?.DisplayNameKey, langs),
      label(item.themeData?.DescriptionKey, langs),
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags].filter(Boolean).join(' ')),
    ],
    filters: [
      { key: 'source', label: 'Source', value: (item) => item.source || (item.store?.length ? 'Store' : 'Data') },
      { key: 'rarity', label: 'Rarity', value: (item) => asArray(item.store).map((row) => row.Rarity) },
      { key: 'storeOnly', label: 'Store Borders Only', type: 'toggle', value: (item) => asArray(item.store).length > 0 },
    ],
    card: (item, langs, viewMode) => (
      <div className={`${viewMode === 'grid' ? 'text-center' : 'flex gap-3 items-center'}`}>
        <ItemThumb entry={{ type: 'Border', resolved: item }} langs={langs} small={viewMode !== 'grid'} />
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.themeData?.DisplayNameKey || item.themeData?.SeasonBorderName, langs)}</div>
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item.themeData?.DisplayNameKey || item.themeData?.SeasonBorderName, langs)}
          subtitle={item.themeData?.SeasonBorderName}
          badges={[asArray(item.store).length > 0 && 'Store']}
          hero={<ImageWithLoader src={`${host}/game/animBorder/${item.themeData?.SeasonBorderID}`} className="min-h-96 w-full rounded-lg bg-slate-900/80" imgClassName="max-h-[80vh] max-w-full object-contain" />}
          description={label(item.themeData?.DescriptionKey, langs)}
        />
        {asArray(item.store).length > 0 && (
          <Section title="Store Data">
            <div className="space-y-3">
              {asArray(item.store).map((row, index) => (
                <div key={`${row.StoreID || row.StoreName}-${index}`} className="rounded-lg bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
                  <div className="font-bold text-gray-900 dark:text-white">{displayName(row.DisplayNameKey, row.StoreName, langs)}</div>
                  <div className="mt-2"><CostBadges costs={storeCostBadges(row)} /></div>
                </div>
              ))}
            </div>
          </Section>
        )}
        <FieldGrid data={item.themeData} langs={langs} />
      </>
    ),
  },
};

function entitlementItems(item) {
  const items = asArray(item?.items);
  const hasCoins = items.some((entry) => itemType(entry) === 'MammothCoins');
  const idols = Number(item?.entitlementData?.Idols || 0);
  return [
    ...(idols > 0 && !hasCoins ? [{ type: 'MammothCoins', item: String(idols), amount: idols }] : []),
    ...items,
  ].filter((entry) => {
    if (itemType(entry) === 'MammothCoins') return Number(entry.amount || entry.item || entry.rewardData?.Amount || 0) > 0;
    return !!entry;
  });
}

function Pricing({ purchases }) {
  const rows = asArray(purchases).filter((purchase) => moneyFields.some((field) => clean(purchase[field])));
  if (!rows.length) return null;
  return (
    <Section title="Pricing">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((purchase) => (
          <div key={purchase.ItemID || purchase.SteamPurchaseName} className="rounded-lg bg-slate-950/70 border border-slate-700 p-3">
            <div className="font-semibold text-white">{purchase.Description || purchase.SteamPurchaseName}</div>
            {clean(purchase.Idols) && <div className="text-sm text-blue-200 mt-1">{purchase.Idols} Mammoth Coins</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {moneyFields.filter((field) => clean(purchase[field])).slice(0, 6).map((field) => (
                <span key={field} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{field} {(Number(purchase[field]) / 100).toFixed(2)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function groupRewards(rewards) {
  return asArray(rewards).reduce((groups, reward) => {
    const type = itemType(reward);
    groups[type] = groups[type] || [];
    groups[type].push(reward);
    return groups;
  }, {});
}

function rewardCondition(reward) {
  if (String(reward?.rewardData?.ForWinningFaction).toLowerCase() === 'true') return 'Win only';
  if (String(reward?.rewardData?.ForLosingFaction).toLowerCase() === 'true') return 'Participation';
  if (clean(reward?.rewardData?.InfluenceThreshold) && Number(reward.rewardData.InfluenceThreshold) > 0) return `${reward.rewardData.InfluenceThreshold} influence`;
  return '';
}

function isMissionReward(reward) {
  return /mission/i.test([
    itemType(reward),
    reward?.rewardData?.Type,
    reward?.rewardData?.Item,
    reward?.rewardData?.RewardType,
  ].filter(Boolean).join(' '));
}

function isBattlePassPlaceholderReward(reward) {
  return String(reward?.rewardData?.Type || reward?.type || '').trim() === '--';
}

function validBattlePassReward(reward) {
  return !isMissionReward(reward) && !isBattlePassPlaceholderReward(reward);
}

function formatUnixDate(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Date(parsed * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function battlePassReleaseInfo(pass) {
  const data = pass?.battlePassData || {};
  return {
    patch: data.SegmentStartedPatch || data.SourcePatch || '',
    date: data.SegmentStartedDate || data.SourceDate || '',
  };
}

function Tooltip({ lines, children, className = '' }) {
  const visible = asArray(lines)
    .filter((line) => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => clean(line) && line.toLowerCase() !== 'false');
  if (!visible.length) return children;
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-72 -translate-x-1/2 rounded-xl border border-slate-500/70 bg-slate-950/95 px-3 py-2 text-left text-xs font-bold leading-relaxed text-slate-100 shadow-2xl group-hover/tooltip:block">
        {visible.map((line, index) => (
          <span key={`${line}-${index}`} className="block whitespace-normal">{line}</span>
        ))}
      </span>
    </span>
  );
}

function RewardStrip({ rewards, langs }) {
  const visible = asArray(rewards).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {visible.map((reward, index) => (
        <div key={itemKey(reward, index)} className={itemType(reward) === 'PlayerTheme' ? 'max-w-80' : 'max-w-32'}>
          <ItemThumb entry={reward} langs={langs} small={itemType(reward) !== 'PlayerTheme'} />
          <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">{itemLabel(reward, langs)}</div>
          {rewardCondition(reward) && <div className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">{rewardCondition(reward)}</div>}
        </div>
      ))}
    </div>
  );
}

function factionRewards(item, factionName) {
  return asArray(item.rewards).filter((reward) => !factionName || reward.rewardData?.ForFaction === factionName);
}

export function BundleStoreView({ bundles, langs }) {
  return <DatabaseView title="Bundles" items={bundles} langs={langs} config={configs.bundles} />;
}

export function ChestStoreView({ chests, langs }) {
  return <DatabaseView title="Chests" items={chests} langs={langs} config={configs.chests} />;
}

export function PromoStoreView({ promos, langs }) {
  return <DatabaseView title="Promo Rewards" items={promos} langs={langs} config={configs.promos} />;
}

export function PurchaseStoreView({ purchases, langs }) {
  return <DatabaseView title="Entitlements" items={purchases} langs={langs} config={configs.purchases} />;
}

export function BorderStoreView({ borders, langs }) {
  return <DatabaseView title="Borders" items={borders} langs={langs} config={configs.borders} />;
}

export function SkirmishStoreView({ skirmishes, langs }) {
  const config = {
    id: (item) => item.skirmishData?.SkirmishID,
    name: (item) => item.skirmishData?.SkirmishName,
    search: (item, langs) => [item.skirmishData?.SkirmishName, label(item.skirmishData?.SkirmishDesc, langs), asArray(item.factions).map((f) => label(f.DisplayNameKey || f.FactionName, langs)).join(' ')],
    filters: [
      { key: 'faction', label: 'Faction', value: (item) => asArray(item.factions).map((f) => f.FactionName) },
      { key: 'rewardType', label: 'Reward Type', value: (item) => asArray(item.rewards).map(itemType) },
    ],
    card: (item, langs) => {
      const factions = asArray(item.factions);
      return <SkirmishCard item={item} factions={factions} langs={langs} />;
    },
    detail: (item, langs) => {
      const factions = asArray(item.factions);
      return (
        <>
          <Header title={item.skirmishData?.SkirmishName} subtitle={label(item.skirmishData?.SkirmishDesc, langs)} badges={[`${asArray(item.rewards).length} rewards`]} />
          <Section title="Matchup"><SkirmishCard item={item} factions={factions} langs={langs} large /></Section>
          {factions.map((faction) => {
            const grouped = groupRewards(factionRewards(item, faction.FactionName));
            return (
              <Section key={faction.FactionName} title={label(faction.DisplayNameKey || faction.FactionName, langs)}>
                <div className="space-y-4">
                  {Object.entries(grouped).map(([type, rewards]) => (
                    <div key={type}>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{type}</div>
                      <RewardStrip rewards={rewards} langs={langs} />
                    </div>
                  ))}
                </div>
              </Section>
            );
          })}
          <FieldGrid data={item.skirmishData} langs={langs} />
        </>
      );
    },
  };
  return <DatabaseView title="Skirmishes" items={skirmishes} langs={langs} config={config} />;
}

function factionAvatarEntry(item, faction) {
  return asArray(item.rewards).find((reward) => reward.item === faction.FactionAvatar) || { type: 'Avatar', item: faction.FactionAvatar };
}

function SkirmishCard({ item, factions, langs, large = false }) {
  const f1 = factions[0] || {};
  const f2 = factions[1] || {};
  const bg = `linear-gradient(135deg, ${hex(f1.FactionColor)} 0 50%, ${hex(f2.FactionColor)} 50% 100%)`;
  return (
    <div className={`rounded-xl overflow-hidden border border-slate-700 ${large ? 'p-5' : 'p-3'}`} style={{ background: bg, color: textColor(f1.FactionColor) }}>
      <div className="flex items-center justify-between gap-3">
        <FactionFace item={item} faction={f1} langs={langs} large={large} />
        <div className="text-center font-black uppercase tracking-wide text-white drop-shadow shrink-0">vs</div>
        <FactionFace item={item} faction={f2} langs={langs} large={large} right />
      </div>
    </div>
  );
}

function FactionFace({ item, faction, langs, large = false, right = false }) {
  const entry = factionAvatarEntry(item, faction);
  return (
    <div className={`flex items-center gap-2 min-w-0 flex-1 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <ItemThumb entry={entry} langs={langs} small={!large} />
      <div className="min-w-0">
        <div className={`${large ? 'text-2xl' : 'text-base'} font-bold text-white drop-shadow`}>{label(faction.DisplayNameKey || faction.FactionName, langs)}</div>
      </div>
    </div>
  );
}

export function BattlePassStoreView({ battlePasses, langs }) {
  const sorted = useMemo(() => asArray(battlePasses).slice().sort((a, b) => {
    const numDiff = battlePassNumber(b) - battlePassNumber(a);
    if (numDiff) return numDiff;
    return Number(isClassicPass(a)) - Number(isClassicPass(b));
  }), [battlePasses]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = sorted[selectedIndex] || sorted[0];
  const rewards = asArray(selected?.rewards).filter(validBattlePassReward);
  const paths = useMemo(() => battlePassPaths(rewards, selected), [rewards, selected]);
  const [selectedPath, setSelectedPath] = useState('0');
  useEffect(() => {
    setSelectedPath(paths[0]?.path || '0');
  }, [selected]);
  const activePath = paths.find((path) => path.path === selectedPath) || paths[0];
  const summary = useMemo(() => battlePassSummary(rewards), [rewards]);
  const deluxePurchases = uniqueDeluxePurchases(selected);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-3 lg:p-4 text-gray-900 dark:text-white">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sorted.map((bp, index) => {
            const release = battlePassReleaseInfo(bp);
            return (
              <button
                key={bp.ArrayIndex || index}
                onClick={() => setSelectedIndex(index)}
                className={`${selected === bp ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'} rounded-xl px-3 py-2 text-left w-60 shrink-0 border border-gray-200 dark:border-slate-700 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black leading-tight">BP {battlePassNumber(bp)}</div>
                    <div className="text-xs font-bold opacity-80">{isClassicPass(bp) ? 'Classic' : 'Original'}</div>
                  </div>
                  {(release.patch || release.date) && (
                    <div className="text-right text-[10px] font-black uppercase leading-tight opacity-80">
                      {release.patch && <div>Patch {release.patch}</div>}
                      {release.date && <div>{formatUnixDate(release.date)}</div>}
                    </div>
                  )}
                </div>
                <BattlePassFeaturedStrip pass={bp} langs={langs} compact />
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="mt-4 flex flex-col gap-4">
          <Header
            title={`Battle Pass ${battlePassNumber(selected)}`}
            subtitle=""
            badges={[
              `${rewards.length} items`,
              `${asArray(selected.purchases).length} purchases`,
              battlePassReleaseInfo(selected).patch && `Patch ${battlePassReleaseInfo(selected).patch}`,
              battlePassReleaseInfo(selected).date && formatUnixDate(battlePassReleaseInfo(selected).date),
            ]}
          />
          <BattlePassFeaturedRewards pass={selected} langs={langs} />
          <BattlePassSummary summary={summary} langs={langs} />
          {deluxePurchases.length > 0 && (
            <Section title="Deluxe">
              <div className="space-y-3">
                {deluxePurchases.map((purchase, index) => (
                  <div key={purchase.entitlementData?.EntitlementName || index} className="rounded-lg bg-gray-100 dark:bg-slate-900 p-3">
                    <div className="mb-2 font-bold text-gray-900 dark:text-white">{label(purchase.entitlementData?.DisplayNameKey || purchase.entitlementData?.EntitlementName, langs)}</div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {clean(purchase.entitlementData?.DeluxeBattlePassTiers) && <SummaryPill label="Tier Skips" value={purchase.entitlementData.DeluxeBattlePassTiers} />}
                      {clean(purchase.entitlementData?.IncludesRewardsFrom) && <SummaryPill label="Includes" value={purchase.entitlementData.IncludesRewardsFrom} />}
                      {entitlementItems(purchase).length > 0 && <SummaryPill label="Items" value={entitlementItems(purchase).length} />}
                    </div>
                    <ItemStrip items={entitlementItems(purchase)} langs={langs} small limit={18} />
                  </div>
                ))}
              </div>
            </Section>
          )}
          {paths.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {paths.map((pathGroup) => (
                <button
                  key={pathGroup.path}
                  onClick={() => setSelectedPath(pathGroup.path)}
                  className={`${activePath?.path === pathGroup.path ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'} rounded-lg px-4 py-2 text-sm font-bold`}
                >
                  {pathGroup.label}
                </button>
              ))}
            </div>
          )}
          {activePath && (
            <Section title={activePath.label}>
              <BattlePassGrid tiers={activePath.tiers} langs={langs} />
            </Section>
          )}
          <RawDataSection data={selected.battlePassData} />
        </div>
      )}
    </div>
  );
}

function battlePassTooltipLines(pass) {
  const data = pass?.battlePassData || {};
  const release = battlePassReleaseInfo(pass);
  const releaseLine = [
    release.patch && `Patch ${release.patch}`,
    release.date && formatUnixDate(release.date),
  ].filter(Boolean).join(' - ');
  return [
    `Battle Pass ${battlePassNumber(pass)} ${isClassicPass(pass) ? 'Classic' : 'Original'}`,
    releaseLine ? `Released: ${releaseLine}` : '',
    `Rewards: ${data.RewardCount || asArray(pass?.rewards).length}`,
  ];
}

function entryTooltipLines(entry, context = '') {
  const reward = entry?.rewardData || {};
  const passLane = String(reward.IsFree).toLowerCase() === 'true' ? 'Free Pass' : clean(reward.IsFree) ? 'Gold Pass' : '';
  return [
    context,
    reward.Tier ? `Tier ${reward.Tier}` : '',
    passLane,
    clean(reward.Amount) ? `Amount: ${reward.Amount}` : '',
  ];
}

function battlePassFeatureEntries(pass, { list = false } = {}) {
  const featured = pass?.featuredRewards || {};
  if (list) {
    return [
      { label: 'Final Skin', entry: featured.finalSkin, size: 'list', hero: true },
      { label: 'Color Scheme', entry: featured.colorScheme, size: 'listSmall' },
    ].filter((row) => row.entry);
  }
  const rows = [
    { label: 'Color Scheme', entry: featured.colorScheme, size: 'supportSquare' },
    { label: 'Final Skin', entry: featured.finalSkin, size: list ? 'small' : 'hero', hero: true },
    { label: 'Border', entry: featured.border, size: 'supportTall' },
    { label: 'UI Theme', entry: featured.uiTheme, size: 'supportWide' },
  ].filter((row) => row.entry);
  return rows;
}

function chainSkinImage(skin) {
  if (!skin?.HeroID || !skin?.SkinInt) return null;
  const anim = skin.SelectedAnimation || 'SelectedRandom';
  return `${host}/game/anim/char/${skin.HeroID}-${skin.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${anim}/loop`;
}

function chainPodiumImage(podium) {
  if (!podium?.PodiumID) return null;
  return `${host}/game/animPodium/${podium.PodiumID}/loop/Ready`;
}

function chainWeaponImage(weapon) {
  if (!weapon?.WeaponSkinID) return null;
  const baseWeapon = weapon.BaseWeapon || 'Sword';
  return `${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${baseWeapon}Pose/loop`;
}

function featureLabel(entry, langs) {
  if (entry?.DisplayNameKey) return label(entry.DisplayNameKey, langs);
  if (entry?.CostumeName) return entry.CostumeName;
  if (entry?.PodiumName) return entry.PodiumName;
  return itemLabel(entry, langs);
}

function FeatureThumb({ entry, langs, small = false, size = 'normal' }) {
  const skinSrc = chainSkinImage(entry);
  const podiumSrc = chainPodiumImage(entry);
  const src = skinSrc || podiumSrc || itemImage(entry);
  const labelText = featureLabel(entry, langs);
  const sizeClass =
    small ? 'h-16 w-16' :
    size === 'list' ? 'h-20 w-20' :
    size === 'listSmall' ? 'h-14 w-14' :
    size === 'hero' ? 'min-h-[28rem] h-full w-full' :
    size === 'large' ? 'h-40 w-40 md:h-48 md:w-48' :
    size === 'supportTall' ? 'h-64 w-40' :
    size === 'supportWide' ? 'h-28 w-full max-w-md' :
    size === 'supportSquare' ? 'h-24 w-24' :
    size === 'none' ? '' :
    'h-28 w-28';
  if (src) {
    if (size === 'none') {
      return <ImageWithLoader src={src} alt={labelText} className="w-full" imgClassName="max-h-[34rem] max-w-full object-contain" small={small} />;
    }
    return (
      <div className={`${sizeClass} rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0`}>
        <ImageWithLoader src={src} alt={labelText} className="h-full w-full" imgClassName="max-h-full max-w-full object-contain" small={small} />
      </div>
    );
  }
  return <ItemThumb entry={entry} langs={langs} small={small} />;
}

function UiThemePieces({ entry }) {
  const theme = entry?.resolved?.themeData || entry?.themeData || {};
  const pieces = [
    { label: 'Nameplate', asset: theme.NameplateAsset },
    { label: 'Killplate', asset: theme.KillplateAsset },
    { label: 'Scoreplate', asset: theme.ScoreplateAsset },
  ].filter((piece) => clean(piece.asset));
  if (!pieces.length) return <FeatureThumb entry={entry} small={false} size="supportWide" />;
  return (
    <div className="flex w-full flex-col gap-2">
      {pieces.map((piece) => (
        <div key={piece.label} className="rounded-xl bg-slate-900/80 border border-slate-700 p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{piece.label}</div>
          <ImageWithLoader
            src={`${host}/game/getGfx/UI_PlayerThemes/${piece.asset}`}
            alt={piece.label}
            className="h-20 w-full"
            imgClassName="max-h-full max-w-full object-contain"
            small
          />
        </div>
      ))}
    </div>
  );
}

function ChainWeaponThumb({ weapon, langs }) {
  const src = chainWeaponImage(weapon);
  const labelText = weapon?.DisplayNameKey ? label(weapon.DisplayNameKey, langs) : weapon?.WeaponSkinName || 'Weapon Skin';
  return (
    <div className="h-20 w-20 md:h-24 md:w-24 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <ImageWithLoader src={src} alt={labelText} className="h-full w-full" small />
      ) : (
        <span className="text-[10px] text-slate-400 px-2 text-center">{labelText}</span>
      )}
    </div>
  );
}

function upgradeStageLabel(entry, index, type, langs) {
  const base = entry.DisplayNameKey ? label(entry.DisplayNameKey, langs) : entry.CostumeName || entry.PodiumName || type;
  return `${base} (${index + 1})`;
}

function missionText(mission, langs) {
  if (!mission) return '';
  const description = label(mission.DescriptionKey || mission.MissionName, langs);
  const count = clean(mission.SuccessCount) ? mission.SuccessCount : '';
  return [description, count && `x${count}`].filter(Boolean).join(' ');
}

function BattlePassFeaturedStrip({ pass, langs, compact = false }) {
  const rows = battlePassFeatureEntries(pass, { list: compact }).slice(0, compact ? 3 : 5);
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 rounded-lg bg-gray-100/70 dark:bg-slate-900/70 px-2 py-1">
          <FeatureThumb entry={row.entry} langs={langs} small={false} size={row.size || 'list'} />
          <div className="min-w-0 whitespace-normal break-words">
            <div className="text-[10px] font-black uppercase tracking-wide opacity-70">{row.label}</div>
            <div className="text-xs font-bold leading-tight whitespace-normal break-words">{featureLabel(row.entry, langs)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UpgradeChainStrip({ title, items, langs, type }) {
  const visible = asArray(items).filter(Boolean);
  if (!visible.length) return null;
  const first = visible[0];
  const rest = visible.slice(1);
  return (
    <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
      <div className="mb-3 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className="flex flex-col items-center gap-4">
        {first && <UpgradeStageCard entry={first} index={0} title={title} type={type} langs={langs} />}
        {rest.length > 0 && (
          <div className="flex flex-wrap items-start justify-center gap-4 xl:gap-5">
            {rest.map((entry, offset) => (
              <UpgradeStageCard key={`${entry.CostumeName || entry.PodiumName || offset}-${offset + 1}`} entry={entry} index={offset + 1} title={title} type={type} langs={langs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UpgradeStageCard({ entry, index, title, type, langs }) {
  return (
    <Tooltip lines={entryTooltipLines(entry, `${title} stage ${index + 1}`)}>
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center justify-center gap-3">
          <FeatureThumb entry={entry} langs={langs} small={false} size="large" />
          {type === 'Skin' && asArray(entry.Weapons).length > 0 && (
            <div className="flex flex-col gap-2">
              {asArray(entry.Weapons).slice(0, 2).map((weapon, weaponIndex) => (
                <ChainWeaponThumb key={`${weapon.WeaponSkinID || weapon.WeaponSkinName}-${weaponIndex}`} weapon={weapon} langs={langs} />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 max-w-44 text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">
          {upgradeStageLabel(entry, index, type, langs)}
        </div>
        {missionText(entry.UpgradeMission, langs) && (
          <div className="mt-1 max-w-48 rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-bold leading-tight text-blue-700 dark:text-blue-300 whitespace-normal break-words">
            <span className="block text-[10px] uppercase tracking-wide text-blue-500 dark:text-blue-300">Mission</span>
            {missionText(entry.UpgradeMission, langs)}
          </div>
        )}
      </div>
    </Tooltip>
  );
}

const battlePassUsefulGroups = [
  { title: 'Skins', types: ['Costume'] },
  { title: 'Weapon Skins', types: ['WeaponSkin'] },
  { title: 'Emotes', types: ['Taunt'] },
  { title: 'Avatars', types: ['Avatar'] },
  { title: 'Titles', types: ['Moniker'] },
  { title: 'Sidekicks', types: ['SpawnBot'] },
  { title: 'Companions', types: ['Companion'] },
  { title: 'KO Effects', types: ['KOEffect'] },
  { title: 'Smoke Trails', types: ['EmitterGroup'] },
];

function BattlePassRewardGroups({ rewards, langs }) {
  const valid = asArray(rewards)
    .filter(validBattlePassReward)
    .filter((reward) => !['MammothCoins', 'BattlePassXP', 'ColorScheme', 'Border', 'PlayerTheme'].includes(itemType(reward)));
  const groups = battlePassUsefulGroups
    .map((group) => ({
      ...group,
      entries: valid
        .filter((reward) => group.types.includes(itemType(reward)))
        .sort((a, b) => Number(a?.rewardData?.Tier || 0) - Number(b?.rewardData?.Tier || 0)),
    }))
    .filter((group) => group.entries.length);

  if (!groups.length) return null;
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.title}</div>
          <div className="flex flex-wrap gap-2">
            {group.entries.map((entry, index) => (
              <Tooltip key={`${itemKey(entry, index)}-${index}`} lines={entryTooltipLines(entry, itemLabel(entry, langs))}>
                <div className={`${group.title === 'Titles' ? 'bg-transparent border-transparent p-0' : 'bg-white/70 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 p-2'} relative flex w-32 flex-col items-center rounded-xl text-center`}>
                  <ItemThumb entry={entry} langs={langs} small={group.title === 'Titles'} />
                  {group.title !== 'Titles' && <div className="mt-2 w-full text-xs font-bold leading-tight text-gray-900 dark:text-white whitespace-normal break-words">{itemLabel(entry, langs)}</div>}
                  {entry?.rewardData?.Tier && (
                    <div className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">
                      {entry.rewardData.Tier}
                    </div>
                  )}
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BattlePassFeaturedRewards({ pass, langs }) {
  const featured = pass?.featuredRewards || {};
  const rows = battlePassFeatureEntries(pass);
  const heroRow = rows.find((row) => row.hero);
  const colorRow = rows.find((row) => row.label === 'Color Scheme');
  const borderRow = rows.find((row) => row.label === 'Border');
  const uiRow = rows.find((row) => row.label === 'UI Theme');
  const hasChains = asArray(featured.upgradedSkins).length > 1 || asArray(featured.upgradedPodiums).length > 1;
  const rewards = asArray(pass?.rewards);
  if (!rows.length && !hasChains && !rewards.length) return null;
  return (
    <Section title="Featured Rewards">
      <div className="space-y-3">
        {rows.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.55fr)] gap-3">
            {heroRow && (
              <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 border border-gray-200 dark:border-slate-700 p-3">
                <div className="mb-2 text-xs font-black uppercase tracking-wide text-blue-500">Final Skin</div>
                <div className="flex min-h-[28rem] flex-col items-center justify-center text-center gap-2">
                  <FeatureThumb entry={heroRow.entry} langs={langs} size="hero" />
                  <div className="max-w-full text-2xl font-black leading-tight text-gray-900 dark:text-white whitespace-normal break-words">{featureLabel(heroRow.entry, langs)}</div>
                </div>
              </div>
            )}
            {(colorRow || borderRow || uiRow) && (
              <div className="flex flex-col gap-3">
                {colorRow && (
                  <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Color Scheme</div>
                    <div className="flex items-center gap-3">
                      <FeatureThumb entry={colorRow.entry} langs={langs} size="supportSquare" />
                      <div className="min-w-0 text-sm font-bold leading-tight text-gray-900 dark:text-white whitespace-normal break-words">{featureLabel(colorRow.entry, langs)}</div>
                    </div>
                  </div>
                )}
                {(borderRow || uiRow) && (
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] gap-3">
                    {borderRow && (
                      <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Border</div>
                        <div className="mb-2 text-sm font-bold leading-tight text-gray-900 dark:text-white whitespace-normal break-words">{featureLabel(borderRow.entry, langs)}</div>
                        <FeatureThumb entry={borderRow.entry} langs={langs} size="none" />
                      </div>
                    )}
                    {uiRow && (
                      <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">UI Theme</div>
                        <div className="mb-2 text-sm font-bold leading-tight text-gray-900 dark:text-white whitespace-normal break-words">{featureLabel(uiRow.entry, langs)}</div>
                        <UiThemePieces entry={uiRow.entry} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {hasChains && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] gap-3">
            <UpgradeChainStrip title="Upgraded Skins" items={featured.upgradedSkins} langs={langs} type="Skin" />
            <UpgradeChainStrip title="Upgraded Podiums" items={featured.upgradedPodiums} langs={langs} type="Podium" />
          </div>
        )}
        <BattlePassRewardGroups rewards={rewards} langs={langs} />
      </div>
    </Section>
  );
}

function battlePassPathLabel(path, pass) {
  const season = battlePassNumber(pass);
  if (season === 13) {
    return {
      0: 'Intro Path',
      1: 'Light Path',
      2: 'Twilight Path',
      3: 'Dark Path',
      4: 'Final Path',
    }[path] || `Path ${Number(path) + 1}`;
  }
  return path === '0' ? 'Main Path' : `Path ${Number(path) + 1}`;
}

function battlePassPaths(rewards, pass) {
  const groups = new Map();
  asArray(rewards).filter(validBattlePassReward).forEach((reward) => {
    const path = String(reward?.rewardData?.Path ?? '0');
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push(reward);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([path, pathRewards]) => ({
      path,
      label: battlePassPathLabel(path, pass),
      tiers: battlePassTiers(pathRewards),
    }));
}

function battlePassSummary(rewards) {
  const makeSummary = (list) => {
    const counts = {};
    const grouped = new Map();
    let coins = 0;
    let xp = 0;
    for (const reward of list) {
      const type = itemType(reward);
      counts[type] = (counts[type] || 0) + 1;
      if (type === 'MammothCoins') coins += num(reward.rewardData?.Amount);
      if (type === 'BattlePassXP') xp += num(reward.rewardData?.Amount);
      const key = `${type}-${reward.rewardData?.Item || reward.rewardData?.IconName || reward.rewardData?.Amount || ''}`;
      const current = grouped.get(key) || {
        entry: { type, item: reward.rewardData?.Item || reward.rewardData?.Amount, resolved: reward.resolved, rewardData: reward.rewardData },
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += type === 'MammothCoins' || type === 'BattlePassXP' ? num(reward.rewardData?.Amount) : 1;
      grouped.set(key, current);
    }
    return { counts, coins, xp, total: list.length, entries: [...grouped.values()] };
  };
  const valid = asArray(rewards).filter(validBattlePassReward);
  const free = valid.filter((reward) => String(reward?.rewardData?.IsFree).toLowerCase() === 'true');
  const gold = valid.filter((reward) => String(reward?.rewardData?.IsFree).toLowerCase() !== 'true');
  return { free: makeSummary(free), gold: makeSummary(gold), all: makeSummary(valid) };
}

function SummaryPill({ label, value }) {
  if (!value) return null;
  return <span className="rounded-lg bg-gray-200 dark:bg-slate-700 px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">{label}: {value}</span>;
}

function SummaryBlock({ title, data, langs, tone }) {
  return (
    <div className={`rounded-lg p-3 ${tone === 'free' ? 'bg-[#405f88]' : tone === 'gold' ? 'bg-[#a9772a]' : 'bg-gray-100 dark:bg-slate-900'}`}>
      <div className="text-sm font-black text-gray-900 dark:text-white drop-shadow">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <SummaryPill label="Rewards" value={data.total} />
      </div>
      <RewardSummaryStrip entries={data.entries} langs={langs} />
    </div>
  );
}

function RewardSummaryStrip({ entries, langs }) {
  const visible = asArray(entries).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visible.map((summary, index) => {
        const type = itemType(summary.entry);
        const quantity = type === 'MammothCoins' || type === 'BattlePassXP' ? summary.amount : summary.count;
        return (
          <Tooltip key={`${itemKey(summary.entry, index)}-${index}`} lines={entryTooltipLines(summary.entry, `${itemLabel(summary.entry, langs)} (${quantity} total)`)}>
            <div className="relative">
              <ItemThumb entry={summary.entry} small langs={langs} />
              {quantity > 1 && (
                <div className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">
                  {type === 'BattlePassXP' ? `+${quantity}%` : `x${quantity}`}
                </div>
              )}
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

function BattlePassSummary({ summary, langs }) {
  return (
    <Section title="Rewards">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SummaryBlock title="Free Pass" data={summary.free} langs={langs} tone="free" />
        <SummaryBlock title="Gold Pass" data={summary.gold} langs={langs} tone="gold" />
        <SummaryBlock title="All Rewards" data={summary.all} langs={langs} />
      </div>
    </Section>
  );
}

function battlePassTiers(rewards) {
  const map = new Map();
  asArray(rewards).filter(validBattlePassReward).forEach((reward) => {
    const tier = Number(reward?.rewardData?.Tier || 0);
    if (!tier) return;
    if (!map.has(tier)) map.set(tier, { tier, free: [], gold: [] });
    const lane = String(reward?.rewardData?.IsFree).toLowerCase() === 'true' ? 'free' : 'gold';
    map.get(tier)[lane].push(reward);
  });
  return [...map.values()].sort((a, b) => a.tier - b.tier);
}

function BattlePassGrid({ tiers, langs }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-950/30 dark:border-slate-700 bg-[#06213a] shadow-lg">
      <div className="min-w-max">
        <div className="grid" style={{ gridTemplateColumns: `112px repeat(${tiers.length}, 150px)` }}>
          <div className="bg-slate-800 text-white font-black text-sm p-3 ring-1 ring-slate-900/70">Tiers</div>
          {tiers.map((tier) => (
            <div key={tier.tier} className="bg-slate-800 text-white font-black text-center text-sm p-3 ring-1 ring-slate-900/70">{tier.tier}</div>
          ))}
          <PassLaneLabel label="Free Pass" color="blue" />
          {tiers.map((tier) => <TierCell key={`free-${tier.tier}`} rewards={tier.free} lane="free" langs={langs} />)}
          <PassLaneLabel label="Gold Pass" color="gold" />
          {tiers.map((tier) => <TierCell key={`gold-${tier.tier}`} rewards={tier.gold} lane="gold" langs={langs} />)}
        </div>
      </div>
    </div>
  );
}

function PassLaneLabel({ label, color }) {
  return (
    <div className={`${color === 'gold' ? 'bg-[#aa7425]' : 'bg-[#405f88]'} min-h-44 p-4 ring-1 ring-slate-900/70`}>
      <div className="font-black text-white drop-shadow">{label}</div>
    </div>
  );
}

function TierCell({ rewards, lane, langs }) {
  const oneReward = asArray(rewards).length === 1;
  return (
    <div className={`${lane === 'gold' ? 'bg-[#a9772a]' : 'bg-[#405f88]'} min-h-44 p-2 ring-1 ring-slate-900/70 grid ${oneReward ? 'grid-cols-1 place-items-center' : 'grid-cols-2 content-center'} gap-2`}>
      {asArray(rewards).map((reward, index) => <BattlePassReward key={reward.rewardData?.RewardID || index} reward={reward} langs={langs} large={oneReward} />)}
    </div>
  );
}

function BattlePassReward({ reward, langs, large = false }) {
  const entry = { type: reward.rewardData?.Type, item: reward.rewardData?.Item || reward.rewardData?.Amount, resolved: reward.resolved, rewardData: reward.rewardData };
  return (
    <div className="w-full flex flex-col items-center text-center">
      <ItemThumb entry={entry} langs={langs} small={!large} />
      <div className="mt-1 text-xs font-bold text-white drop-shadow leading-tight whitespace-normal break-words">{itemLabel(entry, langs)}</div>
      <div className="text-[10px] font-bold text-cyan-300">{itemType(entry)}</div>
    </div>
  );
}

function battlePassNumber(pass) {
  return Number(String(pass?.battlePassData?.ID || pass?.battlePassData?.BattlePassID || pass?.ArrayIndex || '').match(/\d+/)?.[0] || pass?.ArrayIndex || 0);
}

function isClassicPass(pass) {
  const data = pass?.battlePassData || {};
  return /classic/i.test(String(data.Variant || data.SourceHint || data.SourceFile || ''));
}

function uniqueDeluxePurchases(pass) {
  const rows = asArray(pass?.purchases).filter((purchase) => clean(purchase?.entitlementData?.DeluxeBattlePassSeason));
  const byIncludedData = new Map();
  for (const purchase of rows) {
    const entitlement = purchase.entitlementData || {};
    const itemKey = asArray(entitlementItems(purchase))
      .map((entry) => `${itemType(entry)}:${entry?.item || entry?.amount || entry?.rewardData?.Item || entry?.rewardData?.Amount || ''}`)
      .sort()
      .join('|');
    const key = [
      entitlement.DeluxeBattlePassSeason,
      entitlement.DeluxeBattlePassTiers || '',
      entitlement.IncludesRewardsFrom || '',
      itemKey,
    ].join('::');
    const existing = byIncludedData.get(key);
    const currentName = String(entitlement.EntitlementName || '');
    const existingName = String(existing?.entitlementData?.EntitlementName || '');
    if (!existing || (/^BPDeluxe/i.test(currentName) && !/^BPDeluxe/i.test(existingName))) {
      byIncludedData.set(key, purchase);
    }
  }
  return [...byIncludedData.values()];
}

export function RawMetadataView({ catalog }) {
  const [selectedSection, setSelectedSection] = useState('Game');
  const [selectedFile, setSelectedFile] = useState('HeroTypes.xml');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showRaw, setShowRaw] = useState(false);

  const files = catalog?.sections?.[selectedSection] || [];

  useEffect(() => {
    if (!files.some((file) => file.file === selectedFile)) setSelectedFile(files[0]?.file || '');
  }, [files, selectedFile]);

  useEffect(() => {
    if (!selectedSection || !selectedFile) return;
    setLoading(true);
    setSelectedIndex(0);
    fetch(`${host}/game/metadata/${selectedSection}/${selectedFile}`)
      .then((res) => res.json())
      .then(setPayload)
      .catch((error) => setPayload({ error: error.message }))
      .finally(() => setLoading(false));
  }, [selectedSection, selectedFile]);

  const rows = asArray(payload?.data);
  const objectRows = rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const selectedRow = objectRows.length ? objectRows[Math.min(selectedIndex, objectRows.length - 1)] : null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-3 lg:p-4 text-gray-900 dark:text-white">
      <div className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
        <h2 className="text-2xl font-bold">Raw Metadata</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} className="rounded-md bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-3 py-2 text-sm">
            {Object.keys(catalog?.sections || {}).map((section) => <option key={section} value={section}>{section}</option>)}
          </select>
          <select value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)} className="md:col-span-2 rounded-md bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-3 py-2 text-sm">
            {files.map((file) => <option key={file.file} value={file.file}>{file.file}</option>)}
          </select>
          <button onClick={() => setShowRaw((value) => !value)} className="rounded-md bg-blue-500 text-white px-3 py-2 text-sm">
            {showRaw ? 'Record View' : 'Full Raw Data'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400">Loading metadata...</div>
        ) : payload?.error ? (
          <div className="text-red-500">{payload.error}</div>
        ) : showRaw || !objectRows.length ? (
          <>
            <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">{rows.length} rows</div>
            <details className="rounded-xl bg-gray-100 dark:bg-slate-950 p-3">
              <summary className="cursor-pointer select-none text-lg font-bold">Full Raw Data</summary>
              <pre className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs">{JSON.stringify(payload?.data, null, 2)}</pre>
            </details>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <select value={selectedIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))} className="md:col-span-2 rounded-md bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-3 py-2 text-sm">
                {objectRows.map((row, index) => {
                  const key = Object.keys(row).find((field) => /Name$/i.test(field)) || Object.keys(row).find((field) => /ID$/i.test(field)) || Object.keys(row)[0];
                  return <option key={index} value={index}>{String(row[key] || `Row ${index + 1}`)}</option>;
                })}
              </select>
              <div className="rounded-md bg-gray-100 dark:bg-slate-900 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{rows.length} rows</div>
            </div>
            <details className="rounded-xl bg-gray-100 dark:bg-slate-950 p-3">
              <summary className="cursor-pointer select-none text-lg font-bold">Selected Record Raw Data</summary>
              <pre className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs">{JSON.stringify(selectedRow, null, 2)}</pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
