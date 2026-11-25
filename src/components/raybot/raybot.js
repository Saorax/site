import { apiUrl, formatNumber, slugify } from '../ui';

export const RAYBOT_INVITE = 'https://discord.com/oauth2/authorize?client_id=681648127312265322';

export const raybotApi = (path) => apiUrl(`/v2/raybot${path}`);

export const SERVERS = {
  'us-e': { short: 'US-E', name: 'US East' },
  'us-w': { short: 'US-W', name: 'US West' },
  eu: { short: 'EU', name: 'Europe' },
  brz: { short: 'BRZ', name: 'Brazil' },
  sea: { short: 'SEA', name: 'Southeast Asia' },
  aus: { short: 'AUS', name: 'Australia' },
  jpn: { short: 'JPN', name: 'Japan' },
  sa: { short: 'SA', name: 'South Africa' },
  me: { short: 'ME', name: 'Middle East' },
};

export const SERVER_ORDER = ['us-e', 'us-w', 'eu', 'brz', 'sea', 'aus', 'jpn', 'sa', 'me'];

export const MODES = [
  { value: '1v1', label: '1v1' },
  { value: '2v2', label: '2v2' },
  { value: 'rotating', label: 'Rotating' },
];

export const serverShort = (code) => SERVERS[code]?.short || String(code || '').toUpperCase();
export const serverName = (code) => SERVERS[code]?.name || serverShort(code);

export const corehallaUrl = (bhid) => `https://corehalla.com/stats/player/${bhid}`;

export const rankedPlayerHref = (bhid) => `/raybot/player/${bhid}`;

export const sessionHref = (id) => `/raybot/session/${id}`;

export const clanHref = (id) => `/raybot/clan/${id}`;

export const rankedLegendHref = (name) => {
  const slug = slugify(name);
  return slug ? `/raybot/legends/${slug}` : '/raybot/legends';
};

export const modeLabel = (mode) => MODES.find((entry) => entry.value === mode)?.label || mode;

export function duration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const clockTime = (iso) => {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
};

const YEAR = 365 * 24 * 60 * 60 * 1000;

export function rankedFacts(player, legendName, now = Date.now()) {
  const seen = player.seenAt ? new Date(player.seenAt) : null;
  const old = seen && now - seen.getTime() > YEAR;
  return [
    player.match === 'id' ? `ID ${player.bhid}` : null,
    player.rating != null ? player.tier : null,
    player.rating != null ? rating(player.rating) : null,
    player.rating == null && player.bestLegend?.rating ? `${legendName || 'Best legend'} ${rating(player.bestLegend.rating)}` : null,
    player.match === 'past name' && player.matchedName ? `was ${cleanName(player.matchedName)}` : null,
    old ? `saved ${seen.getUTCFullYear()}` : null,
  ].filter(Boolean);
}

const TIERS = [
  [2000, 'Diamond'],
  [1680, 'Platinum'],
  [1390, 'Gold'],
  [1130, 'Silver'],
  [910, 'Bronze'],
  [0, 'Tin'],
];

export const tierFromRating = (value) => (value > 0 ? TIERS.find(([floor]) => value >= floor)?.[1] ?? null : null);

export function gloryWins(wins) {
  if (wins <= 150) return 20 * wins;
  return Math.floor(10 * (45 * Math.pow(Math.log10(wins * 2), 2)) + 245);
}

export const GLORY_BANDS = [
  { from: 0, to: 1199, base: 25, slope: 0 },
  { from: 1200, to: 1285, base: 25, slope: 0.872093023, top: 1286, span: 86 },
  { from: 1286, to: 1389, base: 100, slope: 0.721153846, top: 1390, span: 104 },
  { from: 1390, to: 1679, base: 187, slope: 0.389655172, top: 1680, span: 290 },
  { from: 1680, to: 1999, base: 300, slope: 0.428125, top: 2000, span: 320 },
  { from: 2000, to: 2299, base: 437, slope: 0.143333333, top: 2300, span: 300 },
  { from: 2300, to: null, base: 480, slope: 0.05, top: 2700, span: 400 },
];

