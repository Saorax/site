import { useEffect } from 'react';
import { AsideBox, EmptyState, ErrorState, FactList, PageHeader, PageShell, Pagination, Pill, SearchInput, Section, SkeletonGrid, Tabs, cx, formatNumber, useApi, useDebounced, useQueryState } from '../ui';
import { MODES, SERVER_ORDER, cleanName, rating, raybotApi, serverName, serverShort, sessionHref, tierTone, timeAgo } from './raybot';
import { LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

const PER_PAGE = 50;

const SERVER_TABS = [{ value: 'all', label: 'All servers' }, ...SERVER_ORDER.map((code) => ({ value: code, label: serverShort(code), title: serverName(code) }))];

const tierBars = {
  violet: 'bg-violet-400',
  sky: 'bg-sky-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  slate: 'bg-slate-400',
};

const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '–');

function record(row) {
  if (row.wins == null || row.games == null) return { text: '–', rate: '' };
  return { text: `${formatNumber(row.wins)}–${formatNumber(row.games - row.wins)}`, rate: row.games ? percent(row.wins, row.games) : '' };
}

function InQueue({ sessionId }) {
  const dot = <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />;
  if (!sessionId) return <span className="ml-1 inline-flex shrink-0" title="In queue now" aria-label="In queue now">{dot}</span>;
  return <a href={sessionHref(sessionId)} className="ml-1 inline-flex shrink-0 p-0.5 hover:opacity-80" title="In queue now: open the session" aria-label="In queue now: open the session">{dot}</a>;
}

function PlayerCell({ row, mode, legends }) {
  if (mode === '2v2') {
    const members = row.members.some((member) => member.name) ? row.members : [{ bhid: null, name: row.name, bestLegend: null }];
    return (
      <div className="space-y-0.5">
        {members.map((member, index) => {
          const legend = legends.get(member.bestLegend);
          return (
            <div key={index} className="flex min-w-0 items-center gap-1.5">
              <LegendIcon name={legend} className="h-6 w-6" link />
              <PlayerLink bhid={member.bhid} className="min-w-0 truncate font-bold text-white">{cleanName(member.name) || `ID ${member.bhid}`}</PlayerLink>
              {index === 0 && row.inQueue && <InQueue sessionId={row.sessionId} />}
            </div>
          );
        })}
      </div>
    );
  }
  const legend = legends.get(row.bestLegend);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <LegendIcon name={legend} link />
      <PlayerLink bhid={row.playerId} className="min-w-0 truncate font-bold text-white">{cleanName(row.name) || `ID ${row.playerId}`}</PlayerLink>
      {row.inQueue && <InQueue sessionId={row.sessionId} />}
    </div>
  );
}

