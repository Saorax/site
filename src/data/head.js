import { host } from '../stuff';
import { sections } from './sections.js';

export const DEFAULT_TITLE = 'Brawlhalla rankings, results and game data';
export const SITE_URL = String(import.meta.env.PUBLIC_SITE_URL || 'https://saorax.com').replace(/\/+$/, '');
export const DEFAULT_DESCRIPTION = 'Brawlhalla Power Rankings, tournament results and data from the game files.';
export const DEFAULT_IMAGE = '/asuri.png';

const DESCRIPTION_LIMIT = 220;

export const pageTitle = (title) => String(title ?? '').replace(/\s+/g, ' ').trim() || DEFAULT_TITLE;

export const clipDescription = (text, limit = DESCRIPTION_LIMIT) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s·,:;]+$/, '')}…`;
};

export const absoluteUrl = (value, base = SITE_URL) => {
  if (!value) return '';
  try {
    return new URL(value, `${base}/`).href;
  } catch {
    return '';
  }
};

export const toolText = (href) => sections.flatMap((section) => section.tools).find((tool) => tool.href === href)?.text ?? '';

export const gamePng = (path, width = 512) => (path ? `${host}${path.startsWith('/') ? '' : '/'}${path}${path.includes('?') ? '&' : '?'}format=png&w=${width}` : '');

const cache = new Map();
const CACHE_LIMIT = 500;

const remember = (key, value, ttl) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
};

export async function cachedJson(url, { ttl = 5 * 60 * 1000, timeout = 2500 } = {}) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    return remember(url, await response.json(), ttl);
  } catch {
    return null;
  }
}

export async function fetchPageHead(kind, id) {
  const url = `${host}/v2/esports/head/${kind}/${id}`;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (response.ok) return remember(url, { head: await response.json(), missing: false }, 5 * 60 * 1000);
    const body = response.status === 404 ? await response.json().catch(() => null) : null;
    return remember(url, { head: null, missing: body?.message === 'Page was not found' }, 60 * 1000);
  } catch {
    return { head: null, missing: false };
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const shortDate = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const STAT_NAMES = [['str', 'Str'], ['dex', 'Dex'], ['def', 'Def'], ['spe', 'Spd']];

export function legendHead(legend, summary) {
  const name = legend?.bio?.name?.normal || '';
  if (!name) return null;
  const weaponSource = summary?.weapons ?? legend.weapons;
  const weapons = [weaponSource?.main, weaponSource?.secondary].map((weapon) => weapon?.displayName || weapon?.name).filter(Boolean);
  const stats = STAT_NAMES.map(([key, label]) => (legend.stances?.[key] != null ? `${label} ${legend.stances[key]}` : null)).filter(Boolean);
  const released = shortDate(legend.release);
  return {
    title: `${name} · Brawlhalla legend`,
    description: clipDescription([
      legend.bio?.aka,
      weapons.join(' and '),
      stats.join(', '),
      released && `Released ${released}`,
    ].filter(Boolean).join(' · ')),
    image: gamePng(legend.image),
    imageAlt: name,
  };
}
