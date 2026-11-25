import { useEffect, useMemo, useRef, useState } from 'react';
import { host } from '../../stuff';
import { PageShell, ScrollX, PageHeader, SidebarHeader, SidebarItem, Section, Pill, Tabs, SearchInput, SelectInput, Toggle, LoadingState, EmptyState, ErrorState, DataViewToggle, RawData, ShowFullData, useDataView, useQueryFlag, useQueryState, mapThumbUrl, plural, isPatchNumber } from '../ui';

const COLORS = {
  camera: '#60a5fa',
  kill: '#f43f5e',
  spawnBounds: '#a78bfa',
  hard: '#f8fafc',
  soft: '#38bdf8',
  noSlide: '#f59e0b',
  bouncy: '#34d399',
  hazard: '#fb7185',
  mud: '#b45309',
  pressure: '#facc15',
  item: '#22c55e',
  respawn: '#2dd4bf',
  goal: '#c084fc',
  nav: '#64748b',
  moving: '#f97316',
  asset: '#475569',
};

const LAYER_OPTIONS = [
  ['background', 'Background', true],
  ['cameraBounds', 'Camera edge', true],
  ['killBounds', 'Blast zones', true],
  ['spawnBotBounds', 'Bot spawn area', false, true],
  ['hardCollision', 'Solid ground and walls', true],
  ['softCollision', 'Drop-through platforms', true],
  ['noSlideCollision', 'No wall-slide walls', true],
  ['bouncyCollision', 'Bouncy surfaces', true],
  ['lavaCollision', 'Hazards', true],
  ['mudCollision', 'Mud', true],
  ['pressureCollision', 'Pressure Plates', true],
  ['gameModeCollision', 'Game mode walls', true, true],
  ['respawns', 'Respawn points', true],
  ['itemSpawns', 'Weapon spawns', true],
  ['initialItemSpawns', 'First weapon spawns', true],
  ['teamItemSpawns', 'Team weapon spawns', true],
  ['goals', 'Goals', true],
  ['modeItems', 'Game mode item spots', true, true],
  ['navigation', 'Bot paths', false, true],
  ['movingPlatforms', 'Moving Platforms', true],
  ['wavePaths', 'Enemy paths', true],
  ['waveEnemies', 'Enemies', true],
  ['animatedBackgrounds', 'Animated Backgrounds', false, true],
  ['levelAnimations', 'Map effects', false, true],
  ['versionChanges', 'Changes from this version', false],
  ['assets', 'Map art', true],
  ['foreground', 'Foreground art', true],
  ['modeAssets', 'Game mode art', false, true],
];

const ADVANCED_LAYERS = new Set(LAYER_OPTIONS.filter((option) => option[3]).map(([key]) => key));

const THEME_LABELS = {
  Halloween: 'Halloween look',
  Christmas: 'Christmas look',
  TWDHalloween: 'Walking Dead look',
};

function themeLabel(theme) {
  return THEME_LABELS[theme] || `${titleCase(theme)} look`;
}

const KILL_FREE_MARGIN = 200;

const SECTION_LABELS = {
  ranked: 'Ranked',
  tournament: 'Tournament only',
  casual: 'Casual',
  modes: 'Game modes',
  botw: 'Brawl of the Week',
  tutorial: 'Tutorial and test',
};

const SECTION_ORDER = Object.keys(SECTION_LABELS);

function orderMaps(maps) {
  const rank = (entry) => {
    const index = SECTION_ORDER.indexOf(entry?.section || 'tutorial');
    return index < 0 ? SECTION_ORDER.length : index;
  };
  return [...array(maps)].sort((left, right) => rank(left) - rank(right) || mapName(left).localeCompare(mapName(right)));
}

function mapName(entry) {
  return String(entry?.label || entry?.displayName || entry?.name || '');
}

function tournamentModes(entry) {
  return array(entry?.levelSets).map((set) => clean(set?.name || set?.LevelSetName).match(/^Tournament(\dv\d)$/i)?.[1]).filter(Boolean);
}

function mapBadges(entry, short = false) {
  const pools = array(entry?.pools);
  const badges = [];
  if (pools.includes('ranked1v1')) badges.push({ key: 'ranked1v1', label: short ? '1v1' : 'Ranked 1v1', title: 'Ranked 1v1', tone: 'amber' });
  if (pools.includes('ranked2v2')) badges.push({ key: 'ranked2v2', label: short ? '2v2' : 'Ranked 2v2', title: 'Ranked 2v2', tone: 'amber' });
  const modes = tournamentModes(entry);
  if (modes.length) badges.push({ key: 'tournament', label: short ? 'Tournament' : `Tournament ${modes.join(', ')}`, title: `Tournament ${modes.join(', ')}`, tone: 'violet' });
  if (entry?.testLevel) badges.push({ key: 'test', label: 'Test map', title: 'Test map', tone: 'rose' });
  return badges;
}

function MapBadges({ entry, short = false }) {
  const badges = mapBadges(entry, short);
  if (!badges.length) return null;
  return badges.map((badge) => <Pill key={badge.key} tone={badge.tone} title={badge.title} className={short ? 'px-1.5 text-[10px]' : ''}>{badge.label}</Pill>);
}

const LAYER_COLORS = {
  background: '#64748b',
  cameraBounds: COLORS.camera,
  killBounds: COLORS.kill,
  spawnBotBounds: COLORS.spawnBounds,
  hardCollision: COLORS.hard,
  softCollision: COLORS.soft,
  noSlideCollision: COLORS.noSlide,
  bouncyCollision: COLORS.bouncy,
  lavaCollision: COLORS.hazard,
  mudCollision: COLORS.mud,
  pressureCollision: COLORS.pressure,
  gameModeCollision: '#e879f9',
  respawns: COLORS.respawn,
  itemSpawns: COLORS.item,
  initialItemSpawns: '#4ade80',
  teamItemSpawns: '#14b8a6',
  goals: COLORS.goal,
  modeItems: '#a3e635',
  navigation: COLORS.nav,
  movingPlatforms: COLORS.moving,
  wavePaths: '#f472b6',
  waveEnemies: '#fb7185',
  animatedBackgrounds: '#d946ef',
  levelAnimations: '#fde047',
  versionChanges: '#fb7185',
  assets: COLORS.asset,
  foreground: '#94a3b8',
  modeAssets: '#818cf8',
};

function layerColor(layer) {
  return layer.startsWith('event:') ? '#f472b6' : (LAYER_COLORS[layer] || '#60a5fa');
}

const DEFAULT_LAYERS = Object.fromEntries(LAYER_OPTIONS.map(([key, , enabled]) => [key, enabled]));

const COLLISION_TYPES = new Set([
  'HardCollision',
  'SoftCollision',
  'NoSlideCollision',
  'BouncyHardCollision',
  'BouncySoftCollision',
  'BouncyNoSlideCollision',
  'LavaCollision',
  'GameModeHardCollision',
  'PressurePlateCollision',
  'SoftPressurePlateCollision',
]);

const OFFSET_CONTAINERS = new Set([
  'DynamicCollision',
  'DynamicRespawn',
  'DynamicItemSpawn',
  'DynamicNavNode',
  'MovingPlatform',
  'Platform',
]);

function array(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  const text = String(value ?? '').trim();
  return text && text !== '--' ? text : '';
}

function sortLevelSets(levelSets) {
  const priority = new Map([
    ['Tournament1v1', 0],
    ['Tournament2v2', 1],
  ]);
  return [...array(levelSets)].sort((left, right) => {
    const leftName = clean(left?.name || left?.LevelSetName);
    const rightName = clean(right?.name || right?.LevelSetName);
    const leftPriority = priority.has(leftName) ? priority.get(leftName) : Number.POSITIVE_INFINITY;
    const rightPriority = priority.has(rightName) ? priority.get(rightName) : Number.POSITIVE_INFINITY;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: 'base' });
  });
}

const LEVEL_SET_GROUP_ORDER = [
  '1v1',
  '2v2',
  '3v3',
  'FFA (Free-For-All)',
  'BOTW (Brawl of the Week)',
  'All / game modes',
  'Other',
];

function levelSetGroup(set) {
  const name = clean(set?.name || set?.LevelSetName);
  const displayName = clean(set?.displayName || set?.DisplayNameKey);
  const text = `${name} ${displayName}`.toLowerCase();
  if (text.includes('botw') || text.includes('brawl of the week')) return 'BOTW (Brawl of the Week)';
  if (/(^|[^0-9])1v1([^0-9]|$)/i.test(text)) return '1v1';
  if (/(^|[^0-9])2v2([^0-9]|$)/i.test(text)) return '2v2';
  if (/(^|[^0-9])3v3([^0-9]|$)/i.test(text)) return '3v3';
  if (text.includes('ffa') || text.includes('free-for-all') || text.includes('free for all')) return 'FFA (Free-For-All)';
  if (text.includes('all') || text.includes('game mode') || text.includes('gamemode')) return 'All / game modes';
  return 'Other';
}

function groupedLevelSets(levelSets, order) {
  const named = array(levelSets);
  if (named.some((set) => set?.group)) {
    const byGroup = new Map(array(order).map((group) => [group, []]));
    named.forEach((set) => {
      const group = set.group || 'Game modes';
      byGroup.set(group, [...(byGroup.get(group) || []), set]);
    });
    return [...byGroup.entries()]
      .filter(([, sets]) => sets.length)
      .map(([group, sets]) => [group, [...sets].sort((left, right) => String(left.label || left.name).localeCompare(String(right.label || right.name), undefined, { numeric: true, sensitivity: 'base' }))]);
  }
  const groups = new Map(LEVEL_SET_GROUP_ORDER.map((group) => [group, []]));
  sortLevelSets(levelSets).forEach((set) => {
    const group = levelSetGroup(set);
    groups.set(group, [...(groups.get(group) || []), set]);
  });
  return [...groups.entries()].filter(([, sets]) => sets.length);
}

function titleCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayPairs(data, omitted = []) {
  const skip = new Set(omitted);
  return Object.entries(data || {})
    .filter(([key, value]) => !skip.has(key) && value !== undefined && value !== null && typeof value !== 'object' && clean(value))
    .map(([key, value]) => [titleCase(key), String(value)]);
}

function collisionColor(type) {
  if (type.includes('Lava')) return COLORS.hazard;
  if (type.includes('Pressure')) return COLORS.pressure;
  if (type.includes('Bouncy')) return COLORS.bouncy;
  if (type.includes('NoSlide')) return COLORS.noSlide;
  if (type.includes('Soft')) return COLORS.soft;
  return COLORS.hard;
}

function collisionLayer(type) {
  if (type === 'GameModeHardCollision') return 'gameModeCollision';
  if (type.includes('Lava')) return 'lavaCollision';
  if (type.includes('Pressure')) return 'pressureCollision';
  if (type.includes('Bouncy')) return 'bouncyCollision';
  if (type.includes('NoSlide')) return 'noSlideCollision';
  if (type.includes('Soft')) return 'softCollision';
  return 'hardCollision';
}

function mapAssetUrl(assetDir, assetName) {
  return `${host}/game/maps/asset?dir=${encodeURIComponent(assetDir || '')}&name=${encodeURIComponent(assetName || '')}`;
}

function mapAnimationUrl(animationClass, animationFile, preview = false, frameOffset = 0) {
  const params = new URLSearchParams({
    class: animationClass || '',
    file: animationFile || '',
    offset: String(frameOffset || 0),
    canvas: '2',
  });
  if (preview) params.set('preview', '1');
  return `${host}/game/maps/animation?${params}`;
}

function coordinatePair(value, fallbackX = 0, fallbackY = 0) {
  const [x, y] = String(value ?? '').split(',');
  return { x: number(x, fallbackX), y: number(y, fallbackY) };
}

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

function multiplyMatrix(left, right) {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
}

function nodeMatrix(node) {
  const radians = number(node.Rotation) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scale = node.Scale === undefined ? 1 : number(node.Scale, 1);
  const scaleX = scale * (node.ScaleX === undefined ? 1 : number(node.ScaleX, 1));
  const scaleY = scale * (node.ScaleY === undefined ? 1 : number(node.ScaleY, 1));
  return [cosine * scaleX, sine * scaleX, -sine * scaleY, cosine * scaleY, number(node.X), number(node.Y)];
}

function matrixPoint(matrix, x, y) {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] };
}

