import { useEffect, useMemo, useRef, useState } from 'react';
import { host } from '../../stuff';

const COLORS = {
  camera: '#60a5fa',
  kill: '#f43f5e',
  spawnBounds: '#a78bfa',
  hard: '#f8fafc',
  soft: '#38bdf8',
  noSlide: '#f59e0b',
  bouncy: '#34d399',
  hazard: '#fb7185',
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
  ['cameraBounds', 'Camera Bounds', true],
  ['killBounds', 'Kill Bounds', true],
  ['spawnBotBounds', 'Spawn Bot Bounds', false],
  ['hardCollision', 'Hard Collision', true],
  ['softCollision', 'Soft Collision', true],
  ['noSlideCollision', 'No-Slide Collision', true],
  ['bouncyCollision', 'Bouncy Collision', true],
  ['lavaCollision', 'Lava Collision', true],
  ['pressureCollision', 'Pressure Plates', true],
  ['gameModeCollision', 'Game Mode Collision', true],
  ['respawns', 'Respawns', true],
  ['itemSpawns', 'Item Spawns', true],
  ['initialItemSpawns', 'Initial Item Spawns', true],
  ['teamItemSpawns', 'Team Item Spawns', true],
  ['goals', 'Goals', true],
  ['navigation', 'Navigation', false],
  ['movingPlatforms', 'Moving Platforms', true],
  ['wavePaths', 'Wave Paths', true],
  ['waveEnemies', 'Wave Enemies', true],
  ['animatedBackgrounds', 'Animated Backgrounds', false],
  ['levelAnimations', 'Level Animations', false],
  ['versionChanges', 'Version Changes', false],
  ['assets', 'Map Assets', true],
  ['modeAssets', 'Mode Assets', false],
];

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
  pressureCollision: COLORS.pressure,
  gameModeCollision: '#e879f9',
  respawns: COLORS.respawn,
  itemSpawns: COLORS.item,
  initialItemSpawns: '#4ade80',
  teamItemSpawns: '#14b8a6',
  goals: COLORS.goal,
  navigation: COLORS.nav,
  movingPlatforms: COLORS.moving,
  wavePaths: '#f472b6',
  waveEnemies: '#fb7185',
  animatedBackgrounds: '#d946ef',
  levelAnimations: '#fde047',
  versionChanges: '#fb7185',
  assets: COLORS.asset,
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
  'All / Game Modes',
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
  if (text.includes('all') || text.includes('game mode') || text.includes('gamemode')) return 'All / Game Modes';
  return 'Other';
}

function groupedLevelSets(levelSets) {
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
    } else if (tag === 'Platform' && node.AssetName && node.W && node.H) {
      const width = number(node.W);
      const height = number(node.H);
      const imageMatrix = multiplyMatrix(worldMatrix, [width < 0 ? -1 : 1, 0, 0, height < 0 ? -1 : 1, 0, 0]);
      addLinked({ kind: 'image', layer: assetLayers[0], layers: assetLayers, type: tag, ...matrixBounds(imageMatrix, 0, 0, Math.abs(width), Math.abs(height)), matrix: imageMatrix, imageW: Math.abs(width), imageH: Math.abs(height), href: mapAssetUrl(assetDir, node.AssetName), color: COLORS.asset, details });
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
      kind: 'rect',
      layer: 'killBounds',
      hitMode: 'stroke',
      type: 'KillBounds',
      x: number(camera.X) - left,
      y: number(camera.Y) - top,
      w: number(camera.W) + left + right,
      h: number(camera.H) + top + bottom,
      color: COLORS.kill,
      details: { type: 'KillBounds', LeftKill: left, RightKill: right, TopKill: top, BottomKill: bottom },
    });
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
    return [x - padding, y - padding, width + padding * 2, height + padding * 2];
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

