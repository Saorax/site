import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaTwitch, FaTwitter } from "react-icons/fa";
import {
  apiUrl, Avatar, Badge, date, Empty, ErrorNote, LIVE_REFRESH_MS, LiveUpdates, Loading, modeName, money, ordinal, points,
  REGIONS, regionName, SearchInput, useApi, useDebounced, useQueryState,
} from "./ui";
import { DataViewToggle, Pagination, PageHeader, PageShell, ScrollX, Section, useDataView } from "../ui";

const TYPES = [
  ["pr", "Official Tournaments"],
  ["circuit", "Brawlhalla Circuit 2024"],
  ["lan", "LAN Tournaments"],
  ["royale", "Royales"],
];
const PER_PAGE = 32;
const DAY = 86_400_000;
const PLACEMENT_POINTS = [[1, 110], [2, 80], [3, 70], [4, 60], [5, 50], [7, 40], [9, 28], [13, 24], [17, 20], [25, 16], [33, 4], [65, 2]];
const LOSS_FACTORS = [["1st", "90%"], ["2nd", "80%"], ["3rd-4th", "70%"], ["5th-8th", "60%"], ["9th-16th", "50%"], ["17th-32nd", "35%"], ["33rd-64th", "10%"], ["lower", "5%"]];

const exact = (value, digits = 3) => Number(value ?? 0).toFixed(digits);
const yearOf = (value) => (value ? new Date(value).getUTCFullYear() : null);
const percentOf = (value) => `${Math.round(Number(value ?? 0) * 100)}%`;
const providerNames = (list) => (list ?? []).map((provider) => (provider === "challengermode" ? "Challengermode" : provider === "startgg" ? "start.gg" : provider)).join(", ");
const socialUrl = (network, handle) => {
  if (!handle) return null;
  const raw = String(handle).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const name = raw.replace(/^@/, "");
  return network === "twitter" ? `https://twitter.com/${name}` : `https://twitch.tv/${name}`;
};
const parseIds = (value) => (value === "none" ? [] : value ? value.split(",").filter((id) => /^\d+$/.test(id)) : null);