function matrixBounds(matrix, x, y, width, height) {
  const points = [
    matrixPoint(matrix, x, y),
    matrixPoint(matrix, x + width, y),
    matrixPoint(matrix, x, y + height),
    matrixPoint(matrix, x + width, y + height),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function animationKeyframes(animation, inheritedFrame = 0) {
  if (!animation || typeof animation !== 'object') return [];
  const startFrame = inheritedFrame + number(animation.StartFrame);
  const direct = array(animation.KeyFrame).map((frame) => ({
    ...frame,
    timelineFrame: startFrame + number(frame.FrameNum),
  }));
  const phases = array(animation.Phase).flatMap((phase) => animationKeyframes(phase, startFrame + number(phase.StartFrame)));
  return [...direct, ...phases].sort((left, right) => left.timelineFrame - right.timelineFrame);
}

function movingPlatformTiming(path) {
  const animation = path?.details?.Animation || {};
  const keyframes = array(path?.details?.keyframes);
  const startFrame = number(animation.StartFrame);
  const numFrames = number(animation.NumFrames);
  const slowMult = number(animation.SlowMult, 1);
  const firstFrame = keyframes.length ? Math.min(...keyframes.map((frame) => number(frame.timelineFrame))) : 0;
  const lastFrame = keyframes.length ? Math.max(...keyframes.map((frame) => number(frame.timelineFrame))) : 0;
  return {
    startFrame,
    numFrames,
    slowMult,
    firstFrame,
    lastFrame,
  };
}

function sampledAnimationPath(keyframes, matrix) {
  if (!keyframes.length) return [];
  const sampled = [];
  keyframes.forEach((frame, index) => {
    const end = matrixPoint(matrix, number(frame.X), number(frame.Y));
    if (!index) {
      sampled.push({ ...end, frame: frame.timelineFrame });
      return;
    }
    const start = sampled.at(-1);
    if (frame.CenterX === undefined && frame.CenterY === undefined) {
      sampled.push({ ...end, frame: frame.timelineFrame });
      return;
    }
    const control = matrixPoint(matrix, number(frame.CenterX, number(frame.X)), number(frame.CenterY, number(frame.Y)));
    for (let step = 1; step <= 16; step += 1) {
      const t = step / 16;
      const inverse = 1 - t;
      sampled.push({
        x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
        y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
        frame: frame.timelineFrame,
      });
    }
  });
  return sampled;
}

function pointAlongPath(points, progress) {
  if (!points.length) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const segments = points.slice(1).map((point, index) => ({
    from: points[index],
    to: point,
    length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!total) return points[0];
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length ? remaining / segment.length : 0;
      return { x: segment.from.x + (segment.to.x - segment.from.x) * ratio, y: segment.from.y + (segment.to.y - segment.from.y) * ratio };
    }
    remaining -= segment.length;
  }
  return points.at(-1);
}

function projectOntoPath(points, target) {
  if (points.length < 2) return 0;
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let traversed = 0;
  let best = { distance: Infinity, progress: 0 };
  lengths.forEach((length, index) => {
    if (!length) return;
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const ratio = Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / (length * length)));
    const x = from.x + dx * ratio;
    const y = from.y + dy * ratio;
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance < best.distance) best = { distance, progress: (traversed + length * ratio) / total };
    traversed += length;
  });
  return best.progress;
}

function offsetShape(shape, dx, dy) {
  if (!dx && !dy) return shape;
  if (shape.kind === 'line') return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
  if (shape.kind === 'image') {
    const matrix = [...shape.matrix];
    matrix[4] += dx;
    matrix[5] += dy;
    return { ...shape, x: shape.x + dx, y: shape.y + dy, matrix };
  }
  if (shape.kind === 'polyline') return { ...shape, points: shape.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })) };
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

function geometrySignature(shape) {
  const base = { kind: shape.kind, layer: shape.layer, type: shape.type };
  if (shape.kind === 'line') return JSON.stringify({ ...base, x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2 });
  if (shape.kind === 'polyline') return JSON.stringify({ ...base, points: shape.points.map(({ x, y }) => [x, y]) });
  if (shape.kind === 'image') return JSON.stringify({ ...base, href: shape.href, matrix: shape.matrix, w: shape.imageW, h: shape.imageH });
  if (shape.kind === 'animation') return JSON.stringify({ ...base, x: shape.x, y: shape.y, animationClass: shape.animationClass });
  return JSON.stringify({ ...base, x: shape.x, y: shape.y, w: shape.w, h: shape.h });
}

function versionDifferenceShapes(selectedShapes, currentShapes) {
  const selected = new Set(selectedShapes.map(geometrySignature));
  const current = new Set(currentShapes.map(geometrySignature));
  const decorate = (shape, status, color, index) => {
    const decorated = { ...shape, id: `version-${status}-${index}`, layer: 'versionChanges', layers: ['versionChanges'], color, movingPlatformId: undefined, details: { type: shape.type, VersionStatus: status } };
    return shape.kind === 'image' ? { ...decorated, kind: 'rect' } : decorated;
  };
  return [
    ...selectedShapes.filter((shape) => !current.has(geometrySignature(shape))).map((shape, index) => decorate(shape, 'Historical only', '#fb7185', index)),
    ...currentShapes.filter((shape) => !selected.has(geometrySignature(shape))).map((shape, index) => decorate(shape, 'Current only', '#4ade80', index)),
  ];
}

