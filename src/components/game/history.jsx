import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { host } from '../../stuff';
import { commonPowerFieldMessage, summarizeCommonPowerFields } from './powerHistorySummary';
import PatchNotes, { patchContents, usePatchNotes } from './patchNotes';
import { AsideBox, FactList, LinkList, OnThisPage } from '../ui';

const sectionColors = {
  added: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  changed: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  removed: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

function filePath(file) {
  return `${file.section}/${file.file}`;
}

function patchGroups(patches) {
  const groups = [];
  for (const patch of patches) {
    const name = String(patch.patch || 'Unknown');
    const last = groups[groups.length - 1];
    if (last && last.patch === name) last.manifests.push(patch);
    else groups.push({ patch: name, manifests: [patch] });
  }
  return groups;
}

function manifestLabel(group, index) {
  const releaseIndex = group.manifests.length - 1;
  return index === releaseIndex ? 'Release' : `Hotfix ${releaseIndex - index}`;
}

function readPatchParams() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return { patch: params.get('patch') || '', from: params.get('from') || '', view: params.get('view') || '' };
}

function cleanPowerValue(value) {
  const text = String(value ?? '').trim();
  return text && text !== '---' && text !== '----' && text !== '--' ? text : '';
}

function valuePreview(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isEmptyFieldValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function commaListDiff(before, after) {
  if (typeof before !== 'string' || typeof after !== 'string') return null;
  if (!before.includes(',') && !after.includes(',')) return null;
  const beforeValues = before.split(',').map((value) => value.trim()).filter(Boolean);
  const afterValues = after.split(',').map((value) => value.trim()).filter(Boolean);
  if (beforeValues.length < 2 && afterValues.length < 2) return null;
  const beforeSet = new Set(beforeValues);
  const afterSet = new Set(afterValues);
  const addedValues = afterValues.filter((value) => !beforeSet.has(value));
  const removedValues = beforeValues.filter((value) => !afterSet.has(value));
  if (!addedValues.length && !removedValues.length) return null;
  return { addedValues, removedValues };
}

function fieldListDiff(field) {
  if (field.addedValues || field.removedValues) {
    return {
      addedValues: field.addedValues || [],
      removedValues: field.removedValues || [],
    };
  }
  return commaListDiff(field.before, field.after);
}

function FullListDiff({ field, diff }) {
  const renderValues = (value, highlighted, className) => {
    const values = Array.isArray(value)
      ? value.map((item) => String(item))
      : String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const marked = new Set((highlighted || []).map((item) => String(item)));
    return (
      <div className="flex flex-wrap gap-x-1 font-mono text-xs">
        {values.map((item, index) => (
          <span key={`${item}-${index}`}>
            {index > 0 ? ', ' : ''}
            <span className={marked.has(item) ? className : ''}>{item}</span>
          </span>
        ))}
      </div>
    );
  };
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="rounded bg-rose-950/50 p-2">
        <div className="mb-1 text-xs font-bold text-rose-200">Before</div>
        {renderValues(field.before, diff.removedValues, 'text-rose-200')}
      </div>
      <div className="rounded bg-emerald-950/50 p-2">
        <div className="mb-1 text-xs font-bold text-emerald-200">After</div>
        {renderValues(field.after, diff.addedValues, 'text-emerald-200')}
      </div>
    </div>
  );
}

function resolveLang(value, lang) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return lang?.[text] || text;
}

function recordTitle(record, lang) {
  const source = record?.after || record?.data || record?.before || {};
  const displayNameKey = Object.keys(source).find((key) => /DisplayNameKey$/i.test(key));
  if (displayNameKey && source[displayNameKey]) return resolveLang(source[displayNameKey], lang);
  const displayName = Object.keys(source).find((key) => /DisplayName$/i.test(key));
  if (displayName && source[displayName]) return resolveLang(source[displayName], lang);
  return resolveLang(record?.name || record?.id || 'Record', lang);
}

function displayFieldName(field) {
  return field === 'Weight' ? 'Defense' : field;
}

function hex(value, fallback = '#e2e8f0') {
  const text = cleanPowerValue(value);
  if (!text) return fallback;
  if (text.startsWith('#')) return text;
  if (/^0x/i.test(text)) return `#${text.slice(2)}`;
  return text;
}

function normalizeRosterIcon(name) {
  const icon = cleanPowerValue(name);
  if (!icon) return '';
  return icon.endsWith('M') ? icon : `${icon}M`;
}

function buildHeroMap(data) {
  const heroes = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return heroes.reduce((acc, hero) => {
    const code = cleanPowerValue(hero?.HeroName);
    if (!code || code === 'Template' || code === 'Random' || code === 'DEFAULT_CHARACTER') return acc;
    const portrait = normalizeRosterIcon(hero?.Portrait);
    const file = cleanPowerValue(hero?.PortraitFileName) || 'UI_Icons';
    const entry = {
      code,
      id: cleanPowerValue(hero?.HeroID),
      name: cleanPowerValue(hero?.BioName)?.replace(/^"|"$/g, '') || cleanPowerValue(hero?.HeroDisplayName) || code,
      image: portrait ? `${host}/game/getGfx/${file}/${portrait}/1` : '',
    };
    acc[code] = entry;
    const costumeName = cleanPowerValue(hero?.CostumeName);
    if (costumeName) acc[costumeName] = entry;
    acc.__powers ||= {};
    [
      'SpecialPower1',
      'SpecialPower1_Forward',
      'SpecialPower1_Down',
      'SpecialPower2',
      'SpecialPower2_Forward',
      'SpecialPower2_Down',
    ].forEach((field) => {
      const power = cleanPowerValue(hero?.[field]);
      if (power) acc.__powers[power] = entry;
    });
    return acc;
  }, { __powers: {} });
}

function metadataRows(data) {
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}

function firstClean(...values) {
  return values.map(cleanPowerValue).find(Boolean) || '';
}

function buildStoreAssetMap(results) {
  const [
    costumes,
    weaponSkins,
    avatars,
    taunts,
    podiums,
    colors,
    emojis,
    companions,
    sidekicks,
    koEffects,
    smokeTrails,
    monikers,
    themes,
    borders,
  ] = results.map(metadataRows);

  const byName = (rows, ...keys) => rows.reduce((acc, row) => {
    keys.forEach((key) => {
      const value = cleanPowerValue(row?.[key]);
      if (value) acc[value] = row;
    });
    return acc;
  }, {});

  return {
    costumeRows: costumes,
    costumes: byName(costumes, 'CostumeName', 'DisplayNameKey'),
    weaponSkins: byName(weaponSkins, 'WeaponSkinName', 'DisplayNameKey'),
    avatars: byName(avatars, 'AvatarName', 'DisplayNameKey'),
    taunts: byName(taunts, 'TauntName', 'PowerName', 'DisplayNameKey'),
    podiums: byName(podiums, 'PodiumName', 'DisplayNameKey'),
    colors: byName(colors, 'ColorSchemeName', 'DisplayNameKey'),
    emojis: byName(emojis, 'EmojiName', 'DisplayNameKey'),
    companions: byName(companions, 'CompanionName', 'DisplayNameKey'),
    sidekicks: byName(sidekicks, 'SpawnBotName', 'DisplayNameKey'),
    koEffects: byName(koEffects, 'TrailEffectName', 'DisplayNameKey'),
    smokeTrails: byName(smokeTrails, 'EmitterGroupName', 'DisplayNameKey'),
    monikers: byName(monikers, 'MonikerName', 'DisplayNameKey'),
    themes: byName(themes, 'PlayerThemeName', 'DisplayNameKey'),
    borders: byName(borders, 'SeasonBorderName', 'DisplayNameKey'),
  };
}

function costumeSkinInt(costume, storeAssetMap = {}) {
  const explicitSkinInt = cleanPowerValue(costume?.SkinInt);
  if (explicitSkinInt) return explicitSkinInt;
  const ownerHero = cleanPowerValue(costume?.OwnerHero);
  const costumeId = cleanPowerValue(costume?.CostumeID);
  if (!ownerHero || !costumeId) return '';
  const heroSkins = (storeAssetMap.costumeRows || []).filter((row) =>
    cleanPowerValue(row?.OwnerHero) === ownerHero &&
    cleanPowerValue(row?.CostumeIndex) !== '0' &&
    !cleanPowerValue(row?.CostumeName).includes('Stance')
  );
  const index = heroSkins.findIndex((row) => cleanPowerValue(row?.CostumeID) === costumeId);
  return index >= 0 ? String(index + 1) : '';
}

