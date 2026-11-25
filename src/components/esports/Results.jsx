import React, { createContext, useContext } from "react";
import { host } from "../../stuff";
import { useLegendNames } from "./MatchPages";
import { Avatar, Badge, cleanEntrantName, money, modeName, number, ordinal, regionName } from "./ui";

const LegendNameContext = createContext(null);

export function LegendNameProvider({ children }) {
  const name = useLegendNames();
  return <LegendNameContext.Provider value={name}>{children}</LegendNameContext.Provider>;
}

export const useLegendName = () => useContext(LegendNameContext) ?? ((code) => code);

export function dateRange(start, end) {
  const from = start ? new Date(start) : null;
  if (!from || Number.isNaN(from.getTime())) return "—";
  const format = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  const to = end ? new Date(end) : null;
  if (!to || Number.isNaN(to.getTime()) || to <= from || format.format(to) === format.format(from)) return format.format(from);
  return format.formatRange(from, to);
}

export const legendArt =(legend) => `${host}/game/legends/art/${encodeURIComponent(legend)}`;

export const placeTone = (place) => (Number(place) === 1 ? "text-amber-400" : Number(place) === 2 ? "text-slate-200" : Number(place) === 3 ? "text-orange-400" : "text-white");

export function LegendIcons({ legends, size = "sm", max = 3 }) {
  const legendName = useLegendName();
  const list = (legends ?? []).slice(0, max);
  if (!list.length) return null;
  const box = size === "md" ? "h-8 w-8" : "h-6 w-6";
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {list.map(({ legend, games }) => {
        const label = `${legendName(legend)} · ${number(games)} ${games === 1 ? "game" : "games"}`;
        return <img key={legend} src={legendArt(legend)} alt={label} title={label} loading="lazy" className={`${box} rounded-full border border-slate-700 bg-slate-800 object-cover`} />;
      })}
    </span>
  );
}

export const isTeam = (entrant) => (entrant?.members ?? []).length > 1;

