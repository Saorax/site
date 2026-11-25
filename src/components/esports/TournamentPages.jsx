import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { host } from "../../stuff";
import { mapName } from "./MatchPages";
import { gamePicks, hasMatchData, MatchData, matchDataGames } from "./MatchData";
import { AsideBox, DataViewToggle, FilterBar, LinkList, ListTools, ScrollX, SelectInput, Tabs as KitTabs, Toggle, useDataView } from "../ui";
import { OnNowTile } from "../home/LiveTiles";
import {
  apiUrl, Avatar, Badge, Card, cleanEntrantName, Empty, ErrorNote, fetchAllPages, isPlayedSet, LIVE_REFRESH_MS, LiveUpdates, Loading,
  modeName, money, number, ordinal, PageShell, Pagination, points, ProviderLink, regionName, resultMark, SearchInput, Select, StreamBadge, Tabs,
  useApi, useDebounced, useQueryState,
} from "./ui";
import { dateRange, Dotted, editionMatch, Entrant, EventResultsCard, LegendNameProvider, ModeChips, placeTone, PlayerName, Podium, PrizeText, SeriesMemberRow, SideEventRow, sortSeriesMembers, TeamLines, useLegendName, winnerLabel } from "./Results";

const EntrantIndex = createContext(new Map());

const teamOf = (entrant) => ((entrant?.members ?? []).length > 1 ? entrant.members : null);

function SlotName({ slot, className = "" }) {
  const team = teamOf(useContext(EntrantIndex).get(String(slot?.entrantId)));
  if (!team) return <span className={`truncate ${className}`}>{cleanEntrantName(slot?.entrantName)}</span>;
  return (
    <span className={`flex min-w-0 flex-col leading-tight ${className}`}>
      {team.map((member, index) => <span key={`${member.playerId ?? member.name}:${index}`} className="truncate">{member.name}</span>)}
    </span>
  );
}

const finalPhase = (phases) => {
  const hasGrandFinal = (phase) => phase.groups.length === 1 && phase.groups[0].sections?.some((section) => section.columns?.some((column) => /grand final/i.test(column.name ?? "")));
  return [...phases].reverse().find(hasGrandFinal)
    ?? [...phases].reverse().find((phase) => phase.groups.length === 1 && phase.groups[0].type === "elimination")
    ?? phases[phases.length - 1];
};

const shownState = (item) => item?.display_state ?? (item?.state === "active" ? "live" : item?.state);
const eventIsLive = (data) => shownState(data?.event) === "live";

const stateLabel = { upcoming: "Upcoming", live: "Live", complete: "Completed", cancelled: "Cancelled", ended: "Ended", not_played: "No bracket played", no_results: "No results" };
const stateTone = { upcoming: "amber", live: "green", complete: "slate", cancelled: "red", ended: "slate", not_played: "slate", no_results: "slate" };

function StateBadge({ item, hideComplete = false }) {
  const state = shownState(item);
  if (!state || (hideComplete && state === "complete")) return null;
  return <Badge tone={stateTone[state]}>{stateLabel[state] ?? state}</Badge>;
}

function Banner({ image }) {
  return image
    ? <img src={image} alt="" loading="lazy" className="aspect-video w-full rounded-xl object-cover bg-slate-800" />
    : <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-slate-800 to-slate-900" />;
}


const LIST_STATES = [["complete", "Results"], ["upcoming", "Upcoming"], ["active", "Live"], ["all", "All"]];
const PRESET_DEFAULTS = { official: "all", state: "complete", provider: "all", search: "" };
const LIST_PRESETS = [
  { label: "Official results", params: { official: "official", state: "complete" } },
  { label: "Upcoming official", params: { official: "official", state: "upcoming" } },
  { label: "Tier 1 community", params: { official: "tier1" } },
  { label: "Live now", params: { state: "active" } },
  { label: "World Championships", params: { official: "official", search: "world championship" } },
  { label: "Challengermode", params: { provider: "challengermode" } },
];

const tournamentType = (item) => (item.classification === "official" || (!item.classification && item.is_official) ? "Official" : item.classification === "tier1-community" ? "Tier 1" : "Community");
const winnerNames = (winner) => (winner.members ?? []).map((member) => member.name).filter(Boolean).join(" & ") || cleanEntrantName(winner.name);

const TOURNAMENT_EXPORT_COLUMNS = [
  { key: "id", label: "Tournament ID", value: (item) => item.id },
  { key: "tournament", label: "Tournament", value: (item) => item.name },
  { key: "series", label: "Series", value: (item) => item.series_name },
  { key: "type", label: "Type", value: tournamentType },
  { key: "state", label: "State", value: (item) => stateLabel[shownState(item)] ?? shownState(item) },
  { key: "start", label: "Start", value: (item) => (item.starts_at ? String(item.starts_at).slice(0, 10) : "") },
  { key: "end", label: "End", value: (item) => (item.ends_at ? String(item.ends_at).slice(0, 10) : "") },
  { key: "regions", label: "Regions", value: (item) => item.regions ?? [] },
  { key: "modes", label: "Modes", value: (item) => (item.modes ?? []).map(modeName) },
  { key: "entrants", label: "Entrants", value: (item) => item.entrants },
  { key: "events", label: "Events", value: (item) => item.event_count },
  { key: "prizePool", label: "Prize pool (USD)", value: (item) => item.prize_pool },
  { key: "winners", label: "Winners", value: (item) => (item.winners ?? []).map((winner) => ((item.winners ?? []).length > 1 ? `${winner.event_name || modeName(winner.game_mode)}: ${winnerNames(winner)}` : winnerNames(winner))) },
  { key: "site", label: "Site", value: (item) => (item.provider === "challengermode" ? "Challengermode" : item.provider === "startgg" ? "start.gg" : item.provider) },
  { key: "link", label: "Link", value: (item) => item.url },
];

const tournamentExportRows = (items) => items.filter((item) => !item.date_outlier).flatMap((item) => (item.kind === "series"
  ? (item.tournaments ?? []).map((member) => ({ ...member, series_name: item.series_name, classification: item.classification, is_official: item.is_official }))
  : [item]));

export function TournamentsPage() {
  const [search, setSearch] = useQueryState("search", "");
  const [official, setOfficial] = useQueryState("official", "all");
  const [state, setState] = useQueryState("state", "complete");
  const [provider, setProvider] = useQueryState("provider", "all");
  const [shells, setShells] = useQueryState("shells", "");
  const [group, setGroup] = useQueryState("group", "series");
  const [pageParam, setPageParam] = useQueryState("page", "1");
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const setPage = (value) => setPageParam(String(value));
  const { full } = useDataView();
  const query = useDebounced(search.trim());
  const grouped = group !== "off" && official !== "community" && official !== "tier1";
  const listParams = {
    search: query || undefined,
    official: official === "all" ? undefined : official,
    state: state === "all" ? undefined : state,
    provider: provider === "all" ? undefined : provider,
    shells: shells === "include" ? "include" : undefined,
    group: grouped ? "series" : undefined,
  };
  const list = useApi(apiUrl("/tournaments", { ...listParams, page, perPage: grouped ? 36 : 48 }));
  const exportName = ["saorax-tournaments", official !== "all" ? official : "", state !== "all" ? state : "", provider !== "all" ? provider : "", query ? "search" : ""].filter(Boolean).join("-");
  const exportRows = async (onProgress) => tournamentExportRows(await fetchAllPages("/tournaments", listParams, { onProgress }));
  const reset = (setter) => (value) => { setter(value); setPage(1); };
  const items = (list.data?.items ?? []).filter((tournament) => !tournament.date_outlier);
  const empty = state === "active" ? "Nothing is being played right now." : state === "upcoming" ? "No upcoming tournaments match these filters." : "No tournaments match these filters.";

  const current = { official, state, provider, search: search.trim().toLowerCase() };
  const presetActive = (preset) => Object.entries(PRESET_DEFAULTS).every(([key, fallback]) => current[key] === (preset.params[key] ?? fallback));
  return (
    <PageShell
      title="Tournaments"
      back={{ href: "/esports", label: "Esports Hub" }}
      actions={<DataViewToggle size="sm" />}
      aside={(
        <>
          <AsideBox title="Shortcuts">
            <LinkList items={LIST_PRESETS.map((preset) => ({ key: preset.label, label: preset.label, href: `/esports/tournaments?${new URLSearchParams(preset.params)}`, active: presetActive(preset) }))} />
          </AsideBox>
          <OnNowTile rows={4} />
        </>
      )}
    >
      <KitTabs label="Show" value={LIST_STATES.some(([value]) => value === state) ? state : "all"} onChange={reset(setState)} items={LIST_STATES.map(([value, label]) => ({ value, label }))} />
      <FilterBar summary={list.data ? `${number(list.data.total)} tournaments` : ""}>
        <KitTabs variant="small" label="Type" value={official} onChange={reset(setOfficial)} items={[["all", "All"], ["official", "Official"], ["tier1", "Tier 1"], ["community", "Community"]].map(([value, label]) => ({ value, label }))} />
        <div className="w-full md:w-72"><SearchInput value={search} onChange={reset(setSearch)} placeholder="Search tournaments" /></div>
        <SelectInput label="Site" value={provider} onChange={reset(setProvider)} options={[["all", "Any"], ["startgg", "start.gg"], ["challengermode", "Challengermode"]].map(([value, label]) => ({ value, label }))} />
        {official !== "community" && official !== "tier1" && (
          <Toggle label="Group regionals" title="One row per official weekend instead of one per region and format" checked={group !== "off"} onChange={(checked) => { setGroup(checked ? "series" : "off"); setPage(1); }} />
        )}
        <Toggle label="Show empty tournaments" title="Old imported tournaments with no events or results" checked={shells === "include"} onChange={(checked) => { setShells(checked ? "include" : ""); setPage(1); }} />
        {list.data?.total > 0 && <ListTools className="md:ml-auto" filename={exportName} rows={exportRows} columns={TOURNAMENT_EXPORT_COLUMNS} />}
      </FilterBar>
      {list.error && <ErrorNote message={list.error} onRetry={list.retry} />}
      {!list.data && list.loading && <Loading label="Loading tournaments…" />}
      {list.data && !items.length && <Empty>{empty}</Empty>}
      {items.length > 0 && (
        <div className={`grid grid-cols-1 gap-2 md:grid-cols-2 min-[112.5rem]:grid-cols-3 min-[150rem]:grid-cols-4 ${list.loading ? "opacity-60" : ""}`}>
          {items.map((tournament) => tournament.kind === "series"
            ? <SeriesRow key={tournament.id} series={tournament} full={full} tabState={state === "active" ? "live" : state} />
            : <TournamentRow key={tournament.id} tournament={tournament} full={full} tabState={state === "active" ? "live" : state} />)}
        </div>
      )}
      <Pagination page={page} totalPages={list.data?.totalPages} onChange={setPage} />
    </PageShell>
  );
}