function costumeImage(costume, heroMap = {}, storeAssetMap = {}) {
  const hero = heroMap?.[cleanPowerValue(costume?.OwnerHero)];
  const heroId = firstClean(costume?.HeroID, hero?.id);
  const skinInt = costumeSkinInt(costume, storeAssetMap);
  if (!heroId) return '';
  return `${host}/game/anim/char/${heroId}-${skinInt || '0'}/Animation_CharacterSelect/a__CharacterSelectAnimation/SelectedRandom/loop`;
}

function recordImage(file, record, heroMap = {}, storeAssetMap = {}) {
  const data = record?.after || record?.data || {};
  const path = file ? filePath(file) : '';
  if (path === 'Game/costumeTypes.csv') {
    return costumeImage(data, heroMap, storeAssetMap);
  }
  if (path === 'Game/weaponSkinTypes.csv' && data.WeaponSkinID && data.BaseWeapon) {
    return `${host}/game/anim/weapon/${data.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${data.BaseWeapon}Pose/loop`;
  }
  if (path === 'Game/ColorSchemeTypes.xml' && data.IconName) return `${host}/game/getGfx/UI_Icons/${data.IconName}`;
  if (path === 'Game/avatarTypes.csv' && data.AvatarID) return `${host}/game/animAvatar/${data.AvatarID}`;
  if (path === 'Game/TauntTypes.xml' && data.PowerName) return `${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${data.PowerName}/loop`;
  if (path === 'Game/PodiumTypes.xml' && data.PodiumID) return `${host}/game/animPodium/${data.PodiumID}/loop/Ready`;
  if (path === 'Game/EmojiTypes.xml' && data.EmojiID) return `${host}/game/animEmoji/${data.EmojiID}`;
  if (path === 'Game/CompanionTypes.xml' && data.CompanionID) return `${host}/game/animCompanion/${data.CompanionID}/Ready/loop`;
  if (path === 'Game/SpawnBotTypes.xml' && data.SpawnBotID) return `${host}/game/anim/spawnbot/${data.SpawnBotID}/Animation_Robot/a__AnimationRobot/Ready/loop`;
  if (path === 'Game/TrailEffectTypes.xml' && data.TrailEffectID) return `${host}/game/animTrail/${data.TrailEffectID}`;
  if (path === 'Game/EmitterGroupTypes.xml' && data.EmitterGroupID) return `${host}/game/animSmokeTrail/${data.EmitterGroupID}`;
  if (path === 'Game/SeasonBorderTypes.xml' && data.SeasonBorderID) return `${host}/game/animBorder/${data.SeasonBorderID}`;
  if (path === 'Game/PlayerThemeTypes.xml' && data.PlayerThemeID) return `${host}/game/animUi/${data.PlayerThemeID}/StoreAllItems`;
  return '';
}

function addedStoreItemImage(record, heroMap = {}, storeAssetMap = {}) {
  const data = record?.data || record?.after || {};
  const type = cleanPowerValue(data.Type).toLowerCase();
  const item = cleanPowerValue(data.Item);
  if (type === 'hero' && item && heroMap[item]?.image) return heroMap[item].image;
  if (type === 'costume') return costumeImage(storeAssetMap.costumes?.[item] || data, heroMap, storeAssetMap);
  if (type === 'weaponskin') {
    const weapon = storeAssetMap.weaponSkins?.[item] || data;
    if (weapon?.WeaponSkinID) return `${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon || 'Sword'}Pose/loop`;
  }
  if (type === 'avatar') {
    const avatar = storeAssetMap.avatars?.[item] || data;
    if (avatar?.AvatarID) return `${host}/game/animAvatar/${avatar.AvatarID}`;
    if (avatar?.IconName) return `${host}/game/getGfx/UI_Icons/${avatar.IconName}`;
  }
  if (type === 'taunt') {
    const taunt = storeAssetMap.taunts?.[item] || data;
    if (taunt?.PowerName) return `${host}/game/anim/char/3-0/Animation_Emote/a__EmoteAnimation/${taunt.PowerName}/loop`;
  }
  if (type === 'podium') {
    const podium = storeAssetMap.podiums?.[item] || data;
    if (podium?.PodiumID) return `${host}/game/animPodium/${podium.PodiumID}/loop/Ready`;
  }
  if (type === 'colorscheme') {
    const color = storeAssetMap.colors?.[item] || data;
    if (color?.IconName) return `${host}/game/getGfx/UI_Icons/${color.IconName}`;
  }
  if (type === 'emoji') {
    const emoji = storeAssetMap.emojis?.[item] || data;
    if (emoji?.EmojiID) return `${host}/game/animEmoji/${emoji.EmojiID}`;
  }
  if (type === 'companion') {
    const companion = storeAssetMap.companions?.[item] || data;
    if (companion?.CompanionID) return `${host}/game/animCompanion/${companion.CompanionID}/Ready/loop`;
  }
  if (type === 'spawnbot') {
    const sidekick = storeAssetMap.sidekicks?.[item] || data;
    if (sidekick?.SpawnBotID) return `${host}/game/anim/spawnbot/${sidekick.SpawnBotID}/Animation_Robot/a__AnimationRobot/Ready/loop`;
  }
  if (type === 'trail' || type === 'traileffect' || type === 'koeffect') {
    const ko = storeAssetMap.koEffects?.[item] || data;
    if (ko?.TrailEffectID) return `${host}/game/animTrail/${ko.TrailEffectID}`;
  }
  if (type === 'emittergroup') {
    const trail = storeAssetMap.smokeTrails?.[item] || data;
    if (trail?.EmitterGroupID) return `${host}/game/animSmokeTrail/${trail.EmitterGroupID}`;
  }
  if (type === 'playertheme') {
    const theme = storeAssetMap.themes?.[item] || data;
    if (theme?.PlayerThemeID) return `${host}/game/animUi/${theme.PlayerThemeID}/StoreAllItems`;
  }
  if (type === 'seasonborder' || type === 'border') {
    const border = storeAssetMap.borders?.[item] || data;
    if (border?.SeasonBorderID) return `${host}/game/animBorder/${border.SeasonBorderID}`;
  }
  if (type === 'moniker' || type === 'title') return '';
  if (cleanPowerValue(data.IconName)) return `${host}/game/getGfx/UI_Icons/${data.IconName}/1`;
  const imagePath = cleanPowerValue(data.ItemImage || data.PopUpImage);
  const fileName = imagePath.split(/[\\/]/).pop();
  if (fileName && /\.(png|jpe?g|gif|webp)$/i.test(fileName)) return `${host}/game/images/images/UI/${fileName}`;
  return '';
}

function addedStorePreviewItem(record, heroMap = {}, storeAssetMap = {}, lang = {}) {
  const data = record?.data || record?.after || {};
  const type = cleanPowerValue(data.Type).toLowerCase();
  const item = cleanPowerValue(data.Item);
  if (type === 'moniker' || type === 'title') {
    const moniker = storeAssetMap.monikers?.[item] || data;
    const label = resolveLang(moniker?.DisplayNameKey || data.DisplayNameKey || data.StoreName || item, lang);
    if (!label) return null;
    return {
      type: 'moniker',
      label,
      color: hex(moniker?.Color || data.Color),
    };
  }
  const src = addedStoreItemImage(record, heroMap, storeAssetMap);
  return src ? { type: 'image', src } : null;
}

function addedPreviewItem(file, record, heroMap = {}, storeAssetMap = {}, lang = {}) {
  const path = filePath(file);
  if (path === 'Game/storeTypes.csv') return addedStorePreviewItem(record, heroMap, storeAssetMap, lang);
  const src = recordImage(file, record, heroMap, storeAssetMap);
  return src ? { type: 'image', src } : null;
}

function AddedPreviewStrip({ file, records, heroMap, storeAssetMap, lang }) {
  const path = filePath(file);
  if (!['Game/storeTypes.csv', 'Game/costumeTypes.csv'].includes(path)) return null;
  const previews = (records || [])
    .map((record, index) => ({ ...addedPreviewItem(file, record, heroMap, storeAssetMap, lang), key: `${record.id || index}-${index}` }))
    .filter((item) => item.type);
  if (!previews.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {previews.map((preview) => (
        preview.type === 'moniker' ? (
          <div
            key={preview.key}
            className="flex min-h-16 max-w-48 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm font-bold leading-tight"
            style={{ color: preview.color }}
          >
            {preview.label}
          </div>
        ) : (
          <img
            key={preview.key}
            src={preview.src}
            className="h-16 w-16 rounded-lg bg-slate-950 object-contain"
            alt=""
            loading="lazy"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )
      ))}
    </div>
  );
}

