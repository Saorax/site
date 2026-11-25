import "../../../../styles/global.css";
import "../../../../../fonts/style.css";
import { host } from "../../../../stuff";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderTree,
  Fullscreen,
  GitCompare,
  Layers3,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Star,
  Swords,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  Pill,
  SearchInput,
  Section,
  SelectInput,
  Spinner,
  Tabs,
  Toggle,
  DataViewToggle,
  RawData,
  cx,
  matchesWords,
  useDataView,
  useDebounced,
} from "../../../../components/ui";

const ANIMATION_FPS = 24;
const TABS = [
  ["overview", "Overview", SlidersHorizontal],
  ["layers", "Layers", Layers3],
  ["combat", "Hitbox", Swords],
  ["swaps", "Swaps", Sparkles],
  ["raw", "Raw", FolderTree],
];
const SIMPLE_TABS = new Set(["overview", "combat"]);
const CAST_LABELS = {
  TargetMethod: "Targeting",
  Hurtbox: "Hurtbox",
  CastTime: "Cast timing",
  BaseDamage: "Damage",
  FixedRecoverTime: "Fixed recovery",
  RecoverTime: "Recovery",
  CooldownTime: "Cooldown",
  SpeedLimit: "Speed limit",
  FireImpulseMaxX: "Max forward push",
  AllowLeaveGround: "Can leave the ground",
};
const BACKGROUNDS = {
  checker:
    "bg-[linear-gradient(45deg,#172033_25%,transparent_25%),linear-gradient(-45deg,#172033_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#172033_75%),linear-gradient(-45deg,transparent_75%,#172033_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] bg-slate-950",
  dark: "bg-slate-950",
  light: "bg-slate-100",
};

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

function titleCase(value) {
  return String(value || "")
    .replace(/\.swf$/i, "")
    .replace(/^Animation_/, "")
    .replace(/^a__?/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timelineMarkers(metadata, frameCount, followUpStart = null) {
  const markers = [
    [metadata?.loopStart, "Loop", "bg-cyan-400"],
    [metadata?.recoveryStart, "Recovery", "bg-amber-400"],
    [metadata?.previewFrame, "Preview", "bg-fuchsia-400"],
    [followUpStart, "Follow-up", "bg-rose-400"],
  ].filter(([value]) => Number.isFinite(value) && value >= 0 && value < frameCount);
  return [...markers.reduce((groups, [value, label, color]) => {
    const group = groups.get(value) || { value, labels: [], colors: [] };
    group.labels.push(label);
    group.colors.push(color);
    groups.set(value, group);
    return groups;
  }, new Map()).values()];
}

function IconButton({ label, active, disabled, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border px-2 text-sm font-bold transition",
        active
          ? "border-blue-400 bg-blue-500 text-white"
          : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

const BADGE_TONES = { cyan: "sky", red: "rose", green: "emerald" };

function Badge({ children, tone = "slate" }) {
  return <Pill tone={BADGE_TONES[tone] || tone}>{children}</Pill>;
}

function PanelHeading({ children, className = "" }) {
  return <div className={cx("mb-2 text-xs font-bold uppercase tracking-wide text-blue-200", className)}>{children}</div>;
}

function Field({ label, value, mono = false }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <Card className="px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cx("mt-1 break-words text-sm text-slate-100", mono && "font-mono")}>
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </div>
    </Card>
  );
}

function animationSearchText(entry) {
  return [entry.label, entry.folderLabel, entry.rigLabel, entry.legend, entry.ownerName, entry.folder, entry.rig, entry.animation, entry.power];
}

function animationTree(catalog, query, hitboxesOnly) {
  const tree = {};
  for (const entry of catalog.animations) {
    if (hitboxesOnly && !entry.hasHitbox) continue;
    if (query.trim() && !matchesWords(query, animationSearchText(entry))) continue;
    tree[entry.folder] ??= {};
    tree[entry.folder][entry.rig] ??= [];
    tree[entry.folder][entry.rig].push(entry);
  }
  return tree;
}

function matchingAnimations(catalog, query, hitboxesOnly) {
  return (catalog?.animations || []).filter((entry) => {
    if (hitboxesOnly && !entry.hasHitbox) return false;
    return matchesWords(query, animationSearchText(entry));
  });
}

function folderLabel(rigs, folder, playerNames) {
  return (playerNames && Object.values(rigs || {})[0]?.[0]?.folderLabel) || folder;
}

const PLAYER_NAMES_KEY = "anim-player-names";

function readPlayerNames() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(PLAYER_NAMES_KEY) === "1";
  } catch {
    return false;
  }
}

function savePlayerNames(value) {
  try {
    window.localStorage.setItem(PLAYER_NAMES_KEY, value ? "1" : "0");
  } catch {}
}

function AnimationNode({ entry, selected, onSelect, playerNames }) {
  const active = selected?.id === entry.id;
  const buttonRef = useRef(null);

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView({ block: "center" });
  }, [active]);

  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onSelect(entry)}
        className={cx(
          "flex w-full items-center rounded-md px-2 py-0.5 text-left text-xs transition",
          active
            ? "bg-blue-500 text-white"
            : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
        )}
      >
        {entry.ownerIcon && (
          <img
            src={`${host}${entry.ownerIcon}`}
            alt=""
            title={entry.ownerName || undefined}
            className="mr-1.5 h-5 w-5 shrink-0 object-contain"
            loading="lazy"
          />
        )}
        <span className="truncate" title={playerNames ? entry.animation : entry.label || undefined}>{playerNames ? entry.label || entry.animation : entry.animation}</span>
      </button>
    </li>
  );
}