function collectMapGeometry(scene, level, assetDir, selectedWaveId = null, partySize = 2) {
  const shapes = [];
  const navGroups = new Map();
  let serial = 0;
  const add = (shape) => shapes.push({ id: `shape-${serial++}`, ...shape });

  function visit(tag, node, parentMatrix = IDENTITY_MATRIX, path = 'LevelDesc', navGroup = 'root', inheritedVariant = { themes: [], mode: false }, inheritedPlatformId = '') {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(tag, entry, parentMatrix, `${path}.${tag}[${index}]`, navGroup, inheritedVariant, inheritedPlatformId));
      return;
    }

    const ownX = number(node.X);
    const ownY = number(node.Y);
    const worldMatrix = multiplyMatrix(parentMatrix, nodeMatrix(node));
    const position = matrixPoint(parentMatrix, ownX, ownY);
    const x = position.x;
    const y = position.y;
    const themes = [...new Set([
      ...inheritedVariant.themes,
      ...clean(node.Theme).split(',').map((theme) => theme.trim()).filter(Boolean),
    ])];
    const variant = { themes, mode: inheritedVariant.mode || Boolean(clean(node.ScoringType)) };
    const assetLayers = themes.length ? themes.map((theme) => `event:${theme}`) : [variant.mode ? 'modeAssets' : 'assets'];
    const details = { type: tag, path, ...node };
    const ownPlatformId = clean(node.PlatID);
    const linkedPlatformId = inheritedPlatformId || (tag.startsWith('Dynamic') ? ownPlatformId : '');
    const addLinked = (shape) => add({ ...shape, movingPlatformId: linkedPlatformId || undefined });

    if (tag === 'Background' && node.AssetName) {
      const camera = array(scene?.CameraBounds)[0];
      if (camera) addLinked({ kind: 'image', layer: 'background', type: tag, x: number(camera.X), y: number(camera.Y), w: number(camera.W), h: number(camera.H), href: mapAssetUrl('Backgrounds', node.AssetName), color: COLORS.asset, details });
    } else if (tag === 'CameraBounds' || tag === 'SpawnBotBounds') {
      const bounds = matrixBounds(parentMatrix, ownX, ownY, number(node.W), number(node.H));
      addLinked({ kind: 'rect', hitMode: 'stroke', layer: tag === 'CameraBounds' ? 'cameraBounds' : 'spawnBotBounds', type: tag, ...bounds, color: tag === 'CameraBounds' ? COLORS.camera : COLORS.spawnBounds, details });
    } else if (COLLISION_TYPES.has(tag)) {
      const start = matrixPoint(parentMatrix, number(node.X1, ownX), number(node.Y1, ownY));
      const end = matrixPoint(parentMatrix, number(node.X2, ownX), number(node.Y2, ownY));
      addLinked({ kind: 'line', layer: collisionLayer(tag), type: tag, x1: start.x, y1: start.y, x2: end.x, y2: end.y, color: collisionColor(tag), details });
    } else if (tag === 'ItemSpawn') {
      addLinked({ kind: 'rect', layer: 'itemSpawns', type: tag, ...matrixBounds(parentMatrix, ownX, ownY, Math.max(number(node.W), 36), Math.max(number(node.H), 24)), color: COLORS.item, details });
    } else if (tag === 'Goal') {
      addLinked({ kind: 'rect', layer: 'goals', type: tag, ...matrixBounds(parentMatrix, ownX, ownY, Math.max(number(node.W), 40), Math.max(number(node.H), 40)), color: COLORS.goal, details });
    } else if (['Respawn', 'ItemInitSpawn', 'TeamItemInitSpawn'].includes(tag)) {
      const layer = tag === 'Respawn' ? 'respawns' : tag === 'TeamItemInitSpawn' ? 'teamItemSpawns' : 'initialItemSpawns';
      addLinked({ kind: 'point', layer, type: tag, x, y, color: tag === 'Respawn' ? COLORS.respawn : COLORS.item, details });
    } else if (tag === 'NavNode') {
      const group = navGroups.get(navGroup) || new Map();
      const navId = clean(node.NavID) || `${group.size}`;
      const shape = { kind: 'point', layer: 'navigation', type: tag, x, y, color: COLORS.nav, details, navId, paths: clean(node.Path).split(',').map((entry) => entry.trim()).filter(Boolean), navGroup };
      addLinked(shape);
      shape.movingPlatformId = linkedPlatformId || undefined;
      group.set(navId, shape);
      navGroups.set(navGroup, group);
    } else if (tag === 'Asset') {
      const width = number(node.W);
      const height = number(node.H);
      const imageMatrix = multiplyMatrix(worldMatrix, [width < 0 ? -1 : 1, 0, 0, height < 0 ? -1 : 1, 0, 0]);
      addLinked({ kind: 'image', layer: assetLayers[0], layers: assetLayers, type: tag, ...matrixBounds(imageMatrix, 0, 0, Math.abs(width), Math.abs(height)), matrix: imageMatrix, imageW: Math.abs(width), imageH: Math.abs(height), href: mapAssetUrl(assetDir, node.AssetName), color: COLORS.asset, details });
    } else if ((tag === 'Platform' || tag === 'ForegroundAsset') && node.AssetName && node.W && node.H) {
      const width = number(node.W);
      const height = number(node.H);
      const imageMatrix = multiplyMatrix(worldMatrix, [width < 0 ? -1 : 1, 0, 0, height < 0 ? -1 : 1, 0, 0]);
      const layersForImage = tag === 'ForegroundAsset' && !themes.length && !variant.mode ? ['foreground'] : assetLayers;
      addLinked({ kind: 'image', layer: layersForImage[0], layers: layersForImage, foreground: tag === 'ForegroundAsset', type: tag, ...matrixBounds(imageMatrix, 0, 0, Math.abs(width), Math.abs(height)), matrix: imageMatrix, imageW: Math.abs(width), imageH: Math.abs(height), href: mapAssetUrl(assetDir, node.AssetName), color: COLORS.asset, details });
    } else if (tag === 'MudCollision') {
      const surfaceY = number(node.Y, ownY);
      const start = matrixPoint(parentMatrix, number(node.X1, ownX), surfaceY);
      const end = matrixPoint(parentMatrix, number(node.X2, ownX), surfaceY);
      const depth = number(node.MudKillDepth, 150);
      addLinked({ kind: 'rect', hitMode: 'stroke', layer: 'mudCollision', type: 'MudDepth', x: Math.min(start.x, end.x), y: start.y, w: Math.abs(end.x - start.x), h: depth, color: COLORS.mud, details });
      addLinked({ kind: 'line', layer: 'mudCollision', type: tag, x1: start.x, y1: start.y, x2: end.x, y2: end.y, color: COLORS.mud, details });
    } else if (tag === 'TeamScoreboard') {
      const scoreY = number(node.Y, ownY);
      [['Red', node.RedTeamX], ['Blue', node.BlueTeamX]].forEach(([team, teamX]) => {
        if (clean(teamX)) addLinked({ kind: 'point', layer: 'modeAssets', type: tag, ...matrixPoint(parentMatrix, number(teamX), scoreY), color: team === 'Red' ? '#f87171' : '#60a5fa', details: { ...details, team } });
      });
    } else if (tag === 'ItemSet') {
      addLinked({ kind: 'point', layer: 'modeItems', type: tag, x, y, color: LAYER_COLORS.modeItems, details });
    } else if (tag === 'AnimatedBackground') {
      const position = coordinatePair(node.Position);
      const scale = coordinatePair(node.Scale, 1, 1);
      const skew = coordinatePair(node.Skew);
      addLinked({
        kind: 'animation',
        layer: 'animatedBackgrounds',
        type: tag,
        x: position.x,
        y: position.y,
        color: '#e879f9',
        animationClass: clean(node.Gfx?.AnimClass),
        animationFile: clean(node.Gfx?.AnimFile),
        animationScale: scale,
        animationSkew: clean(node.Rotation)
          ? { x: number(node.Rotation), y: number(node.Rotation) }
          : skew,
        frameOffset: number(node.FrameOffset),
        details,
      });
    } else if (tag === 'LevelAnimation') {
      addLinked({
        kind: 'animation',
        layer: 'levelAnimations',
        type: tag,
        x: number(node.PositionX),
        y: number(node.PositionY),
        color: '#facc15',
        animationClass: clean(node.AnimationName).split(',')[0],
        animationNames: clean(node.AnimationName).split(',').filter(Boolean),
        animationFile: clean(node.FileName),
        animationScale: { x: number(node.Scale, 1), y: number(node.Scale, 1) },
        rotation: 0,
        details,
      });
    } else if (tag === 'LevelAnim') {
      addLinked({ kind: 'animation', layer: 'levelAnimations', type: tag, x, y, color: '#facc15', animationClass: clean(node.AssetName), animationNames: [clean(node.AssetName)], animationScale: { x: 1, y: 1 }, rotation: 0, details });
    }

    if (tag === 'MovingPlatform') {
      const keyframes = animationKeyframes(node.Animation);
      const points = sampledAnimationPath(keyframes, worldMatrix).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (points.length > 1) add({ kind: 'polyline', layer: 'movingPlatforms', type: 'MovingPlatformPath', platformId: ownPlatformId || `${serial}`, points, color: COLORS.moving, details: { ...details, keyframes } });
    }

    let childMatrix = parentMatrix;
    let childNavGroup = navGroup;
    if (OFFSET_CONTAINERS.has(tag)) childMatrix = worldMatrix;
    if (tag === 'DynamicNavNode') childNavGroup = `${path}:${clean(node.PlatID) || serial}`;
    const childPlatformId = tag === 'MovingPlatform' || tag.startsWith('Dynamic') ? ownPlatformId : inheritedPlatformId;

    Object.entries(node).forEach(([childTag, child]) => {
      if (typeof child !== 'object' || child === null) return;
      visit(childTag, child, childMatrix, `${path}.${childTag}`, childNavGroup, variant, childPlatformId);
    });
  }

  Object.entries(scene || {}).forEach(([tag, node]) => {
    if (typeof node === 'object' && node !== null) visit(tag, node, IDENTITY_MATRIX, `LevelDesc.${tag}`, 'root', { themes: [], mode: false });
  });

  array(scene?.WaveData).forEach((wave, waveIndex) => {
    if (selectedWaveId !== null && String(wave.ID ?? waveIndex) !== String(selectedWaveId)) return;
    const customPaths = array(wave.CustomPath).map((customPath) => array(customPath.Point).map((point) => ({ x: number(point.X), y: number(point.Y) })));
    customPaths.forEach((points, pathIndex) => {
      if (points.length > 1) add({ kind: 'polyline', layer: 'wavePaths', type: 'WavePath', points, color: '#fb7185', details: { type: 'WavePath', wave: wave.ID ?? waveIndex, path: pathIndex } });
    });

    const camera = array(scene?.CameraBounds)[0] || {};
    const cameraX = number(camera.X);
    const cameraY = number(camera.Y);
    const cameraW = Math.max(number(camera.W), 1200);
    const cameraH = Math.max(number(camera.H), 700);
    const goals = array(scene?.Goal).map((goal) => ({
      x: number(goal.X) + number(goal.W) / 2,
      y: number(goal.Y) + number(goal.H) / 2,
    }));
    const fallbackGoal = { x: cameraX + cameraW / 2, y: cameraY + cameraH * 0.72 };
    const goalFor = (start, pathSelector) => {
      if (!goals.length) return fallbackGoal;
      const ordered = [...goals].sort((left, right) => Math.hypot(left.x - start.x, left.y - start.y) - Math.hypot(right.x - start.x, right.y - start.y));
      return clean(pathSelector).toUpperCase() === 'FAR' ? ordered[ordered.length - 1] : ordered[0];
    };
    const directionalPoint = (direction, groupIndex, enemyIndex, count) => {
      const spread = (enemyIndex - (count - 1) / 2) * Math.min(110, cameraW / Math.max(count + 2, 8));
      const lane = (groupIndex % 4 - 1.5) * cameraH * 0.12;
      switch (clean(direction).toUpperCase()) {
        case 'TOP': return { x: cameraX + cameraW / 2 + spread, y: cameraY + cameraH * 0.08 };
        case 'BOTTOM': return { x: cameraX + cameraW / 2 + spread, y: cameraY + cameraH * 0.92 };
        case 'LEFT': return { x: cameraX + cameraW * 0.08, y: cameraY + cameraH / 2 + spread + lane };
        case 'RIGHT': return { x: cameraX + cameraW * 0.92, y: cameraY + cameraH / 2 + spread + lane };
        case 'SIDE': return groupIndex % 2
          ? { x: cameraX + cameraW * 0.92, y: cameraY + cameraH / 2 + spread + lane }
          : { x: cameraX + cameraW * 0.08, y: cameraY + cameraH / 2 + spread + lane };
        default: return { x: cameraX + cameraW / 2 + spread, y: cameraY + cameraH * 0.18 + lane };
      }
    };
    const directionalRoute = (direction, groupIndex, enemyIndex, count) => {
      const start = directionalPoint(direction, groupIndex, enemyIndex, count);
      const target = goalFor(start);
      const upper = clean(direction).toUpperCase();
      if (upper === 'CW' || upper === 'CCW') {
        const clockwise = upper === 'CW';
        const sideX = cameraX + cameraW * (clockwise ? 0.9 : 0.1);
        return [
          { x: cameraX + cameraW / 2, y: cameraY + cameraH * 0.06 },
          { x: sideX, y: cameraY + cameraH * 0.3 },
          { x: cameraX + cameraW * (clockwise ? 0.72 : 0.28), y: cameraY + cameraH * 0.67 },
          target,
        ];
      }
      if (upper === 'OPPOSITE') {
        const side = groupIndex % 2 ? 'RIGHT' : 'LEFT';
        return [directionalPoint(side, groupIndex, enemyIndex, count), target];
      }
      return [start, target];
    };
    const navigationNodes = [...navGroups.values()].flatMap((group) => [...group.values()]);
    const navigationById = new Map(navigationNodes.map((node) => [String(node.navId), node]));
    const closestNavigationNode = (point) => navigationNodes.reduce((closest, node) => !closest || Math.hypot(node.x - point.x, node.y - point.y) < Math.hypot(closest.x - point.x, closest.y - point.y) ? node : closest, null);
    const navigationIds = (first, target) => {
      if (!first || !target) return [];
      const firstId = String(first.navId);
      const targetId = String(target.navId);
      const queue = [firstId];
      const previous = new Map([[firstId, null]]);
      while (queue.length && !previous.has(targetId)) {
        const currentId = queue.shift();
        const current = navigationById.get(String(currentId));
        array(current?.paths).forEach((nextId) => {
          const normalizedId = String(nextId);
          if (!navigationById.has(normalizedId) || previous.has(normalizedId)) return;
          previous.set(normalizedId, currentId);
          queue.push(normalizedId);
        });
      }
      if (!previous.has(targetId)) return [firstId, targetId];
      const ids = [];
      for (let current = targetId; current !== null; current = previous.get(current)) ids.unshift(current);
      return ids;
    };
    const navigationRoute = (start, target, viaId) => {
      if (!navigationNodes.length) return null;
      const first = closestNavigationNode(start);
      const last = closestNavigationNode(target);
      const via = navigationById.get(clean(viaId));
      const ids = via
        ? [...navigationIds(first, via), ...navigationIds(via, last).slice(1)]
        : navigationIds(first, last);
      return [
        start,
        ...ids.map((id) => navigationById.get(String(id))).filter(Boolean).map((node) => ({ x: node.x, y: node.y })),
        target,
      ];
    };
    const waveSpeed = Math.max(0.1, partyValue(wave, 'Speed', partySize, 6));
    let groupStart = 0;
    array(wave.Group).forEach((group, groupIndex) => {
      const count = Math.max(0, partyValue(group, 'Count', partySize));
      const delay = partyValue(group, 'Delay', partySize) / 1000;
      const stagger = partyValue(group, 'Stagger', partySize) / 1000;
      groupStart += delay;
      const pathIndex = number(group.Path, -1);
      const configuredPath = clean(group.Dir).toUpperCase() === 'CUSTOM' && pathIndex >= 0 ? customPaths[pathIndex] : null;
      if (!configuredPath?.length && count > 0) {
        const previewRoute = directionalRoute(group.Dir, groupIndex, Math.floor(count / 2), count);
        const target = goalFor(previewRoute[0], group.Path);
        const route = navigationRoute(previewRoute[0], target, group.Path) || [...previewRoute.slice(0, -1), target];
        if (route.length > 1) add({ kind: 'polyline', layer: 'wavePaths', type: 'Wave Group Route', points: route, color: '#fb7185', details: { type: 'Wave Group Route', wave: wave.ID ?? waveIndex, group: groupIndex + 1, target: group.Path } });
      }
      Array.from({ length: count }, (_, enemyIndex) => {
        const directional = directionalRoute(group.Dir, groupIndex, enemyIndex, count);
        const target = goalFor(directional[0], group.Path);
        const pathPoints = configuredPath?.length
          ? configuredPath
          : navigationRoute(directional[0], target, group.Path) || [...directional.slice(0, -1), target];
        const position = pathPoints[0] || { x: 0, y: 0 };
        const pathLength = pathPoints.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - pathPoints[index].x, point.y - pathPoints[index].y), 0);
        const duration = Math.max(2.5, Math.min(18, pathLength / (waveSpeed * 70)));
        const spawnTime = groupStart + enemyIndex * stagger;
        const configuredBehavior = clean(group.Behavior).toUpperCase() || 'NORMAL';
        const behavior = configuredBehavior === 'ANY' ? ['NORMAL', 'FAST', 'TANKY'][enemyIndex % 3] : configuredBehavior;
        const enemyType = behavior === 'FAST' ? 'fast' : behavior === 'TANKY' ? 'tanky' : 'normal';
        const enemySize = enemyType === 'tanky' ? { w: 180, h: 200 } : enemyType === 'fast' ? { w: 125, h: 145 } : { w: 150, h: 170 };
        add({
          kind: 'waveEnemy', layer: 'waveEnemies', type: 'Wave Enemy',
          x: position.x, y: position.y, ...enemySize, color: '#fb7185', href: `${host}/game/maps/enemy?type=${enemyType}&v=3`,
          motionPath: pathPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),
          motionDuration: duration,
          spawnTime,
          waveEndTime: spawnTime + duration,
          details: {
            Wave: wave.ID ?? waveIndex, Group: groupIndex + 1, Enemy: enemyIndex + 1,
            Behavior: behavior, Direction: clean(group.Dir) || 'Default',
            Delay: seconds(partyValue(group, 'Delay', partySize)), Stagger: seconds(partyValue(group, 'Stagger', partySize)),
          },
        });
      });
    });
  });

  for (const [groupName, group] of navGroups) {
    for (const node of group.values()) {
      node.paths.forEach((targetId) => {
        const target = group.get(targetId);
        if (!target || node.navId.localeCompare(targetId) > 0) return;
        add({ kind: 'line', layer: 'navigation', type: 'NavPath', x1: node.x, y1: node.y, x2: target.x, y2: target.y, color: COLORS.nav, movingPlatformId: node.movingPlatformId === target.movingPlatformId ? node.movingPlatformId : undefined, details: { type: 'NavPath', from: node.navId, to: targetId, group: groupName } });
      });
    }
  }

  const camera = array(scene?.CameraBounds)[0];
  if (camera) {
    const left = number(level?.LeftKill);
    const right = number(level?.RightKill);
    const top = number(level?.TopKill);
    const bottom = number(level?.BottomKill);
    add({
      kind: 'invertedRect',
      layer: 'killBounds',
      type: 'KillBounds',
      x: number(camera.X) - left,
      y: number(camera.Y) - top,
      w: number(camera.W) + left + right,
      h: number(camera.H) + top + bottom,
      color: COLORS.kill,
      details: { type: 'KillBounds', LeftKill: left, RightKill: right, TopKill: top, BottomKill: bottom },
    });
    const isTrue = (value) => /^true$/i.test(clean(value));
    const killX = number(camera.X) - left;
    const killY = number(camera.Y) - top;
    const killW = number(camera.W) + left + right;
    const killH = number(camera.H) + top + bottom;
    const freeLine = (side, x1, y1, x2, y2, distance) => add({ kind: 'line', dashed: true, layer: 'killBounds', type: 'FreeKillLine', x1, y1, x2, y2, color: COLORS.kill, details: { type: 'FreeKillLine', side, distance } });
    if (!isTrue(level?.HardLeftKill)) freeLine('Left', killX - KILL_FREE_MARGIN, killY, killX - KILL_FREE_MARGIN, killY + killH, left + KILL_FREE_MARGIN);
    if (!isTrue(level?.HardRightKill)) freeLine('Right', killX + killW + KILL_FREE_MARGIN, killY, killX + killW + KILL_FREE_MARGIN, killY + killH, right + KILL_FREE_MARGIN);
    if (isTrue(level?.SoftTopKill)) freeLine('Top', killX, killY - KILL_FREE_MARGIN, killX + killW, killY - KILL_FREE_MARGIN, top + KILL_FREE_MARGIN);
  }

  return shapes;
}

