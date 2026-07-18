import { host } from '../../../stuff';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { AddedBadge, getAddedPatch, getPatchFilterCounts, getPatchGroups, ImageWithLoader, LoadingSpinner, patchFilterMatches, PatchFilterSelect } from './comp/LoadingImage';
import { VirtualCardGrid } from './comp/VirtualCardGrid';

const moneyFields = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY', 'BRL', 'MXN'];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(value) {
  if (value === false) return false;
  if (Array.isArray(value)) return value.some(clean);
  if (typeof value === 'object' && value !== null) return false;
  const normalized = String(value ?? '').trim();
  return normalized !== '' && normalized !== '--' && normalized !== '-' && normalized.toLowerCase() !== 'undefined' && normalized.toLowerCase() !== 'null';
}

function cleanList(values) {
  return asArray(values).flat(Infinity).filter(clean).map((value) => String(value).trim());
}

function queryKeyForTitle(title) {
  return String(title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'item';
}

function pageSlugForTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  return <div className="flex max-w-full flex-wrap justify-center gap-1 pb-1">{visible.map((cost, index) => <CurrencyBadge key={`${cost.type}-${index}`} cost={cost} small={small} />)}</div>;
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

function typeLabel(type) {
  const normalized = normalizedType(type);
  if (normalized === 'PlayerTheme') return 'UI Themes';
  if (normalized === 'SpawnBot') return 'Sidekick';
  if (normalized === 'EmitterGroup') return 'Smoke Trail';
  if (normalized === 'KOEffect') return 'KO Effect';
  if (normalized === 'MammothCoins') return 'Mammoth Coins';
  return normalized;
}

function dataField(object, keys) {
  const source = object || {};
  const wanted = (Array.isArray(keys) ? keys : [keys]).map((key) => String(key).toLowerCase());
  const entry = Object.entries(source).find(([key, value]) => wanted.includes(String(key).toLowerCase()) && clean(value));
  return entry?.[1];
}

function bundleUiImageSrc(bundle, keys) {
  const image = dataField(bundle?.bundleData, keys);
  if (!clean(image)) return '';
  const file = String(image).split(/[\\/]/).pop();
  if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(file)) return '';
  return `${host}/game/images/images/UI/${file}`;
}

function bundleImageSrc(bundle) {
  const sources = [
    bundleUiImageSrc(bundle, ['PopupImage', 'PopUpImage']),
    bundleUiImageSrc(bundle, 'ItemImage'),
  ].filter(Boolean);
  return [...new Set(sources)];
}

function bundlePopupImageSrc(bundle) {
  const sources = [
    bundleUiImageSrc(bundle, ['PopupImage', 'PopUpImage']),
    bundleUiImageSrc(bundle, 'ItemImage'),
  ].filter(Boolean);
  return [...new Set(sources)];
}

function OptionalImageBlock({ src, label, className = '', imageClassName = '', imgClassName = 'max-h-full max-w-full object-contain', small = false }) {
  const sources = asArray(src).filter(Boolean);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [sources.join('|')]);
  if (!sources.length || failed) return null;
  return (
    <div className={className}>
      {label && <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      <ImageWithLoader
        src={sources}
        className={imageClassName}
        imgClassName={imgClassName}
        small={small}
        onError={() => setFailed(true)}
      />
    </div>
  );
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
  if (resolved.avatarData?.AvatarID) {
    return [
      `${host}/game/animAvatar/${resolved.avatarData.AvatarID}`,
      resolved.avatarData.IconName && `${host}/game/getGfx/UI_Icons/${resolved.avatarData.IconName}`,
      resolved.avatarData.AvatarName && `${host}/game/images/images/UI/${resolved.avatarData.AvatarName}.png`,
    ].filter(Boolean);
  }
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
    <div className={`rounded-lg bg-slate-900/80 border border-slate-700 ${large ? 'px-3 py-2 text-base sm:px-5 sm:py-4 sm:text-xl' : 'px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm'} font-bold text-center leading-tight break-words`} style={{ color }}>
      {itemLabel(entry, langs)}
    </div>
  );
}

