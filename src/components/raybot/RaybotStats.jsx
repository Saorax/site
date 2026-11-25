import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageHeader, PageShell, ScrollX, Section, SkeletonGrid, Tabs, cx, formatNumber, useApi, useQueryState } from '../ui';
import { MODES, SERVER_ORDER, rankedLegendHref, raybotApi, serverName, serverShort, timeAgo } from './raybot';
import { Fact, LegendIcon, useLegendNames, useNow, useWidth } from './parts';

const HOUR_MS = 60 * 60 * 1000;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SERVER_TABS = [{ value: 'all', label: 'All servers' }, ...SERVER_ORDER.map((code) => ({ value: code, label: serverShort(code), title: serverName(code) }))];
const SERVER_COLORS = {
  'us-e': '#60a5fa',
  'us-w': '#a78bfa',
  eu: '#34d399',
  brz: '#facc15',
  sea: '#f472b6',
  aus: '#fb923c',
  jpn: '#f87171',
  sa: '#2dd4bf',
  me: '#a3e635',
};
const TIER_GROUPS = [
  { key: 'Valhallan', bar: 'bg-violet-400' },
  { key: 'Diamond', bar: 'bg-sky-400' },
  { key: 'Platinum', bar: 'bg-blue-500' },
  { key: 'Gold', bar: 'bg-amber-400' },
  { key: 'Silver', bar: 'bg-slate-300' },
  { key: 'Bronze', bar: 'bg-orange-700' },
  { key: 'Tin', bar: 'bg-slate-500' },
];
const DAY_VIEWS = [
  { value: 'games', label: 'Games' },
  { value: 'players', label: 'Players' },
];

const pct = (part, whole, digits = 1) => (whole ? `${((100 * part) / whole).toFixed(digits)}%` : '–');
const hourText = (hour) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
const average = (sum, count) => (count ? sum / count : null);
const round = (value) => (value == null ? '–' : formatNumber(Math.round(value)));
const utcDay = (time) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthText = (month, long = false) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-US', long ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' });
};
const unitFor = (mode) => (mode === '2v2' ? 'teams' : 'players');
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function hourGrid(hours, server) {
  const values = hours?.players?.[server] || [];
  const start = hours?.from ? new Date(hours.from).getTime() : NaN;
  const sums = Array.from({ length: 7 }, () => Array(24).fill(0));
  const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
  const bySum = Array(24).fill(0);
  const byCount = Array(24).fill(0);
  if (!Number.isFinite(start)) return null;
  values.forEach((value, index) => {
    if (value == null) return;
    const date = new Date(start + index * HOUR_MS);
    const day = (date.getDay() + 6) % 7;
    const hour = date.getHours();
    sums[day][hour] += value;
    counts[day][hour] += 1;
    bySum[hour] += value;
    byCount[hour] += 1;
  });
  const grid = sums.map((row, day) => row.map((sum, hour) => average(sum, counts[day][hour])));
  const slots = grid.flatMap((row, day) => row.map((value, hour) => ({ day, hour, value }))).filter((slot) => slot.value != null);
  if (!slots.length) return null;
  const busiest = slots.reduce((best, slot) => (slot.value > best.value ? slot : best));
  const quietest = slots.reduce((best, slot) => (slot.value < best.value ? slot : best));
  return { grid, byHour: bySum.map((sum, hour) => average(sum, byCount[hour])), busiest, quietest, low: quietest.value, peak: busiest.value };
}

function dayRows(days, server, now) {
  if (!days?.from) return [];
  const start = new Date(days.from).getTime();
  return (days.games?.[server] || []).map((games, index) => {
    const time = start + index * 24 * HOUR_MS;
    const coverage = days.coverage?.[index] || { hours: 24, covered: 24 };
    return {
      time,
      games,
      players: days.players?.[server]?.[index] ?? 0,
      today: time + 24 * HOUR_MS > now,
      missing: Math.max(0, coverage.hours - coverage.covered),
      complete: coverage.hours === 24 && coverage.covered === 24,
    };
  });
}

