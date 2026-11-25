import { useMemo, useState } from "react";
import { AsideBox, CountPill, CountPills, EmptyState, PageHeader, PageShell, Section, SelectInput, Tabs, useApi, useQueryState } from "../ui";
import SiteSearch from "../ui/SiteSearch";
import { sectionByKey } from "../../data/sections";
import { ToolCard, WhatsNew, sectionTones } from "../home/ToolCards";
import { EventLine, Face, upcomingNote } from "../home/LiveTiles";
import { esportsUrl as apiUrl, relativeDays, useWhatsOn } from "../home/live";
import { date, number, OFFICIAL_REGIONS, PlayerChip, points, regionName } from "./ui";
import { recordBoard, recordDetail, recordsUrl, recordValue } from "./RecordsPage";
import { SeriesMemberRow, sortSeriesMembers } from "./Results";
import LiveStreams from "./LiveStreams";

const REGION_OPTIONS = [{ value: "ALL", label: "Global" }, ...OFFICIAL_REGIONS.map(([value, label]) => ({ value, label }))];
const MODE_ITEMS = [{ value: "1", label: "1v1" }, { value: "2", label: "2v2" }];
const linkButton = "rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700";

export default function HubPage() {
  const overview = useApi(apiUrl("/overview"));
  const counts = overview.data?.counts;
  const officialCount = (overview.data?.official ?? []).find((row) => row.classification === "official")?.tournaments;
  const competitive = sectionByKey("competitive");
  const tools = competitive.tools.filter((tool) => tool.href !== "/esports");
  return (
    <PageShell>
      <PageHeader
        title="Esports"
      >
        <div className="max-w-4xl"><SiteSearch variant="page" scope="esports" limit={6} /></div>
        {counts && (
          <CountPills>
            <CountPill label="Tournaments" value={number(counts.tournaments)} href="/esports/tournaments" />
            {officialCount != null && <CountPill label="Official" value={number(officialCount)} href="/esports/tournaments?official=official" />}
            <CountPill label="Events" value={number(counts.events)} />
            <CountPill label="Sets" value={number(counts.sets)} />
            <CountPill label="Players who entered an event" value={number(counts.players)} href="/esports/player" />
            <CountPill label="Organizers" value={number(counts.organizers)} />
          </CountPills>
        )}
      </PageHeader>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => <ToolCard key={tool.href} tool={tool} tone={sectionTones.competitive} />)}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 min-[112.5rem]:grid-cols-3">
        <TopPlayers />
        <div className="grid min-w-0 grid-cols-1 content-start gap-3 min-[112.5rem]:contents">
          <WhatsOn />
          <LatestResults />
        </div>
      </div>

      <LiveStreams />

      <Leaders />

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <WhatsNew area="Competitive" limit={4} listClassName="grid gap-x-3 gap-y-0.5 xl:grid-cols-2" />
        <AsideBox title="For tournament organizers">
          <p className="max-w-prose text-sm text-slate-400">
            <a href="/esports/autoseed" className="font-bold text-blue-300 hover:underline">Autoseed</a> reorders a start.gg bracket's seeding by power ranking and uploads it back. It needs a start.gg sign-in with organizer access.
          </p>
          {import.meta.env.DEV && <a href="/esports/review" className="mt-2 inline-block text-sm font-bold text-blue-300 hover:underline">Classification review (admin)</a>}
        </AsideBox>
      </div>
    </PageShell>
  );
}

function Movement({ rank, previousRank }) {
  if (previousRank === null || previousRank === undefined) return <span className="w-8 shrink-0 text-center text-[10px] font-bold text-sky-300" title="New in the rankings since the last update">NEW</span>;
  const change = Number(previousRank) - Number(rank);
  if (!change) return <span className="w-8 shrink-0 text-center text-xs text-slate-600" title="Same rank as the last update">–</span>;
  return (
    <span className={`w-8 shrink-0 text-center text-xs font-bold tabular-nums ${change > 0 ? "text-emerald-300" : "text-rose-300"}`} title={`Was #${previousRank}`}>
      {change > 0 ? "▲" : "▼"}{Math.abs(change)}
    </span>
  );
}

