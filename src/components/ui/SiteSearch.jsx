import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { externalLinks, sections, siteLinks } from '../../data/sections.js';
import { clanHref, cleanName, rankedFacts, rankedPlayerHref } from '../raybot/raybot.js';
import { apiUrl, legendHref, mapThumbUrl, portraitUrl } from './assets';
import { useApi, useDebounced } from './hooks';
import { foldText, loadGameNames, matchesWords } from './names';
import { cx } from './tones';

const MIN_LENGTH = 2;
const PER_GROUP = 4;

const PAGES = [
  ...sections.flatMap((section) => [
    ...section.tools.map((tool) => ({ name: tool.title, detail: section.title, href: tool.href, words: [tool.title, tool.nav, section.title] })),
    ...(section.navExtra ?? []).map((link) => ({ name: link.label, detail: section.title, href: link.href, words: [link.label, section.title] })),
  ]),
  ...siteLinks.map((link) => ({ name: link.title, detail: 'Site', href: link.href, words: [link.title] })),
  ...externalLinks.map((link) => ({ name: link.title, detail: 'api.saorax.com', href: link.href, words: [link.title] })),
];

const databaseGroup = (title, page, key) => ({
  title,
  href: (id) => `/game/database?page=${page}&${key}=${encodeURIComponent(id)}`,
  all: (q) => `/game/database?page=${page}&search=${encodeURIComponent(q)}`,
});

const GAME_GROUPS = {
  legend: { title: 'Legends', href: (id, item) => legendHref(item.name), all: (q) => `/game/legends?search=${encodeURIComponent(q)}`, fit: 'cover' },
  skin: databaseGroup('Skins', 'skins', 'skin'),
  weapon: databaseGroup('Weapon Skins', 'weapon-skins', 'weapon'),
  color: databaseGroup('Colors', 'colors', 'color'),
  avatar: databaseGroup('Avatars', 'avatars', 'avatar'),
  emoji: databaseGroup('Emojis', 'emojis', 'emoji'),
  taunt: databaseGroup('Taunts', 'taunts', 'taunt'),
  podium: databaseGroup('Podiums', 'podiums', 'podium'),
  title: databaseGroup('Titles', 'titles', 'title'),
  uiTheme: databaseGroup('UI Themes', 'ui-themes', 'theme'),
  border: databaseGroup('Borders', 'borders', 'borders'),
  companion: databaseGroup('Companions', 'companions', 'companion'),
  sidekick: databaseGroup('Sidekicks', 'sidekicks', 'sidekick'),
  koEffect: databaseGroup('KO Effects', 'ko-effects', 'koeffect'),
  smokeTrail: databaseGroup('Smoke Trails', 'smoke-trails', 'smoketrail'),
  map: { title: 'Maps', href: (id) => `/game/maps?name=${encodeURIComponent(id)}`, shape: 'wide', fit: 'cover' },
};

const year = (value) => (value ? new Date(value).getUTCFullYear() : null);
const count = (value) => Number(value || 0).toLocaleString('en-US');
const initials = (name) => String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

const PERSON = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0';
const FRAME = 'M4 5h16v14H4V5Zm3 3h10v8H7V8Z';
const BOT = 'M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm5-4v4m-2.5 5h.01m4.99 0h.01';
const KIND_ICONS = {
  page: 'M7 3h7l4 4v14H7V3Zm7 0v4h4',
  tournament: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4m-4 3v4m-4 3h8',
  legend: PERSON,
  skin: PERSON,
  avatar: PERSON,
  weapon: 'M14.5 4H20v5.5L10 19.5 4.5 14 14.5 4ZM7 16.5 4 19.5M8 12l4 4',
  color: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z',
  emoji: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3.5-6a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  taunt: 'm12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6L12 4Z',
  podium: 'M9 9h6v11H9V9Zm-5 5h5v6H4v-6Zm11 2h5v4h-5v-4Z',
  uiTheme: FRAME,
  border: FRAME,
  companion: BOT,
  sidekick: BOT,
  koEffect: 'M12 3v5m0 8v5M3 12h5m8 0h5M5.6 5.6l3.5 3.5m5.8 5.8 3.5 3.5M5.6 18.4l3.5-3.5m5.8-5.8 3.5-3.5',
  smokeTrail: 'M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  clan: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z',
};

function KindIcon({ kind }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={KIND_ICONS[kind] ?? KIND_ICONS.page} />
    </svg>
  );
}

