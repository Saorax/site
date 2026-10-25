import React, { useState } from "react";
import {
  apiUrl, Avatar, Badge, Card, date, Empty, Loading, Medals, money, number, PageShell, PlayerChip, points,
  REGIONS, regionName, SearchInput, Select, useApi, useDebounced,
} from "./ui";

export default function HubPage() {
  const overview = useApi(apiUrl("/overview"));
  const counts = overview.data?.counts;
  return (
    <PageShell
      eyebrow="Brawlhalla esports"
      title="Esports Database"
      subtitle="Power rankings, tournament results and match history for every official and community tournament on start.gg and Challengermode."
    >
      <GlobalSearch />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Shortcut href="/pr" title="Power Rankings" text="Who's on top right now, by region and format." />
        <Shortcut href="/esports/player" title="Players" text={counts ? `${number(counts.players)} players with full match histories.` : "Search every player."} />
        <Shortcut href="/esports/tournaments" title="Tournaments" text={counts ? `${number(counts.tournaments)} tournaments and ${number(counts.sets)} matches.` : "Browse every tournament."} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TopPlayers />
        <div className="grid gap-4">
          <TournamentList title="Upcoming official tournaments" state="upcoming" />
          <TournamentList title="Recent official results" state="complete" />
        </div>
      </div>
      <Leaders />
      <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm font-bold text-slate-500 dark:border-slate-800">
        <span>Tools:</span>
        <a href="/esports/autoseed" className="hover:text-blue-500">Autoseed</a>
        {import.meta.env.DEV && <a href="/esports/review" className="hover:text-blue-500">Classification review (admin)</a>}
      </div>
    </PageShell>
  );
}

function Shortcut({ href, title, text }) {
  return (
    <a href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-lg font-black text-slate-950 dark:text-white">
        {title}<span className="text-blue-500 transition group-hover:translate-x-0.5">→</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">{text}</p>
    </a>
  );
}

function GlobalSearch() {
  const [term, setTerm] = useState("");
  const query = useDebounced(term.trim());
  const players = useApi(query.length >= 2 ? apiUrl("/players", { search: query, perPage: 6 }) : null);
  const tournaments = useApi(query.length >= 2 ? apiUrl("/tournaments", { search: query, perPage: 6 }) : null);
  return (
    <div className="relative">
      <SearchInput value={term} onChange={setTerm} placeholder="Search players and tournaments" />
      {query.length >= 2 && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xl dark:border-slate-700 dark:bg-slate-700 md:grid-cols-2">
          <div className="bg-white p-3 dark:bg-slate-900">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Players</div>
            {players.loading && !players.data && <Loading />}
            {(players.data?.items ?? []).map((player) => (
              <div key={player.id} className="rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                <PlayerChip id={player.id} name={player.display_name} image={player.image} country={player.country} size="sm"
                  detail={`${number(player.event_appearances)} events · last played ${date(player.latest_event_at)}`} />
              </div>
            ))}
            {players.data && !players.data.items?.length && <Empty>No players found.</Empty>}
          </div>
          <div className="bg-white p-3 dark:bg-slate-900">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Tournaments</div>
            {tournaments.loading && !tournaments.data && <Loading />}
            {(tournaments.data?.items ?? []).map((tournament) => <TournamentLine key={tournament.id} tournament={tournament} />)}
            {tournaments.data && !tournaments.data.items?.length && <Empty>No tournaments found.</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TournamentLine({ tournament }) {
  return (
    <a href={`/esports/tournament/${tournament.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
      {tournament.image
        ? <img src={tournament.image} alt="" loading="lazy" className="h-9 w-16 shrink-0 rounded-md bg-slate-200 object-cover dark:bg-slate-800" />
        : <div className="h-9 w-16 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />}
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-slate-950 dark:text-white">{tournament.name}</div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {date(tournament.starts_at)}
          {tournament.classification === "official" && <Badge tone="blue">Official</Badge>}
        </div>
      </div>
    </a>
  );
}

function TopPlayers() {
  const [region, setRegion] = useState("NA");
  const [mode, setMode] = useState("1");
  const ranking = useApi(apiUrl("/rankings", { region, gameMode: mode, perPage: 10, page: 1 }));
  return (
    <Card
      title="Top 10 right now"
      action={(
        <div className="flex gap-2">
          <Select value={region} onChange={setRegion} options={REGIONS} />
          <Select value={mode} onChange={setMode} options={[["1", "1v1"], ["2", "2v2"]]} />
        </div>
      )}
      padded={false}
    >
      {!ranking.data && ranking.loading && <Loading />}
      {(ranking.data?.players ?? []).map((player) => (
        <a key={player.playerId} href={`/esports/player/id/${player.playerId}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
          <span className="w-6 text-center text-lg font-black tabular-nums text-slate-900 dark:text-white">{player.rank}</span>
          <Avatar src={player.image} name={player.name} size="sm" playerId={player.playerId} />
          <span className="min-w-0 flex-1 truncate font-black text-slate-950 dark:text-white">{player.name}</span>
          <span className="text-sm font-black tabular-nums text-slate-600 dark:text-slate-300">{points(player.points)}</span>
        </a>
      ))}
      <a href={`/pr?region=${region}&mode=${mode}`} className="block border-t border-slate-200 px-4 py-2.5 text-sm font-black text-blue-600 hover:bg-slate-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-slate-800/50">
        Full {regionName(region)} {mode === "2" ? "2v2" : "1v1"} rankings →
      </a>
    </Card>
  );
}

function TournamentList({ title, state }) {
  const list = useApi(apiUrl("/tournaments", { official: "official", state, perPage: 6 }));
  const items = (list.data?.items ?? []).filter((tournament) => !tournament.date_outlier).slice(0, 5);
  return (
    <Card title={title} action={<a href={`/esports/tournaments?official=official&state=${state}`} className="text-sm font-black text-blue-600 dark:text-blue-300">All →</a>}>
      {!list.data && list.loading && <Loading />}
      {list.data && !items.length && <Empty>Nothing scheduled yet.</Empty>}
      <div className="-mx-2">{items.map((tournament) => <TournamentLine key={tournament.id} tournament={tournament} />)}</div>
    </Card>
  );
}

const LEADER_BOARDS = [
  ["earnings", "Top earnings", "money"],
  ["gold", "Most tournament wins", "wins"],
  ["official", "Most official tournaments", "official"],
  ["tournaments", "Most tournaments played", "played"],
];

function Leaders() {
  const leaders = useApi(apiUrl("/leaders", { limit: 5 }));
  if (!leaders.data) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-xl font-black text-slate-950 dark:text-white">All-time records</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {LEADER_BOARDS.map(([key, title, unit]) => (
          <Card key={key} title={title} padded={false}>
            {(leaders.data.categories?.[key] ?? []).map((player, index) => (
              <div key={player.player_id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800">
                <span className="w-5 text-center font-black tabular-nums text-slate-500">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <PlayerChip id={player.player_id} name={player.name} country={player.country} size="sm"
                    detail={unit === "money" ? `${number(player.prize_records)} paid finishes` : <Medals gold={player.gold} silver={player.silver} bronze={player.bronze} />} />
                </div>
                {unit === "money"
                  ? <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{money(player.value)}</span>
                  : <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">{number(player.value)} <span className="text-xs text-slate-400">{unit}</span></span>}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
