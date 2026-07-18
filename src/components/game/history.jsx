import { useEffect, useMemo, useState } from 'react';
import { host } from '../../stuff';

const sectionColors = {
  added: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  changed: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  removed: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

const minimalFiles = new Set([
  'Game/powerTypes.csv',
  'Game/HeroTypes.xml',
  'Game/GeoTypes.xml',
  'Game/RegionTypes.xml',
  'Game/costumeTypes.csv',
  'Game/DodgeTypes.xml',
  'Game/LevelSetTypes.xml',
  'Game/GameModeTypes.xml',
  'Game/hurtboxTypes.csv',
  'Game/RuneTypes.xml',
  'Game/SkirmishTypes.xml',
  'Game/SkirmishRewardTypes.xml',
  'Game/SkirmishFactionTypes.xml',
  'Game/storeTypes.csv',
  'Game/StatTypes.xml',
  'Init/LevelTypes.xml',
  'Init/ControllerTypes.xml',
]);

const minimalDynamicPattern = /^Dynamic\/LevelDesc_/i;
const legendGroupedFiles = new Set(['Game/HeroTypes.xml', 'Game/RuneTypes.xml']);

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

function isMinimalFile(file) {
  const path = filePath(file);
  return minimalFiles.has(path) || minimalDynamicPattern.test(path);
}

const weaponPowerPrefixes = [
  { prefix: 'Greatsword', weapon: 'Greatsword', label: 'Greatsword', icon: 'Greatsword' },
  { prefix: 'RocketLance', weapon: 'RocketLance', label: 'Rocket Lance', icon: 'RocketLance' },
  { prefix: 'Lance', weapon: 'RocketLance', label: 'Rocket Lance', icon: 'RocketLance' },
  { prefix: 'Cannon', weapon: 'Cannon', label: 'Cannon', icon: 'Cannon' },
  { prefix: 'Chakram', weapon: 'Chakram', label: 'Chakram', icon: 'Chakram' },
  { prefix: 'Gauntlet', weapon: 'Fists', label: 'Gauntlets', icon: 'Fists' },
  { prefix: 'Fists', weapon: 'Fists', label: 'Gauntlets', icon: 'Fists' },
  { prefix: 'Scythe', weapon: 'Scythe', label: 'Scythe', icon: 'Scythe' },
  { prefix: 'Pistol', weapon: 'Pistol', label: 'Blasters', icon: 'Pistol' },
  { prefix: 'Blasters', weapon: 'Pistol', label: 'Blasters', icon: 'Pistol' },
  { prefix: 'Hammer', weapon: 'Hammer', label: 'Hammer', icon: 'Hammer' },
  { prefix: 'Spear', weapon: 'Spear', label: 'Spear', icon: 'Spear' },
  { prefix: 'Katar', weapon: 'Katar', label: 'Katars', icon: 'Katar' },
  { prefix: 'Sword', weapon: 'Sword', label: 'Sword', icon: 'Sword' },
  { prefix: 'Boots', weapon: 'Boots', label: 'Battle Boots', icon: 'Boots' },
  { prefix: 'Orb', weapon: 'Orb', label: 'Orb', icon: 'Orb' },
  { prefix: 'Bow', weapon: 'Bow', label: 'Bow', icon: 'Bow' },
  { prefix: 'Axe', weapon: 'Axe', label: 'Axe', icon: 'Axe' },
  { prefix: 'Base', weapon: 'Unarmed', label: 'Unarmed', icon: 'Fists' },
  { prefix: 'Unarmed', weapon: 'Unarmed', label: 'Unarmed', icon: 'Fists' },
];

const powerMovePatterns = [
  ['SmashDown', 'dSig'],
  ['SmashNeutral', 'nSig'],
  ['SmashSide', 'sSig'],
  ['SmashUp', 'nSig'],
  ['AirUpHeavy', 'Recovery'],
  ['AirDown', 'dAir'],
  ['AirNeutral', 'nAir'],
  ['AirSide', 'sAir'],
  ['GroundPound', 'Ground Pound'],
  ['Recovery', 'Recovery'],
  ['Down', 'dLight'],
  ['Neutral', 'nLight'],
  ['Side', 'sLight'],
  ['Up', 'nLight'],
  ['Air', 'nAir'],
];

function cleanPowerValue(value) {
  const text = String(value ?? '').trim();
  return text && text !== '---' && text !== '----' && text !== '--' ? text : '';
}

function powerSource(record) {
  return record?.after || record?.data || record?.before || {};
}

function signatureSourcePower(source, powerName) {
  return cleanPowerValue(source?.OriginPower) || powerName;
}

const powerContinuationFields = [
  'ComboName',
  'ComboOverrideIfHit',
  'ComboOverrideIfRelease',
  'ComboOverrideIfWall',
  'ComboOverrideIfButton',
  'OriginOverrideIfInMode',
  'ComboOverrideIfDir',
  'ComboOverrideIfInterrupt',
  'BGPowerOnFire',
  'ExhaustedVersion',
  'GCVersion',
  'MomentumVersion',
];

function powerHasContinuation(source) {
  return powerContinuationFields.some((field) => cleanPowerValue(source?.[field]));
}

function powerPartNumber(remainder, token) {
  const match = remainder.match(new RegExp(`${token}(\\d*)`, 'i'));
  if (!match) return 1;
  return match[1] ? Number(match[1]) + 1 : 2;
}

function powerVariantLabel(remainder, source) {
  const continues = powerHasContinuation(source);
  const isCombo = /Combo\d*/i.test(remainder);
  const isHit = /Hit(?:Ground)?\d*/i.test(remainder);
  const isMiss = /Miss/i.test(remainder);
  const wall = /BG/i.test(remainder);

  if (!continues && (isCombo || isHit || isMiss || cleanPowerValue(source?.OriginPower))) {
    return wall ? 'final - wall variant' : 'final';
  }
  if (isHit) {
    const part = powerPartNumber(remainder, 'Hit(?:Ground)?');
    return wall ? `on-hit part ${part} - wall variant` : `on-hit part ${part}`;
  }
  if (isMiss) return wall ? 'miss - wall variant' : 'miss';
  if (isCombo) {
    const part = powerPartNumber(remainder, 'Combo');
    return wall ? `part ${part} - wall variant` : `part ${part}`;
  }
  if (wall) return 'wall variant';
  return continues ? 'part 1' : 'final';
}

function parsePowerRecord(record, heroMap = {}) {
  const source = powerSource(record);
  const powerName = cleanPowerValue(source.PowerName || record?.name || record?.id);
  if (!powerName || /^(Template|Taunt|Gadget|Item|Bomb|Mine|SpikeBall|Horn|Sidekick)/i.test(powerName)) return null;
  const weapon = weaponPowerPrefixes.find((entry) => powerName.startsWith(entry.prefix));
  if (!weapon) return null;

  const remainder = powerName.slice(weapon.prefix.length);
  const move = powerMovePatterns.find(([token]) => remainder.includes(token));
  if (!move) return null;

  const signaturePower = signatureSourcePower(source, powerName);
  const heroData = heroMap.__powers?.[signaturePower];
  const hero = heroData ? heroData.code : Object.keys(heroMap)
    .filter((code) => code !== '__powers')
    .sort((a, b) => b.length - a.length)
    .find((code) => remainder.endsWith(code));
  const suffixHeroData = hero && !heroData ? heroMap[hero] : null;
  return {
    powerName,
    weapon,
    hero: heroData || suffixHeroData || null,
    kind: heroData || suffixHeroData ? 'signature' : 'base',
    move: move[1],
    variant: powerVariantLabel(remainder, source),
    description: cleanPowerValue(source.DevNotes),
    source,
  };
}

function minimalRecords(file, records, type) {
  if (filePath(file) !== 'Game/powerTypes.csv') return records || [];
  return (records || []).filter((record) => !!parsePowerRecord(record));
}

function typedRecords(file) {
  return [
    ...(file.added || []).map((record) => ({ type: 'added', record })),
    ...(file.changed || []).map((record) => ({ type: 'changed', record })),
    ...(file.removed || []).map((record) => ({ type: 'removed', record })),
  ];
}

function valuePreview(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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

function mapNameFromFile(file) {
  return String(file?.file || '').replace(/^LevelDesc_/i, '').replace(/\.xml$/i, '');
}

function buildLevelMap(data) {
  const levels = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return levels.reduce((acc, level) => {
    const name = cleanPowerValue(level?.LevelName);
    if (!name) return acc;
    acc[name] = {
      name,
      displayName: cleanPowerValue(level?.DisplayName) || name,
      thumbnail: cleanPowerValue(level?.ThumbnailPNGFile),
    };
    return acc;
  }, {});
}

function mapImageUrl(file, levelMap = {}) {
  const mapName = mapNameFromFile(file);
  const info = levelMap[mapName];
  const thumbnail = cleanPowerValue(info?.thumbnail) || `${mapName.toLowerCase()}.jpg`;
  return thumbnail && thumbnail !== '--.jpg' ? `${host}/game/images/images/thumbnails/${thumbnail}` : '';
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

function FieldValuePills({ values, tone }) {
  if (!values?.length) return <span className="text-xs text-slate-400">None</span>;
  const colors = tone === 'added'
    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
    : 'border-rose-400/30 bg-rose-500/15 text-rose-100';
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map((value) => (
        <span key={value} className={`rounded-lg border px-2 py-1 text-xs font-bold ${colors}`}>{value}</span>
      ))}
    </div>
  );
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

function RecordCard({ type, record, file, lang, heroMap, storeAssetMap }) {
  const [open, setOpen] = useState(false);
  const isChange = type === 'changed';
  const image = recordImage(file, record, heroMap, storeAssetMap);
  const title = recordTitle(record, lang);
  const splitCommaFields = filePath(file) !== 'Game/powerTypes.csv';
  return (
    <div className={`rounded-xl border p-3 ${sectionColors[type] || sectionColors.changed}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex min-w-0 items-start gap-3">
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
          {record.id && <div className="mt-0.5 text-xs opacity-75">ID {record.id}</div>}
          {isChange && <div className="mt-1 text-xs opacity-75">{record.fields?.length || 0} field change{record.fields?.length === 1 ? '' : 's'}</div>}
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-xs">{open ? 'Hide' : 'View'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {isChange ? (
            record.fields?.map((field) => {
              const listDiff = splitCommaFields ? fieldListDiff(field) : null;
              return (
              <div key={field.field} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-300">{displayFieldName(field.field)}</div>
                {listDiff ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded bg-rose-950/50 p-2">
                      <div className="text-xs font-bold text-rose-200">Removed</div>
                      <FieldValuePills values={listDiff.removedValues} tone="removed" />
                    </div>
                    <div className="rounded bg-emerald-950/50 p-2">
                      <div className="text-xs font-bold text-emerald-200">Added</div>
                      <FieldValuePills values={listDiff.addedValues} tone="added" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded bg-rose-950/50 p-2 text-xs">
                      <div className="font-bold text-rose-200">Before</div>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words app-scrollbar">{valuePreview(field.before)}</pre>
                    </div>
                    <div className="rounded bg-emerald-950/50 p-2 text-xs">
                      <div className="font-bold text-emerald-200">After</div>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words app-scrollbar">{valuePreview(field.after)}</pre>
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

function PowerFieldDiff({ field }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-300">{displayFieldName(field.field)}</div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded bg-rose-950/50 p-2 text-xs">
          <div className="font-bold text-rose-200">Before</div>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words app-scrollbar">{valuePreview(field.before)}</pre>
        </div>
        <div className="rounded bg-emerald-950/50 p-2 text-xs">
          <div className="font-bold text-emerald-200">After</div>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words app-scrollbar">{valuePreview(field.after)}</pre>
        </div>
      </div>
    </div>
  );
}

function numericSignal(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === '--' || text === '---' || text === '----') return null;
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true' ? 1 : 0;
  const numbers = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (!numbers.length) return null;
  return numbers.reduce((total, number) => total + number, 0) / numbers.length;
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

function classifyPowerField(field) {
  const before = numericSignal(field.before);
  const after = numericSignal(field.after);
  if (before === null || after === null || before === after) return null;
  const increased = after > before;
  if (matchesAny(field.field, powerBuffIncreaseFields)) return increased ? 'buff' : 'nerf';
  if (matchesAny(field.field, powerNerfIncreaseFields)) return increased ? 'nerf' : 'buff';
  if (matchesAny(field.field, powerBooleanBuffFields)) return increased ? 'buff' : 'nerf';
  if (matchesAny(field.field, powerBooleanNerfFields)) return increased ? 'nerf' : 'buff';
  return null;
}

function classifyPowerChange(entry) {
  if (entry.type !== 'changed') return null;
  const fieldResults = (entry.record.fields || []).map(classifyPowerField).filter(Boolean);
  const buffCount = fieldResults.filter((result) => result === 'buff').length;
  const nerfCount = fieldResults.filter((result) => result === 'nerf').length;
  if (buffCount > 0 && nerfCount > 0) return { label: 'Mixed', className: 'border-sky-300/40 bg-sky-500/20 text-sky-100' };
  if (buffCount > 0) return { label: 'Buff', className: 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100' };
  if (nerfCount > 0) return { label: 'Nerf', className: 'border-rose-300/40 bg-rose-500/20 text-rose-100' };
  return { label: 'Adjustment', className: 'border-amber-300/40 bg-amber-500/20 text-amber-100' };
}

function powerClassificationCounts(entries) {
  return (entries || []).reduce((counts, entry) => {
    const classification = classifyPowerChange(entry);
    if (!classification) return counts;
    const key = classification.label.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, { buff: 0, nerf: 0, mixed: 0, adjustment: 0 });
}

function formatPowerClassificationCounts(entries) {
  const counts = powerClassificationCounts(entries);
  return [
    counts.buff ? `${counts.buff} buff${counts.buff === 1 ? '' : 's'}` : '',
    counts.nerf ? `${counts.nerf} nerf${counts.nerf === 1 ? '' : 's'}` : '',
    counts.mixed ? `${counts.mixed} mixed` : '',
    counts.adjustment ? `${counts.adjustment} adjustment${counts.adjustment === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' • ');
}

function PowerClassificationPills({ entries }) {
  const counts = powerClassificationCounts(entries);
  return (
    <div className="flex flex-wrap gap-2">
      {counts.buff > 0 && <CountPill label="Buffs" value={counts.buff} tone="emerald" />}
      {counts.nerf > 0 && <CountPill label="Nerfs" value={counts.nerf} tone="rose" />}
      {counts.mixed > 0 && <CountPill label="Mixed" value={counts.mixed} tone="blue" />}
      {counts.adjustment > 0 && <CountPill label="Adjustments" value={counts.adjustment} tone="amber" />}
    </div>
  );
}

function PowerChangeCard({ entry }) {
  const tone = entry.type === 'added'
    ? sectionColors.added
    : entry.type === 'removed'
      ? sectionColors.removed
      : sectionColors.changed;
  const typeText = entry.type[0].toUpperCase() + entry.type.slice(1);
  const fields = entry.record.fields || [];
  const classification = classifyPowerChange(entry);
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black/25 px-2 py-1 text-xs font-bold">{typeText}</span>
            {classification && <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${classification.className}`}>{classification.label}</span>}
            <span className="rounded-lg bg-black/25 px-2 py-1 text-xs font-bold">{entry.parsed.move}</span>
            <span className="rounded-lg bg-black/25 px-2 py-1 text-xs font-bold">{entry.parsed.variant}</span>
          </div>
          <div className="mt-2 break-words text-sm font-bold text-white">{entry.parsed.powerName}</div>
          {entry.record.id && <div className="mt-0.5 text-xs opacity-75">ID {entry.record.id}</div>}
        </div>
      </div>
      {entry.parsed.description && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs leading-relaxed text-slate-100">
          {entry.parsed.description}
        </div>
      )}
      {fields.length > 0 && (
        <div className="mt-2 space-y-2">
          {fields.map((field) => <PowerFieldDiff key={field.field} field={field} />)}
        </div>
      )}
    </div>
  );
}

function groupBasePowerEntries(entries) {
  const weaponGroups = new Map();
  for (const entry of entries) {
    const parsed = entry.parsed;
    const weaponKey = parsed.weapon.weapon;
    if (!weaponGroups.has(weaponKey)) {
      weaponGroups.set(weaponKey, { weapon: parsed.weapon, entries: [] });
    }
    weaponGroups.get(weaponKey).entries.push(entry);
  }
  return [...weaponGroups.values()]
    .sort((a, b) => a.weapon.label.localeCompare(b.weapon.label));
}

function groupSignaturePowerEntries(entries) {
  const legendGroups = new Map();
  for (const entry of entries) {
    const parsed = entry.parsed;
    const legendKey = parsed.hero?.code || parsed.hero?.name || 'unknown';
    if (!legendGroups.has(legendKey)) {
      legendGroups.set(legendKey, { hero: parsed.hero, count: 0, weapons: new Map() });
    }
    const legendGroup = legendGroups.get(legendKey);
    const weaponKey = parsed.weapon.weapon;
    if (!legendGroup.weapons.has(weaponKey)) {
      legendGroup.weapons.set(weaponKey, { weapon: parsed.weapon, entries: [] });
    }
    legendGroup.count += 1;
    legendGroup.weapons.get(weaponKey).entries.push(entry);
  }
  return [...legendGroups.values()]
    .sort((a, b) => (a.hero?.name || 'Unknown Legend').localeCompare(b.hero?.name || 'Unknown Legend'))
    .map((group) => ({
      ...group,
      weapons: [...group.weapons.values()].sort((a, b) => a.weapon.label.localeCompare(b.weapon.label)),
    }));
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

function fallbackHero(code) {
  const clean = cleanPowerValue(code);
  return clean ? { code: clean, name: clean, image: '' } : null;
}

function heroFromRecord(record, heroMap = {}) {
  const source = record?.after || record?.data || record?.before || {};
  const code = cleanPowerValue(source.HeroName || source.OwnerHero || source.ReplacementHeroName);
  return heroMap[code] || fallbackHero(code);
}

function legendChangeGroups(files, heroMap = {}) {
  const groups = new Map();
  const ensure = (hero) => {
    const resolved = hero || fallbackHero('Unknown Legend');
    const key = resolved?.code || resolved?.name || 'Unknown Legend';
    if (!groups.has(key)) {
      groups.set(key, {
        hero: resolved,
        heroRecords: [],
        stanceRecords: [],
        signatureEntries: [],
      });
    }
    return groups.get(key);
  };

  for (const file of files || []) {
    const path = filePath(file);
    if (path === 'Game/HeroTypes.xml') {
      for (const entry of typedRecords(file)) {
        ensure(heroFromRecord(entry.record, heroMap)).heroRecords.push({ ...entry, file });
      }
    }
    if (path === 'Game/RuneTypes.xml') {
      for (const entry of typedRecords(file)) {
        ensure(heroFromRecord(entry.record, heroMap)).stanceRecords.push({ ...entry, file });
      }
    }
    if (path === 'Game/powerTypes.csv') {
      for (const entry of typedRecords(file)) {
        const parsed = parsePowerRecord(entry.record, heroMap);
        if (parsed?.kind === 'signature') {
          ensure(parsed.hero).signatureEntries.push({ ...entry, parsed });
        }
      }
    }
  }

  return [...groups.values()]
    .filter((group) => group.heroRecords.length || group.stanceRecords.length || group.signatureEntries.length)
    .sort((a, b) => (a.hero?.name || '').localeCompare(b.hero?.name || ''));
}

function LegendChangeSection({ groups, lang, heroMap, storeAssetMap }) {
  const [open, setOpen] = useState(true);
  if (!groups.length) return null;
  const signatureEntries = groups.flatMap((group) => group.signatureEntries || []);
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <div>
          <h3 className="text-lg font-bold text-white">Legend Changes</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {groups.slice(0, 16).map((group) => group.hero?.image && (
              <img
                key={group.hero?.code || group.hero?.name}
                src={group.hero.image}
                className="h-10 w-10 rounded-lg bg-slate-950 object-contain"
                alt=""
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <CountPill label="Legends" value={groups.length} tone="blue" />
          <PowerClassificationPills entries={signatureEntries} />
        </div>
      </button>
      {open && <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const signatureWeapons = groupSignaturePowerEntries(group.signatureEntries).flatMap((legendGroup) => legendGroup.weapons);
          const total = group.heroRecords.length + group.stanceRecords.length + group.signatureEntries.length;
          const powerSummary = formatPowerClassificationCounts(group.signatureEntries);
          return (
            <CollapsibleDiffBlock
              key={group.hero?.code || group.hero?.name}
              title={group.hero?.name || 'Unknown Legend'}
              subtitle={`${total} legend change${total === 1 ? '' : 's'}${powerSummary ? ` • ${powerSummary}` : ''}`}
              image={group.hero?.image}
              className="bg-slate-950/60"
            >
              <div className="space-y-4">
                {group.heroRecords.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-200">Legend Data</h4>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                      {group.heroRecords.map((entry, index) => (
                        <RecordCard key={`hero-${entry.type}-${entry.record.id}-${index}`} type={entry.type} record={entry.record} file={entry.file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />
                      ))}
                    </div>
                  </section>
                )}
                {group.stanceRecords.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-200">Stances</h4>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                      {group.stanceRecords.map((entry, index) => (
                        <RecordCard key={`stance-${entry.type}-${entry.record.id}-${index}`} type={entry.type} record={entry.record} file={entry.file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />
                      ))}
                    </div>
                  </section>
                )}
                {signatureWeapons.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-200">Signatures</h4>
                    <div className="space-y-3">
                      {signatureWeapons.map((weaponGroup) => (
                        <CollapsibleDiffBlock
                          key={weaponGroup.weapon.weapon}
                          title={weaponGroup.weapon.label}
                          subtitle={`${weaponGroup.entries.length} signature power change${weaponGroup.entries.length === 1 ? '' : 's'}${formatPowerClassificationCounts(weaponGroup.entries) ? ` • ${formatPowerClassificationCounts(weaponGroup.entries)}` : ''}`}
                          image={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weaponGroup.weapon.icon}/1`}
                          className="bg-slate-950/70"
                        >
                          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {weaponGroup.entries.map((entry) => (
                              <PowerChangeCard key={`${entry.type}-${entry.record.id}-${entry.parsed.powerName}`} entry={entry} />
                            ))}
                          </div>
                        </CollapsibleDiffBlock>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </CollapsibleDiffBlock>
          );
        })}
      </div>}
    </section>
  );
}