function TierBadge({ classification, official }) {
  if (classification === "official" || (!classification && official)) return <Badge tone="blue">Official</Badge>;
  if (classification === "tier1-community") return <Badge tone="amber" title="Large community series counted like a top community event">Tier 1</Badge>;
  return null;
}

function CardThumb({ image, name }) {
  return image
    ? <img src={image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover bg-slate-800" />
    : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black text-slate-500 bg-slate-800">{String(name ?? "?")[0]}</div>;
}

function CardMeta({ items }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-1.5 text-xs font-semibold text-slate-400">
      {items.filter(Boolean).map((item, index) => (
        <span key={index} className="whitespace-nowrap">{index > 0 && <span className="mr-1.5 text-slate-600" aria-hidden="true">·</span>}{item}</span>
      ))}
    </div>
  );
}

const cardClass = "flex h-full min-w-0 flex-col gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 p-2";

function TournamentRow({ tournament, full, tabState }) {
  const state = shownState(tournament);
  const winners = tournament.winners ?? [];
  const regions = tournament.regions ?? [];
  const upcoming = state === "upcoming";
  const pending = upcoming || state === "live";
  const classification = tournament.classification ?? (tournament.is_official ? "official" : "community");
  return (
    <a href={`/esports/tournament/${tournament.id}`} className={`group ${cardClass} transition hover:border-blue-500/60 hover:bg-slate-800/60`}>
      <div className="flex min-w-0 items-start gap-2">
        <CardThumb image={tournament.image} name={tournament.name} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="truncate text-sm font-bold text-white group-hover:text-blue-300" title={tournament.name}>{tournament.name}</div>
          <div className="flex min-h-5 flex-wrap items-center gap-1">
            {classification === "community" ? <Badge>Community</Badge> : <TierBadge classification={classification} official={tournament.is_official} />}
            <ModeChips modes={tournament.modes} />
            {state !== tabState && <StateBadge item={tournament} hideComplete />}
          </div>
          <CardMeta
            items={[
              dateRange(tournament.starts_at, tournament.ends_at),
              regions.length > 3 ? `${regions.length} regions` : regions.map(regionName).join(", "),
              tournament.entrants ? `${number(tournament.entrants)} ${upcoming ? "registered" : "entrants"}` : null,
              tournament.event_count > 1 ? `${tournament.event_count} events` : null,
            ]}
          />
        </div>
      </div>
      {full && (
        <div className="text-[11px] font-semibold text-slate-500">
          #{tournament.id} · {tournament.provider === "challengermode" ? "Challengermode" : "start.gg"}{tournament.slug ? ` · ${tournament.slug}` : ""}{tournament.host_name ? ` · host ${tournament.host_name}` : ""}
        </div>
      )}
      <div className="mt-auto flex min-w-0 items-start gap-2 border-t border-slate-800 pt-1.5 text-sm">
        <div className="grid min-w-0 flex-1 gap-1">
          {winners.length > 0
            ? winners.map((winner) => (
              <span key={winner.event_id} className="flex min-w-0 items-start gap-1.5">
                <span className="shrink-0 text-xs font-bold leading-5 text-amber-400">{winners.length > 1 ? `${modeName(winner.game_mode)} winner` : "Winner"}</span>
                <TeamLines members={winner.members} fallback={winnerLabel(winner)} />
              </span>
            ))
            : <span className="text-xs font-semibold leading-5 text-slate-500">{pending ? "No results yet" : "No winner recorded"}</span>}
        </div>
        {tournament.prize_pool != null && <span className="shrink-0 text-xs font-semibold leading-5 text-slate-400"><PrizeText prize={tournament.prize_pool} /> prize pool</span>}
      </div>
    </a>
  );
}

function SeriesRow({ series, full, tabState }) {
  const state = shownState(series);
  const members = series.tournaments ?? [];
  const regions = series.regions ?? [];
  return (
    <div className={`${cardClass} has-[details[open]]:col-span-full`}>
      <div className="flex min-w-0 items-start gap-2">
        <CardThumb image={series.image} name={series.name} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="truncate text-sm font-bold text-white" title={series.name}>{series.name}</div>
          <div className="flex min-h-5 flex-wrap items-center gap-1">
            <TierBadge classification="official" />
            <ModeChips modes={series.modes} />
            {state !== tabState && <StateBadge item={series} hideComplete />}
          </div>
          <CardMeta
            items={[
              dateRange(series.starts_at, series.ends_at),
              regions.map((region) => (region === "ALL" ? "Global" : region)).join(" · "),
              series.entrants ? `${number(series.entrants)} entrants` : null,
            ]}
          />
        </div>
      </div>
      {full && (
        <div className="text-[11px] font-semibold text-slate-500">
          {series.series_key} · {members.map((tournament) => `#${tournament.id}`).join(" ")}
        </div>
      )}
      <details className="group mt-auto border-t border-slate-800">
        <summary className="flex cursor-pointer list-none items-center gap-2 pt-1.5 text-sm font-bold text-slate-300 hover:text-white">
          <span className="transition group-open:rotate-90" aria-hidden="true">›</span>
          <span className="min-w-0 flex-1 truncate">{state === "upcoming" ? `${members.length} tournaments` : `Winners · ${members.length} tournaments`}</span>
          {series.prize_pool != null && <span className="shrink-0 text-xs font-semibold text-slate-400"><PrizeText prize={series.prize_pool} /> total</span>}
        </summary>
        <div className="mt-1.5 grid rounded-lg border border-slate-800 bg-slate-950/40 lg:grid-cols-2 lg:gap-x-3 min-[112.5rem]:grid-cols-3">
          {members.map((tournament) => <SeriesMemberRow key={tournament.id} tournament={tournament} />)}
        </div>
      </details>
    </div>
  );
}