function TopPlayers() {
  const [regionParam, setRegion] = useQueryState("region", "NA");
  const region = REGION_OPTIONS.some((option) => option.value === regionParam) ? regionParam : "NA";
  const [mode, setMode] = useQueryState("mode", "1");
  const ranking = useApi(apiUrl("/rankings", { region, gameMode: mode, regionAssignment: "latest", perPage: 10, page: 1 }));
  const players = ranking.data?.players ?? [];
  return (
    <Section
      title="Top 10 right now"
      subtitle={ranking.data?.dataThrough ? `Results through ${date(ranking.data.dataThrough)}` : undefined}
      headingAs="h2"
      tone="amber"
      actions={(
        <>
          <SelectInput label={<span className="sr-only">Region</span>} value={region} onChange={setRegion} options={REGION_OPTIONS} />
          <Tabs variant="small" label="Format" value={mode} onChange={setMode} items={MODE_ITEMS} />
        </>
      )}
      bodyClassName="space-y-0! p-0!"
    >
      {ranking.error && !ranking.loading && <div className="p-3"><EmptyState title="Couldn't load the rankings" action={<button type="button" onClick={ranking.retry} className={linkButton}>Retry</button>} /></div>}
      {ranking.loading && !players.length && <div className="space-y-2 p-3">{Array.from({ length: 10 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-800/80" />)}</div>}
      {!ranking.loading && !ranking.error && !players.length && <div className="p-3"><EmptyState title="No ranked players here yet" /></div>}
      <ol className={ranking.loading ? "opacity-60" : ""}>
        {players.map((player) => (
          <li key={player.playerId}>
            <a href={`/esports/player/id/${player.playerId}`} className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 hover:bg-slate-800/50 sm:gap-3">
              <span className="w-6 shrink-0 text-center text-lg font-bold tabular-nums text-white">{player.rank}</span>
              <Movement rank={player.rank} previousRank={player.previousRank} />
              <Face src={player.image} playerId={player.playerId} name={player.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-white">{player.name}</span>
                <span className="block truncate text-xs text-slate-500">{number(player.eventCount)} ranked events{player.provisional ? " · provisional" : ""}</span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-300" title="Ranking points">{points(player.points)}</span>
            </a>
          </li>
        ))}
      </ol>
      <a href={`/pr?region=${region}&mode=${mode}`} className="block px-3 py-2.5 text-sm font-bold text-blue-300 hover:bg-slate-800/50">
        Full {regionName(region)} {mode === "2" ? "2v2" : "1v1"} rankings →
      </a>
    </Section>
  );
}

function WhatsOn() {
  const on = useWhatsOn();
  const { live, upcoming, nextOfficial } = on;
  return (
    <Section
      title="What's on"
      subtitle="Official and Tier 1 community events."
      headingAs="h2"
      tone="emerald"
      actions={<a href="/esports/tournaments?state=upcoming" className={linkButton}>All →</a>}
      bodyClassName="space-y-2!"
    >
      {on.loading && <div className="space-y-2">{[0, 1, 2].map((index) => <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-800/80" />)}</div>}
      {on.error && !on.loading && <EmptyState title="Couldn't load tournaments" action={<button type="button" onClick={on.retry} className={linkButton}>Retry</button>} />}
      {!on.loading && !on.error && (
        <>
          {!on.officialLive && (
            <p className="rounded-xl bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
              No official events live right now{nextOfficial ? <> · next: <a href={`/esports/tournament/${nextOfficial.id}`} className="font-bold text-white hover:underline">{nextOfficial.name}</a> {relativeDays(nextOfficial.starts_at)}</> : "."}
            </p>
          )}
          <div className="-mx-2">
            {live.slice(0, 5).map((tournament) => <EventLine key={`live-${tournament.id}`} tournament={tournament} live />)}
            {upcoming.slice(0, Math.max(3, 6 - Math.min(live.length, 5))).map((tournament) => (
              <EventLine key={`up-${tournament.id}`} tournament={tournament} note={upcomingNote(tournament)} />
            ))}
          </div>
          {!live.length && !upcoming.length && <p className="text-sm text-slate-400">Nothing scheduled yet. Community events of every size are on the <a href="/esports/tournaments" className="font-bold text-blue-300 hover:underline">tournaments page</a>.</p>}
        </>
      )}
    </Section>
  );
}

const REGION_WORDS = /\b(North America|South America|Southeast Asia|Middle East(?: & North Africa)?|Europe|Australia|Oceania|Japan|MENA|SEA|AUS|NA|EU|SA)\b/gi;

export const seriesName = (name) => String(name || "")
  .replace(/\s*-\s*(1v1|2v2)\s*$/i, "")
  .replace(REGION_WORDS, "")
  .replace(/\s*-\s*(?=\d{4}\b)/g, " ")
  .replace(/\s*-\s*$/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

function LatestResults() {
  const events = useApi(apiUrl("/tournaments", { official: "official", state: "complete", group: "series", perPage: 4 }));
  const groups = useMemo(() => {
    const result = [];
    for (const item of events.data?.items ?? []) {
      if (item.date_outlier) continue;
      const members = item.kind === "series" ? item.tournaments ?? [] : [item];
      const key = item.series_name ?? seriesName(item.name);
      const group = result.find((entry) => entry.key === key);
      if (group) group.tournaments.push(...members);
      else result.push({ key, name: item.series_name ?? item.name, tournaments: [...members], startsAt: item.starts_at });
    }
    return result.slice(0, 2).map((group) => ({ ...group, tournaments: sortSeriesMembers(group.tournaments) }));
  }, [events.data]);
  return (
    <Section
      title="Latest official results"
      headingAs="h2"
      tone="blue"
      actions={<a href="/esports/tournaments?official=official&state=complete" className={linkButton}>All →</a>}
    >
      {events.loading && !events.data && <div className="space-y-2">{[0, 1, 2].map((index) => <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-800/80" />)}</div>}
      {events.error && !events.loading && <EmptyState title="Couldn't load results" action={<button type="button" onClick={events.retry} className={linkButton}>Retry</button>} />}
      {events.data && !groups.length && <EmptyState title="No official results yet" />}
      {groups.map((group) => <ResultGroup key={group.key} group={group} />)}
    </Section>
  );
}

const GROUP_ROWS = 5;

function ResultGroup({ group }) {
  const [open, setOpen] = useState(false);
  const rows = open ? group.tournaments : group.tournaments.slice(0, GROUP_ROWS);
  return (
    <div>
      <div className="mb-1">
        <h3 className="font-bold leading-tight text-white">{group.name}</h3>
        <span className="text-xs text-slate-500">{date(group.startsAt)}</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60">
        {rows.map((tournament) => <SeriesMemberRow key={tournament.id} tournament={tournament} prize={false} />)}
      </div>
      {group.tournaments.length > GROUP_ROWS && (
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mt-1 text-xs font-bold text-blue-300 hover:underline">
          {open ? "Show fewer" : `Show all ${group.tournaments.length}`}
        </button>
      )}
    </div>
  );
}

const HUB_BOARDS = ["earnings", "gold", "official", "tournaments"].map(recordBoard);

function Leaders() {
  const leaders = useApi(apiUrl("/leaders", { limit: 5 }));
  if (leaders.error && !leaders.loading) {
    return <Section title="All-Time Records" headingAs="h2"><EmptyState title="Couldn't load the records" action={<button type="button" onClick={leaders.retry} className={linkButton}>Retry</button>} /></Section>;
  }
  return (
    <Section title="All-Time Records" headingAs="h2" actions={<a href={recordsUrl()} className={linkButton}>All records</a>}>
      {!leaders.data && <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-56 animate-pulse rounded-xl bg-slate-800/80" />)}</div>}
      {leaders.data && (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {HUB_BOARDS.map((board) => {
            const total = leaders.data.totals?.[board.key];
            return (
              <div key={board.key} className="flex h-full min-w-0 flex-col rounded-xl border border-slate-700 bg-slate-950/60">
                <div className="border-b border-slate-800 px-3 py-2">
                  <h3 className="font-bold text-white">{board.title}</h3>
                  {board.note && <p className="text-xs text-slate-500">{board.note}</p>}
                  {board.key === "earnings" && leaders.data.earningsNote && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer select-none hover:text-slate-300">Where these numbers come from</summary>
                      <p className="mt-1 text-slate-400">{leaders.data.earningsNote}</p>
                    </details>
                  )}
                </div>
                <ol className="flex-1">
                  {(leaders.data.categories?.[board.key] ?? []).map((player, index) => (
                    <li key={player.player_id} className="flex items-center gap-2 border-b border-slate-800/70 px-3 py-2">
                      <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-slate-500">{player.place ?? index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <PlayerChip id={player.player_id} name={player.name} country={player.country} size="sm" detail={recordDetail(board, player)} />
                      </div>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${board.key === "earnings" ? "text-emerald-300" : "text-slate-200"}`}>{recordValue(board, player.value)}</span>
                    </li>
                  ))}
                </ol>
                <a href={recordsUrl(board.key)} className="block px-3 py-2 text-sm font-bold text-blue-300 hover:bg-slate-800/50 hover:text-blue-200">
                  {total ? `See all ${number(total)}` : "See all"} <span aria-hidden="true">→</span>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