export function gloryRating(value) {
  const band = GLORY_BANDS.slice().reverse().find((entry) => value >= entry.from) || GLORY_BANDS[0];
  if (!band.slope) return 250;
  return Math.floor(10 * (band.base + band.slope * (band.span - (band.top - value))));
}

export function resetRating(value) {
  if (value >= 1400) return Math.round(1400 + (value - 1400) / (3 - (3000 - value) / 800));
  return value;
}

export function gloryEstimate(onesWins, onesPeak, twosWins, twosPeak) {
  const ones = { wins: onesWins, peakRating: onesPeak, fromWins: gloryWins(onesWins), fromPeak: gloryRating(onesPeak) };
  const twos = { wins: twosWins, peakRating: twosPeak, fromWins: gloryWins(twosWins), fromPeak: gloryRating(twosPeak) };
  const peakMode = ones.fromPeak >= twos.fromPeak ? '1v1' : '2v2';
  const fromPeak = Math.max(ones.fromPeak, twos.fromPeak);
  const fromWins = ones.fromWins + twos.fromWins;
  return { ones, twos, fromWins, fromPeak, peakMode, total: fromWins + fromPeak, resetRating: resetRating(onesPeak) };
}

export const BOT_COMMANDS = [
  { name: 'rank', text: 'Ranked Profile Data' },
  { name: 'stats', text: 'Brawlhalla Statistics Data' },
  { name: 'glory', text: 'Glory data by username, Brawlhalla ID or @mention', href: '/raybot/glory', page: 'Glory Calculator' },
  { name: 'clan', text: 'Clan data by clan ID or name', href: '/raybot/clans', page: 'Clans' },
  { name: 'leaderboard', text: 'Legend leaderboards (peak elo, xp, winrate)', href: '/raybot/legends', page: 'Legend Stats' },
  { name: 'queue', text: 'Top 500 players in the ranked queue (updates every 5 minutes)', href: '/raybot/queue', page: 'Ranked queue' },
  { name: 'chart', text: 'Brawlhalla weapon chart', href: '/game/weapons', page: 'Weapon Chart' },
  { name: 'tourneys', text: 'Tournament history and upcoming events', href: '/esports/tournaments', page: 'Tournaments' },
  { name: 'news', text: 'Brawlhalla news and patch articles', href: '/game/news', page: 'News' },
  { name: 'twitch', text: 'Live Brawlhalla streams on Twitch', href: '/esports#streams', page: 'Live streams' },
  { name: 'ping', text: 'Brawlhalla Ping Checker Application' },
  { name: 'create', text: 'Create a Raybot Profile' },
  { name: 'profile', text: 'Manage your Raybot profile settings' },
  { name: 'server', text: 'Manage server settings for Raybot' },
  { name: 'invite', text: 'Bot and app invite links' },
];

const tierTones = [
  [/valhallan/i, 'violet'],
  [/diamond/i, 'sky'],
  [/platinum/i, 'blue'],
  [/gold/i, 'amber'],
];

export const tierTone = (tier) => tierTones.find(([pattern]) => pattern.test(String(tier || '')))?.[1] || 'slate';

export const rating = (value) => (value === null || value === undefined ? '–' : formatNumber(value));

export function timeAgo(iso, now = Date.now()) {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const dayText = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

const visible = (text) => (/[^\p{Cf}\p{Cc}\p{Z}\p{M}]/u.test(text) ? text : '');

export function cleanName(value) {
  return visible(decodeName(value));
}

function decodeName(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  if (/%[0-9a-f]{2}/i.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      return text;
    }
  }
  if (/[\u0080-\u00ff]/.test(text) && [...text].every((char) => char.charCodeAt(0) <= 0xff)) {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from([...text], (char) => char.charCodeAt(0)));
    } catch {
      return text;
    }
  }
  return text;
}