function SeriesStrip({ series, currentId }) {
  const members = sortSeriesMembers([{ id: currentId, regions: series.regions, modes: series.modes }, ...(series.siblings ?? [])]);
  const previous = editionMatch(series.previous, series);
  const next = editionMatch(series.next, series);
  const label = (tournament) => {
    const regions = (tournament.regions ?? []).map((region) => (region === "ALL" ? "Global" : region)).join("/") || "Global";
    const modes = (tournament.modes ?? []).map(modeName).join("+");
    return modes ? `${regions} ${modes}` : regions;
  };
  return (
    <nav aria-label={series.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {previous && <a href={`/esports/tournament/${previous.id}`} className="font-bold text-blue-300 hover:text-blue-200">‹ {series.previous.name}</a>}
      {members.length > 1 && (
        <span className="flex flex-wrap items-center gap-1">
          {members.map((tournament) => String(tournament.id) === String(currentId)
            ? <span key={tournament.id} aria-current="page" className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-xs font-bold text-blue-100">{label(tournament)}</span>
            : <a key={tournament.id} href={`/esports/tournament/${tournament.id}`} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white">{label(tournament)}</a>)}
        </span>
      )}
      {next && <a href={`/esports/tournament/${next.id}`} className="font-bold text-blue-300 hover:text-blue-200">{series.next.name} ›</a>}
    </nav>
  );
}

function SeriesResults({ series, currentId }) {
  const siblings = series.siblings ?? [];
  if (!siblings.length) return null;
  const members = sortSeriesMembers([{ id: currentId, regions: series.regions, modes: series.modes, winners: series.winners ?? [], entrants: series.entrants }, ...siblings]);
  return (
    <Card title={`${series.name} winners`} padded={false} className="max-w-5xl">
      {members.map((tournament) => <SeriesMemberRow key={tournament.id} tournament={tournament} current={String(tournament.id) === String(currentId)} prize={false} />)}
    </Card>
  );
}

export function TournamentPage({ tournamentId, heading }) {
  const detail = useApi(apiUrl(`/tournaments/${tournamentId}`));
  const data = detail.data;
  if (detail.error) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}><ErrorNote message={detail.error} onRetry={detail.retry} /></PageShell>;
  if (!data) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }} title={heading}><Loading label="Loading tournament…" /></PageShell>;
  const tournament = data.tournament;
  const events = data.events ?? [];
  const main = events.filter((event) => !event.side_event);
  const side = events.filter((event) => event.side_event);
  const mainShown = main.length ? main : side.slice(0, 1);
  const sideShown = main.length ? side : side.slice(1);
  const pairSide = mainShown.length === 1 && sideShown.length > 0;
  const sideCard = sideShown.length > 0 && (
    <Card title={main.length ? "Side events" : "Other events"} padded={false} className={pairSide ? "" : "max-w-5xl"}>
      {sideShown.map((event) => <SideEventRow key={event.id} event={event} stateBadge={<StateBadge item={event} hideComplete />} />)}
    </Card>
  );

  return (
    <LegendNameProvider>
      <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}>
        <TournamentHeader tournament={tournament} series={data.series} />
        {events.length === 1
          ? <EventBody eventId={events[0].id} />
          : !events.length
            ? <Card><Empty>No events were published for this tournament.</Empty></Card>
            : (
              <>
                <div className={`grid gap-3 ${mainShown.length > 1 ? "xl:grid-cols-2" : ""} ${mainShown.length > 2 ? "min-[137.5rem]:grid-cols-3" : ""} ${pairSide ? "items-start min-[112.5rem]:grid-cols-2" : ""}`}>
                  {mainShown.map((event) => (
                    <EventResultsCard key={event.id} event={event} state={shownState(event)} stateBadge={<StateBadge item={event} hideComplete />} />
                  ))}
                  {pairSide && sideCard}
                </div>
                {!pairSide && sideCard}
              </>
            )}
        {data.series && <SeriesResults series={data.series} currentId={tournament.id} />}
      </PageShell>
    </LegendNameProvider>
  );
}

function EventStrip({ events, currentId }) {
  if (events.length < 2) return null;
  return (
    <nav aria-label="Events" className="flex flex-wrap items-center gap-1 text-sm">
      {events.map((event) => {
        const label = [event.name, event.entrant_count ? number(event.entrant_count) : null].filter(Boolean).join(" · ");
        return String(event.id) === String(currentId)
          ? <span key={event.id} aria-current="page" className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-xs font-bold text-blue-100">{label}</span>
          : <a key={event.id} href={`/esports/event/${event.id}`} title={event.side_event ? "Side event" : undefined} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white">{label}</a>;
      })}
    </nav>
  );
}

function TournamentHeader({ tournament, eventName, series, events = [], eventId }) {
  const name = tournament.name ?? tournament.tournament_name;
  const regions = eventName ? "" : (tournament.regions ?? []).map(regionName).join(", ");
  const facts = [
    dateRange(tournament.starts_at, tournament.ends_at),
    tournament.is_online === true ? "Online" : tournament.is_online === false ? "LAN" : null,
    regions || null,
    tournament.players ? `${number(tournament.players)} players` : null,
  ].filter(Boolean);
  return (
    <section className="grid gap-3 rounded-2xl border p-3 border-slate-700 bg-slate-900/80 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="hidden sm:block"><Banner image={tournament.image ?? tournament.tournament_image} /></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge classification={tournament.classification} official={tournament.is_official} />
          <StateBadge item={tournament} />
        </div>
        <h1 className="mt-1 break-words text-2xl font-bold text-white sm:text-3xl">{name}</h1>
        {eventName && eventName !== name && <div className="text-lg font-bold text-slate-300">{eventName}</div>}
        <Dotted
          className="mt-1 block text-sm font-semibold text-slate-400"
          items={[
            ...facts,
            tournament.prize_pool != null && <><PrizeText prize={tournament.prize_pool} /> prize pool</>,
            tournament.host_name && !tournament.host_name.startsWith("user/") && `Hosted by ${tournament.host_name}`,
          ]}
        />
        <div className="mt-2"><ProviderLink provider={tournament.provider} url={tournament.url ?? tournament.tournament_url} /></div>
        {(series || events.length > 1) && (
          <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2">
            {events.length > 1 && <EventStrip events={events} currentId={eventId} />}
            {series && <SeriesStrip series={series} currentId={tournament.id} />}
          </div>
        )}
      </div>
    </section>
  );
}


export function EventPage({ eventId, heading }) {
  const detail = useApi(apiUrl(`/events/${eventId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: eventIsLive });
  const event = detail.data?.event;
  const parent = useApi(event?.tournament_id ? apiUrl(`/tournaments/${event.tournament_id}`) : null);
  const parentTournament = parent.data?.tournament;
  return (
    <LegendNameProvider>
      <PageShell
        title={event ? undefined : heading}
        back={event ? { href: `/esports/tournament/${event.tournament_id}`, label: event.tournament_name } : { href: "/esports/tournaments", label: "Tournaments" }}
      >
        {detail.error && <ErrorNote message={detail.error} onRetry={detail.retry} />}
        {!detail.data && !detail.error && <Loading label="Loading event…" />}
        {event && (
          <>
            <TournamentHeader
              eventName={event.name}
              eventId={event.id}
              events={parent.data?.events ?? []}
              series={parent.data?.series}
              tournament={{
                id: event.tournament_id, name: event.tournament_name, image: event.tournament_image, url: event.tournament_url,
                provider: event.provider, starts_at: event.starts_at, ends_at: event.ends_at, state: event.state, display_state: event.display_state, is_official: event.is_official,
                is_online: parentTournament?.is_online, host_name: parentTournament?.host_name,
              }}
            />
            <EventBody eventId={eventId} preloaded={detail.data} updatedAt={detail.updatedAt} />
          </>
        )}
      </PageShell>
    </LegendNameProvider>
  );
}

function EventBody({ eventId, preloaded, updatedAt }) {
  const fetched = useApi(preloaded ? null : apiUrl(`/events/${eventId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: eventIsLive });
  const data = preloaded ?? fetched.data;
  const [view, setTab] = useQueryState("view", "results");
  const tab = view === "standings" ? "results" : view;
  if (!data) return fetched.error ? <ErrorNote message={fetched.error} onRetry={fetched.retry} /> : <Loading />;
  const event = data.event;
  const open = ["live", "upcoming"].includes(shownState(event));
  const sets = open ? data.sets ?? [] : (data.sets ?? []).map(closeSet);
  const reportedCount = matchDataGames(sets);
  const playedCount = sets.filter(isPlayedSet).length;
  const registered = event.registered_entrants ?? event.entrant_count;
  const facts = [
    modeName(event.game_mode),
    event.region && regionName(event.region),
    event.played_entrants != null && event.played_entrants < registered
      ? `${number(event.played_entrants)} played · ${number(registered)} registered`
      : `${number(event.entrant_count)} entrants`,
    event.prize_pool != null && `${money(event.prize_pool)} prize pool`,
  ].filter(Boolean).join(" · ");
  const entrantIndex = new Map((data.entrants ?? []).map((entrant) => [String(entrant.id), entrant]));
  return (
    <EntrantIndex.Provider value={entrantIndex}>
    <div>
      {open && <MatchTicker sets={sets} />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "results", label: "Results" },
            { key: "matches", label: "Matches", count: playedCount },
            ...(reportedCount ? [{ key: "data", label: "Match Data", count: reportedCount, title: "Every reported game: legends, maps, matchups and players" }] : []),
            ...(data.contributions?.length ? [{ key: "points", label: "Ranking points" }] : []),
          ]}
        />
        <span className="flex flex-wrap items-center gap-3">
          {shownState(event) === "live" && <LiveUpdates updatedAt={preloaded ? updatedAt : fetched.updatedAt} />}
          <span className="text-sm font-bold text-slate-500">{facts}</span>
        </span>
      </div>
      {tab === "results" && <Standings entrants={data.entrants ?? []} sets={sets} live={shownState(event) === "live"} finished={!open} team={Number(event.game_mode) === 2} />}
      {tab === "matches" && <Matches eventId={eventId} sets={sets} />}
      {tab === "data" && <MatchData sets={sets} entrants={data.entrants ?? []} />}
      {tab === "points" && <Points contributions={data.contributions ?? []} />}
    </div>
    </EntrantIndex.Provider>
  );
}

