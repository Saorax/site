import React, { useEffect, useMemo, useState } from "react";
import { FaTwitch, FaTwitter } from "react-icons/fa";
import {
  apiUrl, Avatar, Badge, date, Empty, ErrorNote, LIVE_REFRESH_MS, LiveUpdates, Loading, ordinal, REGIONS, regionName,
  SearchInput, useApi, useDebounced, useQueryState,
} from "./ui";

const TYPES = [
  ["pr", "Official Tournaments"],
  ["circuit", "Brawlhalla Circuit"],
  ["lan", "LAN Tournaments"],
  ["royale", "Royales"],
];
const PER_PAGE = 32;
const DAY = 86_400_000;

const fixed = (value, digits) => Number(value ?? 0).toFixed(digits);
const yearOf = (value) => (value ? new Date(value).getUTCFullYear() : null);
const socialUrl = (network, handle) => {
  if (!handle) return null;
  const raw = String(handle).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const name = raw.replace(/^@/, "");
  return network === "twitter" ? `https://twitter.com/${name}` : `https://twitch.tv/${name}`;
};

export default function RankingsPage() {
  const [rawType, setType] = useQueryState("type", "pr");
  // Old links may still point at removed ranking types.
  const type = TYPES.some(([key]) => key === rawType) ? rawType : "pr";
  const [chosenRegion, setRegion] = useQueryState("region", "NA");
  // LANs and Royales are international, so they are only ranked globally.
  const globalOnly = rawType === "lan" || rawType === "royale";
  const region = globalOnly ? "ALL" : chosenRegion;
  const [mode, setMode] = useQueryState("mode", "1");
  const [presetId, setPresetId] = useQueryState("preset", "current");
  const [split, setSplit] = useQueryState("split", "2024-2");
  const [decayChoice, setDecay] = useState(null);
  const [selection, setSelection] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isCircuit = type === "circuit";
  // Royales are ranked one at a time, so they never decay. LANs are rare, so
  // their optional decay counts LANs (half weight 8 LANs back), not days.
  const fixedDecay = type === "royale";
  const decay = fixedDecay ? false : decayChoice ?? type !== "lan";
  const usesCatalog = type === "pr" || type === "lan" || type === "royale";

  const presets = useApi(isCircuit ? null : apiUrl("/ranking-presets", { region, gameMode: mode, category: type === "pr" ? undefined : type }));
  const presetList = presets.data?.presets ?? [];
  const preset = presetList.find((item) => item.id === presetId) ?? presetList[0];
  const noPresets = Boolean(presets.data) && !presetList.length;
  const asOf = preset && !preset.current ? preset.asOf : undefined;
  const catalog = useApi(usesCatalog && preset ? apiUrl("/ranking-events", { region, gameMode: mode, asOf }) : null);
  const circuit = useApi(isCircuit ? apiUrl("/circuit", { split, region }) : null);

  const officialEvents = useMemo(() => (catalog.data?.catalog ?? [])
    .filter((event) => event.official && event.state === "complete" && (type === "pr" || event.category === type))
    .sort((left, right) => new Date(right.startsAt) - new Date(left.startsAt)), [catalog.data, type]);
  const presetIds = useMemo(() => (type === "pr"
    ? officialEvents.filter((event) => event.inWindow && event.baseEligible).map((event) => event.eventId)
    : (preset?.eventIds ?? []).map(String)), [officialEvents, type, preset]);

  useEffect(() => { setSelection(null); }, [type, region, mode, presetId]);
  const selectedIds = selection ?? presetIds;
  const customised = selection !== null;

  const pickType = (next) => {
    setType(next);
    if (next === "circuit") setMode("1");
    setDecay(null);
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      <aside
        className={`fixed bottom-0 left-0 top-16 z-40 w-80 overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-900 md:sticky md:z-auto md:h-[calc(100dvh-4rem)] md:shrink-0 md:translate-x-0 md:shadow-none xl:w-96 ${
          filtersOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          type={type} onType={pickType}
          region={region} onRegion={globalOnly ? null : setRegion}
          mode={mode} onMode={setMode}
          decay={decay} onDecay={fixedDecay ? null : setDecay}
          presets={presetList} presetId={preset?.id ?? presetId} onPreset={setPresetId}
          circuit={circuit.data} split={split} onSplit={setSplit}
          events={usesCatalog ? officialEvents : []} selectedIds={selectedIds}
          onToggleEvent={(eventId) => setSelection((current) => {
            const base = current ?? presetIds;
            return base.includes(eventId) ? base.filter((id) => id !== eventId) : [...base, eventId];
          })}
          onResetEvents={() => setSelection(null)}
          customised={customised}
        />
      </aside>
      {filtersOpen && <button type="button" aria-label="Close filters" className="fixed inset-0 top-16 z-30 bg-black/40 md:hidden" onClick={() => setFiltersOpen(false)} />}
      <div className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
        >
          ☰ Filters
        </button>
        {isCircuit
          ? <CircuitBoard state={circuit} />
          : noPresets ? (
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Empty>No {TYPES.find(([key]) => key === type)?.[1]} have been recorded for {regionName(region)} in {mode === "2" ? "doubles" : "singles"}.</Empty>
            </div>
          ) : (
            <RankingBoard
              type={type}
              region={region}
              mode={mode}
              decay={decay}
              preset={preset}
              asOf={asOf}
              eventIds={type === "pr" && !customised ? (preset ? null : undefined) : usesCatalog ? (catalog.data ? selectedIds : undefined) : null}
              highlightIds={selectedIds}
              events={officialEvents}
              customised={customised}
            />
          )}
      </div>
    </div>
  );
}


function Section({ title, defaultOpen = true, children, aside }) {
  return (
    <details open={defaultOpen} className="group border-t border-slate-200 py-3 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-black uppercase tracking-wider text-slate-700 marker:hidden dark:text-slate-200">
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

function Option({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
        active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600 dark:bg-slate-700" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Sidebar(props) {
  const {
    type, onType, region, onRegion, mode, onMode, decay, onDecay,
    presets, presetId, onPreset, circuit, split, onSplit, events, selectedIds, onToggleEvent, onResetEvents, customised,
  } = props;
  const isCircuit = type === "circuit";
  const regions = isCircuit ? REGIONS.filter(([code]) => (circuit?.regions ?? ["NA", "EU", "SA"]).includes(code)) : [["ALL", "Global (every region)"], ...REGIONS];
  const years = [...new Set(events.map((event) => yearOf(event.startsAt)))].filter(Boolean);

  return (
    <div>
      <p className="rounded-xl bg-slate-100 p-3 text-xs font-semibold leading-relaxed text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        These are estimates. They won't be 100% accurate, but they're as close as possible to what the official rankings would look like, up to the top 200.
      </p>

      <label className="my-4 block">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tournament type</span>
        <select
          value={type}
          onChange={(event) => onType(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>

      {!isCircuit && (
        <Section title="Gamemode">
          <div className="grid grid-cols-2 gap-1">
            <Option active={mode === "1"} onClick={() => onMode("1")}>1v1 Rankings</Option>
            <Option active={mode === "2"} onClick={() => onMode("2")}>2v2 Rankings</Option>
          </div>
          {onDecay && (
            <div className="mt-3">
              <Toggle checked={decay} onChange={onDecay} label={type === "lan" ? "LAN decay" : "Date decay"} />
              {type === "lan" && <p className="mt-1 text-xs font-semibold text-slate-500">Each LAN counts half as much for every 8 newer LANs.</p>}
            </div>
          )}
        </Section>
      )}

      {onRegion && (
        <Section title="Regions">
          <div className="grid gap-1">
            {regions.map(([code, label]) => <Option key={code} active={region === code} onClick={() => onRegion(code)}>{label}</Option>)}
          </div>
        </Section>
      )}

      {isCircuit ? (
        <>
          <Section title="Presets">
            <div className="grid gap-1">
              {(circuit?.splits ?? []).map((item) => <Option key={item.key} active={split === item.key} onClick={() => onSplit(item.key)}>{item.name}</Option>)}
            </div>
          </Section>
          <Section title="Royale qualification">
            <ul className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-emerald-600" /> Guaranteed a spot at the Royale</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-amber-500" /> Can still make it to the Royale</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm bg-rose-900" /> Can no longer make the Royale</li>
            </ul>
            <p className="mt-2 text-xs font-semibold text-slate-500">The top {circuit?.royaleSpots ?? 4} of each region qualify. A player's best {circuit?.countedTrials ?? 3} Trials count.</p>
          </Section>
        </>
      ) : (
        <Section title={type === "royale" ? "Royales" : "Presets"}>
          <div className="grid max-h-96 gap-1 overflow-y-auto pr-1">
            {presets.map((item) => (
              <Option key={item.id} active={presetId === item.id} onClick={() => onPreset(item.id)}>
                <span className="flex items-center gap-2" title={item.label}>
                  {item.image && <img src={item.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate">{item.current ? `Current · ${item.latest}` : item.latest}</span>
                    {item.oldest !== item.latest && <span className="block truncate text-[11px] font-semibold opacity-75">back to {item.oldest}</span>}
                  </span>
                </span>
              </Option>
            ))}
          </div>
        </Section>
      )}

      {events.length > 0 && (
        <Section
          title="Individual tournaments"
          aside={customised && (
            <span role="button" tabIndex={0} onClick={(event) => { event.preventDefault(); onResetEvents(); }} className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-black normal-case tracking-normal text-blue-600 dark:text-blue-300">
              Reset
            </span>
          )}
        >
          <p className="mb-2 text-xs font-semibold text-slate-500">{selectedIds.length} selected. Tick events to build your own ranking.</p>
          <div className="grid gap-2">
            {years.map((year, index) => {
              const yearEvents = events.filter((event) => yearOf(event.startsAt) === year);
              return (
                <details key={year} open={index === 0} className="rounded-lg border border-slate-200 dark:border-slate-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-black text-slate-800 marker:hidden dark:text-slate-100">
                    {year}
                    <span className="text-xs font-bold text-slate-500">
                      {yearEvents.filter((event) => selectedIds.includes(event.eventId)).length}/{yearEvents.length}
                    </span>
                  </summary>
                  <div className="grid gap-1 border-t border-slate-200 p-2 dark:border-slate-800">
                    {yearEvents.map((event) => (
                      <label key={event.eventId} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(event.eventId)}
                          onChange={() => onToggleEvent(event.eventId)}
                          className="h-4 w-4 shrink-0 rounded border-slate-400 text-blue-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-slate-800 dark:text-slate-100">{event.tournamentName}</span>
                          <span className="block text-[11px] font-semibold text-slate-500">
                            {date(event.startsAt)} · {event.entrantCount ?? 0} entrants{event.multiplier !== 1 ? ` · ×${event.multiplier}` : ""}
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
        </Section>
      )}
    </div>
  );
}


function RankingBoard({ type, region, mode, decay, preset, asOf, eventIds, highlightIds, events, customised }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const query = useDebounced(search);
  const ids = eventIds == null ? undefined : eventIds.length ? eventIds.join(",") : "none";
  const ready = eventIds !== undefined;

  useEffect(() => { setPage(1); }, [type, region, mode, preset?.id, ids, decay, query]);

  const ranking = useApi(ready ? apiUrl("/rankings", {
    region, gameMode: mode, provider: "all", regionAssignment: "most",
    page, perPage: PER_PAGE, search: query || undefined,
    asOf: asOf ?? (type === "royale" ? new Date().toISOString().slice(0, 10) : undefined),
    eventIds: ids, baselineEventIds: ids,
    decay: !decay ? "false" : type === "lan" ? "event-count" : undefined,
  }) : null, { refreshMs: LIVE_REFRESH_MS, refreshWhile: (current) => current?.activeEvents?.length > 0 });

  const data = ranking.data;
  const players = data?.players ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = Math.max(1, data?.pagination?.totalPages ?? 1);
  const half = Math.ceil(players.length / 2);
  const latest = events.find((event) => highlightIds?.includes(event.eventId)) ?? null;
  const typeName = TYPES.find(([key]) => key === type)?.[1];

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-[28rem] items-center gap-4">
          {latest?.image
            ? <img src={latest.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-blue-600 text-2xl font-black text-white">PR</div>}
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
              {typeName} · {preset?.current ? "Current" : preset?.latest ?? "Rankings"}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
              <span>{mode === "2" ? "Doubles" : "Singles"} • {regionName(region)}</span>
              {latest && <span className="truncate">· Latest: {latest.tournamentName}</span>}
              {customised && <Badge tone="blue">Custom selection</Badge>}
              {!decay && <Badge>No date decay</Badge>}
              {decay && type === "lan" && <Badge>LAN decay</Badge>}
              {data?.activeEvents?.length > 0 && <LiveUpdates updatedAt={ranking.updatedAt} />}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:w-72"><SearchInput value={search} onChange={setSearch} placeholder="Search players..." /></div>
          <PageControls page={page} pages={pages} total={total} onChange={setPage} />
        </div>
      </header>

      {ranking.error && <ErrorNote message={ranking.error} />}
      {!data && (ranking.loading || !ready) && <Loading label="Loading rankings..." />}
      {data && !players.length && (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Empty>{query ? `No ranked players match “${query}”.` : `No results for ${regionName(region)} in this selection. Try another preset or tick more tournaments.`}</Empty>
        </div>
      )}
      {players.length > 0 && (
        <div className={`grid items-start gap-3 2xl:grid-cols-2 ${ranking.loading ? "opacity-60 transition" : ""}`}>
          <RankTable players={players.slice(0, half)} onSelect={setSelected} />
          {players.length > half && <RankTable players={players.slice(half)} onSelect={setSelected} />}
        </div>
      )}
      {data?.dataThrough && (
        <p className="mt-3 text-xs font-semibold text-slate-500">Results through {date(data.dataThrough)}. Select a player to see the placements behind their points.</p>
      )}
      {selected && <PlacementsModal player={selected} asOf={asOf} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PageControls({ page, pages, total, onChange }) {
  const button = "whitespace-nowrap px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
  const from = total ? (page - 1) * PER_PAGE + 1 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-sm font-semibold text-slate-500">
        <b className="text-slate-900 dark:text-white">{from}</b>–<b className="text-slate-900 dark:text-white">{Math.min(page * PER_PAGE, total)}</b> of <b className="text-slate-900 dark:text-white">{total.toLocaleString()}</b>
      </span>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button type="button" className={button} onClick={() => onChange(page > 1 ? page - 1 : pages)}>← Prev</button>
        <span className="border-x border-slate-300 px-3 py-2 text-sm font-black tabular-nums dark:border-slate-700">{page}/{pages}</span>
        <button type="button" className={button} onClick={() => onChange(page < pages ? page + 1 : 1)}>Next →</button>
      </div>
    </div>
  );
}

const rowTone = {
  1: "bg-amber-400 text-slate-950 hover:bg-amber-300",
  2: "bg-slate-300 text-slate-950 hover:bg-slate-200",
  3: "bg-amber-700 text-white hover:bg-amber-600",
};

function Movement({ rank, previous }) {
  if (previous == null) return <span className="text-xs font-black text-cyan-600 dark:text-cyan-300">NEW</span>;
  const change = previous - rank;
  if (!change) return <span className="text-sm font-black text-orange-500">≈</span>;
  return (
    <span className={`text-sm font-black ${change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
      {change > 0 ? "↑" : "↓"} {Math.abs(change)}
    </span>
  );
}

function RankTable({ players, onSelect }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full table-fixed text-left">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="w-16 px-3 py-3 md:w-20">#</th>
            <th className="w-14 md:w-16" />
            <th>Name</th>
            <th className="w-24 sm:w-32">Points</th>
            <th className="hidden w-24 md:table-cell">Socials</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const tone = rowTone[player.rank] ?? "text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800/60";
            const twitter = socialUrl("twitter", player.socials?.twitter);
            const twitch = socialUrl("twitch", player.socials?.twitch);
            return (
              <tr key={player.playerId} onClick={() => onSelect(player)} className={`cursor-pointer border-t border-slate-100 transition dark:border-slate-800 ${tone}`}>
                <td className="px-3 py-2.5 font-black tabular-nums md:text-lg">{ordinal(player.rank)}</td>
                <td><Movement rank={player.rank} previous={player.previousRank} /></td>
                <td className="py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="hidden md:block"><Avatar src={player.image} name={player.name} size="md" playerId={player.playerId} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-black md:text-lg">{player.name}</span>
                      {player.provisional && <span className="text-[11px] font-bold opacity-70">provisional</span>}
                    </span>
                  </div>
                </td>
                <td className="font-bold tabular-nums md:text-lg">
                  <span className="hidden sm:inline">{fixed(player.points, 6)}</span>
                  <span className="sm:hidden">{fixed(player.points, 3)}</span>
                </td>
                <td className="hidden md:table-cell">
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    {twitter && <a href={twitter} target="_blank" rel="noopener noreferrer" aria-label={`${player.name} on Twitter`} className="text-sky-500 hover:text-sky-400"><FaTwitter size={20} /></a>}
                    {twitch && <a href={twitch} target="_blank" rel="noopener noreferrer" aria-label={`${player.name} on Twitch`} className="text-violet-500 hover:text-violet-400"><FaTwitch size={20} /></a>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function useModal(onClose) {
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [onClose]);
}

function PlacementsModal({ player, asOf, onClose }) {
  useModal(onClose);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={player.image} name={player.name} size="lg" playerId={player.playerId} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black text-slate-950 dark:text-white">{player.name}'s Best Placements</h2>
              <div className="text-sm font-bold text-slate-500">
                {ordinal(player.rank)} · {fixed(player.points, 3)} pts · {player.eventCount} {player.eventCount === 1 ? "event" : "events"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={`/esports/player/id/${player.playerId}`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-500">Profile</a>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label="Close">✕</button>
          </div>
        </header>
        <div className="overflow-y-auto p-4"><ContributionList contributions={player.contributions ?? []} asOf={asOf} /></div>
      </div>
    </div>
  );
}

export function ContributionList({ contributions, asOf }) {
  const entrantIds = contributions.flatMap((item) => item.details?.entrantIds ?? item.entrantIds ?? []);
  const breakdowns = useApi(entrantIds.length ? apiUrl("/ranking-breakdown", { entrantIds: entrantIds.join(",") }) : null);
  const byEntrant = new Map((breakdowns.data?.breakdowns ?? []).map((item) => [String(item.entrantId), item]));
  const reference = asOf ? new Date(asOf) : new Date();
  if (!contributions.length) return <Empty>No counted events.</Empty>;
  return (
    <div className="grid gap-3">
      {contributions.map((item) => {
        const ids = item.details?.entrantIds ?? item.entrantIds ?? [];
        const breakdown = ids.map((id) => byEntrant.get(String(id))).find(Boolean);
        const placement = item.details?.placement ?? item.placement;
        const raw = item.placementPoints + item.winPoints + item.lossPoints;
        const days = Math.max(0, Math.round((reference - new Date(item.startsAt)) / DAY));
        return (
          <article key={item.eventId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <a href={`/esports/event/${item.eventId}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                {item.tournamentImage
                  ? <img src={item.tournamentImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-200 font-black dark:bg-slate-800">{item.tournamentName?.[0]}</div>}
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-slate-950 dark:text-white">{item.tournamentName}</div>
                  <div className="text-sm font-semibold text-slate-500">{days} days ago · {date(item.startsAt)}</div>
                </div>
              </a>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-950 dark:text-white">{ordinal(placement)}</div>
                {breakdown?.seed && <div className="text-sm font-semibold text-slate-500">Seed {breakdown.seed}</div>}
                <div className="font-black text-slate-700 dark:text-slate-200">{fixed(item.placementPoints, 3)} pts</div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem]">
              <ResultList
                title={`Wins (${fixed(item.winPoints, 3)} pts)`}
                empty={breakdowns.loading ? "Loading..." : "No wins"}
                items={[...(breakdown?.wins ?? [])].sort((left, right) => Number(right.counted) - Number(left.counted) || right.points - left.points).map((win) => ({
                  key: win.setId, name: win.name, playerId: win.playerId, counted: win.counted,
                  detail: `Seed ${win.seed ? ordinal(win.seed) : "—"} ~ ${fixed(win.points, 3)} pts`,
                }))}
              />
              <ResultList
                title={`Losses (${fixed(item.lossPoints, 3)} pts)`}
                empty={breakdowns.loading ? "Loading..." : "No losses"}
                items={(breakdown?.losses ?? []).map((loss) => ({
                  key: loss.setId, name: loss.name, playerId: loss.playerId, counted: loss.counted,
                  detail: `out at ${loss.placement ? ordinal(loss.placement) : "—"} · ×${loss.multiplier}`,
                }))}
              />
              <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-950/60">
                <Figure label="Recency" value={fixed(item.recencyMultiplier, 4)} />
                <Figure label="Tourney multiplier" value={`×${item.tournamentMultiplier}`} />
                <Figure label="Raw total" value={`${fixed(raw, 3)} pts`} />
                <Figure label={`Total (×${item.tournamentMultiplier})`} value={`${fixed(raw * item.tournamentMultiplier, 3)} pts`} />
                <div className="col-span-2"><Figure label="Total with recency" value={`${fixed(item.totalPoints, 3)} pts`} strong /></div>
              </dl>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResultList({ title, items, empty }) {
  return (
    <div>
      <div className="mb-1 text-sm font-black text-slate-950 dark:text-white">{title}</div>
      {!items.length && <div className="text-sm font-semibold text-slate-500">{empty}</div>}
      <ul className="grid max-h-56 gap-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.key} className={`rounded-md px-2 py-1 ${item.counted ? "bg-blue-500/10" : "opacity-60"}`} title={item.counted ? "Counted toward points" : "Not counted"}>
            {item.playerId
              ? <a href={`/esports/player/id/${item.playerId}`} className="block truncate text-sm font-black text-slate-900 hover:underline dark:text-slate-100">{item.name}</a>
              : <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</span>}
            <span className="text-xs font-semibold text-slate-500">{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Figure({ label, value, strong }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`font-black tabular-nums text-slate-950 dark:text-white ${strong ? "text-xl" : ""}`}>{value}</dd>
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
  if (state.error) return <ErrorNote message={state.error} />;
  if (!data) return <Loading label="Loading circuit standings..." />;
  const trials = data.trials ?? [];
  const half = Math.ceil(data.standings.length / 2);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{data.split.name} · {regionName(data.region)}</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">
          Tournaments: {trials.map((trial) => trial.eventId
            ? <a key={trial.name} href={`/esports/event/${trial.eventId}`} className="mr-2 hover:text-blue-500 hover:underline">{trial.name}</a>
            : <span key={trial.name} className="mr-2">{trial.name}</span>)}
        </p>
      </header>
      <div className={`grid items-start gap-3 2xl:grid-cols-2 ${state.loading ? "opacity-60" : ""}`}>
        {[data.standings.slice(0, half), data.standings.slice(half)].filter((list) => list.length).map((list, index) => (
          <div key={index} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="w-16 px-3 py-3">#</th>
                  <th>Name</th>
                  {trials.map((trial) => <th key={trial.name} className="px-1 text-center">{trial.name.replace("Trial of ", "")}</th>)}
                  <th className="px-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {list.map((player) => (
                  <tr key={player.playerId} onClick={() => setSelected(player)} className={`cursor-pointer border-t border-black/10 transition ${royaleTone[player.royale] ?? ""}`}>
                    <td className="px-3 py-2.5 font-black tabular-nums">{ordinal(player.rank)}</td>
                    <td className="py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="hidden md:block"><Avatar src={player.image} name={player.name} size="sm" playerId={player.playerId} /></span>
                        <span className="truncate font-black">{player.name}</span>
                      </div>
                    </td>
                    {trials.map((trial) => {
                      const result = player.results.find((entry) => entry.trial === trial.name);
                      return (
                        <td key={trial.name} className="px-1 text-center text-sm">
                          {result
                            ? <span className={result.counted ? "font-black" : "line-through opacity-60"} title={result.counted ? `${result.points} points` : "Dropped: only the best three Trials count"}>{ordinal(result.placement)}</span>
                            : <span className="opacity-40">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 text-right text-lg font-black tabular-nums">{player.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {!data.standings.length && <Empty>No circuit results were recorded for {regionName(data.region)} in this split.</Empty>}
      {selected && <CircuitModal player={selected} trials={trials} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CircuitModal({ player, trials, onClose }) {
  useModal(onClose);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={player.image} name={player.name} size="lg" playerId={player.playerId} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black text-slate-950 dark:text-white">{player.name}'s Best Placements</h2>
              <div className="text-sm font-bold text-slate-500">{ordinal(player.rank)} · {player.points} points</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label="Close">✕</button>
        </div>
        <div className="grid gap-2">
          {player.results.map((result) => {
            const trial = trials.find((item) => item.name === result.trial);
            const body = (
              <>
                <div>
                  <div className="text-lg font-black text-slate-950 dark:text-white">{result.trial}</div>
                  <div className="text-xs font-semibold text-slate-500">{date(trial?.startsAt)}{result.counted ? "" : " · dropped"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-slate-950 dark:text-white">{ordinal(result.placement)}</div>
                  <div className="text-sm font-bold text-slate-500">{result.points} points</div>
                </div>
              </>
            );
            const style = `flex items-center justify-between gap-3 rounded-xl border p-3 ${result.counted ? "border-slate-300 dark:border-slate-600" : "border-dashed border-slate-300 opacity-60 dark:border-slate-700"}`;
            return trial?.eventId
              ? <a key={result.trial} href={`/esports/event/${trial.eventId}`} className={`${style} hover:border-blue-400`}>{body}</a>
              : <div key={result.trial} className={style}>{body}</div>;
          })}
          <a href={`/esports/player/id/${player.playerId}`} className="mt-1 text-center text-sm font-black text-blue-600 hover:underline dark:text-blue-300">Open profile →</a>
        </div>
      </div>
    </div>
  );
}