function MapChangeSection({ files, lang, levelMap, heroMap, storeAssetMap }) {
  const [open, setOpen] = useState(true);
  if (!files.length) return null;
  const renderRecords = (file, type, records) => (
    records?.length > 0 && (
      <section>
        <h4 className={`mb-2 text-sm font-bold uppercase tracking-wide ${
          type === 'added' ? 'text-emerald-200' : type === 'removed' ? 'text-rose-200' : 'text-amber-200'
        }`}>
          {type[0].toUpperCase() + type.slice(1)}
        </h4>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {records.map((record, index) => (
            <RecordCard key={`${type}-${record.id}-${index}`} type={type} record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />
          ))}
        </div>
      </section>
    )
  );
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-white">Map Data</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <img
                key={`${file.section}/${file.file}`}
                src={mapImageUrl(file, levelMap)}
                className="h-12 w-20 rounded-lg bg-slate-950 object-cover sm:h-14 sm:w-24"
                alt=""
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <CountPill label="Maps" value={files.length} tone="blue" />
        </div>
      </button>
      {open && <div className="mt-4 space-y-3">
        {files.map((file) => {
          const mapName = mapNameFromFile(file);
          const info = levelMap[mapName];
          const changedCount = (file.added?.length || 0) + (file.changed?.length || 0) + (file.removed?.length || 0);
          return (
            <CollapsibleDiffBlock
              key={`${file.section}/${file.file}`}
              title={info?.displayName || mapName}
              subtitle={`${changedCount} map data change${changedCount === 1 ? '' : 's'}`}
              image={mapImageUrl(file, levelMap)}
              imageClassName="h-24 w-40 sm:h-28 sm:w-48"
              className="bg-slate-950/60"
            >
              <div className="space-y-4">
                {renderRecords(file, 'added', file.added || [])}
                {renderRecords(file, 'changed', file.changed || [])}
                {renderRecords(file, 'removed', file.removed || [])}
              </div>
            </CollapsibleDiffBlock>
          );
        })}
      </div>}
    </section>
  );
}