function Thumb({ src, kind, name, shape = 'square', fit = 'contain' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const box = cx('relative grid shrink-0 place-items-center overflow-hidden bg-slate-800 text-slate-400', shape === 'wide' ? 'h-7 w-12' : 'h-7 w-7', shape === 'round' ? 'rounded-full' : 'rounded');
  if (src && !failed) {
    return (
      <span className={box}>
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={cx('absolute inset-0 h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />
      </span>
    );
  }
  if (kind === 'player') {
    return <span className={cx(box, 'bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white')} aria-hidden="true">{initials(name)}</span>;
  }
  return <span className={box} aria-hidden="true"><KindIcon kind={kind} /></span>;
}

function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
    </svg>
  );
}

function playerGroup(data, query) {
  const players = data?.players;
  if (!players) return null;
  return {
    key: 'players',
    title: 'Players',
    total: players.total,
    pending: players.pending,
    all: players.total > players.items.length ? `/esports/player?search=${encodeURIComponent(query)}` : null,
    items: players.items.map((player) => ({
      key: `player-${player.id}`,
      href: `/esports/player/id/${player.id}`,
      name: player.name || 'Unknown player',
      detail: [
        player.matchedName && foldText(player.matchedName) !== foldText(player.name) && `Played as ${player.matchedName}`,
        `${count(player.events)} ${player.events === 1 ? 'event' : 'events'}`,
        year(player.latest) && `last in ${year(player.latest)}`,
      ].filter(Boolean).join(' · '),
      thumb: { src: player.image || null, kind: 'player', shape: 'round', fit: 'cover' },
    })),
  };
}

function rankedGroup(players, query, legends, limit) {
  if (!Array.isArray(players) || !players.length) return null;
  return {
    key: 'ranked',
    title: 'Ranked players',
    all: players.length >= limit ? `/raybot?q=${encodeURIComponent(query)}` : null,
    items: players.map((player) => {
      const legend = legends?.get(player.bestLegend?.id);
      return {
        key: `ranked-${player.bhid}`,
        href: rankedPlayerHref(player.bhid),
        name: cleanName(player.name) || `ID ${player.bhid}`,
        detail: rankedFacts(player, legend).join(' · '),
        thumb: { src: legend ? portraitUrl({ name: legend }) : null, kind: 'player', fit: 'contain' },
      };
    }),
  };
}

function clanGroup(data, query) {
  const rows = data?.rows;
  if (!Array.isArray(rows) || !rows.length) return null;
  const folded = foldText(query);
  return {
    key: 'clans',
    title: 'Clans',
    total: data.total,
    all: data.total > rows.length ? `/raybot/clans?q=${encodeURIComponent(query)}` : null,
    items: rows.map((clan) => {
      const name = cleanName(clan.name) || `Clan ${clan.clanId}`;
      const was = !foldText(name).includes(folded) && clan.pastNames?.find((past) => foldText(past).includes(folded));
      return {
        key: `clan-${clan.clanId}`,
        href: clanHref(clan.clanId),
        name,
        detail: [
          was && `was ${cleanName(was)}`,
          clan.members != null && `${count(clan.members)} ${clan.members === 1 ? 'member' : 'members'}`,
          clan.lifetimeXp != null && `${count(clan.lifetimeXp)} lifetime XP`,
          clan.tier && `Tier ${clan.tier}`,
        ].filter(Boolean).join(' · '),
        thumb: { kind: 'clan' },
      };
    }),
  };
}

function useLegendNames(wanted) {
  const [legends, setLegends] = useState(null);
  useEffect(() => {
    if (!wanted || legends) return undefined;
    let alive = true;
    loadGameNames().then((names) => {
      if (alive && names.legends?.length) setLegends(new Map(names.legends.map((legend) => [Number(legend.id), legend.name])));
    });
    return () => { alive = false; };
  }, [wanted, legends]);
  return legends;
}

function tournamentGroup(data, query) {
  const tournaments = data?.tournaments;
  if (!tournaments) return null;
  return {
    key: 'tournaments',
    title: 'Tournaments',
    total: tournaments.total,
    all: tournaments.total > tournaments.items.length ? `/esports/tournaments?search=${encodeURIComponent(query)}` : null,
    items: tournaments.items.map((tournament) => ({
      key: `tournament-${tournament.id}`,
      href: `/esports/tournament/${tournament.id}`,
      name: tournament.name,
      detail: [
        tournament.startsAt && new Date(tournament.startsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
        tournament.regions?.length ? tournament.regions.join(', ') : null,
        tournament.entrants ? `${count(tournament.entrants)} entrants` : null,
      ].filter(Boolean).join(' · '),
      tag: tournament.official ? 'Official' : null,
      thumb: { src: tournament.image || null, kind: 'tournament', shape: 'wide', fit: 'cover' },
    })),
  };
}

function gameGroups(data, query) {
  return (data?.groups ?? []).flatMap((group) => {
    const meta = GAME_GROUPS[group.kind];
    if (!meta || !group.items?.length) return [];
    return [{
      key: group.kind,
      title: meta.title,
      total: group.total,
      all: meta.all && group.total > group.items.length ? meta.all(query) : null,
      items: group.items.map((item) => ({
        key: `${group.kind}-${item.id}`,
        href: meta.href(item.id, item),
        name: item.name,
        detail: item.detail,
        color: item.color,
        thumb: group.kind === 'title' ? null : {
          src: item.image ? (group.kind === 'map' ? mapThumbUrl(item.image) : apiUrl(item.image)) : null,
          kind: group.kind,
          shape: meta.shape,
          fit: meta.fit,
        },
      })),
    }];
  });
}

function ResultRow({ item, active, onHover, id }) {
  return (
    <a
      id={id}
      href={item.href}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      className={cx('flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5', active ? 'bg-blue-500/20 ring-1 ring-blue-400/50' : 'hover:bg-slate-800')}
    >
      {item.thumb && <Thumb {...item.thumb} name={item.name} />}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {item.color
            ? <span className="truncate rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-sm font-bold" style={{ color: item.color }}>{item.name}</span>
            : <span className="truncate text-sm font-bold text-white">{item.name}</span>}
          {item.tag && <span className="shrink-0 rounded border border-blue-400/40 bg-blue-500/15 px-1 text-[10px] font-bold text-blue-100">{item.tag}</span>}
        </span>
        {item.detail && <span className="block truncate text-xs text-slate-400">{item.detail}</span>}
      </span>
    </a>
  );
}

function Group({ group, activeKey, setActiveKey, optionId }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 px-2 pb-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.title}{group.total > group.items.length ? ` · ${count(group.total)}` : ''}</span>
        {group.all && <a href={group.all} className="text-xs font-bold text-blue-300 hover:text-blue-200">See all</a>}
      </div>
      {group.pending && <div className="px-2 py-1 text-xs text-slate-400">Player search is still loading. Try again in a few seconds.</div>}
      <div className="grid gap-0.5">
        {group.items.map((item) => (
          <ResultRow key={item.key} id={optionId(item.key)} item={item} active={activeKey === item.key} onHover={() => setActiveKey(item.key)} />
        ))}
      </div>
    </div>
  );
}

