import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader, PageShell, Pill, ScrollX, Section, ShowMore, SkeletonGrid, formatNumber, useApi } from '../ui';
import { clockTime, cleanName, dayText, duration, modeLabel, rating, raybotApi, serverName, serverShort, sessionHref, tierTone, timeAgo } from './raybot';
import { Change, Fact, LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

const time = (iso) => (iso ? new Date(iso).getTime() : NaN);
const CHECK_MS = 5 * 60000;
const pct = (wins, games) => (games ? `${((100 * wins) / games).toFixed(1)}%` : '');

function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function chartPoints(data) {
  const points = data.snapshotRows
    .filter((row) => row.rating != null && Number.isFinite(time(row.seenAt)))
    .map((row) => ({ key: row.seenAt, time: time(row.seenAt), rating: row.rating, row }));
  if (data.startFrom === 'before' && data.startRating != null && points.length) {
    const startAt = Math.min(Number.isFinite(time(data.startedAt)) ? time(data.startedAt) : Infinity, points[0].time - 5 * 60000);
    points.unshift({ key: 'start', time: startAt, rating: data.startRating, start: true });
  }
  return points;
}

function SessionChart({ data }) {
  const [ref, width] = useWidth(720);
  const points = useMemo(() => chartPoints(data), [data]);
  if (points.length < 2) {
    return <div ref={ref} className="w-full"><p className="px-1 py-6 text-center text-sm text-slate-400">Not enough snapshots for a chart.</p></div>;
  }
  const height = 220;
  const first = points[0].time;
  const last = points[points.length - 1].time;
  const values = points.map((point) => point.rating);
  const low = Math.floor((Math.min(...values) - 5) / 10) * 10;
  const high = Math.ceil((Math.max(...values) + 5) / 10) * 10;
  const x = (value) => 44 + ((value - first) / Math.max(1, last - first)) * (width - 60);
  const y = (value) => 12 + ((high - value) / Math.max(1, high - low)) * (height - 40);
  const ticks = [...new Set([low, Math.round((low + high) / 2), high])];
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.time).toFixed(1)},${y(point.rating).toFixed(1)}`).join(' ');
  const base = data.startRating ?? points[0].rating;
  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-full" role="img" aria-label="Rating across the session">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1="44" x2={width - 16} y1={y(tick)} y2={y(tick)} className="stroke-slate-800" strokeDasharray="4 4" />
            <text x="4" y={y(tick) + 4} className="fill-slate-500 text-[11px] font-bold">{tick}</text>
          </g>
        ))}
        <line x1="44" x2={width - 16} y1={y(base)} y2={y(base)} className="stroke-slate-500" strokeWidth="1" />
        <path d={path} fill="none" className="stroke-emerald-400" strokeWidth="2" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={point.key} cx={x(point.time)} cy={y(point.rating)} r={point.start ? 4 : 3} className={point.start ? 'fill-slate-950 stroke-slate-300' : point.rating >= base ? 'fill-emerald-400' : 'fill-rose-400'} strokeWidth={point.start ? 1.5 : 0}>
            <title>
              {point.start
                ? `Start: ${point.rating}`
                : `${clockTime(point.key)}: ${point.rating}${point.row.ratingChange != null ? ` (${point.row.ratingChange > 0 ? '+' : ''}${point.row.ratingChange})` : ''}${point.row.gamesPlayed != null ? `, ${point.row.gamesPlayed} games` : ''}${point.row.rank != null ? `, #${point.row.rank}` : ''}`}
            </title>
          </circle>
        ))}
        <text x="44" y={height - 6} className="fill-slate-500 text-[11px] font-bold">{clockTime(first)}</text>
        <text x={width - 16} y={height - 6} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">{clockTime(last)}</text>
      </svg>
    </div>
  );
}

function Snapshots({ data }) {
  const [shown, setShown] = useState(50);
  const rows = data.snapshotRows;
  const startGames = data.games != null && data.totalGames != null ? data.totalGames - data.games : null;
  const startWins = data.wins != null && data.totalWins != null ? data.totalWins - data.wins : null;
  return (
    <Section title="Snapshots" count={formatNumber(rows.length)} headingAs="h2" padded={false}>
      <ScrollX>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="px-2 py-1 text-left font-bold">Seen</th>
              <th className="px-2 py-1 text-right font-bold">Games</th>
              <th className="px-2 py-1 text-right font-bold">W–L</th>
              <th className="px-2 py-1 text-right font-bold">Rating</th>
              <th className="px-2 py-1 text-right font-bold">Change</th>
              <th className="hidden px-2 py-1 text-right font-bold sm:table-cell">Peak</th>
              <th className="hidden px-2 py-1 text-right font-bold sm:table-cell">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.startFrom === 'before' && (
              <tr className="text-slate-400">
                <td className="whitespace-nowrap px-2 py-1">
                  {data.previousSessionId ? <a href={sessionHref(data.previousSessionId)} className="text-blue-300 hover:underline">Before</a> : 'Before'}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{startGames != null ? formatNumber(startGames) : '–'}</td>
                <td className="px-2 py-1 text-right tabular-nums">{startGames != null && startWins != null ? `${formatNumber(startWins)}–${formatNumber(startGames - startWins)}` : '–'}</td>
                <td className="px-2 py-1 text-right font-bold tabular-nums">{rating(data.startRating)}</td>
                <td className="px-2 py-1 text-right" />
                <td className="hidden px-2 py-1 text-right tabular-nums sm:table-cell">{rating(data.startPeakRating)}</td>
                <td className="hidden px-2 py-1 sm:table-cell" />
              </tr>
            )}
            {rows.slice(0, shown).map((row) => (
              <tr key={row.seenAt}>
                <td className="whitespace-nowrap px-2 py-1 text-slate-200">{clockTime(row.seenAt)}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-300">
                  {row.games != null ? formatNumber(row.games) : '–'}
                  {row.gamesPlayed ? <span className="ml-1 text-xs text-slate-500">+{row.gamesPlayed}</span> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-300">
                  {row.games != null && row.wins != null ? `${formatNumber(row.wins)}–${formatNumber(row.games - row.wins)}` : '–'}
                </td>
                <td className="px-2 py-1 text-right font-bold tabular-nums text-white">{rating(row.rating)}</td>
                <td className="px-2 py-1 text-right font-bold tabular-nums"><Change value={row.ratingChange} /></td>
                <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 sm:table-cell">{rating(row.peakRating)}</td>
                <td className="hidden px-2 py-1 text-right tabular-nums text-slate-400 sm:table-cell">{row.rank != null ? `#${row.rank}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {rows.length > 50 && <ShowMore shown={Math.min(shown, rows.length)} total={rows.length} onMore={setShown} step={50} />}
    </Section>
  );
}