export function PlayerName({ member, size = "sm", tone = "font-bold text-white" }) {
  const body = (
    <>
      <Avatar src={member.image} name={member.name} size={size} playerId={member.playerId} />
      <span className={`truncate ${tone}`}>{member.name ?? "Unknown player"}</span>
    </>
  );
  return member.playerId
    ? <a href={`/esports/player/id/${member.playerId}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">{body}</a>
    : <span className="flex min-w-0 items-center gap-2">{body}</span>;
}

function PlayerBlock({ member, size, legends, legendSize }) {
  const name = <span className="truncate font-bold text-white">{member.name ?? "Unknown player"}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={member.image} name={member.name} size={size} playerId={member.playerId} />
      <span className="grid min-w-0 gap-0.5">
        {member.playerId ? <a href={`/esports/player/id/${member.playerId}`} className="flex min-w-0 hover:opacity-80">{name}</a> : name}
        <LegendIcons legends={legends} size={legendSize} />
      </span>
    </span>
  );
}

export function Entrant({ entrant, size = "sm", legendSize = "sm", block = false, className = "" }) {
  const members = entrant.members ?? [];
  if (block) {
    const list = members.length ? members : [{ name: cleanEntrantName(entrant.name) }];
    const perPlayer = list.length < 2 || list.some((member) => member.legends?.length);
    return (
      <span className={`grid min-w-0 gap-1.5 ${className}`}>
        {list.map((member, index) => (
          <PlayerBlock key={`${member.playerId ?? member.name}:${index}`} member={member} size={size} legendSize={legendSize} legends={list.length < 2 ? entrant.legends : perPlayer ? member.legends : null} />
        ))}
        {!perPlayer && <LegendIcons legends={entrant.legends} size={legendSize} />}
      </span>
    );
  }
  if (members.length < 2) {
    return (
      <span className={`flex min-w-0 items-center gap-2 ${className}`}>
        {members.length ? <PlayerName member={members[0]} size={size} /> : <span className="truncate font-bold text-white">{cleanEntrantName(entrant.name)}</span>}
        <LegendIcons legends={entrant.legends} size={legendSize} />
      </span>
    );
  }
  const perPlayer = members.some((member) => member.legends?.length);
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="grid min-w-0 grid-cols-[minmax(0,max-content)_auto] items-center gap-x-2 gap-y-1">
        {members.map((member, index) => (
          <span key={`${member.playerId ?? member.name}:${index}`} className="contents">
            <PlayerName member={member} size={size} />
            <span className="flex min-w-0">{perPlayer && <LegendIcons legends={member.legends} size={legendSize} />}</span>
          </span>
        ))}
      </span>
      {!perPlayer && <LegendIcons legends={entrant.legends} size={legendSize} />}
    </span>
  );
}

export function TeamLines({ members, fallback, size = "xs", tone = "font-semibold text-slate-100", className = "" }) {
  const list = members ?? [];
  if (!list.length) return <span className={`min-w-0 truncate ${tone} ${className}`}>{fallback}</span>;
  return (
    <span className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      {list.map((member, index) => (
        <span key={`${member.playerId ?? member.name}:${index}`} className="flex min-w-0 items-center gap-1.5">
          {size && <Avatar src={member.image} name={member.name} size={size} playerId={member.playerId} />}
          <span className={`min-w-0 truncate ${tone}`}>{member.name ?? "Unknown player"}</span>
        </span>
      ))}
    </span>
  );
}

export function Dotted({ items, className = "" }) {
  const list = items.filter(Boolean);
  return (
    <span className={className}>
      {list.map((item, index) => <React.Fragment key={index}>{index > 0 && " · "}{item}</React.Fragment>)}
    </span>
  );
}

export const prizeShare = (prize, players) => Number(prize) / Math.max(2, Number(players) || 2);

export function PrizeText({ prize, team = false, players = 2, className = "" }) {
  if (prize == null) return null;
  if (!team) return <span className={`font-bold tabular-nums text-emerald-300 ${className}`}>{money(prize)}</span>;
  return (
    <span className={`inline-flex flex-col items-end leading-tight tabular-nums sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-end sm:gap-x-1 ${className}`}>
      <span className="font-bold text-emerald-300">{money(prize)}</span>
      <span className="whitespace-nowrap text-xs font-semibold text-slate-400"><span className="hidden sm:inline">· </span>{money(prizeShare(prize, players))} each</span>
    </span>
  );
}

export function Podium({ rows, team = false }) {
  const top = rows.filter((row) => Number(row.placement) <= 3).slice(0, 4);
  if (!top.length) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {top.map((row) => (
        <div key={row.id} className={`grid min-w-0 grid-cols-1 content-start gap-2 rounded-xl border p-2 ${Number(row.placement) === 1 ? "border-amber-500/40 bg-amber-500/5" : "border-slate-700 bg-slate-950/60"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-lg font-black ${placeTone(row.placement)}`}>{ordinal(row.placement)}</span>
            <PrizeText prize={row.prize} team={team} players={row.members?.length} />
          </div>
          <Entrant entrant={row} size="md" block />
        </div>
      ))}
    </div>
  );
}

export function ResultRow({ row, team = false, extra = null }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-800 px-2 py-1.5 last:border-0">
      <span className={`font-black tabular-nums ${placeTone(row.placement)}`}>{ordinal(row.placement)}</span>
      <Entrant entrant={row} />
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        {extra}
        <PrizeText prize={row.prize} team={team} players={row.members?.length} className="text-sm" />
      </span>
    </div>
  );
}

const resultStateText = {
  live: "Still being played.",
  upcoming: "Hasn't started yet.",
  not_played: "No bracket was played.",
  no_results: "No results were recorded.",
  cancelled: "Cancelled.",
  ended: "No final placements were recorded.",
  complete: "No final placements were recorded.",
};

export function EventFacts({ event, prize = false }) {
  return (
    <Dotted
      className="text-xs font-semibold text-slate-400"
      items={[
        modeName(event.game_mode) !== "Other" && modeName(event.game_mode) !== String(event.name ?? "").trim() && modeName(event.game_mode),
        event.region ? regionName(event.region) : null,
        event.entrant_count ? `${number(event.entrant_count)} entrants` : null,
        prize && event.prize_pool != null && <><PrizeText prize={event.prize_pool} /> prize pool</>,
      ]}
    />
  );
}

export function EventResultsCard({ event, state, stateBadge }) {
  const rows = event.results ?? [];
  const team = Number(event.game_mode) === 2;
  const rest = rows.filter((row) => Number(row.placement) > 3);
  return (
    <section className="grid min-w-0 grid-cols-1 content-start gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a href={`/esports/event/${event.id}`} className="block truncate text-lg font-bold text-white hover:text-blue-300">{event.name}</a>
          <EventFacts event={event} prize />
        </div>
        {stateBadge}
      </header>
      {rows.length
        ? (
          <>
            <Podium rows={rows} team={team} />
            {rest.length > 0 && <div className="rounded-xl border border-slate-800 bg-slate-950/40">{rest.map((row) => <ResultRow key={row.id} row={row} team={team} />)}</div>}
          </>
        )
        : Array.isArray(event.results) && <p className="text-sm text-slate-400">{resultStateText[state] ?? "No results yet."}</p>}
      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <a href={`/esports/event/${event.id}`} className="text-blue-300 hover:text-blue-200">Full standings</a>
        {Number(event.stored_sets ?? 0) > 0 && <a href={`/esports/event/${event.id}?view=matches`} className="text-blue-300 hover:text-blue-200">Bracket</a>}
      </div>
    </section>
  );
}

export function SideEventRow({ event, stateBadge }) {
  const winner = (event.results ?? []).find((row) => Number(row.placement) === 1);
  return (
    <a href={`/esports/event/${event.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-800 px-2 py-1.5 last:border-0 hover:bg-slate-800/40">
      <span className="min-w-0">
        <span className="block truncate font-bold text-white">{event.name}</span>
        <EventFacts event={event} />
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm">
        {winner ? <><span className="text-xs font-bold text-amber-400">1st</span><TeamLines members={winner.members} fallback={winnerLabel(winner)} size={null} tone="font-semibold text-slate-200" /></> : stateBadge}
      </span>
    </a>
  );
}

export const winnerLabel = (entrant) => {
  const members = (entrant.members ?? []).map((member) => member.name).filter(Boolean);
  return members.length ? members.join(" / ") : cleanEntrantName(entrant.name);
};

export function ModeChips({ modes }) {
  return (modes ?? []).map((mode) => <Badge key={mode}>{modeName(mode)}</Badge>);
}

const memberRegion = (tournament) => {
  const regions = tournament.regions ?? [];
  if (!regions.length) return "Global";
  return regions.map((region) => (region === "ALL" ? "Global" : region)).join(" · ");
};

const memberModes = (tournament) => (tournament.modes ?? []).map(modeName).join(" + ");

const entrantWord = (tournament) => {
  const modes = (tournament.modes ?? []).map(Number);
  if (modes.length === 1 && modes[0] === 2) return "teams";
  if (modes.length === 1 && modes[0] === 1) return "players";
  return "entrants";
};

export function SeriesMemberRow({ tournament, current = false, prize = true }) {
  const winners = tournament.winners ?? [];
  const upcoming = tournament.display_state === "upcoming";
  return (
    <a
      href={`/esports/tournament/${tournament.id}`}
      aria-current={current ? "page" : undefined}
      className={`grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-800 px-2 py-1.5 last:border-0 hover:bg-slate-800/50 ${current ? "bg-blue-500/10" : ""}`}
    >
      <span className="min-w-0 text-xs font-bold text-slate-300">
        <span className="block truncate" title={(tournament.regions ?? []).map(regionName).join(", ")}>{memberRegion(tournament)}</span>
        <span className="font-semibold text-slate-500">{memberModes(tournament) || "Other"}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
        {winners.length
          ? winners.map((winner) => (
            <TeamLines key={winner.event_id} members={winner.members} fallback={winnerLabel(winner)} />
          ))
          : <span className="text-xs text-slate-500">{upcoming ? `Starts ${dateRange(tournament.starts_at)}` : "No winner recorded"}</span>}
      </span>
      <span className="flex flex-col items-end text-xs font-semibold text-slate-400">
        {tournament.entrants ? <span className="tabular-nums">{number(tournament.entrants)} {entrantWord(tournament)}</span> : null}
        {prize && tournament.prize_pool != null && <PrizeText prize={tournament.prize_pool} />}
      </span>
    </a>
  );
}

const regionOrder = ["ALL", "NA", "EU", "SA", "SEA", "MENA", "AUS"];
const regionRank = (tournament) => Math.min(...(tournament.regions ?? []).map((region) => (regionOrder.includes(region) ? regionOrder.indexOf(region) : 8)), 9);
const modeRank = (tournament) => Math.min(...(tournament.modes ?? []).map(Number), 9);

export const sortSeriesMembers = (list) => [...list].sort((left, right) => modeRank(left) - modeRank(right) || regionRank(left) - regionRank(right));

export function editionMatch(edition, series) {
  const list = edition?.tournaments ?? [];
  const sameRegion = (tournament) => (tournament.regions ?? []).some((region) => (series.regions ?? []).includes(region));
  const sameMode = (tournament) => (tournament.modes ?? []).some((mode) => (series.modes ?? []).includes(mode));
  return list.find((tournament) => sameRegion(tournament) && sameMode(tournament))
    ?? list.find(sameRegion)
    ?? sortSeriesMembers(list)[0];
}