function databaseRecordUrl(file, record, storeAssetMap = {}) {
  const path = filePath(file).toLowerCase();
  const data = record?.data || record?.after || {};
  const database = (page, key, value) => value
    ? `/game/database?page=${encodeURIComponent(page)}&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    : '';
  if (path.endsWith('/herotypes.xml')) {
    const name = cleanPowerValue(data.BioName || data.HeroName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return name ? `/game/legends/${name}` : '';
  }
  if (path.endsWith('/costumetypes.csv')) return database('skins', 'skin', data.CostumeID);
  if (path.endsWith('/weaponskintypes.csv')) return database('weapon-skins', 'weapon', data.WeaponSkinID);
  if (path.endsWith('/colorschemetypes.xml')) return database('colors', 'color', data.ColorSchemeID);
  if (path.endsWith('/avatartypes.csv')) return database('avatars', 'avatar', data.AvatarID);
  if (path.endsWith('/taunttypes.xml')) return database('taunts', 'taunt', data.TauntID);
  if (path.endsWith('/podiumtypes.xml')) return database('podiums', 'podium', data.PodiumID);
  if (path.endsWith('/playerthemetypes.xml')) return database('ui-themes', 'theme', data.PlayerThemeID);
  if (path.endsWith('/seasonbordertypes.xml')) return database('borders', 'border', data.SeasonBorderID);
  if (path.endsWith('/emojitypes.xml')) return database('emojis', 'emoji', data.EmojiID);
  if (path.endsWith('/companiontypes.xml')) return database('companions', 'companion', data.CompanionID);
  if (path.endsWith('/spawnbottypes.xml')) return database('sidekicks', 'sidekick', data.SpawnBotID);
  if (path.endsWith('/traileffecttypes.xml')) return database('ko-effects', 'koeffect', data.TrailEffectID);
  if (path.endsWith('/emittergrouptypes.xml')) return database('smoke-trails', 'smoketrail', data.EmitterGroupID);
  if (path.endsWith('/monikertypes.xml')) return database('titles', 'title', data.MonikerID);
  if (path.endsWith('/chanceboxtypes.xml')) return database('chests', 'chests', data.ChanceBoxID);
  if (path.endsWith('/skirmishtypes.xml')) return database('skirmishes', 'skirmishes', data.SkirmishID);
  if (path.endsWith('/missiontypes.xml')) return database('missions', 'missions', data.MissionID);
  if (path.endsWith('/achievementtypes.xml')) return database('achievements', 'achievements', data.AchievementID);
  if (path.endsWith('/tournamenteventtypes.xml')) return database('tournament-events', 'tournamentevents', data.TournamentEventID || data.Title);
  if (path.endsWith('/splasharttypes.xml')) return database('splash-arts', 'splasharts', data.SplashArtID);
  if (path.endsWith('/musictypes.xml')) return database('music', 'music', data.MusicID);
  if (path.endsWith('/helpfulhintstypes.xml')) return database('helpful-hints', 'helpfulhints', data.HelpfulHintID || data.HelpfulhintsName);
  if (path.endsWith('/guildmissiontypes.xml')) return database('guild-missions', 'guildmissions', data.GuildMissionID);
  if (path.endsWith('/clientthemetypes.xml')) return database('client-themes', 'clientthemes', data.ClientThemeID);
  if (path.endsWith('/entitlementtypes.xml')) return database('entitlements-purchases', 'entitlements', data.EntitlementID);
  if (path.endsWith('/battlepasstypes.xml')) return database('battle-passes', 'pass', data.BattlePassID);
  if (path.endsWith('/storetypes.csv')) {
    const item = cleanPowerValue(data.Item);
    const type = cleanPowerValue(data.Type).toLowerCase();
    const lookups = {
      costume: ['skins', 'skin', storeAssetMap.costumes?.[item]?.CostumeID],
      weaponskin: ['weapon-skins', 'weapon', storeAssetMap.weaponSkins?.[item]?.WeaponSkinID],
      avatar: ['avatars', 'avatar', storeAssetMap.avatars?.[item]?.AvatarID],
      taunt: ['taunts', 'taunt', storeAssetMap.taunts?.[item]?.TauntID],
      podium: ['podiums', 'podium', storeAssetMap.podiums?.[item]?.PodiumID],
      colorscheme: ['colors', 'color', storeAssetMap.colors?.[item]?.ColorSchemeID],
      emoji: ['emojis', 'emoji', storeAssetMap.emojis?.[item]?.EmojiID],
      companion: ['companions', 'companion', storeAssetMap.companions?.[item]?.CompanionID],
      spawnbot: ['sidekicks', 'sidekick', storeAssetMap.sidekicks?.[item]?.SpawnBotID],
      traileffect: ['ko-effects', 'koeffect', storeAssetMap.koEffects?.[item]?.TrailEffectID],
      emittergroup: ['smoke-trails', 'smoketrail', storeAssetMap.smokeTrails?.[item]?.EmitterGroupID],
      moniker: ['titles', 'title', storeAssetMap.monikers?.[item]?.MonikerID],
      playertheme: ['ui-themes', 'theme', storeAssetMap.themes?.[item]?.PlayerThemeID],
      seasonborder: ['borders', 'border', storeAssetMap.borders?.[item]?.SeasonBorderID],
    };
    const target = lookups[type];
    if (target) return database(target[0], target[1], target[2]);
    if (type === 'bundle') return database('bundles', 'bundles', data.StoreID);
    return '';
  }
  return '';
}

function ObjectChangeList({ changes }) {
  return (
    <div className="mt-2 grid gap-2">
      {(changes || []).map((change, index) => (
        <div key={`${change.path}-${index}`} className="rounded bg-slate-950/45 p-2 text-xs">
          <div className="font-mono font-bold text-slate-200">{change.path}</div>
          <div className="mt-1 grid gap-2 md:grid-cols-2">
            <pre className={`overflow-auto whitespace-pre-wrap break-words rounded bg-rose-950/50 p-2 app-scrollbar ${change.propertyRemoved ? 'font-bold text-rose-200' : ''}`}>{valuePreview(change.before)}</pre>
            <pre className={`overflow-auto whitespace-pre-wrap break-words rounded bg-emerald-950/50 p-2 app-scrollbar ${change.propertyAdded ? 'font-bold text-emerald-200' : ''}`}>{valuePreview(change.after)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyChangeVariants({ field }) {
  return (
    <div className="mt-2 grid gap-2">
      {(field.propertyChangeVariants || []).map((variant, index) => (
        <div key={index} className="rounded bg-slate-950/45 p-2 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-300">{variant.count} record{variant.count === 1 ? '' : 's'}</span>
            {!!variant.records?.length && <span className="break-words text-right text-slate-500">{variant.records.join(', ')}</span>}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <pre className={`overflow-auto whitespace-pre-wrap break-words rounded bg-rose-950/50 p-2 app-scrollbar ${field.propertyRemoved ? 'font-bold text-rose-200' : ''}`}>{valuePreview(variant.before)}</pre>
            <pre className={`overflow-auto whitespace-pre-wrap break-words rounded bg-emerald-950/50 p-2 app-scrollbar ${field.propertyAdded ? 'font-bold text-emerald-200' : ''}`}>{valuePreview(variant.after)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

function CountPill({ label, value, tone = 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
    amber: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
    rose: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
    blue: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
    slate: 'bg-slate-700/70 text-slate-200 border-slate-600',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[tone] || colors.slate}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-bold leading-tight">{value ?? 0}</div>
    </div>
  );
}

function HighlightedPatchPropertyData({ value, details, side }) {
  const highlighted = new Set(details
    .filter((detail) => side === 'before' ? detail.action !== 'added' : detail.action !== 'removed')
    .map((detail) => String(detail.path || '').split('.').pop())
    .filter(Boolean));
  const serialized = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs app-scrollbar">
      {String(serialized).split('\n').map((line, index) => {
        const changed = [...highlighted].some((key) => line.includes(`${JSON.stringify(key)}:`));
        const color = changed ? side === 'before' ? 'text-rose-200' : 'text-emerald-200' : 'text-slate-300';
        return <span key={index} className={`${color} block`}>{line}</span>;
      })}
    </pre>
  );
}

function PatchCommonPowerFieldData({ field }) {
  const structuralChange = field.details.some((detail) => detail.action === 'added' || detail.action === 'removed');
  if (!structuralChange) {
    return (
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        {field.details.map((detail) => (
          <div key={`${detail.action}-${detail.path}`} className="font-mono">
            <span className="text-slate-200">{[field.field, detail.path].filter(Boolean).join('.')}: </span>
            <span className="text-rose-200">{detail.before === undefined ? 'undefined' : JSON.stringify(detail.before)}</span>
            {' -> '}
            <span className="text-emerald-200">{detail.after === undefined ? 'undefined' : JSON.stringify(detail.after)}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 grid gap-2">
      {field.variants.map((variant, index) => (
        <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2">
          {field.variants.length > 1 && <div className="mb-2 text-xs text-slate-400">{variant.count} powers</div>}
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg bg-rose-950/40 p-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-rose-200">Before</div>
              <HighlightedPatchPropertyData value={variant.before} details={field.details} side="before" />
            </div>
            <div className="rounded-lg bg-emerald-950/40 p-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">After</div>
              <HighlightedPatchPropertyData value={variant.after} details={field.details} side="after" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommonPowerFieldSummary({ fields }) {
  if (!fields?.length) return null;
  return (
    <div className="grid gap-2">
      {fields.map((field) => (
        <div key={field.field} className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-2 text-sm font-bold text-blue-100">
          <div>{commonPowerFieldMessage(field)}</div>
          <PatchCommonPowerFieldData field={field} />
        </div>
      ))}
    </div>
  );
}

const powerBuffIncreaseFields = [
  /^BaseDamage$/i,
  /^VariableImpulse$/i,
  /^FixedImpulse$/i,
  /^MinimumImpulse$/i,
  /^PostHitDamageMultiplier$/i,
  /^PostHitImpulseMultiplier$/i,
  /^FixedStunTime$/i,
  /^AoERadius[XY]$/i,
  /^FireImpulse(Max)?[XY]?$/i,
  /^ImpulseMaxOnDCOnly$/i,
  /^SpeedLimit/i,
  /^AccelMult$/i,
  /^BackwardAccelMult$/i,
];

const powerNerfIncreaseFields = [
  /^CastTime$/i,
  /^FixedRecoverTime$/i,
  /^RecoverTime$/i,
  /^CooldownTime$/i,
  /^OnHitCooldownTime$/i,
  /^FixedMinChargeTime$/i,
  /^MinCancelTime$/i,
  /^LoseInvulnTime$/i,
  /^MinTimeBetweenHits$/i,
  /^GrabInterpolateTime$/i,
  /^ShakeTime$/i,
];

const powerBooleanBuffFields = [
  /^AllowMove$/i,
  /^AllowRecoverMove$/i,
  /^AllowJumpDuringRecover$/i,
  /^AllowLeaveGround$/i,
  /^AllowHitOnZeroDamage$/i,
  /^WallCancel$/i,
  /^CanChangeDirection$/i,
  /^ForceHitThroughSoftPlat$/i,
  /^CanDamageEveryone$/i,
  /^CanAssist$/i,
];

const powerBooleanNerfFields = [
  /^CannotAttackAroundCorners$/i,
  /^ConsumesWeapon$/i,
  /^EndOnHit$/i,
  /^IgnoreStrength$/i,
];

function matchesAny(field, patterns) {
  return patterns.some((pattern) => pattern.test(field));
}

const powerVisualFields = /(Gfx|Anim|Sound|Sfx|Tint|Flip|Camera|Emitter|CustomArt|Icon|Trail|Color)/i;

function isVisualPowerField(field) {
  const name = String(field?.field || '');
  return powerVisualFields.test(name)
    && !matchesAny(name, [...powerBuffIncreaseFields, ...powerNerfIncreaseFields, ...powerBooleanBuffFields, ...powerBooleanNerfFields]);
}

function CollapsibleDiffBlock({ title, subtitle, image, children, className = '', imageClassName = 'h-9 w-9' }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/70 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          {image && <img src={image} className={`${imageClassName} shrink-0 rounded-lg bg-slate-950 object-cover`} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
          <div className="min-w-0">
            <div className="break-words text-sm font-bold text-white">{title}</div>
            {subtitle && <div className="mt-0.5 break-words text-xs text-slate-400">{subtitle}</div>}
          </div>
        </div>
      </button>
      {open && <div className="border-t border-slate-700 p-3">{children}</div>}
    </div>
  );
}

function stablePatchValue(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(stablePatchValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stablePatchValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function identicalChangedRecordGroups(records) {
  const groups = new Map();
  for (const record of records) {
    const fields = [...(record.fields || [])].sort((a, b) => String(a.field).localeCompare(String(b.field)));
    const key = fields.length ? stablePatchValue(fields) : `record:${record.id || record.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()];
}