function Missing({ error, onRetry }) {
  const message = error?.message || '';
  if (/private/i.test(message)) return <EmptyState title="This profile is private">The player turned on Private Profile in Raybot.</EmptyState>;
  if (/^No queue session/i.test(message)) {
    return (
      <EmptyState title="No saved session" action={<a href="/raybot/queue" className="font-bold text-blue-300 hover:underline">Ranked Queue</a>}>
        Raybot has no ranked session with this number.
      </EmptyState>
    );
  }
  return <ErrorState message="Couldn't load this session." detail={error} onRetry={onRetry} />;
}

function HeaderName({ data, legends }) {
  const people = data.gameMode === '2v2' ? data.members || [] : [{ bhid: data.playerId, name: data.name, bestLegend: data.bestLegend }];
  if (!people.length) return cleanName(data.name) || `ID ${data.playerId}`;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {people.map((person, index) => (
        <span key={index} className="inline-flex min-w-0 items-center gap-2">
          {index > 0 && <span className="text-slate-500">+</span>}
          <LegendIcon name={legends.get(person.bestLegend)} className="h-8 w-8 sm:h-9 sm:w-9" link />
          <PlayerLink bhid={person.bhid} className="min-w-0 hover:text-blue-300">{cleanName(person.name) || `ID ${person.bhid}`}</PlayerLink>
        </span>
      ))}
    </span>
  );
}

