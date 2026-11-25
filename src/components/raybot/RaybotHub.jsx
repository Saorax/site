import { useEffect, useState } from 'react';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, Pill, SearchInput, Section, SkeletonGrid, Tabs, cx, formatNumber, useApi, useDebounced, useQueryState } from '../ui';
import { sectionByKey } from '../../data/sections';
import { ToolCard, sectionTones } from '../home/ToolCards';
import { BOT_COMMANDS, MODES, RAYBOT_INVITE, SERVER_ORDER, clanHref, cleanName, dayText, rankedFacts, rankedPlayerHref, rating, raybotApi, serverName, serverShort, sessionHref, tierTone, timeAgo } from './raybot';
import { Fact, LegendIcon, PlayerLink, useLegendNames, useNow } from './parts';

function DetailError({ error, onRetry, missing }) {
  const message = error?.message || '';
  if (/private/i.test(message)) return <p className="text-sm text-slate-400">This profile is private.</p>;
  if (/^No Raybot data/i.test(message)) return <p className="text-sm text-slate-400">{missing}</p>;
  return <ErrorState message="Couldn't load this." detail={error} onRetry={onRetry} />;
}

function PlayerDetail({ bhid }) {
  const detail = useApi(raybotApi(`/players/${bhid}`));
  if (detail.loading && !detail.data) return <LoadingState inline />;
  if (detail.error) return <DetailError error={detail.error} onRetry={detail.retry} missing="Raybot has no saved stats for this Brawlhalla ID." />;
  const snapshot = detail.data?.stats?.at(-1);
  const ranked = snapshot?.ranked || {};
  const totals = snapshot?.totals || {};
  const losses = ranked.games != null && ranked.wins != null ? ranked.games - ranked.wins : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="1v1 rating" value={rating(ranked.rating)} note={ranked.tier} />
        <Fact label="1v1 peak" value={rating(ranked.peak_rating)} />
        <Fact label="1v1 W–L" value={ranked.wins != null ? `${formatNumber(ranked.wins)}–${formatNumber(losses)}` : '–'} />
        <Fact label="All games" value={totals.games != null ? formatNumber(totals.games) : '–'} note={totals.wins != null ? `${formatNumber(totals.wins)} wins` : ''} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{snapshot?.date ? `Saved ${snapshot.date}` : 'No saved stats'}</span>
        <a href={rankedPlayerHref(bhid)} className="font-bold text-blue-300 hover:underline">Full profile</a>
      </div>
    </div>
  );
}

function ClanDetail({ clanId }) {
  const detail = useApi(raybotApi(`/clans/${clanId}`));
  if (detail.loading && !detail.data) return <LoadingState inline />;
  if (detail.error) return <DetailError error={detail.error} onRetry={detail.retry} missing="Raybot has no saved data for this clan." />;
  const clan = detail.data || {};
  const facts = [
    clan.lifetimeXp != null && ['Lifetime XP', formatNumber(clan.lifetimeXp)],
    clan.xp != null && ['XP', formatNumber(clan.xp)],
    clan.memberCount > 0 && ['Members', formatNumber(clan.memberCount)],
    clan.createdDate && ['Created', dayText(clan.createdDate * 1000)],
  ].filter(Boolean);
  return (
    <div className="space-y-2">
      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2 text-xs text-slate-400">
        <div>
          {clan.pastNames?.length > 0 && <div>Was {clan.pastNames.map(cleanName).join(', ')}</div>}
          {clan.updatedAt && <div>Saved {dayText(clan.updatedAt)}</div>}
        </div>
        <a href={clanHref(clanId)} className="font-bold text-blue-300 hover:underline">Clan page</a>
      </div>
    </div>
  );
}

function ResultRow({ title, sub, id, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/60">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-800/60">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-white">{title}</span>
          {sub && <span className="block truncate text-xs text-slate-400">{sub}</span>}
        </span>
        <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 sm:inline">{id}</span>
        <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-slate-300">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="border-t border-slate-800 p-2">{children}</div>}
    </li>
  );
}

