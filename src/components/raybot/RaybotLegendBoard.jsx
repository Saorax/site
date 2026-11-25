import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageHeader, PageShell, Pagination, ScrollX, Section, SelectInput, SkeletonGrid, Tabs, formatNumber, legendHref, useApi, useQueryState } from '../ui';
import { cleanName, dayText, rankedLegendHref, rating, raybotApi, timeAgo } from './raybot';
import { Fact, LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

const PER_PAGE = 50;
const MAX_PAGES = 1000;

const SORTS = [
  { value: 'peak', label: 'Best peak' },
  { value: 'rating', label: 'Rating' },
  { value: 'winrate', label: 'Win %' },
  { value: 'games', label: 'Games' },
  { value: 'xp', label: 'XP' },
];

const MIN_GAMES = [
  { value: '1', label: 'Any' },
  { value: '100', label: '100+ games' },
  { value: '500', label: '500+' },
  { value: '1000', label: '1,000+' },
];

const pct = (value, digits = 1) => (value == null || !Number.isFinite(value) ? '–' : `${(value * 100).toFixed(digits)}%`);
const winRate = (row) => (row.games ? row.wins / row.games : null);

function Facts({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      <Fact label="Share of games" value={pct(summary.gameShare)} note={`#${summary.rank} of ${formatNumber(summary.legends)} legends`} />
      <Fact label="Win %" value={pct(summary.winRate)} note={`${formatNumber(summary.games)} games`} title="Every mode" />
      <Fact label="Players" value={formatNumber(summary.players)} title="Saved players with at least one game on this legend" />
      <Fact label="100+ games" value={formatNumber(summary.regulars)} />
      <Fact label="Played ranked" value={formatNumber(summary.rankedPlayers)} title="Players with a 1v1 ranked rating on this legend" />
      <Fact label="2,000+ peaks" value={formatNumber(summary.highPeaks)} />
      <Fact label="Median peak" value={rating(summary.medianPeak)} title="Middle 1v1 peak of the players who played it in ranked" />
    </div>
  );
}

function BoardTable({ rows, sort }) {
  const strong = (key) => (sort === key ? 'font-bold text-white' : 'text-slate-300');
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="w-14 px-2 py-1 text-right font-bold">#</th>
            <th className="px-2 py-1 text-left font-bold">Player</th>
            <th className="px-2 py-1 text-right font-bold" title="Highest 1v1 rating seen on this legend">Best peak</th>
            <th className="hidden px-2 py-1 text-right font-bold sm:table-cell" title="1v1 rating on this legend in the player's last save">Rating</th>
            <th className="hidden px-2 py-1 text-right font-bold lg:table-cell" title="Season peak in the player's last save">Season peak</th>
            <th className="hidden px-2 py-1 text-right font-bold sm:table-cell" title="Every mode">Games</th>
            <th className="hidden px-2 py-1 text-right font-bold md:table-cell" title="Every mode">Win %</th>
            <th className="hidden px-2 py-1 text-right font-bold lg:table-cell">XP</th>
            <th className="hidden px-2 py-1 text-right font-bold xl:table-cell">Saved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.bhid} className="hover:bg-slate-800/40">
              <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-300">{formatNumber(row.rank)}</td>
              <td className="max-w-[16rem] px-2 py-1.5">
                <PlayerLink bhid={row.bhid} className="block truncate font-bold text-white">{cleanName(row.name) || `ID ${row.bhid}`}</PlayerLink>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-slate-400 md:hidden">
                  <span className="sm:hidden">rating {rating(row.rating)}</span>
                  <span className="sm:hidden">{formatNumber(row.games)} games</span>
                  <span>{pct(winRate(row))} won</span>
                </div>
              </td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${strong('peak')}`}>{rating(row.peakAllTime)}</td>
              <td className={`hidden px-2 py-1.5 text-right tabular-nums sm:table-cell ${strong('rating')}`}>{rating(row.rating)}</td>
              <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 lg:table-cell">{rating(row.peakRating)}</td>
              <td className={`hidden px-2 py-1.5 text-right tabular-nums sm:table-cell ${strong('games')}`}>{formatNumber(row.games)}</td>
              <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${strong('winrate')}`} title={`${formatNumber(row.wins)} wins`}>{pct(winRate(row))}</td>
              <td className={`hidden px-2 py-1.5 text-right tabular-nums lg:table-cell ${strong('xp')}`}>{formatNumber(row.xp)}</td>
              <td className="hidden whitespace-nowrap px-2 py-1.5 text-right text-xs text-slate-400 xl:table-cell">{dayText(row.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

export default function RaybotLegendBoard({ legend }) {
  const id = Number(legend?.id);
  const valid = Number.isInteger(id) && id > 0;
  const [sortText, setSort] = useQueryState('sort', 'peak');
  const [minText, setMin] = useQueryState('min', '100');
  const [pageText, setPage] = useQueryState('page', '1');
  const sort = SORTS.some((item) => item.value === sortText) ? sortText : 'peak';
  const min = MIN_GAMES.some((item) => item.value === minText) ? minText : '100';
  const page = Math.min(MAX_PAGES, Math.max(1, Number.parseInt(pageText, 10) || 1));
  const board = useApi(valid ? raybotApi(`/legends/${id}/leaderboard?sort=${sort}&minGames=${min}&page=${page}&perPage=${PER_PAGE}`) : '');
  const summary = useApi(valid ? raybotApi(`/legends/${id}/summary`) : '');
  const names = useLegendNames();
  const now = useNow(60000);
  const data = board.data;
  const totalPages = data ? Math.max(1, Math.min(MAX_PAGES, Math.ceil(data.total / PER_PAGE))) : 1;
  useEffect(() => {
    if (data && page > totalPages) setPage(String(totalPages));
  }, [data, page, totalPages, setPage]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const others = useMemo(() => [...(mounted ? names : new Map()).entries()].map(([value, name]) => ({ value: String(value), label: name })).sort((a, b) => a.label.localeCompare(b.label)), [names, mounted]);
  const pick = (setter) => (value) => {
    setter(value);
    setPage('1');
  };
  const goTo = (next) => {
    setPage(String(next));
    document.getElementById('board')?.scrollIntoView({ block: 'start' });
  };
  const jump = (value) => {
    const name = names.get(Number(value));
    if (!name) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('page');
    const query = params.toString();
    window.location.href = `${rankedLegendHref(name)}${query ? `?${query}` : ''}`;
  };

  if (!valid) {
    return (
      <PageShell>
        <EmptyState title="No legend with this name" className="m-3">
          <a href="/raybot/legends" className="font-bold text-blue-300 hover:underline">All legends</a>
        </EmptyState>
      </PageShell>
    );
  }

  const first = data && data.total ? (page - 1) * PER_PAGE + 1 : 0;
  const last = data ? Math.min(data.total, page * PER_PAGE) : 0;
  const links = (
    <div className="flex flex-wrap gap-2 text-sm">
      <a href={legendHref(legend.name)} className="rounded-lg bg-slate-800 px-2 py-1 font-bold text-blue-200 hover:bg-slate-700">Legend page</a>
      <a href="/raybot/legends" className="rounded-lg bg-slate-800 px-2 py-1 font-bold text-blue-200 hover:bg-slate-700">All legends</a>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title={`${legend.name} leaderboard`}
        image={<LegendIcon name={legend.name} className="h-14 w-14" />}
        meta={summary.data?.updatedAt ? `Updated ${timeAgo(summary.data.updatedAt, now)}` : undefined}
        actions={links}
      >
        <Facts summary={summary.data} />
        <Tabs label="Sort by" value={sort} onChange={pick(setSort)} items={SORTS} />
        <div className="flex flex-wrap items-center gap-3">
          <Tabs variant="chips" label="Games on the legend" value={min} onChange={pick(setMin)} items={MIN_GAMES} />
          <SelectInput label="Legend" value={String(id)} onChange={jump} options={others.some((item) => item.value === String(id)) ? others : [{ value: String(id), label: legend.name }]} />
        </div>
      </PageHeader>

      {board.error && !data ? (
        <ErrorState message="Couldn't load the leaderboard." detail={board.error} onRetry={board.retry} />
      ) : !data ? (
        <SkeletonGrid count={10} className="grid-cols-1" tileClassName="h-10" />
      ) : (
        <Section
          id="board"
          title={SORTS.find((item) => item.value === sort)?.label}
          count={formatNumber(data.total)}
          headingAs="h2"
          padded={false}
          actions={data.total > 0 && <span className="text-xs tabular-nums text-slate-400">{formatNumber(first)}–{formatNumber(last)}</span>}
        >
          {data.rows.length ? <BoardTable rows={data.rows} sort={sort} /> : <EmptyState title="No players on this board" className="m-3" />}
          <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={goTo} className="border-t border-slate-800" />
          <p className="max-w-prose border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
            Players Raybot has saved, as of their last save. Games, Win % and XP count every mode; ratings are 1v1 ranked on {legend.name}.
            {data.total > PER_PAGE * MAX_PAGES && ` Only the first ${formatNumber(PER_PAGE * MAX_PAGES)} are listed.`}
          </p>
        </Section>
      )}
    </PageShell>
  );
}