const LOWER_BRACKET = /\b(lower|losers)\b/i;

const reportedGames = (set) => (set.games ?? []).filter(hasMatchData);

function liveRecords(sets) {
  const records = new Map();
  const record = (entrantId) => {
    const key = String(entrantId);
    if (!records.has(key)) records.set(key, { wins: 0, losses: 0, playing: false, out: false });
    return records.get(key);
  };
  for (const set of sets) {
    const slots = set.slots ?? [];
    if (slots.length < 2) continue;
    if (set.state === "active") {
      for (const slot of slots) record(slot.entrantId).playing = true;
      continue;
    }
    if (set.state !== "complete" || !slots.some((slot) => slot.winner)) continue;
    for (const slot of slots) {
      const entry = record(slot.entrantId);
      if (slot.winner) entry.wins++;
      else {
        entry.losses++;
        if (LOWER_BRACKET.test(set.round_name ?? "")) entry.out = true;
      }
    }
  }
  return records;
}

function Standings({ entrants, sets = [], live = false, finished = false, team = false }) {
  const [search, setSearch] = useQueryState("q", "");
  const [pageParam, setPageParam] = useQueryState("page", "1");
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const setPage = (value) => setPageParam(String(value));
  const perPage = 50;
  const term = search.trim().toLowerCase();
  const podium = finished && !term ? entrants.filter((entrant) => !entrant.didnt_play && Number(entrant.placement) >= 1 && Number(entrant.placement) <= 3) : [];
  const onPodium = new Set(podium.map((entrant) => String(entrant.id)));
  const records = useMemo(() => (live ? liveRecords(sets) : new Map()), [live, sets]);
  const status = (entrant) => records.get(String(entrant.id));
  const filtered = entrants
    .filter((entrant) => !term || `${entrant.name} ${(entrant.members ?? []).map((member) => member.name).join(" ")}`.toLowerCase().includes(term))
    .sort((left, right) => (left.placement ?? left.guaranteed_placement ?? 1e9) - (right.placement ?? right.guaranteed_placement ?? 1e9) ||
      Number(left.placement != null) - Number(right.placement != null) ||
      Number(Boolean(status(left)?.out)) - Number(Boolean(status(right)?.out)) ||
      (left.seed ?? 1e9) - (right.seed ?? 1e9));
  const played = filtered.filter((entrant) => !entrant.didnt_play && !onPodium.has(String(entrant.id)));
  const absent = filtered.filter((entrant) => entrant.didnt_play);
  const podiumRows = [...podium].sort((left, right) => Number(left.placement) - Number(right.placement));
  return (
    <div className="grid gap-3">
      {podiumRows.length > 0 && <Podium rows={podiumRows} team={team} />}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-2 border-slate-800">
          <div className="w-full max-w-xs"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Find a player or team" /></div>
        </div>
        {!filtered.length && <Empty>No entrants found.</Empty>}
        {played.slice((page - 1) * perPage, page * perPage).map((entrant) => (
          <div key={entrant.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 border-b px-2 py-1.5 last:border-0 border-slate-800 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:px-3">
            <span className={`text-lg font-black tabular-nums ${placeTone(entrant.placement)}`}>
              {entrant.disqualified ? "DQ"
                : entrant.placement == null && entrant.guaranteed_placement
                  ? <span className="flex flex-col leading-none text-slate-500" title="Worst place this team can still finish"><span>{ordinal(entrant.guaranteed_placement)}</span><span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">or better</span></span>
                  : entrant.placement == null && status(entrant)?.out ? <span className="text-sm text-slate-500">Out</span> : ordinal(entrant.placement)}
            </span>
            <Entrant entrant={entrant} />
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:gap-3">
              {status(entrant)?.playing && <Badge tone="green">Playing</Badge>}
              {status(entrant) && <span className="font-black tabular-nums text-slate-200">{status(entrant).wins}–{status(entrant).losses}</span>}
              {entrant.seed ? <span className="hidden sm:inline">Seed {entrant.seed}</span> : ""}
              <PrizeText prize={entrant.prize} team={team} players={entrant.members?.length} className="text-sm" />
            </span>
          </div>
        ))}
        <Pagination page={page} totalPages={Math.ceil(played.length / perPage)} onChange={setPage} />
        {absent.length > 0 && (
          <details className="group border-t border-slate-800" open={Boolean(term) && !played.length}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-bold text-slate-400 hover:text-slate-200">
              <span className="transition group-open:rotate-90" aria-hidden="true">›</span>
              Registered, didn't play ({number(absent.length)})
            </summary>
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 pb-3 text-sm">
              {absent.map((entrant) => {
                const members = entrant.members ?? [];
                const dq = entrant.sets_dq ? " (DQ)" : "";
                if (members.length > 1) {
                  return (
                    <span key={entrant.id} className="inline-flex flex-col leading-tight">
                      {members.map((member, index) => (member.playerId
                        ? <a key={`${member.playerId}:${index}`} href={`/esports/player/id/${member.playerId}`} className="font-semibold text-slate-400 hover:text-blue-400">{member.name}{index === members.length - 1 ? dq : ""}</a>
                        : <span key={index} className="font-semibold text-slate-400">{member.name}{index === members.length - 1 ? dq : ""}</span>))}
                    </span>
                  );
                }
                const label = members.length ? members[0].name : cleanEntrantName(entrant.name);
                const solo = members[0];
                return solo?.playerId
                  ? <a key={entrant.id} href={`/esports/player/id/${solo.playerId}`} className="font-semibold text-slate-400 hover:text-blue-400">{label}{dq}</a>
                  : <span key={entrant.id} className="font-semibold text-slate-400">{label}{dq}</span>;
              })}
            </div>
          </details>
        )}
      </Card>
    </div>
  );
}

function Matches({ eventId, sets }) {
  const [layout, setLayout] = useQueryState("layout", "bracket");
  const [walkovers, setWalkovers] = useQueryState("walkovers", "");
  const showAll = walkovers === "show";
  const hiddenCount = sets.filter((set) => !isPlayedSet(set)).length;
  const shown = showAll ? sets : sets.filter(isPlayedSet);
  const streamed = shown.filter((set) => set.stream || set.youtube?.featured);
  const layouts = [["bracket", "Bracket"], ["list", "List"], ...(streamed.length ? [["stream", `On stream (${streamed.length})`]] : [])];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border text-sm font-black border-slate-700 bg-slate-900">
          {layouts.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setLayout(key)} className={`px-3 py-2 transition ${layout === key ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{label}</button>
          ))}
        </div>
        {layout !== "bracket" && hiddenCount > 0 && (
          <Toggle label={`Show DQs and byes (${number(hiddenCount)})`} checked={showAll} onChange={(checked) => setWalkovers(checked ? "show" : "")} />
        )}
      </div>
      {layout === "stream" && streamed.length ? <StreamList sets={streamed} />
        : layout === "list" ? <RoundList sets={shown} hidden={showAll ? 0 : hiddenCount} /> : <BracketView eventId={eventId} />}
    </div>
  );
}

const closeSet = (set) => (set.state === "complete" || (set.slots ?? []).some((slot) => slot.winner) ? set : { ...set, state: "unfinished" });
const setStatus = (set) => set.state === "unfinished" ? "unfinished" : (set.state === "active" && (set.slots ?? []).length === 2 && !(set.slots ?? []).some((slot) => slot.winner) ? "live"
  : set.state === "complete" || (set.slots ?? []).some((slot) => slot.winner) ? "done" : "upcoming");
const setRecency = (set) => new Date(set.history_at ?? set.observed_at ?? 0).getTime();
const byLatest = (left, right) => setRecency(right) - setRecency(left) || (right.set_order ?? 0) - (left.set_order ?? 0);

function StreamList({ sets }) {
  const order = { live: 0, upcoming: 1, done: 2, unfinished: 3 };
  const sections = [["live", "Live now"], ["upcoming", "Coming up"], ["done", "Played on stream"], ["unfinished", "Never finished"]]
    .map(([key, title]) => [title, sets.filter((set) => setStatus(set) === key)
      .sort(key === "upcoming" ? (left, right) => (left.set_order ?? 0) - (right.set_order ?? 0) : byLatest)])
    .filter(([, list]) => list.length);
  return (
    <div className="grid gap-3">
      {sections.map(([title, list]) => (
        <Card key={title} title={title} action={<span className="text-xs font-bold text-slate-500">{list.length} {list.length === 1 ? "match" : "matches"}</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[137.5rem]:grid-cols-5">
            {[...list].sort((left, right) => order[setStatus(left)] - order[setStatus(right)]).map((set) => (
              <div key={set.id} className="grid gap-1">
                <span className="truncate text-[11px] font-black uppercase tracking-wider text-slate-500">{set.round_name ?? "Match"}</span>
                <SetCard set={set} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

const TICKER_CSS = `@keyframes esports-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.esports-ticker-track { animation: esports-ticker var(--ticker-duration, 60s) linear infinite; }
.esports-ticker:hover .esports-ticker-track, .esports-ticker:focus-within .esports-ticker-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .esports-ticker { overflow-x: auto; } .esports-ticker-track { animation: none; } .esports-ticker-copy { display: none; } }`;

function TickerItem({ set, copy = false }) {
  const slots = set.slots ?? [];
  const legends = [...new Set(reportedGames(set).flatMap((game) => gamePicks(game).map((pick) => pick.legend)).filter(Boolean))].slice(0, 4);
  const decided = slots.some((slot) => slot.winner);
  return (
    <a
      href={`/esports/set/${set.id}`}
      tabIndex={copy ? -1 : undefined}
      aria-hidden={copy || undefined}
      className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-xs transition hover:border-emerald-500 bg-slate-900"
    >
      {setStatus(set) === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-label="Live" />}
      <span className="max-w-[7rem] truncate font-bold uppercase tracking-wide text-slate-400">{String(set.round_name ?? "").split(" - ").pop()}</span>
      {slots.map((slot, index) => (
        <React.Fragment key={slot.entrantId ?? index}>
          {index > 0 && <span className="text-slate-400">–</span>}
          <SlotName slot={slot} className={`max-w-[9rem] ${slot.winner ? "font-black text-white" : "font-semibold text-slate-500"}`} />
          <span className="font-black tabular-nums text-slate-200">{resultMark(set, slot, Boolean(slot.winner), decided)}</span>
        </React.Fragment>
      ))}
      {legends.length > 0 && (
        <span className="flex -space-x-1.5">
          {legends.map((legend) => (
            <img key={legend} src={`${host}/game/legends/art/${encodeURIComponent(legend)}`} alt="" className="h-5 w-5 rounded-full border object-cover border-slate-900 bg-slate-800" />
          ))}
        </span>
      )}
    </a>
  );
}

function MatchTicker({ sets }) {
  const items = useMemo(() => sets.filter((set) => reportedGames(set).length && isPlayedSet(set)).sort(byLatest).slice(0, 20), [sets]);
  if (!items.length) return null;
  return (
    <section className="mb-3 flex items-center gap-3 overflow-hidden rounded-xl border py-2 pl-3 border-slate-800 bg-slate-950" aria-label="Latest results with match data">
      <style>{TICKER_CSS}</style>
      <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Match Data</span>
      <div className="esports-ticker min-w-0 flex-1 overflow-hidden">
        <div className="esports-ticker-track flex w-max gap-2 pr-2" style={{ "--ticker-duration": `${Math.max(30, items.length * 6)}s` }}>
          {items.map((set) => <TickerItem key={set.id} set={set} />)}
          <span className="esports-ticker-copy flex gap-2">{items.map((set) => <TickerItem key={`copy-${set.id}`} set={set} copy />)}</span>
        </div>
      </div>
    </section>
  );
}


const CARD_W = 232;
const CARD_H = 58;
const ROW_GAP = 14;
const COL_GAP = 44;
const HEADER_H = 44;
const PILL_W = 150;
const PILL_H = 20;
const PILL_GAP = 20;

const linkLabel = (link) => (link.groupName
  ? `${link.phaseName} ${/^\d+$/.test(link.groupName) ? `Pool ${link.groupName}` : link.groupName}`
  : link.phaseName);

function PhasePill({ link, onJump, className = "", style }) {
  return (
    <button
      type="button"
      onClick={() => onJump?.(link)}
      title={`Go to ${linkLabel(link)}`}
      className={`flex items-center justify-center rounded-full border px-2.5 text-[11px] font-bold transition hover:border-blue-400 border-slate-700 bg-slate-900 text-slate-400 hover:text-blue-300 ${className}`}
      style={{ height: PILL_H, ...style }}
    >
      <span className="truncate">{linkLabel(link)}</span>
    </button>
  );
}

const slotRows = (set) => {
  const rows = [null, null];
  set.slots.forEach((slot, index) => {
    const position = set.positions?.[index] ?? index;
    rows[position === 0 || position === 1 ? (rows[position] ? 1 - position : position) : rows.indexOf(null)] = slot;
  });
  return rows;
};

const entrantLabel = (entrant) => {
  if (!entrant) return "TBD";
  const members = (entrant.members ?? []).map((member) => member.name).filter(Boolean);
  return members.length ? members.join(" / ") : cleanEntrantName(String(entrant.name ?? ""));
};

const groupKind = (group) => (group.type === "round_robin" ? "Round robin" : group.type === "swiss" ? "Swiss"
  : group.sections.some((section) => section.key === "losers") ? "Double elimination" : "Single elimination");

const LegendNames = createContext((code) => code);
const BracketCardHeight = createContext(CARD_H);
const TEAM_CARD_H = 84;

function BracketView({ eventId }) {
  const bracket = useApi(apiUrl(`/events/${eventId}/bracket`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: (data) => data?.live });
  const legendName = useLegendName();
  const [phaseKey, setPhaseKey] = useState(null);
  const [groupKey, setGroupKey] = useState(null);
  const [hovered, setHovered] = useState(null);
  const data = bracket.data;
  if (bracket.error) return <ErrorNote message={bracket.error} onRetry={bracket.retry} />;
  if (!data) return <Card><Loading label="Loading the bracket. Older start.gg events take longer the first time." /></Card>;
  if (!data.phases.length) return <Card><Empty>No matches were recorded for this event.</Empty></Card>;
  const phase = data.phases.find((item) => item.key === phaseKey) ?? finalPhase(data.phases);
  const group = phase.groups.find((item) => item.key === groupKey) ?? phase.groups[0];
  const jump = (link) => { setPhaseKey(link.phaseKey); setGroupKey(link.groupKey); };
  const teams = Object.values(data.entrants ?? {}).some((entrant) => teamOf(entrant));

  return (
    <LegendNames.Provider value={legendName}>
    <BracketCardHeight.Provider value={teams ? TEAM_CARD_H : CARD_H}>
    <div className="grid gap-3">
      {data.phases.length > 1 && (
        <Tabs
          value={phase.key}
          onChange={(value) => { setPhaseKey(value); setGroupKey(null); }}
          tabs={data.phases.map((item) => ({ key: item.key, label: item.name, count: item.groups.length > 1 ? item.groups.length : undefined }))}
        />
      )}
      {phase.groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {phase.groups.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setGroupKey(item.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-black transition ${item.key === group.key ? "border-blue-500 bg-blue-500 text-white" : "hover:border-blue-400 border-slate-700 bg-slate-900 text-slate-200"}`}
            >
              {item.name ? `Pool ${item.name}` : "Pool"}
            </button>
          ))}
        </div>
      )}
      {!data.metadataComplete && <p className="text-xs font-semibold text-amber-600">start.gg couldn't be reached, so pools may be shown merged.</p>}
      <Card padded={false} title={`${phase.name}${group.name && phase.groups.length > 1 ? ` · Pool ${group.name}` : ""}`} action={<Badge>{groupKind(group)}</Badge>}>
        {group.type === "elimination"
          ? (
            <EliminationGroup
              key={`${phase.key}:${group.key}`}
              group={group}
              entrants={data.entrants}
              hovered={hovered}
              onHover={setHovered}
              onJump={jump}
              sliced={phase === finalPhase(data.phases) && phase.groups.length === 1}
            />
          )
          : <PoolView group={group} entrants={data.entrants} hovered={hovered} onHover={setHovered} onJump={jump} />}
      </Card>
    </div>
    </BracketCardHeight.Provider>
    </LegendNames.Provider>
  );
}


