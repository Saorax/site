import { useEffect } from "react";
import {
  apiUrl, Empty, ErrorNote, Loading, Medals, money, number, PageShell, Pagination, PlayerChip, SearchInput, Select, Tabs, useApi, useDebounced, useQueryState,
} from "./ui";
import { ScrollX } from "../ui";

export const RECORD_BOARDS = [
  { key: "earnings", tab: "Prize money", title: "Recorded prize money", column: "Prize money", extra: [["prize_records", "Paid finishes"]] },
  { key: "gold", tab: "Wins", title: "Most event wins", column: "Wins", note: "1v1 and 2v2 wins both count", extra: [["silver", "2nd"], ["bronze", "3rd"], ["tournaments", "Tournaments"]] },
  { key: "silver", tab: "2nd places", title: "Most 2nd places", column: "2nd", note: "1v1 and 2v2 both count", extra: [["gold", "1st"], ["bronze", "3rd"], ["tournaments", "Tournaments"]] },
  { key: "bronze", tab: "3rd places", title: "Most 3rd places", column: "3rd", note: "1v1 and 2v2 both count", extra: [["gold", "1st"], ["silver", "2nd"], ["tournaments", "Tournaments"]] },
  { key: "tournaments", tab: "Tournaments", title: "Most tournaments played", column: "Tournaments", extra: [["official", "Official"], ["community", "Community"], ["events", "Events"]] },
  { key: "official", tab: "Official", title: "Most official tournaments", column: "Official", extra: [["tournaments", "Tournaments"], ["community", "Community"]] },
  { key: "community", tab: "Community", title: "Most community tournaments", column: "Community", extra: [["tournaments", "Tournaments"], ["official", "Official"]] },
];

export const recordBoard = (key) => RECORD_BOARDS.find((board) => board.key === key) ?? RECORD_BOARDS[0];

export const recordsUrl = (board) => `/esports/records${board && board !== "earnings" ? `?board=${board}` : ""}`;

export const recordValue = (board, value) => (board.key === "earnings" ? money(value) : number(value));

export const recordDetail = (board, player) => (board.key === "earnings"
  ? `${number(player.prize_records)} paid finishes`
  : <Medals gold={player.gold} silver={player.silver} bronze={player.bronze} />);

const PER_PAGE = 50;

export default function RecordsPage() {
  const [boardParam, setBoardParam] = useQueryState("board", "earnings");
  const board = recordBoard(boardParam);
  const [pageParam, setPageParam] = useQueryState("page", "1");
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const [search, setSearch] = useQueryState("search", "");
  const query = useDebounced(search.trim());
  const list = useApi(apiUrl(`/leaders/${board.key}`, { page, perPage: PER_PAGE, search: query || undefined }));
  const data = list.data?.board === board.key ? list.data : null;
  const totals = useApi(apiUrl("/leaders", { limit: 1 })).data?.totals;

  useEffect(() => {
    if (data && page > data.totalPages) setPageParam(String(data.totalPages));
  }, [data, page, setPageParam]);

  const setBoard = (key) => { setBoardParam(key); setPageParam("1"); };
  const setPage = (value) => {
    setPageParam(String(value));
    document.getElementById("records-list")?.scrollIntoView({ block: "start" });
  };

  return (
    <PageShell title="All-Time Records" back={{ href: "/esports", label: "Esports Hub" }}>
      <div id="records-list" className="grid scroll-mt-16 gap-2">
        <div className="sm:hidden">
          <Select label="Record" value={board.key} onChange={setBoard} options={RECORD_BOARDS.map((item) => [item.key, totals?.[item.key] != null ? `${item.tab} (${number(totals[item.key])})` : item.tab])} />
        </div>
        <div className="hidden sm:block">
          <Tabs
            label="Record"
            variant="small"
            value={board.key}
            onChange={setBoard}
            tabs={RECORD_BOARDS.map((item) => ({ key: item.key, label: item.tab, count: totals?.[item.key] != null ? number(totals[item.key]) : undefined, title: item.title }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-0 sm:w-80"><SearchInput value={search} onChange={(value) => { setSearch(value); setPageParam("1"); }} placeholder="Find a player" /></div>
          {data && (
            <span className="text-sm text-slate-400 tabular-nums">
              {data.search ? `${number(data.matches)} of ${number(data.total)} players` : `${number(data.total)} players`}
              {board.note && <span className="text-slate-500"> · {board.note}</span>}
            </span>
          )}
        </div>
        {board.key === "earnings" && list.data?.earningsNote && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer select-none hover:text-slate-300">Where these numbers come from</summary>
            <p className="mt-1 max-w-prose text-slate-400">{list.data.earningsNote}</p>
          </details>
        )}
        {list.error && <ErrorNote message={list.error} onRetry={list.retry} />}
        {!data && list.loading && <Loading label="Loading records…" />}
        {data && !data.items.length && <Empty>{data.search ? `No player named “${data.search}” is on this board.` : "No players on this board yet."}</Empty>}
        {data?.items.length > 0 && (
          <ScrollX className={`rounded-xl border border-slate-700 bg-slate-900/80 ${list.loading ? "opacity-60 transition" : ""}`}>
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="w-14 py-2 pl-3 pr-2">#</th>
                  <th scope="col" className="px-2 py-2">Player</th>
                  <th scope="col" className="w-28 px-2 py-2 text-right">{board.column}</th>
                  {board.extra.map(([key, label]) => <th key={key} scope="col" className="hidden w-28 px-2 py-2 text-right sm:table-cell">{label}</th>)}
                  <th scope="col" className="hidden w-[35%] xl:table-cell" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((player) => (
                  <tr key={player.player_id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="py-1.5 pl-3 pr-2 font-bold tabular-nums text-slate-400">{player.place}</td>
                    <td className="min-w-0 px-2 py-1.5">
                      <PlayerChip id={player.player_id} name={player.name} country={player.country} size="sm" detail={<span className="sm:hidden">{recordDetail(board, player)}</span>} />
                    </td>
                    <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${board.key === "earnings" ? "text-emerald-300" : "text-white"}`}>{recordValue(board, player.value)}</td>
                    {board.extra.map(([key]) => <td key={key} className="hidden px-2 py-1.5 text-right tabular-nums text-slate-300 sm:table-cell">{number(player[key] ?? 0)}</td>)}
                    <td className="hidden xl:table-cell" />
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      </div>
    </PageShell>
  );
}