function ChangedRecordGroup({ records, file, lang, heroMap, storeAssetMap, hideVisual }) {
  if (records.length === 1) {
    return <RecordCard type="changed" record={records[0]} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} hideVisual={hideVisual} />;
  }
  const names = records.map((record) => recordTitle(record, lang)).filter(Boolean);
  return (
    <CollapsibleDiffBlock
      title={`${records.length} Matching Changes`}
      subtitle={names.slice(0, 12).join(', ')}
      className="bg-slate-950/60"
    >
      {names.length > 12 && <div className="mb-2 text-xs text-slate-400">{names.length - 12} more affected records</div>}
      <RecordCard
        type="changed"
        record={records[0]}
        file={file}
        lang={lang}
        heroMap={heroMap}
        storeAssetMap={storeAssetMap}
        titleOverride="Shared Property Change"
        hideImage
        hideVisual={hideVisual}
      />
    </CollapsibleDiffBlock>
  );
}

const fieldGlossary = {
  BaseDamage: 'Damage per hit window. A "t" value is spread across every hit in that window.',
  FixedImpulse: 'Fixed force: knockback that does not depend on the target\'s damage.',
  VariableImpulse: 'Variable force: knockback that grows with the target\'s damage.',
  MinimumImpulse: 'Lowest force the attack can apply.',
  CastTime: 'Timing per hit window, written startup:active@animation frame. The first number is the startup.',
  FixedRecoverTime: 'Recover time that is always applied after the attack (duration@animation frame).',
  RecoverTime: 'Recover time that scales with Dexterity.',
  FixedMinChargeTime: 'Shortest time a signature has to be charged.',
  FixedStunTime: 'Stun applied to the target on hit.',
  AoERadiusX: 'Hitbox width per hit window. & separates several hitboxes, ~ changes the value during the window.',
  AoERadiusY: 'Hitbox height per hit window. & separates several hitboxes, ~ changes the value during the window.',
  CenterOffsetX: 'Horizontal position of each hitbox.',
  CenterOffsetY: 'Vertical position of each hitbox.',
  CooldownTime: 'Time before the attack can be used again.',
  OnHitCooldownTime: 'Cooldown after the attack hits.',
  GCancelTime: 'When the attack can be gravity cancelled.',
  ImpulseOffsetX: 'Horizontal adjustment to the knockback direction.',
  ImpulseOffsetY: 'Vertical adjustment to the knockback direction.',
  ImpulseToPoint: 'Pulls the target toward a point instead of sending in a direction.',
  FireImpulseX: 'Horizontal movement given to the attacker. ~ changes it during the window, ! leaves it unset.',
  FireImpulseY: 'Vertical movement given to the attacker.',
  AccelMult: 'Acceleration the attacker keeps during the attack.',
  BackwardAccelMult: 'Backward acceleration during the attack.',
  SpeedLimit: 'Max speed during the attack.',
  SpeedLimitBackward: 'Max backward speed during the attack.',
  ComboName: 'The power that continues this one.',
  DevNotes: 'Developer notes describing the power.',
  OriginPower: 'The first power of the attack this part belongs to.',
  LevelTypes: 'Maps in this map pool.',
  GoldCost: 'Price in Gold.',
  IdolCost: 'Price in Mammoth Coins.',
  IdolSaleCost: 'Sale price in Mammoth Coins.',
  Popularity: 'Store sort weight. Players never see it.',
  Tags: 'Internal store tags.',
  Label: 'The banner on the store tile, such as New or Sale.',
  Weight: 'Defense stat.',
  Strength: 'Strength stat.',
  Dexterity: 'Dexterity stat.',
  Speed: 'Speed stat.',
  Cooldown: 'Dodge cooldown in the air.',
  CooldownGround: 'Dodge cooldown on the ground.',
  TopKill: 'Distance to the top blast zone.',
  BottomKill: 'Distance to the bottom blast zone.',
  LeftKill: 'Distance to the left blast zone.',
  RightKill: 'Distance to the right blast zone.',
  RosterHeroes: 'Legends in the free rotation.',
  ColorExclusionList: 'Colors that cannot be picked on this map.',
  NavNode: 'Bot pathing points.',
  MissionTags: 'Tags used by missions. Players never see them.',
};

