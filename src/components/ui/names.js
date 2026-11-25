import { useEffect, useState } from 'react';
import { apiUrl } from './assets';

export const WEAPON_LABELS = {
  Axe: 'Axe',
  Base: 'Unarmed',
  BattleBoots: 'Battle Boots',
  Blasters: 'Blasters',
  Boots: 'Battle Boots',
  Bow: 'Bow',
  Cannon: 'Cannon',
  Chakram: 'Chakram',
  Fists: 'Gauntlets',
  Gauntlet: 'Gauntlets',
  Gauntlets: 'Gauntlets',
  GreatSword: 'Greatsword',
  Greatsword: 'Greatsword',
  Hammer: 'Hammer',
  Katar: 'Katars',
  Katars: 'Katars',
  Lance: 'Rocket Lance',
  Orb: 'Orb',
  Pistol: 'Blasters',
  Pistols: 'Blasters',
  RocketLance: 'Rocket Lance',
  Scythe: 'Scythe',
  Spear: 'Spear',
  Sword: 'Sword',
  Unarmed: 'Unarmed',
};

export const foldText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o')
  .replace(/æ/gi, 'ae')
  .toLowerCase();

export const matchesWords = (query, values) => {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = foldText((Array.isArray(values) ? values : [values]).filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
};

export const weaponName = (raw, labels) => {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const table = labels || WEAPON_LABELS;
  if (table[text]) return table[text];
  const key = Object.keys(table).find((name) => name.toLowerCase() === text.toLowerCase());
  if (key) return table[key];
  const bot = text.match(/^(.+?)Bot$/);
  if (bot && (table[bot[1]] || WEAPON_LABELS[bot[1]])) return `${table[bot[1]] || WEAPON_LABELS[bot[1]]} (bot)`;
  return text;
};

const empty = { weapons: WEAPON_LABELS, legends: [], levelSets: {}, achievements: {}, emojis: {}, levelSetGroups: [] };
let request = null;
let loaded = null;

export function loadGameNames() {
  if (loaded) return Promise.resolve(loaded);
  request ||= fetch(apiUrl('/game/names'))
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((data) => {
      loaded = data ? { ...empty, ...data, weapons: { ...WEAPON_LABELS, ...(data.weapons || {}) } } : empty;
      if (!data) request = null;
      return loaded;
    });
  return request;
}

export const currentGameNames = () => loaded || empty;

export function useGameNames() {
  const [names, setNames] = useState(loaded || empty);
  useEffect(() => {
    let alive = true;
    loadGameNames().then((data) => { if (alive) setNames(data); });
    return () => { alive = false; };
  }, []);
  return names;
}