const ItemThumb = memo(function ItemThumb({ entry, langs, small = false, className = '' }) {
  const type = itemType(entry).toLowerCase();
  const isBorder = type === 'border' || entry?.resolved?.themeData?.SeasonBorderID;
  if (type === 'moniker' || entry?.resolved?.monikerData) {
    return <MonikerChip entry={entry} langs={langs} large={!small} />;
  }
  if (type === 'playertheme' || entry?.resolved?.themeData?.PlayerThemeID) {
    return <UiThemePieces entry={entry} />;
  }

  const src = itemImage(entry);
  const sizeClass = className || (small ? (isBorder ? 'h-40 w-28 sm:h-48 sm:w-32' : 'h-14 w-14 sm:h-16 sm:w-16') : (isBorder ? 'min-h-64 w-full max-w-2xl sm:min-h-80' : 'h-24 w-24 sm:h-28 sm:w-28'));
  return (
    <div className={`${sizeClass} rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0`}>
      {src ? (
        <ImageWithLoader src={src} alt={itemLabel(entry, langs)} className="h-full w-full" small={small} />
      ) : (
        <span className="text-xs text-slate-400 px-2 text-center">{typeLabel(itemType(entry))}</span>
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
      <FieldCards rows={rows} />
    </Section>
  );
}

function FieldCards({ rows }) {
  const visible = asArray(rows).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {visible.map(([key, value]) => (
        <div key={key} className="rounded-lg bg-slate-950/70 border border-slate-700 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{key}</div>
          <div className="mt-1 text-sm text-white break-words whitespace-pre-wrap">
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoreDataSection({ rows, langs, title = 'Store Data' }) {
  const visible = asArray(rows).filter(Boolean);
  if (!visible.length) return null;
  return (
    <Section title={title}>
      <div className="space-y-3">
        {visible.map((row, index) => {
          const fieldRows = Object.entries(row || {})
            .filter(([key, value]) => !['ItemList', 'Costs'].includes(key) && clean(value))
            .filter(([, value]) => !(Array.isArray(value) && value.length === 0));
          return (
            <div key={`${row.StoreID || row.StoreName || index}-${index}`} className="rounded-lg bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 dark:text-white">{displayName(row.DisplayNameKey, row.StoreName, langs)}</div>
                  {row.StoreName && <div className="text-xs text-gray-500 dark:text-gray-400">{row.StoreName}</div>}
                </div>
                <CostBadges costs={storeCostBadges(row)} />
              </div>
              <FieldCards rows={fieldRows} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DetailColumns({ left, right }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
      <div className="flex flex-col gap-3">{left}</div>
      <div className="flex flex-col gap-3">{right}</div>
    </div>
  );
}

function RawDataSection({ data, title = 'Raw Data' }) {
  if (!data) return null;
  return (
    <details className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3">
      <summary className="cursor-pointer select-none text-base font-bold text-gray-900 dark:text-white sm:text-lg">{title}</summary>
      <pre className="mt-3 max-h-[70vh] overflow-auto app-scrollbar rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs text-gray-900 dark:text-gray-100">{JSON.stringify(data, null, 2)}</pre>
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
    <div className="hidden max-w-full flex-wrap justify-center gap-1 pb-1 sm:flex">
      {visible.map((tag) => (
        <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-gray-300 dark:bg-slate-700 text-gray-900 dark:text-white">{tag}</span>
      ))}
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1 text-sm font-bold transition-colors duration-200 ${active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'}`}
    >
      {children}
    </button>
  );
}

function AnimationFrameToggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
      <ToggleButton active={value === 'all'} onClick={() => onChange('all')}>All Frames</ToggleButton>
      <ToggleButton active={value === 'loop'} onClick={() => onChange('loop')}>Looped Frames</ToggleButton>
    </div>
  );
}

function AnimationImage({ src, alt = '' }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => setLoading(true), [Array.isArray(src) ? src.join('|') : src]);
  return (
    <div className="relative mt-2 flex min-h-80 items-center justify-center rounded-lg bg-slate-900/80 p-3">
      {loading && <LoadingSpinner />}
      <ImageWithLoader
        src={src}
        alt={alt}
        className="min-h-80 w-full rounded-lg"
        imgClassName="max-h-[70vh] max-w-full object-contain"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </div>
  );
}

function TauntAnimationSection({ item, langs }) {
  const [frameMode, setFrameMode] = useState('all');
  const [selectedPower, setSelectedPower] = useState('player1');
  const randomPowers = cleanList(item?.RandomPowers);
  const teamPower = item?.powerData?.TeamTauntPower?.PowerName;
  useEffect(() => {
    setFrameMode('all');
    setSelectedPower('player1');
  }, [item]);
  const powerName = teamPower && selectedPower === 'player2'
    ? teamPower
    : typeof selectedPower === 'number' && randomPowers[selectedPower]
      ? randomPowers[selectedPower]
      : item?.PowerName;
  return (
    <Section title="Animation Data">
      <AnimationFrameToggle value={frameMode} onChange={setFrameMode} />
      <AnimationImage
        src={`${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${powerName}/${frameMode}`}
        alt={label(item?.DisplayNameKey || item?.TauntName, langs)}
      />
      <div className="mt-3 flex flex-col gap-3">
        {teamPower && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Player Animation</div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton active={selectedPower === 'player1'} onClick={() => setSelectedPower('player1')}>1st Player</ToggleButton>
              <ToggleButton active={selectedPower === 'player2'} onClick={() => setSelectedPower('player2')}>2nd Player</ToggleButton>
            </div>
          </div>
        )}
        {randomPowers.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Random Animations</div>
            <div className="grid grid-cols-2 gap-2">
              {randomPowers.map((power, index) => (
                <ToggleButton key={power} active={selectedPower === index} onClick={() => setSelectedPower(index)}>{power}</ToggleButton>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function PodiumAnimationSection({ item, langs }) {
  const [frameMode, setFrameMode] = useState('all');
  const [animation, setAnimation] = useState('Ready');
  const [team, setTeam] = useState('Default');
  useEffect(() => {
    setFrameMode('all');
    setAnimation('Ready');
    setTeam('Default');
  }, [item]);
  const teamSuffix =
    team === 'Red Team' && item?.podiumData?.CustomArtTeamRed ? `/${item.podiumData.CustomArtTeamRed}` :
    team === 'Blue Team' && item?.podiumData?.CustomArtTeamBlue ? `/${item.podiumData.CustomArtTeamBlue}` :
    '';
  return (
    <Section title="Animation Data">
      <AnimationFrameToggle value={frameMode} onChange={setFrameMode} />
      <AnimationImage
        src={`${host}/game/animPodium/${item?.podiumData?.PodiumID}/${frameMode}/${animation}${teamSuffix}`}
        alt={label(item?.podiumData?.DisplayNameKey || item?.podiumData?.PodiumName, langs)}
      />
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Podium Color</div>
          <div className="grid grid-cols-3 gap-2">
            {['Default', 'Blue Team', 'Red Team'].map((value) => (
              <ToggleButton key={value} active={team === value} onClick={() => setTeam(value)}>{value}</ToggleButton>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Podium Animations</div>
          <div className="grid grid-cols-2 gap-2">
            {['Ready', 'LockIn', 'Victory', 'Defeat'].map((value) => (
              <ToggleButton key={value} active={animation === value} onClick={() => setAnimation(value)}>{value === 'LockIn' ? 'Lock In' : value}</ToggleButton>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

const companionAnimations = [
  ['ActOut', 'Act Out'], ['DodgeAir', 'Dodge Air'], ['Emote', 'Emote'], ['FallFast', 'Fall Fast'],
  ['FallTurn', 'Fall Turn'], ['HitReact', 'Hit React'], ['Jump', 'Jump'], ['Leave', 'Leave'],
  ['LookDown', 'Look Down'], ['LookUp', 'Look Up'], ['Ready', 'Ready'], ['ReadyTurn', 'Ready Turn'],
  ['RespawnFall', 'Respawn Fall'],
];

function CompanionAnimationSection({ item, langs }) {
  const [frameMode, setFrameMode] = useState('all');
  const [animation, setAnimation] = useState('Ready');
  useEffect(() => {
    setFrameMode('all');
    setAnimation('Ready');
  }, [item]);
  return (
    <Section title="Animation Data">
      <AnimationFrameToggle value={frameMode} onChange={setFrameMode} />
      <AnimationImage
        src={`${host}/game/animCompanion/${item?.companionData?.CompanionID}/${animation}/${frameMode}`}
        alt={label(item?.companionData?.DisplayNameKey || item?.companionData?.CompanionName, langs)}
      />
      <div className="mt-3">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Animation Type</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {companionAnimations.map(([value, text]) => (
            <ToggleButton key={value} active={animation === value} onClick={() => setAnimation(value)}>{text}</ToggleButton>
          ))}
        </div>
      </div>
    </Section>
  );
}

const companionTraitDefinitions = [
  ['CuriosityTrait', 'Curiosity Trait', '0-10; how likely are they to investigate items or wander around on their own?'],
  ['FearfulnessTrait', 'Fearfulness Trait', '0-10; how likely are they to hide from spawnbot flybys?'],
  ['LoyaltyTrait', 'Loyalty Trait', '0-10; do they prefer to stay by the player? (10 means they never wander on their own or follow other companions)'],
  ['SocialTrait', 'Social Trait', '0-10; how likely are they to try to follow another companion around?'],
];

function CompanionTraitsSection({ item }) {
  const rows = companionTraitDefinitions.filter(([key]) => clean(item?.companionData?.[key]));
  if (!rows.length) return null;
  return (
    <Section title="Companion Traits">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([key, title, description]) => (
          <div key={key} className="rounded-lg bg-slate-950/70 border border-slate-700 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{title}</div>
            <div className="mt-1 text-lg font-bold text-white">{item.companionData[key]}</div>
            <div className="mt-1 text-xs text-slate-400">{description}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SimpleAnimationSection({ title = 'Animation Data', src, alt }) {
  return (
    <Section title={title}>
      <AnimationImage src={src} alt={alt} />
    </Section>
  );
}

function smokeTrailEmitters(item) {
  const seen = new Map();
  asArray(item?.emitterTypes)
    .filter((emitter) => clean(emitter?.EmitterName))
    .forEach((emitter) => {
      if (!seen.has(emitter.EmitterName)) seen.set(emitter.EmitterName, emitter);
    });
  return [...seen.values()].sort((a, b) => Number(a.EmitterID || 0) - Number(b.EmitterID || 0));
}

function smokeTrailAnimations(item, emitterName = '') {
  const emitters = smokeTrailEmitters(item);
  const selectedEmitter = emitters.find((emitter) => emitter.EmitterName === emitterName) || emitters[0];
  const storeAnimation = item?.emitterTrailData?.StoreAnimation;
  return cleanList(selectedEmitter?.Animations)
    .map((animation) => ({ animation, emitterName: selectedEmitter?.EmitterName }))
    .sort((a, b) => {
      if (a.animation === storeAnimation) return -1;
      if (b.animation === storeAnimation) return 1;
      return a.animation.localeCompare(b.animation, undefined, { numeric: true });
    });
}

function SmokeTrailAnimationSection({ item, langs }) {
  const emitters = useMemo(() => smokeTrailEmitters(item), [item]);
  const [emitter, setEmitter] = useState('');
  const [animation, setAnimation] = useState('');
  useEffect(() => {
    const storeAnimation = item?.emitterTrailData?.StoreAnimation;
    const initialEmitter = emitters.find((candidate) => cleanList(candidate.Animations).includes(storeAnimation)) || emitters[0];
    const initialAnimations = smokeTrailAnimations(item, initialEmitter?.EmitterName);
    setEmitter(initialEmitter?.EmitterName || '');
    setAnimation(initialAnimations.find((entry) => entry.animation === storeAnimation)?.animation || initialAnimations[0]?.animation || '');
  }, [item, emitters]);
  const animations = smokeTrailAnimations(item, emitter);
  useEffect(() => {
    if (animations.length && !animations.some((entry) => entry.animation === animation)) setAnimation(animations[0].animation);
  }, [animations, animation]);
  const id = item?.emitterTrailData?.EmitterGroupID;
  const src = emitter && animation
    ? `${host}/game/animSmokeTrail/${id}/${encodeURIComponent(emitter)}/${encodeURIComponent(animation)}`
    : `${host}/game/animSmokeTrail/${id}`;
  return (
    <Section title="Animation Data">
      {emitters.length > 1 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Emitter Type</div>
          <div className="flex flex-wrap gap-2">
            {emitters.map((entry) => (
              <ToggleButton key={entry.EmitterName} active={emitter === entry.EmitterName} onClick={() => setEmitter(entry.EmitterName)}>
                {String(entry.EmitterName).replace(/^SmokeTrail/, '')}
              </ToggleButton>
            ))}
          </div>
        </div>
      )}
      {animations.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Animation</div>
          <div className="flex flex-wrap gap-2">
            {animations.map((entry) => (
              <ToggleButton key={entry.animation} active={animation === entry.animation} onClick={() => setAnimation(entry.animation)}>{entry.animation}</ToggleButton>
            ))}
          </div>
        </div>
      )}
      <AnimationImage src={src} alt={label(item?.emitterTrailData?.DisplayNameKey || item?.emitterTrailData?.EmitterGroupName, langs)} />
    </Section>
  );
}

function FilterShell({ title, count, total, search, setSearch, sort, setSort, filters, setFilters, filterDefs, filterOptions, filterCounts }) {
  const iconFilters = filterDefs.filter((filter) => filter.type === 'iconMulti');
  const dropdownFilters = filterDefs.filter((filter) => filter.type !== 'toggle' && filter.type !== 'iconMulti');
  const toggleFilters = filterDefs.filter((filter) => filter.type === 'toggle');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const toggleIconValue = (key, value) => {
    setFilters((current) => {
      const values = asArray(current[key]).map(String);
      const next = values.includes(String(value))
        ? values.filter((entry) => entry !== String(value))
        : [...values, String(value)];
      return { ...current, [key]: next };
    });
  };
  return (
    <div className="space-y-4 mb-4 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 p-3 shadow-sm">
      <button onClick={() => setFiltersOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg bg-gray-100 dark:bg-slate-700 px-3 py-2 text-left text-sm font-bold text-gray-900 dark:text-white">
        <span>Filters</span>
        <span className="text-xs text-gray-500 dark:text-gray-300">{filtersOpen ? 'Hide' : 'Show'}</span>
      </button>
      {filtersOpen && (
        <div className="space-y-4">
          {iconFilters.map((filter) => (
            <div key={filter.key} className="flex flex-wrap items-center gap-2">
              {(filterOptions[filter.key] || []).map((value) => {
                const selected = asArray(filters[filter.key]).map(String).includes(String(value));
                const countForValue = filterCounts?.[filter.key]?.[value] || 0;
                if (!countForValue) return null;
                const src = filter.icon?.(value) || null;
                const titleText = filter.iconLabel?.(value) || String(value);
                return (
                  <button
                    key={value}
                    type="button"
                    title={titleText}
                    aria-label={`${filter.label}: ${titleText}`}
                    onClick={() => toggleIconValue(filter.key, value)}
                    className={`relative flex h-12 w-12 items-center justify-center rounded-xl border bg-gray-100 p-1 transition dark:bg-slate-700 ${selected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 opacity-55 hover:opacity-100 dark:border-slate-600'} ${filter.iconClassName || ''}`}
                  >
                    {src ? (
                      <ImageWithLoader src={src} alt={titleText} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" small />
                    ) : (
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{String(value).slice(0, 3)}</span>
                    )}
                    <span className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-4 text-white">{countForValue}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {dropdownFilters.map((filter) => (
              filter.group === 'patch' ? (
                <PatchFilterSelect
                  key={filter.key}
                  value={filters[filter.key] || ''}
                  onChange={(value) => setFilters((current) => ({ ...current, [filter.key]: value }))}
                  groups={filterOptions[filter.key] || []}
                  counts={filterCounts?.[filter.key] || {}}
                />
              ) : (
                <select
                  key={filter.key}
                  value={filters[filter.key] || ''}
                  onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                  className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">{filter.label}</option>
                  {(filterOptions[filter.key] || []).map((value) => <option key={value} value={value}>{value} ({filterCounts?.[filter.key]?.[value] || 0})</option>)}
                </select>
              )
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
          <div className="text-sm text-blue-600 dark:text-blue-400 font-bold sm:text-lg">Showing {count} of {total}</div>
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
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs font-semibold rounded-lg px-3 py-2 border border-gray-300 dark:border-slate-600 w-full sm:min-w-[200px] sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 appearance-none cursor-pointer">
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
  const queryKey = config.queryKey || queryKeyForTitle(title);
  const gridClassName = config.gridClassName || (config.maxColumns === 3 ? 'grid grid-cols-2 items-start gap-3 lg:grid-cols-3' : 'grid grid-cols-2 items-start gap-3 lg:grid-cols-3 xl:grid-cols-4');
  const cardClassName = config.cardClassName || 'p-2 pt-8 min-h-44 sm:p-3 sm:pt-10 sm:min-h-52';
  const badgeClassName = config.badgeClassName || 'absolute left-1/2 top-2 z-10 -translate-x-1/2 pointer-events-none';
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(config.defaultSort || 'indexDesc');
  const [filters, setFilters] = useState({});
  const viewMode = 'grid';
  const urlHydrated = useRef(false);
  const urlSyncing = useRef(false);

  const filterDefs = useMemo(() => {
    const base = config.filters || [];
    if (!data.some((item) => getAddedPatch(item))) return base;
    if (base.some((filter) => filter.key === 'patch')) return base;
    return [
      ...base,
      { key: 'patch', label: 'Patch Version', group: 'patch', value: getAddedPatch },
    ];
  }, [config.filters, data]);
  const filterOptions = useMemo(() => {
    const output = {};
    for (const filter of filterDefs) {
      if (filter.type === 'toggle') continue;
      if (filter.group === 'patch') {
        output[filter.key] = getPatchGroups(data);
        continue;
      }
      if (filter.options) {
        output[filter.key] = filter.options(data, langs).map(String).filter(clean);
        continue;
      }
      const values = new Set();
      data.forEach((item) => asArray(filter.value(item)).filter(clean).forEach((value) => values.add(String(value))));
      output[filter.key] = [...values].sort((a, b) => a.localeCompare(b));
    }
    return output;
  }, [data, filterDefs, langs]);

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
      if (filter.group === 'patch') {
        if (!patchFilterMatches(filter.value(item), chosen)) return false;
        continue;
      }
      if (filter.type === 'iconMulti') {
        const selectedValues = asArray(chosen).map(String).filter(clean);
        if (!selectedValues.length) continue;
        const itemValues = asArray(filter.value(item)).map(String);
        if (!selectedValues.some((value) => itemValues.includes(value))) return false;
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
      if (filter.group === 'patch') {
        output[filter.key] = getPatchFilterCounts(data.filter((candidate) => matchesFilters(candidate, query, filter.key)));
        continue;
      }
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
    if (!data.length) return;
    const applyUrlState = () => {
      urlSyncing.current = true;
      const params = new URLSearchParams(window.location.search);
      const nextFilters = {};
      for (const filter of filterDefs) {
        const value = params.get(filter.key);
        if (value) {
          if (filter.type === 'toggle') nextFilters[filter.key] = value === '1';
          else if (filter.type === 'iconMulti') nextFilters[filter.key] = value.split(',').map(decodeURIComponent).filter(clean);
          else nextFilters[filter.key] = value;
        }
      }
      const id = params.get(queryKey);
      setSearch(params.get('search') || '');
      setSort(params.get('sort') || config.defaultSort || 'indexDesc');
      setFilters(nextFilters);
      setSelected(id ? data.find((item) => String(config.id(item)) === id) || null : null);
      urlHydrated.current = true;
      window.setTimeout(() => {
        urlSyncing.current = false;
      }, 0);
    };
    applyUrlState();
    window.addEventListener('popstate', applyUrlState);
    return () => window.removeEventListener('popstate', applyUrlState);
  }, [config, data, filterDefs, queryKey]);

  useEffect(() => {
    if (!urlHydrated.current || urlSyncing.current) return;
    const params = new URLSearchParams(window.location.search);
    params.set('page', pageSlugForTitle(title));
    if (selected) params.set(queryKey, String(config.id(selected)));
    else params.delete(queryKey);
    if (search.trim()) params.set('search', search.trim());
    else params.delete('search');
    if (sort !== (config.defaultSort || 'indexDesc')) params.set('sort', sort);
    else params.delete('sort');
    for (const filter of filterDefs) {
      const value = filters[filter.key];
      if (!value || (Array.isArray(value) && !value.length)) {
        params.delete(filter.key);
        continue;
      }
      if (filter.type === 'toggle') params.set(filter.key, '1');
      else if (filter.type === 'iconMulti' && asArray(value).length) params.set(filter.key, asArray(value).map(encodeURIComponent).join(','));
      else if (String(value)) params.set(filter.key, String(value));
      else params.delete(filter.key);
    }
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [config, filterDefs, filters, queryKey, search, selected, sort, title]);

  useEffect(() => {
    if (selected && !filtered.includes(selected)) setSelected(null);
  }, [filtered, selected]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-3 lg:p-4" style={{ fontFamily: langs?.font || 'BHLatinBold' }}>
      <div className="flex flex-col gap-4">
        <div className="w-full flex flex-col">
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
          />
          {config.virtual === false ? (
            <div className="h-[calc(100dvh-9rem)] min-h-[22rem] overflow-y-auto app-scrollbar pr-1">
              <div className={gridClassName}>
                {filtered.map((item, index) => (
                  <button key={`${config.id(item)}-${index}`} onClick={() => setSelected(item)} className={`${selected === item ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} relative self-start text-left text-sm sm:text-base bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl ${cardClassName} transition border border-gray-200 dark:border-slate-700 shadow-sm hover:-translate-y-0.5`}>
                    {config.card(item, langs, viewMode)}
                    <AddedBadge item={item} className={badgeClassName} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <VirtualCardGrid
              items={filtered}
              rowHeight={config.rowHeight || 330}
              rowHeightMobile={config.rowHeightMobile || Math.min(config.rowHeight || 330, 290)}
              maxColumns={config.maxColumns || 4}
              className="h-[calc(100dvh-9rem)] min-h-[22rem] app-scrollbar"
              getKey={(item, index) => `${config.id(item)}-${index}`}
              renderItem={(item, index) => (
                <button key={`${config.id(item)}-${index}`} onClick={() => setSelected(item)} className={`${selected === item ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} relative h-full w-full text-left text-sm sm:text-base bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl ${cardClassName} transition border border-gray-200 dark:border-slate-700 shadow-sm hover:-translate-y-0.5`}>
                  {config.card(item, langs, viewMode)}
                  <AddedBadge item={item} className={badgeClassName} />
                </button>
              )}
            />
          )}
        </div>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setSelected(null)}>
            <div className="relative flex h-dvh max-h-dvh w-full max-w-[min(96vw,100rem)] flex-col gap-3 overflow-y-auto app-scrollbar rounded-none border border-gray-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:p-3 lg:gap-4 lg:p-4" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 z-10 rounded-lg bg-gray-200 p-2 text-gray-900 hover:bg-gray-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <div className="flex flex-col gap-4 pr-11">
                {config.detail(selected, langs)}
              </div>
              <RawDataSection data={selected} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ title, subtitle, badges, hero, description, tags, inlineHero = false }) {
  const visibleBadges = cleanList(badges);
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:gap-5">
        <div className={`min-w-0 ${inlineHero && hero ? 'flex items-center gap-3' : ''}`}>
          {inlineHero && hero && <div className="shrink-0">{hero}</div>}
          <div className="min-w-0">
            {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{subtitle}</div>}
            <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-white sm:text-3xl">{title}</h2>
            {description && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 sm:text-sm">{description}</div>}
            {visibleBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleBadges.map((badge, index) => (
                  <span key={`${badge}-${index}`} className="inline-flex rounded-full bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 px-2 py-0.5 text-[11px] font-bold sm:px-3 sm:py-1 sm:text-xs">{badge}</span>
                ))}
              </div>
            )}
            <div className="mt-2"><TagChips tags={tags} /></div>
          </div>
        </div>
        {!inlineHero && hero && <div className="rounded-xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 flex items-center justify-center">{hero}</div>}
      </div>
    </div>
  );
}

function metadataEvents(item, prefix = 'Event') {
  return Object.entries(item || {})
    .filter(([key, value]) => new RegExp(`^${prefix}\\d+$`, 'i').test(key) && clean(value) && !String(value).includes('--------------'))
    .sort(([a], [b]) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
    .map(([key, value]) => ({ key, value: String(value) }));
}

function metadataCheckList(item) {
  return Object.entries(item || {})
    .filter(([key, value]) => /^CheckListKey\d+$/i.test(key) && clean(value))
    .sort(([a], [b]) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
    .map(([key, value]) => ({ key, value: String(value) }));
}

function metadataRewards(item) {
  return Object.entries(item || {})
    .filter(([key, value]) => /^Reward/i.test(key) && clean(value) && Number(value) !== 0)
    .map(([key, value]) => ({ key, value: String(value) }));
}

function prettyEvent(value) {
  return String(value || '')
    .split('.')
    .map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2'))
    .join(' / ');
}

function metadataImage(pathOrFile, folders = ['UI']) {
  if (!clean(pathOrFile)) return null;
  const file = String(pathOrFile).replace(/\\/g, '/').split('/').pop();
  if (!file || !/\.(png|jpe?g|gif|webp)$/i.test(file)) return null;
  return folders.map((folder) => `${host}/game/images/images/${folder}/${file}`);
}

function metadataUrl(value) {
  if (!clean(value)) return '';
  const url = String(value).trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

function SteamAchievementLink({ item }) {
  if (!clean(item?.SteamLinkageName)) return null;
  return (
    <a
      href="https://steamcommunity.com/stats/291550/achievements/"
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded-lg bg-blue-500 px-3 py-2 text-sm font-black text-white transition hover:bg-blue-400"
      onClick={(event) => event.stopPropagation()}
    >
      Open Steam Achievements
    </a>
  );
}

function MetadataLinkCards({ rows }) {
  const visible = asArray(rows).filter(([, value]) => metadataUrl(value));
  if (!visible.length) return null;
  return (
    <Section title="Links">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map(([labelText, value]) => (
          <a
            key={labelText}
            href={metadataUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-blue-400/40 bg-blue-500/15 p-3 text-sm font-black text-blue-700 transition hover:bg-blue-500 hover:text-white dark:text-blue-200"
          >
            <div>{labelText}</div>
            <div className="mt-1 break-words text-xs font-semibold opacity-80">{value}</div>
          </a>
        ))}
      </div>
    </Section>
  );
}

function guildMissionGroups(items) {
  const rows = asArray(items).filter(Boolean);
  const byName = new Map(rows.map((item) => [String(item.GuildMissionName), item]));
  const referenced = new Set(rows.map((item) => item.FollowUp).filter(clean).map(String));
  const visited = new Set();
  const groups = [];

  const totalsFor = (tiers) => ({
    RewardGuildPoints: tiers.reduce((total, tier) => total + Number(tier.RewardGuildPoints || 0), 0),
    RewardIndividualPoints: tiers.reduce((total, tier) => total + Number(tier.RewardIndividualPoints || 0), 0),
  });

  const addChain = (start) => {
    const tiers = [];
    let current = start;
    while (current && !visited.has(current.GuildMissionName)) {
      tiers.push(current);
      visited.add(current.GuildMissionName);
      current = clean(current.FollowUp) ? byName.get(String(current.FollowUp)) : null;
    }
    if (tiers.length) {
      groups.push({
        ...tiers[0],
        GuildMissionID: tiers[0].GuildMissionID,
        __tiers: tiers,
        __tierCount: tiers.length,
        __lastTier: tiers[tiers.length - 1],
        __rewardTotals: totalsFor(tiers),
      });
    }
  };

  rows
    .filter((item) => !referenced.has(String(item.GuildMissionName)))
    .sort((a, b) => Number(a.GuildMissionID || 0) - Number(b.GuildMissionID || 0))
    .forEach(addChain);

  rows
    .filter((item) => !visited.has(item.GuildMissionName))
    .sort((a, b) => Number(a.GuildMissionID || 0) - Number(b.GuildMissionID || 0))
    .forEach(addChain);

  return groups;
}

function MetadataQuickStats({ rows }) {
  const visible = asArray(rows).filter((row) => clean(row?.value));
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map((row) => (
        <div key={row.label} className="rounded-lg bg-slate-950/70 border border-slate-700 p-3 text-center">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</div>
          <div className="mt-1 text-sm font-black text-white break-words">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function MetadataEventList({ title = 'Events', events }) {
  const visible = asArray(events).filter(Boolean);
  if (!visible.length) return null;
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visible.map((event) => (
          <div key={`${event.key}-${event.value}`} className="rounded-lg bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{event.key}</div>
            <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{prettyEvent(event.value)}</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-words">{event.value}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MetadataRewardList({ rewards }) {
  const visible = asArray(rewards).filter(Boolean);
  if (!visible.length) return null;
  return (
    <Section title="Rewards">
      <div className="flex flex-wrap gap-2">
        {visible.map((reward) => (
          <span key={`${reward.key}-${reward.value}`} className="rounded-lg bg-blue-500/15 px-3 py-2 text-sm font-bold text-blue-700 dark:text-blue-300">
            {reward.key.replace(/^Reward/, '')}: {reward.value}
          </span>
        ))}
      </div>
    </Section>
  );
}

function missionRewardBadges(item, guild = false) {
  const rows = guild
    ? [
        { label: 'Guild Points', value: item?.RewardGuildPoints, tone: 'emerald' },
        { label: 'Player Points', value: item?.RewardIndividualPoints, tone: 'blue' },
      ]
    : [
        { label: 'Battle Stars', value: item?.RewardBattleStars, tone: 'blue' },
        { label: 'Gold', value: item?.RewardGold, tone: 'amber' },
      ];
  return rows.filter((row) => clean(row.value) && Number(row.value) !== 0);
}

function MetadataRewardCorner({ item, guild = false }) {
  const rewards = missionRewardBadges(item, guild);
  if (!rewards.length) return null;
  const toneClass = {
    amber: 'bg-amber-400/20 text-amber-700 dark:text-amber-200 border-amber-400/40',
    blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-200 border-blue-400/40',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/40',
  };
  return (
    <div className="absolute right-2 top-2 z-10 flex max-w-[55%] flex-wrap justify-end gap-1">
      {rewards.map((reward) => (
        <span key={reward.label} className={`rounded-lg border px-2 py-0.5 text-[10px] font-black leading-tight ${toneClass[reward.tone]}`}>
          {Number(reward.value).toLocaleString()} {reward.label}
        </span>
      ))}
    </div>
  );
}

function MetadataRewardSummary({ item, guild = false }) {
  const rewards = missionRewardBadges(item, guild);
  if (!rewards.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {rewards.map((reward) => (
        <span key={reward.label} className="rounded-lg bg-blue-500/15 px-3 py-2 text-sm font-bold text-blue-700 dark:text-blue-300">
          {reward.label}: {Number(reward.value).toLocaleString()}
        </span>
      ))}
    </div>
  );
}

function MetadataImageCard({ src, label }) {
  return (
    <OptionalImageBlock
      src={src}
      label={label}
      className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm"
      imageClassName="min-h-40 w-full rounded-lg bg-slate-900/80"
      imgClassName="max-h-72 max-w-full object-contain"
    />
  );
}

function metadataAssetImageSrc(asset) {
  if (!asset?.exists || !clean(asset.path) || !/\.(png|jpe?g|gif|webp)$/i.test(asset.path)) return null;
  return `${host}/game/images/${asset.path}`;
}

function MetadataAssetPill({ asset, label }) {
  if (!asset) return null;
  const text = label || asset.name || asset.rig || asset.declared || asset.file || asset.path;
  if (!clean(text)) return null;
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${asset.exists ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
      <div className="font-bold break-words">{text}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide opacity-75">{asset.exists ? 'Found' : 'Missing'}{asset.path ? ` • ${asset.path}` : ''}</div>
    </div>
  );
}

function MetadataAnimationFiles({ asset, title = 'Animation Files' }) {
  if (!asset?.rig) return null;
  const files = asArray(asset.files);
  return (
    <Section title={title}>
      <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-black text-white break-words">{asset.rig}</div>
            <div className="mt-1 text-xs text-slate-400">{asset.path || `${asset.folder}/${asset.rig}`}</div>
          </div>
          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${asset.exists ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
            {asset.exists ? `${files.length} states` : 'Missing rig folder'}
          </span>
        </div>
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <span key={file.path || file.file} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-100" title={file.path}>
                {file.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function MetadataRigPreview({ kind, asset, customArt, title = 'Animation Preview', className = 'min-h-64' }) {
  const states = asArray(asset?.files).map((file) => file.name).filter(Boolean);
  const initialState = states.includes('Ready') ? 'Ready' : states[0] || 'Ready';
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [asset?.rig, initialState]);

  if (!asset?.rig) return null;
  if (!asset.exists) {
    return (
      <Section title={title}>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="font-black">{asset.rig}</div>
          <div className="mt-1 text-xs uppercase tracking-wide opacity-80">Missing animation rig folder</div>
        </div>
      </Section>
    );
  }

  const src = metadataRigSrc(kind, asset.rig, state, customArt);

  return (
    <Section title={title}>
      <div className={`flex items-center justify-center rounded-xl bg-slate-950/80 p-3 ${className}`}>
        <ImageWithLoader src={src} className="h-full w-full" imgClassName="max-h-full max-w-full object-contain" />
      </div>
      {states.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {states.map((stateName) => (
            <ToggleButton key={stateName} active={stateName === state} onClick={() => setState(stateName)}>
              {stateName}
            </ToggleButton>
          ))}
        </div>
      )}
    </Section>
  );
}

function metadataRigSrc(kind, rig, state = 'Ready', customArt = '') {
  if (!clean(kind) || !clean(rig) || !clean(state)) return null;
  return `${host}/game/animMetadataRig/${encodeURIComponent(kind)}/${encodeURIComponent(rig)}/${encodeURIComponent(state)}${clean(customArt) ? `?customArt=${encodeURIComponent(customArt)}` : ''}`;
}

function MetadataAssetGrid({ title, assets }) {
  const visible = asArray(assets).filter((entry) => entry?.asset || entry?.name || entry?.rig || entry?.declared);
  if (!visible.length) return null;
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visible.map((entry, index) => {
          const asset = entry.asset || entry;
          return <MetadataAssetPill key={`${entry.field || asset.name || asset.rig || index}-${index}`} asset={asset} label={entry.field || entry.label} />;
        })}
      </div>
    </Section>
  );
}

function MetadataGfxAssetGrid({ title, assets }) {
  const visible = asArray(assets).filter((entry) => entry?.asset);
  if (!visible.length) return null;
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((entry, index) => {
          const asset = entry.asset;
          const src = asset?.exists && asset.folder && asset.name ? `${host}/game/getGfx/${asset.folder}/${asset.name}` : null;
          return (
            <div key={`${entry.field || asset?.name || index}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950/70 p-2 text-center">
              <div className="flex h-20 items-center justify-center rounded-md bg-slate-900/80 p-2">
                {src ? (
                  <ImageWithLoader src={src} className="h-full w-full" imgClassName="max-h-full max-w-full object-contain" small />
                ) : (
                  <span className="text-xs font-bold text-amber-200">Missing</span>
                )}
              </div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{entry.field}</div>
              <div className="mt-1 break-words text-xs text-white">{asset?.name}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function MetadataThemeBackground({ asset }) {
  if (!asset) return null;
  return (
    <Section title="Background Art">
      {asset.exists ? (
        <OptionalImageBlock
          src={metadataAssetImageSrc(asset)}
          imageClassName="min-h-48 w-full rounded-lg bg-slate-900/80"
          imgClassName="h-full w-full object-cover"
        />
      ) : null}
      <div className={asset.exists ? 'mt-3' : ''}>
        <MetadataAssetPill asset={asset} label={asset.declared || 'Background'} />
      </div>
    </Section>
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
    virtual: false,
    id: (item) => item.bundleData?.StoreID,
    defaultSort: 'idDesc',
    name: (item, langs) => displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs),
    search: (item, langs) => [item.bundleData?.StoreName, item.bundleData?.DisplayNameKey, item.bundleData?.DescriptionKey, label(item.bundleData?.DisplayNameKey, langs), label(item.bundleData?.DescriptionKey, langs), bundleItems(item).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'source', label: 'Source', value: (item) => item.source },
      { key: 'rarity', label: 'Rarity', value: (item) => item.bundleData?.Rarity },
      { key: 'tag', label: 'Store Tags', value: bundleTags },
      { key: 'type', label: 'Contains Type', value: (item) => bundleItems(item).map(itemType) },
    ],
    card: (item, langs, viewMode) => (
      <div className="flex w-full flex-col items-center justify-start text-center">
        <div className="font-semibold text-gray-900 dark:text-white">{displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs)}</div>
        <OptionalImageBlock
          src={bundleImageSrc(item)}
          className="mt-3 flex justify-center rounded-xl bg-slate-900/80 p-2"
          imageClassName="h-28 w-full"
          small
        />
        <div className="mt-3 flex max-w-full flex-wrap justify-center gap-2 pb-1">
          {bundleItems(item).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
        <div className="mt-3"><CostBadges costs={bundleTotalCost(item)} small /></div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={displayName(item.bundleData?.DisplayNameKey, item.bundleData?.StoreName, langs)}
          subtitle={`${item.source || sourceLabel} bundle`}
          description={label(item.bundleData?.DescriptionKey, langs)}
        />
        <OptionalImageBlock
          src={bundlePopupImageSrc(item)}
          label="Popup Image"
          className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm"
          imageClassName="max-h-52 w-full rounded-lg bg-slate-900/80"
          imgClassName="max-h-52 max-w-full object-contain"
        />
        <OptionalImageBlock
          src={bundleUiImageSrc(item, 'ItemImage')}
          label="Item Image"
          className="rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 shadow-sm"
          imageClassName="max-h-52 w-full rounded-lg bg-slate-900/80"
          imgClassName="max-h-52 max-w-full object-contain"
        />
        <DetailColumns
          left={<BundlePricing bundle={item} langs={langs} />}
          right={<FieldGrid data={item.bundleData} langs={langs} title="Bundle Data" exclude={['ItemList']} />}
        />
      </>
    ),
  };
}

function BundlePricing({ bundle, langs }) {
  const costs = bundleTotalCost(bundle);
  const items = asArray(bundle?.bundleData?.ItemList);
  if (!costs.length && !items.some((item) => bundleItemBaseCost(item).length)) return null;
  return (
    <Section title="Items">
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bundle Cost</div>
          <CostBadges costs={costs} />
          <DiscountLabels costs={costs} />
        </div>
        {items.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Per Item</div>
            <div className="grid grid-cols-1 gap-2">
              {items.map((item, index) => {
                const entry = bundleItems(bundle).find((candidate) => candidate.item === (item.Item || item.StoreName)) || { type: item.Type, item: item.Item || item.StoreName };
                return (
                  <div key={`${item.StoreName || item.Item}-${index}`} className="rounded-lg bg-gray-100 dark:bg-slate-900 p-2 flex items-center justify-between gap-3">
                    <ItemThumb entry={entry} langs={langs} small />
                    <div className="min-w-0 flex-1">
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
    rowHeight: 225,
    id: (item) => item.chestData?.ChanceBoxID,
    defaultSort: 'indexDesc',
    name: (item, langs) => label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs),
    search: (item, langs) => [item.chestData?.ChanceBoxName, label(item.chestData?.DisplayNameKey, langs), ...asArray(item.commonItems).map((entry) => itemLabel({ ...entry, type: 'Costume' }, langs)), ...asArray(item.exclusiveItems).map((entry) => itemLabel({ ...entry, type: 'Costume' }, langs))],
    filters: [
      { key: 'status', label: 'Availability', value: (item) => item.chestData?.EndTime ? 'Limited/Ended' : 'Current' },
    ],
    card: (item, langs) => (
      <div className="flex gap-3">
        <div className="h-24 w-24 rounded-xl bg-slate-900/80 flex items-center justify-center shrink-0 overflow-hidden">
          <img src={`${host}/game/animChest/${item.chestData?.ChanceBoxID}/StoreIdle/loop`} alt={label(item.chestData?.DisplayNameKey, langs)} className="max-h-full max-w-full object-contain" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs)}</div>
          <div className="mt-2 flex gap-1 overflow-hidden">
            {asArray(item.exclusiveItems).slice(0, 4).map((entry, index) => <ItemThumb key={entry.item || index} entry={{ ...entry, type: 'Costume' }} langs={langs} small />)}
          </div>
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item.chestData?.DisplayNameKey || item.chestData?.ChanceBoxName, langs)}
          subtitle={item.chestData?.ChanceBoxName}
          badges={[item.chestData?.EndTime ? 'Limited/Ended' : null]}
          hero={<ImageWithLoader src={`${host}/game/animChest/${item.chestData?.ChanceBoxID}/StoreIdle/loop`} className="h-24 w-24 rounded-lg bg-slate-900/80" imgClassName="max-h-full max-w-full object-contain" />}
          inlineHero
        />
        <DetailColumns
          left={(
            <>
              <Section title="Exclusive Skins"><ItemStrip items={asArray(item.exclusiveItems).map((entry) => ({ ...entry, type: 'Costume' }))} langs={langs} /></Section>
              <Section title="Common Skins"><ItemStrip items={asArray(item.commonItems).map((entry) => ({ ...entry, type: 'Costume' }))} langs={langs} /></Section>
            </>
          )}
          right={<FieldGrid data={item.chestData} langs={langs} title="Chest Data" exclude={['CommonItems', 'ExclusiveItems']} />}
        />
      </>
    ),
  },
  bundles: bundleConfig('Store'),
  promos: {
    rowHeight: 275,
    id: (item) => item.promoData?.StoreID,
    defaultSort: 'indexDesc',
    name: (item, langs) => displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs),
    search: (item, langs) => [item.promoData?.StoreName, item.promoData?.Type, label(item.promoData?.DisplayNameKey, langs), asArray(item.items).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'type', label: 'Type', value: (item) => item.promoData?.Type },
      { key: 'rarity', label: 'Rarity', value: (item) => item.promoData?.Rarity },
      { key: 'geo', label: 'Geo Locked', type: 'toggle', value: (item) => clean(item.promoData?.GeoLockedCountries) },
    ],
    card: (item, langs, viewMode) => (
      <div className="flex w-full flex-col items-center justify-start text-center">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs)}</div>
        </div>
        <div className="mt-3 flex max-h-44 max-w-full flex-wrap justify-center gap-2 overflow-y-auto app-scrollbar pb-1">
          {asArray(item.items).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={displayName(item.promoData?.DisplayNameKey, item.promoData?.StoreName, langs)} subtitle={item.promoData?.Type} />
        <DetailColumns
          left={<Section title={item.promoData?.Type === 'Bundle' ? 'Bundle Items' : 'Reward'}><ItemStrip items={item.items} langs={langs} /></Section>}
          right={<FieldGrid data={item.promoData} langs={langs} title="Promo Data" />}
        />
      </>
    ),
  },
  purchases: {
    virtual: false,
    id: (item) => item.entitlementData?.EntitlementID,
    defaultSort: 'indexDesc',
    name: (item, langs) => label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs),
    search: (item, langs) => [item.entitlementData?.EntitlementName, label(item.entitlementData?.DisplayNameKey, langs), entitlementItems(item).map((entry) => itemLabel(entry, langs)).join(' ')],
    filters: [
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item.entitlementData?.BattlePassSeason || item.entitlementData?.DeluxeBattlePassSeason },
      { key: 'itemType', label: 'Contains Type', value: (item) => entitlementItems(item).map(itemType) },
      { key: 'priced', label: 'Has Pricing', type: 'toggle', value: (item) => asArray(item.steamPurchases).some((purchase) => moneyFields.some((field) => clean(purchase[field]))) },
    ],
    card: (item, langs, viewMode) => (
      <div className="flex w-full flex-col items-center justify-start text-center">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs)}</div>
        </div>
        <div className="mt-3 flex max-h-44 max-w-full flex-wrap justify-center gap-2 overflow-y-auto app-scrollbar pb-1">
          {entitlementItems(item).map((entry, index) => <ItemThumb key={itemKey(entry, index)} entry={entry} langs={langs} small />)}
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.entitlementData?.DisplayNameKey || item.entitlementData?.EntitlementName, langs)} subtitle={item.entitlementData?.EntitlementName} />
        <DetailColumns
          left={(
            <>
              {entitlementItems(item).length > 0 && <Section title="Items"><ItemStrip items={entitlementItems(item)} langs={langs} /></Section>}
              <Pricing purchases={item.steamPurchases} />
            </>
          )}
          right={<FieldGrid data={item.entitlementData} langs={langs} title="Entitlement Data" />}
        />
      </>
    ),
  },
  borders: {
    rowHeight: 310,
    id: (item) => item.themeData?.SeasonBorderID,
    defaultSort: 'indexDesc',
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
      <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item.themeData?.DisplayNameKey || item.themeData?.SeasonBorderName, langs)}</div>
        </div>
        <div className="flex w-full justify-center">
          <ItemThumb entry={{ type: 'Border', resolved: item }} langs={langs} small />
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item.themeData?.DisplayNameKey || item.themeData?.SeasonBorderName, langs)}
          subtitle={item.themeData?.SeasonBorderName}
          description={label(item.themeData?.DescriptionKey, langs)}
        />
        <DetailColumns
          left={(
            <>
              <Section title="Image Data">
                <ImageWithLoader src={`${host}/game/animBorder/${item.themeData?.SeasonBorderID}`} className="min-h-96 w-full rounded-lg bg-slate-900/80" imgClassName="max-h-[80vh] max-w-full object-contain" />
              </Section>
              <StoreDataSection rows={item.store} langs={langs} />
            </>
          )}
          right={<FieldGrid data={item.themeData} langs={langs} title="Border Data" />}
        />
      </>
    ),
  },
};

function resolvedStoreConfig({
  type,
  dataKey,
  idKey,
  nameKey,
  displayKey = 'DisplayNameKey',
  descriptionKey = 'DescriptionKey',
  queryKey,
  title,
  dataTitle,
  imageTitle = 'Image Data',
  imageLabel,
  cardImageClassName = '',
  detailImageClassName = '',
  compactCard = false,
  cardClassName,
  badgeClassName,
  defaultSort,
  rowHeight,
  maxColumns,
  extraFilters = [],
  animationSection,
}) {
  const typeFilterLabel = `${title} Type`;
  return {
    queryKey,
    cardClassName,
    badgeClassName,
    rowHeight,
    maxColumns,
    id: (item) => item?.[dataKey]?.[idKey] || item?.ArrayIndex,
    defaultSort: defaultSort || 'indexDesc',
    name: (item, langs) => label(item?.[dataKey]?.[displayKey] || item?.[dataKey]?.[nameKey], langs),
    search: (item, langs) => [
      item?.[dataKey]?.[nameKey],
      item?.[dataKey]?.[idKey],
      label(item?.[dataKey]?.[displayKey], langs),
      label(item?.[dataKey]?.[descriptionKey], langs),
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label, row.Rarity].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.promo?.Type,
      item?.bp?.ID,
      item?.entitlement?.EntitlementName,
    ],
    filters: [
      { key: 'source', label: 'Source', value: (item) => item.source || (asArray(item.store).length ? 'Store' : 'Data') },
      { key: 'rarity', label: 'Rarity', value: (item) => asArray(item.store).map((row) => row.Rarity) },
      { key: 'type', label: typeFilterLabel, value: (item) => item?.promo?.Type || item?.bp?.ID || item?.entitlement?.EntitlementName },
      { key: 'storeOnly', label: `Store ${title} Only`, type: 'toggle', value: (item) => asArray(item.store).length > 0 },
      ...extraFilters,
    ],
    card: (item, langs) => (
      <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
        {type !== 'Moniker' && (
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white">{label(item?.[dataKey]?.[displayKey] || item?.[dataKey]?.[nameKey], langs)}</div>
          </div>
        )}
        {type === 'Moniker' ? (
          <MonikerChip entry={{ type: 'Moniker', resolved: item, item: item?.[dataKey]?.[nameKey] }} langs={langs} large={!compactCard} />
        ) : (
          <div className="flex w-full justify-center">
            <ItemThumb entry={{ type, resolved: item, item: item?.[dataKey]?.[nameKey] }} langs={langs} small={!cardImageClassName} className={cardImageClassName} />
          </div>
        )}
        <CostBadges costs={storeRows(item).flatMap(storeCostBadges)} small />
      </div>
    ),
    detail: (item, langs) => {
      const titleText = label(item?.[dataKey]?.[displayKey] || item?.[dataKey]?.[nameKey], langs);
      const imageEntry = { type, resolved: item, item: item?.[dataKey]?.[nameKey] };
      const left = type === 'Moniker' ? null : (animationSection ? animationSection(item, langs) : (
        <Section title={imageLabel || imageTitle}>
          <div className="flex min-h-64 items-center justify-center rounded-lg bg-slate-900/80 p-3">
            <ItemThumb entry={imageEntry} langs={langs} className={detailImageClassName} />
          </div>
        </Section>
      ));
      const store = storeRows(item);
      const right = (
        <>
          <StoreDataSection rows={store} langs={langs} />
          <FieldGrid data={item?.[dataKey]} langs={langs} title={dataTitle} />
        </>
      );
      return (
        <>
          <Header
            title={titleText}
            subtitle={item?.[dataKey]?.[nameKey]}
            description={label(item?.[dataKey]?.[descriptionKey], langs)}
          />
          {left ? <DetailColumns left={left} right={right} /> : right}
        </>
      );
    },
  };
}

function legendIconSrc(legend) {
  if (!legend) return null;
  return `${host}/game/getGfx/${legend?.costumeType?.CostumeIconFileName}/${legend?.costumeType?.CostumeIcon}`;
}

function sortedBattlePassValue(a, b) {
  const num = (value) => parseInt(String(value || '').replace('BP', '').split('-')[0], 10) || 0;
  const diff = num(a) - num(b);
  return diff || String(a).localeCompare(String(b));
}

function mixedStoreRows(item) {
  return [
    ...asArray(item?.store),
    ...asArray(item?.skin?.store),
  ].filter(Boolean);
}

function skinDisplayName(item, langs) {
  return label(item?.costumeData?.DisplayNameKey || item?.costumeData?.CostumeName, langs);
}

function skinAnimButtonRows(animTypes = {}, overAnim) {
  const hasOther = animTypes.idleOther && animTypes.selectedOther;
  if (!hasOther) {
    return [[
      animTypes.idle && { key: 'idle', label: 'Idle', anim: animTypes.idle, urlType: 'all' },
      animTypes.selected && { key: 'selected', label: 'Selected', anim: animTypes.selected, urlType: 'all' },
      animTypes.selected && { key: 'selectedLoop', label: 'Selected Loop', anim: animTypes.selected, urlType: 'loop' },
      overAnim?.idle && { key: 'idleExtended', label: 'Idle Extended', anim: overAnim.idle, urlType: 'all' },
    ].filter(Boolean)];
  }
  return [
    [
      animTypes.idleOther && { key: 'idleOther', label: 'Idle (Main)', anim: animTypes.idleOther, urlType: 'all' },
      animTypes.selectedOther && { key: 'selectedOther', label: 'Selected (Main)', anim: animTypes.selectedOther, urlType: 'all' },
      animTypes.selectedOther && { key: 'selectedOtherLoop', label: 'Selected Loop (Main)', anim: animTypes.selectedOther, urlType: 'loop' },
      overAnim?.idle && { key: 'idleExtended', label: 'Idle Extended', anim: overAnim.idle, urlType: 'all' },
    ].filter(Boolean),
    [
      animTypes.idle && { key: 'idle', label: 'Idle (Other)', anim: animTypes.idle, urlType: 'all' },
      animTypes.selected && { key: 'selected', label: 'Selected (Other)', anim: animTypes.selected, urlType: 'all' },
      animTypes.selected && { key: 'selectedLoop', label: 'Selected Loop (Other)', anim: animTypes.selected, urlType: 'loop' },
    ].filter(Boolean),
  ].filter((row) => row.length);
}

function SkinAnimationSection({ item, langs }) {
  const rows = skinAnimButtonRows(item?.animTypes, item?.overAnim);
  const first = rows.flat()[0];
  const [current, setCurrent] = useState(first || null);
  useEffect(() => setCurrent(first || null), [item?.costumeData?.CostumeID]);
  const src = current
    ? `${host}/game/anim/char/${item?.HeroID}-${item?.SkinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${current.anim}/${current.urlType}`
    : itemImage({ type: 'Costume', resolved: item });
  return (
    <Section title="Animation/Image Data">
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            {row.map((button) => (
              <ToggleButton key={button.key} active={current?.key === button.key} onClick={() => setCurrent(button)}>
                {button.label}
              </ToggleButton>
            ))}
          </div>
        ))}
      </div>
      <AnimationImage src={src} alt={skinDisplayName(item, langs)} />
      {asArray(item?.costumeData?.WeaponSkins).length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {asArray(item.costumeData.WeaponSkins).map((weapon) => (
            <div key={weapon.WeaponSkinID} className="flex items-center gap-3 rounded-lg bg-slate-950/70 border border-slate-700 p-3">
              <ImageWithLoader src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon.BaseWeapon}/1`} className="h-8 w-8 bg-transparent" imgClassName="max-h-full max-w-full object-contain" small />
              <ImageWithLoader src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`} className="h-24 w-24 rounded-lg bg-slate-900/80" small />
              <div className="min-w-0 text-sm font-bold text-white">{label(weapon.DisplayNameKey || weapon.WeaponSkinName, langs)}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function SkinCard({ item, legends, langs }) {
  const legend = asArray(legends).find((entry) => String(entry?.heroData?.HeroID) === String(item?.HeroID));
  const weapons = asArray(item?.costumeData?.WeaponSkins).slice(0, 2);
  return (
    <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-slate-900/80 px-2 py-1 text-xs font-bold text-white">
        {legend && <ImageWithLoader src={legendIconSrc(legend)} className="h-7 w-7 bg-transparent" imgClassName="max-h-full max-w-full object-contain" small />}
        {legend?.heroData?.HeroName || item?.OwnerHero}
      </div>
      <div className="mt-4 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-white">{skinDisplayName(item, langs)}</div>
      </div>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
        <ImageWithLoader src={itemImage({ type: 'Costume', resolved: item })} alt={skinDisplayName(item, langs)} className="h-40 w-full rounded-xl bg-slate-900/80" imgClassName="max-h-full max-w-full object-contain" />
        <div className="flex flex-col gap-2">
          {weapons.map((weapon) => (
            <ImageWithLoader key={weapon.WeaponSkinID} src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`} className="h-16 w-16 rounded-lg bg-slate-900/80" small />
          ))}
        </div>
      </div>
      <TagChips tags={storeTags(item)} />
      <CostBadges costs={storeRows(item).flatMap(storeCostBadges)} small />
    </div>
  );
}

function skinConfig(legends = []) {
  return {
    queryKey: 'skin',
    id: (item) => item?.costumeData?.CostumeID,
    defaultSort: 'indexDesc',
    name: skinDisplayName,
    search: (item, langs) => [
      skinDisplayName(item, langs),
      item?.costumeData?.CostumeName,
      item?.costumeData?.CostumeID,
      item?.OwnerHero,
      item?.costumeData?.ReplacementHeroName,
      item?.costumeData?.ParentCrossover,
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label, row.Rarity].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.promo?.Type,
      item?.chest?.ChanceBoxName,
      item?.bp?.ID,
      item?.entitlement?.EntitlementName,
    ],
    filters: [
      {
        key: 'hero',
        label: 'Legends',
        type: 'iconMulti',
        value: (item) => item?.HeroID,
        options: (data) => asArray(legends)
          .filter((legend) => data.some((item) => String(item?.HeroID) === String(legend?.heroData?.HeroID)))
          .sort((a, b) => Number(a?.heroData?.ReleaseOrderID || a?.heroData?.HeroID || 0) - Number(b?.heroData?.ReleaseOrderID || b?.heroData?.HeroID || 0))
          .map((legend) => legend?.heroData?.HeroID),
        icon: (value) => legendIconSrc(asArray(legends).find((legend) => String(legend?.heroData?.HeroID) === String(value))),
        iconLabel: (value) => asArray(legends).find((legend) => String(legend?.heroData?.HeroID) === String(value))?.heroData?.HeroName || value,
      },
      { key: 'cohort', label: 'Cohorts', value: (item) => asArray(item.store).map((row) => row.Cohort) },
      { key: 'promo', label: 'Promotions', value: (item) => asArray(item.store).map((row) => row.TimedPromotion) },
      { key: 'rarity', label: 'Rarity', value: (item) => asArray(item.store).map((row) => row.Rarity) },
      { key: 'storeLabel', label: 'Store Label', value: (item) => asArray(item.store).map((row) => row.Label) },
      { key: 'promoType', label: 'Promo Codes', value: (item) => item?.promo?.Type },
      { key: 'chest', label: 'Chests', value: (item) => item?.chest?.ChanceBoxName },
      { key: 'costumeIndex', label: 'Costume Index', value: (item) => item?.costumeData?.CostumeIndex },
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item?.bp?.ID, options: (data) => [...new Set(data.map((item) => item?.bp?.ID).filter(clean))].sort(sortedBattlePassValue) },
      { key: 'storeOnly', label: 'Store Skins Only', type: 'toggle', value: (item) => asArray(item.store).length > 0 },
      { key: 'entitlement', label: 'DLC Skins Only', type: 'toggle', value: (item) => !!item?.entitlement },
    ],
    card: (item, langs) => <SkinCard item={item} legends={legends} langs={langs} />,
    detail: (item, langs) => {
      const replacementPortrait = item?.costumeData?.ReplacementPortrait
        ? `${host}/game/getGfx/${item.costumeData.ReplacementPortraitFileName}/${item.costumeData.ReplacementPortrait}M`
        : null;
      return (
        <>
          <Header
            title={skinDisplayName(item, langs)}
            subtitle={item?.costumeData?.CostumeName}
            description={label(storeRows(item)[0]?.DescriptionKey || item?.costumeData?.DescriptionKey, langs)}
            hero={replacementPortrait && <ImageWithLoader src={replacementPortrait} className="h-24 w-24 bg-transparent" imgClassName="max-h-full max-w-full object-contain" />}
            tags={storeTags(item)}
            inlineHero
          />
          <DetailColumns
            left={<SkinAnimationSection item={item} langs={langs} />}
            right={(
              <>
                <StoreDataSection rows={storeRows(item)} langs={langs} />
                <FieldGrid data={item?.costumeData} langs={langs} title="Costume Data" exclude={['WeaponSkins']} />
                <FieldGrid data={item?.entitlement} langs={langs} title="Entitlement Data" />
              </>
            )}
          />
        </>
      );
    },
  };
}

function weaponDisplayName(item, langs) {
  return label(item?.weaponData?.DisplayNameKey || item?.weaponData?.WeaponSkinName, langs);
}

function weaponAnimationBase(baseWeapon) {
  if (baseWeapon === 'Pistol') return 'Pistols';
  if (baseWeapon === 'RocketLance') return 'Lance';
  return baseWeapon || 'Sword';
}

function weaponAnimationName(baseWeapon) {
  return baseWeapon === 'Sword' ? 'a__1HandRearAnimation' : `a__${baseWeapon || 'Sword'}Animation`;
}

function WeaponImagesSection({ item, langs }) {
  const base = item?.weaponData?.BaseWeapon || 'Sword';
  return (
    <Section title="Weapon Images">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-900/80 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tooltip</div>
          <AnimationImage src={`${host}/game/anim/weapon/${item?.weaponData?.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${base}Pose/all`} alt={weaponDisplayName(item, langs)} />
        </div>
        <div className="rounded-lg bg-slate-900/80 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">In Game</div>
          <AnimationImage src={`${host}/game/anim/weapon/${item?.weaponData?.WeaponSkinID}/Animation_${weaponAnimationBase(base)}/${weaponAnimationName(base)}/All/all`} alt={weaponDisplayName(item, langs)} />
        </div>
      </div>
    </Section>
  );
}

function WeaponCard({ item, legends, langs }) {
  const owner = item?.skin?.OwnerHero;
  const legend = asArray(legends).find((entry) => entry?.heroData?.HeroName === owner);
  return (
    <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
      {owner && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-slate-900/80 px-2 py-1 text-xs font-bold text-white">
          {legend && <ImageWithLoader src={legendIconSrc(legend)} className="h-7 w-7 bg-transparent" imgClassName="max-h-full max-w-full object-contain" small />}
          {owner}
        </div>
      )}
      <div className="mt-4 min-w-0">
        <div className="inline-flex items-center justify-center gap-2 font-semibold text-gray-900 dark:text-white">
          <ImageWithLoader src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${item?.weaponData?.BaseWeapon}/1`} className="h-7 w-7 bg-transparent" imgClassName="max-h-full max-w-full object-contain" small />
          {weaponDisplayName(item, langs)}
        </div>
      </div>
      <ImageWithLoader src={itemImage({ type: 'WeaponSkin', resolved: item })} alt={weaponDisplayName(item, langs)} className="h-36 w-36 rounded-xl bg-slate-900/80" imgClassName="max-h-full max-w-full object-contain" />
      <TagChips tags={storeTags({ store: mixedStoreRows(item) })} />
      <CostBadges costs={mixedStoreRows(item).flatMap(storeCostBadges)} small />
    </div>
  );
}

function weaponConfig(legends = []) {
  return {
    queryKey: 'weapon',
    id: (item) => item?.weaponData?.WeaponSkinID,
    defaultSort: 'indexDesc',
    name: weaponDisplayName,
    search: (item, langs) => [
      weaponDisplayName(item, langs),
      item?.weaponData?.WeaponSkinName,
      item?.weaponData?.WeaponSkinID,
      item?.weaponData?.BaseWeapon,
      item?.skin?.OwnerHero,
      ...mixedStoreRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label, row.Rarity].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.skin?.promo?.StoreName,
      item?.bp?.ID,
      item?.skin?.bp?.ID,
      item?.entitlement?.EntitlementName,
      item?.skin?.entitlement?.EntitlementName,
    ],
    filters: [
      {
        key: 'baseWeapon',
        label: 'Weapons',
        type: 'iconMulti',
        value: (item) => item?.weaponData?.BaseWeapon,
        icon: (value) => `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${value}/1`,
      },
      {
        key: 'ownerHero',
        label: 'Legends',
        type: 'iconMulti',
        value: (item) => item?.skin?.OwnerHero,
        options: (data) => asArray(legends)
          .filter((legend) => data.some((item) => item?.skin?.OwnerHero === legend?.heroData?.HeroName))
          .sort((a, b) => Number(a?.heroData?.ReleaseOrderID || a?.heroData?.HeroID || 0) - Number(b?.heroData?.ReleaseOrderID || b?.heroData?.HeroID || 0))
          .map((legend) => legend?.heroData?.HeroName),
        icon: (value) => legendIconSrc(asArray(legends).find((legend) => legend?.heroData?.HeroName === value)),
      },
      { key: 'cohort', label: 'Cohorts', value: (item) => mixedStoreRows(item).map((row) => row.Cohort) },
      { key: 'rarity', label: 'Rarity', value: (item) => [item?.weaponData?.Rarity, ...mixedStoreRows(item).map((row) => row.Rarity)] },
      { key: 'storeLabel', label: 'Store Label', value: (item) => [item?.weaponData?.Label, item?.promo?.Label, item?.bp?.Label, item?.skin?.promo?.Label, item?.skin?.bp?.Label, ...mixedStoreRows(item).map((row) => row.Label)] },
      { key: 'promoType', label: 'Promo Codes', value: (item) => item?.promo?.Type || item?.skin?.promo?.Type },
      { key: 'chest', label: 'Chests', value: (item) => item?.skin?.chest?.ChanceBoxName },
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item?.bp?.ID || item?.skin?.bp?.ID, options: (data) => [...new Set(data.map((item) => item?.bp?.ID || item?.skin?.bp?.ID).filter(clean))].sort(sortedBattlePassValue) },
      { key: 'storeOnly', label: 'Store Weapons Only', type: 'toggle', value: (item) => mixedStoreRows(item).length > 0 },
      { key: 'entitlement', label: 'DLC Weapons Only', type: 'toggle', value: (item) => !!(item?.entitlement || item?.skin?.entitlement) },
      { key: 'individual', label: 'Individual Weapons Only', type: 'toggle', value: (item) => !item?.skin?.OwnerHero },
    ],
    card: (item, langs) => <WeaponCard item={item} legends={legends} langs={langs} />,
    detail: (item, langs) => (
      <>
        <Header
          title={weaponDisplayName(item, langs)}
          subtitle={item?.weaponData?.WeaponSkinName}
          description={label(mixedStoreRows(item)[0]?.DescriptionKey || item?.weaponData?.DescriptionKey, langs)}
          tags={storeTags({ store: mixedStoreRows(item) })}
        />
        <DetailColumns
          left={<WeaponImagesSection item={item} langs={langs} />}
          right={(
            <>
              <StoreDataSection rows={mixedStoreRows(item)} langs={langs} />
              <FieldGrid data={item?.weaponData} langs={langs} title="Weapon Data" />
              <FieldGrid data={item?.skin?.costumeData} langs={langs} title="Skin Data" exclude={['WeaponSkins']} />
              <FieldGrid data={item?.entitlement || item?.skin?.entitlement} langs={langs} title="Entitlement Data" />
            </>
          )}
        />
      </>
    ),
  };
}

function colorDisplayName(item, langs) {
  return label(item?.colorData?.DisplayNameKey || item?.colorData?.ColorSchemeName, langs);
}

function ColorIcon({ item, className = 'h-32 w-32' }) {
  const bg = hex(item?.colorData?.IndicatorColor, '#334155');
  return (
    <div className={`${className} flex items-center justify-center rounded-xl border border-slate-700 p-3`} style={{ backgroundColor: bg, color: textColor(bg) }}>
      {item?.colorData?.IconName ? (
        <ImageWithLoader src={`${host}/game/getGfx/UI_Icons/${item.colorData.IconName}`} className="h-full w-full bg-transparent" imgClassName="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-lg font-bold">{colorDisplayName(item, {})}</span>
      )}
    </div>
  );
}

function ColorDetailsSection({ item }) {
  const rows = Object.entries(item?.colorData || {}).filter(([key, value]) => key.endsWith('_Swap') && clean(value));
  if (!rows.length) return null;
  return (
    <Section title="Color Details">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.map(([key, value]) => {
          const bg = hex(value);
          return (
            <div key={key} className="rounded-lg border border-slate-700 p-3 text-sm font-bold" style={{ backgroundColor: bg, color: textColor(bg) }}>
              <div className="text-[10px] uppercase opacity-75">{key.replace(/_Swap$/, '')}</div>
              <div>{hex(value)}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ColorExclusionSection({ item, colors, langs }) {
  const names = String(item?.colorData?.ExcludeOpponentTeamColor || '').split(',').map((entry) => entry.trim()).filter(clean);
  if (!names.length) return null;
  const matches = names.map((name) => asArray(colors).find((color) => color?.colorData?.ColorSchemeName === name)).filter(Boolean);
  return (
    <Section title="Opponent Color Exclusion">
      <div className="flex flex-wrap gap-3">
        {matches.length ? matches.map((color) => (
          <div key={color.colorData.ColorSchemeID} className="flex flex-col items-center gap-1">
            <ColorIcon item={color} className="h-20 w-20" />
            <div className="max-w-24 text-center text-xs text-gray-700 dark:text-gray-300">{colorDisplayName(color, langs)}</div>
          </div>
        )) : names.map((name) => <span key={name} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">{name}</span>)}
      </div>
    </Section>
  );
}

function colorConfig(colors = []) {
  return {
    queryKey: 'color',
    id: (item) => item?.colorData?.ColorSchemeID,
    defaultSort: 'indexDesc',
    index: (item) => Number(item?.colorData?.OrderID || item?.ArrayIndex || 0),
    name: colorDisplayName,
    search: (item, langs) => [
      colorDisplayName(item, langs),
      item?.colorData?.ColorSchemeName,
      item?.colorData?.ColorSchemeID,
      item?.colorData?.IconName,
      item?.colorData?.ExcludeOpponentTeamColor,
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.bp?.ID,
      item?.entitlement?.EntitlementName,
    ],
    filters: [
      { key: 'cohort', label: 'Cohorts', value: (item) => asArray(item.store).map((row) => row.Cohort) },
      { key: 'promo', label: 'Promotions', value: (item) => asArray(item.store).map((row) => row.TimedPromotion) },
      { key: 'storeLabel', label: 'Store Label', value: (item) => asArray(item.store).map((row) => row.Label) },
      { key: 'promoType', label: 'Promo Codes', value: (item) => item?.promo?.Type },
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item?.bp?.ID, options: (data) => [...new Set(data.map((item) => item?.bp?.ID).filter(clean))].sort(sortedBattlePassValue) },
      { key: 'storeOnly', label: 'Store Colors Only', type: 'toggle', value: (item) => asArray(item.store).length > 0 },
      { key: 'entitlement', label: 'DLC Colors Only', type: 'toggle', value: (item) => !!item?.entitlement },
    ],
    card: (item, langs) => (
      <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
        <div className="font-semibold text-gray-900 dark:text-white">{colorDisplayName(item, langs)}</div>
        <ColorIcon item={item} className="h-24 w-24" />
        <TagChips tags={storeTags(item)} />
        <CostBadges costs={storeRows(item).flatMap(storeCostBadges)} small />
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={colorDisplayName(item, langs)}
          subtitle={item?.colorData?.ColorSchemeName}
          description={label(storeRows(item)[0]?.DescriptionKey || item?.colorData?.DescriptionKey, langs)}
          hero={<ColorIcon item={item} className="h-28 w-28" />}
          tags={storeTags(item)}
          inlineHero
        />
        <DetailColumns
          left={<ColorDetailsSection item={item} />}
          right={(
            <>
              <ColorExclusionSection item={item} colors={colors} langs={langs} />
              <FieldGrid data={item?.colorData} langs={langs} title="Color Scheme Data" />
              <StoreDataSection rows={storeRows(item)} langs={langs} />
              <FieldGrid data={item?.entitlement} langs={langs} title="Entitlement Data" />
            </>
          )}
        />
      </>
    ),
  };
}

function emojiDisplayName(item, langs) {
  return label(item?.emojiData?.DisplayNameKey || item?.emojiData?.EmojiName, langs);
}

function emojiConfig(emojis = []) {
  return {
    queryKey: 'emoji',
    id: (item) => item?.emojiData?.EmojiID,
    defaultSort: 'indexDesc',
    name: emojiDisplayName,
    search: (item, langs) => [
      emojiDisplayName(item, langs),
      item?.emojiData?.EmojiName,
      item?.emojiData?.EmojiID,
      item?.emojiData?.Category,
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.bp?.ID,
      item?.entitlement?.EntitlementName,
    ],
    filters: [
      {
        key: 'category',
        label: 'Categories',
        type: 'iconMulti',
        value: (item) => item?.emojiData?.Category,
        icon: (value) => {
          const match = asArray(emojis).find((item) => item?.emojiData?.Category === value);
          return match ? `${host}/game/animEmoji/${match.emojiData.EmojiID}` : null;
        },
      },
      { key: 'cohort', label: 'Cohorts', value: (item) => asArray(item.store).map((row) => row.Cohort) },
      { key: 'promo', label: 'Promotions', value: (item) => asArray(item.store).map((row) => row.TimedPromotion) },
      { key: 'storeLabel', label: 'Store Label', value: (item) => asArray(item.store).map((row) => row.Label) },
      { key: 'promoType', label: 'Promo Codes', value: (item) => item?.promo?.Type },
      { key: 'battlePass', label: 'Battle Pass', value: (item) => item?.bp?.ID, options: (data) => [...new Set(data.map((item) => item?.bp?.ID).filter(clean))].sort(sortedBattlePassValue) },
      { key: 'storeOnly', label: 'Store Emojis Only', type: 'toggle', value: (item) => asArray(item.store).length > 0 },
      { key: 'entitlement', label: 'DLC Emojis Only', type: 'toggle', value: (item) => !!item?.entitlement },
      { key: 'bundle', label: 'Bundle Emojis Only', type: 'toggle', value: (item) => storeRows(item).some((row) => row.Type === 'Bundle') },
    ],
    card: (item, langs) => (
      <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
        <div className="font-semibold text-gray-900 dark:text-white">{emojiDisplayName(item, langs)}</div>
        <ImageWithLoader src={`${host}/game/animEmoji/${item?.emojiData?.EmojiID}`} alt={emojiDisplayName(item, langs)} className="h-28 w-28 rounded-xl bg-slate-900/80" imgClassName="max-h-full max-w-full object-contain" />
        <TagChips tags={storeTags(item)} />
        <CostBadges costs={storeRows(item).flatMap(storeCostBadges)} small />
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={emojiDisplayName(item, langs)}
          subtitle={item?.emojiData?.EmojiName}
          description={label(storeRows(item)[0]?.DescriptionKey || item?.emojiData?.DescriptionKey, langs)}
          tags={storeTags(item)}
        />
        <DetailColumns
          left={<Section title="Image Data"><div className="flex min-h-64 items-center justify-center rounded-lg bg-slate-900/80 p-3"><ImageWithLoader src={`${host}/game/animEmoji/${item?.emojiData?.EmojiID}`} className="h-48 w-48 bg-transparent" imgClassName="max-h-full max-w-full object-contain" /></div></Section>}
          right={(
            <>
              <StoreDataSection rows={storeRows(item)} langs={langs} />
              <FieldGrid data={item?.emojiData} langs={langs} title="Emoji Data" />
              <FieldGrid data={item?.entitlement} langs={langs} title="Entitlement Data" />
            </>
          )}
        />
      </>
    ),
  };
}

const resolvedConfigs = {
  avatars: resolvedStoreConfig({ title: 'Avatars', queryKey: 'avatar', type: 'Avatar', dataKey: 'avatarData', idKey: 'AvatarID', nameKey: 'AvatarName', dataTitle: 'Avatar Data', imageTitle: 'Avatar Image', cardImageClassName: 'h-32 w-32', defaultSort: 'indexDesc', rowHeight: 290 }),
  taunts: {
    rowHeight: 305,
    queryKey: 'taunt',
    id: (item) => item?.TauntID || item?.ArrayIndex,
    defaultSort: 'indexDesc',
    name: (item, langs) => label(item?.DisplayNameKey || item?.TauntName, langs),
    search: (item, langs) => [
      item?.TauntName,
      item?.TauntID,
      item?.PowerName,
      item?.RandomPowers,
      label(item?.DisplayNameKey, langs),
      label(item?.DescriptionKey, langs),
      ...storeRows(item).map((row) => [row.StoreName, row.DisplayNameKey, row.DescriptionKey, row.SearchTags, row.Label, row.Rarity].filter(Boolean).join(' ')),
      item?.promo?.StoreName,
      item?.promo?.Type,
      item?.bp?.ID,
      item?.entitlement?.EntitlementName,
      item?.timedEvent?.TimedEventName,
    ],
    filters: [
      { key: 'source', label: 'Source', value: (item) => item.source || (asArray(item.store).length ? 'Store' : 'Data') },
      { key: 'rarity', label: 'Rarity', value: (item) => asArray(item.store).map((row) => row.Rarity) },
      { key: 'team', label: 'Team Taunt', value: (item) => item?.powerData?.TeamTauntPower ? 'Team Taunt' : 'Solo Taunt' },
      { key: 'event', label: 'Timed Event', value: (item) => item?.timedEvent?.TimedEventName },
      { key: 'type', label: 'Taunt Type', value: (item) => item?.promo?.Type || item?.bp?.ID || item?.entitlement?.EntitlementName },
      { key: 'storeOnly', label: 'Store Taunts Only', type: 'toggle', value: (item) => asArray(item.store).length > 0 },
    ],
    card: (item, langs) => (
      <div className="flex w-full flex-col items-center justify-start gap-3 text-center">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">{label(item?.DisplayNameKey || item?.TauntName, langs)}</div>
        </div>
        <div className="flex w-full justify-center">
          <ItemThumb entry={{ type: 'Taunt', resolved: item, item: item?.TauntName }} langs={langs} />
        </div>
        <CostBadges costs={storeRows(item).flatMap(storeCostBadges)} small />
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item?.DisplayNameKey || item?.TauntName, langs)}
          subtitle={item?.TauntName}
          description={label(item?.DescriptionKey, langs)}
        />
        <DetailColumns
          left={<TauntAnimationSection item={item} langs={langs} />}
          right={(
            <>
              <StoreDataSection rows={storeRows(item)} langs={langs} />
              <FieldGrid data={item} langs={langs} title="Taunt Data" exclude={['store', 'promo', 'bp', 'entitlement', 'timedEvent', 'powerData']} />
              <FieldGrid data={item?.powerData} langs={langs} title="Power Data" />
            </>
          )}
        />
      </>
    ),
  },
  podiums: resolvedStoreConfig({ title: 'Podiums', queryKey: 'podium', type: 'Podium', dataKey: 'podiumData', idKey: 'PodiumID', nameKey: 'PodiumName', dataTitle: 'Podium Data', imageTitle: 'Animation Data', cardImageClassName: 'h-44 w-44', rowHeight: 345, animationSection: (item, langs) => <PodiumAnimationSection item={item} langs={langs} /> }),
  ui: resolvedStoreConfig({ title: 'UI Themes', queryKey: 'theme', type: 'PlayerTheme', dataKey: 'themeData', idKey: 'PlayerThemeID', nameKey: 'PlayerThemeName', dataTitle: 'UI Theme Data', imageTitle: 'Image Data', rowHeight: 260 }),
  companions: {
    ...resolvedStoreConfig({
    title: 'Companions',
    queryKey: 'companion',
    type: 'Companion',
    dataKey: 'companionData',
    idKey: 'CompanionID',
    nameKey: 'CompanionName',
    dataTitle: 'Companion Data',
    imageTitle: 'Animation Data',
    cardImageClassName: 'h-32 w-32',
    rowHeight: 290,
    extraFilters: [
      { key: 'chest', label: 'Chest', value: (item) => item?.chest?.ChanceBoxName },
      { key: 'event', label: 'Timed Event', value: (item) => item?.timedEvent?.TimedEventName },
    ],
    animationSection: (item, langs) => <CompanionAnimationSection item={item} langs={langs} />,
    }),
    detail: (item, langs) => (
      <>
        <Header
          title={label(item?.companionData?.DisplayNameKey || item?.companionData?.CompanionName, langs)}
          subtitle={item?.companionData?.CompanionName}
          description={label(item?.companionData?.DescriptionKey, langs)}
        />
        <DetailColumns
          left={<CompanionAnimationSection item={item} langs={langs} />}
          right={(
            <>
              <StoreDataSection rows={storeRows(item)} langs={langs} />
              <CompanionTraitsSection item={item} />
              <FieldGrid
                data={item?.companionData}
                langs={langs}
                title="Companion Data"
                exclude={companionTraitDefinitions.map(([key]) => key)}
              />
            </>
          )}
        />
      </>
    ),
  },
  sidekicks: resolvedStoreConfig({
    title: 'Sidekicks',
    queryKey: 'sidekick',
    type: 'SpawnBot',
    dataKey: 'spawnBotData',
    idKey: 'SpawnBotID',
    nameKey: 'SpawnBotName',
    dataTitle: 'Sidekick Data',
    imageTitle: 'Animation Data',
    cardImageClassName: 'h-32 w-32',
    rowHeight: 290,
    animationSection: (item, langs) => <SimpleAnimationSection src={`${host}/game/anim/spawnbot/${item?.spawnBotData?.SpawnBotID}/Animation_Robot/a__AnimationRobot/Ready/all`} alt={label(item?.spawnBotData?.DisplayNameKey || item?.spawnBotData?.SpawnBotName, langs)} />,
  }),
  koeffects: resolvedStoreConfig({
    title: 'KO Effects',
    queryKey: 'koeffect',
    type: 'KOEffect',
    dataKey: 'koEffectData',
    idKey: 'TrailEffectID',
    nameKey: 'TrailEffectName',
    dataTitle: 'KO Effect Data',
    imageTitle: 'Animation Data',
    cardImageClassName: 'h-32 w-32',
    rowHeight: 290,
    animationSection: (item, langs) => <SimpleAnimationSection src={`${host}/game/animTrail/${item?.koEffectData?.TrailEffectID}`} alt={label(item?.koEffectData?.DisplayNameKey || item?.koEffectData?.TrailEffectName, langs)} />,
  }),
  smokeTrails: resolvedStoreConfig({
    title: 'Smoke Trails',
    queryKey: 'smoketrail',
    type: 'EmitterGroup',
    dataKey: 'emitterTrailData',
    idKey: 'EmitterGroupID',
    nameKey: 'EmitterGroupName',
    dataTitle: 'Smoke Trail Data',
    imageTitle: 'Animation Data',
    cardImageClassName: 'h-32 w-32',
    rowHeight: 290,
    animationSection: (item, langs) => <SmokeTrailAnimationSection item={item} langs={langs} />,
  }),
  titles: resolvedStoreConfig({ title: 'Titles', queryKey: 'title', type: 'Moniker', dataKey: 'monikerData', idKey: 'MonikerID', nameKey: 'MonikerName', displayKey: 'DisplayNameKey', descriptionKey: 'DescriptionKey', dataTitle: 'Title Data', cardClassName: 'p-2 pt-8 min-h-0', badgeClassName: 'absolute left-1/2 top-1.5 z-10 -translate-x-1/2 pointer-events-none', rowHeight: 135 }),
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
  return rewardConditions(reward)[0] || '';
}

function rewardConditions(reward) {
  const data = reward?.rewardData || {};
  return [
    clean(data.InfluenceThreshold) && Number(data.InfluenceThreshold) > 0 ? `${Number(data.InfluenceThreshold).toLocaleString()} influence XP` : '',
    String(data.ForWinningFaction).toLowerCase() === 'true' ? 'Faction win reward' : '',
    String(data.ForLosingFaction).toLowerCase() === 'true' ? 'Participation reward' : '',
  ].filter(Boolean);
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

function formatUnixDateTime(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Date(parsed * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function battlePassReleaseInfo(pass) {
  const data = pass?.battlePassData || {};
  return {
    patch: pass?.release?.patch || data.SegmentStartedPatch || data.SourcePatch || '',
    date: pass?.release?.date || data.SegmentStartedDate || data.SourceDate || '',
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

function RewardStrip({ rewards, langs, renderThumb }) {
  const visible = asArray(rewards).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {visible.map((reward, index) => (
        <div key={itemKey(reward, index)} className={itemType(reward) === 'PlayerTheme' ? 'w-full' : 'max-w-32'}>
          {renderThumb ? renderThumb(reward) : <ItemThumb entry={reward} langs={langs} small={itemType(reward) !== 'PlayerTheme'} />}
          <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">{itemLabel(reward, langs)}</div>
          {rewardConditions(reward).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {rewardConditions(reward).map((condition) => (
                <span key={condition} className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">{condition}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SkirmishRewardThumb({ reward, langs }) {
  if (itemType(reward) === 'PlayerTheme') {
    return <UiThemePieces entry={reward} />;
  }
  return <ItemThumb entry={reward} langs={langs} small />;
}

function factionRewards(item, factionName) {
  return asArray(item.rewards).filter((reward) => !factionName || reward.rewardData?.ForFaction === factionName);
}

function factionLabel(faction, langs) {
  return label(faction?.DisplayNameKey || faction?.FactionName, langs);
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

export function SkinMetadataStoreView({ skins, legends, langs }) {
  const config = useMemo(() => skinConfig(legends), [legends]);
  return <DatabaseView title="Skins" items={skins} langs={langs} config={config} />;
}

export function WeaponMetadataStoreView({ weapons, legends, langs }) {
  const data = useMemo(() => asArray(weapons).map((item, index) => ({ ...item, ArrayIndex: item?.ArrayIndex ?? index })), [weapons]);
  const config = useMemo(() => weaponConfig(legends), [legends]);
  return <DatabaseView title="Weapon Skins" items={data} langs={langs} config={config} />;
}

export function ColorSchemeMetadataStoreView({ colors, langs }) {
  const data = useMemo(() => asArray(colors).map((item) => ({ ...item, store: storeRows(item) })), [colors]);
  const config = useMemo(() => colorConfig(data), [data]);
  return <DatabaseView title="Colors" items={data} langs={langs} config={config} />;
}

export function EmojiMetadataStoreView({ emojis, langs }) {
  const data = useMemo(() => asArray(emojis).map((item) => ({ ...item, store: storeRows(item) })), [emojis]);
  const config = useMemo(() => emojiConfig(data), [data]);
  return <DatabaseView title="Emojis" items={data} langs={langs} config={config} />;
}

export function AvatarMetadataStoreView({ avatars, langs }) {
  return <DatabaseView title="Avatars" items={avatars} langs={langs} config={resolvedConfigs.avatars} />;
}

export function TauntMetadataStoreView({ taunts, langs }) {
  return <DatabaseView title="Taunts" items={taunts} langs={langs} config={resolvedConfigs.taunts} />;
}

export function PodiumMetadataStoreView({ podiums, langs }) {
  return <DatabaseView title="Podiums" items={podiums} langs={langs} config={resolvedConfigs.podiums} />;
}

export function UIThemeMetadataStoreView({ themes, langs }) {
  return <DatabaseView title="UI Themes" items={themes} langs={langs} config={resolvedConfigs.ui} />;
}

export function CompanionMetadataStoreView({ companions, langs }) {
  return <DatabaseView title="Companions" items={companions} langs={langs} config={resolvedConfigs.companions} />;
}

export function SpawnBotMetadataStoreView({ spawnbots, langs }) {
  return <DatabaseView title="Sidekicks" items={spawnbots} langs={langs} config={resolvedConfigs.sidekicks} />;
}

export function KOEffectMetadataStoreView({ koEffects, langs }) {
  return <DatabaseView title="KO Effects" items={koEffects} langs={langs} config={resolvedConfigs.koeffects} />;
}

export function SmokeTrailMetadataStoreView({ smokeTrails, langs }) {
  return <DatabaseView title="Smoke Trails" items={smokeTrails} langs={langs} config={resolvedConfigs.smokeTrails} />;
}

export function TitlesMetadataStoreView({ titles, langs }) {
  return <DatabaseView title="Titles" items={titles} langs={langs} config={resolvedConfigs.titles} />;
}

const metadataTypeConfigs = {
  missions: {
    title: 'Missions',
    file: 'MissionTypes.xml',
    maxColumns: 2,
    rowHeight: 210,
    rowHeightMobile: 190,
    cardClassName: 'p-3 pt-9 min-h-40 sm:p-4 sm:pt-10',
    badgeClassName: 'absolute left-2 top-2 z-10 pointer-events-none',
    id: (item) => item.MissionID,
    name: (item, langs) => label(item.DescriptionKey || item.MissionName, langs) || item.MissionName,
    search: (item, langs) => [item.MissionName, item.Category, item.Sets, label(item.DescriptionKey, langs), label(item.ToolTipKey, langs), metadataEvents(item).map((event) => event.value).join(' ')],
    filters: [
      { key: 'category', label: 'Category', value: (item) => item.Category },
      { key: 'sets', label: 'Sets', value: (item) => String(item.Sets || '').split(',') },
      { key: 'reward', label: 'Reward Type', value: (item) => metadataRewards(item).map((reward) => reward.key.replace(/^Reward/, '')) },
      { key: 'autoStart', label: 'Auto Start', type: 'toggle', value: (item) => String(item.AutoStart).toLowerCase() === 'true' },
      { key: 'newPlayers', label: 'Hidden From New Players', type: 'toggle', value: (item) => String(item.NotForNewPlayers).toLowerCase() === 'true' },
    ],
    card: (item, langs) => (
      <div className="relative flex h-full flex-col justify-start text-left">
        <MetadataRewardCorner item={item} />
        <div className="pr-28 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{item.Category || 'Mission'}</div>
        <div className="mt-1 font-semibold leading-tight text-gray-900 dark:text-white">{label(item.DescriptionKey || item.MissionName, langs)}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.MissionName}</div>
        <div className="mt-3"><MetadataQuickStats rows={[{ label: 'Goal', value: item.SuccessCount }]} /></div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.DescriptionKey || item.MissionName, langs)} subtitle={item.MissionName} description={label(item.ToolTipKey, langs)} badges={[item.Category, item.Sets]} />
        <DetailColumns
          left={<><Section title="Rewards"><MetadataRewardSummary item={item} /></Section><MetadataQuickStats rows={[{ label: 'Success Count', value: item.SuccessCount }, { label: 'Ranked Points', value: item.RewardRankedPoints }]} /><MetadataEventList events={metadataEvents(item)} /><MetadataRewardList rewards={metadataRewards(item)} /></>}
          right={<><MetadataEventList title="Checklist Text" events={metadataCheckList(item)} /><FieldGrid data={item} langs={langs} title="Mission Data" exclude={['DescriptionKey', 'ToolTipKey', ...metadataEvents(item).map((event) => event.key), ...metadataCheckList(item).map((event) => event.key)]} /></>}
        />
      </>
    ),
  },
  achievements: {
    title: 'Achievements',
    file: 'AchievementTypes.xml',
    maxColumns: 2,
    rowHeight: 190,
    rowHeightMobile: 170,
    cardClassName: 'p-3 min-h-36 sm:p-4',
    id: (item) => item.AchievementID,
    name: (item) => item.AchievementName,
    search: (item) => [item.AchievementName, item.SteamLinkageName, metadataEvents(item).map((event) => event.value).join(' ')],
    filters: [
      { key: 'offline', label: 'Tracks Offline', type: 'toggle', value: (item) => String(item.TrackOffline).toLowerCase() === 'true' },
      { key: 'completeAtOnce', label: 'Complete At Once', type: 'toggle', value: (item) => String(item.CompleteAtOnce).toLowerCase() === 'true' },
      { key: 'bool', label: 'Boolean Completion', type: 'toggle', value: (item) => String(item.CompleteAsBool).toLowerCase() === 'true' },
    ],
    card: (item) => (
      <div className="flex h-full flex-col justify-start text-left">
        <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Steam</div>
        <div className="mt-1 font-semibold text-gray-900 dark:text-white">{item.AchievementName}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-words">{item.SteamLinkageName}</div>
        <div className="mt-3"><MetadataQuickStats rows={[{ label: 'Goal', value: item.SuccessCount }, { label: 'Events', value: metadataEvents(item).length }]} /></div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={item.AchievementName} subtitle={item.SteamLinkageName} badges={['Steam achievement']} />
        <DetailColumns
          left={<><Section title="Steam"><SteamAchievementLink item={item} /></Section><MetadataQuickStats rows={[{ label: 'Success Count', value: item.SuccessCount }, { label: 'Events', value: metadataEvents(item).length }]} /><MetadataEventList events={metadataEvents(item)} /></>}
          right={<FieldGrid data={item} langs={langs} title="Achievement Data" exclude={metadataEvents(item).map((event) => event.key)} />}
        />
      </>
    ),
  },
  tournamentEvents: {
    title: 'Tournament Events',
    file: 'TournamentEventTypes.xml',
    virtual: false,
    gridClassName: 'grid grid-cols-1 items-start gap-3 xl:grid-cols-2',
    cardClassName: 'p-3 min-h-0 sm:p-4',
    id: (item) => item.TournamentEventID || item.Title,
    name: (item) => item.Title,
    search: (item) => [item.Title, item.Location, item.PrizeType, item.PrizePool, item.RegistrationURL, item.LiveStreamURL],
    filters: [
      { key: 'location', label: 'Location', value: (item) => item.Location },
      { key: 'prizeType', label: 'Prize Type', value: (item) => item.PrizeType },
      { key: 'official', label: 'Official', type: 'toggle', value: (item) => String(item.IsOfficial).toLowerCase() === 'true' },
      { key: 'featured', label: 'Featured', type: 'toggle', value: (item) => String(item.IsFeatured).toLowerCase() === 'true' },
      { key: 'pinned', label: 'Pinned', type: 'toggle', value: (item) => String(item.IsPinned).toLowerCase() === 'true' },
    ],
    card: (item) => (
      <div className="flex h-full flex-col gap-3 text-left sm:flex-row">
        <OptionalImageBlock src={metadataAssetImageSrc(item.__assets?.icon) || metadataImage(item.IconImageName, ['events', 'UI', 'tournaments', 'thumbnails'])} imageClassName="h-20 w-20 shrink-0 rounded-lg bg-slate-900/80" small />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 dark:text-white">{item.Title}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.Location}</div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
            <div><span className="font-black text-gray-900 dark:text-white">Starts:</span> {formatUnixDateTime(item.StartTime)}</div>
            <div><span className="font-black text-gray-900 dark:text-white">Stream:</span> {formatUnixDateTime(item.StreamTime)}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {metadataUrl(item.RegistrationURL) && <a href={item.RegistrationURL} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="rounded-lg bg-blue-500 px-3 py-1 text-xs font-black text-white hover:bg-blue-400">Register</a>}
            {metadataUrl(item.LiveStreamURL) && <a href={item.LiveStreamURL} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="rounded-lg bg-purple-500 px-3 py-1 text-xs font-black text-white hover:bg-purple-400">Stream</a>}
          </div>
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={item.Title} subtitle={item.Location} badges={[item.IsOfficial === 'true' ? 'Official' : null, item.IsFeatured === 'true' ? 'Featured' : null, item.IsPinned === 'true' ? 'Pinned' : null]} />
        <DetailColumns
          left={<><MetadataImageCard src={metadataAssetImageSrc(item.__assets?.icon) || metadataImage(item.IconImageName, ['events', 'UI', 'tournaments', 'thumbnails'])} label="Icon" /><Section title="Schedule"><MetadataQuickStats rows={[{ label: 'Registration Ends', value: formatUnixDateTime(item.RegistrationEnds) }, { label: 'Starts', value: formatUnixDateTime(item.StartTime) }, { label: 'Stream', value: formatUnixDateTime(item.StreamTime) }, { label: 'Ends', value: formatUnixDateTime(item.EndTime) }]} /></Section></>}
          right={<><MetadataLinkCards rows={[['Registration', item.RegistrationURL], ['Live Stream', item.LiveStreamURL]]} /><FieldGrid data={item} langs={langs} title="Tournament Data" exclude={['__assets']} /></>}
        />
      </>
    ),
  },
  splashArts: {
    title: 'Splash Arts',
    file: 'SplashArtTypes.xml',
    id: (item) => item.SplashArtID,
    name: (item, langs) => label(item.UITextHeaderKey || item.SplashArtName, langs),
    search: (item, langs) => [item.SplashArtName, item.AnimRig, item.AnimCustomArt, label(item.UITextHeaderKey, langs), label(item.UITextFooterKey, langs)],
    filters: [
      { key: 'rig', label: 'Animation Rig', value: (item) => item.AnimRig },
      { key: 'customArt', label: 'Custom Art', value: (item) => item.AnimCustomArt },
      { key: 'hideButton', label: 'Hides Button', type: 'toggle', value: (item) => String(item.ShouldHideButton).toLowerCase() === 'true' },
    ],
    card: (item, langs) => (
      <div className="flex h-full flex-col justify-start text-center">
        {item.__assets?.animation?.exists && (
          <div className="mb-3 flex h-36 items-center justify-center rounded-xl bg-slate-950/80 p-2">
            <ImageWithLoader
              src={metadataRigSrc('splash', item.AnimRig, 'Ready', item.AnimCustomArt || item.SplashArtName)}
              className="h-full w-full"
              imgClassName="max-h-full max-w-full object-contain"
              small
            />
          </div>
        )}
        <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{item.__assets?.animation?.exists ? 'Animation Found' : 'Animation Missing'}</div>
        <div className="mt-1 font-semibold text-gray-900 dark:text-white">{label(item.UITextHeaderKey || item.SplashArtName, langs)}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.SplashArtName}</div>
        <div className="mt-2 text-[11px] text-slate-400 break-words">{item.AnimRig}</div>
        <TagChips tags={[item.AnimCustomArt, item.ShouldHideButton === 'True' ? 'Hidden Button' : null]} />
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.UITextHeaderKey || item.SplashArtName, langs)} subtitle={item.SplashArtName} description={label(item.UITextFooterKey, langs)} badges={[item.AnimCustomArt, item.ShouldHideButton === 'True' ? 'Hidden Button' : null]} />
        <DetailColumns
          left={<><MetadataRigPreview kind="splash" asset={item.__assets?.animation} customArt={item.AnimCustomArt || item.SplashArtName} title="Splash Art Preview" className="min-h-80" /><MetadataAnimationFiles asset={item.__assets?.animation} title="Splash Animation Rig" /><Section title="Text"><FieldCards rows={[['Header', label(item.UITextHeaderKey, langs)], ['Footer', label(item.UITextFooterKey, langs)]].filter(([, value]) => clean(value))} /></Section></>}
          right={<FieldGrid data={item} langs={langs} title="Splash Art Data" exclude={['__assets']} />}
        />
      </>
    ),
  },
  music: {
    title: 'Music',
    file: 'MusicTypes.xml',
    id: (item) => item.MusicID,
    name: (item) => item.DisplayName || item.MusicName,
    search: (item) => [item.DisplayName, item.MusicName, item.SoundBank, item.StartEvent, item.StopEvent],
    filters: [
      { key: 'bank', label: 'Sound Bank', value: (item) => item.SoundBank },
      { key: 'hasEvents', label: 'Has Events', type: 'toggle', value: (item) => clean(item.StartEvent) || clean(item.StopEvent) },
    ],
    card: (item) => (
      <div className="flex h-full flex-col justify-start text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Music</div>
        <div className="mt-1 font-semibold text-gray-900 dark:text-white">{item.DisplayName || item.MusicName}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-words">{item.SoundBank}</div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={item.DisplayName || item.MusicName} subtitle={item.MusicName} badges={[item.SoundBank]} description="Playback needs an audio extraction endpoint before this can stream in-site." />
        <DetailColumns
          left={<Section title="Playback"><div className="rounded-lg bg-slate-950/70 border border-slate-700 p-4 text-sm text-slate-300">Audio metadata is available, but no decrypted playable audio file is exposed by the API yet.</div></Section>}
          right={<FieldGrid data={item} langs={langs} title="Music Data" />}
        />
      </>
    ),
  },
  helpfulHints: {
    title: 'Helpful Hints',
    file: 'HelpfulhintsTypes.xml',
    maxColumns: 2,
    rowHeight: 170,
    rowHeightMobile: 155,
    cardClassName: 'p-3 min-h-32 sm:p-4',
    id: (item) => item.HelpfulHintID || item.HelpfulhintsName,
    name: (item, langs) => label(item.DescriptionKey || item.HelpfulhintsName, langs),
    search: (item, langs) => [item.HelpfulhintsName, item.Category, item.PlatformRequirements, label(item.DescriptionKey, langs)],
    filters: [
      { key: 'category', label: 'Category', value: (item) => String(item.Category || '').split(',') },
      { key: 'platform', label: 'Platform', value: (item) => String(item.PlatformRequirements || '').split(',') },
      { key: 'weighted', label: 'Weighted', type: 'toggle', value: (item) => Number(item.Weight || 0) > 0 },
    ],
    card: (item, langs) => (
      <div className="relative flex h-full flex-col justify-start pr-24 text-left">
        <div className="absolute right-2 top-2 rounded-lg border border-slate-600 bg-slate-950/70 px-2 py-1 text-right text-[10px] font-black leading-tight text-slate-100">
          {clean(item.Weight) && <div>Weight {item.Weight}</div>}
          {(clean(item.MinLevel) || clean(item.MaxLevel)) && <div>Lv {item.MinLevel || '?'}-{item.MaxLevel || '?'}</div>}
        </div>
        <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{item.Category}</div>
        <div className="mt-1 font-semibold leading-tight text-gray-900 dark:text-white">{label(item.DescriptionKey || item.HelpfulhintsName, langs)}</div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.DescriptionKey || item.HelpfulhintsName, langs)} subtitle={item.HelpfulhintsName} badges={[item.Category, item.PlatformRequirements]} />
        <DetailColumns
          left={<Section title="Hint Text"><div className="rounded-lg bg-slate-950/70 border border-slate-700 p-4 text-lg font-bold text-white">{label(item.DescriptionKey, langs)}</div></Section>}
          right={<FieldGrid data={item} langs={langs} title="Helpful Hint Data" />}
        />
      </>
    ),
  },
  guildMissions: {
    title: 'Guild Missions',
    file: 'GuildMissionTypes.xml',
    maxColumns: 2,
    rowHeight: 330,
    rowHeightMobile: 315,
    cardClassName: 'p-3 pt-9 min-h-48 sm:p-4 sm:pt-10',
    badgeClassName: 'absolute left-2 top-2 z-10 pointer-events-none',
    transformItems: guildMissionGroups,
    id: (item) => item.GuildMissionID,
    name: (item, langs) => label(item.DescriptionKey || item.GuildMissionName, langs),
    search: (item, langs) => [item.GuildMissionName, item.Group, item.FollowUp, label(item.DescriptionKey, langs), label(item.ToolTipKey, langs), label(item.LobbyDescription, langs), asArray(item.__tiers).map((tier) => tier.GuildMissionName).join(' '), metadataEvents(item).map((event) => event.value).join(' ')],
    filters: [
      { key: 'group', label: 'Group', value: (item) => item.Group },
      { key: 'bottom', label: 'Bottom Mission', type: 'toggle', value: (item) => String(item.BottomMission).toLowerCase() === 'true' },
      { key: 'futureCredit', label: 'Future Credit', type: 'toggle', value: (item) => clean(item.GetIndividualCreditForFutureMissions) },
    ],
    card: (item, langs) => (
      <div className="relative flex h-full flex-col justify-start text-left">
        <MetadataRewardCorner item={item.__rewardTotals || item} guild />
        <div className="pr-32 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Group {item.Group}</div>
        <div className="mt-1 font-semibold text-gray-900 dark:text-white">{label(item.DescriptionKey || item.GuildMissionName, langs)}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.__tierCount || 1} tier{(item.__tierCount || 1) === 1 ? '' : 's'}</div>
        <div className="mt-2 grid grid-cols-1 gap-1">
          {asArray(item.__tiers || [item]).map((tier, index) => (
            <div key={tier.GuildMissionName || index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-bold text-gray-700 dark:bg-slate-900 dark:text-gray-200">
              <span>Tier {index + 1}</span>
              <span className="text-center">{Number(tier.SuccessCount || 0).toLocaleString()} goal</span>
              <span className="text-right">
                {missionRewardBadges(tier, true).map((reward) => `${Number(reward.value).toLocaleString()} ${reward.label}`).join(' / ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={label(item.DescriptionKey || item.GuildMissionName, langs)} subtitle={item.GuildMissionName} description={label(item.ToolTipKey, langs)} badges={[`Group ${item.Group}`, item.BottomMission === 'True' ? 'Bottom Mission' : null]} />
        <DetailColumns
          left={<><Section title="Tiers"><div className="space-y-3">{asArray(item.__tiers || [item]).map((tier, index) => <div key={tier.GuildMissionName || index} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-black uppercase tracking-wide text-blue-300">Tier {index + 1}</div><div className="text-sm font-bold text-white">{tier.GuildMissionName}</div></div><MetadataRewardSummary item={tier} guild /></div><MetadataQuickStats rows={[{ label: 'Success Count', value: tier.SuccessCount }, { label: 'Future Credit', value: tier.GetIndividualCreditForFutureMissions }]} /></div>)}</div></Section><MetadataEventList events={metadataEvents(item)} /></>}
          right={<FieldGrid data={item} langs={langs} title="Guild Mission Data" exclude={['__tiers', '__tierCount', '__lastTier', '__rewardTotals', ...metadataEvents(item).map((event) => event.key)]} />}
        />
      </>
    ),
  },
  clientThemes: {
    title: 'Client Themes',
    file: 'ClientThemeTypes.xml',
    id: (item) => item.ClientThemeID,
    name: (item) => item.ClientThemeName,
    search: (item) => [item.ClientThemeName, item.AnimRig, item.AnimCustomArt, item.BackgroundArt, item.SplashArtTypeName, item.MainMenuMusic, item.CharSelectMusic, item.WinThemeMusic, item.FeaturedStoreTypes],
    filters: [
      { key: 'rig', label: 'Animation Rig', value: (item) => item.AnimRig },
      { key: 'splash', label: 'Splash Art', value: (item) => item.SplashArtTypeName },
      { key: 'music', label: 'Menu Music', value: (item) => item.MainMenuMusic },
      { key: 'hasBg', label: 'Has Background', type: 'toggle', value: (item) => clean(item.BackgroundArt) },
      { key: 'hasStore', label: 'Featured Store', type: 'toggle', value: (item) => clean(item.FeaturedStoreTypes) },
    ],
    card: (item) => (
      <div className="flex h-full flex-col justify-start text-center">
        <OptionalImageBlock
          src={[
            item.__assets?.logoAnimation?.exists && metadataRigSrc('clienttheme', item.AnimRig, 'Ready', item.AnimCustomArt),
            metadataAssetImageSrc(item.__assets?.backgroundArt),
            ...asArray(metadataImage(item.BackgroundArt, ['UI'])),
          ]}
          imageClassName="mb-3 h-28 w-full rounded-lg bg-slate-900/80"
          imgClassName="max-h-full max-w-full object-contain"
          small
        />
        <div className="font-semibold text-gray-900 dark:text-white">{item.ClientThemeName}</div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.AnimCustomArt || item.AnimRig}</div>
        <TagChips tags={[item.SplashArtTypeName, item.MainMenuMusic]} />
      </div>
    ),
    detail: (item, langs) => (
      <>
        <Header title={item.ClientThemeName} subtitle={item.AnimCustomArt || item.AnimRig} badges={[item.SplashArtTypeName, item.SplashArtUIScreen, item.HolidayRibbonLabel]} />
        <DetailColumns
          left={<><MetadataThemeBackground asset={item.__assets?.backgroundArt} /><MetadataRigPreview kind="clienttheme" asset={item.__assets?.logoAnimation} customArt={item.AnimCustomArt} title="Logo Preview" className="min-h-64" /><MetadataAnimationFiles asset={item.__assets?.logoAnimation} title="Logo Animation Rig" /><Section title="Music"><FieldCards rows={[['Main Menu', item.MainMenuMusic], ['Character Select', item.CharSelectMusic], ['Win Theme', item.WinThemeMusic], ['Welcome Announcer', item.WelcomeAnnouncer]].filter(([, value]) => clean(value))} /></Section></>}
          right={<><MetadataGfxAssetGrid title="Main Menu Buttons" assets={item.__assets?.buttons} /><MetadataGfxAssetGrid title="Login Bonus Assets" assets={[{ field: 'LoginBonusFrame', asset: item.__assets?.loginBonus?.frame }, { field: 'LoginBonusIconAnimation', asset: item.__assets?.loginBonus?.iconAnimation }]} /><MetadataGfxAssetGrid title="Theme Accent Assets" assets={[{ field: 'TileAccent', asset: item.__assets?.tileAccent }, { field: 'MainMenuAccent', asset: item.__assets?.mainMenuAccent }]} /><MetadataAssetGrid title="Background Clouds" assets={[{ field: 'BackgroundClouds', asset: item.__assets?.backgroundClouds }]} /><Section title="Featured Store"><TagChips tags={String(item.FeaturedStoreTypes || '').split(',')} /></Section><FieldGrid data={item} langs={langs} title="Client Theme Data" exclude={['__assets']} /></>}
        />
      </>
    ),
  },
};

function shouldHideTemplateRecord(row) {
  const name = String(row?.MissionName || row?.AchievementName || row?.SplashArtName || row?.HelpfulhintsName || row?.GuildMissionName || row?.ClientThemeName || row?.Title || row?.MusicName || '').toLowerCase();
  return name.includes('template');
}

export function MetadataTypeView({ typeKey, langs }) {
  const config = metadataTypeConfigs[typeKey];
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!config?.file) return;
    setLoading(true);
    fetch(`${host}/game/metadata/Game/${config.file}`)
      .then((res) => res.json())
      .then(setPayload)
      .catch((error) => setPayload({ error: error.message }))
      .finally(() => setLoading(false));
  }, [config?.file]);

  if (!config) {
    return <div className="min-h-screen bg-gray-100 p-4 text-gray-900 dark:bg-slate-900 dark:text-white">Unknown metadata page.</div>;
  }
  if (loading || !payload) {
    return <div className="min-h-screen bg-gray-100 p-4 text-gray-900 dark:bg-slate-900 dark:text-white"><LoadingSpinner /></div>;
  }
  if (payload.error) {
    return <div className="min-h-screen bg-gray-100 p-4 text-red-500 dark:bg-slate-900">{payload.error}</div>;
  }

  const rawItems = asArray(payload.data)
    .map((item, index) => ({ ...item, ArrayIndex: item.ArrayIndex ?? index, metadataPatch: payload.patch, metadataDate: payload.date }))
    .filter((item) => !shouldHideTemplateRecord(item));
  const items = config.transformItems ? config.transformItems(rawItems, langs) : rawItems;

  return <DatabaseView title={config.title} items={items} langs={langs} config={config} />;
}

export function SkirmishStoreView({ skirmishes, langs }) {
  const config = useMemo(() => ({
    id: (item) => item.skirmishData?.SkirmishID,
    defaultSort: 'indexDesc',
    maxColumns: 3,
    rowHeight: 380,
    rowHeightMobile: 330,
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
      const leftFaction = factions[0] || {};
      const rightFaction = factions[1] || {};
      const matchup = [factionLabel(leftFaction, langs), factionLabel(rightFaction, langs)].filter(Boolean).join(' vs ');
      const factionSection = (faction) => {
        const grouped = groupRewards(factionRewards(item, faction.FactionName));
        return (
          <Section key={faction.FactionName} title={factionLabel(faction, langs)}>
            <div className="mb-3 rounded-xl border border-slate-700 p-4" style={{ backgroundColor: hex(faction.FactionColor), color: textColor(faction.FactionColor) }}>
              <FactionFace item={item} faction={faction} langs={langs} large />
            </div>
            <div className="space-y-4">
              {Object.entries(grouped).map(([type, rewards]) => (
                <div key={type}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{typeLabel(type)}</div>
                  <RewardStrip rewards={rewards} langs={langs} renderThumb={(reward) => <SkirmishRewardThumb reward={reward} langs={langs} />} />
                </div>
              ))}
            </div>
          </Section>
        );
      };
      return (
        <>
          <Header title={matchup || item.skirmishData?.SkirmishName} subtitle={item.skirmishData?.SkirmishName} description={label(item.skirmishData?.SkirmishDesc, langs)} />
          <DetailColumns
            left={leftFaction.FactionName ? factionSection(leftFaction) : null}
            right={rightFaction.FactionName ? factionSection(rightFaction) : null}
          />
          <FieldGrid data={item.skirmishData} langs={langs} title="Skirmish Data" />
        </>
      );
    },
  }), []);
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
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedPath, setSelectedPath] = useState('0');
  const [selectedTier, setSelectedTier] = useState(null);
  const urlHydrated = useRef(false);
  const selected = sorted.find((pass) => battlePassKey(pass) === selectedKey) || sorted[0];
  const rewards = asArray(selected?.rewards).filter(validBattlePassReward);
  const paths = useMemo(() => normalizedBattlePassPaths(selected, rewards), [rewards, selected]);
  useEffect(() => {
    if (!sorted.length || urlHydrated.current) return;
    const params = new URLSearchParams(window.location.search);
    const season = params.get('pass');
    const variant = params.get('variant');
    const path = params.get('path');
    const tier = params.get('tier');
    const match = sorted.find((pass) =>
      (!season || String(battlePassNumber(pass)) === String(season)) &&
      (!variant || battlePassVariant(pass) === String(variant).toLowerCase())
    );
    setSelectedKey(battlePassKey(match || sorted[0]));
    if (path) setSelectedPath(path);
    if (tier) setSelectedTier(Number(tier) || null);
    urlHydrated.current = true;
  }, [sorted]);
  useEffect(() => {
    if (!selected || !paths.length) return;
    if (!paths.some((path) => path.path === selectedPath)) setSelectedPath(paths[0]?.path || '0');
  }, [paths, selected, selectedPath]);
  useEffect(() => {
    if (!urlHydrated.current || !selected) return;
    const params = new URLSearchParams(window.location.search);
    params.set('page', pageSlugForTitle('Battle Passes'));
    params.set('pass', String(battlePassNumber(selected)));
    params.set('variant', battlePassVariant(selected));
    if (selectedPath && selectedPath !== '0') params.set('path', selectedPath);
    else params.delete('path');
    if (selectedTier) params.set('tier', String(selectedTier));
    else params.delete('tier');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [selected, selectedPath, selectedTier]);
  const activePath = paths.find((path) => path.path === selectedPath) || paths[0];
  const summary = normalizeBattlePassSummary(selected?.summary, rewards);
  const deluxePurchases = asArray(selected?.deluxePurchases).length ? asArray(selected.deluxePurchases) : uniqueDeluxePurchases(selected);
  const selectedTierData = activePath?.tiers?.find((tier) => Number(tier.tier) === Number(selectedTier));

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-3 text-gray-900 dark:text-white lg:p-4">
      <div className="space-y-4">
        <Section title="Seasons">
          <div className="flex gap-2 overflow-x-auto app-scrollbar pb-2">
          {sorted.map((bp, index) => {
            const release = battlePassReleaseInfo(bp);
            const active = selected === bp;
            return (
              <button
                key={battlePassKey(bp) || index}
                onClick={() => {
                  setSelectedKey(battlePassKey(bp));
                  setSelectedTier(null);
                }}
                className={`${active ? 'border-blue-400 bg-blue-500 text-white shadow-blue-500/20' : 'border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-700'} flex w-64 shrink-0 flex-col rounded-xl border px-3 py-2 text-left shadow-sm transition`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black leading-tight">Battle Pass {battlePassNumber(bp)}</div>
                    <div className="text-xs font-bold opacity-80">{battlePassVariantLabel(bp)}</div>
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
        </Section>
      </div>
      {selected && (
        <div className="mt-4 flex flex-col gap-4">
          <Header
            title={`Battle Pass ${battlePassNumber(selected)}`}
            subtitle={battlePassVariantLabel(selected)}
            badges={[
              `${rewards.length} rewards`,
              `${paths.length} path${paths.length === 1 ? '' : 's'}`,
              deluxePurchases.length && 'Deluxe',
              battlePassReleaseInfo(selected).patch && `Patch ${battlePassReleaseInfo(selected).patch}`,
              battlePassReleaseInfo(selected).date && formatUnixDate(battlePassReleaseInfo(selected).date),
            ]}
          />
          <BattlePassFeaturedRewards pass={selected} langs={langs} />
          <BattlePassSummary summary={summary} langs={langs} />
          {deluxePurchases.length > 0 && (
            <BattlePassDeluxeSection purchases={deluxePurchases} langs={langs} />
          )}
          {paths.length > 1 && (
            <Section title="Paths">
              <div className="flex flex-wrap gap-2">
              {paths.map((pathGroup) => (
                <button
                  key={pathGroup.path}
                  onClick={() => {
                    setSelectedPath(pathGroup.path);
                    setSelectedTier(null);
                  }}
                  className={`${activePath?.path === pathGroup.path ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'} rounded-lg px-4 py-2 text-sm font-bold transition`}
                >
                  {pathGroup.label}
                </button>
              ))}
              </div>
            </Section>
          )}
          {activePath && (
            <Section title={activePath.label}>
              <BattlePassGrid tiers={activePath.tiers} langs={langs} selectedTier={selectedTier} setSelectedTier={setSelectedTier} />
            </Section>
          )}
          {selectedTierData && <BattlePassTierInspector tier={selectedTierData} langs={langs} onClose={() => setSelectedTier(null)} />}
          <RawDataSection data={selected.battlePassData} />
        </div>
      )}
    </div>
  );
}

function battlePassKey(pass) {
  if (!pass) return '';
  return `${battlePassNumber(pass)}-${battlePassVariant(pass)}-${pass?.ArrayIndex ?? pass?.battlePassData?.SourceManifest ?? ''}`;
}

function battlePassVariant(pass) {
  return String(pass?.variant || pass?.battlePassData?.Variant || (isClassicPass(pass) ? 'classic' : 'original')).toLowerCase() === 'classic' ? 'classic' : 'original';
}

function battlePassVariantLabel(pass) {
  return battlePassVariant(pass) === 'classic' ? 'Classic' : 'Original';
}

function normalizedBattlePassPaths(pass, rewards) {
  const apiPaths = asArray(pass?.paths);
  if (apiPaths.length) {
    return apiPaths.map((path) => ({
      ...path,
      path: String(path.path ?? '0'),
      label: path.label || battlePassPathLabel(String(path.path ?? '0'), pass),
      tiers: asArray(path.tiers).map((tier) => ({
        ...tier,
        tier: Number(tier.tier || 0),
        free: asArray(tier.free),
        gold: asArray(tier.gold),
      })).filter((tier) => tier.tier > 0),
    }));
  }
  return battlePassPaths(rewards, pass);
}

function BattlePassDeluxeSection({ purchases, langs }) {
  return (
    <Section title="Deluxe">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {asArray(purchases).map((purchase, index) => {
          const entitlement = purchase.entitlementData || {};
          const items = entitlementItems(purchase);
          return (
            <div key={entitlement.EntitlementName || index} className="rounded-xl border border-gray-200 bg-gray-100 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-black leading-tight text-gray-900 dark:text-white">{label(entitlement.DisplayNameKey || entitlement.EntitlementName, langs)}</div>
                  {entitlement.EntitlementName && <div className="text-xs text-gray-500 dark:text-gray-400">{entitlement.EntitlementName}</div>}
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {clean(entitlement.DeluxeBattlePassTiers) && <SummaryPill label="Tier Skips" value={entitlement.DeluxeBattlePassTiers} />}
                  {clean(entitlement.IncludesRewardsFrom) && <SummaryPill label="Includes" value={entitlement.IncludesRewardsFrom} />}
                </div>
              </div>
              {items.length > 0 && <ItemStrip items={items} langs={langs} small limit={99} />}
              <FieldCards rows={Object.entries(entitlement).filter(([key, value]) => !['DisplayNameKey', 'EntitlementName'].includes(key) && clean(value))} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function BattlePassTierInspector({ tier, langs, onClose }) {
  const rewards = [...asArray(tier.free), ...asArray(tier.gold)];
  return (
    <Section
      title={`Tier ${tier.tier}`}
      action={<button onClick={onClose} className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-bold text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">Close</button>}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TierRewardLane title="Free Pass" rewards={tier.free} langs={langs} tone="free" />
        <TierRewardLane title="Gold Pass" rewards={tier.gold} langs={langs} tone="gold" />
      </div>
      <RawDataSection data={rewards.map((reward) => reward.rewardData || reward)} title="Tier Data" />
    </Section>
  );
}

function TierRewardLane({ title, rewards, langs, tone }) {
  return (
    <div className={`${tone === 'gold' ? 'bg-[#a9772a]' : 'bg-[#405f88]'} rounded-xl border border-slate-950/30 p-3`}>
      <div className="mb-3 text-sm font-black text-white drop-shadow">{title}</div>
      {asArray(rewards).length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {asArray(rewards).map((reward, index) => (
            <BattlePassReward key={reward.rewardData?.RewardID || index} reward={reward} langs={langs} large />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-black/15 p-3 text-sm font-bold text-white/80">No reward on this lane.</div>
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
  const topPieces = [
    { label: 'Nameplate', asset: theme.NameplateAsset },
    { label: 'Killplate', asset: theme.KillplateAsset },
  ].filter((piece) => clean(piece.asset));
  const scoreplate = clean(theme.ScoreplateAsset) ? { label: 'Scoreplate', asset: theme.ScoreplateAsset } : null;
  const pieces = [...topPieces, scoreplate].filter(Boolean);
  if (!pieces.length) return <FeatureThumb entry={entry} small={false} size="supportWide" />;
  const Piece = ({ piece, wide = false }) => (
    <div className={`${wide ? 'w-full' : 'min-w-0 flex-1'} rounded-xl bg-slate-900/80 border border-slate-700 p-2`}>
      <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{piece.label}</div>
      <ImageWithLoader
        src={`${host}/game/getGfx/UI_PlayerThemes/${piece.asset}`}
        alt={piece.label}
        className={`${wide ? 'h-20' : 'h-16'} w-full`}
        imgClassName="max-h-full max-w-full object-contain"
        small
      />
    </div>
  );
  return (
    <div className="flex w-full max-w-full flex-col gap-2">
      {topPieces.length > 0 && (
        <div className="flex w-full gap-2">
          {topPieces.map((piece) => <Piece key={piece.label} piece={piece} />)}
        </div>
      )}
      {scoreplate && <Piece piece={scoreplate} wide />}
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
                      Tier {entry.rewardData.Tier}
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

function normalizeBattlePassSummary(summary, rewards) {
  if (!summary?.free || !summary?.gold || !summary?.all) return battlePassSummary(rewards);
  const convert = (block) => ({
    counts: block.byType || block.counts || {},
    coins: block.totals?.mammothCoins || block.coins || 0,
    xp: block.totals?.battlePassXp || block.xp || 0,
    total: block.totals?.rewards || block.total || 0,
    entries: asArray(block.entries || block.useful).map((entry) => (
      entry?.entry ? entry : {
        entry: {
          type: entry?.type || entry?.rewardData?.Type,
          item: entry?.item || entry?.rewardData?.Item || entry?.rewardData?.Amount,
          resolved: entry?.resolved,
          rewardData: entry?.rewardData,
        },
        count: 1,
        amount: itemType(entry) === 'MammothCoins' || itemType(entry) === 'BattlePassXP' ? num(entry?.amount || entry?.rewardData?.Amount) : 1,
      }
    )),
  });
  return {
    free: convert(summary.free),
    gold: convert(summary.gold),
    all: convert(summary.all),
  };
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
  const visible = sortBattlePassSummaryEntries(collapseColorSchemeSummaryEntries(entries));
  const titleEntries = visible.filter((summary) => itemType(summary.entry) === 'Moniker');
  const iconEntries = visible.filter((summary) => itemType(summary.entry) !== 'Moniker');
  if (!visible.length) return null;
  return (
    <div className="mt-3 space-y-4">
      {titleEntries.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          {titleEntries.map((summary, index) => (
            <BattlePassSummaryTile key={`${itemKey(summary.entry, index)}-title-${index}`} summary={summary} index={index} langs={langs} />
          ))}
        </div>
      )}
      {iconEntries.length > 0 && (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(4rem, 4rem))',
            gridAutoRows: '4rem',
            gridAutoFlow: 'dense',
          }}
        >
          {iconEntries.map((summary, index) => (
            <BattlePassSummaryTile key={`${itemKey(summary.entry, index)}-${index}`} summary={summary} index={index} langs={langs} />
          ))}
        </div>
      )}
    </div>
  );
}

function BattlePassSummaryTile({ summary, index, langs }) {
  const type = itemType(summary.entry);
  const quantity = type === 'MammothCoins' || type === 'BattlePassXP' ? summary.amount : summary.count;
  const tooltipLabel = summary.entry?.__summaryLabel || itemLabel(summary.entry, langs);
  return (
    <Tooltip lines={entryTooltipLines(summary.entry, `${tooltipLabel} (${quantity} total)`)} className={battlePassSummaryTileClass(summary)}>
      <div className="relative flex h-full w-full items-center justify-center">
        <BattlePassSummaryThumb summary={summary} langs={langs} />
        {(quantity > 1 || type === 'ColorScheme') && (
          <div className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">
            {type === 'BattlePassXP' ? `+${quantity}%` : `x${quantity}`}
          </div>
        )}
      </div>
    </Tooltip>
  );
}

function battlePassSummaryTileClass(summary) {
  const type = itemType(summary?.entry);
  if (type === 'Border' || type === 'Podium' || type === 'KOEffect') return 'col-span-2 row-span-3 h-full w-full';
  if (type === 'PlayerTheme') return 'col-span-4 row-span-3 h-full w-full';
  if (type === 'Costume' || summary?.entry?.resolved?.costumeData) return 'col-span-2 row-span-2 h-full w-full';
  if (type === 'Moniker') return 'h-auto w-auto';
  return 'col-span-1 row-span-1 h-full w-full';
}

function battlePassSummaryOrder(summary) {
  const type = itemType(summary?.entry);
  const theme = summary?.entry?.resolved?.themeData || {};
  const rewardItem = String(summary?.entry?.item || summary?.entry?.rewardData?.Item || '').toLowerCase();
  const rewardIcon = String(summary?.entry?.rewardData?.IconName || '').toLowerCase();
  if (type === 'PlayerTheme') {
    if (/nameplate/.test(rewardItem) || clean(theme.NameplateAsset)) return 0;
    if (/killplate/.test(rewardItem) || clean(theme.KillplateAsset)) return 1;
    if (/scoreplate/.test(rewardItem) || clean(theme.ScoreplateAsset)) return 2;
    return 2;
  }
  if (type === 'Podium') return 10;
  if (type === 'Border') return 11;
  if (type === 'KOEffect') return 12;
  if (type === 'Costume') return 20;
  if (type === 'WeaponSkin') return 30;
  if (type === 'Taunt') return 40;
  if (type === 'Moniker') return 50;
  if (type === 'ColorScheme') return 60;
  if (/nameplate/.test(rewardIcon)) return 0;
  if (/killplate/.test(rewardIcon)) return 1;
  if (/scoreplate/.test(rewardIcon)) return 2;
  return 90;
}

function sortBattlePassSummaryEntries(entries) {
  return asArray(entries).slice().sort((a, b) => {
    const orderDiff = battlePassSummaryOrder(a) - battlePassSummaryOrder(b);
    if (orderDiff) return orderDiff;
    return String(itemLabel(a.entry, null)).localeCompare(String(itemLabel(b.entry, null)));
  });
}

function BattlePassSummaryThumb({ summary, langs }) {
  const type = itemType(summary?.entry);
  if (type === 'Podium' || type === 'KOEffect') {
    return <ItemThumb entry={summary.entry} langs={langs} className="h-40 w-28 sm:h-48 sm:w-32" />;
  }
  if (type === 'Costume' || summary?.entry?.resolved?.costumeData) {
    return <ItemThumb entry={summary.entry} langs={langs} className="h-full w-full" />;
  }
  return <ItemThumb entry={summary.entry} small langs={langs} />;
}

function collapseColorSchemeSummaryEntries(entries) {
  const visible = [];
  let colorSummary = null;
  for (const summary of asArray(entries).filter(Boolean)) {
    if (itemType(summary.entry) !== 'ColorScheme') {
      visible.push(summary);
      continue;
    }

    if (!colorSummary) {
      colorSummary = {
        ...summary,
        entry: { ...summary.entry, __summaryLabel: 'Color Schemes' },
        count: 0,
        amount: 0,
      };
      visible.push(colorSummary);
    }
    const count = num(summary.count) || num(summary.amount) || 1;
    colorSummary.count += count;
    colorSummary.amount += count;
  }
  return visible;
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

function BattlePassGrid({ tiers, langs, selectedTier, setSelectedTier }) {
  return (
    <div className="overflow-x-auto app-scrollbar rounded-xl border border-slate-950/30 dark:border-slate-700 bg-[#06213a] shadow-lg">
      <div className="min-w-max">
        <div className="grid" style={{ gridTemplateColumns: `112px repeat(${tiers.length}, 150px)` }}>
          <div className="sticky left-0 z-20 bg-slate-800 text-white font-black text-sm p-3 ring-1 ring-slate-900/70">Tiers</div>
          {tiers.map((tier) => (
            <button
              key={tier.tier}
              onClick={() => setSelectedTier(Number(tier.tier))}
              className={`${Number(selectedTier) === Number(tier.tier) ? 'bg-blue-500' : 'bg-slate-800 hover:bg-slate-700'} text-white font-black text-center text-sm p-3 ring-1 ring-slate-900/70 transition`}
            >
              {tier.tier}
            </button>
          ))}
          <PassLaneLabel label="Free Pass" color="blue" />
          {tiers.map((tier) => <TierCell key={`free-${tier.tier}`} rewards={tier.free} lane="free" langs={langs} active={Number(selectedTier) === Number(tier.tier)} onClick={() => setSelectedTier(Number(tier.tier))} />)}
          <PassLaneLabel label="Gold Pass" color="gold" />
          {tiers.map((tier) => <TierCell key={`gold-${tier.tier}`} rewards={tier.gold} lane="gold" langs={langs} active={Number(selectedTier) === Number(tier.tier)} onClick={() => setSelectedTier(Number(tier.tier))} />)}
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

function TierCell({ rewards, lane, langs, active, onClick }) {
  const oneReward = asArray(rewards).length === 1;
  return (
    <button onClick={onClick} className={`${lane === 'gold' ? 'bg-[#a9772a]' : 'bg-[#405f88]'} ${active ? 'outline outline-2 -outline-offset-2 outline-cyan-300' : ''} min-h-44 p-2 ring-1 ring-slate-900/70 grid ${oneReward ? 'grid-cols-1 place-items-center' : 'grid-cols-2 content-center'} gap-2 text-left transition hover:brightness-110`}>
      {asArray(rewards).map((reward, index) => <BattlePassReward key={reward.rewardData?.RewardID || index} reward={reward} langs={langs} large={oneReward} />)}
    </button>
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
  const [recordSearch, setRecordSearch] = useState('');

  const files = catalog?.sections?.[selectedSection] || [];

  useEffect(() => {
    if (!files.some((file) => file.file === selectedFile)) setSelectedFile(files[0]?.file || '');
  }, [files, selectedFile]);

  useEffect(() => {
    if (!selectedSection || !selectedFile) return;
    setLoading(true);
    setSelectedIndex(0);
    setRecordSearch('');
    fetch(`${host}/game/metadata/${selectedSection}/${selectedFile}`)
      .then((res) => res.json())
      .then(setPayload)
      .catch((error) => setPayload({ error: error.message }))
      .finally(() => setLoading(false));
  }, [selectedSection, selectedFile]);

  const rows = asArray(payload?.data);
  const objectRows = rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const recordQuery = recordSearch.trim().toLowerCase();
  const filteredObjectRows = recordQuery
    ? objectRows.filter((row) => JSON.stringify(row).toLowerCase().includes(recordQuery))
    : objectRows;
  const selectedRow = filteredObjectRows.length ? filteredObjectRows[Math.min(selectedIndex, filteredObjectRows.length - 1)] : null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [recordSearch, selectedSection, selectedFile]);

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
              <pre className="mt-3 max-h-[70vh] overflow-auto app-scrollbar rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs">{JSON.stringify(payload?.data, null, 2)}</pre>
            </details>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-4">
              <select value={selectedIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))} className="md:col-span-2 rounded-md bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-3 py-2 text-sm">
                {filteredObjectRows.map((row, index) => {
                  const key = Object.keys(row).find((field) => /Name$/i.test(field)) || Object.keys(row).find((field) => /ID$/i.test(field)) || Object.keys(row)[0];
                  return <option key={index} value={index}>{String(row[key] || `Row ${index + 1}`)}</option>;
                })}
              </select>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                  placeholder="Search records"
                  className="w-full rounded-md border border-gray-300 bg-gray-100 py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div className="rounded-md bg-gray-100 dark:bg-slate-900 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {filteredObjectRows.length} of {rows.length} rows
              </div>
            </div>
            {selectedRow ? (
              <details className="rounded-xl bg-gray-100 dark:bg-slate-950 p-3">
                <summary className="cursor-pointer select-none text-lg font-bold">Selected Record Raw Data</summary>
                <pre className="mt-3 max-h-[70vh] overflow-auto app-scrollbar rounded-lg bg-gray-100 dark:bg-slate-950 p-3 text-xs">{JSON.stringify(selectedRow, null, 2)}</pre>
              </details>
            ) : (
              <div className="rounded-xl bg-gray-100 p-4 text-sm text-gray-500 dark:bg-slate-950 dark:text-gray-400">No records match that search.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