const pastNames = (player, current) => {
  const seen = new Set([current]);
  const matched = player.match === 'past name' ? [player.matchedName] : [];
  return [...matched, ...(player.names || []).slice().reverse()].map(cleanName).filter((name) => name && !seen.has(name) && seen.add(name)).slice(0, 3);
};

function ResultList({ title, state, empty, children }) {
  return (
    <div className="min-w-0">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h2>
      {state.loading && !state.data ? <LoadingState inline /> : state.error ? (
        <ErrorState message="Search failed." detail={state.error} onRetry={state.retry} />
      ) : children.length ? <ul className="space-y-1">{children}</ul> : <p className="text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

function RaybotSearch() {
  const [query, setQuery] = useQueryState('q', '');
  const text = useDebounced(query.replace(/\s+/g, ' ').trim(), 250);
  const isId = /^\d{3,12}$/.test(text);
  const ready = text.length >= 2;
  const legends = useLegendNames();
  const players = useApi(ready ? raybotApi(`/players?search=${encodeURIComponent(text)}&limit=10`) : '', { keepData: false });
  const clans = useApi(ready && !isId ? raybotApi(`/clans?search=${encodeURIComponent(text)}&limit=8`) : '', { keepData: false });
  const found = players.data || [];
  const playerRows = isId && players.data && !found.some((player) => player.bhid === Number(text)) ? [{ bhid: Number(text), name: '', names: [], match: 'id' }, ...found] : found;
  return (
    <div className="space-y-2">
      <SearchInput value={query} onChange={setQuery} placeholder="Player or clan name, or Brawlhalla ID" label="Search Raybot players and clans" />
      {ready && (
        <div className="grid gap-3 md:grid-cols-2">
          <ResultList title="Players" state={players} empty="No saved players with that name.">
            {playerRows.map((player) => {
              const name = cleanName(player.name);
              const legend = legends.get(player.bestLegend?.id);
              const facts = name ? rankedFacts(player, legend).filter((fact) => !fact.startsWith('was ')) : [];
              const past = pastNames(player, name);
              const sub = [...facts, past.length ? `was ${past.join(', ')}` : ''].filter(Boolean).join(' · ');
              return (
                <ResultRow
                  key={player.bhid}
                  title={name || `Brawlhalla ID ${player.bhid}`}
                  sub={sub}
                  id={name && player.match !== 'id' ? player.bhid : ''}
                  icon={<LegendIcon name={legend} />}
                  defaultOpen={isId && player.bhid === Number(text)}
                >
                  <PlayerDetail bhid={player.bhid} />
                </ResultRow>
              );
            })}
          </ResultList>
          {!isId && (
            <ResultList title="Clans" state={clans} empty="No saved clans with that name.">
              {(clans.data || []).map((clan) => (
                <ResultRow key={clan.clanId} title={cleanName(clan.name)} id={clan.clanId}>
                  <ClanDetail clanId={clan.clanId} />
                </ResultRow>
              ))}
            </ResultList>
          )}
        </div>
      )}
    </div>
  );
}

function Count({ value }) {
  return <td className={cx('px-2 py-1 text-right tabular-nums', value ? 'text-white' : 'text-slate-600')}>{formatNumber(value)}</td>;
}

function QueueCard({ hub }) {
  const rows = SERVER_ORDER.map((code) => hub.queue.find((row) => row.region === code)).filter(Boolean);
  const total = (mode) => rows.reduce((sum, row) => sum + (mode ? row.modes[mode] ?? 0 : row.total), 0);
  return (
    <Section title="In queue now" count={formatNumber(hub.inQueue)} padded={false} headingAs="h2" actions={<a href="/raybot/queue" className="text-xs font-bold text-blue-300 hover:underline">Ranked Queue</a>}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="px-2 py-1 text-left font-bold">Server</th>
            {MODES.map((mode) => <th key={mode.value} className="px-2 py-1 text-right font-bold">{mode.label}</th>)}
            <th className="px-2 py-1 text-right font-bold">All</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.region}>
              <th className="px-2 py-1 text-left font-bold" title={serverName(row.region)}>
                <a href={`/raybot/queue?server=${row.region}`} className="text-slate-200 hover:text-blue-300 hover:underline">{serverShort(row.region)}</a>
              </th>
              {MODES.map((mode) => <Count key={mode.value} value={row.modes[mode.value] ?? 0} />)}
              <Count value={row.total} />
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-700">
          <tr className="font-bold">
            <th className="px-2 py-1 text-left text-slate-300">All</th>
            {MODES.map((mode) => <Count key={mode.value} value={total(mode.value)} />)}
            <Count value={total()} />
          </tr>
        </tfoot>
      </table>
      <p className="px-2 py-2 text-xs text-slate-400">Players from each top 500 who finished a game in the last {hub.activeWindowMinutes} minutes.</p>
    </Section>
  );
}

function PeaksCard({ hub, now }) {
  const peaks = hub.newPeaks || [];
  return (
    <Section title="New peaks" count={peaks.length || undefined} padded={false} headingAs="h2">
      {peaks.length ? (
        <ol className="divide-y divide-slate-800">
          {peaks.map((peak) => {
            const losses = peak.games != null && peak.wins != null ? peak.games - peak.wins : null;
            return (
              <li key={peak.sessionId} className="px-2 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <PlayerLink bhid={peak.gameMode === '2v2' ? null : peak.playerId} className="min-w-0 truncate font-bold text-white">{peak.name || `ID ${peak.playerId}`}</PlayerLink>
                  <span className="shrink-0 font-bold tabular-nums text-emerald-300">{rating(peak.peakRating)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-slate-400">
                  <span>{serverShort(peak.region)} {MODES.find((mode) => mode.value === peak.gameMode)?.label}</span>
                  <span className="tabular-nums">
                    was {rating(peak.previousPeak)}
                    {losses != null && peak.games > 0 && ` · ${peak.wins}–${losses} this session`}
                    {peak.at && <> · <a href={sessionHref(peak.sessionId)} className="text-blue-300 hover:underline">{timeAgo(peak.at, now)}</a></>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : <p className="px-2 py-2 text-sm text-slate-400">Nobody in the queue has passed their season peak right now.</p>}
    </Section>
  );
}

function TopRow({ row, mode, legends }) {
  const legend = legends.get(row.bestLegend);
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums text-slate-400">#{row.rank}</span>
      {mode !== '2v2' && <LegendIcon name={legend} link />}
      <span className="min-w-0 flex-1">
        {mode === '2v2' ? (
          row.members.some((member) => member.name) ? row.members.map((member, index) => (
            <PlayerLink key={index} bhid={member.bhid} className="block truncate text-sm font-bold text-white">{member.name || `ID ${member.bhid}`}</PlayerLink>
          )) : <span className="block truncate text-sm font-bold text-white">{row.name}</span>
        ) : (
          <PlayerLink bhid={row.playerId} className="block truncate text-sm font-bold text-white">{row.name || `ID ${row.playerId}`}</PlayerLink>
        )}
        {row.tier && <Pill tone={tierTone(row.tier)} className="mt-0.5">{row.tier}</Pill>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-bold tabular-nums text-white">{rating(row.rating)}</span>
        {row.peakRating != null && row.peakRating !== row.rating && <span className="block text-[11px] tabular-nums text-slate-400">peak {rating(row.peakRating)}</span>}
      </span>
    </li>
  );
}

function TopThree({ hub, now }) {
  const [mode, setMode] = useQueryState('mode', '1v1');
  const legends = useLegendNames();
  const tops = SERVER_ORDER.map((code) => hub.tops.find((top) => top.region === code && top.gameMode === mode)).filter(Boolean);
  return (
    <Section
      title="Top 3"
      headingAs="h2"
      actions={<Tabs variant="small" label="Ranked mode" value={mode} onChange={setMode} items={MODES} />}
      bodyClassName="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 min-[137.5rem]:grid-cols-5"
      padded={false}
    >
      {tops.length ? tops.map((top) => (
        <Card key={top.region} className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold text-white">{serverName(top.region)}</h3>
            <span className="text-[11px] text-slate-500">{timeAgo(top.updatedAt, now)}</span>
          </div>
          {top.players.length ? (
            <ol className="mt-1 divide-y divide-slate-800/70">
              {top.players.map((row) => <TopRow key={`${row.rank}-${row.playerId}`} row={row} mode={mode} legends={legends} />)}
            </ol>
          ) : <p className="mt-1 text-sm text-slate-500">No saved ranking.</p>}
          <a href={`/raybot/rankings?mode=${mode}&server=${top.region}`} className="mt-auto pt-1 text-xs font-bold text-blue-300 hover:underline">Full leaderboard →</a>
        </Card>
      )) : <EmptyState title="No saved rankings for this mode" className="sm:col-span-2 lg:col-span-3" />}
    </Section>
  );
}

function Commands() {
  return (
    <Section id="commands" title="Bot commands" count={BOT_COMMANDS.length} headingAs="h2" padded={false} bodyClassName="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-4 min-[137.5rem]:grid-cols-5">
      {BOT_COMMANDS.map((command) => (
        <Card key={command.name}>
          <div className="flex items-baseline justify-between gap-2">
            <code className="font-mono text-sm font-bold text-emerald-300">/{command.name}</code>
            {command.href && <a href={command.href} className="truncate text-xs font-bold text-blue-300 hover:underline">{command.page} →</a>}
          </div>
          <p className="text-sm text-slate-300">{command.text}</p>
        </Card>
      ))}
    </Section>
  );
}

function Pages() {
  const section = sectionByKey('ranked');
  const pages = (section?.tools || []).filter((tool) => tool.href !== section.href);
  if (!pages.length) return null;
  return (
    <Section title="Pages" headingAs="h2" tone={sectionTones.ranked?.section} padded={false} bodyClassName="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 min-[112.5rem]:grid-cols-4">
      {pages.map((tool) => <ToolCard key={tool.href} tool={tool} tone={sectionTones.ranked} />)}
    </Section>
  );
}

export default function RaybotHub() {
  const hub = useApi(raybotApi('/hub'));
  const now = useNow();
  const { retry } = hub;
  useEffect(() => {
    const timer = setInterval(retry, 60000);
    return () => clearInterval(timer);
  }, [retry]);
  const data = hub.data;
  return (
    <PageShell>
      <PageHeader
        title="Raybot"
        meta={data?.updatedAt ? `Ladders saved ${timeAgo(data.updatedAt, now)}` : undefined}
        subtitle="A Discord bot for Brawlhalla ranked stats. It saves the top 500 of every ranked ladder every 5 minutes."
        actions={(
          <a href={RAYBOT_INVITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-indigo-500 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-400">
            Add Raybot to Discord ↗
          </a>
        )}
      >
        <RaybotSearch />
      </PageHeader>

      {hub.error && !data ? (
        <ErrorState message="Couldn't load the ranked queue." detail={hub.error} onRetry={hub.retry} />
      ) : !data ? (
        <div className="grid gap-3 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <SkeletonGrid count={2} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-1" tileClassName="h-64" />
          <SkeletonGrid count={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" tileClassName="h-40" />
        </div>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-[24rem_minmax(0,1fr)] min-[112.5rem]:grid-cols-[28rem_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-3 md:grid-cols-2 xl:grid-cols-1">
            <QueueCard hub={data} />
            <PeaksCard hub={data} now={now} />
          </div>
          <TopThree hub={data} now={now} />
        </div>
      )}

      <Pages />
      <Commands />
    </PageShell>
  );
}
