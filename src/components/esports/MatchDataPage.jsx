import { useMemo, useState } from "react";
import { host } from "../../stuff";
import { mapName as rawMapName, useLegendNames } from "./MatchPages";
import {
  CoverageChart, FocusPanels, LegendSection, MapSection, PairList, Panel, plural, PlayerTable, SET_GRID, SetGames, StatStrip,
} from "./MatchData";
import {
  apiUrl, date, Empty, ErrorNote, Loading, number, PageShell, Pagination, percent, officialRegions, Select, useApi, useDebounced, useQueryState,
} from "./ui";

const mapName = (value) => rawMapName(value).replace(/^Small\s+/i, "");
const legendArt = (name) => `${host}/game/legends/art/${encodeURIComponent(name ?? "")}`;
const mapArt = (name) => `${host}/game/maps/thumbnail/${encodeURIComponent(name ?? "")}`;
const day = (value) => value.toISOString().slice(0, 10);

function periodRange(period) {
  const now = new Date();
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${Number(period) + 1}-01-01` };
  const days = { "30d": 30, "90d": 90, "1y": 365 }[period];
  if (!days) return {};
  return { from: day(new Date(now.getTime() - days * 86_400_000)) };
}

const PERIODS = [
  ["all", "All time"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["1y", "Last 12 months"],
  ...Array.from({ length: new Date().getFullYear() - 2015 }, (_, index) => {
    const year = String(new Date().getFullYear() - index);
    return [year, year];
  }),
];

function PlayerPicker({ player, playerName, onChange }) {
  const [term, setTerm] = useState("");
  const query = useDebounced(term.trim());
  const results = useApi(query.length >= 2 ? apiUrl("/players", { search: query, perPage: 8 }) : null);
  if (player) {
    return (
      <div className="grid gap-1 text-sm text-slate-300">
        <span>Player</span>
        <div className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 border-blue-400/50 bg-blue-500/10">
          <a href={`/esports/player/id/${player}`} className="truncate font-black text-white hover:text-blue-200">{playerName ?? `Player ${player}`}</a>
          <button type="button" onClick={() => onChange("")} className="shrink-0 text-xs font-bold text-blue-300 hover:text-blue-200">Remove</button>
        </div>
      </div>
    );
  }
  return (
    <label className="relative grid gap-1 text-sm text-slate-300">
      <span>Player</span>
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search a player"
        className="w-full rounded-lg border px-2 py-1.5 text-sm border-slate-700 bg-slate-950 text-white"
      />
      {query.length >= 2 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 grid max-h-64 overflow-y-auto rounded-lg border shadow-xl border-slate-700 bg-slate-900">
          {results.loading && !results.data && <span className="px-2 py-1.5 text-xs text-slate-400">Searching…</span>}
          {results.data && !results.data.items?.length && <span className="px-2 py-1.5 text-xs text-slate-400">No players found</span>}
          {(results.data?.items ?? []).map((item) => (
            <button key={item.id} type="button" onClick={() => { onChange(String(item.id)); setTerm(""); }} className="truncate px-2 py-1.5 text-left text-sm font-bold text-white hover:bg-slate-800">
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function GamesPanel({ query, legendName, total }) {
  const [page, setPage] = useState(1);
  const list = useApi(apiUrl("/match-data/games", { ...query, page, perPage: 24 }));
  const data = list.data;
  return (
    <Panel title="Games" count={total != null ? `${plural(total.games, "game")} in ${plural(total.sets, "set")}` : null}>
      {list.error && <ErrorNote message={list.error} onRetry={list.retry} />}
      {!data && list.loading && <Loading bare label="Loading games…" />}
      {data && !data.groups.length && <Empty bare>No games match these filters</Empty>}
      {data && data.groups.length > 0 && (
        <div className={`grid gap-2 ${list.loading ? "opacity-60" : ""}`}>
          <div className={SET_GRID}>
            {data.groups.map((group) => (
              <SetGames
                key={group.set.id}
                group={group}
                legendName={legendName}
                context={`${group.set.tournament_name}${group.set.event_name && group.set.event_name !== group.set.tournament_name ? ` · ${group.set.event_name}` : ""} · ${date(group.set.starts_at)}`}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </Panel>
  );
}

export function MatchDataPage() {
  const legendName = useLegendNames();
  const [mode, setMode] = useQueryState("mode", "1");
  const [region, setRegion] = useQueryState("region", "all");
  const [tier, setTier] = useQueryState("tier", "all");
  const [provider, setProvider] = useQueryState("site", "all");
  const [period, setPeriod] = useQueryState("period", "1y");
  const [player, setPlayer] = useQueryState("player", "");
  const [legend, setLegend] = useQueryState("legend", "");
  const [map, setMap] = useQueryState("map", "");
  const query = useMemo(() => ({
    gameMode: mode === "all" ? undefined : mode,
    region: region === "all" ? undefined : region,
    official: tier === "all" ? undefined : tier,
    provider: provider === "all" ? undefined : provider,
    ...periodRange(period),
    player: player || undefined,
    legend: legend || undefined,
    map: map || undefined,
  }), [mode, region, tier, provider, period, player, legend, map]);
  const summary = useApi(apiUrl("/match-data", query));
  const data = summary.data;
  const toggle = (setter, current) => (value) => setter(current === value ? "" : value);
  const filtered = Boolean(player || legend || map || region !== "all" || tier !== "all" || provider !== "all" || period !== "1y" || mode !== "1");
  const playerName = data?.focus?.kind === "player" ? data.focus.label : data?.players.find((row) => row.key === player)?.name;
  const legendOptions = useMemo(() => {
    const keys = new Set((data?.legends ?? []).map((row) => row.key));
    if (legend) keys.add(legend);
    return [...keys].map((key) => [key, legendName(key)]).sort((left, right) => left[1].localeCompare(right[1]));
  }, [data, legend, legendName]);
  const mapOptions = useMemo(() => {
    const rows = new Map((data?.maps ?? []).map((row) => [row.key, mapName(row.name)]));
    if (map && !rows.has(map)) rows.set(map, map);
    return [...rows.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [data, map]);
  const focusLabel = data?.focus?.kind === "player" ? playerName : data?.focus ? legendName(data.focus.label) : null;
  const reset = () => { setMode("1"); setRegion("all"); setTier("all"); setProvider("all"); setPeriod("1y"); setPlayer(""); setLegend(""); setMap(""); };
  const minGames = data ? Math.max(5, Math.min(40, Math.round(data.totals.games / 400))) : 5;

  return (
    <PageShell title="Match Data" back={{ href: "/esports", label: "Esports Hub" }}>
      <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <Panel title="Filters" action={filtered && <button type="button" onClick={reset} className="text-xs font-bold text-blue-300 hover:text-blue-200">Reset</button>}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Select label="Mode" value={mode} onChange={setMode} options={[["1", "1v1"], ["2", "2v2"], ["all", "Both"]]} />
              <Select label="Period" value={period} onChange={setPeriod} options={PERIODS} />
              <Select label="Region" value={region} onChange={setRegion} options={[["all", "All regions"], ...officialRegions(region)]} />
              <Select label="Tournaments" value={tier} onChange={setTier} options={[["all", "All"], ["official", "Official"], ["tier1", "Tier 1 community"], ["community", "Community"]]} />
              <Select label="Site" value={provider} onChange={setProvider} options={[["all", "Both"], ["startgg", "start.gg"], ["challengermode", "Challengermode"]]} />
              <div className="col-span-2 min-w-0 lg:col-span-1"><PlayerPicker player={player} playerName={playerName} onChange={setPlayer} /></div>
              <Select label="Legend" value={legend} onChange={setLegend} options={[["", "Any legend"], ...legendOptions]} />
              <Select label="Map" value={map} onChange={setMap} options={[["", "Any map"], ...mapOptions]} />
            </div>
          </Panel>
        </aside>

        <div className="grid min-w-0 content-start gap-3">
          {summary.error && <ErrorNote message={summary.error} onRetry={summary.retry} />}
          {!data && summary.loading && <Loading label="Counting games…" />}
          {data && !data.totals.games && <Empty>No reported games match these filters</Empty>}
          {data && data.totals.games > 0 && (
            <div className={`grid min-w-0 content-start gap-3 ${summary.loading ? "opacity-60" : ""}`}>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <StatStrip items={[
                  { label: "Games", value: number(data.totals.games), hint: `${plural(data.totals.sets, "set")} · ${(data.totals.games / Math.max(1, data.totals.sets)).toFixed(1)} per set` },
                  { label: "Tournaments", value: number(data.totals.tournaments) },
                  { label: "Legend picks", value: number(data.totals.picks), hint: plural(data.totals.legends, "legend") },
                  { label: "Games with a map", value: percent(data.totals.withMap, data.totals.games), hint: `${number(data.totals.withMap)} on ${plural(data.totals.maps, "map")}` },
                  { label: "Known game winners", value: percent(data.totals.decided, data.totals.games), hint: `${number(data.totals.decided)} games` },
                  { label: "Mirror matches", value: percent(data.pairs.filter((row) => row.a === row.b).reduce((total, row) => total + row.games, 0), data.totals.games), hint: "same legend on both sides" },
                  data.legends[0] && { label: "Most picked", value: legendName(data.legends[0].name), hint: plural(data.legends[0].games, "pick"), image: legendArt(data.legends[0].name) },
                  data.maps[0] && { label: "Most played map", value: mapName(data.maps[0].name), hint: `${percent(data.maps[0].games, data.totals.withMap)} of games with a map`, image: mapArt(data.maps[0].name), wide: true },
                ]} />
                <Panel title="Reported sets" count={data.coverage?.unit === "month" ? "by month" : "by year"}>
                  <CoverageChart coverage={data.coverage} />
                  {!data.index?.caughtUpAt && <div className="mt-2 rounded-lg px-2 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-200">Older games are still being added. Numbers will grow.</div>}
                </Panel>
              </div>
              <FocusPanels focus={data.focus} label={focusLabel} kind={data.focus?.kind} legendName={legendName} onPickLegend={toggle(setLegend, legend)} onPickMap={toggle(setMap, map)} activeLegend={legend} activeMap={map} />
              <LegendSection summary={data} legendName={legendName} onPick={toggle(setLegend, legend)} active={legend} minGames={minGames} />
              <MapSection summary={data} legendName={legendName} onPickMap={toggle(setMap, map)} onPickLegend={toggle(setLegend, legend)} activeMap={map} activeLegend={legend} />
              <div className="grid gap-3 2xl:grid-cols-2">
                <Panel title="Players" count={`top ${number(data.players.length)} by games`}>
                  <PlayerTable rows={data.players} legendName={legendName} onPick={toggle(setPlayer, player)} active={player} placeholder="Filter this list" />
                </Panel>
                <Panel title="Legend matchups" count={plural(data.pairs.filter((row) => row.a !== row.b).length, "pairing")}>
                  <PairList rows={data.pairs} legendName={legendName} />
                </Panel>
              </div>
              <GamesPanel key={JSON.stringify(query)} query={query} legendName={legendName} total={data.totals} />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