function HoverTooltip({ hovered, pointer }) {
  if (!hovered) return null;
  const pairs = displayPairs(hovered.details, ['type', 'path']);
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-80 rounded-xl border border-slate-600 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur"
      style={{ left: pointer.x + 18, top: pointer.y + 18 }}
    >
      <div className="font-bold text-white">{titleCase(hovered.type)}</div>
      {hovered.details?.path && <div className="mt-0.5 break-all text-[10px] text-slate-500">{hovered.details.path}</div>}
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

function MapShape({ shape, active, onEnter, onLeave, onMove, onPlatformPointerDown, onAnimationToggle, selectedAnimation, platformPosition, pointRadius }) {
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
        <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={stroke} strokeWidth={active ? 5 : 2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
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
  return (
    <g {...common}>
      <rect x={shape.x} y={shape.y} width={Math.max(shape.w, 1)} height={Math.max(shape.h, 1)} fill={active ? '#facc1528' : `${shape.color}12`} stroke={stroke} strokeWidth={active ? 4 : 2} strokeDasharray={shape.type.includes('Bounds') ? '10 7' : undefined} vectorEffect="non-scaling-stroke" pointerEvents="none" />
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

function MapCanvas({ detail, comparisonDetail, selectedWaveId, partySize = 2, waveTime = 0, wavePlaying = false, onWaveDuration }) {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
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
      .map((layer) => [layer, `${layer.slice('event:'.length)} Assets`, false]),
  ], [availableLayers]);
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
  const layerEnabled = (layer) => layer.startsWith('event:') ? layers[layer] === true : layers[layer] !== false;
  const visible = positionedShapes.filter((shape) => (shape.layers || [shape.layer]).some(layerEnabled));

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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {layerOptions.filter(([layer]) => availableLayers.has(layer)).map(([layer, label]) => (
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
      </div>
      <div ref={containerRef} className="relative min-h-[34rem] overflow-hidden rounded-2xl border border-slate-700 bg-[#07101d] shadow-inner">
        <svg
          ref={svgRef}
          viewBox={viewBox.join(' ')}
          className="h-[34rem] w-full cursor-grab touch-none active:cursor-grabbing"
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
            <MapShape key={shape.id} shape={shape} active={hovered?.id === shape.id} onEnter={setHovered} onLeave={() => setHovered(null)} onMove={moveTooltip} onPlatformPointerDown={startPlatformDrag} onAnimationToggle={(id) => setSelectedAnimation((current) => current === id ? null : id)} selectedAnimation={selectedAnimation} platformPosition={shape.platformId ? platformPositions.get(shape.platformId) : null} pointRadius={pointRadius} />
          ))}
        </svg>
        <HoverTooltip hovered={hovered} pointer={pointer} />
        <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg border border-slate-600 bg-slate-950/90 shadow-xl">
          <button type="button" onClick={() => zoomAt(0.8)} className="px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setViewBox(baseViewBox)} className="border-x border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Reset</button>
          <button type="button" onClick={() => zoomAt(1.25)} className="px-3 py-2 text-sm font-bold text-white hover:bg-slate-800" aria-label="Zoom out">-</button>
        </div>
        <div className="absolute bottom-3 left-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-400">
          ViewBox {viewBox.map((value) => Math.round(value)).join(' x ')} - {visible.length} visible elements
        </div>
        {layers.versionChanges && comparisonDetail && <div className="absolute bottom-3 right-3 flex gap-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] font-bold"><span className="text-rose-400">Historical only</span><span className="text-green-400">Current only</span></div>}
      </div>
      {movingPaths.size > 0 && <div className="grid gap-2 rounded-xl border border-orange-400/30 bg-orange-500/5 p-3 sm:grid-cols-2 xl:grid-cols-5">
        {[...movingPaths].map(([platformId, path]) => {
          const timing = movingPlatformTiming(path);
          return <label key={platformId} className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">
            <span className="flex items-center justify-between gap-3"><span className="font-bold text-orange-200">Moving Platform {platformId}</span><span>{Math.round((platformProgress[platformId] || 0) * 100)}%</span></span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span>Start frame {timing.startFrame || 0}</span>
              {timing.numFrames > 0 && <span>Loop {timing.numFrames} frames</span>}
              {timing.slowMult !== 1 && <span>Speed x{timing.slowMult}</span>}
            </span>
            <input type="range" min="0" max="1000" value={Math.round((platformProgress[platformId] || 0) * 1000)} onChange={(event) => setPlatformProgress((current) => ({ ...current, [platformId]: number(event.target.value) / 1000 }))} className="mt-2 w-full accent-orange-400" aria-label={`Moving Platform ${platformId} position`} />
            <span className="mt-1 block text-[10px] text-slate-500">Drag its collision, artwork, or orange path handle.</span>
          </label>;
        })}
      </div>}
    </div>
  );
}

function MetadataCard({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/75 p-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function DataPairs({ data, omitted = [] }) {
  const pairs = displayPairs(data, omitted);
  if (!pairs.length) return <div className="text-xs text-slate-500">No data</div>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

function ColorExclusionIcons({ colors }) {
  if (!array(colors).length) return null;
  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Color Exclusions</div>
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
    <div className="rounded-xl border border-rose-400/30 bg-slate-900/75 p-3">
      <div className="space-y-3">
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Waves</div>
            <div className="flex gap-2 overflow-x-auto pb-2 app-scrollbar">
            {entries.map((entry, index) => {
              const id = entry.ID ?? index;
              const active = String(id) === String(wave.ID ?? selectedIndex);
              return <button key={id} type="button" onClick={() => onSelectWave(id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${active ? 'border-rose-400 bg-rose-500/20 text-white' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white'}`}>Wave {id}</button>;
            })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Players</span>
            <div className="flex gap-2">
              {[2, 3, 4].map((size) => <button key={size} type="button" onClick={() => onPartySize(size)} className={`min-w-10 rounded-lg border px-3 py-2 text-xs font-bold transition ${partySize === size ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}>{size}</button>)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/25 bg-rose-500/5 px-3 py-2">
          <div><div className="text-base font-bold text-white">Wave {wave.ID ?? selectedIndex}</div><div className="text-[11px] text-slate-400">{groupData.length} spawn groups · {array(wave.CustomPath).length} custom paths</div></div>
          <div className="text-right"><div className="text-xl font-black text-rose-300">{totalEnemies}</div><div className="text-[10px] font-bold uppercase text-slate-500">Enemies</div></div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => onPlaying(!playing)} disabled={!waveDuration} className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{playing ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => { onTime(0); onPlaying(true); }} disabled={!waveDuration} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-40">Replay</button>
          </div>
          <input type="range" min="0" max={Math.max(1, Math.round(waveDuration * 1000))} value={Math.min(Math.round(waveTime * 1000), Math.max(1, Math.round(waveDuration * 1000)))} onChange={(event) => { onPlaying(false); onTime(number(event.target.value) / 1000); }} className="w-full accent-rose-400" aria-label="Wave playback position" />
          <div className="shrink-0 text-right text-xs font-bold tabular-nums text-slate-300">{waveTime.toFixed(1)}s / {waveDuration.toFixed(1)}s</div>
        </div>

      </div>
    </div>
  );
}

function LevelEffects({ scene }) {
  const backgrounds = array(scene?.AnimatedBackground);
  const periodic = [...array(scene?.LevelAnimation), ...array(scene?.LevelAnim)];
  if (!backgrounds.length && !periodic.length) return null;
  return <details className="rounded-xl border border-slate-700 bg-slate-900/75"><summary className="cursor-pointer px-3 py-2 text-sm font-bold text-white">Map Animations ({backgrounds.length + periodic.length})</summary><div className="space-y-3 border-t border-slate-700 p-3"><div className="text-xs text-slate-400">Enable an animation layer, then select a marker on the map to load that effect.</div>{backgrounds.length > 0 && <div><div className="mb-2 text-[10px] font-bold uppercase text-fuchsia-300">Animated Backgrounds ({backgrounds.length})</div><div className="flex flex-wrap gap-2">{backgrounds.map((effect, index) => <span key={index} className="rounded-lg bg-slate-950 px-2 py-1 text-[11px] text-slate-300">{effect.Gfx?.AnimClass || `Effect ${index + 1}`}</span>)}</div></div>}{periodic.length > 0 && <div><div className="mb-2 text-[10px] font-bold uppercase text-yellow-300">Level Animations ({periodic.length})</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{periodic.map((effect, index) => <div key={index} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{effect.AnimationName || effect.AssetName || `Animation ${index + 1}`}</div><DataPairs data={effect} omitted={['AnimationName', 'AssetName']} /></div>)}</div></div>}</div></details>;
}

function LevelSounds({ sounds }) {
  const entries = array(sounds).sort((left, right) => number(left.Delay) - number(right.Delay));
  if (!entries.length) return null;
  return <details className="rounded-xl border border-slate-700 bg-slate-900/75"><summary className="cursor-pointer px-3 py-2 text-sm font-bold text-white">Sound Timeline ({entries.length})</summary><div className="grid gap-2 border-t border-slate-700 p-3 sm:grid-cols-2 xl:grid-cols-4">{entries.map((sound, index) => <div key={`${sound.SoundEventName}-${index}`} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{sound.SoundEventName}</div><div className="mt-1 text-[11px] text-slate-400">Starts {seconds(sound.Delay)}{clean(sound.Interval) ? ` · repeats every ${seconds(sound.Interval)}` : ''}</div></div>)}</div></details>;
}

function MapDetails({ detail, comparisonDetail }) {
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
    return [...unique.values()].sort((a, b) => number(a.SpawnRateID) - number(b.SpawnRateID));
  }, [detail]);
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
      <MapCanvas detail={detail} comparisonDetail={comparisonDetail} selectedWaveId={selectedWaveId} partySize={partySize} waveTime={waveTime} wavePlaying={wavePlaying} onWaveDuration={setWaveDuration} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <MetadataCard title={`Item Spawn Timers (${spawnRates.length})`}>
          {spawnRates.length > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {spawnRates.map((rate) => <div key={rate.SpawnRateName} className="rounded-lg bg-slate-950 p-2"><div className="text-xs font-bold text-white">{rate.SpawnRateName}</div><div className="mt-1 text-[11px] text-slate-400">Initial {seconds(rate.InitSpawnDelay)} · Fixed {seconds(rate.FixedTimeBetweenSpawns)} · Variable {seconds(rate.VariableTimeBetweenSpawns)} · Random {seconds(rate.RandomTimeBetweenSpawns)}</div></div>)}
          </div> : <div className="text-xs text-slate-500">No item spawn timers</div>}
        </MetadataCard>
        <MetadataCard title={`Level Sets (${detail.levelSets?.length || 0})`}>
          <div className="flex flex-wrap gap-2">{sortLevelSets(detail.levelSets).map((set) => <span key={set.LevelSetName} className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200">{set.LevelSetName}</span>)}</div>
        </MetadataCard>
      </div>
      <MetadataCard title="Level Type"><DataPairs data={detail.level} omitted={['LevelName', 'DisplayName', 'ColorExclusionList']} /><ColorExclusionIcons colors={detail.colorExclusions} /></MetadataCard>
      <LevelEffects scene={detail.scene} />
      <LevelSounds sounds={detail.scene?.LevelSound} />
    </div>
  );
}

function LessonObjectList({ title, value }) {
  const entries = array(value);
  if (!entries.length) return null;
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{title} ({entries.length})</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry, index) => <div key={`${title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950 p-2"><DataPairs data={entry} omitted={['demoRecording']} /></div>)}
      </div>
    </div>
  );
}

function LessonDetails({ lesson }) {
  const sequence = array(lesson.sequence);
  const [eventIndex, setEventIndex] = useState(0);
  const activeEvent = sequence[eventIndex] || null;
  const activePower = activeEvent?.powers?.[0] || null;
  const playerEntity = array(lesson.Entity).find((entity) => clean(entity.Role) === 'Player');
  const animation = activePower?.animation;
  const playerAnimation = animation && playerEntity?.hero?.HeroID !== undefined
    ? `${host}/game/anim/char/${playerEntity.hero.HeroID}-${playerEntity.costume?.index || 0}/${animation.folder}/${animation.rig}/${animation.state}/loop`
    : null;
  const duration = sequence.length ? Math.max(...sequence.map((event) => number(event.time))) : 0;
  const challenge = useMemo(() => ({
    entities: array(lesson.Entity),
    markers: [...array(lesson.Marker), ...array(lesson.Waypoint)],
    activeEvent,
    playerAnimation,
  }), [lesson, activeEvent, playerAnimation]);
  useEffect(() => setEventIndex(0), [lesson.LessonName]);
  return (
    <details open className="rounded-xl border border-slate-700 bg-slate-950/75">
      <summary className="cursor-pointer px-3 py-3">
        <span className="font-bold text-white">{lesson.displayTitle || lesson.LessonName}</span>
        <span className="ml-2 text-xs text-slate-400">{lesson.Category} · {lesson.LevelType}</span>
      </summary>
      <div className="space-y-3 border-t border-slate-700 p-3">
        {lesson.displayDescription && <p className="text-sm leading-6 text-slate-300">{lesson.displayDescription}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2"><div className="text-[10px] font-bold uppercase text-amber-300">Gold Reward</div><div className="text-lg font-black text-white">{lesson.GoldReward || 0}</div></div>
          <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2"><div className="text-[10px] font-bold uppercase text-violet-300">Difficulty</div><div className="text-lg font-black text-white">{lesson.Difficulty || '-'}</div></div>
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2"><div className="text-[10px] font-bold uppercase text-cyan-300">Timeframe</div><div className="text-lg font-black text-white">{seconds(duration)}</div></div>
          <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2"><div className="text-[10px] font-bold uppercase text-blue-300">Win Condition</div><div className="text-sm font-black text-white">{lesson.WinCondition || '-'}</div></div>
        </div>

        {lesson.map ? <MapCanvas detail={lesson.map} selectedWaveId={null} challenge={challenge} /> : <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">The map for this challenge is unavailable.</div>}

        {sequence.length > 0 && <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex items-end justify-between gap-3"><div><div className="text-sm font-bold text-white">Challenge Sequence</div><div className="text-[11px] text-slate-400">Select an event to inspect what occurs on the map.</div></div><div className="text-xs font-bold text-cyan-300">{eventIndex + 1} / {sequence.length}</div></div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 app-scrollbar">
            {sequence.map((event, index) => {
              const power = event.powers?.[0];
              return <button key={`${event.eventType}-${event.time}-${index}`} type="button" onClick={() => setEventIndex(index)} className={`min-w-36 shrink-0 rounded-lg border px-3 py-2 text-left transition ${eventIndex === index ? 'border-cyan-300 bg-cyan-500/15' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}>
                <div className="text-[10px] font-bold uppercase text-slate-500">{seconds(event.time)}</div>
                <div className="mt-0.5 text-xs font-bold text-white">{titleCase(event.eventType)}</div>
                {power && <div className="mt-0.5 truncate text-[10px] text-cyan-300">{power.PowerName}</div>}
              </button>;
            })}
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-lg bg-slate-950 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Selected Event</div>
              <div className="mt-1 text-base font-bold text-white">{titleCase(activeEvent?.eventType)}</div>
              <div className="text-xs text-slate-400">At {seconds(activeEvent?.time)}</div>
              {activePower?.DevNotes && <p className="mt-3 text-xs leading-5 text-slate-300">{activePower.DevNotes}</p>}
            </div>
            <div className="rounded-lg bg-slate-950 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Power Result</div>
              {activeEvent?.powers?.length ? <div className="space-y-2">{activeEvent.powers.map((power) => <div key={power.PowerID} className="rounded-lg border border-slate-800 p-2"><div className="mb-2 text-xs font-bold text-cyan-300">{power.PowerName}</div><DataPairs data={power} omitted={['DevNotes', 'HitGfx', 'animation']} /></div>)}</div> : <div className="mt-2 text-xs text-slate-500">This event is an input or movement event, not a power.</div>}
            </div>
          </div>
        </section>}

        <details className="rounded-lg border border-slate-800 bg-slate-950"><summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-300">Challenge Data</summary><div className="space-y-3 border-t border-slate-800 p-3"><DataPairs data={lesson} omitted={['Entity', 'Item', 'Marker', 'Waypoint', 'MessageTrigger', 'Combo', 'sequence', 'map', 'categoryData', 'displayTitle', 'displayDescription']} /><LessonObjectList title="Items" value={lesson.Item} /><LessonObjectList title="Message Triggers" value={lesson.MessageTrigger} /></div></details>
      </div>
    </details>
  );
}

export default function MapViewer() {
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [comparisonDetail, setComparisonDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [showDevMaps, setShowDevMaps] = useState(false);
  const [levelSet, setLevelSet] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedManifest, setSelectedManifest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${host}/game/maps/catalog`)
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setCatalog(data);
        const params = new URLSearchParams(window.location.search);
        const collection = data.maps;
        const requestedName = params.get('name');
        const requestedManifest = params.get('manifest') || '';
        const defaultEntry = collection;
        setSelected(collection.some((entry) => entry.name === requestedName) ? requestedName : defaultEntry?.name || '');
        setSelectedManifest(requestedManifest);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

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
        setSelectedManifest((current) => data.some((entry) => entry.manifest === current) ? current : '');
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDetail(null);
    setComparisonDetail(null);
    const versionQuery = selectedManifest ? `?manifest=${encodeURIComponent(selectedManifest)}` : '';
    const detailUrl = `${host}/game/maps/map/${encodeURIComponent(selected)}`;
    const getJson = (url) => fetch(url, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Detail request failed: ${response.status}`);
      return response.json();
    });
    Promise.all([
      getJson(`${detailUrl}${versionQuery}`),
      selectedManifest ? getJson(detailUrl) : Promise.resolve(null),
    ])
      .then(([data, currentData]) => {
        setDetail(data);
        setComparisonDetail(currentData);
        const params = new URLSearchParams(window.location.search);
        params.delete('type');
        params.set('name', selected);
        if (selectedManifest) params.set('manifest', selectedManifest);
        else params.delete('manifest');
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selected, selectedManifest]);

  const collection = catalog?.maps || [];
  const levelSetGroups = useMemo(() => groupedLevelSets(catalog?.support?.levelSets), [catalog]);
  const filtered = collection.filter((entry) => {
    if (!`${entry.displayName} ${entry.name}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (levelSet && !entry.levelSets?.some((set) => set.name === levelSet)) return false;
    return true;
  });
  useEffect(() => {
    if (!catalog) return;
    const available = catalog.maps.filter((entry) => {
      if (levelSet && !entry.levelSets?.some((set) => set.name === levelSet)) return false;
      return true;
    });
    if (available.length && !available.some((entry) => entry.name === selected)) setSelected(available[0].name);
  }, [catalog, showDevMaps, levelSet, selected]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      <div className="grid min-h-[calc(100vh-4rem)] content-start grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-800 bg-slate-950 p-3 lg:sticky lg:top-0 lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col lg:border-b-0 lg:border-r">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search maps" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-400" />
          <div className="mt-2 space-y-2">
            <select value={levelSet} onChange={(event) => setLevelSet(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-400">
              <option value="">All Level Sets</option>
              {levelSetGroups.map(([group, sets]) => (
                <optgroup key={group} label={group}>
                  {sets.map((set) => <option key={set.name} value={set.name}>{set.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none lg:hidden">
            {filtered.map((entry) => <option key={entry.name} value={entry.name}>{entry.displayName}</option>)}
          </select>
          <div className="mt-3 hidden min-h-0 flex-1 overflow-y-auto pr-1 app-scrollbar lg:block">
            <div className="space-y-1">
              {filtered.map((entry) => (
                <button key={entry.name} type="button" onClick={() => setSelected(entry.name)} className={`w-full rounded-xl border px-3 py-2 text-left transition ${selected === entry.name ? 'border-blue-400 bg-blue-500/20' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                  <div className="flex items-center gap-3">
                    {entry.thumbnail && <img src={`${host}/game/images/images/thumbnails/${entry.thumbnail}`} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded-md bg-slate-950 object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                    <div className="min-w-0"><div className="break-words text-sm font-bold text-white">{entry.displayName}</div><div className="mt-0.5 break-all text-[11px] text-slate-500">{entry.name}</div></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <main className="min-w-0 p-3 sm:p-4 lg:p-5">
          <header className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-blue-300">Dynamic LevelDesc</div>
                <h1 className="mt-1 break-words text-2xl font-bold text-white sm:text-3xl">{detail?.displayName || detail?.name || 'Map Viewer'}</h1>
              </div>
              {history.length > 0 && <label className="min-w-56 text-[10px] font-bold uppercase tracking-wide text-slate-500">Version History
                <select value={selectedManifest} onChange={(event) => setSelectedManifest(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold normal-case text-white outline-none focus:border-blue-400">
                  <option value="">Current{catalog?.patch ? ` - Patch ${catalog.patch}` : ''}</option>
                  {history.filter((entry) => entry.manifest !== catalog?.manifest).map((entry) => <option key={entry.manifest} value={entry.manifest}>Changed in Patch {entry.patch || 'Unknown'} - {entry.date ? new Date(number(entry.date) * 1000).toLocaleDateString() : entry.manifest}</option>)}
                </select>
              </label>}
            </div>
            {detail && <div className="mt-1 text-xs text-slate-400">{detail.file} - Patch {detail.patch || 'Unknown'} - Manifest {detail.manifest}</div>}
          </header>
          {loading && <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-300">Loading map geometry...</div>}
          {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">{error}</div>}
          {!loading && detail && <MapDetails detail={detail} comparisonDetail={comparisonDetail} />}
        </main>
      </div>
    </div>
  );
}