function geometryViewBox(scene, shapes) {
  const camera = array(scene?.CameraBounds)[0];
  if (camera && number(camera.W) > 0 && number(camera.H) > 0) {
    const killBounds = shapes.find((shape) => shape.type === 'KillBounds');
    const x = killBounds?.x ?? number(camera.X);
    const y = killBounds?.y ?? number(camera.Y);
    const width = killBounds?.w || number(camera.W);
    const height = killBounds?.h || number(camera.H);
    const padding = Math.max(width, height) * 0.03;
    const sidePadding = padding + (killBounds ? KILL_FREE_MARGIN : 0);
    return [x - sidePadding, y - padding, width + sidePadding * 2, height + padding * 2];
  }
  const points = shapes.flatMap((shape) => {
    if (shape.kind === 'line') return [[shape.x1, shape.y1], [shape.x2, shape.y2]];
    if (shape.kind === 'polyline') return shape.points.map((point) => [point.x, point.y]);
    return [[shape.x, shape.y], [shape.x + (shape.w || 0), shape.y + (shape.h || 0)]];
  });
  const xs = points.map(([x]) => x).filter(Number.isFinite);
  const ys = points.map(([, y]) => y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return [0, 0, 1920, 1080];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(maxX - minX, maxY - minY, 100) * 0.08;
  return [minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2];
}

const SHAPE_NAMES = {
  HardCollision: 'Solid ground',
  SoftCollision: 'Drop-through platform',
  NoSlideCollision: 'No-slide wall',
  BouncyCollision: 'Bouncy surface',
  LavaCollision: 'Lava',
  MudCollision: 'Mud',
  MudDepth: 'Mud',
  ForegroundAsset: 'Foreground art',
  TeamScoreboard: 'Team score',
  PressurePlateCollision: 'Pressure plate',
  GameModeHardCollision: 'Game mode wall',
  Respawn: 'Respawn point',
  ItemSpawn: 'Item spawn',
  ItemInitSpawn: 'First item spawn',
  TeamItemInitSpawn: 'Team item spawn',
  ItemSet: 'Game mode item spot',
  CameraBounds: 'Camera edge',
  SpawnBotBounds: 'Bot spawn area',
  KillBounds: 'Blast zone',
  FreeKillLine: 'Blast line out of hitstun',
  NavNode: 'Bot path point',
  MovingPlatform: 'Moving platform',
  MovingPlatformPath: 'Moving platform path',
  WavePath: 'Enemy path',
  Platform: 'Platform art',
  Background: 'Background',
  Asset: 'Map art',
};

function mudText(mud) {
  const sideways = Math.round(number(mud?.MudXSpeedMult, 1) * 100);
  return `You sink slowly and move at ${sideways}% speed sideways. Past ${formatUnits(number(mud?.MudKillDepth, 150))} units deep you fall at full speed.`;
}

function shapeSize(shape) {
  if (shape.kind === 'line') {
    const length = Math.round(Math.hypot(number(shape.x2) - number(shape.x1), number(shape.y2) - number(shape.y1)));
    if (!length) return '';
    return Math.abs(number(shape.y2) - number(shape.y1)) > Math.abs(number(shape.x2) - number(shape.x1)) ? `${length} units tall` : `${length} units wide`;
  }
  if (shape.kind === 'rect' && shape.w && shape.h) return `${Math.round(shape.w)} × ${Math.round(shape.h)} units`;
  return '';
}

function plainShapeLabel(shape) {
  const type = shape?.type || '';
  const name = SHAPE_NAMES[type] || (/Collision$/.test(type) ? `${titleCase(type.replace(/Collision$/, ''))} surface` : titleCase(type));
  const extras = [];
  if (type === 'Respawn' && String(shape.details?.Initial).toLowerCase() === 'true') extras.push('used at match start');
  if (type === 'WavePath' && shape.details?.wave !== undefined) extras.push(`wave ${shape.details.wave}`);
  if (type === 'KillBounds') {
    const { LeftKill, RightKill, TopKill, BottomKill } = shape.details || {};
    return { name, detail: `Left ${LeftKill}, right ${RightKill}, top ${TopKill}, bottom ${BottomKill} past the camera edge. In hitstun you're KO'd at this line.` };
  }
  if (type === 'FreeKillLine') return { name, detail: `${shape.details?.side} side, ${formatUnits(shape.details?.distance)} past the camera edge` };
  if (type === 'MudCollision' || type === 'MudDepth') return { name, detail: mudText(shape.details) };
  if (type === 'TeamScoreboard') return { name: `${shape.details?.team} team score`, detail: '' };
  const size = shapeSize(shape);
  if (size) extras.push(size);
  return { name, detail: extras.join(', ') };
}

function HoverTooltip({ hovered, pointer }) {
  const { full } = useDataView({ url: true });
  if (!hovered) return null;
  const pairs = full ? displayPairs(hovered.details, ['type', 'path']) : [];
  const plain = plainShapeLabel(hovered);
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-80 rounded-xl border border-slate-600 bg-slate-950/95 p-2 text-xs text-slate-200 shadow-2xl backdrop-blur"
      style={{ left: pointer.x + 18, top: pointer.y + 18 }}
    >
      <div className="font-bold text-white">{full ? titleCase(hovered.type) : plain.name}</div>
      {!full && plain.detail && <div className="mt-0.5 text-slate-300">{plain.detail}</div>}
      {full && hovered.details?.path && <div className="mt-0.5 break-all font-mono text-[10px] text-slate-500">{hovered.details.path}</div>}
      {pairs.length > 0 && (
        <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
          {pairs.slice(0, 14).map(([label, value]) => (
            <div key={`${label}-${value}`} className="contents">
              <span className="text-slate-400">{label}</span>
              <span className="break-words text-right text-slate-100">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapShape({ shape, active, onEnter, onLeave, onMove, onPlatformPointerDown, onAnimationToggle, selectedAnimation, platformPosition, pointRadius, viewport }) {
  const common = {
    onPointerEnter: () => onEnter(shape),
    onPointerLeave: onLeave,
    onPointerMove: onMove,
    onPointerDown: shape.movingPlatformId ? (event) => onPlatformPointerDown(event, shape.movingPlatformId) : undefined,
    onClick: shape.kind === 'animation' ? () => onAnimationToggle(shape.id) : undefined,
  };
  const stroke = active ? '#facc15' : shape.color;
  if (shape.kind === 'animation') {
    const selected = selectedAnimation === shape.id;
    const canvasSize = 1000;
    const registrationPoint = 512;
    const scaleX = shape.animationScale?.x || 1;
    const scaleY = shape.animationScale?.y || 1;
    const skewX = (shape.animationSkew?.x || 0) * Math.PI / 180;
    const skewY = (shape.animationSkew?.y || 0) * Math.PI / 180;
    const matrix = [
      Math.cos(skewY) * scaleX,
      Math.sin(skewY) * scaleX,
      -Math.sin(skewX) * scaleY,
      Math.cos(skewX) * scaleY,
      shape.x,
      shape.y,
    ];
    return (
      <g {...common} className="cursor-pointer" transform={`matrix(${matrix.join(' ')})`}>
        {shape.animationClass && <image href={mapAnimationUrl(shape.animationClass, shape.animationFile, !selected, shape.frameOffset)} x={-registrationPoint} y={-registrationPoint} width={canvasSize} height={canvasSize} preserveAspectRatio="none" pointerEvents="none" />}
        <rect x={-90 - pointRadius * 2} y={-90 - pointRadius * 2} width={180 + pointRadius * 4} height={180 + pointRadius * 4} fill="transparent" stroke={active || selected ? (selected ? '#facc15' : shape.color) : 'transparent'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  if (shape.kind === 'waveEnemy') {
    return (
      <g {...common} className="cursor-help" opacity="0">
        <animate attributeName="opacity" from="0" to="1" begin={`${shape.spawnTime}s`} dur="0.01s" fill="freeze" />
        <animateMotion path={shape.motionPath} dur={`${shape.motionDuration}s`} begin={`${shape.spawnTime}s`} repeatCount="1" fill="freeze" />
        <ellipse cx={0} cy={shape.h * 0.34} rx={shape.w * 0.34} ry={shape.h * 0.09} fill="#02061799" pointerEvents="none" />
        <image href={shape.href} x={-shape.w / 2} y={-shape.h / 2} width={shape.w} height={shape.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
        <rect x={-shape.w / 2} y={-shape.h / 2} width={shape.w} height={shape.h} rx={18} fill="transparent" stroke={active ? stroke : 'transparent'} strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="all" />
      </g>
    );
  }
  if (shape.kind === 'image') {
    if (shape.type === 'Background') {
      return <image href={shape.href} x={shape.x} y={shape.y} width={shape.w} height={shape.h} preserveAspectRatio="none" opacity="0.38" pointerEvents="none" />;
    }
    return (
      <g {...common}>
        <image href={shape.href} x="0" y="0" width={shape.imageW} height={shape.imageH} transform={`matrix(${shape.matrix.join(' ')})`} preserveAspectRatio="none" pointerEvents="none" />
        <rect x={shape.x} y={shape.y} width={Math.max(shape.w, 1)} height={Math.max(shape.h, 1)} fill="transparent" stroke={active ? stroke : 'transparent'} strokeWidth={active ? 4 : 14} vectorEffect="non-scaling-stroke" pointerEvents="all" />
      </g>
    );
  }
  if (shape.kind === 'line') {
    return (
      <g {...common}>
        <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={stroke} strokeWidth={active ? 5 : 2.5} strokeDasharray={shape.dashed ? '4 10' : undefined} strokeOpacity={shape.dashed && !active ? 0.6 : 1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="transparent" strokeWidth="20" vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
      </g>
    );
  }
  if (shape.kind === 'polyline') {
    const points = shape.points.map((point) => `${point.x},${point.y}`).join(' ');
    return (
      <g {...common}>
        <polyline points={points} fill="none" stroke={stroke} strokeWidth={active ? 5 : 2.5} strokeDasharray="9 6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <polyline points={points} fill="none" stroke="transparent" strokeWidth="20" vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
        {shape.platformId && platformPosition && <circle cx={platformPosition.x} cy={platformPosition.y} r={pointRadius * 1.8} fill="#fb923c" stroke="#fff7ed" strokeWidth="2" vectorEffect="non-scaling-stroke" className="cursor-grab" onPointerDown={(event) => onPlatformPointerDown(event, shape.platformId)} />}
      </g>
    );
  }
  if (shape.kind === 'point') {
    return (
      <g {...common}>
        <circle cx={shape.x} cy={shape.y} r={active ? pointRadius * 1.4 : pointRadius} fill={stroke} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <circle cx={shape.x} cy={shape.y} r={pointRadius * 3} fill="transparent" pointerEvents="all" />
      </g>
    );
  }
  if (shape.kind === 'invertedRect') {
    const [outerX, outerY, outerWidth, outerHeight] = viewport;
    const outerRight = outerX + outerWidth;
    const outerBottom = outerY + outerHeight;
    const innerRight = shape.x + Math.max(shape.w, 1);
    const innerBottom = shape.y + Math.max(shape.h, 1);
    const outsidePath = [
      `M ${outerX} ${outerY} H ${outerRight} V ${outerBottom} H ${outerX} Z`,
      `M ${shape.x} ${shape.y} H ${innerRight} V ${innerBottom} H ${shape.x} Z`,
    ].join(' ');
    return (
      <g {...common}>
        <path
          d={outsidePath}
          fill={active ? '#facc1538' : `${shape.color}24`}
          fillRule="evenodd"
          clipRule="evenodd"
          pointerEvents="none"
        />
        <rect
          x={shape.x}
          y={shape.y}
          width={Math.max(shape.w, 1)}
          height={Math.max(shape.h, 1)}
          fill="none"
          stroke={stroke}
          strokeWidth={active ? 5 : 3}
          strokeDasharray="10 7"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <path
          data-pan-surface="true"
          d={outsidePath}
          fill="transparent"
          fillRule="evenodd"
          clipRule="evenodd"
          stroke="transparent"
          strokeWidth="20"
          vectorEffect="non-scaling-stroke"
          pointerEvents="all"
        />
      </g>
    );
  }
  return (
    <g {...common}>
      <rect x={shape.x} y={shape.y} width={Math.max(shape.w, 1)} height={Math.max(shape.h, 1)} fill={active ? '#facc1528' : `${shape.color}${shape.type === 'MudDepth' ? '40' : '12'}`} stroke={stroke} strokeWidth={active ? 4 : 2} strokeDasharray={shape.type.includes('Bounds') ? '10 7' : undefined} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <rect
        x={shape.x - (shape.hitMode === 'stroke' ? 0 : pointRadius)}
        y={shape.y - (shape.hitMode === 'stroke' ? 0 : pointRadius)}
        width={Math.max(shape.w, 1) + (shape.hitMode === 'stroke' ? 0 : pointRadius * 2)}
        height={Math.max(shape.h, 1) + (shape.hitMode === 'stroke' ? 0 : pointRadius * 2)}
        fill="transparent"
        stroke="transparent"
        strokeWidth="20"
        vectorEffect="non-scaling-stroke"
        pointerEvents={shape.hitMode === 'stroke' ? 'stroke' : 'all'}
      />
    </g>
  );
}

function shapeDepth(shape) {
  if (shape.type === 'Background') return 0;
  if (shape.kind === 'image') return shape.foreground ? 3 : 1;
  if (shape.kind === 'animation') return 2;
  return 4;
}

function MapCanvas({ detail, comparisonDetail, selectedWaveId, partySize = 2, waveTime = 0, wavePlaying = false, onWaveDuration }) {
  const { full } = useDataView({ url: true });
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [moreLayers, setMoreLayers] = useState(false);
  const showAdvanced = full || moreLayers;
  const [hovered, setHovered] = useState(null);
  const [selectedAnimation, setSelectedAnimation] = useState(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const shapes = useMemo(() => collectMapGeometry(detail.scene, detail.level, detail.assetDir, selectedWaveId, partySize), [detail, selectedWaveId, partySize]);
  const comparisonShapes = useMemo(() => comparisonDetail ? collectMapGeometry(comparisonDetail.scene, comparisonDetail.level, comparisonDetail.assetDir, selectedWaveId, partySize) : [], [comparisonDetail, selectedWaveId, partySize]);
  const versionShapes = useMemo(() => comparisonDetail ? versionDifferenceShapes(shapes, comparisonShapes) : [], [shapes, comparisonShapes, comparisonDetail]);
  const allShapes = useMemo(() => [...shapes, ...versionShapes], [shapes, versionShapes]);
  const waveDuration = useMemo(() => Math.max(0, ...shapes.filter((shape) => shape.kind === 'waveEnemy').map((shape) => shape.waveEndTime || 0)), [shapes]);
  useEffect(() => onWaveDuration?.(waveDuration), [waveDuration, onWaveDuration]);
  const movingPaths = useMemo(() => new Map(shapes.filter((shape) => shape.type === 'MovingPlatformPath').map((shape) => [shape.platformId, shape])), [shapes]);
  const [platformProgress, setPlatformProgress] = useState({});
  useEffect(() => setPlatformProgress({}), [detail.name, detail.manifest]);
  const platformPositions = useMemo(() => new Map([...movingPaths].map(([id, path]) => [id, pointAlongPath(path.points, platformProgress[id] || 0)])), [movingPaths, platformProgress]);
  const positionedShapes = useMemo(() => allShapes.map((shape) => {
    if (!shape.movingPlatformId) return shape;
    const path = movingPaths.get(shape.movingPlatformId);
    const position = platformPositions.get(shape.movingPlatformId);
    if (!path || !position) return shape;
    return offsetShape(shape, position.x - path.points[0].x, position.y - path.points[0].y);
  }), [allShapes, movingPaths, platformPositions]);
  const availableLayers = useMemo(() => new Set(allShapes.flatMap((shape) => shape.layers || [shape.layer])), [allShapes]);
  const layerOptions = useMemo(() => [
    ...LAYER_OPTIONS,
    ...[...availableLayers]
      .filter((layer) => layer.startsWith('event:'))
      .sort()
      .map((layer) => [layer, full ? `${layer.slice('event:'.length)} assets` : themeLabel(layer.slice('event:'.length)), false]),
  ], [availableLayers, full]);
  const baseViewBox = useMemo(() => geometryViewBox(detail.scene, shapes), [detail, selectedWaveId, partySize]);
  const [viewBox, setViewBox] = useState(baseViewBox);
  useEffect(() => setViewBox(baseViewBox), [baseViewBox]);
  useEffect(() => setSelectedAnimation(null), [detail.name, detail.manifest]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setCurrentTime?.(waveTime);
    if (wavePlaying) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  }, [wavePlaying]);
  useEffect(() => {
    if (!wavePlaying) svgRef.current?.setCurrentTime?.(waveTime);
  }, [waveTime, wavePlaying]);
  const pointRadius = Math.max(viewBox[2], viewBox[3]) / 280;
  const layerEnabled = (layer) => {
    if (ADVANCED_LAYERS.has(layer) && !showAdvanced) return false;
    return layer.startsWith('event:') ? layers[layer] === true : layers[layer] !== false;
  };
  const shownLayerOptions = layerOptions.filter(([layer]) => availableLayers.has(layer) && (showAdvanced || !ADVANCED_LAYERS.has(layer)));
  const hiddenLayerCount = layerOptions.filter(([layer]) => availableLayers.has(layer) && ADVANCED_LAYERS.has(layer)).length;
  const visible = positionedShapes
    .filter((shape) => (shape.layers || [shape.layer]).some(layerEnabled))
    .map((shape, index) => [shapeDepth(shape), index, shape])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1])
    .map(([, , shape]) => shape);

  const clientToMap = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  };

  const updatePlatformFromPointer = (event, platformId) => {
    const target = clientToMap(event);
    const path = movingPaths.get(platformId);
    if (!target || !path) return;
    setPlatformProgress((current) => ({ ...current, [platformId]: projectOntoPath(path.points, target) }));
  };

  const startPlatformDrag = (event, platformId) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { type: 'platform', platformId };
    updatePlatformFromPointer(event, platformId);
  };

  const zoomAt = (factor, clientX, clientY) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setViewBox((current) => {
      const nextWidth = Math.min(baseViewBox[2] * 2, Math.max(baseViewBox[2] / 12, current[2] * factor));
      const nextHeight = nextWidth * (current[3] / current[2]);
      const ratioX = clientX === undefined ? 0.5 : (clientX - bounds.left) / bounds.width;
      const ratioY = clientY === undefined ? 0.5 : (clientY - bounds.top) / bounds.height;
      const focusX = current[0] + current[2] * ratioX;
      const focusY = current[1] + current[3] * ratioY;
      return [focusX - nextWidth * ratioX, focusY - nextHeight * ratioY, nextWidth, nextHeight];
    });
  };

  const startPan = (event) => {
    if (event.button !== 0 || event.target?.dataset?.panSurface !== 'true') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { type: 'pan', x: event.clientX, y: event.clientY, viewBox };
  };

  const movePan = (event) => {
    if (!dragRef.current) return;
    if (dragRef.current.type === 'platform') {
      updatePlatformFromPointer(event, dragRef.current.platformId);
      return;
    }
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const start = dragRef.current;
    setViewBox([
      start.viewBox[0] - (event.clientX - start.x) * start.viewBox[2] / bounds.width,
      start.viewBox[1] - (event.clientY - start.y) * start.viewBox[3] / bounds.height,
      start.viewBox[2],
      start.viewBox[3],
    ]);
  };

  const moveTooltip = (event) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPointer({
      x: Math.max(8, Math.min(event.clientX - bounds.left, bounds.width - 328)),
      y: Math.max(8, Math.min(event.clientY - bounds.top, bounds.height - 210)),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {shownLayerOptions.map(([layer, label]) => (
          <button
            key={layer}
            type="button"
            onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:brightness-125 ${layers[layer] ? 'text-white' : 'text-slate-400'}`}
            style={{
              borderColor: layers[layer] ? layerColor(layer) : `${layerColor(layer)}66`,
              backgroundColor: layers[layer] ? `${layerColor(layer)}2b` : `${layerColor(layer)}0d`,
            }}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${layers[layer] ? 'shadow-[0_0_8px_currentColor]' : 'opacity-55'}`}
              style={{ backgroundColor: layerColor(layer), color: layerColor(layer) }}
            />
            {label}
          </button>
        ))}
        {!full && hiddenLayerCount > 0 && (
          <button type="button" onClick={() => setMoreLayers((value) => !value)} aria-expanded={moreLayers} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800">
            {moreLayers ? 'Fewer layers' : `More layers (${hiddenLayerCount})`}
          </button>
        )}
      </div>
      <div ref={containerRef} className="relative -order-1 min-h-[17rem] overflow-hidden rounded-2xl sm:min-h-[34rem] lg:order-none min-[137.5rem]:min-h-[46rem] border border-slate-700 bg-[#07101d] shadow-inner">
        <svg
          ref={svgRef}
          viewBox={viewBox.join(' ')}
          className="h-[17rem] w-full cursor-grab sm:h-[34rem] min-[137.5rem]:h-[46rem] touch-none active:cursor-grabbing"
          preserveAspectRatio="xMidYMid meet"
          data-pan-surface="true"
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
          onPointerLeave={() => { setHovered(null); dragRef.current = null; }}
        >
          <defs>
            <pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e293b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </pattern>
          </defs>
          <rect data-pan-surface="true" x={viewBox[0]} y={viewBox[1]} width={viewBox[2]} height={viewBox[3]} fill="url(#map-grid)" />
          {visible.map((shape) => (
            <MapShape key={shape.id} shape={shape} active={hovered?.id === shape.id} onEnter={setHovered} onLeave={() => setHovered(null)} onMove={moveTooltip} onPlatformPointerDown={startPlatformDrag} onAnimationToggle={(id) => setSelectedAnimation((current) => current === id ? null : id)} selectedAnimation={selectedAnimation} platformPosition={shape.platformId ? platformPositions.get(shape.platformId) : null} pointRadius={pointRadius} viewport={viewBox} />
          ))}
        </svg>
        <HoverTooltip hovered={hovered} pointer={pointer} />
        <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg border border-slate-600 bg-slate-950/90 shadow-xl">
          <button type="button" onClick={() => zoomAt(0.8)} className="px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setViewBox(baseViewBox)} className="border-x border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Reset</button>
          <button type="button" onClick={() => zoomAt(1.25)} className="px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" aria-label="Zoom out">-</button>
        </div>
        {full && <div className="absolute bottom-3 left-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-400">
          ViewBox {viewBox.map((value) => Math.round(value)).join(' x ')} - {visible.length} visible elements
        </div>}
        {layers.versionChanges && comparisonDetail && <div className="absolute bottom-3 right-3 flex gap-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] font-bold"><span className="text-rose-400">Historical only</span><span className="text-green-400">Current only</span></div>}
      </div>
      {movingPaths.size > 0 && <div className="grid gap-2 rounded-xl border border-orange-400/30 bg-orange-500/5 p-2 sm:grid-cols-2 xl:grid-cols-5">
        {[...movingPaths].map(([platformId, path]) => {
          const timing = movingPlatformTiming(path);
          return <label key={platformId} className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">
            <span className="flex items-center justify-between gap-3"><span className="font-bold text-orange-200">Moving platform {platformId}</span><span>{Math.round((platformProgress[platformId] || 0) * 100)}%</span></span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span>Start frame {timing.startFrame || 0}</span>
              {timing.numFrames > 0 && <span>Loop {timing.numFrames} frames</span>}
              {timing.slowMult !== 1 && <span>Speed x{timing.slowMult}</span>}
            </span>
            <input type="range" min="0" max="1000" value={Math.round((platformProgress[platformId] || 0) * 1000)} onChange={(event) => setPlatformProgress((current) => ({ ...current, [platformId]: number(event.target.value) / 1000 }))} className="mt-2 w-full accent-orange-400" aria-label={`Moving platform ${platformId} position`} />
            <span className="mt-1 block text-[10px] text-slate-500">Drag its collision, artwork, or orange path handle.</span>
          </label>;
        })}
      </div>}
    </div>
  );
}

function MetadataCard({ title, count, children }) {
  return (
    <Section title={title} count={count} bodyClassName="space-y-3">
      {children}
    </Section>
  );
}

function DataPairs({ data, omitted = [], className = '' }) {
  const pairs = displayPairs(data, omitted);
  if (!pairs.length) return <div className="text-xs text-slate-500">No data</div>;
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {pairs.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-950 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-0.5 break-words text-xs text-slate-200">{value}</div>
        </div>
      ))}
    </div>
  );
}

function seconds(value) {
  const milliseconds = number(value);
  return `${Number((milliseconds / 1000).toFixed(3))}s`;
}

function cssColor(value, fallback = '#334155') {
  const raw = clean(value);
  if (!raw) return fallback;
  if (/^0x[0-9a-f]{6}$/i.test(raw)) return `#${raw.slice(2)}`;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? `#${Math.max(0, numeric).toString(16).padStart(6, '0').slice(-6)}` : fallback;
}

function ColorExclusionIcons({ colors, bare = false }) {
  if (!array(colors).length) return null;
  return (
    <div className={bare ? '' : 'border-t border-slate-800 pt-3'}>
      {!bare && <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Color Exclusions</div>}
      <div className="flex flex-wrap gap-3">
        {array(colors).map((color) => <div key={color.ColorSchemeID || color.ColorSchemeName} className="flex w-20 flex-col items-center gap-1 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 p-2" style={{ backgroundColor: cssColor(color.IndicatorColor) }}>
            {color.IconName ? <img src={`${host}/game/getGfx/UI_Icons/${color.IconName}`} alt="" loading="lazy" className="max-h-full max-w-full object-contain" /> : <span className="text-xs font-bold text-white">{color.displayName}</span>}
          </div>
          <span className="text-[10px] leading-tight text-slate-300">{color.displayName || color.ColorSchemeName}</span>
        </div>)}
      </div>
    </div>
  );
}

function partyValue(data, field, partySize, fallback = 0) {
  const partyField = partySize > 2 ? `${field}${partySize}` : field;
  if (Object.prototype.hasOwnProperty.call(data || {}, partyField)) return number(data[partyField], fallback);
  return number(data?.[field], fallback);
}

function WaveData({ waves, selectedWaveId, onSelectWave, partySize, onPartySize, waveTime, waveDuration, playing, onPlaying, onTime }) {
  const entries = array(waves);
  if (!entries.length) return null;
  const selectedIndex = Math.max(0, entries.findIndex((wave, index) => String(wave.ID ?? index) === String(selectedWaveId)));
  const wave = entries[selectedIndex];
  const groups = array(wave?.Group);
  const groupData = groups.map((group, index) => ({
    group,
    index,
    count: partyValue(group, 'Count', partySize),
    delay: partyValue(group, 'Delay', partySize),
    stagger: partyValue(group, 'Stagger', partySize),
  }));
  const totalEnemies = groupData.reduce((total, group) => total + group.count, 0);

  return (
    <Section title="Waves" count={entries.length} tone="rose" bodyClassName="space-y-3">
      <div className="max-w-4xl space-y-3">
        <div className="space-y-3">
          <Tabs
            variant="chips"
            label="Waves"
            value={String(wave.ID ?? selectedIndex)}
            onChange={(id) => onSelectWave(entries.find((entry, index) => String(entry.ID ?? index) === String(id))?.ID ?? id)}
            items={entries.map((entry, index) => ({ value: String(entry.ID ?? index), label: `Wave ${entry.ID ?? index}` }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Players</span>
            <Tabs
              variant="small"
              label="Players"
              value={partySize}
              onChange={(size) => onPartySize(Number(size))}
              items={[2, 3, 4].map((size) => ({ value: size, label: String(size) }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/25 bg-rose-500/5 px-3 py-2">
          <div><div className="text-base font-bold text-white">Wave {wave.ID ?? selectedIndex}</div><div className="text-[11px] text-slate-400">{groupData.length} spawn groups · {array(wave.CustomPath).length} custom paths</div></div>
          <div className="text-right"><div className="text-xl font-black text-rose-300">{totalEnemies}</div><div className="text-[10px] font-bold uppercase text-slate-500">Enemies</div></div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => onPlaying(!playing)} disabled={!waveDuration} className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{playing ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => { onTime(0); onPlaying(true); }} disabled={!waveDuration} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-40">Replay</button>
          </div>
          <input type="range" min="0" max={Math.max(1, Math.round(waveDuration * 1000))} value={Math.min(Math.round(waveTime * 1000), Math.max(1, Math.round(waveDuration * 1000)))} onChange={(event) => { onPlaying(false); onTime(number(event.target.value) / 1000); }} className="w-full accent-rose-400" aria-label="Wave playback position" />
          <div className="shrink-0 text-right text-xs font-bold tabular-nums text-slate-300">{waveTime.toFixed(1)}s / {waveDuration.toFixed(1)}s</div>
        </div>

      </div>
    </Section>
  );
}

function LevelEffects({ scene }) {
  const { full } = useDataView({ url: true });
  const backgrounds = array(scene?.AnimatedBackground);
  const periodic = [...array(scene?.LevelAnimation), ...array(scene?.LevelAnim)];
  if (!backgrounds.length && !periodic.length) return null;
  return <Section collapsible defaultOpen={false} title="Map animations" count={backgrounds.length + periodic.length} bodyClassName="space-y-3"><div className="text-xs text-slate-400">Turn on an animation layer and click a marker on the map to play it.</div>{backgrounds.length > 0 && <div><div className="mb-2 text-[10px] font-bold uppercase text-fuchsia-300">Animated Backgrounds ({backgrounds.length})</div><div className="flex flex-wrap gap-2">{backgrounds.map((effect, index) => <Pill key={index}>{effect.Gfx?.AnimClass || `Effect ${index + 1}`}</Pill>)}</div></div>}{periodic.length > 0 && <div><div className="mb-2 text-[10px] font-bold uppercase text-yellow-300">Level Animations ({periodic.length})</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[137.5rem]:grid-cols-5">{periodic.map((effect, index) => <div key={index} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{effect.AnimationName || effect.AssetName || `Animation ${index + 1}`}</div>{full && <DataPairs data={effect} omitted={['AnimationName', 'AssetName']} />}</div>)}</div></div>}</Section>;
}

function LevelSounds({ sounds }) {
  const entries = array(sounds).sort((left, right) => number(left.Delay) - number(right.Delay));
  if (!entries.length) return null;
  return <Section collapsible defaultOpen={false} title="Sound timeline" count={entries.length}><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 min-[112.5rem]:grid-cols-6 min-[137.5rem]:grid-cols-8">{entries.map((sound, index) => <div key={`${sound.SoundEventName}-${index}`} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{sound.SoundEventName}</div><div className="mt-1 text-[11px] text-slate-400">Starts {seconds(sound.Delay)}{clean(sound.Interval) ? ` · repeats every ${seconds(sound.Interval)}` : ''}</div></div>)}</div></Section>;
}

function formatUnits(value) {
  return Math.round(number(value)).toLocaleString('en-US');
}

function compareText(value, average, more, less, same) {
  if (!average) return '';
  const percent = Math.round((value / average - 1) * 100);
  if (!percent) return same;
  return `${Math.abs(percent)}% ${percent > 0 ? more : less}`;
}

function blastRules(rules) {
  const lines = [];
  if (rules.hardLeft && rules.hardRight) lines.push('The side lines KO you out of hitstun too.');
  else if (rules.hardLeft || rules.hardRight) {
    const hard = rules.hardLeft ? 'left' : 'right';
    const other = rules.hardLeft ? 'right' : 'left';
    lines.push(`The ${hard} line KOs you out of hitstun too. Out of hitstun the ${other} line is ${KILL_FREE_MARGIN} further out.`);
  } else lines.push(`Out of hitstun the side lines are ${KILL_FREE_MARGIN} further out.`);
  if (rules.softTop) lines.push(`The top KOs you out of hitstun too, ${KILL_FREE_MARGIN} above the line.`);
  else lines.push('The top only KOs you in hitstun.');
  lines.push('The bottom line always KOs.');
  return lines;
}

function SizeStat({ label, value, note }) {
  return (
    <div className="rounded-lg bg-slate-950 px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-bold tabular-nums text-white">{value}</div>
      {note && <div className="text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

function MapSizeCard({ size, averages, mud }) {
  const { full } = useDataView({ url: true });
  if (!size) return null;
  const { camera, kill, blast, rules } = size;
  const pickAverage = averages?.ranked1v1 || averages?.ranked2v2;
  const poolName = pickAverage?.pool === 'ranked2v2' ? 'ranked 2v2' : 'ranked 1v1';
  const versus = pickAverage ? [
    compareText(blast.width, pickAverage.blastWidth, 'wider', 'narrower', 'same width'),
    compareText(blast.height, pickAverage.blastHeight, 'taller', 'shorter', 'same height'),
  ] : [];
  return (
    <Section title="Size and blast zones" tone="rose" padded={false} bodyClassName="space-y-2 p-3">
      <div className="grid grid-cols-2 gap-2">
        <SizeStat label="Camera area" value={`${formatUnits(camera.width)} × ${formatUnits(camera.height)}`} />
        <SizeStat label="Blast zone box" value={`${formatUnits(blast.width)} × ${formatUnits(blast.height)}`} note={pickAverage ? `${versus.join(', ')} than ${poolName} average` : undefined} />
        <SizeStat label="Respawn points" value={size.respawns} />
        <SizeStat label="Weapon spawns" value={size.itemSpawns} note={size.firstItemSpawns ? `${size.firstItemSpawns} at match start` : undefined} />
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Blast lines past the camera edge</div>
        <div className="grid grid-cols-4 gap-2">
          {[['Left', kill.left], ['Right', kill.right], ['Top', kill.top], ['Bottom', kill.bottom]].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-rose-400/25 bg-rose-500/5 px-2 py-1 text-center">
              <div className="text-[10px] font-bold uppercase text-rose-300">{label}</div>
              <div className="text-sm font-bold tabular-nums text-white">{formatUnits(value)}</div>
            </div>
          ))}
        </div>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-300">
        {blastRules(rules).map((line) => <li key={line}>{line}</li>)}
        {mud && <li>Mud along the bottom: {mudText(mud).replace(/^You/, 'you')}</li>}
      </ul>
      {pickAverage && <div className="text-[11px] text-slate-500">Average of {pickAverage.maps} {poolName} maps: blast zone box {formatUnits(pickAverage.blastWidth)} × {formatUnits(pickAverage.blastHeight)}, camera {formatUnits(pickAverage.width)} × {formatUnits(pickAverage.height)}.</div>}
      {full && (
        <div className="rounded-lg bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-400">
          LevelTypes.xml LeftKill {kill.left} · RightKill {kill.right} · TopKill {kill.top} · BottomKill {kill.bottom} · HardLeftKill {String(rules.hardLeft)} · HardRightKill {String(rules.hardRight)} · SoftTopKill {String(rules.softTop)} · CameraBounds {camera.x}, {camera.y}, {camera.width} × {camera.height} · {size.movingPlatforms} moving platforms. Kill values inside LevelDesc comments are not read by the game.
        </div>
      )}
    </Section>
  );
}

function MapDetails({ detail, comparisonDetail, detailUrl, averages }) {
  const { full } = useDataView({ url: true });
  const waves = useMemo(() => array(detail.scene?.WaveData), [detail]);
  const firstWaveId = waves.find((wave) => array(wave.Group).length > 0)?.ID ?? waves[0]?.ID ?? null;
  const [selectedWaveId, setSelectedWaveId] = useState(firstWaveId);
  const [partySize, setPartySize] = useState(2);
  const [waveTime, setWaveTime] = useState(0);
  const [waveDuration, setWaveDuration] = useState(0);
  const [wavePlaying, setWavePlaying] = useState(false);
  useEffect(() => {
    setSelectedWaveId(firstWaveId);
    setWaveTime(0);
    setWavePlaying(false);
  }, [detail.name, detail.manifest, firstWaveId]);
  useEffect(() => {
    if (!wavePlaying || !waveDuration) return undefined;
    const startedAt = performance.now() - waveTime * 1000;
    const timer = window.setInterval(() => {
      const next = (performance.now() - startedAt) / 1000;
      if (next >= waveDuration) {
        setWaveTime(waveDuration);
        setWavePlaying(false);
      } else {
        setWaveTime(next);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [wavePlaying, waveDuration]);
  const spawnRates = useMemo(() => {
    const unique = new Map();
    array(detail.gameModes).forEach((mode) => array(mode.itemSpawnRates).forEach((rate) => unique.set(rate.SpawnRateName, rate)));
    const timers = ['InitSpawnDelay', 'FixedTimeBetweenSpawns', 'VariableTimeBetweenSpawns', 'RandomTimeBetweenSpawns'];
    return [...unique.values()]
      .filter((rate) => full || timers.some((field) => number(rate[field]) > 0))
      .sort((a, b) => number(a.SpawnRateID) - number(b.SpawnRateID));
  }, [detail, full]);
  return (
    <div className="space-y-3">
      <WaveData
        waves={waves}
        selectedWaveId={selectedWaveId}
        onSelectWave={(id) => { setSelectedWaveId(id); setWaveTime(0); setWavePlaying(false); }}
        partySize={partySize}
        onPartySize={(size) => { setPartySize(size); setWaveTime(0); setWavePlaying(false); }}
        waveTime={waveTime}
        waveDuration={waveDuration}
        playing={wavePlaying}
        onPlaying={setWavePlaying}
        onTime={setWaveTime}
      />
      <div className="grid gap-3 min-[112.5rem]:grid-cols-[minmax(0,1fr)_26rem] min-[112.5rem]:items-start">
      <div className="min-w-0"><MapCanvas detail={detail} comparisonDetail={comparisonDetail} selectedWaveId={selectedWaveId} partySize={partySize} waveTime={waveTime} wavePlaying={wavePlaying} onWaveDuration={setWaveDuration} /></div>
      <div className="grid grid-cols-1 content-start gap-3 xl:grid-cols-2 2xl:grid-cols-3 min-[112.5rem]:grid-cols-1">
        <MapSizeCard size={detail.size} averages={averages} mud={array(detail.scene?.MudCollision)[0]} />
        <MetadataCard title="Item spawn timers" count={spawnRates.length}>
          {spawnRates.length > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {spawnRates.map((rate) => <div key={rate.SpawnRateName} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{full ? rate.SpawnRateName : titleCase(rate.SpawnRateName)}</div><div className="mt-1 text-[11px] text-slate-400">Initial {seconds(rate.InitSpawnDelay)} · Fixed {seconds(rate.FixedTimeBetweenSpawns)} · Variable {seconds(rate.VariableTimeBetweenSpawns)} · Random {seconds(rate.RandomTimeBetweenSpawns)}</div></div>)}
          </div> : <div className="text-xs text-slate-500">No item spawn timers</div>}
        </MetadataCard>
        <MetadataCard title="Level sets" count={detail.levelSets?.length || 0}>
          {detail.levelSets?.length ? <div className="flex flex-wrap gap-2">{sortLevelSets(detail.levelSets).map((set) => <Pill key={set.LevelSetName} title={set.LevelSetName}>{set.label || set.LevelSetName}</Pill>)}</div> : <div className="text-xs text-slate-500">Not in any level set</div>}
        </MetadataCard>
      </div>
      </div>
      {full ? (
        <>
          <MetadataCard title="Level Type"><DataPairs data={detail.level} omitted={['LevelName', 'DisplayName', 'ColorExclusionList']} className="2xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6" /><ColorExclusionIcons colors={detail.colorExclusions} /></MetadataCard>
          <LevelEffects scene={detail.scene} />
          <LevelSounds sounds={detail.scene?.LevelSound} />
          <RawData data={detail.level} title="Raw level data" filename={`level-${detail.name}`} />
          <RawData data={detail} title="Raw map data" source={detailUrl} filename={`map-${detail.name}${detail.manifest ? `-${detail.manifest}` : ''}`} />
        </>
      ) : (
        <>
          {array(detail.colorExclusions).length > 0 && <MetadataCard title="Colors you can't use here"><ColorExclusionIcons colors={detail.colorExclusions} bare /></MetadataCard>}
          <LevelEffects scene={detail.scene} />
          <ShowFullData label="Show level data and raw files" url className="self-start" />
        </>
      )}
    </div>
  );
}

function outOfHitstunKos(rules) {
  if (!rules) return '';
  const parts = [];
  if (rules.hardLeft && rules.hardRight) parts.push('Sides');
  else if (rules.hardLeft) parts.push('Left');
  else if (rules.hardRight) parts.push('Right');
  if (rules.softTop) parts.push('Top');
  return parts.join(', ');
}

const COMPARE_COLUMNS = [
  { key: 'map', label: 'Map', text: true, value: (entry) => mapName(entry) },
  { key: 'cameraWidth', label: 'Camera W', title: 'Camera area width', value: (entry) => entry.size?.camera?.width },
  { key: 'cameraHeight', label: 'Camera H', title: 'Camera area height', value: (entry) => entry.size?.camera?.height },
  { key: 'blastWidth', label: 'Blast W', title: 'Blast zone box width', value: (entry) => entry.size?.blast?.width },
  { key: 'blastHeight', label: 'Blast H', title: 'Blast zone box height', value: (entry) => entry.size?.blast?.height },
  { key: 'left', label: 'Left', title: 'Left blast line, past the camera edge', value: (entry) => entry.size?.kill?.left },
  { key: 'right', label: 'Right', title: 'Right blast line, past the camera edge', value: (entry) => entry.size?.kill?.right },
  { key: 'top', label: 'Top', title: 'Top blast line, past the camera edge', value: (entry) => entry.size?.kill?.top },
  { key: 'bottom', label: 'Bottom', title: 'Bottom blast line, past the camera edge', value: (entry) => entry.size?.kill?.bottom },
  { key: 'outOfHitstun', label: 'KO out of hitstun', title: 'Blast lines that KO you out of hitstun too. The bottom always does.', text: true, value: (entry) => outOfHitstunKos(entry.size?.rules) },
  { key: 'respawns', label: 'Respawns', value: (entry) => entry.size?.respawns },
  { key: 'itemSpawns', label: 'Weapon spawns', value: (entry) => entry.size?.itemSpawns },
  { key: 'movingPlatforms', label: 'Moving Platforms', value: (entry) => entry.size?.movingPlatforms },
  { key: 'name', label: 'Level name', text: true, full: true, value: (entry) => entry.name },
  { key: 'levelId', label: 'Level ID', full: true, value: (entry) => (clean(entry.levelId) ? number(entry.levelId) : undefined) },
  { key: 'cameraX', label: 'Camera X', full: true, value: (entry) => entry.size?.camera?.x },
  { key: 'cameraY', label: 'Camera Y', full: true, value: (entry) => entry.size?.camera?.y },
  { key: 'firstItemSpawns', label: 'First weapon spawns', full: true, value: (entry) => entry.size?.firstItemSpawns },
];

function compareValues(left, right, text) {
  const missingLeft = left === undefined || left === null || left === '';
  const missingRight = right === undefined || right === null || right === '';
  if (missingLeft || missingRight) return Number(missingLeft) - Number(missingRight);
  return text ? String(left).localeCompare(String(right)) : number(left) - number(right);
}

function MapCompare({ maps, retired, includeRetired, onIncludeRetired, averages, pool, onOpen }) {
  const { full } = useDataView({ url: true });
  const [sort, setSort] = useQueryState('sort', 'map');
  const [direction, setDirection] = useQueryState('dir', 'asc');
  const columns = COMPARE_COLUMNS.filter((column) => full || !column.full);
  const sortColumn = COMPARE_COLUMNS.find((column) => column.key === sort) || COMPARE_COLUMNS[0];
  const rows = useMemo(() => {
    const list = [...maps, ...(includeRetired ? retired.map((entry) => ({ ...entry, retired: true })) : [])];
    const factor = direction === 'desc' ? -1 : 1;
    return list
      .map((entry, index) => [entry, index])
      .sort(([left, leftIndex], [right, rightIndex]) => {
        const leftValue = sortColumn.value(left);
        const rightValue = sortColumn.value(right);
        const missing = Number(leftValue === undefined || leftValue === null || leftValue === '') - Number(rightValue === undefined || rightValue === null || rightValue === '');
        if (missing) return missing;
        return factor * compareValues(leftValue, rightValue, sortColumn.text) || leftIndex - rightIndex;
      })
      .map(([entry]) => entry);
  }, [maps, retired, includeRetired, sortColumn, direction]);
  const average = (pool === 'ranked2v2' ? averages?.ranked2v2 : averages?.ranked1v1) || averages?.ranked1v1;
  const averageName = average?.pool === 'ranked2v2' ? 'Ranked 2v2' : 'Ranked 1v1';
  const averageValues = average ? { cameraWidth: average.width, cameraHeight: average.height, blastWidth: average.blastWidth, blastHeight: average.blastHeight } : {};
  const pickSort = (column) => {
    if (column.key === sort) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else {
      setSort(column.key);
      setDirection(column.text ? 'asc' : 'desc');
    }
  };
  return (
    <Section padded={false} bodyClassName="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-bold text-white">{plural(rows.length, 'map')}</span>
        {retired.length > 0 && <Toggle label={`Retired maps (${retired.length})`} checked={includeRetired} onChange={onIncludeRetired} />}
      </div>
      {rows.length === 0 ? <EmptyState title="No maps match" bare /> : (
        <ScrollX className="rounded-lg border border-slate-800">
          <table className="w-full min-w-[56rem] border-collapse text-xs tabular-nums">
            <thead className="bg-slate-950 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {columns.map((column, index) => {
                  const active = column.key === sortColumn.key;
                  return (
                    <th key={column.key} scope="col" aria-sort={active ? (direction === 'desc' ? 'descending' : 'ascending') : 'none'} className={`whitespace-nowrap px-2 py-1.5 font-bold ${column.text ? 'text-left' : 'text-right'} ${index === 0 ? 'sticky left-0 z-10 bg-slate-950' : ''}`}>
                      <button type="button" title={column.title} onClick={() => pickSort(column)} className={`inline-flex items-center gap-1 uppercase hover:text-white ${active ? 'text-white' : ''}`}>
                        {column.label}
                        <span aria-hidden="true" className={active ? 'text-blue-300' : 'text-slate-600'}>{active ? (direction === 'desc' ? '▼' : '▲') : '↕'}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {average && (
                <tr className="border-t border-slate-800 bg-amber-500/5 text-amber-100">
                  {columns.map((column, index) => (
                    <td key={column.key} className={`whitespace-nowrap px-2 py-1.5 ${column.text ? 'text-left' : 'text-right'} ${index === 0 ? 'sticky left-0 z-10 bg-slate-900 font-bold' : ''}`}>
                      {index === 0 ? `${averageName} average (${average.maps})` : averageValues[column.key] !== undefined ? formatUnits(averageValues[column.key]) : ''}
                    </td>
                  ))}
                </tr>
              )}
              {rows.map((entry) => (
                <tr key={`${entry.retired ? 'retired' : 'map'}-${entry.name}`} className="border-t border-slate-800 hover:bg-slate-800/50">
                  {columns.map((column, index) => {
                    if (index === 0) {
                      return (
                        <th key={column.key} scope="row" className="sticky left-0 z-10 bg-slate-900 px-2 py-1 text-left font-normal">
                          <button type="button" onClick={() => onOpen(entry)} className="flex max-w-[16rem] items-center gap-2 text-left hover:text-blue-200">
                            {entry.thumbnail && <img src={mapThumbUrl(entry)} alt="" loading="lazy" className="h-6 w-10 shrink-0 rounded bg-slate-950 object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-white">{mapName(entry)}</span>
                              <span className="flex flex-wrap gap-1">
                                {entry.retired ? <Pill tone="rose" className="px-1.5 text-[10px]">{entry.patch ? `Retired after ${entry.patch}` : 'Retired'}</Pill> : <MapBadges entry={entry} short />}
                              </span>
                            </span>
                          </button>
                        </th>
                      );
                    }
                    const value = column.value(entry);
                    return (
                      <td key={column.key} className={`whitespace-nowrap px-2 py-1 ${column.text ? 'text-left text-slate-300' : 'text-right text-slate-100'} ${column.key === sortColumn.key ? 'bg-blue-500/5' : ''}`}>
                        {value === undefined || value === null || value === '' ? <span className="text-slate-600">-</span> : column.text ? value : formatUnits(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}
    </Section>
  );
}

function versionDate(entry) {
  return entry?.date ? new Date(number(entry.date) * 1000).toLocaleDateString() : '';
}

export default function MapViewer() {
  const { full } = useDataView({ url: true });
  const [catalog, setCatalog] = useState(null);
  const [retired, setRetired] = useState([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [comparisonDetail, setComparisonDetail] = useState(null);
  const [query, setQuery] = useQueryState('q', '');
  const [pool, setPool] = useState('');
  const [levelSet, setLevelSet] = useQueryState('set', '');
  const [history, setHistory] = useState([]);
  const [selectedManifest, setSelectedManifest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [tab, setTab] = useQueryState('tab', 'map');
  const [showRetired, setShowRetired] = useState(false);
  const [compareRetired, setCompareRetired] = useQueryFlag('retired');
  const comparing = tab === 'compare';

  useEffect(() => {
    setLoading(true);
    setError(null);
    const retiredRequest = fetch(`${host}/game/maps/retired`)
      .then((response) => (response.ok ? response.json() : { maps: [] }))
      .then((data) => array(data?.maps))
      .catch(() => []);
    retiredRequest.then(setRetired);
    fetch(`${host}/game/maps/catalog`)
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        return response.json();
      })
      .then(async (data) => {
        setCatalog(data);
        const params = new URLSearchParams(window.location.search);
        const collection = data.maps;
        const requestedName = params.get('name');
        const requestedManifest = params.get('manifest') || '';
        const requestedPool = params.get('pool') || '';
        const knownPool = array(data.support?.pools).some((entry) => entry.key === requestedPool) ? requestedPool : '';
        const ordered = orderMaps(collection);
        const defaultEntry = ordered.find((entry) => knownPool ? array(entry.pools).includes(knownPool) : array(entry.pools).includes('ranked1v1')) || ordered[0];
        setPool(knownPool);
        if (requestedName && !collection.some((entry) => entry.name === requestedName)) {
          const retiredEntry = (await retiredRequest).find((entry) => entry.name === requestedName);
          if (retiredEntry) {
            setShowRetired(true);
            setSelected(retiredEntry.name);
            setSelectedManifest(requestedManifest || retiredEntry.manifest);
            return;
          }
        }
        setSelected(collection.some((entry) => entry.name === requestedName) ? requestedName : defaultEntry?.name || '');
        setSelectedManifest(requestedManifest);
      })
      .catch((requestError) => setError({ scope: 'catalog', message: requestError.message }))
      .finally(() => setLoading(false));
  }, [catalogAttempt]);

  const retiredByName = useMemo(() => new Map(retired.map((entry) => [entry.name, entry])), [retired]);
  const retiredEntry = catalog?.maps?.some((entry) => entry.name === selected) ? null : retiredByName.get(selected) || null;
  const baseManifest = retiredEntry?.manifest || '';

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`${host}/game/maps/map/${encodeURIComponent(selected)}/history`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`History request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setHistory(data);
        setSelectedManifest((current) => (current === baseManifest || data.some((entry) => entry.manifest === current) ? current : baseManifest));
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError({ scope: 'detail', message: requestError.message });
      });
    return () => controller.abort();
  }, [selected, baseManifest, detailAttempt]);

  useEffect(() => {
    if (!selected) return;
    const manifest = selectedManifest || baseManifest;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    setComparisonDetail(null);
    const detailUrl = `${host}/game/maps/map/${encodeURIComponent(selected)}`;
    const withManifest = (value) => (value ? `${detailUrl}?manifest=${encodeURIComponent(value)}` : detailUrl);
    const getJson = (url) => fetch(url, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Detail request failed: ${response.status}`);
      return response.json();
    });
    Promise.all([
      getJson(withManifest(manifest)),
      manifest && manifest !== baseManifest ? getJson(withManifest(baseManifest)) : Promise.resolve(null),
    ])
      .then(([data, currentData]) => {
        setDetail(data);
        setComparisonDetail(currentData);
        const params = new URLSearchParams(window.location.search);
        params.delete('type');
        params.set('name', selected);
        if (manifest) params.set('manifest', manifest);
        else params.delete('manifest');
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError({ scope: 'detail', message: requestError.message }); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selected, selectedManifest, baseManifest, detailAttempt]);

  const collection = useMemo(() => orderMaps(catalog?.maps || []), [catalog]);
  const levelSetGroups = useMemo(() => groupedLevelSets(catalog?.support?.levelSets, catalog?.support?.levelSetGroups), [catalog]);
  const activeLevelSet = full ? levelSet : '';
  const inFilters = (entry) => {
    if (pool && !array(entry.pools).includes(pool)) return false;
    if (activeLevelSet && !entry.levelSets?.some((set) => set.name === activeLevelSet)) return false;
    return true;
  };
  const needle = query.trim().toLowerCase();
  const matchesQuery = (entry) => `${mapName(entry)} ${entry.displayName} ${entry.name}`.toLowerCase().includes(needle);
  const filtered = collection.filter((entry) => inFilters(entry) && matchesQuery(entry));
  const retiredShown = pool || activeLevelSet ? [] : retired.filter(matchesQuery);
  const retiredOpen = showRetired || Boolean(needle) || Boolean(retiredEntry);
  const sectioned = collection.some((entry) => entry.section);
  const sections = sectioned
    ? SECTION_ORDER.map((key) => [key, filtered.filter((entry) => (entry.section || 'tutorial') === key)]).filter(([, entries]) => entries.length)
    : [['all', filtered]];
  const poolItems = useMemo(() => [
    { value: '', label: 'All', count: collection.length },
    ...array(catalog?.support?.pools).map((entry) => ({ value: entry.key, label: entry.label, count: collection.filter((map) => array(map.pools).includes(entry.key)).length })).filter((item) => item.count > 0),
  ], [catalog, collection]);
  useEffect(() => {
    if (!catalog || retiredByName.has(selected)) return;
    const available = collection.filter(inFilters);
    if (available.length && !available.some((entry) => entry.name === selected)) setSelected(available[0].name);
  }, [catalog, pool, activeLevelSet, selected, retiredByName]);
  useEffect(() => {
    if (!catalog) return;
    const params = new URLSearchParams(window.location.search);
    if (pool) params.set('pool', pool);
    else params.delete('pool');
    const search = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
  }, [catalog, pool]);

  const retry = () => {
    if (error?.scope === 'catalog' || !catalog) setCatalogAttempt((value) => value + 1);
    else setDetailAttempt((value) => value + 1);
  };
  const clearFilters = () => {
    setQuery('');
    setPool('');
    setLevelSet('');
  };
  const openMap = (entry, close) => {
    setSelected(entry.name);
    setSelectedManifest(retiredByName.has(entry.name) && !collection.some((map) => map.name === entry.name) ? entry.manifest : '');
    if (comparing) setTab('map');
    close?.();
  };
  const selectedEntry = collection.find((entry) => entry.name === selected);
  const lastChange = history.find((entry) => isPatchNumber(entry.patch));
  const mapTitle = mapName(retiredEntry || selectedEntry || detail) || 'Map Viewer';
  const title = comparing ? 'Compare maps' : mapTitle;
  const poolLabel = array(catalog?.support?.pools).find((entry) => entry.key === pool)?.label;
  const mapCount = catalog ? (filtered.length === collection.length ? plural(collection.length, 'map') : `${filtered.length} of ${collection.length} maps`) : undefined;
  const wasRanked = retiredEntry && array(retiredEntry.pools).some((entry) => entry === 'ranked1v1' || entry === 'ranked2v2');
  const headerMeta = comparing ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{poolLabel || 'All maps'}</span>
      {needle && <span>matching "{query.trim()}"</span>}
    </span>
  ) : detail ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {retiredEntry ? (
        <>
          <Pill tone="rose">Retired</Pill>
          {isPatchNumber(retiredEntry.patch) && <span>Last in patch {retiredEntry.patch}</span>}
          {wasRanked && <span>Was a ranked map</span>}
        </>
      ) : (
        <>
          <MapBadges entry={selectedEntry} />
          {['casual', 'modes', 'botw', 'tutorial'].includes(selectedEntry?.section) && <span>{SECTION_LABELS[selectedEntry.section]}</span>}
          {lastChange && <span>Last changed in patch {lastChange.patch}</span>}
        </>
      )}
      {full && [detail.name, detail.file, isPatchNumber(detail.patch) && `Patch ${detail.patch}`, `Manifest ${detail.manifest}`, retiredEntry && isPatchNumber(retiredEntry.firstPatch) && `Files from ${retiredEntry.firstPatch} to ${retiredEntry.patch}`].filter(Boolean).map((part) => <span key={part} className="font-mono text-xs text-slate-500">{part}</span>)}
    </span>
  ) : undefined;

  const mapRow = (entry, close, retiredRow = false) => (
    <SidebarItem key={`${retiredRow ? 'retired' : 'map'}-${entry.name}`} active={selected === entry.name && !comparing} onClick={() => openMap(entry, close)} className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        {entry.thumbnail ? <img src={mapThumbUrl(entry)} alt="" loading="lazy" className={`h-10 w-16 shrink-0 rounded-md bg-slate-950 object-cover ${retiredRow ? 'opacity-70 grayscale' : ''}`} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <div className="h-10 w-16 shrink-0 rounded-md bg-slate-950" />}
        <div className="min-w-0">
          <div className="break-words text-sm font-bold text-white">{mapName(entry)}</div>
          {full && <div className="truncate font-mono text-[10px] text-slate-500">{entry.name}</div>}
          {retiredRow ? (
            isPatchNumber(entry.patch) && <div className="text-[11px] text-slate-400">Last in {entry.patch}</div>
          ) : mapBadges(entry).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1"><MapBadges entry={entry} short /></div>}
        </div>
      </div>
    </SidebarItem>
  );

  const sidebar = ({ close }) => (
    <>
      <SidebarHeader title="Maps" subtitle={mapCount} as="h2" />
      <SearchInput value={query} onChange={setQuery} placeholder="Search maps" className="flex-none" />
      <Tabs variant="small" label="Map pool" value={pool} onChange={setPool} items={poolItems} className="flex-none" />
      {full && (
        <SelectInput label="Level set" inline={false} value={levelSet} onChange={setLevelSet}>
          <option value="">All Level Sets</option>
          {levelSetGroups.map(([group, sets]) => (
            <optgroup key={group} label={group}>
              {sets.map((set) => <option key={set.name} value={set.name}>{set.label || set.name}</option>)}
            </optgroup>
          ))}
        </SelectInput>
      )}
      {catalog && filtered.length === 0 && retiredShown.length === 0 ? (
        <EmptyState title="No maps match" action={<button type="button" onClick={clearFilters} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Clear filters</button>} />
      ) : (
        <div className="space-y-3">
          {sections.map(([key, entries]) => (
            <div key={key}>
              {SECTION_LABELS[key] && (
                <div className="mb-1 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <span>{SECTION_LABELS[key]}</span>
                  <span className="text-slate-500">{entries.length}</span>
                </div>
              )}
              <div className="space-y-1">{entries.map((entry) => mapRow(entry, close))}</div>
            </div>
          ))}
          {retiredShown.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowRetired((value) => !value)} aria-expanded={retiredOpen} className="mb-1 flex w-full items-center justify-between rounded px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                <span>{retiredOpen ? '▾' : '▸'} Retired</span>
                <span className="text-slate-500">{retiredShown.length}</span>
              </button>
              {retiredOpen && <div className="space-y-1">{retiredShown.map((entry) => mapRow(entry, close, true))}</div>}
            </div>
          )}
        </div>
      )}
    </>
  );

  const versionSelect = !comparing && (history.length > 0 || retiredEntry) && (
    <SelectInput label="Version" value={selectedManifest || baseManifest} onChange={setSelectedManifest} className="max-w-full">
      {retiredEntry
        ? <option value={baseManifest}>Last version{isPatchNumber(retiredEntry.patch) ? ` - Patch ${retiredEntry.patch}` : ''}</option>
        : <option value="">Current{catalog?.patch ? ` - Patch ${catalog.patch}` : ''}</option>}
      {history.filter((entry) => entry.manifest !== catalog?.manifest && entry.manifest !== baseManifest).map((entry) => <option key={entry.manifest} value={entry.manifest}>{isPatchNumber(entry.patch) ? `Changed in Patch ${entry.patch}` : 'Changed'} - {versionDate(entry) || entry.manifest}</option>)}
    </SelectInput>
  );

  return (
    <PageShell title={title} subtitle={mapCount} sidebar={sidebar} sidebarLabel="Maps" sidebarTitle="Map list">
      <PageHeader
        eyebrow={!comparing && retiredEntry ? 'Retired map' : undefined}
        title={<span className="break-words">{title}</span>}
        meta={headerMeta}
        actions={(
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Tabs variant="small" label="View" value={comparing ? 'compare' : 'map'} onChange={setTab} items={[{ value: 'map', label: 'Map' }, { value: 'compare', label: 'Compare maps' }]} />
            {versionSelect}
            <DataViewToggle url />
          </div>
        )}
      />
      {loading && !comparing && <LoadingState label={catalog ? 'Loading map…' : 'Loading maps…'} rows={4} />}
      {error && (!comparing || error.scope === 'catalog') && <ErrorState message={error.scope === 'catalog' ? "Couldn't load the map list." : "Couldn't load this map."} detail={error.message} onRetry={retry} />}
      {comparing && catalog && (
        <MapCompare
          maps={filtered}
          retired={pool || activeLevelSet ? [] : retired.filter(matchesQuery)}
          includeRetired={compareRetired}
          onIncludeRetired={setCompareRetired}
          averages={catalog?.support?.averages}
          pool={pool}
          onOpen={(entry) => openMap(entry)}
        />
      )}
      {!comparing && !loading && detail && <MapDetails averages={catalog?.support?.averages} detail={detail} comparisonDetail={comparisonDetail} detailUrl={`${host}/game/maps/map/${encodeURIComponent(detail.name || selected)}${selectedManifest || baseManifest ? `?manifest=${encodeURIComponent(selectedManifest || baseManifest)}` : ''}`} />}
    </PageShell>
  );
}