function RigNode({ folder, rig, animations, selected, onSelect, forceOpen, playerNames }) {
  const active = selected?.folder === folder && selected?.rig === rig;
  const [open, setOpen] = useState(active || forceOpen);

  useEffect(() => {
    if (active || forceOpen) setOpen(true);
  }, [active, forceOpen]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cx(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs transition hover:bg-slate-800/70",
          active && "bg-slate-800 text-blue-200",
        )}
      >
        <span className="grid h-3 w-3 shrink-0 place-items-center">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="truncate" title={playerNames ? rig : undefined}>{(playerNames && animations[0]?.rigLabel) || rig}</span>
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {animations.map((entry) => (
            <AnimationNode key={entry.id} entry={entry} selected={selected} onSelect={onSelect} playerNames={playerNames} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderNode({ folder, rigs, selected, onSelect, forceOpen, playerNames }) {
  const active = selected?.folder === folder;
  const [open, setOpen] = useState(active || forceOpen);

  useEffect(() => {
    if (active || forceOpen) setOpen(true);
  }, [active, forceOpen]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cx(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs transition hover:bg-slate-800/70",
          active && "bg-slate-800 text-blue-200",
        )}
      >
        <span className="grid h-3 w-3 shrink-0 place-items-center">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="truncate" title={playerNames ? folder : undefined}>{folderLabel(rigs, folder, playerNames)}</span>
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {Object.keys(rigs).sort().map((rig) => (
            <RigNode
              key={rig}
              folder={folder}
              rig={rig}
              animations={rigs[rig]}
              selected={selected}
              onSelect={onSelect}
              forceOpen={forceOpen}
              playerNames={playerNames}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function AnimationBrowser({ catalog, selected, onSelect, onRandom, query, setQuery, hitboxesOnly, setHitboxesOnly, playerNames, setPlayerNames }) {
  const deferredQuery = useDebounced(query, 180);
  const tree = useMemo(() => animationTree(catalog, deferredQuery, hitboxesOnly), [catalog, deferredQuery, hitboxesOnly]);
  const folders = playerNames
    ? Object.keys(tree).sort((left, right) => folderLabel(tree[left], left, true).localeCompare(folderLabel(tree[right], right, true), undefined, { numeric: true, sensitivity: "base" }))
    : Object.keys(tree).sort();
  const resultCount = useMemo(
    () => folders.reduce(
      (total, folder) => total + Object.values(tree[folder]).reduce((count, entries) => count + entries.length, 0),
      0,
    ),
    [folders, tree],
  );
  const searching = Boolean(deferredQuery.trim());

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-white">Animations</h2>
          <span className="text-sm text-slate-400">{resultCount.toLocaleString()}</span>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="File, clip, move or legend" label="Search animations" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Toggle label="Has hitbox data" checked={hitboxesOnly} onChange={setHitboxesOnly} />
            <Toggle label="Player names" checked={playerNames} onChange={setPlayerNames} />
          </div>
          <button
            type="button"
            onClick={onRandom}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Random
          </button>
        </div>
      </div>
      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/80 p-1">
        {folders.length ? (
          <ul className="space-y-1 pb-3">
            {folders.map((folder) => (
              <FolderNode
                key={folder}
                folder={folder}
                rigs={tree[folder]}
                selected={selected}
                onSelect={onSelect}
                forceOpen={searching}
                playerNames={playerNames}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            bare
            title="No animations match"
            action={(query || hitboxesOnly) && (
              <button type="button" onClick={() => { setQuery(""); setHitboxesOnly(false); }} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Clear filters</button>
            )}
          />
        )}
      </div>
    </div>
  );
}

function sourceImage(source) {
  if (!source?.icon) return "";
  return source.icon.startsWith("/") ? `${host}${source.icon}` : source.icon;
}

function SourceSelect({ selections, onChange, sources, label = "Definitive art sources" }) {
  const [query, setQuery] = useState("");
  const [groupLimits, setGroupLimits] = useState({});
  const deferredQuery = useDebounced(query, 180);
  const grouped = useMemo(() => {
    const result = new Map();
    for (const source of sources) {
      const search = `${source.name} ${source.subtitle} ${source.internalName}`.toLowerCase();
      if (deferredQuery && !search.includes(deferredQuery.toLowerCase())) continue;
      if (!result.has(source.group)) result.set(source.group, []);
      result.get(source.group).push(source);
    }
    return result;
  }, [sources, deferredQuery]);
  useEffect(() => setGroupLimits({}), [sources, deferredQuery]);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <PanelHeading>{label}</PanelHeading>
        {Object.keys(selections).length > 0 && (
          <button type="button" onClick={() => onChange({})} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700">Clear all</button>
        )}
      </div>
      <SearchInput value={query} onChange={setQuery} placeholder="Find an art source" shortcut={false} className="mb-2" />
      <div className="app-scrollbar max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
        {[...grouped.entries()].map(([group, entries]) => {
          const selectedKey = selections[group];
          const selected = entries.find((entry) => entry.key === selectedKey) || sources.find((entry) => entry.key === selectedKey);
          const limit = groupLimits[group] || 48;
          const byPriorityAndName = (left, right) =>
            Number(left.priority || 0) - Number(right.priority || 0)
            || String(left.name || "").localeCompare(String(right.name || ""));
          const preferred = entries
            .filter((entry) => Number(entry.priority || 0) <= 0)
            .sort(byPriorityAndName);
          const alternatives = entries
            .filter((entry) => Number(entry.priority || 0) > 0)
            .sort(byPriorityAndName);
          const prioritizedEntries = [...preferred, ...alternatives];
          const visibleEntries = prioritizedEntries.slice(0, limit);
          if (selected && !visibleEntries.some((entry) => entry.key === selected.key)) {
            visibleEntries.unshift(selected);
          }
          const shownCount = Math.min(prioritizedEntries.length, limit);
          const remaining = Math.max(0, entries.length - shownCount);
          return (
            <details key={group} open className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2">
                {selected ? (
                  <img src={sourceImage(selected)} alt="" className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-800 text-[10px] text-slate-500">{entries.length}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{group}</div>
                  <div className="truncate text-xs text-slate-400">
                    {selected?.name || `Showing ${shownCount} of ${entries.length}`}
                  </div>
                </div>
                {selected && <button type="button" aria-label={`Clear ${group}`} onClick={(event) => { event.preventDefault(); const next = { ...selections }; delete next[group]; onChange(next); }} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </summary>
              <div className="grid grid-cols-3 gap-1 border-t border-slate-800 p-1.5">
                {visibleEntries.map((source) => (
                  <button
                    key={source.key}
                    type="button"
                    onClick={() => onChange({ ...selections, [group]: source.key })}
                    className={cx(
                      "flex min-w-0 flex-col items-center rounded-md border p-1.5 text-center [content-visibility:auto] [contain-intrinsic-size:86px]",
                      selectedKey === source.key ? "border-blue-400 bg-blue-500/15" : "border-slate-800 bg-slate-900 hover:border-slate-600",
                    )}
                  >
                    {source.icon ? <img src={sourceImage(source)} alt="" loading="lazy" className="h-14 w-full shrink-0 object-contain" /> : <div className="h-14 w-full shrink-0 rounded bg-slate-800" />}
                    <span className="mt-1 line-clamp-2 min-h-8 text-[10px] font-bold leading-tight text-white">{source.name}</span>
                  </button>
                ))}
              </div>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setGroupLimits((current) => ({ ...current, [group]: limit + 48 }))}
                  className="w-full border-t border-slate-800 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/10"
                >
                  Show {Math.min(48, remaining)} more
                </button>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}

function castSeriesValue(value, index) {
  const values = String(value ?? "").split(",").map((entry) => entry.trim());
  if (!values.some(Boolean)) return "";
  for (let cursor = Math.min(index, values.length - 1); cursor >= 0; cursor -= 1) {
    if (values[cursor] && values[cursor] !== "!") return values[cursor];
  }
  return values.find((entry) => entry && entry !== "!") || "";
}

function CastDatum({ label, value, active = false }) {
  const { full } = useDataView();
  if (value === undefined || value === null || value === "") return null;
  const plain = CAST_LABELS[label];
  return (
    <div className={cx("min-w-0 rounded-md border px-2 py-1.5", active ? "border-rose-400/60 bg-rose-500/10" : "border-slate-800 bg-slate-950/75")}>
      <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">{plain ? (full && plain !== label ? `${plain} (${label})` : plain) : label}</div>
      <div className="break-words font-mono text-[10px] font-black text-slate-200">{String(value)}</div>
    </div>
  );
}

function CastTimeline({ combat, frameCount, currentFrame }) {
  const { full } = useDataView();
  const timeline = combat?.timeline || [];
  if (!timeline.length) return null;
  return (
    <section className="flex shrink-0 flex-col border-t border-slate-800 bg-slate-950/95">
      <header className="flex items-center justify-between px-3 py-1.5 text-xs font-black text-slate-300">
        <span>{full ? "PowerType cast timeline" : "Hit timing"}</span>
        <span className="font-mono text-[11px] text-slate-500">Frame {currentFrame} / {Math.max(0, frameCount - 1)}{full ? ` / ${timeline.length} PowerTypes` : ""}</span>
      </header>
      <div className="app-scrollbar overflow-x-auto border-t border-slate-800 p-1.5">
        <div className="flex w-max min-w-full items-start gap-2">
          {timeline.map((power) => {
            const powerActive = combat.activeEvents?.some((active) => active.powerName === power.powerName);
            const linked = !full ? [] : [
              power.data.ComboName && `ComboName: ${power.data.ComboName}`,
              power.data.ComboOverrideIfHit && `ComboOverrideIfHit: ${power.data.ComboOverrideIfHit}`,
              power.data.ComboOverrideIfRelease && `ComboOverrideIfRelease: ${power.data.ComboOverrideIfRelease}`,
              power.data.BGPowerOnFire && `BGPowerOnFire: ${power.data.BGPowerOnFire}`,
            ].filter(Boolean);
            return (
            <article key={power.powerName} className={cx("w-[min(27rem,84vw)] shrink-0 rounded-lg border bg-slate-900/80 p-1.5", powerActive ? "border-rose-400/70 shadow-[0_0_0_1px_rgba(251,113,133,.18)]" : "border-slate-800")}>
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words font-mono text-xs font-black text-white">{power.powerName}</div>
                  {full && <div className="font-mono text-[9px] text-slate-500">{power.via}{power.parent ? ` <- ${power.parent}` : ""}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {full && power.data.PowerID && <Badge tone="blue">PowerID {power.data.PowerID}</Badge>}
                  <Badge tone={powerActive ? "red" : "slate"}>{power.branch}</Badge>
                </div>
              </header>
              <div className="relative mt-1.5 h-6 overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                <div className="absolute inset-y-0 z-10 w-px bg-white/70" style={{ left: `${(currentFrame / Math.max(1, frameCount - 1)) * 100}%` }} />
                {power.events.map((event) => {
                  const start = event.startFrame;
                  const end = event.endFrame;
                  const left = (start / Math.max(1, frameCount - 1)) * 100;
                  const width = Math.max(0.75, ((end - start + 1) / Math.max(1, frameCount)) * 100);
                  const active = currentFrame >= start && currentFrame <= end;
                  return (
                    <div
                      key={`${power.powerName}-${event.index}`}
                      title={full ? `Cast ${event.index + 1}: ${event.raw}` : `Cast ${event.index + 1}: frames ${event.startFrame}-${event.endFrame}`}
                      className={cx("absolute inset-y-1 rounded-sm border", active ? "border-rose-200 bg-rose-400" : "border-sky-400/50 bg-sky-500/50")}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{full ? "Power info" : "Move"}</div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <CastDatum label="TargetMethod" value={power.data.TargetMethod} />
                <CastDatum label="Hurtbox" value={power.data.Hurtbox} />
              </div>
              <div className="mt-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{full ? "Power cast data" : "Timing and damage"}</div>
              <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {full && <CastDatum label="CastTime" value={power.data.CastTime} />}
                <CastDatum label="BaseDamage" value={power.data.BaseDamage} />
                <CastDatum label="FixedRecoverTime" value={power.data.FixedRecoverTime} />
                <CastDatum label="RecoverTime" value={power.data.RecoverTime} />
                <CastDatum label="CooldownTime" value={power.data.CooldownTime} />
                <CastDatum label="SpeedLimit" value={power.data.SpeedLimit} />
                <CastDatum label="FireImpulseMaxX" value={power.data.FireImpulseMaxX} />
                <CastDatum label="AllowLeaveGround" value={power.data.AllowLeaveGround} />
              </div>
              <div className="mt-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{full ? "Cast info" : "Casts"}</div>
              <div className="app-scrollbar mt-1 flex gap-1 overflow-x-auto pb-1">
                {power.events.map((event) => {
                  const active = currentFrame >= event.startFrame && currentFrame <= event.endFrame;
                  return (
                    <section key={event.index} className={cx("w-44 shrink-0 rounded-md border p-2", active ? "border-rose-400/70 bg-rose-500/10" : "border-slate-800 bg-slate-950/70")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-white">Cast {event.index + 1}</span>
                        {active && <span className="text-[9px] font-black uppercase text-rose-300">Active</span>}
                      </div>
                      {full && <div className="mt-0.5 break-words font-mono text-[10px] font-black text-sky-300">{event.raw}</div>}
                      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
                        <span>Animation</span><span className="text-right font-mono text-slate-300">{event.startFrame}-{event.endFrame}</span>
                        <span>Game ticks</span><span className="text-right font-mono text-slate-300">{event.gameStart}-{event.gameEnd}</span>
                        <span>Delay / active</span><span className="text-right font-mono text-slate-300">{event.delay} / {event.duration}</span>
                      </div>
                      {castSeriesValue(power.data.BaseDamage, event.index) && (
                        <div className="mt-2 flex justify-between gap-2 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-400">
                          <span>{full ? "BaseDamage" : "Damage"}</span>
                          <span className="text-slate-200">{castSeriesValue(power.data.BaseDamage, event.index)}</span>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              {linked.length > 0 && <div className="mt-2 break-words font-mono text-[10px] text-amber-300/80">{linked.join(" / ")}</div>}
              {power.data.DevNotes && <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[11px] text-slate-400">{power.data.DevNotes}</div>}
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CombatOverlay({ frame, showHitboxes, showHurtboxes }) {
  const [hovered, setHovered] = useState(null);
  if (!frame?.combat || (!showHitboxes && !showHurtboxes)) return null;
  const viewBox = frame.viewBox || { x: 0, y: 0, width: 1000, height: 1000 };
  const origin = frame.combat.coordinateOrigin || { x: 512, y: 512 };
  const showTooltip = (event, type, data) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;
    setHovered({
      type,
      data,
      x: Math.min(bounds.width - 190, Math.max(8, event.clientX - bounds.left + 12)),
      y: Math.min(bounds.height - 120, Math.max(8, event.clientY - bounds.top + 12)),
    });
  };
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} preserveAspectRatio="xMidYMid meet" onPointerLeave={() => setHovered(null)}>
        {showHurtboxes && frame.combat.hurtboxes.map((box, index) => (
          <g
            key={`hurt-${index}`}
            className="pointer-events-auto cursor-help"
            onPointerMove={(event) => showTooltip(event, "Hurtbox", box)}
            onPointerLeave={() => setHovered(null)}
          >
            <rect x={origin.x + box.x - box.width / 2} y={origin.y + box.y - box.height / 2} width={box.width} height={box.height} rx="4" fill="rgba(34,211,238,.18)" stroke="#22d3ee" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <rect x={origin.x + box.x - box.width / 2 - 8} y={origin.y + box.y - box.height / 2 - 8} width={box.width + 16} height={box.height + 16} rx="10" fill="transparent" stroke="transparent" strokeWidth="16" vectorEffect="non-scaling-stroke" />
            <text className="pointer-events-none" x={origin.x + box.x} y={origin.y + box.y - box.height / 2 - 6} textAnchor="middle" fill="#67e8f9" fontSize="14" fontWeight="900">{box.name}</text>
          </g>
        ))}
        {showHitboxes && frame.combat.hitboxes.map((box, index) => (
          <g
            key={`hit-${index}`}
            opacity={box.active ? 1 : 0.45}
            className="pointer-events-auto cursor-help"
            onPointerMove={(event) => showTooltip(event, "Hitbox", box)}
            onPointerLeave={() => setHovered(null)}
          >
            <ellipse cx={(box.originX ?? origin.x) + box.x} cy={(box.originY ?? origin.y) + box.y} rx={box.radiusX} ry={box.radiusY} fill="rgba(248,113,113,.2)" stroke={box.active ? "#fb7185" : "#f59e0b"} strokeWidth="3" strokeDasharray={box.active ? undefined : "8 5"} vectorEffect="non-scaling-stroke" />
            <ellipse cx={(box.originX ?? origin.x) + box.x} cy={(box.originY ?? origin.y) + box.y} rx={box.radiusX + 8} ry={box.radiusY + 8} fill="transparent" stroke="transparent" strokeWidth="16" vectorEffect="non-scaling-stroke" />
            <text className="pointer-events-none" x={(box.originX ?? origin.x) + box.x} y={(box.originY ?? origin.y) + box.y + 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900">{index + 1}</text>
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute z-30 w-48 rounded-lg border border-slate-600 bg-slate-950/95 p-2 shadow-2xl" style={{ left: hovered.x, top: hovered.y }}>
          <div className={cx("text-[10px] font-black uppercase", hovered.type === "Hitbox" ? "text-rose-300" : "text-cyan-300")}>{hovered.type}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] font-black text-white">{hovered.data.powerName || hovered.data.name}</div>
          {hovered.type === "Hitbox" ? (
            <div className="mt-1 grid grid-cols-2 gap-x-2 text-[9px] text-slate-400">
              <span>Center</span><span className="text-right font-mono">{hovered.data.x}, {hovered.data.y}</span>
              <span>Radius</span><span className="text-right font-mono">{hovered.data.radiusX} x {hovered.data.radiusY}</span>
              <span>Damage</span><span className="text-right font-mono">{hovered.data.damage || "0"}</span>
              <span>Target</span><span className="truncate text-right font-mono">{hovered.data.targetMethod || "-"}</span>
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-x-2 text-[9px] text-slate-400">
              <span>Size</span><span className="text-right font-mono">{hovered.data.width} x {hovered.data.height}</span>
              <span>Offset</span><span className="text-right font-mono">{hovered.data.offsetX}, {hovered.data.offsetY}</span>
              <span>Frames</span><span className="text-right font-mono">{hovered.data.frameRange}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AnimationStage({
  frame,
  loading,
  selected,
  selectedBone,
  setSelectedBone,
  hiddenBones,
  soloBone,
  zoom,
  background,
  showHitboxes,
  showHurtboxes,
  viewport,
}) {
  const root = useRef(null);
  const [hoveredBone, setHoveredBone] = useState(null);
  const displaySvg = useMemo(() => {
    if (!frame?.svg || !viewport) return frame?.svg || "";
    return frame.svg.replace(/\bviewBox="[^"]+"/i, `viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}"`);
  }, [frame?.svg, viewport?.x, viewport?.y, viewport?.width, viewport?.height]);
  useEffect(() => {
    if (!root.current) return;
    const layers = root.current.querySelectorAll("[data-bone]");
    layers.forEach((layer) => {
      const name = layer.getAttribute("data-bone");
      const hidden = hiddenBones.has(name) || (soloBone && soloBone !== name);
      layer.style.display = hidden ? "none" : "";
      layer.style.filter = selectedBone === name
        ? "drop-shadow(0 0 5px #38bdf8) brightness(1.35)"
        : hoveredBone?.name === name
          ? "drop-shadow(0 0 4px #f8fafc) brightness(1.2)"
          : "";
      layer.style.cursor = "pointer";
      layer.style.pointerEvents = "all";
    });
  }, [frame, hiddenBones, selectedBone, soloBone, hoveredBone?.name]);

  const handleClick = (event) => {
    const layer = event.target.closest?.("[data-bone]");
    const name = layer?.getAttribute("data-bone") || "";
    setSelectedBone(selectedBone === name ? "" : name);
  };
  const handlePointerMove = (event) => {
    const layer = event.target.closest?.("[data-bone]");
    const name = layer?.getAttribute("data-bone");
    if (!name) {
      setHoveredBone(null);
      return;
    }
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredBone({
      name,
      gfx: layer.getAttribute("data-gfx") || "",
      x: Math.min(rect.width - 12, Math.max(12, event.clientX - rect.left + 12)),
      y: Math.min(rect.height - 12, Math.max(12, event.clientY - rect.top + 12)),
    });
  };

  return (
    <div className={cx("relative flex min-h-0 flex-1 items-center justify-center overflow-auto", BACKGROUNDS[background] || BACKGROUNDS.checker)}>
      {!selected && (
        <EmptyState bare icon={<Sparkles className="h-10 w-10 text-blue-400" />} title="No animation selected">
          Pick one from the Animations list.
        </EmptyState>
      )}
      {selected && loading && <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/60 backdrop-blur-sm"><LoadingState inline label="Rendering" /></div>}
      {selected && !loading && !frame && <EmptyState bare title="Nothing to draw on this frame" />}
      {frame && (
        <div
          className="relative m-auto flex h-full w-full items-center justify-center p-3 transition-transform duration-100"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <div
              ref={root}
              onClick={handleClick}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoveredBone(null)}
              className="absolute inset-0 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:overflow-visible"
              dangerouslySetInnerHTML={{ __html: displaySvg }}
            />
            {hoveredBone && (
              <div className="pointer-events-none absolute z-20 max-w-52 rounded-md border border-sky-400/60 bg-slate-950/95 px-2 py-1.5 shadow-xl" style={{ left: hoveredBone.x, top: hoveredBone.y }}>
                <div className="font-mono text-[10px] font-black text-sky-200">{hoveredBone.name}</div>
                {hoveredBone.gfx && <div className="mt-0.5 truncate text-[9px] text-slate-500">{hoveredBone.gfx}</div>}
              </div>
            )}
            <CombatOverlay frame={{ ...frame, viewBox: viewport || frame.viewBox }} showHitboxes={showHitboxes} showHurtboxes={showHurtboxes} />
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPanel({ metadata, frame, sourceSelections, setSourceSelections, sources, colors, colorScheme, setColorScheme, compare, setCompare, compareSourceSelections, setCompareSourceSelections, preserveCanvas, setPreserveCanvas }) {
  const { full } = useDataView();
  if (!metadata) return <EmptyState bare title="No animation selected" />;
  return (
    <div className="space-y-3 p-3">
      <ColorSchemeSelect colors={colors} colorScheme={colorScheme} setColorScheme={setColorScheme} />
      <SourceSelect selections={sourceSelections} onChange={setSourceSelections} sources={sources} />
      <Card className="px-3 py-2">
        <Toggle label="Compare definitive source" checked={compare} onChange={setCompare} />
      </Card>
      {compare && <SourceSelect selections={compareSourceSelections} onChange={setCompareSourceSelections} sources={sources} label="Comparison sources" />}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Frames" value={metadata.frameCount} />
        <Field label="Recovery starts" value={metadata.recoveryStart} />
        {full && (
          <>
            <Field label="Bones" value={metadata.bones?.length} />
            <Field label="Loop start" value={metadata.loopStart} />
            <Field label="Preview" value={metadata.previewFrame} />
            <Field label="Current layers" value={frame?.bones?.length || 0} />
            <Field label="Maximum layers" value={metadata.maxBonesPerFrame} />
          </>
        )}
      </div>
      {full && <Field label="Animation" value={metadata.animation} mono />}
      {metadata.swap && (
        <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{metadata.swap.ownerType} swap</Badge>
            <span className="text-sm font-bold text-white">{metadata.swap.owner}</span>
          </div>
          <div className="mt-2 text-xs text-slate-300">
            Uses combat data from{" "}
            <span className={cx("font-bold text-sky-200", full && "font-mono")}>
              {full ? metadata.swap.baseAnimations?.join(", ") || metadata.animation : "the base move"}
            </span>
            {" "}with its own animation and art.
          </div>
        </div>
      )}
      {full && (
        <>
          <Field label="Rig" value={metadata.rig} mono />
          <Field label="Source file" value={metadata.folder} mono />
          <Field label="Manifest" value={metadata.manifest} mono />
        </>
      )}
      {metadata.references?.length > 0 && (
        <div>
          <PanelHeading>Used by</PanelHeading>
          <div className="space-y-1">
            {metadata.references.map((reference) => {
              const Component = reference.url ? "a" : "div";
              return (
              <Component key={`${reference.kind}-${reference.id}-${reference.name}`} href={reference.url || undefined} className={cx("flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2", reference.url && "hover:border-blue-400 hover:bg-blue-500/10")}>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-white">{reference.name}</div>
                  <div className="truncate text-[10px] text-slate-400">{reference.detail}</div>
                </div>
                <Badge tone="blue">{reference.kind}</Badge>
              </Component>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LayersPanel({ frame, selectedBone, setSelectedBone, hiddenBones, setHiddenBones, soloBone, setSoloBone }) {
  const layers = frame?.bones || [];
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {!layers.length && <EmptyState bare title="No layers on this frame" className="col-span-2" />}
      {layers.map((bone, index) => {
        const hidden = hiddenBones.has(bone.name);
        const selected = selectedBone === bone.name;
        return (
          <div key={`${bone.id}-${index}`} className={cx("rounded-xl border p-2", selected ? "border-blue-400 bg-blue-500/10" : "border-slate-700 bg-slate-950/60")}>
            <button type="button" onClick={() => setSelectedBone(bone.name)} className="w-full text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-bold text-white">{bone.name}</span>
                <span className="text-[10px] text-slate-500">#{bone.layer}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[9px] text-slate-400">
                <span>x {Number(bone.x || 0).toFixed(1)}</span>
                <span>y {Number(bone.y || 0).toFixed(1)}</span>
                <span>gfx {bone.frame}</span>
              </div>
            </button>
            <div className="mt-2 flex gap-1">
              <IconButton label={hidden ? "Show layer" : "Hide layer"} active={hidden} onClick={() => setHiddenBones((current) => {
                const next = new Set(current);
                if (next.has(bone.name)) next.delete(bone.name);
                else next.add(bone.name);
                return next;
              })}>{hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</IconButton>
              <button type="button" onClick={() => setSoloBone((current) => current === bone.name ? "" : bone.name)} className={cx("rounded-xl border px-2 text-[10px] font-bold", soloBone === bone.name ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-slate-700 text-slate-400 hover:text-white")}>Solo</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CombatPanel({
  metadata,
  frame,
  powerName,
  setPowerName,
  showHitboxes,
  setShowHitboxes,
  showHurtboxes,
  setShowHurtboxes,
  followUpPath,
  setFollowUpPath,
  setPlayMode,
}) {
  const powers = metadata?.powers || [];
  const combat = frame?.combat;
  return (
    <div className="space-y-3 p-3">
      <SelectInput
        label="PowerType"
        inline={false}
        value={powerName}
        onChange={setPowerName}
        options={[{ value: "", label: "Automatic animation match" }, ...powers.map((power) => ({ value: power.PowerName, label: power.PowerName }))]}
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={showHitboxes} onClick={() => setShowHitboxes(!showHitboxes)} className={cx("rounded-xl border p-3 text-sm font-bold", showHitboxes ? "border-rose-400 bg-rose-500/15 text-rose-200" : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500")}>Hitboxes</button>
        <button type="button" aria-pressed={showHurtboxes} onClick={() => setShowHurtboxes(!showHurtboxes)} className={cx("rounded-xl border p-3 text-sm font-bold", showHurtboxes ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500")}>Hurtboxes</button>
      </div>
      {!powers.length && !combat?.power && <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">No move uses this animation directly. Hurtboxes may still show.</div>}
      {combat?.activeTiming && (
        <Card>
          <PanelHeading className="mb-0">Active cast</PanelHeading>
          <div className="mt-1 text-sm font-bold text-white">{combat.activeTiming.powerName} / Cast {combat.activeTiming.index + 1}</div>
          <div className="mt-1 font-mono text-xs text-blue-300">{combat.activeTiming.raw}</div>
          <div className="mt-2 text-xs text-slate-400">Animation frames {combat.activeTiming.startFrame}-{combat.activeTiming.endFrame}</div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Hitboxes" value={combat?.hitboxes?.length || 0} />
        <Field label="Hurtboxes" value={combat?.hurtboxes?.length || 0} />
      </div>
      {metadata?.followUps?.length > 0 && (
        <div>
          <PanelHeading>Follow-up animations</PanelHeading>
          <div className="space-y-1">
            {metadata.followUps.map((followUp) => (
              <button key={`${followUp.path}:${followUp.powerName}:${followUp.branch}`} type="button" onClick={() => { setFollowUpPath(followUp.path); setPlayMode("all"); }} className={cx("w-full rounded-xl border p-2 text-left", followUpPath === followUp.path ? "border-amber-400 bg-amber-500/15" : "border-slate-700 bg-slate-950/60 hover:border-amber-400 hover:bg-amber-500/10")}>
                <div className="text-xs font-bold text-white">{titleCase(followUp.animation)}</div>
                <div className="mt-1 font-mono text-[10px] text-slate-400">
                  Starts after frame {Number(followUp.startAfterFrame || 0)}
                  {followUp.parentPowerId ? ` / PowerID ${followUp.parentPowerId}` : ""}
                  {` / ${followUp.automatic ? "Automatic" : titleCase(followUp.branch || followUp.via)}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapsPanel({ metadata, selectedBone, setSelectedBone, gfxQuery, setGfxQuery, gfxResults, gfxLoading, swaps, addSwap, removeSwap }) {
  const selectedSwap = swaps.find((swap) => swap.target === selectedBone);
  return (
    <div className="space-y-3 p-3">
      <SelectInput
        label="Target bone"
        inline={false}
        value={selectedBone}
        onChange={setSelectedBone}
        options={[{ value: "", label: "Select a rendered bone" }, ...(metadata?.bones || []).map((bone) => ({ value: bone.name, label: bone.name }))]}
      />
      {selectedBone && (
        <>
          <SearchInput value={gfxQuery} onChange={setGfxQuery} placeholder={`Find a replacement for ${selectedBone}`} shortcut={false} />
          {selectedSwap && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 p-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-blue-200">{selectedSwap.bone}</div>
                <div className="truncate text-[10px] text-slate-400">{selectedSwap.folder}</div>
              </div>
              <IconButton label="Remove swap" onClick={() => removeSwap(selectedBone)}><X className="h-4 w-4" /></IconButton>
            </div>
          )}
          <div className="app-scrollbar max-h-[48dvh] space-y-1 overflow-y-auto">
            {gfxLoading && <LoadingState inline label="Searching" className="p-3" />}
            {!gfxLoading && !gfxResults.length && <EmptyState bare title="No matching graphics" />}
            {!gfxLoading && gfxResults.map((entry) => (
              <button key={`${entry.folder}/${entry.bone}`} type="button" onClick={() => addSwap({ target: selectedBone, folder: entry.folder, bone: entry.bone })} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-2 text-left hover:border-blue-400 hover:bg-blue-500/10">
                <div className="truncate text-xs font-bold text-white">{entry.bone}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span className="truncate">{entry.folder}</span>
                  <span>{entry.frames} frame{entry.frames === 1 ? "" : "s"}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {swaps.length > 0 && (
        <div>
          <PanelHeading>Applied overrides</PanelHeading>
          <div className="space-y-1">
            {swaps.map((swap) => (
              <button key={swap.target} type="button" onClick={() => setSelectedBone(swap.target)} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-2 text-left text-[10px] hover:border-slate-500">
                <span className="font-bold text-sky-300">{swap.target}</span>
                <span className="mx-2 text-slate-600">→</span>
                <span className="text-white">{swap.bone}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RawPanel({ metadata, frame }) {
  const frameData = useMemo(() => {
    if (!frame) return null;
    try {
      return JSON.parse(JSON.stringify(frame, (key, value) => key === "svg" && typeof value === "string" ? `[SVG: ${value.length.toLocaleString()} characters]` : value));
    } catch {
      return null;
    }
  }, [frame]);
  const name = String(metadata?.animation || "animation").replace(/[^\w-]+/g, "-");
  return (
    <div className="space-y-3 p-3">
      <RawData data={metadata} title="Animation metadata" filename={`${name}-metadata`} />
      <RawData data={frameData} title="Rendered frame" filename={`${name}-frame`} />
    </div>
  );
}

function Inspector(props) {
  const { tab: requestedTab, setTab } = props;
  const { full } = useDataView();
  const tab = full || SIMPLE_TABS.has(requestedTab) ? requestedTab : "overview";
  const tabs = full ? TABS : TABS.filter(([value]) => SIMPLE_TABS.has(value));
  return (
    <Section
      padded={false}
      className="flex min-h-0 flex-col xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-slate-800 p-3">
        <Tabs
          variant="small"
          label="Animation details"
          value={tab}
          onChange={setTab}
          items={tabs.map(([value, label, Icon]) => ({ value, label, icon: <Icon className="h-3.5 w-3.5" /> }))}
        />
      </div>
      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewPanel {...props} />}
        {tab === "layers" && <LayersPanel {...props} />}
        {tab === "combat" && <CombatPanel {...props} />}
        {tab === "swaps" && <SwapsPanel {...props} />}
        {tab === "raw" && <RawPanel {...props} />}
      </div>
    </Section>
  );
}

function sourcePayload(key, sources) {
  if (!key || key === "raw") return { kind: "raw" };
  const source = sources.find((entry) => entry.key === key);
  if (!source) return { kind: "raw" };
  if (source.kind === "skin") return { kind: "skin", heroId: source.heroId, skin: source.skin };
  return { kind: source.kind, id: source.id, folder: source.folder, name: source.customArt };
}

function sourcePayloads(selections, sources) {
  return Object.values(selections || {})
    .filter(Boolean)
    .map((key) => sourcePayload(key, sources))
    .filter((source) => source.kind !== "raw");
}

function colorSwatches(color) {
  return Object.entries(color || {})
    .filter(([key, value]) => /_Swap$/i.test(key) && /^0x[0-9a-f]{6}$/i.test(String(value)))
    .map(([, value]) => `#${String(value).slice(2)}`)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);
}

function ColorSchemeSelect({ colors, colorScheme, setColorScheme }) {
  if (!colors.length) return null;
  const selected = colors.find((color) => Number(color.ColorSchemeID) === Number(colorScheme));
  const swatches = selected ? colorSwatches(selected) : ["#f8fafc", "#94a3b8", "#334155"];
  return (
    <Card className="p-2.5">
      <PanelHeading>Color Scheme</PanelHeading>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-14 shrink-0 overflow-hidden rounded-md border border-slate-700" aria-hidden="true">
          {swatches.map((color) => <span key={color} className="h-full min-w-1 flex-1" style={{ backgroundColor: color }} />)}
        </div>
        <SelectInput
          className="flex-1 [&>select]:w-full"
          value={colorScheme}
          onChange={(value) => setColorScheme(Number(value))}
          options={[{ value: 0, label: "Default Colors" }, ...colors.map((color) => ({ value: color.ColorSchemeID, label: color.DisplayName || color.ColorSchemeName }))]}
        />
      </div>
    </Card>
  );
}

function sourceSelectionsFromQuery(value) {
  if (!value) return {};
  return String(value).split(",").reduce((result, entry) => {
    const sourceKey = decodeURIComponent(entry);
    const kind = sourceKey.split(":")[0];
    const groups = {
      skin: "Legend Skins",
      weapon: "Weapon Skins",
      avatar: "Avatars",
      podium: "Podiums",
      spawnbot: "Sidekicks",
    };
    if (groups[kind]) result[groups[kind]] = sourceKey;
    return result;
  }, {});
}

export default function AnimationViewer() {
  const initialParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [catalog, setCatalog] = useState(null);
  const [sources, setSources] = useState([]);
  const [colors, setColors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [frameData, setFrameData] = useState(null);
  const [playbackFrames, setPlaybackFrames] = useState([]);
  const [playbackConfigKey, setPlaybackConfigKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [renderLoading, setRenderLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(initialParams.get("q") || "");
  const [hitboxesOnly, setHitboxesOnly] = useState(initialParams.get("hitboxes") === "1");
  const [playerNames, setPlayerNames] = useState(false);
  useEffect(() => { setPlayerNames(readPlayerNames()); }, []);
  const [frame, setFrame] = useState(Number(initialParams.get("frame") || 0));
  const [playing, setPlaying] = useState(false);
  const [playMode, setPlayMode] = useState("all");
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [background, setBackground] = useState("checker");
  const [tab, setTab] = useState("overview");
  const { full: dataFull } = useDataView();
  const [sourceSelections, setSourceSelections] = useState(() =>
    sourceSelectionsFromQuery(initialParams.get("sources") || initialParams.get("source"))
  );
  const [compare, setCompare] = useState(false);
  const [compareSourceSelections, setCompareSourceSelections] = useState({});
  const [compareFrame, setCompareFrame] = useState(null);
  const [swaps, setSwaps] = useState([]);
  const [selectedBone, setSelectedBone] = useState("");
  const [hiddenBones, setHiddenBones] = useState(new Set());
  const [soloBone, setSoloBone] = useState("");
  const [gfxQuery, setGfxQuery] = useState("");
  const [gfxResults, setGfxResults] = useState([]);
  const [gfxLoading, setGfxLoading] = useState(false);
  const [powerName, setPowerName] = useState(initialParams.get("power") || "");
  const [followUpPath, setFollowUpPath] = useState(initialParams.get("followUp") || "");
  const [startPlace, setStartPlace] = useState(initialParams.get("start") === "ledge" ? "ledge" : "");
  const [colorScheme, setColorScheme] = useState(Number(initialParams.get("color") || 0) || 0);
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [showHurtboxes, setShowHurtboxes] = useState(false);
  const [preserveCanvas, setPreserveCanvas] = useState(false);
  const [exportMode, setExportMode] = useState("svg");
  const [exporting, setExporting] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState({ detail: 0, power: 0, gfx: 0 });
  const failedAction = useRef("");
  const currentPlaybackConfigKey = JSON.stringify({
    animation: selected?.id || "",
    sourceSelections,
    swaps,
    powerName,
    colorScheme,
    preserveCanvas,
    playMode,
    followUpPath,
    startPlace,
  });
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("animation-viewer-favorites") || "[]")); } catch { return new Set(); }
  });
  const renderController = useRef(null);
  const playbackRequest = useRef(0);
  const playbackConfig = useRef(currentPlaybackConfigKey);
  const preloadedConfig = useRef("");
  const resumePlayback = useRef(false);
  playbackConfig.current = currentPlaybackConfigKey;
  const stageRef = useRef(null);
  const debouncedGfxQuery = useDebounced(gfxQuery, 180);
  const matchingCatalogAnimations = useMemo(
    () => matchingAnimations(catalog, query, hitboxesOnly),
    [catalog, query, hitboxesOnly],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    jsonRequest(`${host}/game/animations/catalog`).then((catalogData) => {
      if (!active) return;
      setCatalog(catalogData);
      const path = initialParams.get("animation");
      const wanted = path && catalogData.animations.find((entry) => entry.path === path);
      if (wanted) setSelected(wanted);
      setLoading(false);
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [catalogAttempt]);

  useEffect(() => {
    let active = true;
    jsonRequest(`${host}/game/colors`)
      .then((data) => {
        if (active) setColors(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setColors([]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    playbackRequest.current += 1;
    resumePlayback.current = resumePlayback.current || playing;
    setPlaying(false);
    setPlaybackFrames([]);
    setFrame(0);
    setFrameData(null);
  }, [currentPlaybackConfigKey]);

  const renderBody = (
    requestedFrame,
    selections = sourceSelections,
    animationEntry = selected,
    initialOffset = undefined,
    initialVelocity = undefined,
  ) => {
    const continuation = metadata?.followUps?.find((entry) => entry.path === followUpPath);
    const endFrame = requestedFrame === "all"
      && animationEntry?.path === selected?.path
      && Number.isFinite(Number(continuation?.startAfterFrame))
      ? Number(continuation.startAfterFrame)
      : undefined;
    return {
      folder: animationEntry.folder,
      rig: animationEntry.rig,
      animation: animationEntry.animation,
      frame: requestedFrame,
      endFrame,
      sources: sourcePayloads(selections, sources),
      swaps,
      powerName,
      colorScheme,
      initialOffset,
      initialVelocity,
      preserveCanvas,
      ...(startPlace === "ledge" ? { scenario: { map: "SmallBrawlhaven", start: "ledge" } } : {}),
    };
  };

  const renderSequenceBody = (segment = "all") => {
    const requestBody = renderBody(segment === "loop" ? "loop" : "all");
    const followUp = followUpPath && segment !== "loop"
      ? catalog?.animations?.find((entry) => entry.path === followUpPath)
      : null;
    const followUpData = followUp
      ? metadata?.followUps?.find((entry) => entry.path === followUpPath)
      : null;
    if (followUp && Number.isFinite(Number(followUpData?.startAfterFrame))) {
      requestBody.followUp = {
        folder: followUp.folder,
        rig: followUp.rig,
        animation: followUp.animation,
        path: followUp.path,
        powerName: followUpData.powerName,
        via: followUpData.via,
        branch: followUpData.branch,
        automatic: followUpData.automatic,
        startAfterFrame: Number(followUpData.startAfterFrame),
        startAfterTick: Number.isFinite(Number(followUpData.startAfterTick))
          ? Number(followUpData.startAfterTick)
          : undefined,
        parent: followUpData.parent,
        parentPowerId: followUpData.parentPowerId,
      };
    }
    return requestBody;
  };

  const requestFrame = async (
    requestedFrame,
    selections = sourceSelections,
    signal,
    animationEntry = selected,
    initialOffset = undefined,
    initialVelocity = undefined,
  ) => {
    const payload = await jsonRequest(`${host}/game/animations/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(renderBody(
        requestedFrame,
        selections,
        animationEntry,
        initialOffset,
        initialVelocity,
      )),
      signal,
    });
    return payload.frames?.[0] || null;
  };

  useEffect(() => {
    if (!selected) return;
    const isInitialSelection = initialParams.get("animation") === selected.path;
    const requestedPower = isInitialSelection ? initialParams.get("power") || "" : "";
    setMetadata(null);
    setPlaybackFrames([]);
    setFrameData(null);
    setPlaying(false);
    setPowerName(requestedPower);
    setFollowUpPath(isInitialSelection ? initialParams.get("followUp") || "" : "");
    setSelectedBone("");
    setSwaps([]);
    setHiddenBones(new Set());
    setSoloBone("");
    setError("");
    const controller = new AbortController();
    setRenderLoading(true);
    const powerQuery = requestedPower ? `&power=${encodeURIComponent(requestedPower)}` : "";
    const detailUrl = `${host}/game/animations/detail/${encodeURIComponent(selected.folder)}/${encodeURIComponent(selected.rig)}/${encodeURIComponent(selected.animation)}?${powerQuery.slice(1)}`;
    const sourceUrl = `${host}/game/animations/sources?folder=${encodeURIComponent(selected.folder)}&rig=${encodeURIComponent(selected.rig)}&animation=${encodeURIComponent(selected.animation)}${powerQuery}`;
    Promise.all([
      jsonRequest(detailUrl, { signal: controller.signal, cache: "no-store" }),
      jsonRequest(sourceUrl, { signal: controller.signal, cache: "no-store" }),
    ])
      .then(([data, sourceData]) => {
        setMetadata(data);
        const availableSources = sourceData.sources || [];
        setSources(availableSources);
        if (!availableSources.some((source) => source.kind === "skin" || source.kind === "weapon")) {
          setColorScheme(0);
        }
        setSourceSelections((current) =>
          Object.keys(current).length ? current : (sourceData.defaultSelections || {})
        );
        const requestedFollowUp = isInitialSelection ? initialParams.get("followUp") || "" : "";
        const automaticFollowUp = data.followUps?.find((entry) => entry.automatic)?.path || "";
        setFollowUpPath(
          data.followUps?.some((entry) => entry.path === requestedFollowUp)
            ? requestedFollowUp
            : automaticFollowUp,
        );
        setPlayMode("all");
        const initialFrame = Math.max(0, Math.min(Number(initialParams.get("frame") || data.previewFrame || 0), data.frameCount - 1));
        setFrame(initialFrame);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") { failedAction.current = "detail"; setError(requestError.message); }
      })
      .finally(() => setRenderLoading(false));
    return () => controller.abort();
  }, [selected, retryAttempt.detail]);

  useEffect(() => {
    if (!selected || !metadata || String(metadata.selectedPowerName || "") === powerName) return;
    const controller = new AbortController();
    const powerQuery = powerName ? `?power=${encodeURIComponent(powerName)}` : "";
    const sourcePowerQuery = powerName ? `&power=${encodeURIComponent(powerName)}` : "";
    setRenderLoading(true);
    Promise.all([
      jsonRequest(`${host}/game/animations/detail/${encodeURIComponent(selected.folder)}/${encodeURIComponent(selected.rig)}/${encodeURIComponent(selected.animation)}${powerQuery}`, { signal: controller.signal, cache: "no-store" }),
      jsonRequest(`${host}/game/animations/sources?folder=${encodeURIComponent(selected.folder)}&rig=${encodeURIComponent(selected.rig)}&animation=${encodeURIComponent(selected.animation)}${sourcePowerQuery}`, { signal: controller.signal, cache: "no-store" }),
    ]).then(([data, sourceData]) => {
      setMetadata(data);
      setSources(sourceData.sources || []);
      setFollowUpPath((current) => (
        data.followUps?.some((entry) => entry.path === current)
          ? current
          : data.followUps?.find((entry) => entry.automatic)?.path || ""
      ));
    }).catch((requestError) => {
      if (requestError.name !== "AbortError") { failedAction.current = "power"; setError(requestError.message); }
    }).finally(() => setRenderLoading(false));
    return () => controller.abort();
  }, [selected, powerName, metadata?.selectedPowerName, retryAttempt.power]);

  useEffect(() => {
    if (!selected || !metadata) return;
    const cached = playbackConfigKey === currentPlaybackConfigKey
      ? playbackFrames.find((entry) => entry.index === frame)
      : null;
    if (cached) {
      setFrameData(cached);
    }
  }, [selected, metadata, frame, JSON.stringify(sourceSelections), JSON.stringify(swaps), powerName, preserveCanvas, playbackConfigKey, currentPlaybackConfigKey]);

  useEffect(() => {
    if (!compare || !selected || !metadata) {
      setCompareFrame(null);
      return;
    }
    const controller = new AbortController();
    const segmentEntry = frameData?.segmentPath
      ? catalog?.animations?.find((entry) => entry.path === frameData.segmentPath) || selected
      : selected;
    const segmentFrame = frameData?.sourceIndex ?? frame;
    requestFrame(
      segmentFrame,
      compareSourceSelections,
      controller.signal,
      segmentEntry,
      frameData?.segmentBaseOffset,
      frameData?.segmentBaseVelocity,
    ).then(setCompareFrame).catch(() => setCompareFrame(null));
    return () => controller.abort();
  }, [compare, JSON.stringify(compareSourceSelections), selected, metadata, frame, frameData?.segmentPath, frameData?.sourceIndex, JSON.stringify(frameData?.segmentBaseOffset), JSON.stringify(frameData?.segmentBaseVelocity), JSON.stringify(swaps), powerName, preserveCanvas, colorScheme]);

  useEffect(() => {
    if (!selectedBone) {
      setGfxResults([]);
      return;
    }
    const controller = new AbortController();
    setGfxLoading(true);
    jsonRequest(`${host}/game/animations/gfx?bone=${encodeURIComponent(selectedBone)}&query=${encodeURIComponent(debouncedGfxQuery)}&limit=120`, { signal: controller.signal })
      .then((data) => setGfxResults(data.matches || []))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") { failedAction.current = "gfx"; setError(requestError.message); }
      })
      .finally(() => setGfxLoading(false));
    return () => controller.abort();
  }, [selectedBone, debouncedGfxQuery, retryAttempt.gfx]);

  useEffect(() => {
    if (
      !playing
      || playbackFrames.length < 2
      || playbackConfigKey !== currentPlaybackConfigKey
    ) return;
    const position = Math.max(0, playbackFrames.findIndex((entry) => entry.index === frame));
    const currentPlaybackFrame = playbackFrames[position];
    const delay = Math.max(
      8,
      (Number(currentPlaybackFrame?.durationMs) || 1000 / ANIMATION_FPS) / speed,
    );
    const timer = window.setTimeout(() => {
      let next = position + direction;
      if (next >= playbackFrames.length || next < 0) {
        if (playMode === "pingpong") {
          setDirection((current) => -current);
          next = position - direction;
        } else {
          next = direction > 0 ? 0 : playbackFrames.length - 1;
        }
      }
      const nextFrame = playbackFrames[Math.max(0, Math.min(next, playbackFrames.length - 1))];
      if (nextFrame) {
        setFrame(nextFrame.index);
        setFrameData(nextFrame);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, playbackFrames, playbackConfigKey, currentPlaybackConfigKey, frame, speed, direction, playMode]);

  useEffect(() => {
    if (!selected) return;
    const params = new URLSearchParams(window.location.search);
    params.set("animation", selected.path);
    params.set("frame", String(frame));
    if (query) params.set("q", query); else params.delete("q");
    if (hitboxesOnly) params.set("hitboxes", "1"); else params.delete("hitboxes");
    params.delete("category");
    params.delete("file");
    const selectedSources = Object.values(sourceSelections).filter(Boolean);
    if (selectedSources.length) params.set("sources", selectedSources.join(",")); else params.delete("sources");
    if (powerName) params.set("power", powerName); else params.delete("power");
    if (followUpPath) params.set("followUp", followUpPath); else params.delete("followUp");
    if (startPlace) params.set("start", startPlace); else params.delete("start");
    if (colorScheme) params.set("color", String(colorScheme)); else params.delete("color");
    params.delete("source");
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }, [selected, frame, query, hitboxesOnly, JSON.stringify(sourceSelections), powerName, followUpPath, startPlace, colorScheme]);

  const loadPlayback = async (autoPlay = true) => {
    if (!selected) return;
    if (playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey) {
      resumePlayback.current = false;
      if (autoPlay) setPlaying((current) => !current);
      return;
    }
    const requestedFrame = frame;
    const requestedConfigKey = currentPlaybackConfigKey;
    const requestId = ++playbackRequest.current;
    renderController.current?.abort();
    const controller = new AbortController();
    renderController.current = controller;
    setRenderLoading(true);
    setError("");
    try {
      const followUp = followUpPath && playMode !== "loop"
        ? catalog?.animations?.find((entry) => entry.path === followUpPath)
        : null;
      const requestBody = renderSequenceBody(playMode === "loop" ? "loop" : "all");
      const payload = await jsonRequest(`${host}/game/animations/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      if (followUp && !(payload.frames || []).some((entry) => entry.segmentIndex === 1)) {
        throw new Error(`The ${followUp.animation} continuation was not returned by the API.`);
      }
      if (
        playbackRequest.current !== requestId
        || playbackConfig.current !== requestedConfigKey
      ) return;
      const frames = (payload.frames || []).map((entry, index) => ({
        ...entry,
        index,
        sourceIndex: entry.sourceIndex ?? entry.index,
        segmentIndex: entry.segmentIndex ?? 0,
        segmentPath: entry.segmentPath ?? selected.path,
        segmentAnimation: entry.segmentAnimation ?? selected.animation,
        segmentFrameCount: entry.segmentFrameCount ?? payload.frameCount,
        localOrder: entry.localOrder ?? index,
      }));
      if (
        playbackRequest.current !== requestId
        || playbackConfig.current !== requestedConfigKey
      ) return;
      setPlaybackFrames(frames);
      setPlaybackConfigKey(requestedConfigKey);
      if (frames.length) {
        const selectedFrame = frames.find((entry) => entry.index === requestedFrame) || frames[0];
        setFrame(selectedFrame.index);
        setFrameData(selectedFrame);
        setPlaying(autoPlay && frames.length > 1);
      }
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      if (preloadedConfig.current === requestedConfigKey) preloadedConfig.current = "";
      if (playbackRequest.current === requestId) { failedAction.current = "playback"; setError(requestError.message); }
    } finally {
      if (renderController.current === controller) renderController.current = null;
      if (playbackRequest.current === requestId) setRenderLoading(false);
    }
  };

  useEffect(() => () => renderController.current?.abort(), []);

  useEffect(() => {
    if (!selected || !metadata || preloadedConfig.current === currentPlaybackConfigKey) return;
    preloadedConfig.current = currentPlaybackConfigKey;
    void loadPlayback(false);
  }, [selected, metadata, currentPlaybackConfigKey]);

  useEffect(() => {
    if (
      !resumePlayback.current
      || !selected
      || !metadata
      || !frameData
      || renderLoading
    ) return;
    resumePlayback.current = false;
    void loadPlayback();
  }, [selected, metadata, frameData, renderLoading, currentPlaybackConfigKey]);

  const selectAnimation = (entry) => {
    setSelected(entry);
    setSourceSelections({});
    setCompareSourceSelections({});
    try {
      const recent = JSON.parse(localStorage.getItem("animation-viewer-recent") || "[]");
      localStorage.setItem("animation-viewer-recent", JSON.stringify([entry.id, ...recent.filter((id) => id !== entry.id)].slice(0, 30)));
    } catch {}
  };

  const toggleFavorite = (id) => setFavorites((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem("animation-viewer-favorites", JSON.stringify([...next]));
    return next;
  });

  const addSwap = (swap) => {
    setSwaps((current) => [...current.filter((entry) => entry.target !== swap.target), swap]);
    setPlaybackFrames([]);
  };
  const removeSwap = (target) => {
    setSwaps((current) => current.filter((entry) => entry.target !== target));
    setPlaybackFrames([]);
  };

  const step = (amount) => {
    if (!metadata) return;
    const next = Math.max(0, Math.min(effectiveFrameCount - 1, frame + amount));
    setPlaying(false);
    setFrame(next);
  };

  const downloadSvg = () => {
    if (!frameData?.svg) return;
    const blob = new Blob([frameData.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.animation}-${frame}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadExport = async () => {
    if (!selected || !frameData) return;
    if (exportMode === "svg") {
      downloadSvg();
      return;
    }
    setExporting(true);
    setError("");
    try {
      const [format, segment] = exportMode.split(":");
      const activeEntry = frameData?.segmentPath
        ? catalog?.animations?.find((entry) => entry.path === frameData.segmentPath) || selected
        : selected;
      const exportBody = format === "apng"
        ? renderSequenceBody(segment === "loop" ? "loop" : "all")
        : renderBody(
          frameData?.sourceIndex ?? frame,
          sourceSelections,
          activeEntry,
          frameData?.segmentBaseOffset,
          frameData?.segmentBaseVelocity,
        );
      const response = await fetch(`${host}/game/animations/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...exportBody,
          format,
          segment,
          fps: ANIMATION_FPS,
          exportScale: 1,
        }),
      });
      if (!response.ok) throw new Error(`Export failed with ${response.status}`);
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `${selected.animation}.${format === "apng" ? "png" : format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      failedAction.current = "export";
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  };

  const selectedFollowUp = metadata?.followUps?.find((entry) => entry.path === followUpPath);
  const effectiveFrameCount = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? playbackFrames.length
    : selectedFollowUp
      ? Math.min(metadata?.frameCount || 0, Number(selectedFollowUp.startAfterFrame || 0) + 1)
      : metadata?.frameCount || 0;
  const playbackPosition = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? Math.max(0, playbackFrames.findIndex((entry) => entry.index === frame))
    : Math.max(0, frame);
  const elapsedPlaybackMs = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? playbackFrames
      .slice(0, playbackPosition)
      .reduce((total, entry) => total + (Number(entry?.durationMs) || 1000 / ANIMATION_FPS), 0)
    : playbackPosition * 1000 / ANIMATION_FPS;
  const totalPlaybackMs = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? playbackFrames.reduce(
      (total, entry) => total + (Number(entry?.durationMs) || 1000 / ANIMATION_FPS),
      0,
    )
    : effectiveFrameCount * 1000 / ANIMATION_FPS;
  const followUpStart = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? playbackFrames.find((entry) => entry.segmentIndex === 1)?.index ?? null
    : null;
  const playbackViewport = playbackFrames.length && playbackConfigKey === currentPlaybackConfigKey
    ? (() => {
      const viewports = playbackFrames.map((entry) => entry.viewBox).filter(Boolean);
      if (!viewports.length) return null;
      const x = Math.min(...viewports.map((value) => value.x));
      const y = Math.min(...viewports.map((value) => value.y));
      const right = Math.max(...viewports.map((value) => value.x + value.width));
      const bottom = Math.max(...viewports.map((value) => value.y + value.height));
      return { x, y, width: right - x, height: bottom - y };
    })()
    : null;
  const sharedViewport = (() => {
    const viewports = [playbackViewport, frameData?.viewBox, compare ? compareFrame?.viewBox : null].filter(Boolean);
    if (!viewports.length) return null;
    const x = Math.min(...viewports.map((value) => value.x));
    const y = Math.min(...viewports.map((value) => value.y));
    const right = Math.max(...viewports.map((value) => value.x + value.width));
    const bottom = Math.max(...viewports.map((value) => value.y + value.height));
    return { x, y, width: right - x, height: bottom - y };
  })();

  const retryAfterError = async () => {
    const action = failedAction.current;
    failedAction.current = "";
    setError("");
    if (action === "export") return downloadExport();
    if (action === "detail" || action === "power" || action === "gfx") {
      setRetryAttempt((current) => ({ ...current, [action]: current[action] + 1 }));
      return undefined;
    }
    if (selected && metadata) {
      preloadedConfig.current = "";
      return loadPlayback(false);
    }
    return undefined;
  };

  if (loading || !catalog) {
    return (
      <PageShell>
        <PageHeader title="Animations" />
        {loading ? (
          <LoadingState label="Loading animations" rows={4} />
        ) : (
          <ErrorState message="The animation list didn't load." detail={error} onRetry={() => setCatalogAttempt((value) => value + 1)} />
        )}
      </PageShell>
    );
  }

  const colorableSources = sources.some((source) => source.kind === "skin" || source.kind === "weapon");
  const inspectorProps = {
    tab, setTab, metadata, frame: frameData, sourceSelections, setSourceSelections, sources,
    colors: colorableSources ? colors : [], colorScheme, setColorScheme,
    compare, setCompare, compareSourceSelections, setCompareSourceSelections, preserveCanvas, setPreserveCanvas,
    selectedBone, setSelectedBone, hiddenBones, setHiddenBones, soloBone, setSoloBone,
    powerName, setPowerName, showHitboxes, setShowHitboxes, showHurtboxes, setShowHurtboxes,
    gfxQuery, setGfxQuery, gfxResults, gfxLoading, swaps, addSwap, removeSwap,
    followUpPath, setFollowUpPath,
    setPlayMode,
  };
  const errorMessages = {
    detail: "Couldn't load this animation.",
    power: "Couldn't load that move.",
    gfx: "Couldn't search the graphics.",
    playback: "Couldn't play this animation.",
    export: "Couldn't finish the export.",
  };

  const library = ({ close }) => (
    <AnimationBrowser
      catalog={catalog}
      selected={selected}
      onSelect={(entry) => { selectAnimation(entry); close(); }}
      onRandom={() => {
        if (!matchingCatalogAnimations.length) return;
        selectAnimation(matchingCatalogAnimations[Math.floor(Math.random() * matchingCatalogAnimations.length)]);
        close();
      }}
      query={query}
      setQuery={setQuery}
      hitboxesOnly={hitboxesOnly}
      setHitboxesOnly={setHitboxesOnly}
      playerNames={playerNames}
      setPlayerNames={(value) => { setPlayerNames(value); savePlayerNames(value); }}
    />
  );

  return (
    <PageShell title="Animations" subtitle={selected?.label || selected?.animation} sidebarLabel="Animations" sidebarTitle="Animation list" sidebar={library}>
      <PageHeader
        eyebrow={selected ? [selected.folderLabel, selected.rigLabel !== selected.folderLabel && selected.rigLabel].filter(Boolean).join(" · ") || undefined : undefined}
        title={<span className="break-words">{selected ? selected.label || selected.animation : "Animations"}</span>}
        meta={selected ? (dataFull ? <span className="break-all font-mono text-xs">{selected.path}</span> : undefined) : <span className="break-all">{`${catalog.stats.animations.toLocaleString()} animations in ${catalog.stats.folders} files`}</span>}
        actions={selected && (
          <div className="flex flex-wrap items-center gap-1.5">
            <DataViewToggle size="sm" />
            <IconButton label="Favorite" active={favorites.has(selected.id)} onClick={() => toggleFavorite(selected.id)}><Star className={cx("h-4 w-4", favorites.has(selected.id) && "fill-current")} /></IconButton>
            <SelectInput
              label="Export"
              value={exportMode}
              onChange={setExportMode}
              options={[
                { value: "svg", label: "Current SVG" },
                { value: "png", label: "Current PNG" },
                { value: "apng:loop", label: "Loop APNG" },
                { value: "apng:full", label: "Full APNG" },
              ]}
            />
            <IconButton label="Export animation" disabled={!frameData || exporting} onClick={downloadExport}>{exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</IconButton>
            <IconButton label="Fullscreen stage" onClick={() => stageRef.current?.requestFullscreen?.()}><Fullscreen className="h-4 w-4" /></IconButton>
          </div>
        )}
      />

      {error && (
        <div className="flex items-start gap-2">
          <ErrorState className="min-w-0 flex-1" message={errorMessages[failedAction.current] || "Couldn't load this."} detail={error} onRetry={retryAfterError} />
          <IconButton label="Dismiss" onClick={() => { failedAction.current = ""; setError(""); }}><X className="h-4 w-4" /></IconButton>
        </div>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_24rem] min-[112.5rem]:grid-cols-[minmax(0,1fr)_28rem] min-[137.5rem]:grid-cols-[minmax(0,1fr)_36rem]">
        <div ref={stageRef} className="min-w-0 bg-slate-950">
          <Section padded={false} className="overflow-hidden" bodyClassName="flex min-w-0 flex-col">
            <div className={cx("flex lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem]", selected ? "h-[55dvh] min-h-[20rem]" : "h-56")}>
              <div className={cx("min-h-0 min-w-0 flex-1", compare ? "grid grid-cols-1 lg:grid-cols-2" : "flex")}>
                <AnimationStage frame={frameData} loading={renderLoading} selected={selected} selectedBone={selectedBone} setSelectedBone={setSelectedBone} hiddenBones={hiddenBones} soloBone={soloBone} zoom={zoom} background={background} showHitboxes={showHitboxes} showHurtboxes={showHurtboxes} viewport={sharedViewport} />
                {compare && <div className="relative flex min-h-64 min-w-0 border-t border-slate-700 lg:min-h-0 lg:border-l lg:border-t-0"><div className="absolute left-3 top-3 z-20"><Badge tone="cyan"><GitCompare className="h-3 w-3" />Comparison</Badge></div><AnimationStage frame={compareFrame} loading={renderLoading && !compareFrame} selected={selected} selectedBone="" setSelectedBone={() => {}} hiddenBones={new Set()} soloBone="" zoom={zoom} background={background} showHitboxes={showHitboxes} showHurtboxes={showHurtboxes} viewport={sharedViewport} /></div>}
              </div>
            </div>

            {selected && metadata && (
              <>
                <div className="shrink-0 border-t border-slate-800 p-2 sm:p-3">
                  <div className="mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <IconButton label="First frame" onClick={() => { setPlaying(false); setFrame(0); }}><SkipBack className="h-4 w-4" /></IconButton>
                      <IconButton label="Previous frame" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
                      <IconButton label={playing ? "Pause" : "Play"} active={playing} onClick={loadPlayback}>{renderLoading ? <Spinner className="h-4 w-4" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</IconButton>
                      <IconButton label="Next frame" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></IconButton>
                      <IconButton label="Last frame" onClick={() => { setPlaying(false); setFrame(Math.max(0, effectiveFrameCount - 1)); }}><SkipForward className="h-4 w-4" /></IconButton>
                      <div className="mx-1 hidden h-7 w-px shrink-0 bg-slate-700 lg:block" />
                      <SelectInput
                        label="Play"
                        className="shrink-0"
                        value={playMode}
                        onChange={(value) => { setPlayMode(value); setPlaybackFrames([]); setPlaying(false); }}
                        options={[
                          { value: "all", label: "Full animation" },
                          { value: "loop", label: "Loop segment" },
                          { value: "pingpong", label: "Ping-pong" },
                        ]}
                      />
                      {metadata.followUps?.length > 0 && (
                        <SelectInput
                          label="Then"
                          className="max-w-72 shrink-0"
                          value={followUpPath}
                          onChange={(value) => { setFollowUpPath(value); if (value) setPlayMode("all"); }}
                          options={[
                            { value: "", label: "No follow-up" },
                            ...metadata.followUps.map((followUp) => ({
                              value: followUp.path,
                              label: `${titleCase(followUp.animation)} (${followUp.automatic ? "automatic" : titleCase(followUp.branch || followUp.via)}) after frame ${Number(followUp.startAfterFrame || 0)}`,
                            })),
                          ]}
                        />
                      )}
                      <SelectInput
                        label="Start"
                        className="shrink-0"
                        value={startPlace}
                        onChange={(value) => {
                          setStartPlace(value);
                          setPlaybackFrames([]);
                          setPlaying(false);
                          const selectedFollowUp = metadata.followUps?.find((entry) => entry.path === followUpPath);
                          if (value === "ledge" && selectedFollowUp && !selectedFollowUp.automatic) setFollowUpPath("");
                        }}
                        options={[
                          { value: "", label: "Flat floor" },
                          { value: "ledge", label: "Ledge" },
                        ]}
                      />
                      <SelectInput
                        label="Speed"
                        className="shrink-0"
                        value={speed}
                        onChange={(value) => setSpeed(Number(value))}
                        options={[0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((value) => ({ value, label: `${value}x` }))}
                      />
                      <IconButton label="Reverse direction" active={direction < 0} onClick={() => setDirection((current) => -current)}><RefreshCw className="h-4 w-4" /></IconButton>
                      <div className="mx-1 hidden h-7 w-px shrink-0 bg-slate-700 lg:block" />
                      <IconButton label="Zoom out" onClick={() => setZoom((current) => Math.max(0.25, current - 0.25))}><ZoomOut className="h-4 w-4" /></IconButton>
                      <button type="button" onClick={() => setZoom(1)} className="h-9 min-w-14 shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-300 hover:border-slate-500">{Math.round(zoom * 100)}%</button>
                      <IconButton label="Zoom in" onClick={() => setZoom((current) => Math.min(5, current + 0.25))}><ZoomIn className="h-4 w-4" /></IconButton>
                      <IconButton label="Fit stage" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></IconButton>
                      <SelectInput
                        label="Background"
                        className="shrink-0"
                        value={background}
                        onChange={setBackground}
                        options={[
                          { value: "checker", label: "Transparent" },
                          { value: "dark", label: "Dark" },
                          { value: "light", label: "Light" },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="relative pt-4">
                    <input type="range" aria-label="Frame" min="0" max={Math.max(0, effectiveFrameCount - 1)} value={Math.min(frame, Math.max(0, effectiveFrameCount - 1))} onChange={(event) => { setPlaying(false); setFrame(Number(event.target.value)); }} className="h-2 w-full cursor-pointer accent-blue-500" />
                    {timelineMarkers(metadata, effectiveFrameCount, followUpStart).map((marker) => (
                      <div key={marker.value} className="pointer-events-none absolute top-0 -translate-x-1/2" style={{ left: `${(marker.value / Math.max(1, effectiveFrameCount - 1)) * 100}%` }}>
                        <div className="whitespace-nowrap text-[8px] font-bold text-slate-400">{marker.labels.join(" / ")}</div>
                        <div className="mx-auto flex h-3 w-1.5 overflow-hidden">
                          {marker.colors.map((color, index) => <span key={`${color}-${index}`} className={cx("h-full flex-1", color)} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-400">
                    <span>Frame {frame} / {Math.max(0, effectiveFrameCount - 1)}</span>
                    <span>{ANIMATION_FPS} FPS / {(elapsedPlaybackMs / 1000).toFixed(2)}s of {(totalPlaybackMs / 1000).toFixed(2)}s</span>
                  </div>
                </div>
                <CastTimeline
                  combat={frameData?.combat}
                  frameCount={frameData?.segmentFrameCount || metadata.frameCount}
                  currentFrame={frameData?.sourceIndex ?? frame}
                />
              </>
            )}
          </Section>
        </div>

        <Inspector {...inspectorProps} />
      </div>
    </PageShell>
  );
}
