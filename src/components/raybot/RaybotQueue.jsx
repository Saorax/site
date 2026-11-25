import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorState, PageHeader, PageShell, Pill, Section, SkeletonGrid, Tabs, cx, formatNumber, useApi, useQueryState } from '../ui';
import { MODES, SERVER_ORDER, cleanName, clockTime, duration, modeLabel, rating, raybotApi, serverName, serverShort, sessionHref, tierTone, timeAgo } from './raybot';
import { Change, LegendIcon, PlayerLink, TeamOrPlayer, WinBar, useLegendNames, useNow } from './parts';

const MODE_TABS = [{ value: 'all', label: 'All modes' }, ...MODES];
const SERVER_TABS = [{ value: 'all', label: 'All servers' }, ...SERVER_ORDER.map((code) => ({ value: code, label: serverShort(code), title: serverName(code) }))];
const SORTS = [
  { value: 'rating', label: 'Rating' },
  { value: 'change', label: 'Change' },
  { value: 'games', label: 'Games' },
  { value: 'latest', label: 'Latest' },
];

const time = (iso) => (iso ? new Date(iso).getTime() : 0);

const sessionSince = (entry, check = 5) => {
  const first = time(entry.firstGameAt);
  return first ? first - check * 60000 : time(entry.startedAt);
};

const sorters = {
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  change: (a, b) => (b.ratingChange ?? -Infinity) - (a.ratingChange ?? -Infinity) || (b.rating ?? 0) - (a.rating ?? 0),
  games: (a, b) => (b.games ?? -1) - (a.games ?? -1) || (b.rating ?? 0) - (a.rating ?? 0),
  latest: (a, b) => time(b.lastGameAt) - time(a.lastGameAt),
};

function record(entry) {
  if (entry.games == null || entry.wins == null) return '–';
  return `${entry.wins}–${entry.games - entry.wins}`;
}

const countedNote = (entry) => (entry.startFrom === 'first' ? 'Counted from the first saved game of the session' : undefined);

function SessionLink({ entry, now, finished, check }) {
  const since = sessionSince(entry, check);
  const text = finished ? timeAgo(entry.lastGameAt, now) : duration(now - since);
  return (
    <a href={sessionHref(entry.sessionId)} className="whitespace-nowrap text-blue-300 hover:underline" title={finished ? `Last game at ${clockTime(entry.lastGameAt)}` : `Since about ${clockTime(since)}`}>
      {text || 'Session'}
    </a>
  );
}