export default function SiteSearch({ variant = 'header', scope = 'all', limit = PER_GROUP, placeholder }) {
  const inPage = variant === 'page';
  const withGame = scope !== 'esports';
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const root = useRef(null);
  const input = useRef(null);
  const listId = useId();
  const query = useDebounced(term.replace(/\s+/g, ' ').trim(), 250);
  const ready = query.length >= MIN_LENGTH;
  const esports = useApi(ready ? apiUrl(`/v2/esports/search?q=${encodeURIComponent(query)}&limit=${limit}`) : null);
  const game = useApi(ready && withGame ? apiUrl(`/game/search?q=${encodeURIComponent(query)}&limit=${limit}`) : null);
  const ranked = useApi(ready && withGame ? apiUrl(`/v2/raybot/players?search=${encodeURIComponent(query)}&limit=${limit}`) : null);
  const clans = useApi(ready && withGame ? apiUrl(`/v2/raybot/clans/leaderboard?sort=lifetime&perPage=${limit}&search=${encodeURIComponent(query)}`) : null);
  const rankedPlayers = ranked.error ? null : ranked.data;
  const clanData = clans.error ? null : clans.data;
  const legendNames = useLegendNames(Boolean(rankedPlayers?.length));
  const current = esports.data?.query === query || game.data?.query === query;

  const groups = useMemo(() => {
    if (!ready) return [];
    const pages = withGame ? PAGES.filter((page) => matchesWords(query, page.words)).slice(0, limit) : [];
    const pageGroup = pages.length ? [{ key: 'pages', title: 'Pages', total: pages.length, items: pages.map((page) => ({ ...page, key: `page-${page.href}`, thumb: { kind: 'page' } })) }] : [];
    const competitive = [playerGroup(esports.data, query), rankedGroup(rankedPlayers, query, legendNames, limit), clanGroup(clanData, query), tournamentGroup(esports.data, query)].filter((group) => group && (group.items.length || group.pending));
    const gameList = gameGroups(game.data, query);
    const legends = gameList.filter((group) => group.key === 'legend');
    const cosmetics = gameList.filter((group) => group.key !== 'legend');
    const folded = foldText(query);
    const exact = (list) => list.some((group) => group.items.some((item) => foldText(item.name) === folded));
    const gameFirst = exact(cosmetics) && !exact(competitive);
    return [...pageGroup, ...legends, ...(gameFirst ? [...cosmetics, ...competitive] : [...competitive, ...cosmetics])];
  }, [ready, query, esports.data, game.data, rankedPlayers, clanData, legendNames, withGame, limit]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const loading = ready && (esports.loading || game.loading || (withGame && (ranked.loading || clans.loading)));
  const failed = ready && esports.error && (game.error || !withGame);
  const empty = ready && !loading && !failed && current && !flat.length;
  const showPanel = open && ready;

  useEffect(() => { setActiveKey(null); }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
    input.current?.blur();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (inPage) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(true);
        setOpen(true);
        requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
      }
    };
    const onPointer = (event) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) {
        setOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [inPage]);

  const move = (step) => {
    if (!flat.length) return;
    const index = flat.findIndex((item) => item.key === activeKey);
    const next = index < 0 ? (step > 0 ? 0 : flat.length - 1) : (index + step + flat.length) % flat.length;
    setActiveKey(flat[next].key);
    document.getElementById(optionId(flat[next].key))?.scrollIntoView({ block: 'nearest' });
  };

  const optionId = (key) => `${listId}-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') {
      const target = flat.find((item) => item.key === activeKey) ?? flat[0];
      if (target) { event.preventDefault(); window.location.href = target.href; }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (term) setTerm('');
      else close();
    }
  };

  const openMobile = () => {
    setMobileOpen(true);
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };

  const field = (
    <input
      ref={input}
      type="search"
      value={term}
      onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      placeholder={placeholder || (withGame ? 'Players, tournaments, legends, skins' : 'Players and tournaments')}
      aria-label={withGame ? 'Search the site' : 'Search players and tournaments'}
      role="combobox"
      aria-expanded={showPanel}
      aria-controls={listId}
      aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
      autoComplete="off"
      spellCheck={false}
      className={cx(
        'w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400 [&::-webkit-search-cancel-button]:hidden',
        inPage ? 'py-2.5 text-base sm:text-sm' : 'py-2 text-sm md:pr-14',
      )}
    />
  );

  const panel = showPanel && (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      className={cx(
        'overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl',
        inPage
          ? 'absolute inset-x-0 top-full z-30 mt-1 max-h-[min(36rem,calc(100dvh-6rem))]'
          : 'mt-2 max-h-[calc(100dvh-8rem)] md:absolute md:right-0 md:top-full md:w-[min(56rem,calc(100vw-1rem))] md:max-h-[calc(100dvh-5rem)]',
      )}
    >
      {failed && <div className="px-2 py-2 text-sm text-rose-200">Search failed. <button type="button" onClick={() => { esports.retry?.(); game.retry?.(); }} className="font-bold underline">Retry</button></div>}
      {empty && <div className="px-2 py-2 text-sm text-slate-400">Nothing found for “{query}”.</div>}
      {!flat.length && loading && <div className="grid gap-1.5 p-1">{[0, 1, 2].map((row) => <div key={row} className="h-8 animate-pulse rounded-lg bg-slate-800" />)}</div>}
      {groups.length > 0 && (
        <div className={cx('grid gap-x-3 gap-y-2', withGame ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2')}>
          {groups.map((group) => <Group key={group.key} group={group} activeKey={activeKey} setActiveKey={setActiveKey} optionId={optionId} />)}
        </div>
      )}
      {flat.length > 0 && loading && <div className="px-2 pt-2 text-xs text-slate-500">Loading more…</div>}
    </div>
  );

  if (inPage) {
    return (
      <div ref={root} className="relative w-full min-w-0">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          {field}
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div ref={root} className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={openMobile}
        className="inline-flex h-10 w-[42px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-400 hover:text-blue-300 md:hidden"
        aria-label="Search the site"
      >
        <SearchIcon className="h-5 w-5" />
      </button>
      <div className={cx(
        mobileOpen ? 'fixed inset-x-0 top-16 z-[110] flex flex-col border-b border-slate-800 bg-slate-950 p-2 shadow-2xl' : 'hidden',
        'md:static md:z-auto md:flex md:border-0 md:bg-transparent md:p-0 md:shadow-none',
      )}>
        <div className="relative w-full md:w-56 lg:w-72 xl:w-96">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          {field}
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-700 px-1.5 text-[10px] font-bold text-slate-500 md:block">Ctrl K</kbd>
        </div>
        {panel}
      </div>
    </div>
  );
}
