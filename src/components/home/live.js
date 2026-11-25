import { useEffect, useState } from 'react';
import { apiUrl, legendHref, OFFICIAL_REGIONS, useApi, weaponIconUrl } from '../ui';
import { host } from '../../stuff';

const weaponLabels = { Fists: 'Gauntlets', Pistol: 'Blasters', RocketLance: 'Rocket Lance', Katar: 'Katars', Boots: 'Battle Boots', Gauntlets: 'Gauntlets' };

export const weaponLabel = (name) => weaponLabels[name] || String(name || '').replace(/([a-z])([A-Z])/g, '$1 $2');

export const esportsUrl = (path, params = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString();
  return `${host}/v2/esports${path}${suffix ? `?${suffix}` : ''}`;
};

export const RANK_REGIONS = OFFICIAL_REGIONS;

export const dateText = (value, options = { dateStyle: 'medium' }) => {
  if (value === undefined || value === null || value === '') return '';
  const parsed = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-US', options).format(parsed);
};

export const relativeDays = (value, now = Date.now()) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const days = Math.round((time - now) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
};

export function useNewestLegend() {
  const summary = useApi(apiUrl('/game/legends/summary'));
  const newest = (summary.data ?? []).reduce((best, legend) => (!best || Number(legend.releaseOrder) > Number(best.releaseOrder) ? legend : best), null);
  const legend = newest && {
    id: newest.id,
    name: newest.bio?.name?.normal || newest.codeName,
    image: newest.image ? apiUrl(newest.image) : '',
    href: legendHref(newest.bio?.name?.normal || newest.codeName),
    released: newest.release,
    weapons: [newest.weapons?.main, newest.weapons?.secondary].filter(Boolean).map((weapon) => ({
      name: weaponLabel(weapon.name),
      icon: weaponIconUrl(String(weapon.image || '').split('a_WeaponIcon_')[1] || weapon.name),
    })),
    count: summary.data.length,
  };
  return { ...summary, legend };
}

export function useComboLists() {
  const status = useApi(apiUrl('/game/combos/weapons'));
  const weapons = Array.isArray(status.data) ? status.data : [];
  const published = weapons.filter((entry) => entry.defenses?.status === 'ready').length;
  const note = !weapons.length ? '' : !published ? 'Not published yet' : published < weapons.length ? `${published} of ${weapons.length} weapons published` : '';
  return { ...status, published, total: weapons.length, note };
}

export function useLatestPatch() {
  const history = useApi(apiUrl('/game/history/all'));
  const entries = (history.data ?? []).filter((item) => !item.empty && item.patch);
  const entry = entries.find((item) => item.title) || entries[0] || null;
  const oldest = entries[entries.length - 1] ?? null;
  const patch = entry && {
    id: entry.id,
    patch: entry.patch,
    title: entry.title,
    date: entry.date,
    counts: entry.counts,
    official: entry.official,
    href: `/game/patch?patch=${encodeURIComponent(entry.id)}`,
  };
  const range = oldest && { count: entries.length, oldest: oldest.patch, oldestDate: oldest.date };
  const first = (history.data ?? []).find((item) => item.patch) ?? null;
  const current = first && { id: first.id, patch: first.patch, date: first.date };
  return { ...history, patch, range, current };
}

export function useStoreDataVersion() {
  const status = useApi(apiUrl('/game/storeData/status'));
  const cache = status.data?.diskCache;
  return { ...status, patch: cache?.patch || null, date: cache?.date || null };
}

export function useRegionLeaders(gameMode = 1) {
  const [state, setState] = useState({ rows: [], loading: true, error: null, dataThrough: null, generatedAt: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    Promise.allSettled(RANK_REGIONS.map(([code, name]) => fetch(esportsUrl('/rankings', { region: code, gameMode, regionAssignment: 'most', perPage: 1, page: 1 }), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Request failed (${response.status})`))))
      .then((data) => ({ code, name, player: data.players?.[0] ?? null, dataThrough: data.dataThrough, generatedAt: data.generatedAt }))))
      .then((results) => {
        if (controller.signal.aborted) return;
        const rows = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        const failed = results.find((result) => result.status === 'rejected');
        const dataThrough = rows.map((row) => row.dataThrough).filter(Boolean).sort().pop() ?? null;
        const generatedAt = rows.map((row) => row.generatedAt).filter(Boolean).sort().pop() ?? null;
        setState({ rows, loading: false, error: rows.length ? null : failed?.reason ?? new Error('No rankings'), dataThrough, generatedAt });
      });
    return () => controller.abort();
  }, [gameMode, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

export function useLatestOfficialWinner() {
  const events = useApi(esportsUrl('/events', { official: 'official', state: 'complete', perPage: 12 }));
  const items = (events.data?.items ?? []).filter((event) => !event.date_outlier && Number(event.entrant_count) >= 4);
  const newest = items[0];
  const cutoff = newest ? new Date(newest.starts_at).getTime() - 3 * 86400000 : 0;
  const sameWeekend = items.filter((event) => new Date(event.starts_at).getTime() >= cutoff);
  const event = sameWeekend.find((item) => Number(item.game_mode) === 1 && item.region === 'ALL')
    || sameWeekend.find((item) => Number(item.game_mode) === 1)
    || newest
    || null;
  const entrants = useApi(event ? esportsUrl(`/events/${event.id}/entrants`, { perPage: 1 }) : null);
  const winner = entrants.data?.items?.find((entrant) => Number(entrant.placement) === 1) ?? null;
  return {
    loading: events.loading || entrants.loading,
    error: events.error || entrants.error,
    retry: () => { events.retry(); entrants.retry(); },
    event,
    winner,
  };
}

export const teamName = (entrant) => {
  if (!entrant) return '';
  const members = entrant.members ?? [];
  if (members.length > 1) return members.map((member) => member.name).join(' & ');
  return members[0]?.name || String(entrant.name || '').replace(/'s party$/i, '');
};

const LIVE_STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

export function useWhatsOn(perPage = 8) {
  const lists = [
    useApi(esportsUrl('/tournaments', { official: 'official', state: 'active', perPage })),
    useApi(esportsUrl('/tournaments', { official: 'tier1', state: 'active', perPage })),
    useApi(esportsUrl('/tournaments', { official: 'official', state: 'upcoming', perPage })),
    useApi(esportsUrl('/tournaments', { official: 'tier1', state: 'upcoming', perPage })),
  ];
  const loading = lists.some((list) => list.loading && !list.data);
  const error = lists.every((list) => list.error) ? lists[0].error : null;
  const cutoff = Date.now() - LIVE_STALE_AFTER_MS;
  const live = [...(lists[0].data?.items ?? []), ...(lists[1].data?.items ?? [])].filter((tournament) => {
    const last = tournament.ends_at ?? tournament.starts_at;
    return !tournament.date_outlier && (!last || new Date(last).getTime() >= cutoff);
  });
  const upcoming = [...(lists[2].data?.items ?? []), ...(lists[3].data?.items ?? [])]
    .filter((tournament) => !tournament.date_outlier && (!tournament.starts_at || new Date(tournament.starts_at).getTime() >= cutoff))
    .sort((a, b) => new Date(a.starts_at ?? 0) - new Date(b.starts_at ?? 0));
  return {
    loading,
    error,
    retry: () => lists.forEach((list) => list.retry()),
    live,
    upcoming,
    officialLive: live.some((tournament) => tournament.classification === 'official'),
    nextOfficial: upcoming.find((tournament) => tournament.classification === 'official') ?? null,
  };
}
