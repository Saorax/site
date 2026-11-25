import { host } from '../../stuff';

export const apiUrl = (path = '') => (/^https?:\/\//.test(path) ? path : `${host}${path.startsWith('/') ? '' : '/'}${path}`);

export const gfxUrl = (file, name, frame) => `${host}/game/getGfx/${file}/${encodeURIComponent(name)}${frame !== undefined ? `/${frame}` : ''}`;

export const weaponIconUrl = (icon) => (icon ? gfxUrl('UI_Icons', `a_WeaponIcon_${icon}`, 1) : '');

export const portraitUrl = (hero) => {
  if (!hero) return '';
  if (hero.portrait) return gfxUrl(hero.portraitFile || 'UI_Icons', hero.portrait, 1);
  if (typeof hero.image === 'string' && hero.image) return apiUrl(hero.image);
  const name = hero.name || hero.bio?.name?.normal || hero.codeName;
  return name ? `${host}/game/legends/art/${encodeURIComponent(name)}` : '';
};

export const mapThumbUrl = (map) => {
  const file = typeof map === 'string' ? map : map?.thumbnail;
  return file ? `${host}/game/images/images/thumbnails/${file}` : '';
};

export const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export const legendHref = (legend) => {
  const name = typeof legend === 'string' ? legend : legend?.name || legend?.bio?.name?.normal;
  const slug = slugify(name);
  return slug ? `/game/legends/${slug}` : '';
};

export const currencies = {
  gold: { label: 'Gold', short: 'Gold', icon: 'storeIcon/gold' },
  mc: { label: 'Mammoth Coins', short: 'MC', icon: 'storeIcon/mc' },
  glory: { label: 'Glory', short: 'Glory', icon: 'storeIcon/glory' },
};

const currencyAliases = { idol: 'mc', mammoth: 'mc', mammothcoins: 'mc', mammothcoin: 'mc', coins: 'mc' };

export const eventCurrencyLabel = (key) => String(key || '')
  .replace(/^a_Currency_/, '')
  .replace(/(\d{2,4})$/, ' $1')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .trim();

export function currencyInfo(currency) {
  const raw = String(currency || '').trim();
  const key = currencyAliases[raw.toLowerCase().replace(/[^a-z]/g, '')] || raw.toLowerCase();
  if (currencies[key]) return { key, ...currencies[key], src: `${host}/game/getGfx/${currencies[key].icon}` };
  if (!raw) return { key: '', label: '', short: '', src: '' };
  const name = raw.replace(/^a_Currency_/, '');
  const label = eventCurrencyLabel(name);
  return { key: name, label, short: label, src: `${host}/game/getGfx/UI_Currencies/a_Currency_${encodeURIComponent(name)}`, event: true };
}

export const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : String(value ?? '');
};

export const plural = (count, word, many = `${word}s`) => `${formatNumber(count)} ${Number(count) === 1 ? word : many}`;