function useDragScroll() {
  const ref = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const end = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    ref.current?.classList.remove("cursor-grabbing");
  };
  return {
    ref,
    onPointerDown: (event) => {
      if (event.button !== 0 || event.pointerType === "touch" || !ref.current) return;
      drag.current = { x: event.clientX, y: event.clientY, left: ref.current.scrollLeft, top: ref.current.scrollTop, moved: false };
    },
    onPointerMove: (event) => {
      const current = drag.current;
      if (!current || !ref.current) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      current.moved = true;
      ref.current.classList.add("cursor-grabbing");
      ref.current.scrollLeft = current.left - dx;
      ref.current.scrollTop = current.top - dy;
    },
    onPointerUp: end,
    onPointerLeave: end,
    onClickCapture: (event) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart: (event) => event.preventDefault(),
  };
}

function EliminationGroup({ group, entrants, hovered, onHover, onJump, sliced }) {
  const columns = group.sections.flatMap((section) => section.columns);
  const entrantCount = Math.max(
    new Set(columns.flatMap((column) => column.sets.flatMap((set) => set.slots.map((slot) => slot.entrantId)))).size,
    ...columns.map((column) => column.remaining ?? 0),
  );
  const tiers = [...new Set(columns.map((column) => column.remaining).filter((remaining) => remaining != null && remaining >= 8 && remaining < entrantCount))]
    .sort((left, right) => right - left);
  const playing = Math.max(0, ...columns.filter((column) => column.sets.some((set) => set.state !== "complete")).map((column) => column.remaining ?? 0));
  const [slice, setSlice] = useState(() => {
    if (!sliced || !tiers.length) return "all";
    return playing ? [...tiers].reverse().find((tier) => tier >= playing) ?? "all" : tiers[tiers.length - 1];
  });
  const [from, setFrom] = useState(null);
  const scroller = useDragScroll();
  const visible = (column) => (from
    ? (column.remaining ?? 0) <= from.remaining
    : slice === "all" || (column.remaining ?? 0) <= slice);
  const sections = group.sections
    .map((section) => ({ ...section, columns: section.columns.filter(visible) }))
    .filter((section) => section.columns.length);
  const button = (active) => `rounded-lg border px-3 py-1.5 text-xs font-black transition ${active ? "border-blue-500 bg-blue-500 text-white" : "hover:border-blue-400 border-slate-700 text-slate-200"}`;

  return (
    <div>
      {((sliced && tiers.length > 0) || from) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-3 border-slate-800">
          {sliced && tiers.length > 0 && (
            <>
              <button type="button" onClick={() => { setSlice("all"); setFrom(null); }} className={button(!from && slice === "all")}>Top {entrantCount}</button>
              {tiers.map((tier) => (
                <button key={tier} type="button" onClick={() => { setSlice(tier); setFrom(null); }} className={button(!from && slice === tier)}>Top {tier}</button>
              ))}
            </>
          )}
          {from && (
            <button type="button" onClick={() => setFrom(null)} className="ml-auto rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-black text-blue-300">
              From {from.name} ✕
            </button>
          )}
        </div>
      )}
      <div
        ref={scroller.ref}
        onPointerDown={scroller.onPointerDown}
        onPointerMove={scroller.onPointerMove}
        onPointerUp={scroller.onPointerUp}
        onPointerLeave={scroller.onPointerLeave}
        onClickCapture={scroller.onClickCapture}
        onDragStart={scroller.onDragStart}
        className="max-h-[80vh] cursor-grab select-none overflow-auto p-3"
      >
        {sections.map((section) => (
          <EliminationSection
            key={section.key}
            section={section}
            entrants={entrants}
            hovered={hovered}
            onHover={onHover}
            onJump={onJump}
            showTitle={group.sections.length > 1}
            onPickColumn={(column) => setFrom(column)}
          />
        ))}
        {!sections.length && <Empty>No matches in this part of the bracket.</Empty>}
      </div>
      <p className="border-t px-3 py-2 text-[11px] font-semibold text-slate-500 border-slate-800">
        <span className="block max-w-prose">Drag to move around. Click a round's name to start the bracket there; losers rounds are trimmed to match.</span>
      </p>
    </div>
  );
}

