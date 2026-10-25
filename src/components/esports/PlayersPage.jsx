import React, { useState } from "react";
import {
  apiUrl, Avatar, Badge, Card, date, Empty, ErrorNote, Loading, Medals, money, number, PageShell, Pagination, PlayerChip,
  SearchInput, Tabs, useApi, useDebounced, useQueryState,
} from "./ui";

const LEADER_BOARDS = [
  ["earnings", "Earnings", "money"],
  ["gold", "Gold", "wins"],
  ["silver", "Silver", "2nds"],
  ["bronze", "Bronze", "3rds"],
  ["tournaments", "Played", "events"],
  ["official", "Official", "official"],
  ["community", "Community", "community"],
];

export default function PlayersPage() {
  const [search, setSearch] = useQueryState("search", "");
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim());
  const players = useApi(apiUrl("/players", { search: query || undefined, page, perPage: 40 }));
  const data = players.data;

  return (
    <PageShell
      eyebrow="Brawlhalla esports"
      title="Player Database"
      subtitle="Every player who has competed in a tracked tournament. Search by any name a player has used on start.gg or Challengermode."
      back={{ href: "/esports", label: "Esports Database" }}
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(18rem,24rem)]">
        <Leaders />
        <div className="min-w-0">
          <div className="mb-3">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search players" autoFocus />
          </div>
          <Card padded={false}>
            {players.error && <div className="p-4"><ErrorNote message={players.error} /></div>}
            {!data && players.loading && <Loading label="Loading players..." />}
            {data && !data.items?.length && <Empty>No players match “{query}”.</Empty>}
            <div className={`divide-y divide-slate-100 dark:divide-slate-800 ${players.loading ? "opacity-60" : ""}`}>
              {(data?.items ?? []).map((player) => (
                <div key={player.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <PlayerChip id={player.id} name={player.display_name} image={player.image} country={player.country} detail={otherNames(player)} />
                  <div className="flex items-center gap-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <span><span className="font-black text-slate-950 dark:text-white">{number(player.event_appearances)}</span> events</span>
                    <span className="hidden sm:inline">Last played {date(player.latest_event_at)}</span>
                    <span className="hidden gap-1 2xl:flex">
                      {[...new Set((player.identities ?? []).map((identity) => identity.provider))].map((provider) => (
                        <Badge key={provider}>{provider === "challengermode" ? "Challengermode" : "start.gg"}</Badge>
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={data?.totalPages} onChange={setPage} />
          </Card>
        </div>
        <WorldChampions />
      </div>
    </PageShell>
  );
}

function otherNames(player) {
  const current = String(player.display_name ?? "").toLowerCase();
  const names = [...new Set((player.identities ?? []).map((identity) => identity.name).filter(Boolean))]
    .filter((name) => name.toLowerCase() !== current);
  return names.length ? `Also ${names.join(", ")}` : null;
}

function Leaders() {
  const [board, setBoard] = useState("earnings");
  const leaders = useApi(apiUrl("/leaders", { limit: 15 }));
  const unit = LEADER_BOARDS.find(([key]) => key === board)?.[2];
  return (
    <Card title="All-time records" padded={false}>
      <div className="grid grid-cols-4 gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        {LEADER_BOARDS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setBoard(key)} className={`rounded-lg px-2 py-1.5 text-xs font-black transition ${board === key ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{label}</button>
        ))}
      </div>
      {!leaders.data && leaders.loading && <Loading />}
      {(leaders.data?.categories?.[board] ?? []).map((player, index) => (
        <div key={player.player_id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0 dark:border-slate-800">
          <span className="w-5 text-center font-black tabular-nums text-slate-500">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <PlayerChip id={player.player_id} name={player.name} country={player.country} size="sm" detail={unit === "money" ? `${number(player.prize_records)} paid finishes` : <Medals gold={player.gold} silver={player.silver} bronze={player.bronze} />} />
          </div>
          {unit === "money"
            ? <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{money(player.value)}</span>
            : <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">{number(player.value)} <span className="text-xs text-slate-400">{unit}</span></span>}
        </div>
      ))}
    </Card>
  );
}

function WorldChampions() {
  const [mode, setMode] = useState("1");
  const champions = useApi(apiUrl("/world-champions"));
  const rows = (Array.isArray(champions.data) ? champions.data : []).filter((row) => String(row.gameMode) === mode);
  return (
    <Card title="World Champions" padded={false}>
      <div className="border-b border-slate-200 p-2 dark:border-slate-800">
        <Tabs value={mode} onChange={setMode} tabs={[{ key: "1", label: "1v1" }, { key: "2", label: "2v2" }]} />
      </div>
      {!champions.data && champions.loading && <Loading />}
      <div className="max-h-[75vh] overflow-y-auto">
        {rows.map((row) => (
          <a key={row.eventId} href={`/esports/event/${row.eventId}`} className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 -space-x-2">{row.players.map((player) => <Avatar key={player.playerId ?? player.name} name={player.name} size="sm" playerId={player.playerId} />)}</div>
              <div className="min-w-0">
                <div className="truncate font-black text-slate-950 dark:text-white">{row.players.map((player) => player.name).join(" & ") || row.entrantName}</div>
                <div className="truncate text-xs font-semibold text-slate-500">{row.year} · {row.tournamentName}</div>
              </div>
            </div>
          </a>
        ))}
        {champions.data && !rows.length && <Empty>No champions recorded.</Empty>}
      </div>
    </Card>
  );
}
