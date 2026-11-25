import {
  apiUrl, Avatar, Badge, Card, date, DELETED_ACCOUNT_NOTE, Empty, ErrorNote, isDeletedAccountName, isLostSpelling, Loading,
  number, PageShell, Pagination, PlayerChip, SearchInput, Tabs, useApi, useDebounced, useQueryState,
} from "./ui";
import { ListTools } from "../ui";
import { RECORD_BOARDS, recordBoard, recordDetail, recordsUrl, recordValue } from "./RecordsPage";

export default function PlayersPage() {
  const [search, setSearch] = useQueryState("search", "");
  const [pageParam, setPageParam] = useQueryState("page", "1");
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const setPage = (value) => setPageParam(String(value));
  const query = useDebounced(search.trim());
  const players = useApi(apiUrl("/players", { search: query || undefined, page, perPage: 40 }));
  const data = players.data;

  return (
    <PageShell
      title="Players"
      subtitle="Search by any name a player has used on start.gg or Challengermode."
      back={{ href: "/esports", label: "Esports Hub" }}
    >
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(18rem,24rem)]">
        <Leaders />
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search players" autoFocus /></div>
            <ListTools filename={`saorax-players${query ? "-search" : ""}${page > 1 ? `-page-${page}` : ""}`} rows={data?.items ?? []} columns={PLAYER_EXPORT_COLUMNS} />
          </div>
          <Card padded={false}>
            {players.error && <div className="p-3"><ErrorNote message={players.error} onRetry={players.retry} /></div>}
            {!data && players.loading && <Loading label="Loading players…" />}
            {data && !data.items?.length && <Empty>No players match “{query}”.</Empty>}
            {query && data?.matches > data?.total && (
              <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400">
                Best {number(data.total)} of {number(data.matches)} matches
              </div>
            )}
            <div className={`divide-y divide-slate-800 min-[112.5rem]:grid min-[112.5rem]:grid-cols-2 min-[112.5rem]:divide-y-0 min-[137.5rem]:grid-cols-3 ${players.loading ? "opacity-60" : ""}`}>
              {(data?.items ?? []).map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-slate-800/40 min-[112.5rem]:border-b min-[112.5rem]:border-slate-800">
                  <PlayerChip id={player.id} name={player.display_name} image={player.image} country={player.country} detail={otherNames(player)} />
                  <div className="flex shrink-0 items-center gap-3 text-sm font-bold text-slate-300">
                    <span><span className="font-black text-white">{number(player.event_appearances)}</span> events</span>
                    <span className="hidden sm:inline">Last played {date(player.latest_event_at)}</span>
                    <span className="hidden gap-1 2xl:flex">
                      {[...new Set((player.identities ?? []).map((identity) => identity.provider))].map((provider) => (
                        <Badge key={provider}>{providerName(provider)}</Badge>
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

const providerName = (provider) => (provider === "challengermode" ? "Challengermode" : "start.gg");

const PLAYER_EXPORT_COLUMNS = [
  { key: "playerId", label: "Player ID", value: (player) => player.id },
  { key: "player", label: "Player", value: (player) => player.display_name },
  { key: "country", label: "Country", value: (player) => player.country },
  { key: "events", label: "Events", value: (player) => player.event_appearances },
  { key: "lastPlayed", label: "Last played", value: (player) => (player.latest_event_at ? String(player.latest_event_at).slice(0, 10) : "") },
  { key: "otherNames", label: "Other names", value: (player) => otherNames(player) ?? "" },
  { key: "sites", label: "Sites", value: (player) => [...new Set((player.identities ?? []).map((identity) => providerName(identity.provider)))] },
  { key: "profile", label: "Profile", value: (player) => `${window.location.origin}/esports/player/id/${player.id}` },
];

function otherNames(player) {
  const current = String(player.display_name ?? "").toLowerCase();
  const names = [...new Set((player.identities ?? []).map((identity) => identity.name).filter(Boolean))]
    .filter((name) => name.toLowerCase() !== current && !isDeletedAccountName(name) && !isLostSpelling(name, current));
  const matched = player.matched_name && player.matched_name.toLowerCase() !== current ? player.matched_name : null;
  const parts = [
    matched && `Played as ${matched}`,
    player.account_deleted && DELETED_ACCOUNT_NOTE,
    !matched && names.length > 0 && `Also ${names.join(", ")}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function Leaders() {
  const [boardParam, setBoard] = useQueryState("board", "earnings");
  const board = recordBoard(boardParam);
  const leaders = useApi(apiUrl("/leaders", { limit: 10 }));
  const total = leaders.data?.totals?.[board.key];
  return (
    <Card title="All-Time Records" padded={false} action={<a href={recordsUrl()} className="text-sm font-bold text-blue-300 hover:text-blue-200">All records</a>}>
      <div className="grid grid-cols-4 gap-1 border-b p-2 border-slate-800">
        {RECORD_BOARDS.map((item) => (
          <button key={item.key} type="button" title={item.title} onClick={() => setBoard(item.key)} className={`min-w-0 truncate rounded-lg px-1 py-1.5 text-xs font-black transition sm:px-2 ${board.key === item.key ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{item.tab}</button>
        ))}
      </div>
      {leaders.error && <div className="p-3"><ErrorNote message={leaders.error} onRetry={leaders.retry} /></div>}
      {!leaders.data && leaders.loading && <Loading />}
      {(leaders.data?.categories?.[board.key] ?? []).map((player, index) => (
        <div key={player.player_id} className="flex items-center gap-3 border-b px-3 py-2 border-slate-800">
          <span className="w-5 text-center font-black tabular-nums text-slate-500">{player.place ?? index + 1}</span>
          <div className="min-w-0 flex-1">
            <PlayerChip id={player.player_id} name={player.name} country={player.country} size="sm" detail={recordDetail(board, player)} />
          </div>
          <span className={`text-sm font-black tabular-nums ${board.key === "earnings" ? "text-emerald-400" : "text-slate-200"}`}>{recordValue(board, player.value)}</span>
        </div>
      ))}
      {leaders.data && (
        <a href={recordsUrl(board.key)} className="block px-3 py-2 text-sm font-bold text-blue-300 hover:bg-slate-800/50 hover:text-blue-200">
          {total ? `See all ${number(total)}` : "See all"} <span aria-hidden="true">→</span>
        </a>
      )}
    </Card>
  );
}

function WorldChampions() {
  const [modeParam, setMode] = useQueryState("champions", "1");
  const mode = modeParam === "2" ? "2" : "1";
  const champions = useApi(apiUrl("/world-champions"));
  const rows = (Array.isArray(champions.data) ? champions.data : []).filter((row) => String(row.gameMode) === mode);
  return (
    <Card title="World Champions" padded={false}>
      <div className="border-b p-2 border-slate-800">
        <Tabs value={mode} onChange={setMode} tabs={[{ key: "1", label: "1v1" }, { key: "2", label: "2v2" }]} />
      </div>
      {!champions.data && champions.loading && <Loading />}
      <div className="max-h-[75vh] overflow-y-auto">
        {rows.map((row) => (
          <a key={row.eventId} href={`/esports/event/${row.eventId}`} className="block border-b px-3 py-3 last:border-0 border-slate-800 hover:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 -space-x-2">{row.players.map((player) => <Avatar key={player.playerId ?? player.name} name={player.name} size="sm" playerId={player.playerId} />)}</div>
              <div className="min-w-0">
                <div className="truncate font-black text-white">{row.players.map((player) => player.name).join(" & ") || row.entrantName}</div>
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