function PowerFileDiff({ file, heroMap }) {
  const [open, setOpen] = useState(false);
  const records = [
    ...(file.added || []).map((record) => ({ type: 'added', record })),
    ...(file.changed || []).map((record) => ({ type: 'changed', record })),
    ...(file.removed || []).map((record) => ({ type: 'removed', record })),
  ].map((entry) => ({ ...entry, parsed: parsePowerRecord(entry.record, heroMap) }))
    .filter((entry) => !!entry.parsed);
  const baseGroups = groupBasePowerEntries(records.filter((entry) => entry.parsed.kind === 'base'));
  if (baseGroups.length === 0) return null;
  const baseEntries = baseGroups.flatMap((group) => group.entries);
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Weapon Changes</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {baseGroups.map((group) => (
              <img
                key={group.weapon.weapon}
                src={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${group.weapon.icon}/1`}
                className="h-10 w-10 rounded-lg bg-slate-950 object-contain"
                alt=""
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CountPill label="Base Weapons" value={baseGroups.length} tone="blue" />
          <CountPill label="Powers" value={baseGroups.reduce((total, group) => total + group.entries.length, 0)} tone="amber" />
          <PowerClassificationPills entries={baseEntries} />
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-700 p-4">
          {baseGroups.map((weaponGroup) => (
            <CollapsibleDiffBlock
              key={weaponGroup.weapon.weapon}
              title={weaponGroup.weapon.label}
              subtitle={`${weaponGroup.entries.length} power change${weaponGroup.entries.length === 1 ? '' : 's'}${formatPowerClassificationCounts(weaponGroup.entries) ? ` • ${formatPowerClassificationCounts(weaponGroup.entries)}` : ''}`}
              image={`${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weaponGroup.weapon.icon}/1`}
              className="bg-slate-950/60"
            >
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {weaponGroup.entries.map((entry) => (
                  <PowerChangeCard key={`${entry.type}-${entry.record.id}-${entry.parsed.powerName}`} entry={entry} />
                ))}
              </div>
            </CollapsibleDiffBlock>
          ))}
        </div>
      )}
    </div>
  );
}

function FileDiff({ file, mode = 'minimal', lang, heroMap, storeAssetMap }) {
  const [open, setOpen] = useState(false);
  if (mode === 'minimal' && filePath(file) === 'Game/powerTypes.csv') {
    return <PowerFileDiff file={file} heroMap={heroMap} />;
  }
  const added = mode === 'minimal' ? minimalRecords(file, file.added, 'added') : file.added || [];
  const changed = mode === 'minimal' ? minimalRecords(file, file.changed, 'changed') : file.changed || [];
  const removed = mode === 'minimal' ? minimalRecords(file, file.removed, 'removed') : file.removed || [];
  const total = added.length + removed.length + changed.length;
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
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
          <CountPill label="Changed" value={changed.length} tone="amber" />
          <CountPill label="Removed" value={removed.length} tone="rose" />
          <CountPill label="Total" value={total} tone="blue" />
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-700 p-4">
          {added.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-200">Added</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {added.map((record, index) => <RecordCard key={`${record.id}-${index}`} type="added" record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
              </div>
            </section>
          )}
          {changed.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-200">Changed</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {changed.map((record, index) => <RecordCard key={`${record.id}-${index}`} type="changed" record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
              </div>
            </section>
          )}
          {removed.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-rose-200">Removed</h4>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {removed.map((record, index) => <RecordCard key={`${record.id}-${index}`} type="removed" record={record} file={file} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function History() {
  const [patches, setPatches] = useState([]);
  const [selectedPatch, setSelectedPatch] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [viewMode, setViewMode] = useState('minimal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState({});
  const [heroMap, setHeroMap] = useState({});
  const [levelMap, setLevelMap] = useState({});
  const [storeAssetMap, setStoreAssetMap] = useState({});

  useEffect(() => {
    fetch(`${host}/game/history/all`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPatches(list);
        if (list[0]?.manifest) setSelectedPatch(String(list[0].manifest));
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load patch list.');
      });
  }, []);

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
    fetch(`${host}/game/metadata/Init/LevelTypes.xml`)
      .then((res) => res.json())
      .then((data) => setLevelMap(buildLevelMap(data)))
      .catch((err) => {
        console.error(err);
        setLevelMap({});
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
    if (!selectedPatch) return;
    setLoading(true);
    setError('');
    setHistoryData(null);
    fetch(`${host}/game/history/${selectedPatch}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Patch history request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setHistoryData(data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load this patch history.');
      })
      .finally(() => setLoading(false));
  }, [selectedPatch]);

  const categories = useMemo(() => {
    const labels = new Set((historyData?.files || [])
      .filter((file) => viewMode === 'full' || isMinimalFile(file))
      .map((file) => file.label)
      .filter(Boolean));
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [historyData, viewMode]);

  const filteredFiles = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (historyData?.files || []).filter((file) => {
      if (viewMode === 'minimal' && !isMinimalFile(file)) return false;
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
  }, [historyData, query, category, viewMode]);

  const renderedFiles = useMemo(() => filteredFiles.filter((file) => {
    if (viewMode !== 'minimal') return true;
    if (minimalDynamicPattern.test(filePath(file))) return false;
    return !legendGroupedFiles.has(filePath(file));
  }), [filteredFiles, viewMode]);

  const groupedLegendChanges = useMemo(
    () => (viewMode === 'minimal' ? legendChangeGroups(filteredFiles, heroMap) : []),
    [filteredFiles, heroMap, viewMode],
  );

  const groupedMapFiles = useMemo(
    () => (viewMode === 'minimal' ? filteredFiles.filter((file) => minimalDynamicPattern.test(filePath(file))) : []),
    [filteredFiles, viewMode],
  );

  const weaponFiles = useMemo(
    () => (viewMode === 'minimal' ? renderedFiles.filter((file) => filePath(file) === 'Game/powerTypes.csv') : []),
    [renderedFiles, viewMode],
  );

  const skinFiles = useMemo(
    () => (viewMode === 'minimal' ? renderedFiles.filter((file) => filePath(file) === 'Game/costumeTypes.csv') : []),
    [renderedFiles, viewMode],
  );

  const storeItemFiles = useMemo(
    () => (viewMode === 'minimal' ? renderedFiles.filter((file) => filePath(file) === 'Game/storeTypes.csv') : []),
    [renderedFiles, viewMode],
  );

  const otherRenderedFiles = useMemo(
    () => (viewMode === 'minimal'
      ? renderedFiles.filter((file) => ![
        'Game/powerTypes.csv',
        'Game/costumeTypes.csv',
        'Game/storeTypes.csv',
      ].includes(filePath(file)))
      : renderedFiles),
    [renderedFiles, viewMode],
  );

  const selectedPatchInfo = patches.find((patch) => String(patch.manifest) === String(selectedPatch));

  const sidebar = (
    <aside className="flex h-full flex-col gap-3 bg-slate-950 p-3">
      <div>
        <h1 className="text-xl font-bold text-white">Patch History</h1>
        <p className="mt-1 text-xs text-slate-400">Manifest-by-manifest game data changes.</p>
      </div>
      <div className="flex-1 overflow-y-auto app-scrollbar pr-1">
        <div className="space-y-2">
          {patches.map((patch) => {
            const active = String(selectedPatch) === String(patch.manifest);
            return (
              <button
                key={patch.manifest}
                type="button"
                className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600'}`}
                onClick={() => {
                  setSelectedPatch(String(patch.manifest));
                  setCategory('');
                  setQuery('');
                  setIsSidebarOpen(false);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold">Patch {patch.patch || 'Unknown'}</span>
                  {patch.patchOccurrence && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px]">#{patch.patchOccurrence}/{patch.patchOccurrenceTotal}</span>}
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatDate(patch.date)}</div>
                <div className="mt-1 break-all text-[10px] text-slate-500">{patch.manifest}</div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 p-3 backdrop-blur lg:hidden">
        <div>
          <div className="text-lg font-bold">Patch History</div>
          <div className="text-xs text-slate-400">{selectedPatchInfo ? `Patch ${selectedPatchInfo.patch}` : 'Select a patch'}</div>
        </div>
        <button type="button" onClick={() => setIsSidebarOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold">Patches</button>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)} aria-label="Close patches" />
          <div className="relative h-full w-[min(92vw,24rem)]">{sidebar}</div>
        </div>
      )}

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="sticky top-0 hidden h-screen overflow-hidden border-r border-slate-800 lg:block">{sidebar}</div>
        <main className="min-w-0 p-3 sm:p-4 lg:p-5">
          {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">{error}</div>}
          {loading && <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-300">Loading patch data...</div>}
          {!loading && historyData && (
            <div className="space-y-4">
              <header className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-300">Manifest {historyData.manifest}</div>
                    <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Patch {historyData.patch || 'Unknown'}</h2>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatDate(historyData.date)}
                      {historyData.previousPatch && ` - compared to Patch ${historyData.previousPatch}`}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                    <CountPill label="Added" value={historyData.summary?.added} tone="emerald" />
                    <CountPill label="Changed" value={historyData.summary?.changed} tone="amber" />
                    <CountPill label="Removed" value={historyData.summary?.removed} tone="rose" />
                    <CountPill label="Files" value={historyData.summary?.files} tone="blue" />
                    <CountPill label="New Files" value={historyData.summary?.filesAdded} />
                    <CountPill label="Changed Files" value={historyData.summary?.filesChanged} />
                    <CountPill label="Removed Files" value={historyData.summary?.filesRemoved} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('minimal');
                      setCategory('');
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${viewMode === 'minimal' ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    Minimal Patch Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('full')}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${viewMode === 'full' ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                  >
                    Full Data Diff
                  </button>
                </div>
              </header>

              {historyData.categorySummary?.length > 0 && (
                <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <h3 className="text-lg font-bold text-white">Changed Areas</h3>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 app-scrollbar">
                    {historyData.categorySummary.filter((item) => viewMode === 'full' || (historyData.files || []).some((file) => file.label === item.label && isMinimalFile(file))).map((item) => (
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

              <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search files, item names, IDs, or changed fields"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                  />
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                  >
                    <option value="">All changed areas</option>
                    {categories.map((label) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </div>
              </section>

              <section className="space-y-3">
                {viewMode === 'minimal' && weaponFiles.map((file) => <FileDiff key={`${file.section}/${file.file}`} file={file} mode={viewMode} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
                {viewMode === 'minimal' && <LegendChangeSection groups={groupedLegendChanges} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />}
                {viewMode === 'minimal' && skinFiles.map((file) => <FileDiff key={`${file.section}/${file.file}`} file={file} mode={viewMode} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
                {viewMode === 'minimal' && storeItemFiles.map((file) => <FileDiff key={`${file.section}/${file.file}`} file={file} mode={viewMode} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)}
                {otherRenderedFiles.length > 0 ? (
                  otherRenderedFiles.map((file) => <FileDiff key={`${file.section}/${file.file}`} file={file} mode={viewMode} lang={lang} heroMap={heroMap} storeAssetMap={storeAssetMap} />)
                ) : groupedLegendChanges.length > 0 || groupedMapFiles.length > 0 || weaponFiles.length > 0 || skinFiles.length > 0 || storeItemFiles.length > 0 ? null : (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400">No matching changes for this filter.</div>
                )}
                {viewMode === 'minimal' && <MapChangeSection files={groupedMapFiles} lang={lang} levelMap={levelMap} heroMap={heroMap} storeAssetMap={storeAssetMap} />}
              </section>
            </div>
          )}
          {!loading && !historyData && !error && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-300">Select a patch to view its history.</div>
          )}
        </main>
      </div>
    </div>
  );
}