function QueueTable({ rows, legends, now, finished, check, showServer, showMode }) {
  const queueText = (entry) => [showServer && serverShort(entry.region), showMode && modeLabel(entry.gameMode)].filter(Boolean).join(' ');
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-xs text-slate-400">
          <th className="px-2 py-1 text-left font-bold">Player</th>
          {(showServer || showMode) && <th className="hidden w-24 px-2 py-1 text-left font-bold md:table-cell">Queue</th>}
          <th className="hidden w-14 px-2 py-1 text-right font-bold sm:table-cell">Rank</th>
          <th className="w-20 px-2 py-1 text-right font-bold">Rating</th>
          <th className="hidden w-16 px-2 py-1 text-right font-bold sm:table-cell">Change</th>
          <th className="hidden w-20 px-2 py-1 text-right font-bold sm:table-cell">W–L</th>
          <th className="w-24 px-2 py-1 text-right font-bold sm:w-28">{finished ? 'Last game' : 'Playing for'}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((entry) => (
          <tr key={entry.sessionId} className="align-middle hover:bg-slate-800/40">
            <td className="min-w-0 px-2 py-1.5">
              <TeamOrPlayer
                entry={entry}
                legends={legends}
                iconClass={entry.gameMode === '2v2' ? 'h-6 w-6' : 'h-7 w-7'}
                after={entry.newPeak && <span className="ml-1 hidden shrink-0 sm:inline"><Pill tone="emerald">New peak</Pill></span>}
              />
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                {entry.newPeak && <span className="font-bold text-emerald-300 sm:hidden">New peak</span>}
                {queueText(entry) && <span className="md:hidden">{queueText(entry)}</span>}
                {entry.rank != null && <span className="sm:hidden">#{entry.rank}</span>}
                {entry.tier && <span className="hidden sm:inline">{entry.tier}</span>}
                <span className="tabular-nums sm:hidden" title={countedNote(entry)}>{record(entry)}</span>
              </div>
            </td>
            {(showServer || showMode) && (
              <td className="hidden px-2 py-1.5 text-slate-300 md:table-cell" title={serverName(entry.region)}>{queueText(entry)}</td>
            )}
            <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 sm:table-cell">{entry.rank != null ? `#${entry.rank}` : '–'}</td>
            <td className="px-2 py-1.5 text-right">
              <span className="block font-bold tabular-nums text-white">{rating(entry.rating)}</span>
              <span className="block text-[11px] font-bold tabular-nums sm:hidden"><Change value={entry.ratingChange} /></span>
            </td>
            <td className="hidden px-2 py-1.5 text-right font-bold tabular-nums sm:table-cell" title={entry.startRating != null ? `From ${entry.startRating}` : undefined}><Change value={entry.ratingChange} /></td>
            <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 sm:table-cell" title={countedNote(entry)}>{record(entry)}</td>
            <td className="px-2 py-1.5 text-right"><SessionLink entry={entry} now={now} finished={finished} check={check} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueueCard({ entry, legends, now, check, showServer, showMode }) {
  const since = sessionSince(entry, check);
  const losses = entry.games != null && entry.wins != null ? entry.games - entry.wins : null;
  const queue = [showServer && serverShort(entry.region), showMode && modeLabel(entry.gameMode)].filter(Boolean).join(' ');
  const solo = entry.gameMode !== '2v2' || !entry.members?.length;
  return (
    <div className={cx('flex min-w-0 flex-col gap-2 rounded-xl border bg-slate-950/60 p-2', entry.newPeak ? 'border-emerald-500/40' : 'border-slate-800')}>
      <div className="flex min-w-0 items-start gap-2">
        {solo ? (
          <>
            <LegendIcon name={legends.get(entry.bestLegend)} className="h-11 w-11 rounded-lg" link />
            <div className="min-w-0 flex-1">
              <PlayerLink bhid={entry.gameMode === '2v2' ? null : entry.playerId} className="block truncate font-bold text-white">{cleanName(entry.name) || `ID ${entry.playerId}`}</PlayerLink>
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                {entry.tier && <Pill tone={tierTone(entry.tier)}>{entry.tier}</Pill>}
                {entry.newPeak && <Pill tone="emerald">New peak</Pill>}
              </div>
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1 space-y-1">
            <TeamOrPlayer entry={entry} legends={legends} iconClass="h-7 w-7" />
            <div className="flex flex-wrap items-center gap-1">
              {entry.tier && <Pill tone={tierTone(entry.tier)}>{entry.tier}</Pill>}
              {entry.newPeak && <Pill tone="emerald">New peak</Pill>}
            </div>
          </div>
        )}
        <div className="shrink-0 text-right">
          <div className="font-black tabular-nums text-white">{entry.rank != null ? `#${formatNumber(entry.rank)}` : '–'}</div>
          {queue && <div className="text-xs text-slate-400" title={serverName(entry.region)}>{queue}</div>}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rating</div>
          <div className="text-2xl font-black tabular-nums leading-tight text-white">{rating(entry.rating)}</div>
        </div>
        <div className="text-right" title={countedNote(entry)}>
          <div className="text-lg font-black tabular-nums leading-tight"><Change value={entry.ratingChange} /></div>
          <div className="text-xs text-slate-400">{entry.startRating != null ? `from ${rating(entry.startRating)}` : 'this session'}</div>
        </div>
      </div>
      <div title={countedNote(entry)}>
        <div className="flex items-baseline justify-between text-xs text-slate-400">
          <span><span className="font-bold tabular-nums text-slate-200">{record(entry)}</span> this session</span>
          <span className="tabular-nums">{entry.games != null ? `${formatNumber(entry.games)} ${entry.games === 1 ? 'game' : 'games'}` : ''}</span>
        </div>
        <WinBar wins={entry.wins} games={losses != null ? entry.games : null} className="mt-1" />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 pt-1.5 text-xs">
        <a href={sessionHref(entry.sessionId)} className="font-bold text-blue-300 hover:underline" title={`Since about ${clockTime(since)}`}>Playing {duration(now - since) || 'now'}</a>
        <span className="text-slate-400" title={`Last game at ${clockTime(entry.lastGameAt)}`}>last game {timeAgo(entry.lastGameAt, now)}</span>
      </div>
    </div>
  );
}

function Highlight({ label, value, note, href }) {
  const body = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-lg font-black tabular-nums text-white">{value}</div>
      {note && <div className="truncate text-xs text-slate-400">{note}</div>}
    </>
  );
  return href
    ? <a href={href} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-2 hover:border-slate-600">{body}</a>
    : <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-2">{body}</div>;
}

const entryName = (entry) => (entry.gameMode === '2v2' && entry.members?.length
  ? entry.members.map((member) => cleanName(member.name) || `ID ${member.bhid}`).join(' + ')
  : cleanName(entry.name) || `ID ${entry.playerId}`);

const entryQueue = (entry) => `${serverShort(entry.region)} ${modeLabel(entry.gameMode)}`;

function Highlights({ active, now, check }) {
  if (!active.length) return null;
  const pickMax = (value) => active.reduce((best, entry) => (value(entry) != null && (!best || value(entry) > value(best)) ? entry : best), null);
  const climb = pickMax((entry) => entry.ratingChange);
  const busiest = pickMax((entry) => entry.games);
  const longest = pickMax((entry) => now - sessionSince(entry, check));
  const peaks = active.filter((entry) => entry.newPeak).length;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Highlight label="Playing now" value={formatNumber(active.length)} note={peaks ? `${formatNumber(peaks)} on a new peak` : 'No new peaks yet'} />
      {climb && climb.ratingChange > 0
        ? <Highlight label="Biggest climb" value={<Change value={climb.ratingChange} />} note={`${entryName(climb)} · ${entryQueue(climb)}`} href={sessionHref(climb.sessionId)} />
        : <Highlight label="Biggest climb" value="–" note="Nobody is up yet" />}
      {busiest && <Highlight label="Most games" value={formatNumber(busiest.games)} note={`${entryName(busiest)} · ${record(busiest)}`} href={sessionHref(busiest.sessionId)} />}
      {longest && <Highlight label="Longest session" value={duration(now - sessionSince(longest, check))} note={`${entryName(longest)} · ${entryQueue(longest)}`} href={sessionHref(longest.sessionId)} />}
    </div>
  );
}

export default function RaybotQueue() {
  const [mode, setMode] = useQueryState('mode', 'all');
  const [server, setServer] = useQueryState('server', 'all');
  const [sort, setSort] = useQueryState('sort', 'rating');
  const state = useApi(raybotApi('/queue/live'));
  const legends = useLegendNames();
  const now = useNow(5000);
  const { retry } = state;
  useEffect(() => {
    const timer = setInterval(retry, 60000);
    return () => clearInterval(timer);
  }, [retry]);
  const data = state.data;
  const modeValue = MODE_TABS.some((item) => item.value === mode) ? mode : 'all';
  const serverValue = SERVER_TABS.some((item) => item.value === server) ? server : 'all';
  const sortValue = sorters[sort] ? sort : 'rating';
  const keep = (entry) => (modeValue === 'all' || entry.gameMode === modeValue) && (serverValue === 'all' || entry.region === serverValue);
  const active = useMemo(() => (data ? data.active.filter(keep).sort(sorters[sortValue]) : []), [data, modeValue, serverValue, sortValue]);
  const finished = useMemo(() => (data ? data.finished.filter(keep).sort(sortValue === 'rating' ? sorters.latest : sorters[sortValue]) : []), [data, modeValue, serverValue, sortValue]);

  const modeTabs = MODE_TABS.map((item) => ({
    ...item,
    count: data ? data.active.filter((entry) => (item.value === 'all' || entry.gameMode === item.value) && (serverValue === 'all' || entry.region === serverValue)).length : undefined,
  }));
  const serverTabs = SERVER_TABS.map((item) => ({
    ...item,
    count: data ? data.active.filter((entry) => (item.value === 'all' || entry.region === item.value) && (modeValue === 'all' || entry.gameMode === modeValue)).length : undefined,
  }));

  const where = [serverValue === 'all' ? null : serverName(serverValue), modeValue === 'all' ? null : modeLabel(modeValue)].filter(Boolean).join(' ');
  const meta = data ? [`Top 500 of every server, checked every ${data.checkEveryMinutes} min`, data.updatedAt && `updated ${timeAgo(data.updatedAt, now)}`].filter(Boolean).join(' · ') : undefined;
  const leaderboard = `/raybot/rankings?mode=${modeValue === 'all' ? '1v1' : modeValue}&server=${serverValue}`;

  return (
    <PageShell>
      <PageHeader title="Ranked Queue" meta={meta} actions={<a href={leaderboard} className="text-sm font-bold text-blue-300 hover:underline">Full leaderboard</a>}>
        <Tabs label="Ranked mode" value={modeValue} onChange={setMode} items={modeTabs} />
        <Tabs variant="chips" label="Server" value={serverValue} onChange={setServer} items={serverTabs} />
      </PageHeader>

      {state.error && !data ? (
        <ErrorState message="Couldn't load the ranked queue." detail={state.error} onRetry={state.retry} />
      ) : !data ? (
        <SkeletonGrid count={8} className="grid-cols-1" tileClassName="h-10" />
      ) : (
        <>
          <Highlights active={active} now={now} check={data.checkEveryMinutes} />
          <Section
            title="Playing now"
            count={formatNumber(active.length)}
            headingAs="h2"
            padded={false}
            actions={<Tabs variant="small" label="Sort" value={sortValue} onChange={setSort} items={SORTS} />}
          >
            {active.length ? (
              <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {active.map((entry) => (
                  <QueueCard key={entry.sessionId} entry={entry} legends={legends} now={now} check={data.checkEveryMinutes} showServer={serverValue === 'all'} showMode={modeValue === 'all'} />
                ))}
              </div>
            ) : (
              <EmptyState title={`Nobody from the top 500 is playing${where ? ` ${where}` : ''} right now`} className="m-3" />
            )}
            <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">A game in the last {data.activeWindowMinutes} minutes. Change and W–L are for this session.</p>
          </Section>
          <Section title={`Finished in the last ${data.finishedWindowHours} hours`} count={formatNumber(finished.length)} headingAs="h2" padded={false}>
            {finished.length ? (
              <QueueTable rows={finished} legends={legends} now={now} check={data.checkEveryMinutes} finished showServer={serverValue === 'all'} showMode={modeValue === 'all'} />
            ) : (
              <EmptyState title="No finished sessions here yet" className="m-3" />
            )}
          </Section>
        </>
      )}
    </PageShell>
  );
}