function title(data) {
  const who = data.gameMode === '2v2' && data.members?.length ? data.members.map((member) => cleanName(member.name) || `ID ${member.bhid}`).join(' + ') : cleanName(data.name) || `ID ${data.playerId}`;
  return who;
}

export default function RaybotSession({ id }) {
  const state = useApi(raybotApi(`/queue/sessions/${id}?perPage=1`));
  const legends = useLegendNames();
  const now = useNow(15000);
  const data = state.data;
  const { retry } = state;
  const live = Boolean(data?.open);
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(retry, 60000);
    return () => clearInterval(timer);
  }, [live, retry]);
  useEffect(() => {
    if (data) document.title = `${title(data)}: ${serverShort(data.region)} ${modeLabel(data.gameMode)} Session`;
  }, [data]);

  if (!data) {
    return (
      <PageShell>
        {state.error ? <Missing error={state.error} onRetry={state.retry} /> : (
          <>
            <LoadingState label="Loading session…" />
            <SkeletonGrid count={2} className="grid-cols-1" tileClassName="h-40" />
          </>
        )}
      </PageShell>
    );
  }

  const firstAt = data.firstGameAt ? time(data.firstGameAt) - CHECK_MS : time(data.startedAt);
  const played = data.lastGameAt && Number.isFinite(firstAt) ? time(data.lastGameAt) - firstAt : null;
  const status = data.active ? `Playing now, last game ${timeAgo(data.lastGameAt, now)}` : data.lastGameAt ? `Last game ${dayText(data.lastGameAt)}, ${clockTime(data.lastGameAt)}` : `Seen ${dayText(data.startedAt)}`;
  const losses = data.games != null && data.wins != null ? data.games - data.wins : null;

  return (
    <PageShell>
      <PageHeader
        title={<HeaderName data={data} legends={legends} />}
        meta={[`${serverName(data.region)} ${modeLabel(data.gameMode)}`, status].join(' · ')}
        actions={(
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold">
            {data.previousSessionId && <a href={sessionHref(data.previousSessionId)} className="text-blue-300 hover:underline">Previous session</a>}
            {data.nextSessionId && <a href={sessionHref(data.nextSessionId)} className="text-blue-300 hover:underline">Next session</a>}
            <a href={`/raybot/queue?server=${data.region}&mode=${data.gameMode}`} className="text-blue-300 hover:underline">Ranked Queue</a>
          </div>
        )}
      >
        {(data.newPeak || data.tier) && (
          <div className="flex flex-wrap items-center gap-2">
            {data.newPeak && <Pill tone="emerald">New peak</Pill>}
            {data.tier && <Pill tone={tierTone(data.tier)}>{data.tier}</Pill>}
          </div>
        )}
      </PageHeader>

      {data.lastGameAt ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Rating" value={rating(data.rating)} note={data.startRating != null ? `from ${rating(data.startRating)}` : undefined} />
            <Fact label="Change" value={<Change value={data.ratingChange} />} />
            <Fact label="W–L" value={losses != null ? `${data.wins}–${losses}` : '–'} note={losses != null && data.games ? `${data.games} games, ${pct(data.wins, data.games)}` : undefined} />
            <Fact label="Peak" value={rating(data.peakRating)} note={data.newPeak && data.startPeakRating != null ? `was ${rating(data.startPeakRating)}` : undefined} />
            <Fact label="Rank" value={data.rank != null ? `#${formatNumber(data.rank)}` : '–'} />
            <Fact label="Played" value={played != null ? duration(played) : '–'} note={Number.isFinite(firstAt) ? `from about ${clockTime(firstAt)}` : undefined} />
          </div>
          {data.startFrom === 'first' && <p className="px-1 text-xs text-slate-400">Counted from the first saved game: games before it in this session are missing.</p>}
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Section title="Rating this session" headingAs="h2" bodyClassName="p-2">
              <SessionChart data={data} />
            </Section>
            <Snapshots data={data} />
          </div>
        </>
      ) : (
        <EmptyState title="No games in this session">The player was in the top 500 but didn't finish a ranked game.</EmptyState>
      )}
    </PageShell>
  );
}