function EliminationSection({ section, entrants, hovered, onHover, onJump, showTitle, onPickColumn }) {
  const CARD_H = useContext(BracketCardHeight);
  const layout = useMemo(() => {
    const step = CARD_H + ROW_GAP;
    const columns = section.columns;
    const ys = columns.map(() => new Map());
    const anchor = columns.reduce((best, column, index) => (column.sets.length > columns[best].sets.length ? index : best), 0);
    columns[anchor]?.sets.forEach((set, position) => ys[anchor].set(set.id, position * step));
    for (let index = anchor + 1; index < columns.length; index++) {
      let cursor = 0;
      for (const set of columns[index].sets) {
        const fed = set.feeders.map((id) => ys[index - 1].get(id)).filter((value) => value != null);
        const y = Math.max(cursor, fed.length ? fed.reduce((total, value) => total + value, 0) / fed.length : cursor);
        ys[index].set(set.id, y);
        cursor = y + step;
      }
    }
    for (let index = anchor - 1; index >= 0; index--) {
      const own = new Set(columns[index].sets.map((set) => set.id));
      const targets = new Map();
      for (const parent of columns[index + 1].sets) {
        const fed = parent.feeders.filter((id) => own.has(id));
        const parentY = ys[index + 1].get(parent.id);
        fed.forEach((id, position) => targets.set(id, parentY + (fed.length > 1 ? (position - (fed.length - 1) / 2) * step : 0)));
      }
      const ordered = [...columns[index].sets].sort((left, right) =>
        (targets.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (targets.get(right.id) ?? Number.MAX_SAFE_INTEGER));
      let cursor = -Infinity;
      for (const set of ordered) {
        const y = Math.max(cursor, targets.get(set.id) ?? (Number.isFinite(cursor) ? cursor : 0));
        ys[index].set(set.id, y);
        cursor = y + step;
      }
    }
    const top = Math.min(0, ...ys.flatMap((column) => [...column.values()]));
    if (top < 0) ys.forEach((column) => column.forEach((y, id) => column.set(id, y - top)));
    const height = Math.max(CARD_H, ...ys.flatMap((column) => [...column.values()].map((y) => y + CARD_H)));
    const left = section.columns[0]?.sets.some((set) => (set.from && Object.keys(set.from).length) || set.sources?.some(Boolean)) ? PILL_W + PILL_GAP : 0;
    const right = section.columns.some((column) => column.sets.some((set) => set.next)) ? PILL_GAP + PILL_W : 0;
    return { ys, height, left, width: left + section.columns.length * (CARD_W + COL_GAP) - COL_GAP + right };
  }, [section, CARD_H]);
  const x = (index) => layout.left + index * (CARD_W + COL_GAP);
  const incoming = layout.left ? (section.columns[0]?.sets ?? []).flatMap((set) => slotRows(set).map((slot, row) => {
    const link = slot ? set.from?.[slot.entrantId] : set.sources?.[row];
    return link ? { key: `${set.id}:${row}`, link, y: layout.ys[0].get(set.id) + CARD_H / 4 + row * (CARD_H / 2) } : null;
  }).filter(Boolean)) : [];
  const outgoing = section.columns.flatMap((column, index) => column.sets.filter((set) => set.next)
    .map((set) => ({ key: set.id, link: set.next, x: x(index) + CARD_W, y: layout.ys[index].get(set.id) + CARD_H / 2 })));

  return (
    <div className="mb-3 last:mb-0">
      {showTitle && <div className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">{section.name}</div>}
      <div>
        <div className="relative" style={{ width: layout.width, height: layout.height + HEADER_H }}>
          {section.columns.map((column, index) => (
            <button
              key={column.key}
              type="button"
              onClick={() => onPickColumn?.(column)}
              title="Show the bracket from this round"
              className="absolute top-0 rounded-md px-1 text-center transition hover:bg-slate-800"
              style={{ left: x(index), width: CARD_W, height: HEADER_H - 6 }}
            >
              <div className="truncate text-xs font-black uppercase tracking-wider text-slate-300">{column.name}</div>
              <div className="text-[11px] font-bold text-slate-400">
                {[column.placement && `Losers place ${ordinal(column.placement)}`, column.advances && "Winners advance"].filter(Boolean).join(" · ") ||
                  `${column.sets.length} ${column.sets.length === 1 ? "match" : "matches"}`}
              </div>
            </button>
          ))}
          <svg className="pointer-events-none absolute left-0" style={{ top: HEADER_H }} width={layout.width} height={layout.height}>
            {section.columns.flatMap((column, index) => column.sets.flatMap((set) => set.feeders.map((feederId) => {
              const fromY = layout.ys[index - 1]?.get(feederId);
              if (fromY == null) return null;
              const x1 = x(index - 1) + CARD_W;
              const x2 = x(index);
              const middle = x1 + COL_GAP / 2;
              const y1 = fromY + CARD_H / 2;
              const y2 = layout.ys[index].get(set.id) + CARD_H / 2;
              return <path key={`${feederId}-${set.id}`} d={`M${x1},${y1} H${middle} V${y2} H${x2}`} fill="none" className="stroke-slate-600" strokeWidth="1.5" />;
            })))}
            {incoming.map((item) => (
              <path key={`in-${item.key}`} d={`M${PILL_W},${item.y} H${layout.left}`} fill="none" strokeDasharray="3 3" className="stroke-slate-600" strokeWidth="1.5" />
            ))}
            {outgoing.map((item) => (
              <path key={`out-${item.key}`} d={`M${item.x},${item.y} H${item.x + PILL_GAP}`} fill="none" strokeDasharray="3 3" className="stroke-slate-600" strokeWidth="1.5" />
            ))}
          </svg>
          {incoming.map((item) => (
            <PhasePill key={`in-${item.key}`} link={item.link} onJump={onJump} className="absolute" style={{ left: 0, top: HEADER_H + item.y - PILL_H / 2, width: PILL_W }} />
          ))}
          {outgoing.map((item) => (
            <PhasePill key={`out-${item.key}`} link={item.link} onJump={onJump} className="absolute" style={{ left: item.x + PILL_GAP, top: HEADER_H + item.y - PILL_H / 2, width: PILL_W }} />
          ))}
          {section.columns.map((column, index) => column.sets.map((set) => (
            <div key={set.id} className="absolute" style={{ left: x(index), top: HEADER_H + layout.ys[index].get(set.id), width: CARD_W, height: CARD_H }}>
              <BracketCard set={set} entrants={entrants} hovered={hovered} onHover={onHover} />
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}

const slotResult = (set, slot, decided, won) => resultMark(set, slot, won, decided);

function PeekTeam({ entrant, align = "left" }) {
  const team = teamOf(entrant);
  if (!team) return <span className={`truncate ${align === "right" ? "text-right" : ""}`}>{entrantLabel(entrant)}</span>;
  return (
    <span className={`flex min-w-0 flex-col leading-tight ${align === "right" ? "items-end text-right" : ""}`}>
      {team.map((member, index) => <span key={`${member.playerId ?? member.name}:${index}`} className="max-w-full truncate">{member.name}</span>)}
    </span>
  );
}

function GamesPeek({ set, entrants, rect }) {
  const legendName = useContext(LegendNames);
  const width = set.slots.some((slot) => teamOf(entrants[slot?.entrantId])) ? 380 : 320;
  const left = rect.right + 8 + width <= window.innerWidth ? rect.right + 8 : Math.max(8, rect.left - 8 - width);
  const vertical = rect.top > window.innerHeight / 2 ? { bottom: Math.max(8, window.innerHeight - rect.bottom) } : { top: Math.max(8, rect.top) };
  const slots = [set.slots[0] ?? null, set.slots[1] ?? null];
  const side = (game, index) => {
    const slot = slots[index];
    const picks = slot ? game.picks.filter((pick) => pick.entrantId === slot.entrantId) : [];
    const won = Boolean(slot) && game.winnerEntrantId === slot.entrantId;
    const lost = Boolean(slot) && game.winnerEntrantId != null && !won;
    const team = slot ? teamOf(entrants[slot.entrantId]) : null;
    const byPlayer = team && picks.length && picks.every((pick) => team.some((member) => String(member.playerId) === String(pick.playerId)))
      ? team.map((member) => ({ member, picks: picks.filter((pick) => String(pick.playerId) === String(member.playerId)) }))
      : null;
    const mark = (won || lost) && <span className={`w-4 shrink-0 text-center text-xs font-black ${won ? "text-emerald-500" : "text-rose-500"}`}>{won ? "W" : "L"}</span>;
    if (byPlayer) {
      return (
        <div className={`flex min-w-0 items-center gap-1 ${index ? "flex-row-reverse" : ""}`}>
          {mark}
          <div className="grid min-w-0 flex-1 gap-0.5">
            {byPlayer.map(({ member, picks: own }, row) => (
              <div key={`${member.playerId}:${row}`} className={`flex min-w-0 items-center gap-1 ${index ? "flex-row-reverse" : ""}`}>
                {own.map((pick, position) => (
                  <img key={`${pick.legend}:${position}`} src={`${host}/game/legends/art/${encodeURIComponent(pick.legend)}`} alt={legendName(pick.legend)} title={legendName(pick.legend)} className={`h-6 w-6 shrink-0 rounded object-cover bg-slate-800 ${lost ? "opacity-50" : ""}`} />
                ))}
                <span className="min-w-0 truncate text-[10px] font-bold text-slate-400">{member.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className={`flex min-w-0 items-center gap-1 ${index ? "flex-row-reverse" : ""}`}>
        {mark}
        {picks.map((pick, position) => (
          <img
            key={`${pick.legend}:${position}`}
            src={`${host}/game/legends/art/${encodeURIComponent(pick.legend)}`}
            alt={legendName(pick.legend)}
            title={legendName(pick.legend)}
            className={`h-8 w-8 shrink-0 rounded-md object-cover bg-slate-800 ${lost ? "opacity-50" : ""}`}
          />
        ))}
      </div>
    );
  };
  return createPortal(
    <div className="pointer-events-none fixed z-50 rounded-xl border p-2 shadow-xl border-slate-700 bg-slate-900" style={{ left, width, ...vertical }}>
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs font-black text-white">
        <PeekTeam entrant={entrants[slots[0]?.entrantId]} />
        <span className="tabular-nums text-slate-500">{slotResult(set, slots[0], Boolean(set.winnerEntrantId), set.winnerEntrantId === slots[0]?.entrantId)} – {slotResult(set, slots[1], Boolean(set.winnerEntrantId), set.winnerEntrantId === slots[1]?.entrantId)}</span>
        <PeekTeam entrant={entrants[slots[1]?.entrantId]} align="right" />
      </div>
      <div className="grid gap-1.5">
        {reportedGames(set).map((game) => (
          <div key={game.number} className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] items-center gap-2 rounded-lg p-1.5 bg-slate-800/60">
            {side(game, 0)}
            <div className="flex min-w-0 flex-col items-center gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Game {game.number}</span>
              {game.map && (
                <img
                  src={`${host}/game/maps/thumbnail/${encodeURIComponent(game.map)}`}
                  alt=""
                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                  className="h-8 w-14 rounded object-cover bg-slate-800"
                />
              )}
              {game.map && <span className="max-w-full truncate text-[10px] font-bold text-slate-500" title={mapName(game.map)}>{mapName(game.map)}</span>}
            </div>
            {side(game, 1)}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function useGamesPeek(set) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [rect, setRect] = useState(null);
  const close = () => { clearTimeout(timer.current); setRect(null); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!rect) return undefined;
    window.addEventListener("scroll", close, true);
    window.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("pointerdown", close, true);
    };
  }, [rect]);
  const open = () => {
    if (!reportedGames(set).length) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (ref.current) setRect(ref.current.getBoundingClientRect()); }, 200);
  };
  return { ref, rect, open, close };
}

function BracketCard({ set, entrants, hovered, onHover }) {
  const rows = slotRows(set);
  const reported = reportedGames(set).length;
  const decided = Boolean(set.winnerEntrantId);
  const live = set.state === "active" && set.slots.length === 2 && !decided;
  const peek = useGamesPeek(set);
  return (
    <a ref={peek.ref} onMouseEnter={peek.open} onMouseLeave={peek.close} href={`/esports/set/${set.id}`} draggable={false} className={`relative flex h-full flex-col rounded-lg border shadow-sm transition hover:border-blue-400 bg-slate-950 ${reported ? "pt-1" : ""} ${live ? "border-amber-500/70" : reported ? "border-emerald-500/50" : "border-slate-700"}`}>
      {peek.rect && <GamesPeek set={set} entrants={entrants} rect={peek.rect} />}
      {(set.stream || set.youtube) && <StreamBadge stream={set.stream} youtube={set.youtube} className="absolute -top-2 right-1 z-10" />}
      {reported > 0 && <MatchDataBadge games={reported} compact className="absolute left-8 top-0 z-10 -translate-y-1/2" />}
      {rows.map((slot, index) => {
        const entrant = slot ? entrants[slot.entrantId] : null;
        const won = Boolean(slot) && set.winnerEntrantId === slot.entrantId;
        const lit = Boolean(slot) && hovered === slot.entrantId;
        return (
          <div
            key={index}
            onMouseEnter={() => slot && onHover(slot.entrantId)}
            onMouseLeave={() => onHover(null)}
            className={`flex flex-1 items-center gap-2 px-2 text-sm ${index ? "border-t border-slate-800" : ""} ${lit ? "bg-blue-500/20" : ""}`}
          >
            <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-400">{entrant?.seed ?? ""}</span>
            {slot && teamOf(entrant)
              ? (
                <span className={`flex min-w-0 flex-1 flex-col text-xs leading-tight ${won ? "font-black text-white" : decided ? "font-semibold text-slate-500" : "font-semibold text-slate-200"}`}>
                  {teamOf(entrant).map((member, position) => <span key={`${member.playerId ?? member.name}:${position}`} className="truncate">{member.name}</span>)}
                </span>
              )
              : (
                <span className={`min-w-0 flex-1 truncate ${won ? "font-black text-white" : slot ? (decided ? "font-semibold text-slate-500" : "font-semibold text-slate-200") : "italic text-slate-400"}`}>
                  {slot ? entrantLabel(entrant) : set.slots.length === 1 && set.state === "complete" ? "Bye" : set.sources?.[index] ? `From ${linkLabel(set.sources[index])}` : "TBD"}
                </span>
              )}
            <span className={`w-7 shrink-0 rounded text-center text-xs font-black tabular-nums ${won ? "bg-emerald-500 text-white" : slot && decided ? "bg-slate-800 text-slate-300" : slot && live ? "bg-amber-500/20 text-amber-200" : ""}`}>
              {slotResult(set, slot, decided, won)}
            </span>
          </div>
        );
      })}
    </a>
  );
}

function PoolView({ group, entrants, hovered, onHover, onJump }) {
  const cardHeight = useContext(BracketCardHeight);
  const order = group.standings.map((row) => row.entrantId);
  const roundRobin = group.type === "round_robin";
  const advancing = group.standings.some((row) => row.next);
  return (
    <div className="grid gap-3 p-3">
      <ScrollX>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="w-10 px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Entrant</th>
              {roundRobin && order.map((id, index) => <th key={id} className="w-14 px-1 py-2 text-center" title={entrantLabel(entrants[id])}>vs {index + 1}</th>)}
              <th className="w-16 px-2 py-2 text-center">Sets</th>
              <th className="w-16 px-2 py-2 text-center">Games</th>
              {advancing && <th className="w-40 px-2 py-2 text-left">Advances to</th>}
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row, rowIndex) => {
              const entrant = entrants[row.entrantId];
              const solo = entrant?.members?.length === 1 ? entrant.members[0] : null;
              return (
                <tr key={row.entrantId} onMouseEnter={() => onHover(row.entrantId)} onMouseLeave={() => onHover(null)} className={`border-t border-slate-800 ${hovered === row.entrantId ? "bg-blue-500/10" : ""}`}>
                  <td className="px-2 py-2 font-black tabular-nums text-slate-500">{rowIndex + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {teamOf(entrant)
                        ? <span className="flex min-w-0 flex-col gap-1">{teamOf(entrant).map((member, index) => <PlayerName key={`${member.playerId ?? member.name}:${index}`} member={member} tone="font-black text-white" />)}</span>
                        : (
                          <>
                            <Avatar src={solo?.image} name={entrantLabel(entrant)} size="sm" playerId={solo?.playerId} />
                            {solo?.playerId
                              ? <a href={`/esports/player/id/${solo.playerId}`} className="truncate font-black hover:text-blue-500 text-white">{entrantLabel(entrant)}</a>
                              : <span className="truncate font-black text-white">{entrantLabel(entrant)}</span>}
                          </>
                        )}
                      {entrant?.seed && <span className="shrink-0 text-xs font-semibold text-slate-400">Seed {entrant.seed}</span>}
                    </div>
                  </td>
                  {roundRobin && order.map((opponentId) => {
                    if (opponentId === row.entrantId) return <td key={opponentId} className="bg-slate-800/60" />;
                    const result = group.results[`${row.entrantId}:${opponentId}`];
                    if (!result) return <td key={opponentId} className="text-center text-slate-700">—</td>;
                    const tone = result.won ? "bg-emerald-500/15 text-emerald-300" : result.won === false ? "bg-rose-500/15 text-rose-300" : "text-slate-500";
                    return (
                      <td key={opponentId} className="p-0.5 text-center">
                        <a href={`/esports/set/${result.setId}`} className={`block rounded py-1.5 text-xs font-black tabular-nums ${tone}`}>
                          {result.dq || Number(result.score) < 0 ? "DQ" : Number(result.opponentScore) < 0 ? "W" : result.score != null && result.opponentScore != null ? `${result.score}-${result.opponentScore}` : result.won ? "W" : "L"}
                        </a>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-black tabular-nums"><span className="text-emerald-500">{row.wins}</span>-<span className="text-rose-500">{row.losses}</span></td>
                  <td className="px-2 py-2 text-center font-semibold tabular-nums text-slate-500">{row.gameWins}-{row.gameLosses}</td>
                  {advancing && <td className="px-2 py-2">{row.next && <PhasePill link={row.next} onJump={onJump} className="max-w-40" />}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">
        {group.rounds.map((round) => (
          <div key={round.key} className="rounded-xl border p-2 border-slate-800">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{round.name}</div>
            <div className="grid gap-2">
              {round.sets.map((set) => (
                <div key={set.id} style={{ height: cardHeight }}><BracketCard set={set} entrants={entrants} hovered={hovered} onHover={onHover} /></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundList({ sets, hidden = 0 }) {
  const [round, setRound] = useState("all");
  const rounds = useMemo(() => {
    const ordered = [...sets].sort((left, right) => (left.set_order ?? 0) - (right.set_order ?? 0));
    const groups = new Map();
    for (const set of ordered) {
      const name = set.round_name || "Matches";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(set);
    }
    return [...groups.entries()];
  }, [sets]);
  if (!sets.length) return <Card><Empty>{hidden ? "Every match in this event was a DQ or a bye." : "No matches were recorded for this event."}</Empty></Card>;
  const visible = round === "all" ? rounds : rounds.filter(([name]) => name === round);
  return (
    <div className="grid gap-3">
      <div className="max-w-xs">
        <Select label="Round" value={round} onChange={setRound} options={[["all", "All rounds"], ...rounds.map(([name]) => [name, name])]} />
      </div>
      {visible.map(([name, roundSets]) => (
        <Card key={name} title={name} action={<span className="text-xs font-bold text-slate-500">{roundSets.length} {roundSets.length === 1 ? "match" : "matches"}</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[137.5rem]:grid-cols-5">
            {roundSets.map((set) => <SetCard key={set.id} set={set} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function MatchDataBadge({ games, compact = false, className = "" }) {
  return (
    <span title="Legends and maps were recorded for this match" className={`inline-flex items-center rounded-full bg-emerald-600 px-1.5 font-black text-white shadow ${compact ? "text-[9px] leading-[14px]" : "py-0.5 text-[10px]"} ${className}`}>
      {games} {games === 1 ? "game" : "games"} · data
    </span>
  );
}

function SetCard({ set }) {
  const slots = set.slots ?? [];
  const decided = slots.some((slot) => slot.winner);
  return (
    <a href={`/esports/set/${set.id}`} className="rounded-lg border transition hover:border-blue-400 border-slate-800">
      {slots.map((slot, index) => (
        <div key={slot.entrantId ?? index} className={`flex items-center justify-between gap-2 px-3 py-1.5 ${index ? "border-t border-slate-800" : ""}`}>
          <SlotName slot={slot} className={`text-sm ${slot.winner ? "font-black text-white" : "font-semibold text-slate-500"}`} />
          <span title={resultMark(set, slot, Boolean(slot.winner), decided) === "DQ" ? "Disqualified or didn't show up" : undefined} className={`text-sm tabular-nums ${slot.winner ? "font-black text-white" : "font-semibold text-slate-500"}`}>{resultMark(set, slot, Boolean(slot.winner), decided)}</span>
        </div>
      ))}
      {slots.length === 1 && <div className="border-t px-3 py-1.5 text-xs font-semibold text-slate-400 border-slate-800">Bye</div>}
      {(set.stream || set.youtube || reportedGames(set).length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-1.5 border-slate-800">
          {(set.stream || set.youtube) && <StreamBadge stream={set.stream} youtube={set.youtube} />}
          {reportedGames(set).length > 0 && <MatchDataBadge games={reportedGames(set).length} />}
        </div>
      )}
    </a>
  );
}

const eventPoints = (row) => Math.round(
  (Number(row.placement_points) + Number(row.win_points) + Number(row.loss_points)) * Number(row.tournament_multiplier ?? 1) * 1000,
) / 1000;

function Points({ contributions }) {
  const place = (row) => row.details?.placement ?? Number.MAX_SAFE_INTEGER;
  const rows = [...contributions].sort((left, right) => eventPoints(right) - eventPoints(left) || place(left) - place(right));
  const multiplier = Number(contributions[0]?.tournament_multiplier ?? 1);
  return (
    <Card padded={false} className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3 border-slate-800">
        <p className="max-w-prose text-sm font-semibold text-slate-400">
          Power ranking points from this event: finish points, plus points for each player's 3 best wins (by the seed they beat) and first two losses (by how far the winner went){multiplier !== 1 ? `, times the event weight ×${multiplier}` : ""}.
        </p>
      </div>
      <ScrollX>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-black uppercase tracking-wider text-slate-500 border-slate-800">
              <th className="px-3 py-2">Player</th>
              <th className="px-2 py-2">Board</th>
              <th className="px-2 py-2 text-right">Place</th>
              <th className="px-2 py-2 text-right">Finish</th>
              <th className="px-2 py-2 text-right">Wins</th>
              <th className="px-2 py-2 text-right">Losses</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.player_id}:${row.region}`} className="border-b last:border-0 border-slate-800">
                <td className="px-3 py-2"><a href={`/esports/player/id/${row.player_id}`} className="font-black hover:text-blue-500 text-white">{row.display_name}</a></td>
                <td className="px-2 py-2 text-xs font-bold text-slate-500">{regionName(row.region)}</td>
                <td className="px-2 py-2 text-right font-bold">
                  {ordinal(row.details?.placement)}
                  {row.provisional && row.details?.placement != null && <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400" title="Still in: points for the worst place they can finish">or better</span>}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.placement_points)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.win_points)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.loss_points)}</td>
                <td className="px-3 py-2 text-right font-black tabular-nums">{points(eventPoints(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
    </Card>
  );
}
