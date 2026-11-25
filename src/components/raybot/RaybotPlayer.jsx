import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, ErrorState, Img, LoadingState, PageShell, Pagination, Pill, ScrollX, Section, SelectInput, ShowMore, SkeletonGrid, Tabs, apiUrl, cx, formatNumber, legendHref, useApi, useQueryState, weaponIconUrl, weaponName } from '../ui';
import { MODES, SERVER_ORDER, clanHref, cleanName, dayText, rankedLegendHref, rating, raybotApi, serverName, serverShort, sessionHref, tierTone, timeAgo } from './raybot';
import { Change, LegendIcon, PlayerLink, WinBar, useNow, useWidth } from './parts';

const pct = (wins, games) => (games ? `${((100 * wins) / games).toFixed(1)}%` : '–');
const num = (value) => (value === null || value === undefined ? '–' : formatNumber(value));
const wl = (wins, games) => (wins != null && games != null ? `${formatNumber(wins)}–${formatNumber(games - wins)}` : '–');

function hours(seconds) {
  if (!seconds) return '–';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  return `${formatNumber(Math.round(seconds / 3600))} h`;
}

const timeText = (iso) => {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
};

const shortDay = (iso, now) => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

const modeLabel = (mode) => MODES.find((entry) => entry.value === mode)?.label || mode;

function useLegendInfo() {
  const summary = useApi(apiUrl('/game/legends/summary'));
  return useMemo(() => new Map((Array.isArray(summary.data) ? summary.data : []).map((legend) => {
    const weapons = [legend.weapons?.main, legend.weapons?.secondary].map((weapon) => (weapon ? {
      key: String(weapon.image || '').split('a_WeaponIcon_')[1] || weapon.name,
      name: weaponName(weapon.name),
    } : null));
    return [Number(legend.id), { name: legend.bio?.name?.normal || legend.codeName, weapons }];
  })), [summary.data]);
}