function slug(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function recordAnchor(file, record) {
  return `rec-${slug(filePath(file))}-${slug(record?.id ?? record?.name)}`;
}

function FieldName({ field, raw = false }) {
  const help = fieldGlossary[field];
  return (
    <span title={help || undefined} className={help ? 'cursor-help' : ''}>
      {raw ? field : displayFieldName(field)}
      {help && <span className="ml-1 text-slate-500">?</span>}
    </span>
  );
}

function WindowDiff({ field }) {
  const before = String(field.before ?? '').split(',');
  const after = String(field.after ?? '').split(',');
  const count = Math.max(before.length, after.length);
  const cells = (values, other, tone) => Array.from({ length: count }, (_, index) => {
    const changed = (values[index] ?? '') !== (other[index] ?? '');
    return (
      <td key={index} className={`whitespace-nowrap px-2 py-0.5 ${changed ? `${tone} font-bold` : 'text-slate-500'}`}>
        {values[index] ?? ''}
      </td>
    );
  });
  return (
    <div className="mt-2 overflow-x-auto rounded bg-black/20 p-1 app-scrollbar">
      <table className="font-mono text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="px-2 text-left font-normal">hit window</th>
            {Array.from({ length: count }, (_, index) => <th key={index} className="px-2 font-normal">{index + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr><td className="px-2 text-rose-200">before</td>{cells(before, after, 'bg-rose-950/60 text-rose-200')}</tr>
          <tr><td className="px-2 text-emerald-200">after</td>{cells(after, before, 'bg-emerald-950/60 text-emerald-200')}</tr>
        </tbody>
      </table>
    </div>
  );
}

function RecordHistory({ file, record }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${host}/game/history/record/${encodeURIComponent(file.section)}/${encodeURIComponent(file.file)}/${encodeURIComponent(record.id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Record history request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelled) setState({ loading: false, error: '', data }); })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ loading: false, error: "Couldn't load this record's history.", data: null });
      });
    return () => { cancelled = true; };
  }, [file.section, file.file, record.id]);
  if (state.loading) return <div className="mt-2 text-xs text-slate-400">Looking through older patches…</div>;
  if (state.error) return <div className="mt-2 text-xs text-rose-200">{state.error}</div>;
  const changes = state.data?.changes || [];
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
      <div className="mb-1 font-bold text-slate-200">History</div>
      {!changes.length && <div className="text-slate-400">No earlier changes found.</div>}
      <ol className="space-y-1">
        {changes.map((change, index) => (
          <li key={`${change.manifest}-${index}`}>
            <span className="font-bold text-slate-100">Patch {change.patch}</span>
            <span className="text-slate-500"> · {formatDate(change.date)}</span>
            <span className={change.type === 'added' ? ' text-emerald-200' : change.type === 'removed' ? ' text-rose-200' : ' text-amber-200'}> · {change.type}</span>
            {change.fields?.length > 0 && (
              <div className="ml-3 font-mono text-[11px] text-slate-400">
                {change.fields.slice(0, 8).map((entry) => (
                  <div key={entry.field} className="break-all">{entry.field}: {valuePreview(entry.before).slice(0, 80)} → {valuePreview(entry.after).slice(0, 80)}</div>
                ))}
                {change.fields.length > 8 && <div>+{change.fields.length - 8} more fields</div>}
              </div>
            )}
          </li>
        ))}
      </ol>
      {state.data && !state.data.complete && <div className="mt-1 text-slate-500">Showing the most recent changes only.</div>}
    </div>
  );
}

