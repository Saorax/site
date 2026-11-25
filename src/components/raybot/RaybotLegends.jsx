import { useMemo } from 'react';
import { AsideBox, EmptyState, ErrorState, PageHeader, PageShell, ScrollX, SearchInput, Section, SelectInput, SkeletonGrid, apiUrl, cx, formatNumber, matchesWords, useApi, useQueryState } from '../ui';
import { cleanName, rankedLegendHref, rating, raybotApi, timeAgo } from './raybot';
import { LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

const pct = (value, digits = 1) => (value == null || !Number.isFinite(value) ? '–' : `${(value * 100).toFixed(digits)}%`);

const COLUMNS = [
  { key: 'name', label: 'Legend', value: (row) => row.name, align: 'left' },
  { key: 'players', label: 'Players', value: (row) => row.players, title: 'Saved players with at least one game on this legend', className: 'hidden sm:table-cell' },
  { key: 'regulars', label: '100+ games', value: (row) => row.regulars, title: 'Saved players with 100 or more games on this legend', className: 'hidden xl:table-cell' },
  { key: 'share', label: 'Share of games', value: (row) => row.gameShare, title: 'Share of all games played by saved players, every mode', className: 'hidden md:table-cell' },
  { key: 'winrate', label: 'Win %', value: (row) => row.winRate, title: 'Wins over games, every mode' },
  { key: 'ranked', label: 'Played ranked', value: (row) => row.rankedPlayers, title: 'Saved players with a 1v1 ranked rating on this legend', className: 'hidden lg:table-cell' },
  { key: 'high', label: '2,000+ peaks', value: (row) => row.highPeaks, title: 'Saved players who peaked 2,000 or higher in 1v1 with this legend', className: 'hidden md:table-cell' },
  { key: 'median', label: 'Median peak', value: (row) => row.medianPeak, title: 'Middle 1v1 peak of the players who played it in ranked', className: 'hidden xl:table-cell' },
  { key: 'best', label: 'Best peak', value: (row) => row.top?.peak ?? null, title: 'Highest 1v1 peak on this legend', className: 'hidden lg:table-cell' },
];

const SORTS = COLUMNS.map((column) => column.key);

function sortRows(rows, key, desc) {
  const column = COLUMNS.find((entry) => entry.key === key) || COLUMNS[3];
  return [...rows].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    if (typeof left === 'string' || typeof right === 'string') {
      const order = String(left ?? '').localeCompare(String(right ?? ''));
      return desc ? -order : order;
    }
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return desc ? right - left : left - right;
  });
}

