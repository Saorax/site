import { Img, Pill, Tabs, cx, formatNumber } from '../ui';
import { dateText, esportsUrl, relativeDays, teamName, useLatestOfficialWinner, useWhatsOn } from './live';

const regionShort = { ALL: 'Global', NA: 'NA', EU: 'EU', SA: 'SA', SEA: 'SEA', MENA: 'MENA' };

export function Tile({ label, href, linkLabel, className = '', children, error, onRetry, loading }) {
  return (
    <section className={cx('flex min-w-0 flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-3 shadow-sm', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-blue-200">{label}</h2>
        {href && <a href={href} className="-my-2 inline-flex shrink-0 items-center py-2.5 text-xs font-bold text-blue-300 hover:underline">{linkLabel || 'Open'} →</a>}
      </div>
      {error && !loading ? (
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">
          <span>Couldn't load this right now.</span>
          {onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold hover:bg-rose-500/30">Retry</button>}
        </div>
      ) : children}
    </section>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-800/80" />)}
    </div>
  );
}

const initials = (name) => String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export function Face({ src, playerId, name, className = 'h-8 w-8' }) {
  const source = src || (playerId ? esportsUrl(`/players/${playerId}/avatar`) : '');
  return (
    <Img
      src={source}
      alt=""
      className={cx('shrink-0 rounded-full bg-slate-800 object-cover', className)}
      fallback={<span className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white', className)} aria-hidden="true">{initials(name)}</span>}
    />
  );
}

export function RegionLeadersTile({ leaders, mode, onModeChange, className = '' }) {
  return (
    <Tile label="#1 in every region" href={`/pr?mode=${mode}`} linkLabel="Power Rankings" className={className} error={leaders.error} onRetry={leaders.retry} loading={leaders.loading}>
      <Tabs variant="small" label="Format" value={mode} onChange={onModeChange} items={[{ value: '1', label: '1v1' }, { value: '2', label: '2v2' }]} className="mb-2" />
      {leaders.loading && !leaders.rows.length ? <Skeleton rows={6} /> : (
        <ol className="space-y-1">
          {leaders.rows.map((row) => (
            <li key={row.code}>
              {row.player ? (
                <a href={`/esports/player/id/${row.player.playerId}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-800/70">
                  <span className="w-11 shrink-0 text-xs font-bold text-slate-400" title={row.name}>{regionShort[row.code] || row.code}</span>
                  <Face src={row.player.image} playerId={row.player.playerId} name={row.player.name} />
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{row.player.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-300" title="Ranking points">{formatNumber(Math.round(row.player.points * 10) / 10)}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-sm text-slate-500">
                  <span className="w-11 shrink-0 text-xs font-bold">{regionShort[row.code] || row.code}</span>
                  No ranked players yet
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {leaders.dataThrough && <p className="mt-auto pt-3 text-xs text-slate-500">Results through {dateText(leaders.dataThrough)}</p>}
    </Tile>
  );
}

const modeText = (mode) => (Number(mode) === 2 ? '2v2' : Number(mode) === 1 ? '1v1' : '');

export function LatestWinnerTile({ className = '' }) {
  const latest = useLatestOfficialWinner();
  const { event, winner } = latest;
  const members = winner?.members ?? [];
  return (
    <Tile label="Latest official winner" href="/esports/tournaments?official=official&state=complete" linkLabel="Results" className={className} error={latest.error} onRetry={latest.retry} loading={latest.loading}>
      {!event ? <Skeleton rows={2} /> : (
        <a href={`/esports/event/${event.id}`} className="group flex flex-1 flex-col gap-3">
          {members.length > 1 ? (
            <div className="grid min-w-0 gap-1.5">
              {members.map((member, index) => (
                <div key={member.playerId || index} className="flex min-w-0 items-center gap-2">
                  <Face src={member.image} playerId={member.playerId} name={member.name} className="h-9 w-9" />
                  <span className="truncate text-base font-bold text-white group-hover:underline">{member.name}</span>
                </div>
              ))}
              <div className="text-xs text-slate-400">won {modeText(event.game_mode) || 'the event'}{event.entrant_count ? ` · ${formatNumber(event.entrant_count)} teams` : ''}{winner?.prize ? ` · $${Math.round(Number(winner.prize) / Math.max(2, members.length)).toLocaleString('en-US')} each` : ''}</div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex shrink-0">
                {(members.length ? members : [{ name: winner?.name }]).slice(0, 1).map((member, index) => (
                  <Face key={member.playerId || index} src={member.image} playerId={member.playerId} name={member.name} className="h-12 w-12 ring-2 ring-slate-900" />
                ))}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-white group-hover:underline">{winner ? teamName(winner) : 'Loading winner…'}</div>
                <div className="text-xs text-slate-400">won {modeText(event.game_mode) || 'the event'}{event.entrant_count ? ` · ${formatNumber(event.entrant_count)} entrants` : ''}</div>
              </div>
            </div>
          )}
          <div className="min-w-0 border-t border-slate-800 pt-2">
            <div className="line-clamp-2 text-sm font-bold text-slate-200">{event.tournament_name || event.name}</div>
            <div className="mt-0.5 text-xs text-slate-500">{dateText(event.starts_at)}</div>
          </div>
        </a>
      )}
    </Tile>
  );
}

export function NewestLegendTile({ data, className = '' }) {
  const { legend } = data;
  return (
    <Tile label="Newest legend" href="/game/legends" linkLabel="All legends" className={className} error={data.error} onRetry={data.retry} loading={data.loading}>
      {!legend ? <Skeleton rows={2} /> : (
        <a href={legend.href} className="group flex flex-1 items-center gap-3">
          <Img src={legend.image} alt="" className="h-20 w-20 shrink-0 object-contain" fallback={<span className="h-20 w-20 shrink-0 rounded-xl bg-slate-800" />} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-white group-hover:underline">{legend.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {legend.weapons.map((weapon) => (
                <Pill key={weapon.name} tone="slate" icon={<Img src={weapon.icon} alt="" className="h-4 w-4 object-contain" />}>{weapon.name}</Pill>
              ))}
            </div>
            {legend.released && <div className="mt-1 text-xs text-slate-500">Released {dateText(legend.released)}</div>}
          </div>
        </a>
      )}
    </Tile>
  );
}

export function LatestPatchTile({ data, className = '' }) {
  const { patch } = data;
  const counts = patch?.counts ?? {};
  const facts = [
    counts.legendsAdded ? `${counts.legendsAdded} new legend${counts.legendsAdded === 1 ? '' : 's'}` : '',
    counts.mapsAdded ? `${counts.mapsAdded} new map${counts.mapsAdded === 1 ? '' : 's'}` : '',
    counts.balance ? `${counts.balance} balance changes` : '',
    counts.cosmetics ? `${formatNumber(counts.cosmetics)} cosmetic changes` : '',
  ].filter(Boolean);
  return (
    <Tile label="Latest patch" href="/game/patch" linkLabel="Patch History" className={className} error={data.error} onRetry={data.retry} loading={data.loading}>
      {!patch ? <Skeleton rows={2} /> : (
        <div className="flex flex-1 flex-col gap-2">
          <a href={patch.href} className="group min-w-0">
            <div className="text-lg font-bold leading-tight text-white group-hover:underline">Patch {patch.patch}</div>
            <div className="text-xs text-slate-500">{dateText(patch.date)}</div>
            <div className="mt-0.5 text-sm text-slate-300">{patch.official?.title || patch.title}</div>
          </a>
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {facts.map((fact) => <Pill key={fact} tone="blue">{fact}</Pill>)}
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
            <a href={patch.href} className="-my-2 inline-flex py-2.5 font-bold text-blue-300 hover:underline">Every change in {patch.patch} →</a>
            {patch.official?.url && <a href={patch.official.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-200 hover:underline">Official notes ↗</a>}
          </div>
        </div>
      )}
    </Tile>
  );
}

export function EventLine({ tournament, live = false, note }) {
  return (
    <a href={`/esports/tournament/${tournament.id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800">
      {tournament.image
        ? <img src={tournament.image} alt="" loading="lazy" className="h-9 w-16 shrink-0 rounded-md bg-slate-800 object-cover" />
        : <div className="h-9 w-16 shrink-0 rounded-md bg-slate-800" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{tournament.name}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <span className="min-w-0 truncate" title={note || dateText(tournament.starts_at) || undefined}>{note || dateText(tournament.starts_at) || 'Date not set'}</span>
          {live && <Pill tone="emerald">Live now</Pill>}
          {tournament.classification === 'official' && <Pill tone="blue">Official</Pill>}
          {tournament.classification === 'tier1-community' && <Pill tone="amber">Tier 1</Pill>}
        </div>
      </div>
    </a>
  );
}

export function upcomingNote(tournament) {
  const day = dateText(tournament.starts_at);
  return day ? `${day} · ${relativeDays(tournament.starts_at)}` : 'Date not set';
}

export function OnNowTile({ className = '', rows = 5 }) {
  const on = useWhatsOn();
  const live = on.live.slice(0, rows);
  const upcoming = on.upcoming.slice(0, Math.max(2, rows - live.length));
  return (
    <Tile label="On now" href="/esports/tournaments?state=upcoming" linkLabel="Schedule" className={className} error={on.error} onRetry={on.retry} loading={on.loading}>
      {on.loading ? <Skeleton rows={4} /> : (
        <div className="flex flex-1 flex-col gap-1">
          {!on.officialLive && (
            <p className="rounded-lg bg-slate-950/60 px-2 py-1.5 text-sm text-slate-300">
              No official event live
              {on.nextOfficial && <> · next: <a href={`/esports/tournament/${on.nextOfficial.id}`} className="font-bold text-white hover:underline">{on.nextOfficial.name}</a>{on.nextOfficial.starts_at ? ` ${relativeDays(on.nextOfficial.starts_at)}` : ''}</>}
            </p>
          )}
          <div className="-mx-2">
            {live.map((tournament) => <EventLine key={`live-${tournament.id}`} tournament={tournament} live />)}
            {upcoming.map((tournament) => <EventLine key={`up-${tournament.id}`} tournament={tournament} note={upcomingNote(tournament)} />)}
          </div>
          {!live.length && !upcoming.length && <p className="text-sm text-slate-400">Nothing official or Tier 1 on the calendar.</p>}
        </div>
      )}
    </Tile>
  );
}