function RecordCard({ type, record, file, lang, heroMap, storeAssetMap, titleOverride = '', hideImage = false, hideVisual = false }) {
  const anchor = recordAnchor(file, record);
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === `#${anchor}`);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const isChange = type === 'changed';
  const isPowers = filePath(file) === 'Game/powerTypes.csv';
  const image = hideImage ? '' : recordImage(file, record, heroMap, storeAssetMap);
  const title = titleOverride || recordTitle(record, lang);
  const databaseUrl = type !== 'removed' ? databaseRecordUrl(file, { ...record, data: record.data || record.after }, storeAssetMap) : '';
  const fields = (record.fields || []).filter((field) => !(hideVisual && isPowers && isVisualPowerField(field)));
  const hiddenFields = (record.fields?.length || 0) - fields.length;
  const canTrace = record.id && !record.compactPropertyChange && record.id !== 'file';
  const copyLink = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'full');
    url.hash = anchor;
    navigator.clipboard?.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.location.hash === `#${anchor}`) {
      document.getElementById(anchor)?.scrollIntoView({ block: 'center' });
    }
  }, []);
  if (isChange && !fields.length && hiddenFields) return null;
  return (
    <div id={anchor} className={`scroll-mt-32 rounded-xl border p-2 ${sectionColors[type] || sectionColors.changed}`}>
      <div className="flex w-full items-start justify-between gap-3 text-left">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          {image && (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-lg bg-slate-950/70 object-contain"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="min-w-0">
            <div className="break-words text-sm font-bold text-white">{title}</div>
            {record.id && !record.compactPropertyChange && <div className="mt-0.5 text-xs opacity-75">ID {record.id}</div>}
            {record.compactPropertyChange && record.affectedCount > 0 && (
              <div className="mt-1 text-xs text-slate-300">
                {record.affectedCount} affected record{record.affectedCount === 1 ? '' : 's'}
                {!!record.sample?.length && <span className="text-slate-500">: {record.sample.join(', ')}</span>}
              </div>
            )}
            {isChange && (
              <div className="mt-1 text-xs opacity-75">
                {fields.length} field change{fields.length === 1 ? '' : 's'}{hiddenFields ? ` · ${hiddenFields} visual hidden` : ''}
              </div>
            )}
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {databaseUrl && <a href={databaseUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-500/20 px-2 py-1 text-xs font-bold text-blue-100 hover:bg-blue-500/30">Database</a>}
          {canTrace && <button type="button" onClick={() => setShowHistory((value) => !value)} className="rounded-lg bg-black/20 px-2 py-1 text-xs">{showHistory ? 'Hide history' : 'History'}</button>}
          <button type="button" onClick={copyLink} className="rounded-lg bg-black/20 px-2 py-1 text-xs" title="Copy a link to this record">{copied ? 'Copied' : 'Link'}</button>
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg bg-black/20 px-2 py-1 text-xs">{open ? 'Hide' : 'View'}</button>
        </div>
      </div>
      {showHistory && canTrace && <RecordHistory file={file} record={record} />}
      {open && (
        <div className="mt-3 space-y-2">
          {isChange ? (
            fields.map((field) => {
              const listDiff = !isPowers ? fieldListDiff(field) : null;
              const windowed = isPowers && typeof field.before === 'string' && typeof field.after === 'string' && (field.before.includes(',') || field.after.includes(','));
              const propertyAdded = field.propertyAdded || (isEmptyFieldValue(field.before) && !isEmptyFieldValue(field.after));
              const propertyRemoved = field.propertyRemoved || (!isEmptyFieldValue(field.before) && isEmptyFieldValue(field.after));
              return (
                <div key={field.field} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-xs font-bold tracking-wide text-slate-300">
                    <FieldName field={field.field} raw={record.compactPropertyChange} />
                  </div>
                  {listDiff ? (
                    <FullListDiff field={field} diff={listDiff} />
                  ) : windowed ? (
                    <WindowDiff field={field} />
                  ) : field.propertyChangeVariants?.length ? (
                    <PropertyChangeVariants field={field} />
                  ) : field.objectChanges?.length ? (
                    <ObjectChangeList changes={field.objectChanges} />
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded bg-rose-950/50 p-2 text-xs">
                        <div className="font-bold text-rose-200">Before</div>
                        <pre className={`mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words app-scrollbar ${propertyRemoved ? 'font-bold text-rose-200' : ''}`}>{valuePreview(field.before)}</pre>
                      </div>
                      <div className="rounded bg-emerald-950/50 p-2 text-xs">
                        <div className="font-bold text-emerald-200">After</div>
                        <pre className={`mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words app-scrollbar ${propertyAdded ? 'font-bold text-emerald-200' : ''}`}>{valuePreview(field.after)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <pre className="max-h-72 overflow-auto rounded-lg bg-black/25 p-3 text-xs whitespace-pre-wrap break-words app-scrollbar">
              {JSON.stringify(record.data || record, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function FileDiff({ file, lang, heroMap, storeAssetMap, typeFilter = '', hideVisual = false }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash.startsWith(`#rec-${slug(filePath(file))}-`));
  const show = (type) => !typeFilter || typeFilter === type;
  const added = show('added') ? file.added || [] : [];
  const rawChanged = show('changed') ? file.changed || [] : [];
  const changedSummary = filePath(file) === 'Game/powerTypes.csv'
    ? summarizeCommonPowerFields(rawChanged.map((record) => ({ type: 'changed', record })))
    : { entries: rawChanged.map((record) => ({ type: 'changed', record })), commonFields: [] };
  const changed = changedSummary.entries.map((entry) => entry.record);
  const changedGroups = identicalChangedRecordGroups(changed);
  const removed = show('removed') ? file.removed || [] : [];
  const total = added.length + removed.length + rawChanged.length;
  if (!total && !file.fileAdded && !file.fileRemoved) return null;
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-col gap-3 p-3 text-left sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-bold text-white">{file.label || file.file}</h3>
            {file.fileAdded && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200">New file</span>}
            {file.fileRemoved && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-200">Removed file</span>}
          </div>
          <div className="mt-1 break-words text-xs text-slate-400">{file.section}/{file.file} - keyed by {file.key || 'record'}</div>
          <AddedPreviewStrip file={file} records={added} heroMap={heroMap} storeAssetMap={storeAssetMap} lang={lang} />
        </div>
        <div className="flex flex-wrap gap-2">
          <CountPill label="Added" value={added.length} tone="emerald" />
          <CountPill label="Changed" value={rawChanged.length} tone="amber" />
          <CountPill label="Removed" value={removed.length} tone="rose" />
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-700 p-3">
          <CommonPowerFieldSummary fields={changedSummary.commonFields} />
          {added.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-200">Added</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">
                {added.map((record, index) => <RecordCard key={`${record.id}-${index}`} type="added" record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
              </div>
            </section>
          )}
          {changed.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-200">Changed</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">
                {changedGroups.map((records, index) => <ChangedRecordGroup key={`${records[0]?.id || index}-${index}`} records={records} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} hideVisual={hideVisual} />)}
              </div>
            </section>
          )}
          {removed.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-rose-200">Removed</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">
                {removed.map((record, index) => <RecordCard key={`${record.id}-${index}`} type="removed" record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

const tierInfo = {
  gameplay: { title: 'Gameplay data', description: 'Attacks, legends, stats, maps, modes and mechanics.' },
  content: { title: 'Content data', description: 'Cosmetics, store, events, missions and other content.' },
  engine: { title: 'Animation and engine data', description: 'Bones, sprites, file lists and other art or engine data. Never changes gameplay.' },
};

function TierGroup({ tier, files, children }) {
  const [open, setOpen] = useState(tier !== 'engine');
  if (!files.length) return null;
  const total = files.reduce((sum, file) => sum + (file.added?.length || 0) + (file.changed?.length || 0) + (file.removed?.length || 0), 0);
  return (
    <section className="space-y-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-end justify-between gap-3 border-b border-slate-800 pb-2 text-left">
        <div>
          <h3 className="text-base font-bold uppercase tracking-wide text-slate-200">{tierInfo[tier].title}</h3>
          <p className="max-w-prose text-xs text-slate-400">{tierInfo[tier].description}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{files.length} file{files.length === 1 ? '' : 's'} · {total} change{total === 1 ? '' : 's'} · {open ? 'Hide' : 'Show'}</span>
      </button>
      {open && children}
    </section>
  );
}

function fileTier(file) {
  if (file.tier) return file.tier;
  if (file.section === 'Engine' || /^(BoneTypes|BoneSources|AnimTypes|TileTypes)\.xml$/.test(file.file) || /SpriteData\.csv$/i.test(file.file)) return 'engine';
  if (/^(powerTypes\.csv|HeroTypes\.xml|RuneTypes\.xml|StatTypes\.xml|DodgeTypes\.xml|hurtboxTypes\.csv|GameModeTypes\.xml|LevelSetTypes\.xml|LevelTypes\.xml)$/.test(file.file) || /^LevelDesc_/.test(file.file)) return 'gameplay';
  return 'content';
}

function readLastSeen() {
  try {
    return window.localStorage.getItem('patch-history-last-seen') || '';
  } catch {
    return '';
  }
}

function writeLastSeen(manifest) {
  try {
    window.localStorage.setItem('patch-history-last-seen', manifest);
  } catch {}
}

function wholePatchSelection(group, patches) {
  const newest = group.manifests[0];
  if (group.manifests.length === 1) return { manifest: String(newest.manifest), from: '' };
  const release = group.manifests[group.manifests.length - 1];
  const releaseIndex = patches.findIndex((patch) => String(patch.manifest) === String(release.manifest));
  const before = patches[releaseIndex + 1];
  return { manifest: String(newest.manifest), from: before ? String(before.manifest) : '' };
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function History() {
  const [patches, setPatches] = useState([]);
  const [selectedPatch, setSelectedPatch] = useState(null);
  const [compareFrom, setCompareFrom] = useState('');
  const [listRequest, setListRequest] = useState(0);
  const [historyRequest, setHistoryRequest] = useState(0);
  const [knownEmpty, setKnownEmpty] = useState(() => new Set());
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [hideVisual, setHideVisual] = useState(false);
  const [viewMode, setViewMode] = useState('minimal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState({});
  const [heroMap, setHeroMap] = useState({});
  const [storeAssetMap, setStoreAssetMap] = useState({});
  const [lastSeen, setLastSeen] = useState('');
  const notesState = usePatchNotes(viewMode === 'minimal' ? selectedPatch : null, compareFrom);

  useEffect(() => {
    setError('');
    setLastSeen(readLastSeen());
    fetch(`${host}/game/history/all`)
      .then((res) => {
        if (!res.ok) throw new Error(`Patch list request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPatches(list);
        const params = readPatchParams();
        if (params.view === 'full') setViewMode('full');
        const linked = list.find((patch) => String(patch.manifest) === params.patch);
        if (linked) {
          setSelectedPatch(String(linked.manifest));
          if (params.from) setCompareFrom(params.from);
          return;
        }
        const first = patchGroups(list)[0];
        if (first) {
          const selection = wholePatchSelection(first, list);
          setSelectedPatch(selection.manifest);
          setCompareFrom(selection.from);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Couldn't load the patch list.");
      });
  }, [listRequest]);

  useEffect(() => {
    fetch(`${host}/game/langs/0`)
      .then((res) => res.json())
      .then((data) => setLang(data?.[0]?.content || {}))
      .catch((err) => {
        console.error(err);
        setLang({});
      });
  }, []);

  useEffect(() => {
    fetch(`${host}/game/metadata/Game/HeroTypes.xml`)
      .then((res) => res.json())
      .then((data) => setHeroMap(buildHeroMap(data)))
      .catch((err) => {
        console.error(err);
        setHeroMap({});
      });
  }, []);

  useEffect(() => {
    Promise.all([
      'Game/costumeTypes.csv',
      'Game/weaponSkinTypes.csv',
      'Game/avatarTypes.csv',
      'Game/TauntTypes.xml',
      'Game/PodiumTypes.xml',
      'Game/ColorSchemeTypes.xml',
      'Game/EmojiTypes.xml',
      'Game/CompanionTypes.xml',
      'Game/SpawnBotTypes.xml',
      'Game/TrailEffectTypes.xml',
      'Game/EmitterGroupTypes.xml',
      'Game/MonikerTypes.xml',
      'Game/PlayerThemeTypes.xml',
      'Game/SeasonBorderTypes.xml',
    ].map((file) => fetch(`${host}/game/metadata/${file}`).then((res) => res.json())))
      .then((data) => setStoreAssetMap(buildStoreAssetMap(data)))
      .catch((err) => {
        console.error(err);
        setStoreAssetMap({});
      });
  }, []);

  useEffect(() => {
    if (!selectedPatch || viewMode !== 'full') return;
    setLoading(true);
    setError('');
    setHistoryData(null);
    const from = compareFrom ? `?from=${encodeURIComponent(compareFrom)}` : '';
    fetch(`${host}/game/history/${selectedPatch}${from}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Patch history request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHistoryData(data);
        if (!compareFrom && !(data?.files || []).length) {
          setKnownEmpty((current) => new Set(current).add(String(data.manifest)));
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Couldn't load this patch.");
      })
      .finally(() => setLoading(false));
  }, [selectedPatch, compareFrom, historyRequest, viewMode]);

  useEffect(() => {
    if (!selectedPatch || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('patch', selectedPatch);
    if (compareFrom) params.set('from', compareFrom); else params.delete('from');
    if (viewMode === 'full') params.set('view', 'full'); else params.delete('view');
    window.history.replaceState(null, '', `${window.location.pathname}?${params}${window.location.hash}`);
  }, [selectedPatch, compareFrom, viewMode]);

  const groups = useMemo(() => patchGroups(patches), [patches]);
  const manifestNames = useMemo(() => new Map(groups.flatMap((group) => group.manifests
    .map((patch, index) => [String(patch.manifest), `Patch ${group.patch}${group.manifests.length > 1 ? ` ${manifestLabel(group, index)}` : ''}`]))), [groups]);
  const isEmptyManifest = (patch) => patch.empty === true || knownEmpty.has(String(patch.manifest));
  const olderManifests = useMemo(() => {
    const index = patches.findIndex((patch) => String(patch.manifest) === String(selectedPatch));
    return index < 0 ? [] : patches.slice(index + 1);
  }, [patches, selectedPatch]);
  const activeGroup = groups.find((group) => group.manifests.some((patch) => String(patch.manifest) === String(selectedPatch)));
  const activeWhole = activeGroup ? wholePatchSelection(activeGroup, patches) : null;
  const isWholePatch = !!activeGroup && activeGroup.manifests.length > 1 && activeWhole.manifest === String(selectedPatch) && activeWhole.from === compareFrom;
  const selectedPatchInfo = patches.find((patch) => String(patch.manifest) === String(selectedPatch));
  const releaseInfo = activeGroup ? activeGroup.manifests[activeGroup.manifests.length - 1] : null;
  const official = selectedPatchInfo?.official || releaseInfo?.official || notesState.notes?.official || null;

  useEffect(() => {
    if (!groups.length || !activeGroup || typeof window === 'undefined') return;
    if (activeGroup === groups[0]) writeLastSeen(String(groups[0].manifests[0].manifest));
  }, [groups, activeGroup]);

  const filteredFiles = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (historyData?.files || []).filter((file) => {
      if (category && file.label !== category) return false;
      if (!text) return true;
      return [
        file.label,
        file.section,
        file.file,
        file.key,
        ...(file.added || []).map((record) => `${record.name} ${record.id}`),
        ...(file.changed || []).map((record) => `${record.name} ${record.id} ${record.fields?.map((field) => field.field).join(' ')}`),
        ...(file.removed || []).map((record) => `${record.name} ${record.id}`),
      ].join(' ').toLowerCase().includes(text);
    });
  }, [historyData, query, category]);

  const tierFiles = useMemo(() => ({
    gameplay: filteredFiles.filter((file) => fileTier(file) === 'gameplay'),
    content: filteredFiles.filter((file) => fileTier(file) === 'content'),
    engine: filteredFiles.filter((file) => fileTier(file) === 'engine'),
  }), [filteredFiles]);

  const tierTotals = useMemo(() => Object.fromEntries(['gameplay', 'content', 'engine'].map((tier) => [tier, (historyData?.files || [])
    .filter((file) => fileTier(file) === tier)
    .reduce((sum, file) => sum + (file.added?.length || 0) + (file.changed?.length || 0) + (file.removed?.length || 0), 0)])), [historyData]);

  const selectGroup = (group) => {
    const selection = wholePatchSelection(group, patches);
    setSelectedPatch(selection.manifest);
    setCompareFrom(selection.from);
    setCategory('');
    setQuery('');
    setIsSidebarOpen(false);
  };
  const selectManifest = (patch) => {
    setSelectedPatch(String(patch.manifest));
    setCompareFrom('');
    setCategory('');
    setQuery('');
    setIsSidebarOpen(false);
  };

  const imageFor = (path, data) => {
    const [section, ...rest] = String(path).split('/');
    return recordImage({ section, file: rest.join('/') }, { data }, heroMap, storeAssetMap);
  };
  const storeImageFor = (data) => addedStorePreviewItem({ data }, heroMap, storeAssetMap, lang);
  const databaseUrlFor = (path, data) => {
    const [section, ...rest] = String(path).split('/');
    return databaseRecordUrl({ section, file: rest.join('/') }, { data }, storeAssetMap);
  };

  const sidebar = (
    <aside className="flex h-full flex-col gap-2 bg-slate-950 p-2">
      <div>
        <h1 className="text-xl font-bold text-white">Patch History</h1>
      </div>
      <div className="flex-1 overflow-y-auto app-scrollbar pr-1">
        <div className="space-y-2">
          {groups.map((group, groupIndex) => {
            const release = group.manifests[group.manifests.length - 1];
            const groupActive = group.manifests.some((patch) => String(patch.manifest) === String(selectedPatch));
            const allEmpty = group.manifests.every(isEmptyManifest);
            const visibleHotfixes = group.manifests.filter((patch, index) => index !== group.manifests.length - 1 && (viewMode === 'full' || !isEmptyManifest(patch)));
            const lastSeenIndex = lastSeen ? patches.findIndex((patch) => String(patch.manifest) === lastSeen) : -1;
            const newestIndex = patches.findIndex((patch) => String(patch.manifest) === String(group.manifests[0].manifest));
            const isNew = lastSeenIndex > 0 && newestIndex < lastSeenIndex;
            const title = release.title || group.manifests.find((patch) => patch.title)?.title || '';
            return (
              <div
                key={`${group.patch}-${release.manifest}`}
                className={`rounded-xl border transition ${groupActive ? 'border-blue-400 bg-blue-500/15' : 'border-slate-800 bg-slate-900 hover:border-slate-600'} ${allEmpty && !groupActive ? 'opacity-50' : ''}`}
              >
                <button type="button" className="w-full p-3 text-left" onClick={() => selectGroup(group)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-base font-bold text-white">
                      Patch {group.patch}
                      {release.patchInferred && <span className="cursor-help text-xs font-normal text-slate-400" title="Patch number guessed from the patches around it. The game files don't name it.">≈</span>}
                      {isNew && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">New</span>}
                    </span>
                    {visibleHotfixes.length > 0 && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{visibleHotfixes.length} hotfix{visibleHotfixes.length === 1 ? '' : 'es'}</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(release.date)}</div>
                  {title && <div className="mt-1 line-clamp-2 text-xs text-slate-300">{title}</div>}
                  {!title && groupIndex === 0 && allEmpty && <div className="mt-1 text-[10px] font-bold text-slate-500">No data changes</div>}
                </button>
                {groupActive && (visibleHotfixes.length > 0 || (viewMode === 'full' && group.manifests.length > 1)) && (
                  <div className="space-y-1 border-t border-slate-800 p-1.5">
                    {group.manifests.map((patch, index) => {
                      const isRelease = index === group.manifests.length - 1;
                      if (!isRelease && viewMode !== 'full' && isEmptyManifest(patch)) return null;
                      const active = String(selectedPatch) === String(patch.manifest) && !compareFrom;
                      const empty = isEmptyManifest(patch);
                      return (
                        <button
                          key={patch.manifest}
                          type="button"
                          title={`Manifest ${patch.manifest}`}
                          onClick={() => selectManifest(patch)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs ${active ? 'bg-blue-500/30 text-white' : 'text-slate-300 hover:bg-slate-800'} ${empty && !active ? 'opacity-50' : ''}`}
                        >
                          <span className="font-bold">{manifestLabel(group, index)}</span>
                          <span className="text-slate-400">{empty ? 'No data changes' : formatDate(patch.date).replace(/, \d{4}/, '')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );

  const notes = notesState.notes;
  const headerTitle = selectedPatchInfo ? `Patch ${selectedPatchInfo.patch}` : 'Patch';
  const scopeLabel = isWholePatch
    ? `Whole patch · release and ${activeGroup.manifests.length - 1} hotfix${activeGroup.manifests.length === 2 ? '' : 'es'}`
    : compareFrom
      ? `Compared with ${manifestNames.get(String(compareFrom)) || 'an older update'}`
      : manifestNames.get(String(selectedPatch)) || headerTitle;
  const busy = viewMode === 'minimal' ? notesState.loading : loading;
  const shownError = error || (viewMode === 'minimal' ? notesState.error : '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-16 z-30 flex items-center justify-between border-b [@media(max-height:500px)]:static border-slate-800 bg-slate-950/95 px-2 py-1.5 backdrop-blur sm:px-3 lg:hidden">
        <div>
          <div className="text-lg font-bold">Patch History</div>
          <div className="text-xs text-slate-400">{selectedPatchInfo ? headerTitle : 'Select a patch'}</div>
        </div>
        <button type="button" onClick={() => setIsSidebarOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold">Patches</button>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40 lg:hidden [@media(max-height:500px)]:top-0 [@media(max-height:500px)]:z-[110]">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)} aria-label="Close patches" tabIndex={-1} />
          <div className="relative h-full w-[min(calc(100vw-3.5rem),24rem)]">{sidebar}</div>
          <button type="button" onClick={() => setIsSidebarOpen(false)} aria-label="Close patches" className="absolute top-2 left-[min(calc(100vw-3.5rem),24rem)] ml-2 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)_18rem] min-[137.5rem]:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <div className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-hidden border-r border-slate-800 lg:block">{sidebar}</div>
        <main className="min-w-0 p-2 sm:p-3">
          {shownError && (
            <div className="mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">
              <span>{shownError}</span>
              <button
                type="button"
                onClick={() => {
                  if (!patches.length) setListRequest((value) => value + 1);
                  else if (viewMode === 'minimal') notesState.retry();
                  else setHistoryRequest((value) => value + 1);
                }}
                className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-bold text-rose-100 hover:bg-rose-500/30"
              >
                Retry
              </button>
            </div>
          )}
          {selectedPatchInfo && (
            <div className="space-y-3">
              <header className="rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-300" title={`Manifest ${selectedPatch}`}>{scopeLabel}</div>
                    <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                      {headerTitle}
                      {selectedPatchInfo.patchInferred && <span className="ml-2 cursor-help align-middle text-sm font-normal text-slate-400" title="Patch number guessed from the patches around it. The game files don't name it.">number inferred</span>}
                    </h2>
                    <div className="mt-1 text-sm text-slate-400">{formatDate(isWholePatch && releaseInfo ? releaseInfo.date : selectedPatchInfo.date)}</div>
                    {viewMode === 'minimal' && notes && !notes.empty && <p className="mt-2 max-w-prose text-base text-slate-200">{notes.title}</p>}
                    {official && (
                      <a href={official.url || official.listing} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-300 hover:underline">
                        {official.url ? `Official notes: ${official.title}` : 'Official patch notes'} ↗
                      </a>
                    )}
                    {activeGroup && activeGroup.manifests.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => selectGroup(activeGroup)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${isWholePatch ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Whole patch</button>
                        {[...activeGroup.manifests].reverse().map((patch) => {
                          const index = activeGroup.manifests.indexOf(patch);
                          if (viewMode !== 'full' && index !== activeGroup.manifests.length - 1 && isEmptyManifest(patch)) return null;
                          const active = String(selectedPatch) === String(patch.manifest) && !compareFrom;
                          return (
                            <button key={patch.manifest} type="button" onClick={() => selectManifest(patch)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                              {manifestLabel(activeGroup, index)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 xl:items-end">
                    {viewMode === 'minimal' && notes && !notes.empty && (
                      <div className="flex flex-wrap gap-2">
                        {notes.counts.balance > 0 && <CountPill label="Balance changes" value={notes.counts.balance} tone="amber" />}
                        {notes.counts.legendsAdded > 0 && <CountPill label="New legends" value={notes.counts.legendsAdded} tone="blue" />}
                        {notes.counts.mapsAdded > 0 && <CountPill label="New maps" value={notes.counts.mapsAdded} tone="blue" />}
                        {notes.counts.cosmetics > 0 && <CountPill label="New cosmetics" value={notes.counts.cosmetics} tone="emerald" />}
                        {notes.counts.prices > 0 && <CountPill label="Price changes" value={notes.counts.prices} tone="rose" />}
                      </div>
                    )}
                    {viewMode === 'full' && historyData && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <CountPill label="Gameplay" value={tierTotals.gameplay} tone="amber" />
                          <CountPill label="Content" value={tierTotals.content} tone="emerald" />
                          <CountPill label="Engine" value={tierTotals.engine} />
                        </div>
                        <div className="text-xs text-slate-400">
                          {historyData.summary?.added || 0} added · {historyData.summary?.changed || 0} changed · {historyData.summary?.removed || 0} removed in {historyData.summary?.files || 0} file{historyData.summary?.files === 1 ? '' : 's'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('minimal');
                      setCategory('');
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${viewMode === 'minimal' ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    Patch notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('full')}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${viewMode === 'full' ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    Full data diff
                  </button>
                  {viewMode === 'full' && historyData && (
                    <button type="button" onClick={() => downloadJson(historyData, `patch-${historyData.patch}-${historyData.manifest}${compareFrom ? `-from-${compareFrom}` : ''}.json`)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:border-slate-500">
                      Download JSON
                    </button>
                  )}
                </div>
                {viewMode === 'full' && olderManifests.length > 0 && (
                  <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    Compare with
                    <select
                      value={compareFrom}
                      onChange={(event) => setCompareFrom(event.target.value)}
                      className="max-w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white outline-none focus:border-blue-400"
                    >
                      <option value="">{manifestNames.get(String(olderManifests[0].manifest)) || 'Previous update'} (previous)</option>
                      {olderManifests.slice(1).map((patch) => (
                        <option key={patch.manifest} value={String(patch.manifest)}>
                          {manifestNames.get(String(patch.manifest)) || `Patch ${patch.patch}`} - {formatDate(patch.date)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </header>

              {busy && <div className="max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300">Loading patch data…</div>}

              {viewMode === 'minimal' && notes && (
                <PatchNotes
                  notes={notes}
                  imageFor={imageFor}
                  storeImageFor={storeImageFor}
                  databaseUrlFor={databaseUrlFor}
                  onOpenFull={() => setViewMode('full')}
                />
              )}

              {viewMode === 'full' && !loading && historyData && (
                <>
                  {historyData.categorySummary?.length > 0 && (
                    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-white">Changed Areas</h3>
                        {category && <button type="button" onClick={() => setCategory('')} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Show all areas</button>}
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 app-scrollbar">
                        {historyData.categorySummary.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setCategory(category === item.label ? '' : item.label)}
                            className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm ${category === item.label ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'}`}
                          >
                            <div className="font-bold">{item.label}</div>
                            <div className="text-xs text-slate-400">{item.added} added - {item.changed} changed - {item.removed} removed</div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {(historyData.files || []).length > 0 && (
                    <section className="flex max-w-5xl flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 md:flex-row md:items-center">
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search files, names, IDs or changed fields"
                        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                      />
                      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                        <option value="">All Changes</option>
                        <option value="added">Added only</option>
                        <option value="changed">Changed only</option>
                        <option value="removed">Removed only</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={hideVisual} onChange={(event) => setHideVisual(event.target.checked)} />
                        Hide visual fields
                      </label>
                    </section>
                  )}

                  {filteredFiles.length ? (
                    <div className="space-y-3">
                      {['gameplay', 'content', 'engine'].map((tier) => (
                        <TierGroup key={tier} tier={tier} files={tierFiles[tier]}>
                          <div className="space-y-3">
                            {tierFiles[tier].map((file) => <FileDiff key={`${file.section}/${file.file}`} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} typeFilter={typeFilter} hideVisual={hideVisual} />)}
                          </div>
                        </TierGroup>
                      ))}
                    </div>
                  ) : (
                    <div className="max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400">
                      {(historyData.files || []).length
                        ? 'No matching changes for this filter.'
                        : 'No game data changed. Probably a client, art or server update.'}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {!selectedPatchInfo && !shownError && (
            <div className="max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300">{patches.length ? 'Pick a patch' : 'Loading patches…'}</div>
          )}
        </main>
        <aside aria-label="On this page" className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] space-y-3 self-start overflow-y-auto border-l border-slate-800 p-2 app-scrollbar 2xl:block">
          {selectedPatchInfo && (
            <AsideBox title={headerTitle}>
              <FactList
                rows={[
                  { label: 'Date', value: formatDate(isWholePatch && releaseInfo ? releaseInfo.date : selectedPatchInfo.date) },
                  ...(viewMode === 'minimal' && notes && !notes.empty ? [
                    { label: 'Balance changes', value: notes.counts.balance || null },
                    { label: 'New legends', value: notes.counts.legendsAdded || null },
                    { label: 'New maps', value: notes.counts.mapsAdded || null },
                    { label: 'New cosmetics', value: notes.counts.cosmetics || null },
                    { label: 'Price changes', value: notes.counts.prices || null },
                  ] : []),
                  ...(viewMode === 'full' && historyData ? [
                    { label: 'Files', value: historyData.summary?.files || 0 },
                    { label: 'Added', value: historyData.summary?.added || 0 },
                    { label: 'Changed', value: historyData.summary?.changed || 0 },
                    { label: 'Removed', value: historyData.summary?.removed || 0 },
                  ] : []),
                ]}
              />
              {official && (
                <a href={official.url || official.listing} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-blue-300 hover:underline">Official notes ↗</a>
              )}
            </AsideBox>
          )}
          {viewMode === 'minimal' && notes && <OnThisPage items={patchContents(notes).map(([id, label]) => ({ id, label }))} />}
          {viewMode === 'full' && historyData?.categorySummary?.length > 0 && (
            <AsideBox title="Changed Areas">
              <LinkList
                items={[
                  { key: 'all', label: 'All areas', active: !category, onClick: () => setCategory('') },
                  ...historyData.categorySummary.map((item) => ({ key: item.label, label: item.label, count: item.added + item.changed + item.removed, active: category === item.label, onClick: () => setCategory(category === item.label ? '' : item.label) })),
                ]}
              />
            </AsideBox>
          )}
        </aside>
      </div>
    </div>
  );
}