function SortHeader({ column, sort, desc, onSort }) {
  const active = sort === column.key;
  return (
    <th className={cx('px-2 py-1 font-bold', column.align === 'left' ? 'text-left' : 'text-right', column.className)} aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined} title={column.title}>
      <button type="button" onClick={() => onSort(column.key)} className={cx('inline-flex items-center gap-0.5 hover:text-white', active && 'text-white')}>
        {column.label}
        <span aria-hidden="true" className="text-[9px]">{active ? (desc ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  );
}

function ShareBar({ value, max }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="hidden h-2 w-16 rounded-sm bg-slate-800 2xl:block">
        <span className="block h-full rounded-sm bg-emerald-400/80" style={{ width: `${max && value ? Math.max(3, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="w-12 tabular-nums">{pct(value)}</span>
    </span>
  );
}

function LegendTable({ rows, sort, desc, onSort }) {
  const maxShare = Math.max(0, ...rows.map((row) => row.gameShare || 0));
  return (
    <ScrollX>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="w-10 px-2 py-1 text-right font-bold">#</th>
            {COLUMNS.map((column) => <SortHeader key={column.key} column={column} sort={sort} desc={desc} onSort={onSort} />)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, index) => (
            <tr key={row.legendId} className="hover:bg-slate-800/40">
              <td className="px-2 py-1 text-right tabular-nums text-slate-500">{index + 1}</td>
              <td className="px-2 py-1">
                <a href={rankedLegendHref(row.name)} className="flex min-w-0 items-center gap-2 font-bold text-white hover:text-blue-300">
                  <LegendIcon name={row.name} className="h-7 w-7" />
                  <span className="truncate">{row.name}</span>
                </a>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-slate-400 md:hidden">
                  <span>{pct(row.gameShare)} of games</span>
                  <span>{formatNumber(row.highPeaks)} at 2,000+</span>
                </div>
              </td>
              <td className="hidden px-2 py-1 text-right tabular-nums text-slate-200 sm:table-cell">{formatNumber(row.players)}</td>
              <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 xl:table-cell">{formatNumber(row.regulars)}</td>
              <td className="hidden px-2 py-1 text-right text-slate-300 md:table-cell"><ShareBar value={row.gameShare} max={maxShare} /></td>
              <td className="px-2 py-1 text-right font-bold tabular-nums text-white" title={`${formatNumber(row.wins)} wins in ${formatNumber(row.games)} games`}>{pct(row.winRate)}</td>
              <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 lg:table-cell">{formatNumber(row.rankedPlayers)}</td>
              <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 md:table-cell">{formatNumber(row.highPeaks)}</td>
              <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 xl:table-cell">{rating(row.medianPeak)}</td>
              <td className="hidden px-2 py-1 text-right lg:table-cell">
                {row.top ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <PlayerLink bhid={row.top.bhid} className="max-w-[9rem] truncate text-slate-300">{cleanName(row.top.name) || `ID ${row.top.bhid}`}</PlayerLink>
                    <span className="font-bold tabular-nums text-white">{rating(row.top.peak)}</span>
                  </span>
                ) : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function weaponTotals(rows, weaponsOf) {
  const totals = new Map();
  for (const row of rows) {
    for (const weapon of weaponsOf.get(row.legendId) || []) {
      const entry = totals.get(weapon) || { weapon, legends: 0, games: 0, wins: 0, highPeaks: 0 };
      entry.legends += 1;
      entry.games += row.games;
      entry.wins += row.wins;
      entry.highPeaks += row.highPeaks;
      totals.set(weapon, entry);
    }
  }
  const all = [...totals.values()];
  const games = all.reduce((sum, entry) => sum + entry.games, 0);
  return all.map((entry) => ({ ...entry, share: games ? entry.games / games : null, winRate: entry.games ? entry.wins / entry.games : null })).sort((a, b) => b.games - a.games);
}

function Weapons({ totals, weapon, onPick }) {
  if (!totals.length) return null;
  return (
    <AsideBox title="Weapons">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400">
            <th className="py-0.5 text-left font-bold">Weapon</th>
            <th className="py-0.5 text-right font-bold" title="Share of games. A legend's games count for both of its weapons.">Games</th>
            <th className="py-0.5 text-right font-bold">Win %</th>
            <th className="py-0.5 text-right font-bold" title="Players who peaked 2,000+ on a legend with this weapon">2,000+</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {totals.map((entry) => (
            <tr key={entry.weapon} className={cx(entry.weapon === weapon && 'bg-slate-800/60')}>
              <th className="py-1 text-left font-bold">
                <button type="button" onClick={() => onPick(entry.weapon === weapon ? '' : entry.weapon)} className="text-slate-200 hover:text-blue-300 hover:underline">{entry.weapon}</button>
              </th>
              <td className="py-1 text-right tabular-nums text-slate-300">{pct(entry.share)}</td>
              <td className="py-1 text-right tabular-nums text-white">{pct(entry.winRate)}</td>
              <td className="py-1 text-right tabular-nums text-slate-300">{formatNumber(entry.highPeaks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-400">A legend's games count for both of its weapons.</p>
    </AsideBox>
  );
}

export default function RaybotLegends() {
  const state = useApi(raybotApi('/legends'));
  const summary = useApi(apiUrl('/game/legends/summary'));
  const names = useLegendNames();
  const now = useNow(60000);
  const [sortText, setSort] = useQueryState('sort', 'share');
  const [dirText, setDir] = useQueryState('dir', '');
  const [query, setQuery] = useQueryState('q', '');
  const [weapon, setWeapon] = useQueryState('weapon', '');
  const sort = SORTS.includes(sortText) ? sortText : 'share';
  const desc = dirText ? dirText !== 'asc' : sort !== 'name';

  const weaponsOf = useMemo(() => {
    const map = new Map();
    for (const legend of Array.isArray(summary.data) ? summary.data : []) {
      const id = Number(legend?.id);
      if (!Number.isInteger(id)) continue;
      const list = [legend.weapons?.main?.displayName || legend.weapons?.main?.name, legend.weapons?.secondary?.displayName || legend.weapons?.secondary?.name].filter(Boolean);
      map.set(id, list);
    }
    return map;
  }, [summary.data]);

  const data = state.data;
  const rows = useMemo(() => (data?.legends || []).map((row) => ({ ...row, name: names.get(row.legendId) || `Legend ${row.legendId}` })), [data, names]);
  const weaponList = useMemo(() => [...new Set([...weaponsOf.values()].flat())].sort(), [weaponsOf]);
  const totals = useMemo(() => weaponTotals(rows, weaponsOf), [rows, weaponsOf]);
  const shown = useMemo(() => {
    const filtered = rows.filter((row) => matchesWords(query, row.name) && (!weapon || (weaponsOf.get(row.legendId) || []).includes(weapon)));
    return sortRows(filtered, sort, desc);
  }, [rows, query, weapon, weaponsOf, sort, desc]);
  const overall = data?.games ? rows.reduce((sum, row) => sum + row.wins, 0) / data.games : null;

  const onSort = (key) => {
    if (key === sort) setDir(desc ? 'asc' : 'desc');
    else {
      setSort(key);
      setDir('');
    }
  };

  const aside = data ? <Weapons totals={totals} weapon={weapon} onPick={setWeapon} /> : null;

  return (
    <PageShell aside={aside} asideLabel="Weapons">
      <PageHeader title="Legend Stats" meta={data?.updatedAt ? `Updated ${timeAgo(data.updatedAt, now)}` : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <SearchInput value={query} onChange={setQuery} placeholder="Legend" label="Find a legend" />
          </div>
          <SelectInput label="Weapon" value={weapon} onChange={setWeapon} options={[{ value: '', label: 'Any' }, ...weaponList.map((name) => ({ value: name, label: name }))]} />
          <SelectInput label="Sort" value={sort} onChange={(key) => { setSort(key); setDir(''); }} options={COLUMNS.map((column) => ({ value: column.key, label: column.label }))} className="md:hidden" />
        </div>
      </PageHeader>

      {state.error && !data ? (
        <ErrorState message="Couldn't load legend stats." detail={state.error} onRetry={state.retry} />
      ) : !data ? (
        <SkeletonGrid count={10} className="grid-cols-1" tileClassName="h-10" />
      ) : (
        <Section id="legends" title="Legends" count={shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`} headingAs="h2" padded={false}>
          {shown.length ? <LegendTable rows={shown} sort={sort} desc={desc} onSort={onSort} /> : <EmptyState title="No legend matches" className="m-3" />}
          <p className="max-w-prose border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
            Every player Raybot has saved, as of their last save. Games and Win % count every mode; ratings are 1v1 ranked with that legend.
            {overall != null && ` These players win ${pct(overall)} of their games overall, so compare legends with each other rather than with 50%.`}
          </p>
        </Section>
      )}
    </PageShell>
  );
}