function Heatmap({ stats, unit }) {
  return (
    <ScrollX>
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-px text-[10px]">
        <thead>
          <tr>
            <th className="w-8" />
            {Array.from({ length: 24 }, (_, hour) => <th key={hour} className="font-normal text-slate-500">{hour % 3 === 0 ? hourText(hour).replace(' ', '') : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {stats.grid.map((row, day) => (
            <tr key={DAYS[day]}>
              <th className="pr-1 text-left font-bold text-slate-400">{DAYS[day]}</th>
              {row.map((value, hour) => (
                <td
                  key={hour}
                  title={`${DAYS[day]} ${hourText(hour)}: ${value == null ? 'no data' : `${value.toFixed(1)} ${unit} on average`}`}
                  className="h-5 rounded-sm"
                  style={{ backgroundColor: value ? `rgba(52, 211, 153, ${0.1 + (0.9 * (value - stats.low)) / Math.max(1e-9, stats.peak - stats.low)})` : 'rgb(30, 41, 59)' }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function QueueByHour({ data, server, unit }) {
  const stats = useMemo(() => hourGrid(data.activity?.hours, server), [data.activity, server]);
  return (
    <Section title="Queue by hour" headingAs="h2" actions={<span className="text-xs text-slate-400">Your time zone</span>} bodyClassName="space-y-2 p-2">
      {stats ? (
        <>
          <Heatmap stats={stats} unit={unit} />
          <p className="px-1 text-xs text-slate-400">Average {unit} from the {server === 'all' ? 'top 500s' : `${serverShort(server)} top 500`} who played in each hour, last {data.windowDays} days.</p>
        </>
      ) : (
        <EmptyState title="No games saved for this server and mode" className="m-1" />
      )}
    </Section>
  );
}

function PeakHours({ data, server, onPick, unit }) {
  const [ref, width] = useWidth(640);
  const lines = useMemo(
    () => SERVER_ORDER.map((code) => ({ code, values: hourGrid(data.activity?.hours, code)?.byHour || Array(24).fill(null) })).filter((line) => line.values.some((value) => value)),
    [data.activity],
  );
  const height = 220;
  const top = Math.max(1, ...lines.flatMap((line) => line.values.filter((value) => value != null)));
  const step = top > 40 ? 20 : top > 20 ? 10 : 5;
  const high = Math.ceil(top / step) * step;
  const x = (hour) => 32 + (hour / 23) * (width - 44);
  const y = (value) => 10 + ((high - value) / high) * (height - 34);
  const ticks = [0, high / 2, high];
  return (
    <Section title="Peak hours by server" headingAs="h2" actions={<span className="text-xs text-slate-400">Your time zone</span>} bodyClassName="space-y-2 p-2">
      <div ref={ref} className="w-full">
        {lines.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-full" role="img" aria-label={`Average ${unit} per hour of the day on each server`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1="32" x2={width - 12} y1={y(tick)} y2={y(tick)} className="stroke-slate-800" strokeDasharray="4 4" />
                <text x="2" y={y(tick) + 4} className="fill-slate-500 text-[11px] font-bold">{formatNumber(tick)}</text>
              </g>
            ))}
            {[0, 6, 12, 18, 23].map((hour) => (
              <text key={hour} x={x(hour)} y={height - 4} textAnchor={hour === 0 ? 'start' : hour === 23 ? 'end' : 'middle'} className="fill-slate-500 text-[11px] font-bold">{hourText(hour)}</text>
            ))}
            {lines.map((line) => {
              const picked = server === 'all' || server === line.code;
              const path = line.values.map((value, hour) => (value == null ? null : `${x(hour).toFixed(1)},${y(value).toFixed(1)}`)).filter(Boolean).map((point, index) => `${index ? 'L' : 'M'}${point}`).join(' ');
              return (
                <path
                  key={line.code}
                  d={path}
                  fill="none"
                  stroke={SERVER_COLORS[line.code]}
                  strokeWidth={server === line.code ? 3 : 1.75}
                  strokeOpacity={picked ? 1 : 0.2}
                  strokeLinejoin="round"
                >
                  <title>{`${serverName(line.code)}: busiest at ${hourText(line.values.indexOf(Math.max(...line.values.filter((value) => value != null))))}`}</title>
                </path>
              );
            })}
          </svg>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-slate-400">No games saved for this mode.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1 px-1">
        {lines.map((line) => (
          <button
            key={line.code}
            type="button"
            onClick={() => onPick(server === line.code ? 'all' : line.code)}
            aria-pressed={server === line.code}
            title={serverName(line.code)}
            className={cx(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
              server === line.code ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-600',
            )}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SERVER_COLORS[line.code] }} />
            {serverShort(line.code)}
          </button>
        ))}
      </div>
    </Section>
  );
}

function PerDay({ data, server, unit, now }) {
  const [view, setView] = useState('games');
  const rows = useMemo(() => dayRows(data.activity?.days, server, now), [data.activity, server, now]);
  const max = Math.max(1, ...rows.map((row) => row[view]));
  return (
    <Section
      title="Per day"
      headingAs="h2"
      actions={<Tabs variant="small" label="Count" value={view} onChange={setView} items={DAY_VIEWS.map((item) => (item.value === 'players' ? { ...item, label: capital(unit) } : item))} />}
      bodyClassName="space-y-1 p-2"
    >
      {rows.length ? (
        <>
          <div className="flex h-32 items-end gap-px" role="img" aria-label={`${view === 'games' ? 'Games' : capital(unit)} per day`}>
            {rows.map((row) => (
              <div
                key={row.time}
                className="flex h-full flex-1 items-end"
                title={`${utcDay(row.time)}${row.today ? ' (so far)' : ''}: ${formatNumber(row.games)} games, ${formatNumber(row.players)} ${unit}${row.missing && !row.today ? `, ${row.missing} h not checked` : ''}`}
              >
                <div
                  className={cx('w-full rounded-t-sm', row.complete ? 'bg-emerald-400/80' : 'bg-emerald-400/35')}
                  style={{ height: row[view] ? `${Math.max(2, (100 * row[view]) / max)}%` : '2px' }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-0.5 text-[11px] font-bold text-slate-500">
            <span>{utcDay(rows[0].time)}</span>
            <span>Today (UTC)</span>
          </div>
        </>
      ) : (
        <EmptyState title="No games saved for this server and mode" className="m-1" />
      )}
    </Section>
  );
}

function tierGroups(tiers) {
  const counts = new Map(TIER_GROUPS.map((group) => [group.key, 0]));
  for (const tier of tiers || []) {
    const key = TIER_GROUPS.find((group) => String(tier.tier || '').toLowerCase().startsWith(group.key.toLowerCase()))?.key;
    if (key) counts.set(key, counts.get(key) + tier.count);
  }
  return TIER_GROUPS.map((group) => ({ ...group, count: counts.get(group.key) }));
}

function TierShares({ data, server, onPick }) {
  const rows = [data.ratings.all, ...SERVER_ORDER.map((code) => data.ratings.servers.find((row) => row.region === code))].filter((row) => row && row.players);
  const used = TIER_GROUPS.filter((group) => rows.some((row) => tierGroups(row.tiers).find((entry) => entry.key === group.key).count));
  return (
    <Section title="Tiers on the top 500" headingAs="h2" bodyClassName="space-y-2 p-2">
      <ol className="space-y-1">
        {rows.map((row) => {
          const groups = tierGroups(row.tiers);
          return (
            <li key={row.region}>
              <button
                type="button"
                onClick={() => onPick(row.region)}
                aria-pressed={server === row.region}
                className={cx('grid w-full grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs', server === row.region ? 'bg-slate-800' : 'hover:bg-slate-800/60')}
              >
                <span className="truncate font-bold text-slate-200" title={row.region === 'all' ? 'All servers' : serverName(row.region)}>{row.region === 'all' ? 'All' : serverShort(row.region)}</span>
                <span className="flex h-3 overflow-hidden rounded-sm bg-slate-800">
                  {groups.filter((group) => group.count).map((group) => (
                    <span key={group.key} className={group.bar} style={{ width: `${(100 * group.count) / row.players}%` }} title={`${group.key}: ${formatNumber(group.count)} (${pct(group.count, row.players)})`} />
                  ))}
                </span>
                <span className="text-right tabular-nums text-slate-300">{formatNumber(row.players)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-slate-400">
        {used.map((group) => (
          <span key={group.key} className="inline-flex items-center gap-1">
            <span className={cx('inline-block h-2 w-2 rounded-sm', group.bar)} />
            {group.key}
          </span>
        ))}
      </div>
    </Section>
  );
}

function Ratings({ data, server }) {
  const board = server === 'all' ? data.ratings.all : data.ratings.servers.find((row) => row.region === server);
  const buckets = [...(board?.histogram?.buckets || [])].reverse();
  const step = board?.histogram?.step || 100;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const groups = tierGroups(board?.tiers);
  return (
    <Section title="Ratings on the top 500" count={board?.players ? formatNumber(board.players) : undefined} headingAs="h2" bodyClassName="space-y-2 p-2">
      {buckets.length ? (
        <>
          <div className="flex h-32 items-end gap-px" role="img" aria-label="Players per 100 rating">
            {buckets.map((bucket) => (
              <div key={bucket.from} className="flex h-full flex-1 items-end" title={`${formatNumber(bucket.from)}–${formatNumber(bucket.from + step - 1)}: ${formatNumber(bucket.count)} (${pct(bucket.count, board.players)})`}>
                <div className="w-full rounded-t-sm bg-sky-400/80" style={{ height: bucket.count ? `${Math.max(2, (100 * bucket.count) / max)}%` : '2px' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-0.5 text-[11px] font-bold text-slate-500">
            <span>{formatNumber(buckets[0].from)}</span>
            <span>{formatNumber(buckets[buckets.length - 1].from + step)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-1 text-xs sm:grid-cols-4">
            {groups.filter((group) => group.count).map((group) => (
              <div key={group.key} className="flex justify-between gap-2">
                <dt className="text-slate-400">{group.key}</dt>
                <dd className="tabular-nums text-white">{pct(group.count, board.players)}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <EmptyState title="No saved top 500 for this server and mode" className="m-1" />
      )}
    </Section>
  );
}

function Legends({ data, server, names }) {
  const [all, setAll] = useState(false);
  const rows = data.legends.servers?.[server] || [];
  const players = rows.reduce((sum, row) => sum + row.players, 0);
  const shown = all ? rows : rows.slice(0, 12);
  const max = Math.max(1, ...rows.map((row) => row.players));
  return (
    <Section title="1v1 best legends" count={players ? `${formatNumber(players)} players` : undefined} headingAs="h2" padded={false}>
      {rows.length ? (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="px-2 py-1.5 text-left font-bold">Legend</th>
                <th className="px-2 py-1.5 text-right font-bold" title="Top 500 players with this as their best legend">Players</th>
                <th className="hidden px-2 py-1.5 text-left font-bold sm:table-cell"><span className="sr-only">Share</span></th>
                <th className="px-2 py-1.5 text-right font-bold" title="Their ranked games on it this season">Games</th>
                <th className="px-2 py-1.5 text-right font-bold">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {shown.map((row) => {
                const name = names.get(row.legendId);
                return (
                  <tr key={row.legendId}>
                    <td className="px-2 py-1">
                      <a href={name ? rankedLegendHref(name) : undefined} className="flex min-w-0 items-center gap-1.5 font-bold text-white hover:text-blue-300">
                        <LegendIcon name={name} className="h-6 w-6" />
                        <span className="truncate">{name || `Legend ${row.legendId}`}</span>
                      </a>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-white">{formatNumber(row.players)}</td>
                    <td className="hidden w-1/4 px-2 py-1 sm:table-cell">
                      <span className="block h-2 rounded-sm bg-slate-800" title={pct(row.players, players)}>
                        <span className="block h-full rounded-sm bg-emerald-400/80" style={{ width: `${(100 * row.players) / max}%` }} />
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-300">{formatNumber(row.games)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-300">{pct(row.wins, row.games)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 12 && (
            <button type="button" onClick={() => setAll(!all)} className="w-full border-t border-slate-800 px-3 py-1.5 text-xs font-bold text-blue-300 hover:text-blue-200">
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      ) : (
        <EmptyState title="No saved 1v1 top 500 for this server" className="m-3" />
      )}
    </Section>
  );
}

function LegendMonths({ months, names }) {
  const view = useMemo(() => {
    if (!months?.months?.length) return null;
    const count = Math.min(12, months.months.length);
    const from = months.months.length - count;
    const columns = months.months.slice(from);
    const totals = months.totals.slice(from);
    const recent = Math.max(0, count - 3);
    const rows = months.legends
      .map((legend) => {
        const games = legend.games.slice(from);
        const shares = games.map((value, index) => (totals[index].games ? value / totals[index].games : 0));
        const recentGames = games.slice(recent).reduce((sum, value) => sum + value, 0);
        return { legendId: legend.legendId, shares, recentGames };
      })
      .sort((a, b) => b.recentGames - a.recentGames)
      .slice(0, 15);
    const peak = Math.max(0.01, ...rows.flatMap((row) => row.shares));
    const phone = columns.map((_, index) => index >= count - 5);
    return { columns, totals, rows, peak, phone };
  }, [months]);
  if (!view) return null;
  const current = new Date().toISOString().slice(0, 7);
  return (
    <Section title="1v1 ranked games by legend, per month" headingAs="h2" bodyClassName="space-y-2 p-2">
      <ScrollX>
        <table className="w-full border-separate border-spacing-px text-xs sm:min-w-[40rem]">
          <thead>
            <tr className="text-slate-400">
              <th className="px-1 text-left font-bold">Legend</th>
              {view.columns.map((month, index) => (
                <th key={month} className={cx('px-1 text-right font-bold', !view.phone[index] && 'hidden sm:table-cell')} title={month === current ? `${monthText(month, true)}, so far` : monthText(month, true)}>
                  {monthText(month)}{month === current ? '*' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => {
              const name = names.get(row.legendId);
              return (
                <tr key={row.legendId}>
                  <th className="px-1 py-0.5 text-left">
                    <a href={name ? rankedLegendHref(name) : undefined} className="flex items-center gap-1.5 font-bold text-white hover:text-blue-300">
                      <LegendIcon name={name} className="h-5 w-5" />
                      <span className="truncate">{name || `Legend ${row.legendId}`}</span>
                    </a>
                  </th>
                  {row.shares.map((share, index) => (
                    <td
                      key={view.columns[index]}
                      className={cx('rounded-sm px-1 py-0.5 text-right tabular-nums text-white', !view.phone[index] && 'hidden sm:table-cell')}
                      style={{ backgroundColor: share ? `rgba(56, 189, 248, ${0.08 + (0.6 * share) / view.peak})` : undefined }}
                      title={`${name || `Legend ${row.legendId}`}, ${monthText(view.columns[index], true)}: ${(share * 100).toFixed(1)}% of games`}
                    >
                      {share ? `${(share * 100).toFixed(1)}` : '–'}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="text-slate-400">
              <th className="px-1 pt-1 text-left font-normal">Players saved</th>
              {view.totals.map((total, index) => <td key={total.month} className={cx('px-1 pt-1 text-right tabular-nums', !view.phone[index] && 'hidden sm:table-cell')}>{formatNumber(total.players)}</td>)}
            </tr>
          </tbody>
        </table>
      </ScrollX>
      <p className="px-1 text-xs text-slate-400">Percent of the month's 1v1 ranked games, from Raybot's saved profiles: each player's season games on each legend at their saves that month.{view.columns.includes(current) ? ' * this month so far.' : ''}</p>
    </Section>
  );
}

function Facts({ data, server, unit, now }) {
  const grid = useMemo(() => hourGrid(data.activity?.hours, server), [data.activity, server]);
  const rows = useMemo(() => dayRows(data.activity?.days, server, now).filter((row) => row.complete), [data.activity, server, now]);
  const perDay = (key) => average(rows.reduce((sum, row) => sum + row[key], 0), rows.length);
  const board = server === 'all' ? data.ratings.all : data.ratings.servers.find((row) => row.region === server);
  const diamonds = tierGroups(board?.tiers).filter((group) => group.key === 'Valhallan' || group.key === 'Diamond').reduce((sum, group) => sum + group.count, 0);
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      <Fact label="Busiest hour" value={grid ? `${DAYS[grid.busiest.day]} ${hourText(grid.busiest.hour)}` : '–'} note={grid ? `${grid.busiest.value.toFixed(1)} ${unit} on average` : undefined} />
      <Fact label="Quietest hour" value={grid ? `${DAYS[grid.quietest.day]} ${hourText(grid.quietest.hour)}` : '–'} note={grid ? `${grid.quietest.value.toFixed(1)} ${unit} on average` : undefined} />
      <Fact label={`${capital(unit)} per day`} value={round(perDay('players'))} note={rows.length ? `Average of ${rows.length} days` : undefined} />
      <Fact label="Games per day" value={round(perDay('games'))} note={rows.length ? `Average of ${rows.length} days` : undefined} />
      <Fact label="Diamond or higher" value={board?.players ? pct(diamonds, board.players) : '–'} note={board?.players ? `of ${formatNumber(board.players)} on the top 500` : undefined} />
    </div>
  );
}

function Method({ data }) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
      <summary className="cursor-pointer font-bold text-slate-300">How these are counted</summary>
      <ul className="mt-2 max-w-prose list-disc space-y-1 pl-4">
        <li>Raybot reads pages 1 to 10 (the top 500) of every server's ranked leaderboard every {data.checkEveryMinutes} minutes. Players below the top 500 aren't counted.</li>
        <li>A player (a team in 2v2) counts in an hour when their game total goes up in it. Games are the rise in that total between checks, so a game between two top 500 players or teams counts for both.</li>
        <li>Hours with no check at all are left out of the averages. Days run midnight to midnight UTC; lighter bars are days with missed checks or today.</li>
        <li>Tiers and ratings use the saved top 500 right now. All servers counts each player once, at their best rating. Diamond stays after a player drops under 2,000.</li>
        <li>1v1 best legends: the legend the official leaderboard shows for each top 500 player, with their ranked games and wins on it this season.</li>
        <li>Private Raybot profiles are left out.</li>
      </ul>
    </details>
  );
}

export default function RaybotStats() {
  const [mode, setMode] = useQueryState('mode', '1v1');
  const [server, setServer] = useQueryState('server', 'all');
  const modeValue = MODES.some((item) => item.value === mode) ? mode : '1v1';
  const serverValue = SERVER_TABS.some((item) => item.value === server) ? server : 'all';
  const state = useApi(raybotApi(`/stats?gameMode=${modeValue}`));
  const names = useLegendNames();
  const now = useNow(30000);
  const data = state.data;
  const { retry } = state;
  const loading = Boolean(data?.loading);
  useEffect(() => {
    const timer = setInterval(retry, loading ? 5000 : 5 * 60000);
    return () => clearInterval(timer);
  }, [retry, loading]);
  const unit = unitFor(modeValue);
  const updated = data?.updatedAt || data?.ratings?.all?.updatedAt;

  return (
    <PageShell>
      <PageHeader title="Ranked Stats" meta={updated ? `Updated ${timeAgo(updated, now)}` : undefined}>
        <Tabs label="Ranked mode" value={modeValue} onChange={setMode} items={MODES} />
        <Tabs variant="chips" label="Server" value={serverValue} onChange={setServer} items={SERVER_TABS} />
      </PageHeader>

      {state.error && !data ? (
        <ErrorState message="Couldn't load ranked stats." detail={state.error} onRetry={state.retry} />
      ) : !data ? (
        <SkeletonGrid count={4} className="grid-cols-1 xl:grid-cols-2" tileClassName="h-56" />
      ) : (
        <>
          {loading ? <LoadingState label="Loading the last 4 weeks of ranked queue…" /> : <Facts data={data} server={serverValue} unit={unit} now={now} />}
          <div className="grid items-start gap-3 xl:grid-cols-2">
            {!loading && (
              <>
                <QueueByHour data={data} server={serverValue} unit={unit} />
                <PeakHours data={data} server={serverValue} onPick={setServer} unit={unit} />
                <PerDay data={data} server={serverValue} unit={unit} now={now} />
              </>
            )}
            <TierShares data={data} server={serverValue} onPick={setServer} />
            <Ratings data={data} server={serverValue} />
            <Legends data={data} server={serverValue} names={names} />
          </div>
          <LegendMonths months={data.legends.months} names={names} />
          <Method data={data} />
        </>
      )}
    </PageShell>
  );
}