function RankingTable({ data, mode, all, legends }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-xs text-slate-400">
          <th className="w-12 px-2 py-1 text-right font-bold">#</th>
          <th className="px-2 py-1 text-left font-bold">{mode === '2v2' ? 'Team' : 'Player'}</th>
          {all && <th className="hidden w-24 px-2 py-1 text-left font-bold md:table-cell">Server</th>}
          <th className="hidden w-28 px-2 py-1 text-left font-bold sm:table-cell">Tier</th>
          <th className="w-20 px-2 py-1 text-right font-bold">Rating</th>
          <th className="hidden w-16 px-2 py-1 text-right font-bold sm:table-cell">Peak</th>
          <th className="hidden w-28 px-2 py-1 text-right font-bold lg:table-cell">W–L</th>
          <th className="hidden w-16 px-2 py-1 text-right font-bold md:table-cell">Win %</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {data.rows.map((row) => {
          const wl = record(row);
          return (
            <tr key={`${row.region}-${row.regionRank}-${row.playerId}`} className="align-middle hover:bg-slate-800/40">
              <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-300">{row.rank}</td>
              <td className="min-w-0 px-2 py-1.5">
                <PlayerCell row={row} mode={mode} legends={legends} />
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 sm:hidden">
                  {row.tier && <span>{row.tier}</span>}
                  {all && <span>{serverShort(row.region)} #{row.regionRank}</span>}
                  {wl.rate && <span className="tabular-nums">{wl.text} · {wl.rate}</span>}
                </div>
                {all && <div className="mt-0.5 hidden text-[11px] text-slate-400 sm:block md:hidden">{serverShort(row.region)} #{row.regionRank}</div>}
              </td>
              {all && (
                <td className="hidden px-2 py-1.5 text-slate-300 md:table-cell" title={serverName(row.region)}>
                  {serverShort(row.region)} <span className="text-xs tabular-nums text-slate-500">#{row.regionRank}</span>
                </td>
              )}
              <td className="hidden px-2 py-1.5 sm:table-cell">{row.tier && <Pill tone={tierTone(row.tier)}>{row.tier}</Pill>}</td>
              <td className="px-2 py-1.5 text-right">
                <span className="block font-bold tabular-nums text-white">{rating(row.rating)}</span>
                <span className="block text-[11px] tabular-nums text-slate-400 sm:hidden">peak {rating(row.peakRating)}</span>
              </td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 sm:table-cell">{rating(row.peakRating)}</td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 lg:table-cell">{wl.text}</td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 md:table-cell">{wl.rate || '–'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Bar({ label, title, value, max, tone = 'bg-emerald-400' }) {
  return (
    <li className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs" title={title}>
      <span className="truncate text-slate-300">{label}</span>
      <span className="h-2.5 rounded-sm bg-slate-800">
        <span className={cx('block h-full rounded-sm', tone)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="text-right font-bold tabular-nums text-white">{formatNumber(value)}</span>
    </li>
  );
}

function Tiers({ data }) {
  const max = Math.max(0, ...data.tiers.map((tier) => tier.count));
  if (!data.tiers.length) return null;
  return (
    <AsideBox title="Tiers">
      <ol className="space-y-1">
        {data.tiers.map((tier) => (
          <Bar
            key={tier.tier}
            label={tier.tier}
            value={tier.count}
            max={max}
            tone={tierBars[tierTone(tier.tier)]}
            title={`${tier.tier}: ${formatNumber(tier.count)} players (${percent(tier.count, data.players)}), rated ${rating(tier.lowRating)} to ${rating(tier.topRating)}`}
          />
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-slate-400">Diamond stays after a player drops under 2,000 again.</p>
    </AsideBox>
  );
}

function Ratings({ data }) {
  const { buckets, step } = data.histogram;
  const max = Math.max(0, ...buckets.map((bucket) => bucket.count));
  if (!buckets.length) return null;
  return (
    <AsideBox title="Ratings">
      <ol className="space-y-1">
        {buckets.map((bucket) => (
          <Bar key={bucket.from} label={`${formatNumber(bucket.from)}–${formatNumber(bucket.from + step - 1)}`} value={bucket.count} max={max} title={`${percent(bucket.count, data.players)} of the list`} />
        ))}
      </ol>
    </AsideBox>
  );
}

function Cutoffs({ data }) {
  if (!data.cutoffs.length) return null;
  return (
    <AsideBox title="Rating needed">
      <FactList rows={data.cutoffs.map((cutoff) => ({ key: cutoff.rank, label: cutoff.rank === 1 ? '#1' : `Top ${formatNumber(cutoff.rank)}`, value: rating(cutoff.rating) }))} />
    </AsideBox>
  );
}

function Servers({ data, server, onPick }) {
  const rows = SERVER_ORDER.map((code) => data.servers.find((row) => row.region === code)).filter(Boolean);
  return (
    <AsideBox title="Servers">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400">
            <th className="py-0.5 text-left font-bold">Server</th>
            <th className="py-0.5 text-right font-bold">Players</th>
            <th className="py-0.5 text-right font-bold">#1</th>
            <th className="py-0.5 text-right font-bold">Last</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.region} className={cx(row.region === server && 'bg-slate-800/60')}>
              <th className="py-1 text-left font-bold">
                <button type="button" onClick={() => onPick(row.region)} className="text-slate-200 hover:text-blue-300 hover:underline" title={serverName(row.region)}>{serverShort(row.region)}</button>
              </th>
              <td className="py-1 text-right tabular-nums text-slate-300">{formatNumber(row.players)}</td>
              <td className="py-1 text-right tabular-nums text-white">{rating(row.topRating)}</td>
              <td className="py-1 text-right tabular-nums text-slate-300">{rating(row.lastRating)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AsideBox>
  );
}

export default function RaybotRankings() {
  const [mode, setMode] = useQueryState('mode', '1v1');
  const [server, setServer] = useQueryState('server', 'all');
  const [pageText, setPage] = useQueryState('page', '1');
  const [query, setQuery] = useQueryState('q', '');
  const search = useDebounced(query.replace(/\s+/g, ' ').trim(), 250);
  const page = Math.max(1, Number.parseInt(pageText, 10) || 1);
  const modeValue = MODES.some((item) => item.value === mode) ? mode : '1v1';
  const serverValue = SERVER_TABS.some((item) => item.value === server) ? server : 'all';
  const all = serverValue === 'all';
  const url = raybotApi(`/rankings?gameMode=${modeValue}&region=${serverValue}&page=${page}&perPage=${PER_PAGE}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
  const state = useApi(url);
  const legends = useLegendNames();
  const now = useNow();
  const { retry } = state;
  useEffect(() => {
    const timer = setInterval(retry, 60000);
    return () => clearInterval(timer);
  }, [retry]);
  const data = state.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;
  useEffect(() => {
    if (data && page > totalPages) setPage(String(totalPages));
  }, [data, page, totalPages, setPage]);

  const pick = (setter) => (value) => {
    setter(value);
    setPage('1');
  };
  const goTo = (next) => {
    setPage(String(next));
    document.getElementById('ladder')?.scrollIntoView({ block: 'start' });
  };

  const first = data && data.total ? (page - 1) * PER_PAGE + 1 : 0;
  const last = data ? Math.min(data.total, page * PER_PAGE) : 0;
  const title = `${all ? 'All servers' : serverName(serverValue)} ${MODES.find((item) => item.value === modeValue)?.label}`;
  const aside = data ? (
    <>
      <Servers data={data} server={serverValue} onPick={pick(setServer)} />
      <Cutoffs data={data} />
      <Tiers data={data} />
      <Ratings data={data} />
    </>
  ) : null;

  return (
    <PageShell aside={aside} asideLabel="Ladder stats">
      <PageHeader title="Ranked leaderboards" meta={data?.updatedAt ? `Saved ${timeAgo(data.updatedAt, now)}` : undefined}>
        <Tabs label="Ranked mode" value={modeValue} onChange={pick(setMode)} items={MODES} />
        <Tabs variant="chips" label="Server" value={serverValue} onChange={pick(setServer)} items={SERVER_TABS} />
        <SearchInput value={query} onChange={pick(setQuery)} placeholder="Name or Brawlhalla ID" label="Find a player on this leaderboard" />
      </PageHeader>

      {state.error && !data ? (
        <ErrorState message="Couldn't load the leaderboard." detail={state.error} onRetry={state.retry} />
      ) : !data ? (
        <SkeletonGrid count={8} className="grid-cols-1" tileClassName="h-10" />
      ) : (
        <Section
          id="ladder"
          title={title}
          count={formatNumber(data.total)}
          headingAs="h2"
          padded={false}
          actions={data.total > 0 && <span className="text-xs tabular-nums text-slate-400">{formatNumber(first)}–{formatNumber(last)}</span>}
        >
          {all && data.floor != null && !search && (
            <p className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
              Ends at {rating(data.floor)}: under that, some servers' players fall outside their saved top 500.
            </p>
          )}
          {data.total ? (
            <RankingTable data={data} mode={modeValue} all={all} legends={legends} />
          ) : (
            <EmptyState title={search ? `Nobody called "${search}" on this leaderboard` : 'No saved leaderboard for this server and mode'} className="m-3" />
          )}
          <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={goTo} className="border-t border-slate-800" />
        </Section>
      )}
    </PageShell>
  );
}