function RefreshButton({ bhid, refresh, onDone }) {
  const [state, setState] = useState({ busy: false, message: '' });
  const now = useNow(5000);
  const waitUntil = refresh?.nextAt ? new Date(refresh.nextAt).getTime() : 0;
  if (!refresh?.available) return null;
  const waiting = waitUntil > now;
  const run = async () => {
    setState({ busy: true, message: '' });
    try {
      const response = await fetch(raybotApi(`/players/${bhid}/refresh`), { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (response.status === 429) {
        setState({ busy: false, message: body?.retryAt ? `Refreshed recently. Try again at ${timeText(body.retryAt)}.` : 'Refreshed recently.' });
        return;
      }
      if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
      onDone(body);
      setState({ busy: false, message: '' });
    } catch (error) {
      setState({ busy: false, message: error.message || "Couldn't refresh." });
    }
  };
  return (
    <div className="flex flex-col items-start gap-1 xl:items-end">
      <button
        type="button"
        onClick={run}
        disabled={state.busy || waiting}
        className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.busy ? 'Refreshing…' : 'Refresh from the Brawlhalla API'}
      </button>
      {(state.message || waiting) && <span className="text-xs text-slate-400">{state.message || `Next refresh at ${timeText(refresh.nextAt)}`}</span>}
    </div>
  );
}

const TIER_ACCENT = {
  violet: 'border-violet-500/40 from-violet-500/15',
  sky: 'border-sky-500/40 from-sky-500/15',
  blue: 'border-blue-500/40 from-blue-500/15',
  amber: 'border-amber-500/40 from-amber-500/15',
  slate: 'border-slate-700 from-slate-500/10',
};

function bestLegendOf(legends) {
  const rated = legends.filter((legend) => legend.rating > 0);
  const pool = rated.length ? rated : legends;
  const key = rated.length ? 'rating' : 'xp';
  return pool.reduce((best, legend) => (!best || (legend[key] ?? 0) > (best[key] ?? 0) ? legend : best), null);
}

function HeadStat({ label, value, note, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex min-w-0 items-center gap-2 text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</div>
      {children}
      {note && <div className="truncate text-xs text-slate-400">{note}</div>}
    </div>
  );
}

function Hero({ data, info, onRefreshed, now }) {
  const [allNames, setAllNames] = useState(false);
  const names = data.names || [];
  const shown = allNames ? names : names.slice(0, 4);
  const ranked = data.ranked;
  const tone = tierTone(ranked?.tier);
  const best = bestLegendOf(data.legends || []);
  const bestName = best ? info.get(best.legendId)?.name : null;
  const meta = [
    `Brawlhalla ID ${data.bhid}`,
    data.region && serverName(data.region),
    data.live ? `From the Brawlhalla API ${timeAgo(data.live.fetchedAt, now)}` : data.savedOn && `Profile saved ${dayText(`${data.savedOn}T12:00:00Z`)}`,
  ].filter(Boolean).join(' · ');
  return (
    <section className={cx('rounded-2xl border bg-gradient-to-br to-slate-900 to-60% p-3', TIER_ACCENT[tone] || TIER_ACCENT.slate)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-3 xl:flex-1">
          {bestName ? <LegendIcon name={bestName} className="h-16 w-16 rounded-xl sm:h-20 sm:w-20" link /> : null}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-white sm:text-3xl">{cleanName(data.name)}</h1>
            <div className="text-sm text-slate-400">{meta}</div>
            {(data.clan || names.length > 0) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                {data.clan && (
                  <a
                    href={clanHref(data.clan.clanId)}
                    className="font-bold text-blue-300 hover:underline"
                    title={[data.clan.xp != null && `${formatNumber(data.clan.xp)} clan XP given`, data.clan.joinedAt && `joined ${dayText(data.clan.joinedAt)}`].filter(Boolean).join(', ') || undefined}
                  >
                    {cleanName(data.clan.name)}
                    {data.clan.rank && <span className="ml-1 font-normal text-slate-400">{data.clan.rank}</span>}
                  </a>
                )}
                {names.length > 0 && (
                  <span className="min-w-0">
                    <span className="text-slate-400">Was </span>
                    {shown.map((entry, index) => (
                      <span key={entry.name} title={entry.lastSeen ? `Last saved ${dayText(`${entry.lastSeen}T12:00:00Z`)}` : undefined}>
                        {index > 0 && ', '}
                        {cleanName(entry.name)}
                      </span>
                    ))}
                    {names.length > shown.length && (
                      <button type="button" onClick={() => setAllNames(true)} className="ml-1 text-xs font-bold text-blue-300 hover:underline">+{names.length - shown.length} more</button>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {ranked ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:w-[44rem] xl:shrink-0">
            <HeadStat label="1v1 rating" value={rating(ranked.rating)} note={[`Peak ${rating(ranked.peakRating)}`, data.glory?.resetRating ? `resets to ${rating(data.glory.resetRating)}` : null].filter(Boolean).join(' · ')}>
              {ranked.tier && <Pill tone={tone} className="mt-0.5">{ranked.tier}</Pill>}
            </HeadStat>
            <HeadStat
              label="Rank"
              value={ranked.rank ? (ranked.region ? <a href={`/raybot/rankings?server=${ranked.region}&q=${data.bhid}`} className="hover:text-blue-300 hover:underline">#{formatNumber(ranked.rank)}</a> : `#${formatNumber(ranked.rank)}`) : '–'}
              note={ranked.rank ? serverName(ranked.region) : 'Not on a top 500'}
            />
            <HeadStat label="W–L" value={<span className="truncate">{wl(ranked.wins, ranked.games)}</span>} note={`${pct(ranked.wins, ranked.games)} · ${num(ranked.games)} games`}>
              <WinBar wins={ranked.wins} games={ranked.games} className="mt-1" />
            </HeadStat>
            <HeadStat
              label="Glory"
              value={data.glory ? <a href={`/raybot/glory?id=${data.bhid}`} className="hover:text-blue-300 hover:underline" title="Raybot's /glory formula, from season wins and the best peak of 1v1 and 2v2">{formatNumber(data.glory.total)}</a> : '–'}
              note={data.glory ? `${formatNumber(data.glory.fromWins)} wins + ${formatNumber(data.glory.fromPeak)} ${data.glory.peakMode} peak` : 'Season estimate'}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400 xl:w-[44rem]">No ranked 1v1 games saved this season.</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{ranked ? `1v1 from ${sourceNote(ranked, now).replace(/^./, (letter) => letter.toLowerCase())}` : ''}</span>
        <RefreshButton bhid={data.bhid} refresh={data.refresh} onDone={onRefreshed} />
      </div>
    </section>
  );
}

function sourceNote(ranked, now) {
  if (!ranked) return '';
  if (ranked.source === 'queue') return `Top 500, ${timeAgo(ranked.seenAt, now)}`;
  if (ranked.source === 'live') return `Brawlhalla API, ${timeAgo(ranked.seenAt, now)}`;
  return ranked.seenAt ? `Saved ${dayText(`${ranked.seenAt}T12:00:00Z`)}` : '';
}

function Stat({ label, value, note, title }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-lg font-bold tabular-nums text-white">{value}</div>
      {note && <div className="truncate text-xs text-slate-400">{note}</div>}
    </div>
  );
}

function Account({ account }) {
  if (!account) return null;
  const toNext = account.xpForLevel ? `${formatNumber(account.xpForLevel - account.xpIntoLevel)} XP to ${account.level + 1}` : '';
  return (
    <Section title="Account" headingAs="h2" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="Level" value={num(account.level)} note={toNext} />
        <Stat label="XP" value={num(account.xp)} />
        <Stat label="Games" value={num(account.games)} note={account.wins != null ? `${pct(account.wins, account.games)} won` : ''} />
        <Stat label="Time played" value={hours(account.playTime)} />
        <Stat label="KOs" value={num(account.kos)} note={account.falls != null ? `${num(account.falls)} falls` : ''} />
        <Stat label="Damage dealt" value={num(account.damageDealt)} note={account.damageTaken != null ? `${num(account.damageTaken)} taken` : ''} />
        <Stat label="Legend levels" value={num(account.legendLevels)} />
      </div>
    </Section>
  );
}

function TopLegends({ legends, info }) {
  const top = useMemo(() => [...legends].filter((legend) => legend.xp > 0).sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0)).slice(0, 6), [legends]);
  if (!top.length) return null;
  return (
    <Section title="Most played legends" headingAs="h2" bodyClassName="p-2" actions={<a href="#legends" className="text-xs font-bold text-blue-300 hover:underline">All legends</a>}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {top.map((legend) => {
          const name = info.get(legend.legendId)?.name || `Legend ${legend.legendId}`;
          return (
            <div key={legend.legendId} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <LegendIcon name={info.get(legend.legendId)?.name} className="h-12 w-12 rounded-lg" />
                <div className="min-w-0">
                  <a href={legendHref(name)} className="block truncate font-bold text-white hover:text-blue-300">{name}</a>
                  <div className="truncate text-xs text-slate-400">Level {num(legend.level)} · {hours(legend.matchTime)}</div>
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs text-slate-400">
                  <span>{num(legend.games)} games</span>
                  <span className="font-bold text-slate-200">{pct(legend.wins, legend.games)}</span>
                </div>
                <WinBar wins={legend.wins} games={legend.games} className="mt-1" />
              </div>
              <div className="mt-auto flex items-baseline justify-between border-t border-slate-800 pt-1.5 text-xs text-slate-400">
                <span>Rating</span>
                {legend.rating > 0 ? (
                  <a href={`${rankedLegendHref(name)}?sort=rating`} className="font-bold tabular-nums text-white hover:text-blue-300 hover:underline" title={`${name} rating leaderboard`}>
                    {rating(legend.rating)}
                    {legend.peakAllTime ? <span className="ml-1 font-normal text-slate-400">best {rating(legend.peakAllTime)}</span> : null}
                  </a>
                ) : <span className="text-slate-500">–</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Teams({ teams, savedOn, live }) {
  return (
    <Section title="2v2 teams" count={teams.length || undefined} headingAs="h2" actions={<span className="text-xs text-slate-400">{live ? 'Brawlhalla API' : savedOn ? `Saved ${dayText(`${savedOn}T12:00:00Z`)}` : ''}</span>} padded={false}>
      {teams.length ? (
        <ScrollX>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="px-2 py-1 text-left font-bold">Teammate</th>
                <th className="px-2 py-1 text-right font-bold">Rating</th>
                <th className="px-2 py-1 text-right font-bold">Peak</th>
                <th className="px-2 py-1 text-right font-bold">W–L</th>
                <th className="px-2 py-1 text-right font-bold">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {teams.map((team) => (
                <tr key={team.teamId}>
                  <td className="max-w-[14rem] px-2 py-1">
                    <PlayerLink bhid={team.teammateId} className="block truncate font-bold text-white">{team.teammateName ? cleanName(team.teammateName) : team.teammateId ? `ID ${team.teammateId}` : 'Unknown teammate'}</PlayerLink>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">
                    {team.tier && <Pill tone={tierTone(team.tier)} className="mr-1.5">{team.tier}</Pill>}
                    <span className="font-bold text-white">{rating(team.rating)}</span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-300">{rating(team.peakRating)}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-300">{wl(team.wins, team.games)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-300">{pct(team.wins, team.games)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      ) : <p className="px-3 py-2 text-sm text-slate-400">No 2v2 teams saved this season.</p>}
    </Section>
  );
}

const LINE_TONES = ['stroke-blue-400', 'stroke-emerald-400', 'stroke-amber-300', 'stroke-violet-400'];
const DOT_TONES = ['fill-blue-400', 'fill-emerald-400', 'fill-amber-300', 'fill-violet-400'];

function RatingChart({ series }) {
  const [ref, width] = useWidth(720);
  const points = series.flatMap((line) => line.points);
  if (points.length < 2) return <div ref={ref} className="w-full"><p className="px-1 py-6 text-center text-sm text-slate-400">Not enough games saved for a chart.</p></div>;
  const height = 240;
  const times = points.map((point) => point.time);
  const values = points.map((point) => point.rating);
  const first = Math.min(...times);
  const lastTime = Math.max(...times);
  const low = Math.floor((Math.min(...values) - 20) / 50) * 50;
  const high = Math.ceil((Math.max(...values) + 20) / 50) * 50;
  const x = (time) => 44 + ((time - first) / Math.max(1, lastTime - first)) * (width - 60);
  const y = (value) => 12 + ((high - value) / Math.max(1, high - low)) * (height - 40);
  const ticks = [low, Math.round((low + high) / 2 / 10) * 10, high];
  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-full" role="img" aria-label="Rating over time">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1="44" x2={width - 16} y1={y(tick)} y2={y(tick)} className="stroke-slate-800" strokeDasharray="4 4" />
            <text x="4" y={y(tick) + 4} className="fill-slate-500 text-[11px] font-bold">{tick}</text>
          </g>
        ))}
        {series.map((line, index) => {
          const sorted = [...line.points].sort((a, b) => a.time - b.time);
          const path = sorted.map((point, at) => `${at ? 'L' : 'M'}${x(point.time).toFixed(1)},${y(point.rating).toFixed(1)}`).join(' ');
          return (
            <g key={line.key}>
              {line.dashed ? null : <path d={path} fill="none" className={LINE_TONES[index % LINE_TONES.length]} strokeWidth="2" strokeLinejoin="round" />}
              {sorted.map((point) => (
                <circle key={point.key} cx={x(point.time)} cy={y(point.rating)} r={line.dashed ? 4 : 2.5} className={line.dashed ? 'fill-slate-950 stroke-slate-300' : DOT_TONES[index % DOT_TONES.length]} strokeWidth={line.dashed ? 1.5 : 0}>
                  <title>{`${line.label}: ${point.rating} on ${dayText(point.time)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        <text x="44" y={height - 6} className="fill-slate-500 text-[11px] font-bold">{dayText(first)}</text>
        <text x={width - 16} y={height - 6} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">{dayText(lastTime)}</text>
      </svg>
    </div>
  );
}

function RatingHistory({ data, sessions }) {
  const modes = MODES.filter((mode) => sessions.some((session) => session.gameMode === mode.value) || (mode.value === '1v1' && data.ratingHistory?.length));
  const [modeParam, setMode] = useQueryState('chart', '1v1');
  const mode = modes.some((entry) => entry.value === modeParam) ? modeParam : modes[0]?.value;
  const teams = useMemo(() => {
    const counts = new Map();
    for (const session of sessions) if (session.gameMode === '2v2') counts.set(session.teamId, (counts.get(session.teamId) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([teamId]) => {
      const sample = sessions.find((session) => session.teamId === teamId);
      const team = data.teams.find((entry) => entry.teamId === teamId);
      return { value: String(teamId), label: team?.teammateName ? cleanName(team.teammateName) : sample?.teammateId ? `ID ${sample.teammateId}` : 'Unknown teammate' };
    });
  }, [sessions, data.teams]);
  const [teamParam, setTeam] = useState('');
  const team = teams.some((entry) => entry.value === teamParam) ? teamParam : teams[0]?.value;
  const series = useMemo(() => {
    const picked = sessions.filter((session) => session.gameMode === mode && session.rating && (mode !== '2v2' || String(session.teamId) === team));
    const byServer = new Map();
    for (const session of picked) {
      const list = byServer.get(session.region) || [];
      list.push({ key: session.sessionId, time: new Date(session.lastGameAt).getTime(), rating: session.rating });
      byServer.set(session.region, list);
    }
    const lines = SERVER_ORDER.filter((code) => byServer.has(code)).map((code) => ({ key: code, label: serverShort(code), points: byServer.get(code) }));
    if (mode === '1v1' && data.ratingHistory?.length) {
      const start = lines.length ? Math.min(...lines.flatMap((line) => line.points.map((point) => point.time))) : Infinity;
      const saved = data.ratingHistory.map((point) => ({ key: point.date, time: new Date(`${point.date}T12:00:00Z`).getTime(), rating: point.rating })).filter((point) => point.time < start);
      if (saved.length) lines.push({ key: 'saved', label: 'Saved profile', points: saved, dashed: true });
    }
    return lines;
  }, [sessions, mode, team, data.ratingHistory]);
  if (!modes.length) return null;
  return (
    <Section
      title="Rating over time"
      headingAs="h2"
      actions={(
        <>
          {modes.length > 1 && <Tabs variant="small" label="Ranked mode" value={mode} onChange={setMode} items={modes} />}
          {mode === '2v2' && teams.length > 1 && <SelectInput label="Team" value={team} onChange={setTeam} options={teams} />}
        </>
      )}
      bodyClassName="p-2"
    >
      <RatingChart series={series} />
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-slate-400">
          {series.map((line, index) => (
            <span key={line.key} className="inline-flex items-center gap-1">
              <span className={cx('inline-block h-2 w-2 rounded-full', line.dashed ? 'border border-slate-300' : DOT_TONES[index % DOT_TONES.length].replace('fill-', 'bg-'))} />
              {line.label}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MS = 24 * 60 * 60 * 1000;

function Activity({ sessions, now }) {
  const stats = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 60 }, (_, index) => ({ time: today.getTime() - (59 - index) * DAY_MS, sessions: 0, games: 0 }));
    for (const session of sessions) {
      const start = new Date(session.startedAt || session.lastGameAt);
      if (!Number.isFinite(start.getTime())) continue;
      grid[(start.getDay() + 6) % 7][start.getHours()] += 1;
      const day = new Date(start);
      day.setHours(0, 0, 0, 0);
      const index = Math.round((day.getTime() - days[0].time) / DAY_MS);
      if (index >= 0 && index < days.length) {
        days[index].sessions += 1;
        days[index].games += session.games || 0;
      }
    }
    return { grid, days, peak: Math.max(1, ...grid.flat()), busiest: Math.max(1, ...days.map((day) => day.sessions)) };
  }, [sessions, now]);
  if (!sessions.length) return null;
  const oldest = sessions[sessions.length - 1]?.lastGameAt;
  return (
    <Section title="When they play" headingAs="h2" actions={<span className="text-xs text-slate-400">Your time zone</span>} bodyClassName="space-y-3 p-2">
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2 px-1 text-xs text-slate-400">
          <span className="font-bold uppercase tracking-wide">Sessions per day</span>
          <span>Last 60 days</span>
        </div>
        <div className="flex h-20 items-end gap-px" role="img" aria-label="Sessions per day over the last 60 days">
          {stats.days.map((day) => (
            <div key={day.time} className="flex h-full flex-1 items-end" title={`${dayText(day.time)}: ${day.sessions} sessions${day.games ? `, ${day.games} games` : ''}`}>
              <div className={cx('w-full rounded-t-sm', day.sessions ? 'bg-emerald-400/80' : 'bg-slate-800')} style={{ height: day.sessions ? `${Math.max(8, (100 * day.sessions) / stats.busiest)}%` : '2px' }} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Session starts by hour</div>
        <ScrollX>
          <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-px text-[10px]">
            <thead>
              <tr>
                <th className="w-8" />
                {Array.from({ length: 24 }, (_, hour) => <th key={hour} className="font-normal text-slate-500">{hour % 3 === 0 ? hour : ''}</th>)}
              </tr>
            </thead>
            <tbody>
              {stats.grid.map((row, day) => (
                <tr key={DAYS[day]}>
                  <th className="pr-1 text-left font-bold text-slate-400">{DAYS[day]}</th>
                  {row.map((value, hour) => (
                    <td key={hour} title={`${DAYS[day]} ${hour}:00: ${value} sessions`} className="h-4 rounded-sm" style={{ backgroundColor: value ? `rgba(52, 211, 153, ${0.15 + (0.85 * value) / stats.peak})` : 'rgb(30, 41, 59)' }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </div>
      <p className="px-1 text-xs text-slate-400">From {formatNumber(sessions.length)} top 500 sessions since {dayText(oldest)}.</p>
    </Section>
  );
}

function Sessions({ sessions, teams, now }) {
  const [shown, setShown] = useState(25);
  const mates = useMemo(() => new Map(teams.map((team) => [team.teamId, team.teammateName])), [teams]);
  if (!sessions.length) return null;
  return (
    <Section title="Recent sessions" count={formatNumber(sessions.length)} headingAs="h2" padded={false}>
      <ScrollX>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="px-2 py-1 text-left font-bold">Played</th>
              <th className="px-2 py-1 text-left font-bold">Queue</th>
              <th className="hidden px-2 py-1 text-right font-bold sm:table-cell">Games</th>
              <th className="px-2 py-1 text-right font-bold">W–L</th>
              <th className="px-2 py-1 text-right font-bold">Change</th>
              <th className="px-2 py-1 text-right font-bold">Rating</th>
              <th className="hidden px-2 py-1 text-right font-bold sm:table-cell">Rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sessions.slice(0, shown).map((session) => {
              const mate = session.gameMode === '2v2' ? mates.get(session.teamId) : null;
              return (
                <tr key={session.sessionId}>
                  <td className="whitespace-nowrap px-2 py-1">
                    <a href={sessionHref(session.sessionId)} className="text-blue-300 hover:underline">{session.active ? `Now, ${timeAgo(session.lastGameAt, now)}` : shortDay(session.lastGameAt, now)}</a>
                    {!session.active && <span className="block text-xs text-slate-500 sm:ml-1.5 sm:inline">{timeText(session.startedAt)}</span>}
                  </td>
                  <td className="max-w-[16rem] px-2 py-1 align-top sm:align-middle">
                    <span className="whitespace-nowrap font-bold text-white" title={serverName(session.region)}>{serverShort(session.region)} {modeLabel(session.gameMode)}</span>
                    {session.gameMode === '2v2' && (
                      <PlayerLink bhid={session.teammateId} className="block truncate text-xs text-slate-400 sm:ml-1.5 sm:inline">with {mate ? cleanName(mate) : session.teammateId ? `ID ${session.teammateId}` : 'unknown'}</PlayerLink>
                    )}
                  </td>
                  <td className="hidden px-2 py-1 text-right tabular-nums text-slate-300 sm:table-cell">{num(session.games)}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-300">{session.games != null && session.wins != null ? wl(session.wins, session.games) : '–'}</td>
                  <td className="px-2 py-1 text-right font-bold tabular-nums"><Change value={session.ratingChange} /></td>
                  <td className="px-2 py-1 text-right font-bold tabular-nums text-white">{rating(session.rating)}</td>
                  <td className="hidden px-2 py-1 text-right tabular-nums text-slate-400 sm:table-cell">{session.rank ? `#${session.rank}` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
      <ShowMore shown={Math.min(shown, sessions.length)} total={sessions.length} onMore={setShown} step={25} />
    </Section>
  );
}

function SortHeader({ column, sort, onSort, align = 'right' }) {
  const active = sort.key === column.key;
  return (
    <th className={cx('px-2 py-1 font-bold', align === 'left' ? 'text-left' : 'text-right')} aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined} title={column.title}>
      <button type="button" onClick={() => onSort(column.key)} className={cx('inline-flex items-center gap-0.5 hover:text-white', active && 'text-white')}>
        {column.label}
        <span aria-hidden="true" className="text-[9px]">{active ? (sort.desc ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  );
}

function useSort(initial) {
  const [sort, setSort] = useState({ key: initial, desc: true });
  const onSort = (key) => setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== 'name' }));
  return [sort, onSort];
}

const sortRows = (rows, columns, sort) => {
  const column = columns.find((entry) => entry.key === sort.key) || columns[0];
  return [...rows].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    if (typeof left === 'string' || typeof right === 'string') {
      const order = String(left ?? '').localeCompare(String(right ?? ''));
      return sort.desc ? -order : order;
    }
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return sort.desc ? right - left : left - right;
  });
};

const winRate = (row) => (row.games ? row.wins / row.games : null);

const LEGEND_COLUMNS = [
  { key: 'name', label: 'Legend', value: (row) => row.name },
  { key: 'level', label: 'Level', value: (row) => row.level },
  { key: 'xp', label: 'XP', value: (row) => row.xp },
  { key: 'games', label: 'Games', value: (row) => row.games },
  { key: 'winrate', label: 'Win %', value: winRate },
  { key: 'kos', label: 'KOs', value: (row) => row.kos },
  { key: 'damage', label: 'Damage', value: (row) => row.damageDealt },
  { key: 'time', label: 'Time', value: (row) => row.matchTime },
  { key: 'rating', label: 'Rating', value: (row) => row.rating, title: 'Ranked rating on this legend this season' },
  { key: 'peak', label: 'Peak', value: (row) => row.peakRating, title: 'Season peak on this legend' },
  { key: 'best', label: 'Best', value: (row) => row.peakAllTime, title: 'Best peak on this legend in any season' },
];

const PER_PAGE = 20;

function Legends({ legends, info, updatedAt }) {
  const [sort, onSort] = useSort('xp');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => legends.map((legend) => ({ ...legend, name: info.get(legend.legendId)?.name || `Legend ${legend.legendId}` })), [legends, info]);
  const sorted = useMemo(() => sortRows(rows, LEGEND_COLUMNS, sort), [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const current = Math.min(page, pages);
  const changeSort = (key) => {
    onSort(key);
    setPage(1);
  };
  if (!legends.length) return null;
  return (
    <Section id="legends" title="Legends" count={legends.length} headingAs="h2" actions={updatedAt ? <span className="text-xs text-slate-400">Saved {dayText(updatedAt)}</span> : null} padded={false}>
      <ScrollX>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              {LEGEND_COLUMNS.map((column) => <SortHeader key={column.key} column={column} sort={sort} onSort={changeSort} align={column.key === 'name' ? 'left' : 'right'} />)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE).map((row) => (
              <tr key={row.legendId}>
                <td className="sticky left-0 bg-slate-900 px-2 py-1">
                  <a href={legendHref(row.name)} className="flex items-center gap-2 font-bold text-white hover:text-blue-300">
                    <LegendIcon name={info.get(row.legendId)?.name} className="h-6 w-6" />
                    <span className="whitespace-nowrap">{row.name}</span>
                  </a>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{num(row.level)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{num(row.xp)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{num(row.games)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300" title={wl(row.wins, row.games)}>{pct(row.wins, row.games)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{num(row.kos)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{num(row.damageDealt)}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-300">{hours(row.matchTime)}</td>
                <td className="px-2 py-1 text-right font-bold tabular-nums text-white">
                  {row.rating > 0 && info.get(row.legendId)?.name ? <a href={`${rankedLegendHref(row.name)}?sort=rating`} className="hover:text-blue-300 hover:underline" title={`${row.name} rating leaderboard`}>{rating(row.rating)}</a> : rating(row.rating)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{rating(row.peakRating)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-300">{rating(row.peakAllTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      <Pagination page={current} totalPages={pages} onChange={setPage} />
    </Section>
  );
}

const WEAPON_METRICS = [
  { value: 'time', label: 'Time held', get: (row) => row.timeHeld, show: (row) => hours(row.timeHeld) },
  { value: 'games', label: 'Games', get: (row) => row.games, show: (row) => num(row.games), title: "A legend's games count for both of its weapons" },
  { value: 'kos', label: 'KOs', get: (row) => row.kos, show: (row) => num(row.kos) },
  { value: 'damage', label: 'Damage', get: (row) => row.damage, show: (row) => num(row.damage) },
  { value: 'winrate', label: 'Win %', get: (row) => winRate(row), show: (row) => pct(row.wins, row.games), max: 1 },
];

function Weapons({ legends, info }) {
  const [metric, setMetric] = useState('time');
  const rows = useMemo(() => {
    const weapons = new Map();
    for (const legend of legends) {
      const known = info.get(legend.legendId)?.weapons || [];
      [legend.weaponOne, legend.weaponTwo].forEach((stats, index) => {
        const weapon = known[index];
        if (!weapon || !stats) return;
        const row = weapons.get(weapon.name) || { name: weapon.name, icon: weapon.key, legends: 0, games: 0, wins: 0, kos: 0, damage: 0, timeHeld: 0 };
        row.legends += (legend.games || 0) > 0 ? 1 : 0;
        row.games += legend.games || 0;
        row.wins += legend.wins || 0;
        row.kos += stats.kos;
        row.damage += stats.damage;
        row.timeHeld += stats.timeHeld;
        weapons.set(weapon.name, row);
      });
    }
    return [...weapons.values()].filter((row) => row.games > 0 || row.timeHeld > 0);
  }, [legends, info]);
  const picked = WEAPON_METRICS.find((entry) => entry.value === metric) || WEAPON_METRICS[0];
  const sorted = useMemo(() => [...rows].sort((a, b) => (picked.get(b) ?? -1) - (picked.get(a) ?? -1)), [rows, picked]);
  const max = picked.max ?? Math.max(1, ...rows.map((row) => picked.get(row) ?? 0));
  if (!rows.length) return null;
  return (
    <Section
      id="weapons"
      title="Weapons"
      count={rows.length}
      headingAs="h2"
      bodyClassName="p-2"
      actions={<Tabs variant="small" label="Weapon stat" value={picked.value} onChange={setMetric} items={WEAPON_METRICS.map(({ value, label, title }) => ({ value, label, title }))} />}
    >
      <div className="grid gap-1">
        {sorted.map((row) => {
          const value = picked.get(row) ?? 0;
          return (
            <a
              key={row.name}
              href={`/game/weapons?weapon=${encodeURIComponent(row.name.replace(/\s+/g, ''))}`}
              className="group grid grid-cols-[1.75rem_minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-800/60"
              title={`${row.name}: ${row.legends} legends, ${num(row.games)} games, ${pct(row.wins, row.games)} won, ${num(row.kos)} KOs, ${num(row.damage)} damage, ${hours(row.timeHeld)} held`}
            >
              <Img src={weaponIconUrl(row.icon)} alt="" className="h-7 w-7 object-contain" />
              <span className="truncate text-sm font-bold text-white group-hover:text-blue-300">{row.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-800">
                <span className="block h-full rounded-full bg-blue-400/80" style={{ width: `${Math.max(2, (100 * value) / max)}%` }} />
              </span>
              <span className="w-16 text-right text-sm tabular-nums text-slate-200">{picked.show(row)}</span>
            </a>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-xs text-slate-400">A legend's games and wins count for both of its weapons.</p>
    </Section>
  );
}

function Missing({ error, bhid, onRetry }) {
  const message = error?.message || '';
  if (/private/i.test(message)) {
    return <EmptyState title="This profile is private">The player turned on Private Profile in Raybot.</EmptyState>;
  }
  if (/^No Raybot data/i.test(message)) {
    return (
      <EmptyState title="No saved stats" action={<a href="/raybot" className="font-bold text-blue-300 hover:underline">Search Raybot players</a>}>
        Raybot hasn't saved Brawlhalla ID {bhid}.
      </EmptyState>
    );
  }
  return <ErrorState message="Couldn't load this player." detail={error} onRetry={onRetry} />;
}

export default function RaybotPlayer({ bhid }) {
  const profile = useApi(raybotApi(`/players/${bhid}/profile`));
  const activity = useApi(raybotApi(`/players/${bhid}/activity`));
  const [fresh, setFresh] = useState(null);
  const info = useLegendInfo();
  const now = useNow();
  const data = fresh || profile.data;
  const sessions = activity.data?.sessions || [];
  useEffect(() => {
    if (data?.name) document.title = `${cleanName(data.name)}: Brawlhalla Ranked Stats`;
  }, [data?.name]);

  if (!data) {
    return (
      <PageShell>
        {profile.error ? <Missing error={profile.error} bhid={bhid} onRetry={profile.retry} /> : (
          <>
            <LoadingState label="Loading player…" />
            <SkeletonGrid count={3} className="grid-cols-1 md:grid-cols-2 2xl:grid-cols-3" tileClassName="h-40" />
          </>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Hero data={data} info={info} onRefreshed={setFresh} now={now} />
      <Account account={data.account} />
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <div className="grid min-w-0 content-start gap-3">
          {activity.error && !activity.data ? (
            <ErrorState message="Couldn't load ranked sessions." detail={activity.error} onRetry={activity.retry} />
          ) : activity.loading && !activity.data ? (
            <Card><LoadingState inline label="Loading sessions…" /></Card>
          ) : (
            <>
              <RatingHistory data={data} sessions={sessions} />
              <Activity sessions={sessions} now={now} />
            </>
          )}
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <Teams teams={data.teams || []} savedOn={data.teamsSavedOn} live={Boolean(data.live)} />
          <Sessions sessions={sessions} teams={data.teams || []} now={now} />
        </div>
      </div>
      <TopLegends legends={data.legends || []} info={info} />
      <div className="grid items-start gap-3 2xl:grid-cols-3">
        <div className="min-w-0 2xl:col-span-2">
          <Legends legends={data.legends || []} info={info} updatedAt={data.legendsUpdatedAt} />
        </div>
        <Weapons legends={data.legends || []} info={info} />
      </div>
      {data.live && <p className="px-1 text-xs text-slate-400">Data from the Brawlhalla API, fetched {timeAgo(data.live.fetchedAt, now)}.</p>}
    </PageShell>
  );
}