function ago(value) {
  if (!value) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const utcTime = (value) => new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

const WEIGHTS = {
  1: { 2: "Worlds", 1.5: "Midseason" },
  2: { 0.75: "2v2", 1.5: "Worlds 2v2", 1.125: "Midseason 2v2" },
};
const weightNote = (multiplier, mode) => WEIGHTS[mode === "2" ? 2 : 1][multiplier] ?? null;

export default function RankingsPage() {
  const [rawType, setTypeParam] = useQueryState("type", "pr");
  const type = TYPES.some(([key]) => key === rawType) ? rawType : "pr";
  const [chosenRegion, setRegionParam] = useQueryState("region", "NA");
  const globalOnly = type === "lan" || type === "royale";
  const region = globalOnly ? "ALL" : chosenRegion;
  const [rawMode, setModeParam] = useQueryState("mode", "1");
  const mode = type === "royale" || type === "circuit" ? "1" : rawMode === "2" ? "2" : "1";
  const [presetId, setPresetParam] = useQueryState("preset", "current");
  const [split, setSplit] = useQueryState("split", "");
  const [decayParam, setDecayParam] = useQueryState("decay", "");
  const [eventsParam, setEventsParam] = useQueryState("events", "");
  const [pageParam, setPageParam] = useQueryState("page", "1");
  const [search, setSearchParam] = useQueryState("q", "");
  const [assignment, setAssignment] = useQueryState("assign", "most");
  const [playerParam, setPlayerParam] = useQueryState("player", "");
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const regionAssignment = assignment === "latest" ? "latest" : "most";

  const isCircuit = type === "circuit";
  const fixedDecay = type === "royale";
  const decay = fixedDecay ? false : decayParam === "off" ? false : decayParam === "on" ? true : type !== "lan";
  const usesCatalog = type === "pr" || type === "lan" || type === "royale";

  const presets = useApi(isCircuit ? null : apiUrl("/ranking-presets", { region, gameMode: mode, category: type === "pr" ? undefined : type }));
  const presetList = presets.data?.presets ?? [];
  const preset = presetList.find((item) => item.id === presetId) ?? presetList[0];
  const noPresets = Boolean(presets.data) && !presetList.length;
  const asOf = preset && !preset.current ? preset.asOf : undefined;
  const catalog = useApi(usesCatalog && preset ? apiUrl("/ranking-events", { region, gameMode: mode, asOf }) : null);
  const circuit = useApi(isCircuit ? apiUrl("/circuit", { split: split || undefined, region }) : null);

  const officialEvents = useMemo(() => (catalog.data?.catalog ?? [])
    .filter((event) => event.official && (event.state === "complete" || event.state === "active") && (type === "pr" || event.category === type))
    .sort((left, right) => new Date(right.startsAt) - new Date(left.startsAt)), [catalog.data, type]);
  const presetIds = useMemo(() => (type === "pr"
    ? officialEvents.filter((event) => event.inWindow && event.baseEligible).map((event) => event.eventId)
    : (preset?.eventIds ?? []).map(String)), [officialEvents, type, preset]);

  const selection = parseIds(eventsParam);
  const selectedIds = selection ?? presetIds;
  const customised = selection !== null;

  const resetBoard = useCallback(() => { setEventsParam(""); setPageParam("1"); setPlayerParam(""); }, [setEventsParam, setPageParam, setPlayerParam]);
  const pickType = (next) => { setTypeParam(next); setDecayParam(""); setPresetParam("current"); resetBoard(); };
  const pickRegion = (next) => { setRegionParam(next); setPresetParam("current"); resetBoard(); };
  const pickMode = (next) => { setModeParam(next); setPresetParam("current"); resetBoard(); };
  const pickPreset = (next) => { setPresetParam(next); resetBoard(); };
  const pickDecay = (next) => { setDecayParam(next === (type !== "lan") ? "" : next ? "on" : "off"); setPageParam("1"); };
  const pickAssignment = (next) => { setAssignment(next); setPageParam("1"); };
  const setSelection = (ids) => { setEventsParam(ids === null ? "" : ids.length ? ids.join(",") : "none"); setPageParam("1"); };

  const typeName = TYPES.find(([key]) => key === type)?.[1];
  const latest = officialEvents.find((event) => selectedIds.includes(event.eventId)) ?? null;
  return (
    <PageShell
      title="Power Rankings"
      subtitle={isCircuit ? "Brawlhalla Circuit 2024" : `${regionName(region)} ${modeName(mode)}`}
      sidebarLabel="Filters"
      sidebarWide
      sidebar={(
        <Sidebar
          type={type} onType={pickType}
          region={region} onRegion={globalOnly ? null : pickRegion}
          mode={mode} onMode={type === "royale" || isCircuit ? null : pickMode}
          decay={decay} onDecay={fixedDecay || isCircuit ? null : pickDecay}
          assignment={regionAssignment} onAssignment={type === "pr" ? pickAssignment : null}
          presets={presetList} presetId={preset?.id ?? presetId} onPreset={pickPreset}
          circuit={circuit.data} split={circuit.data?.split?.key ?? split} onSplit={setSplit}
          events={usesCatalog ? officialEvents : []} selectedIds={selectedIds}
          onToggleEvent={(eventId) => {
            const base = selection ?? presetIds;
            setSelection(base.includes(eventId) ? base.filter((id) => id !== eventId) : [...base, eventId]);
          }}
          onResetEvents={() => setSelection(null)}
          customised={customised}
        />
      )}
    >
      {isCircuit
        ? <CircuitBoard state={circuit} />
        : presets.error && !presets.data ? (
          <ErrorNote message={presets.error} onRetry={presets.retry} />
        ) : noPresets ? (
          <Empty>No {typeName} recorded for {regionName(region)} {modeName(mode)}.</Empty>
        ) : (
          <RankingBoard
            type={type}
            typeName={typeName}
            region={region}
            mode={mode}
            decay={decay}
            assignment={regionAssignment}
            preset={preset}
            asOf={asOf}
            eventIds={type === "pr" && !customised ? (preset ? null : undefined) : usesCatalog ? (catalog.data || customised ? selectedIds : undefined) : null}
            latest={latest}
            customised={customised}
            page={page}
            onPage={(next) => setPageParam(String(next))}
            search={search}
            onSearch={(next) => { setSearchParam(next); setPageParam("1"); }}
            playerId={playerParam}
            onPlayer={setPlayerParam}
          />
        )}
    </PageShell>
  );
}

function Sidebar(props) {
  const {
    type, onType, region, onRegion, mode, onMode, decay, onDecay, assignment, onAssignment,
    presets, presetId, onPreset, circuit, split, onSplit, events, selectedIds, onToggleEvent, onResetEvents, customised,
  } = props;
  const isCircuit = type === "circuit";
  const regions = isCircuit ? REGIONS.filter(([code]) => (circuit?.regions ?? ["NA", "EU", "SA"]).includes(code)) : [["ALL", "Global (every region)"], ...REGIONS];
  const years = [...new Set(events.map((event) => yearOf(event.startsAt)))].filter(Boolean);

  return (
    <div>
      <p className="rounded-xl bg-slate-950 p-3 text-xs font-semibold leading-relaxed text-slate-400">
        These are estimates. They won't be 100% accurate, but they're as close as possible to what the official rankings would look like, up to the top 200.
      </p>

      <label className="my-4 block">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tournament type</span>
        <select
          value={type}
          onChange={(event) => onType(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-bold text-white focus:border-blue-400 focus:outline-none"
        >
          {TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>

      {(onMode || onDecay) && (
        <SideSection title="Gamemode">
          {onMode && (
            <div className="grid grid-cols-2 gap-1">
              <Option active={mode === "1"} onClick={() => onMode("1")}>1v1 Rankings</Option>
              <Option active={mode === "2"} onClick={() => onMode("2")}>2v2 Rankings</Option>
            </div>
          )}
          {onDecay && (
            <div className={onMode ? "mt-3" : ""}>
              <Switch checked={decay} onChange={onDecay} label={type === "lan" ? "LAN decay" : "Date decay"} />
              {type === "lan" && <p className="mt-1 text-xs font-semibold text-slate-500">Each LAN counts half as much for every 8 newer LANs.</p>}
            </div>
          )}
        </SideSection>
      )}

      {onRegion && (
        <SideSection title="Regions">
          <div className="grid gap-1">
            {regions.map(([code, label]) => <Option key={code} active={region === code} onClick={() => onRegion(code)}>{label}</Option>)}
          </div>
          {onAssignment && (
            <label className="mt-3 block">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Put players in the region of</span>
              <select
                value={assignment}
                onChange={(event) => onAssignment(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-blue-400 focus:outline-none"
              >
                <option value="most">Where they played most</option>
                <option value="latest">Their latest event (official)</option>
              </select>
            </label>
          )}
        </SideSection>
      )}

      {isCircuit ? (
        <>
          <SideSection title="Presets">
            <div className="grid gap-1">
              {(circuit?.splits ?? []).map((item) => <Option key={item.key} active={split === item.key} onClick={() => onSplit(item.key)}>{item.name}</Option>)}
            </div>
          </SideSection>
          <SideSection title="Royale qualification">
            <ul className="grid gap-1.5 text-xs font-bold text-slate-200">
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-emerald-600" /> Guaranteed a spot at the Royale</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-amber-500" /> Can still make it to the Royale</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-rose-900" /> Can no longer make the Royale</li>
            </ul>
            <p className="mt-2 text-xs font-semibold text-slate-500">The top {circuit?.royaleSpots ?? 4} of each region qualify. A player's best {circuit?.countedTrials ?? 3} Trials count.</p>
          </SideSection>
        </>
      ) : presets.length > 0 && (
        <SideSection title={type === "royale" ? "Royales" : "Presets"}>
          <div className="grid max-h-96 grid-cols-[minmax(0,1fr)] gap-1 overflow-y-auto pr-1">
            {presets.map((item) => (
              <Option key={item.id} active={presetId === item.id} onClick={() => onPreset(item.id)} title={item.label}>
                <span className="flex items-center gap-2">
                  {item.image && <img src={item.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate">{item.current ? `Current · ${item.latest}` : item.latest}</span>
                    {item.oldest !== item.latest && <span className="block truncate text-[11px] font-semibold opacity-75">back to {item.oldest}</span>}
                  </span>
                </span>
              </Option>
            ))}
          </div>
        </SideSection>
      )}

      {events.length > 0 && (
        <SideSection
          title="Individual tournaments"
          aside={customised && (
            <span role="button" tabIndex={0} onClick={(event) => { event.preventDefault(); onResetEvents(); }} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-black normal-case tracking-normal text-blue-300">
              Reset
            </span>
          )}
        >
          <p className="mb-2 text-xs font-semibold text-slate-500">{selectedIds.length} selected. Tick events to build your own ranking.</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {years.map((year, index) => {
              const yearEvents = events.filter((event) => yearOf(event.startsAt) === year);
              return (
                <details key={year} open={index === 0} className="rounded-lg border border-slate-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-black text-slate-100 marker:hidden">
                    {year}
                    <span className="text-xs font-bold text-slate-500">
                      {yearEvents.filter((event) => selectedIds.includes(event.eventId)).length}/{yearEvents.length}
                    </span>
                  </summary>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-1 border-t border-slate-800 p-2">
                    {yearEvents.map((event) => (
                      <label key={event.eventId} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(event.eventId)}
                          onChange={() => onToggleEvent(event.eventId)}
                          className="h-4 w-4 shrink-0 accent-blue-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-slate-100">{event.tournamentName}</span>
                          <span className="block text-[11px] font-semibold text-slate-500">
                            {date(event.startsAt)} · {event.entrantCount ?? 0} entrants{event.multiplier !== 1 ? ` · ×${event.multiplier}` : ""}
                            {(event.displayState ? event.displayState === "live" : event.state === "active") && <span className="ml-1 font-black text-emerald-400">· Live</span>}
                          </span>
                        </span>
                        {event.image && <img src={event.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" />}
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </SideSection>
      )}
    </div>
  );
}

function SideSection({ title, defaultOpen = true, children, aside }) {
  return (
    <details open={defaultOpen} className="group border-t border-slate-800 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-black uppercase tracking-wider text-slate-200 marker:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {aside}
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Option({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm font-bold transition ${active ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-slate-800"}`}
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-200">
      {label}
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-700 transition peer-checked:bg-blue-600" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function RankingBoard(props) {
  const {
    type, typeName, region, mode, decay, assignment, preset, asOf, eventIds, latest, customised,
    page, onPage, search, onSearch, playerId, onPlayer,
  } = props;
  const { full } = useDataView();
  const query = useDebounced(search);
  const ids = eventIds == null ? undefined : eventIds.length ? eventIds.join(",") : "none";
  const ready = eventIds !== undefined;

  const boardParams = {
    region, gameMode: mode, provider: "all", regionAssignment: assignment,
    asOf: asOf ?? (type === "royale" ? new Date().toISOString().slice(0, 10) : undefined),
    eventIds: ids, baselineEventIds: ids,
    decay: !decay ? "false" : type === "lan" ? "event-count" : undefined,
  };
  const ranking = useApi(ready ? apiUrl("/rankings", { ...boardParams, page, perPage: PER_PAGE, search: query || undefined }) : null, { refreshMs: LIVE_REFRESH_MS, refreshWhile: (current) => current?.activeEvents?.length > 0 });

  const data = ranking.data;
  const players = data?.players ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = Math.max(1, data?.pagination?.totalPages ?? 1);
  const selected = players.find((player) => String(player.playerId) === String(playerId)) ?? null;
  const current = preset?.current && !customised && type !== "royale";
  const resultsThrough = data?.resultsThrough ?? data?.dataThrough;
  const title = `${typeName} · ${preset?.current ? "Current" : preset?.latest ?? "Rankings"}`;

  return (
    <div className="space-y-3">
      <PageHeader
        title={title}
        image={latest?.image
          ? <img src={latest.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
          : <div className="grid h-16 w-16 place-items-center rounded-xl bg-blue-600 text-2xl font-black text-white">PR</div>}
        meta={(
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
              <span>{mode === "2" ? "Doubles" : "Singles"} • {regionName(region)}</span>
              {latest && <span className="min-w-0 truncate">Latest: {latest.tournamentName}</span>}
              {customised && <Badge tone="blue">Custom selection</Badge>}
              {!decay && type !== "royale" && <Badge>No date decay</Badge>}
              {decay && type === "lan" && <Badge>LAN decay</Badge>}
              {assignment === "latest" && <Badge>Region: latest event</Badge>}
              {data?.activeEvents?.length > 0 && <LiveUpdates updatedAt={ranking.updatedAt} />}
            </span>
            {(current || resultsThrough) && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {data?.generatedAt && current && <span title={utcTime(data.generatedAt) + " UTC"}>Updated {ago(data.generatedAt)}</span>}
                {resultsThrough && <span>Results up to {current ? `${utcTime(resultsThrough)} UTC` : date(resultsThrough)}</span>}
                {data?.stale && current && <Badge tone="amber" title="Some recent results haven't been added to this board yet.">May be behind</Badge>}
              </span>
            )}
          </span>
        )}
        actions={(
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <div className="flex sm:w-64"><SearchInput value={search} onChange={onSearch} placeholder="Search players..." /></div>
            {total > 0 && <PageControls page={page} pages={pages} total={total} onChange={onPage} />}
            <DataViewToggle size="sm" />
          </div>
        )}
      />

      <div className={`grid items-start gap-3 ${full ? "" : "xl:grid-cols-[minmax(0,1fr)_22rem] min-[137.5rem]:grid-cols-[minmax(0,1fr)_45rem]"}`}>
        <div className="min-w-0 space-y-2">
          {ranking.error && <ErrorNote message={ranking.error} onRetry={ranking.retry} />}
          {!data && (ranking.loading || !ready) && <Loading label="Loading rankings…" />}
          {data && !players.length && (
            page > 1 && total > 0
              ? <Empty action={<button type="button" onClick={() => onPage(1)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-100 hover:bg-slate-700">Go to page 1</button>}>This page is past the end of the board.</Empty>
              : <Empty>{query ? `No ranked players match “${query}”.` : `Nobody is ranked in ${regionName(region)} with these events.`}</Empty>
          )}
          {players.length > 0 && (
            <>
              <RankTable players={players} mode={mode} full={full} latest={latest} loading={ranking.loading} onSelect={(player) => onPlayer(String(player.playerId))} />
              <Pagination page={page} totalPages={pages} onChange={onPage} />
            </>
          )}
        </div>
        <aside className={`grid items-start gap-3 md:grid-cols-2 ${full ? "max-w-6xl" : "xl:grid-cols-1 min-[137.5rem]:grid-cols-2"}`}>
          <HowPoints type={type} mode={mode} decay={decay} />
          <BoardFacts data={data} assignment={assignment} full={full} />
        </aside>
      </div>
      {selected && <PlacementsModal player={selected} mode={mode} asOf={asOf} full={full} onClose={() => onPlayer("")} />}
    </div>
  );
}

function PageControls({ page, pages, total, onChange }) {
  const button = "whitespace-nowrap px-3 py-2 text-sm font-black text-slate-200 hover:bg-slate-800";
  const from = total ? (page - 1) * PER_PAGE + 1 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-sm font-semibold text-slate-400">
        <b className="text-white">{from}</b>–<b className="text-white">{Math.min(page * PER_PAGE, total)}</b> of <b className="text-white">{total.toLocaleString()}</b>
      </span>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <button type="button" className={button} onClick={() => onChange(page > 1 ? page - 1 : pages)}>← Prev</button>
        <span className="border-x border-slate-700 px-3 py-2 text-sm font-black tabular-nums text-white">{page}/{pages}</span>
        <button type="button" className={button} onClick={() => onChange(page < pages ? page + 1 : 1)}>Next →</button>
      </div>
    </div>
  );
}

function HowPoints({ type, mode, decay }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(window.matchMedia("(min-width: 1280px)").matches); }, []);
  return (
    <Section title="How points work" headingAs="h2" collapsible open={open} onOpenChange={setOpen} padded={false} bodyClassName="space-y-2 p-3 text-sm text-slate-300">
      <p>Every official event in the last 370 days adds points. A player's total is the sum.</p>
      <div>
        <div className="font-bold text-white">Finish</div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-xs tabular-nums">
          {PLACEMENT_POINTS.map(([place, value]) => (
            <span key={place} className="rounded-md bg-slate-950/70 px-1.5 py-1"><b className="text-slate-100">{ordinal(place)}</b> {value}</span>
          ))}
        </div>
      </div>
      <p><b className="text-white">Wins:</b> your 3 wins over the best seeds add points. Beating the 1 seed is 10, the 10 seed 6.3, the 64 seed 3.3.</p>
      <div>
        <p><b className="text-white">Losses:</b> up to 20 more, based on how far the players who beat you went. Only your first two losses count. Losing to the winner keeps 90%.</p>
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-blue-300">All loss values</summary>
          <div className="mt-1 grid grid-cols-2 gap-1 tabular-nums">
            {LOSS_FACTORS.map(([place, value]) => <span key={place} className="rounded-md bg-slate-950/70 px-1.5 py-1">Lost to {place}: {value}</span>)}
          </div>
        </details>
      </div>
      <p>
        <b className="text-white">Event weight:</b>{" "}
        {mode === "2" ? "2v2 events count ×0.75, Worlds 2v2 ×1.5." : "Worlds counts ×2. Midseason before 2026 ×1.5."}
      </p>
      {type === "lan" ? (
        <p><b className="text-white">Age:</b> {decay ? "each LAN counts half for every 8 newer LANs." : "off, every LAN counts in full."}</p>
      ) : (
        <p><b className="text-white">Age:</b> {decay ? "an event still counts about 93% after 3 months, half after 6, under 10% after 9, and nothing after 370 days." : "off on this board, every event in the window counts in full."}</p>
      )}
      {mode === "2" && <p>Both players on a team get the team's points, so partners usually share a rank.</p>}
      <p className="text-xs text-slate-500">Click a player for their points per event.</p>
    </Section>
  );
}

function BoardFacts({ data, assignment, full }) {
  if (!data) return null;
  const rows = [
    ["Region", assignment === "latest" ? "Region of each player's latest event, like the official board. Taken from their 1v1 events when they have any, so a 2v2 partner never moves them" : "Region each player played most. Taken from their 1v1 events when they have any, so a 2v2 partner never moves them"],
    full && data.contributingProviders?.length ? ["Sources", providerNames(data.contributingProviders)] : null,
    full && data.algorithmVersion ? ["Scoring version", String(data.algorithmVersion)] : null,
    full && data.rankingCoverage ? ["Events with results", `${data.rankingCoverage.detailedEvents?.toLocaleString()} of ${data.rankingCoverage.totalEvents?.toLocaleString()}`] : null,
  ].filter(Boolean);
  return (
    <Section title="This board" headingAs="h2" padded={false} bodyClassName="p-3">
      <dl className="grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

const rankTone = {
  1: "text-amber-300",
  2: "text-slate-200",
  3: "text-orange-400",
};

function Movement({ rank, previous, latest }) {
  const since = latest ? ` since before ${latest.tournamentName}` : "";
  if (previous == null) return <span className="text-xs font-bold text-cyan-300" title={`Not ranked${since}`}>NEW</span>;
  const change = previous - rank;
  if (!change) return <span className="text-sm font-bold text-slate-600" title={`No change${since}`}>–</span>;
  return (
    <span className={`whitespace-nowrap text-sm font-bold ${change > 0 ? "text-emerald-400" : "text-rose-400"}`} title={`${change > 0 ? "Up" : "Down"} ${Math.abs(change)} (was ${ordinal(previous)})${since}`}>
      {change > 0 ? "↑" : "↓"}{Math.abs(change)}
    </span>
  );
}

function Th({ children, title, className = "" }) {
  return <th scope="col" title={title} className={`px-2 py-2 ${className}`}>{children}</th>;
}

function RankTable({ players, mode, full, latest, loading, onSelect }) {
  const format = modeName(mode);
  return (
    <ScrollX className={`rounded-2xl border border-slate-700 bg-slate-900/80 ${loading ? "opacity-60 transition" : ""}`}>
      <table className={`w-full text-left ${full ? "min-w-[64rem]" : ""}`}>
        <thead className="bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <Th className="w-12 pl-3">#</Th>
            <Th className="w-12" title="Change since before the latest event"><span className="sr-only">Change</span></Th>
            <Th className={full ? "min-w-[11rem]" : ""}>Player</Th>
            <Th className="w-20 text-right" title="Ranking points">Points</Th>
            <Th className="hidden w-16 text-right sm:table-cell" title={`Official ${format} events won, all time`}>Wins</Th>
            <Th className="hidden w-16 text-right sm:table-cell" title={`Official ${format} top 8 finishes, all time`}>Top 8</Th>
            {full && <Th className="w-16 text-right" title={`Official ${format} top 32 finishes, all time`}>Top 32</Th>}
            {full && <Th className="w-20 text-right" title={`Official ${format} 2nd and 3rd places, all time`}>2nd / 3rd</Th>}
            <Th className="hidden w-24 text-right md:table-cell" title={`Prize money from official ${format} events, all time, split between teammates`}>Earnings</Th>
            {full && <Th className="w-24 text-right" title="All recorded prize money, every event and mode">All prizes</Th>}
            {full && <Th className="w-16 text-right" title="Events counted on this board">Events</Th>}
            {full && <Th className="w-28" title="Where the results come from">Source</Th>}
            <Th className="hidden w-20 lg:table-cell"><span className="sr-only">Socials</span></Th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const twitter = socialUrl("twitter", player.socials?.twitter);
            const twitch = socialUrl("twitch", player.socials?.twitch);
            const official = player.official ?? {};
            return (
              <tr
                key={player.playerId}
                onClick={() => onSelect(player)}
                onKeyDown={(event) => { if (event.key === "Enter") onSelect(player); }}
                tabIndex={0}
                className={`cursor-pointer border-t border-slate-800 text-white transition hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none ${player.rank <= 3 ? "bg-slate-800/30" : ""}`}
              >
                <td className={`py-2 pl-3 pr-1 font-bold tabular-nums md:text-lg ${rankTone[player.rank] ?? ""}`}>{player.rank}</td>
                <td className="px-1"><Movement rank={player.rank} previous={player.previousRank} latest={latest} /></td>
                <td className="py-1.5 pr-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="hidden md:block"><Avatar src={player.image} name={player.name} size="sm" playerId={player.playerId} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{player.name}</span>
                      {(player.team?.length > 0 || player.provisional) && (
                        <span className="block truncate text-xs text-slate-400">
                          {player.team?.length > 0 && <>with {player.team.map((member) => member.name).join(" & ")}</>}
                          {player.team?.length > 0 && player.provisional && " · "}
                          {player.provisional && <span title="Some of these points come from an event that isn't finished">live event</span>}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-2 text-right font-bold tabular-nums" title={exact(player.points, 6)}>{full ? exact(player.points, 3) : points(player.points)}</td>
                <td className="hidden px-2 text-right tabular-nums text-slate-200 sm:table-cell">{official.wins ?? "–"}</td>
                <td className="hidden px-2 text-right tabular-nums text-slate-200 sm:table-cell">{official.top8 ?? "–"}</td>
                {full && <td className="px-2 text-right tabular-nums text-slate-200">{official.top32 ?? "–"}</td>}
                {full && <td className="px-2 text-right tabular-nums text-slate-200">{official.silver ?? 0} / {official.bronze ?? 0}</td>}
                <td className="hidden px-2 text-right tabular-nums text-slate-200 md:table-cell">{official.earnings ? money(official.earnings) : "–"}</td>
                {full && <td className="px-2 text-right tabular-nums text-slate-400">{player.careerMedals?.recordedEarnings ? money(player.careerMedals.recordedEarnings) : "–"}</td>}
                {full && <td className="px-2 text-right tabular-nums text-slate-400">{player.eventCount}</td>}
                {full && <td className="px-2 text-xs text-slate-400">{providerNames(player.providers)}</td>}
                <td className="hidden px-2 lg:table-cell">
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    {twitter && <a href={twitter} target="_blank" rel="noopener noreferrer" aria-label={`${player.name} on Twitter`} className="text-sky-400 hover:text-sky-300"><FaTwitter size={18} /></a>}
                    {twitch && <a href={twitch} target="_blank" rel="noopener noreferrer" aria-label={`${player.name} on Twitch`} className="text-violet-400 hover:text-violet-300"><FaTwitch size={18} /></a>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollX>
  );
}

function useModal(onClose) {
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = overflow; };
  }, [onClose]);
}

function PlacementsModal({ player, mode, asOf, full, onClose }) {
  useModal(onClose);
  const official = player.official ?? {};
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 sm:p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${player.name} points`} className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden shrink-0 sm:block"><Avatar src={player.image} name={player.name} size="lg" playerId={player.playerId} /></div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-white sm:text-2xl">{player.name}</h2>
              <div className="text-sm text-slate-400">
                {ordinal(player.rank)} · {full ? exact(player.points) : points(player.points)} points from {player.eventCount} {player.eventCount === 1 ? "event" : "events"}
                {player.team?.length > 0 && <> · with {player.team.map((member, index) => (
                  <React.Fragment key={member.playerId}>{index > 0 && " & "}<a href={`/esports/player/id/${member.playerId}`} className="text-blue-300 hover:underline">{member.name}</a></React.Fragment>
                ))}</>}
              </div>
              <div className="text-xs text-slate-500">
                Official {modeName(mode)}: {official.wins ?? 0} wins · {official.top8 ?? 0} top 8 · {official.earnings ? money(official.earnings) : "no prize money"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <a href={`/esports/player/id/${player.playerId}`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-500">Profile</a>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200" aria-label="Close">✕</button>
          </div>
        </header>
        <div className="overflow-y-auto p-3">
          <ContributionList contributions={player.contributions ?? []} asOf={asOf} mode={mode} full={full} />
        </div>
      </div>
    </div>
  );
}

function Receipt({ item, mode, full, days }) {
  const raw = item.placementPoints + item.winPoints + item.lossPoints;
  const weighted = raw * item.tournamentMultiplier;
  const value = (number) => (full ? exact(number) : points(number));
  const weight = weightNote(item.tournamentMultiplier, mode);
  const parts = [
    ["Finish", value(item.placementPoints)],
    ["+ Wins", value(item.winPoints)],
    ["+ Losses", value(item.lossPoints)],
    ["=", value(raw)],
    item.tournamentMultiplier !== 1 ? [`× ${item.tournamentMultiplier}${weight ? ` ${weight}` : ""}`, value(weighted)] : null,
    item.recencyMultiplier < 0.9995 ? [`× ${full ? exact(item.recencyMultiplier, 4) : percentOf(item.recencyMultiplier)} age`, null, `${days} days old`] : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm tabular-nums">
      {parts.map(([label, amount, title]) => (
        <span key={label} title={title} className="rounded-lg bg-slate-950/70 px-2 py-1">
          <span className="text-slate-400">{label}</span>{amount !== null && <b className="ml-1 text-slate-100">{amount}</b>}
        </span>
      ))}
      <span className="rounded-lg bg-blue-500/20 px-2 py-1 font-bold text-white">= {value(item.totalPoints)} pts</span>
    </div>
  );
}

export function ContributionList({ contributions, asOf, mode, full = false }) {
  const entrantIds = contributions.flatMap((item) => item.details?.entrantIds ?? item.entrantIds ?? []);
  const breakdowns = useApi(entrantIds.length ? apiUrl("/ranking-breakdown", { entrantIds: entrantIds.join(",") }) : null);
  const byEntrant = new Map((breakdowns.data?.breakdowns ?? []).map((item) => [String(item.entrantId), item]));
  const reference = asOf ? new Date(asOf) : new Date();
  const format = mode ?? (contributions.some((item) => item.tournamentMultiplier === 0.75) ? "2" : "1");
  if (!contributions.length) return <Empty>No counted events.</Empty>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      {contributions.map((item) => {
        const ids = item.details?.entrantIds ?? item.entrantIds ?? [];
        const breakdown = ids.map((id) => byEntrant.get(String(id))).find(Boolean);
        const placement = item.details?.placement ?? item.placement;
        const days = Math.max(0, Math.round((reference - new Date(item.startsAt)) / DAY));
        const wins = [...(breakdown?.wins ?? [])].sort((left, right) => Number(right.counted) - Number(left.counted) || right.points - left.points);
        return (
          <article key={item.eventId} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={`/esports/event/${item.eventId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80">
                {item.tournamentImage
                  ? <img src={item.tournamentImage} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 font-bold">{item.tournamentName?.[0]}</div>}
                <div className="min-w-0">
                  <div className="break-words font-bold text-white">{item.tournamentName}</div>
                  <div className="text-xs text-slate-400">{date(item.startsAt)} · {days} days ago{breakdown?.seed ? ` · seed ${breakdown.seed}` : ""}</div>
                </div>
              </a>
              <div className="text-2xl font-bold text-white">{ordinal(placement)}</div>
            </div>
            <div className="mt-2"><Receipt item={item} mode={format} full={full} days={days} /></div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
              <ResultList
                title="Wins"
                note="Only the 3 wins over the best seeds count."
                empty={breakdowns.loading ? "Loading…" : "No wins"}
                items={wins.map((win) => ({
                  key: win.setId, name: win.name, playerId: win.playerId, members: win.members, counted: win.counted, round: win.roundName,
                  detail: `${win.seed ? `${ordinal(win.seed)} seed` : "No seed"} · ${full ? exact(win.points) : points(win.points)} pts`,
                }))}
              />
              <ResultList
                title="Losses"
                note="Only the first two losses count."
                empty={breakdowns.loading ? "Loading…" : "Unbeaten: full 20"}
                items={(breakdown?.losses ?? []).map((loss) => ({
                  key: loss.setId, name: loss.name, playerId: loss.playerId, members: loss.members, counted: loss.counted, round: loss.roundName,
                  detail: `they finished ${loss.placement ? ordinal(loss.placement) : "?"} · keeps ${percentOf(loss.multiplier)}`,
                }))}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OpponentName({ item }) {
  if (item.playerId) return <a href={`/esports/player/id/${item.playerId}`} className="truncate font-bold text-slate-100 hover:underline">{item.name}</a>;
  if (item.members?.length) {
    return (
      <span className="flex min-w-0 flex-col font-bold leading-tight text-slate-100" title={item.name}>
        {item.members.map((member, index) => (
          member.playerId
            ? <a key={`${member.playerId}:${index}`} href={`/esports/player/id/${member.playerId}`} className="truncate hover:underline">{member.name}</a>
            : <span key={index} className="truncate">{member.name}</span>
        ))}
      </span>
    );
  }
  return <span className="truncate font-bold text-slate-100">{item.name}</span>;
}

function ResultList({ title, note, items, empty }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-bold text-white">{title}</span>
        {items.length > 0 && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      {!items.length && <div className="text-sm text-slate-500">{empty}</div>}
      <ul className="grid max-h-56 grid-cols-[minmax(0,1fr)] gap-1 overflow-y-auto pr-1 app-scrollbar">
        {items.map((item) => (
          <li key={item.key} className={`flex items-start justify-between gap-2 rounded-md px-2 py-1 text-sm ${item.counted ? "bg-blue-500/10" : "opacity-60"}`}>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0"><OpponentName item={item} /></span>
              <span className="block text-xs text-slate-400">{item.round ? `${item.round} · ` : ""}{item.detail}</span>
            </span>
            <span className={`shrink-0 text-[11px] font-bold ${item.counted ? "text-blue-200" : "text-slate-500"}`}>{item.counted ? "counts" : "doesn't count"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const royaleTone = {
  qualified: "bg-emerald-600 text-white hover:bg-emerald-500",
  contention: "bg-amber-500 text-slate-950 hover:bg-amber-400",
  eliminated: "bg-rose-950 text-slate-300 hover:bg-rose-900",
};

function CircuitBoard({ state }) {
  const [selected, setSelected] = useState(null);
  const data = state.data;
  if (state.error) return <ErrorNote message={state.error} onRetry={state.retry} />;
  if (!data) return <Loading label="Loading Circuit standings…" />;
  const trials = data.trials ?? [];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Power Rankings"
        title={`${data.split.name} · ${regionName(data.region)}`}
        meta={(
          <span>
            Trials: {trials.map((trial) => trial.eventId
              ? <a key={trial.name} href={`/esports/event/${trial.eventId}`} className="mr-2 text-blue-300 hover:underline">{trial.name}</a>
              : <span key={trial.name} className="mr-2">{trial.name}</span>)}
          </span>
        )}
      />
      {data.standings.length > 0 && (
        <ScrollX className={`rounded-2xl border border-slate-700 bg-slate-900/80 ${state.loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-14 px-3 py-2">#</th>
                <th>Player</th>
                {trials.map((trial) => <th key={trial.name} className="px-1 text-center">{trial.name.replace("Trial of ", "")}</th>)}
                <th className="px-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((player) => (
                <tr key={player.playerId} onClick={() => setSelected(player)} className={`cursor-pointer border-t border-black/10 transition ${royaleTone[player.royale] ?? ""}`}>
                  <td className="px-3 py-2 font-bold tabular-nums">{player.rank}</td>
                  <td className="py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="hidden md:block"><Avatar src={player.image} name={player.name} size="sm" playerId={player.playerId} /></span>
                      <span className="truncate font-bold">{player.name}</span>
                    </div>
                  </td>
                  {trials.map((trial) => {
                    const result = player.results.find((entry) => entry.trial === trial.name);
                    return (
                      <td key={trial.name} className="px-1 text-center text-sm">
                        {result
                          ? <span className={result.counted ? "font-bold" : "line-through opacity-60"} title={result.counted ? `${result.points} points` : "Dropped: only the best three Trials count"}>{ordinal(result.placement)}</span>
                          : <span className="opacity-40">–</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 text-right text-lg font-bold tabular-nums">{player.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}
      {!data.standings.length && <Empty>No Circuit results for {regionName(data.region)} in this split.</Empty>}
      {selected && <CircuitModal player={selected} trials={trials} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CircuitModal({ player, trials, onClose }) {
  useModal(onClose);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 sm:p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${player.name} Trials`} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={player.image} name={player.name} size="lg" playerId={player.playerId} />
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-white">{player.name}</h2>
              <div className="text-sm text-slate-400">{ordinal(player.rank)} · {player.points} points</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200" aria-label="Close">✕</button>
        </div>
        <div className="grid gap-2">
          {player.results.map((result) => {
            const trial = trials.find((item) => item.name === result.trial);
            const body = (
              <>
                <div>
                  <div className="font-bold text-white">{result.trial}</div>
                  <div className="text-xs text-slate-400">{date(trial?.startsAt)}{result.counted ? "" : " · dropped"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">{ordinal(result.placement)}</div>
                  <div className="text-sm text-slate-400">{result.points} points</div>
                </div>
              </>
            );
            const style = `flex items-center justify-between gap-3 rounded-xl border p-2 ${result.counted ? "border-slate-600" : "border-dashed border-slate-700 opacity-60"}`;
            return trial?.eventId
              ? <a key={result.trial} href={`/esports/event/${trial.eventId}`} className={`${style} hover:border-blue-400`}>{body}</a>
              : <div key={result.trial} className={style}>{body}</div>;
          })}
          <a href={`/esports/player/id/${player.playerId}`} className="mt-1 text-center text-sm font-bold text-blue-300 hover:underline">Open profile</a>
        </div>
      </div>
    </div>
  );
}
