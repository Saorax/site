import "../../../../styles/global.css";
import "../../../../../fonts/style.css";
import { host } from "../../../../stuff";
import { ArrowRight, ChevronDown, Hand, Info, LoaderCircle, Pause, Play, RotateCcw, Search, SkipBack, Swords, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MAX_DAMAGE = 200;
const TICK_MS = 16;
const TRANSITIONS = {
  link: "then",
  jump: "jump",
  dash: "dash",
  dashjump: "dash jump",
  chase: "chase dodge",
  gc: "gravity cancel",
  string: "string (light pressed during the swing)",
};
const CHASE_DIRECTIONS = {
  forward: "forward",
  forwardUp: "up-forward",
  up: "up",
  forwardDown: "down-forward",
  down: "down",
};
const STAT_KEYS = [
  ["strength", "STR"],
  ["dexterity", "DEX"],
  ["speed", "SPD"],
];
const WEAPON_LABELS = {
  RocketLance: "Rocket Lance",
  Pistol: "Blasters",
  Fists: "Gauntlets",
  Boots: "Battle Boots",
};
const DEFENSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const LEGEND_TAB_DEFENSE = 5;
const SORTS = [
  { key: "stances", label: "Most stances" },
  { key: "leeway", label: "Most frames to spare" },
  { key: "damage", label: "Widest damage range" },
];

const panel = "rounded-2xl border border-slate-700 bg-slate-900 shadow-sm";
const eyebrow = "text-xs font-black uppercase tracking-[0.2em] text-blue-300";
const chip = (active) => classes(
  "rounded-xl border px-2.5 py-1.5 text-xs font-black transition",
  active ? "border-blue-400 bg-blue-500/15 text-blue-200" : "border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-300",
);
const field = "rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30";

function classes(...values) {
  return values.filter(Boolean).join(" ");
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Request failed with ${response.status}`);
  }
  return response.json();
}

function legendName(legend) {
  return legend?.bio?.name?.normal || legend?.codeName || "";
}

function weaponLabel(name) {
  return WEAPON_LABELS[name] || name;
}

function weaponIcon(name) {
  return `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${name}`;
}

function rangeText(ranges) {
  return ranges.map((range) => (range.from === range.to ? `${range.from}%` : `${range.from}–${range.to}%`)).join(", ");
}

function mergeRanges(lists) {
  const steps = new Set();
  for (const ranges of lists) {
    for (const range of ranges) for (let value = range.from; value <= range.to; value += 20) steps.add(value);
  }
  const sorted = [...steps].sort((left, right) => left - right);
  const merged = [];
  for (const value of sorted) {
    const last = merged[merged.length - 1];
    if (last && value - last.to <= 20) last.to = value;
    else merged.push({ from: value, to: value });
  }
  return merged;
}

function rangeWidth(ranges) {
  return ranges.reduce((sum, range) => sum + range.to - range.from + 20, 0);
}

function inDefenses(ranges, defense) {
  return (ranges || []).some((range) => defense >= range.from && defense <= range.to);
}

function valueRanges(values) {
  const sorted = [...new Set(values)].sort((left, right) => left - right);
  const ranges = [];
  for (const value of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && value === last.to + 1) last.to = value;
    else ranges.push({ from: value, to: value });
  }
  return ranges;
}

function defenseText(ranges) {
  return (ranges || []).map((range) => (range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`)).join(", ");
}

function statRange(holders, key) {
  const values = holders.map((holder) => Number(holder[key])).filter(Number.isFinite);
  if (!values.length) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? `${low}` : `${low}–${high}`;
}

function flattenDefenses(payload, defense) {
  const combos = (payload.combos || []).map((combo) => {
    const holders = (combo.holders || []).map((holder) => {
      const { verdicts, defenses, ...stance } = holder;
      const matching = (verdicts || []).filter((verdict) => defense === null || inDefenses(verdict.defenses, defense));
      if (!matching.length) return null;
      const best = [...matching].sort((left, right) => Number(right.leeway ?? -99) - Number(left.leeway ?? -99))[0];
      const { defenses: bestDefenses, ...fields } = best;
      return {
        ...stance,
        ...fields,
        ranges: mergeRanges(matching.map((verdict) => verdict.ranges || [])),
        playRanges: best.ranges,
        playDefense: defense ?? bestDefenses?.[0]?.from ?? 5,
        defenses: defense === null ? defenses : [{ from: defense, to: defense }],
      };
    }).filter(Boolean);
    return holders.length ? { ...combo, holders, bestLeeway: Math.max(...holders.map((holder) => Number(holder.leeway ?? -99))) } : null;
  }).filter(Boolean);
  return { ...payload, combos };
}

function useLegends() {
  const [legends, setLegends] = useState([]);
  useEffect(() => {
    getJson(`${host}/game/legends/summary`)
      .then((list) => setLegends(
        list
          .filter((legend) => !legend.beta?.isBeta && !String(legend.id).startsWith("beta-"))
          .sort((left, right) => (left.releaseOrder ?? 9999) - (right.releaseOrder ?? 9999) || Number(left.release || 0) - Number(right.release || 0) || legendName(left).localeCompare(legendName(right))),
      ))
      .catch(() => setLegends([]));
  }, []);
  return legends;
}

function useWeaponStatus() {
  const [weapons, setWeapons] = useState([]);
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const load = () => {
      getJson(`${host}/game/combos/weapons`, { cache: "no-store" })
        .then((list) => {
          if (cancelled) return;
          setWeapons(list);
          if (list.some((entry) => entry.defenses?.status !== "ready" || entry.defenses?.airStatus !== "ready")) timer = setTimeout(load, 60000);
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(load, 15000);
        });
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return weapons;
}

function usePolled(url, interval = 4000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) {
      setData(null);
      setError("");
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    setData(null);
    setError("");
    const load = () => {
      getJson(url, { cache: "no-store" })
        .then((payload) => {
          if (cancelled) return;
          setData(payload);
          if (payload.status !== "ready" || payload.air?.status === "pending") timer = setTimeout(load, payload.status === "ready" ? 60000 : interval);
        })
        .catch((reason) => !cancelled && setError(String(reason?.message || reason)));
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, interval]);
  return { data, error };
}

function legendImage(legends, heroId, fallbackName) {
  const legend = legends.find((entry) => String(entry.id) === String(heroId));
  if (legend?.image) return `${host}${legend.image}`;
  return `${host}/game/legends/art/${encodeURIComponent(legend ? legendName(legend) : fallbackName)}`;
}

function WeaponIcon({ name, className }) {
  const [broken, setBroken] = useState(false);
  if (name === "Unarmed" || broken) return <Hand className={classes(className, "p-1 text-sky-300")} />;
  return <img src={weaponIcon(name)} alt="" loading="lazy" onError={() => setBroken(true)} className={classes(className, "object-contain")} />;
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-center shadow-sm">
      <div className="text-lg font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Notice({ tone = "slate", children }) {
  const tones = {
    slate: "border-slate-700 bg-slate-900 text-slate-300",
    rose: "border-rose-400/50 bg-rose-500/10 text-rose-200",
    sky: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  };
  return <div className={classes("rounded-2xl border p-4 text-sm font-bold", tones[tone])}>{children}</div>;
}

function DamageBar({ ranges }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        {ranges.map((range) => (
          <div
            key={`${range.from}-${range.to}`}
            className="absolute inset-y-0 rounded-full bg-emerald-400"
            style={{
              left: `${(range.from / (MAX_DAMAGE + 20)) * 100}%`,
              width: `${((range.to - range.from + 20) / (MAX_DAMAGE + 20)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>
  );
}

function baseTransitionLabel(transition, hold, instant, direction, airJump) {
  if (transition === "chase" && CHASE_DIRECTIONS[direction]) return `${airJump ? (Number(hold) > 0 ? `jump, wait ${hold}, ` : "jump, ") : ""}chase dodge ${CHASE_DIRECTIONS[direction]}`;
  if (transition === "dashjump" && Number(hold) > 0) return `dash, wait ${hold}, jump`;
  if (transition === "jump" && instant) return "jump + attack together";
  if (transition === "gc") return `${airJump ? "jump, " : ""}${Number(hold) > 0 ? `gravity cancel, dodge after ${hold} frames` : "gravity cancel"}`;
  return TRANSITIONS[transition] || transition;
}

function transitionLabel(transition, hold, instant, direction, airJump, reverse) {
  const label = baseTransitionLabel(transition, hold, instant, direction, airJump);
  return reverse ? `${label}, turn around` : label;
}

function ComboSteps({ start, airDrift, jumpTick, first, heldDirection, transition, hold, instant, direction, airJump, reverse, second, moveLabel }) {
  const steps = [
    ...(start === "air" ? [{ kind: "transition", key: "jump", lead: true }] : []),
    { kind: "move", key: first, held: heldDirection },
    ...(transition && transition !== "link" ? [{ kind: "transition", key: transition }] : []),
    { kind: "move", key: second },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <span key={`${step.key}-${index}-${step.lead ? "lead" : ""}`} className="flex items-center gap-1.5">
          {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-500" />}
          {step.kind === "transition" ? (
            <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-200">
              {step.lead ? (airDrift === 0 ? "jump straight up" : airDrift === 2 ? "jump forward, then let go" : "jump") : transitionLabel(step.key, hold, instant, direction, airJump, reverse)}
            </span>
          ) : (
            <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm font-black text-white">
              {moveLabel(step.key)}{step.held ? <span className="font-bold text-slate-400"> · hold {step.held}</span> : null}
            </span>
          )}
        </span>
      ))}
      {typeof jumpTick === "number" && (
        <span title="The first move misses a standing opponent at every spacing, so this was checked against an opponent who jumps into it" className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-200">
          vs a jumping opponent
        </span>
      )}
    </div>
  );
}

function stanceStats(holder) {
  return STAT_KEYS.map(([key, label]) => `${label} ${holder[key]}`).join(" · ");
}

function groupHolders(holders) {
  const byLegend = new Map();
  for (const holder of holders) {
    const entry = byLegend.get(holder.heroId) || { heroId: holder.heroId, legend: holder.legend, stances: [] };
    entry.stances.push(holder);
    byLegend.set(holder.heroId, entry);
  }
  return [...byLegend.values()].sort((left, right) => left.legend.localeCompare(right.legend));
}

function holderTitle(holder) {
  return `${stanceStats(holder)}${holder.defenses ? ` · opponent DEF ${defenseText(holder.defenses)}` : ""} · true at ${rangeText(holder.ranges)}`;
}

function StanceButton({ holder, onPlay }) {
  return (
    <button
      onClick={() => onPlay(holder)}
      title={holderTitle(holder)}
      className={classes(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold transition",
        holder.stance === "Base" ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
      )}
    >
      {holder.stance}
    </button>
  );
}

function HolderList({ holders, stanceTotals, legends, onPlay }) {
  const groups = groupHolders(holders);
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {groups.map((group) => {
        const total = stanceTotals.get(group.heroId) || group.stances.length;
        const all = group.stances.length >= total;
        return (
          <div key={group.heroId} className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-950/60 px-2 py-1.5">
            <img src={legendImage(legends, group.heroId, group.legend)} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="mr-1 truncate text-xs font-black text-slate-100">{group.legend}</span>
              {all ? (
                <button
                  onClick={() => onPlay(group.stances.find((stance) => stance.stance === "Base") || group.stances[0])}
                  className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25"
                >
                  every stance
                </button>
              ) : (
                group.stances.map((stance) => <StanceButton key={stance.stance} holder={stance} onPlay={onPlay} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className={classes("rounded-lg border px-2 py-1 text-center", accent ? "border-blue-400/40 bg-blue-500/10" : "border-slate-700 bg-slate-950")}>
      <div className={classes("text-[10px] font-black uppercase tracking-wide", accent ? "text-blue-300" : "text-slate-500")}>{label}</div>
      <div className="text-xs font-black text-white">{value}</div>
    </div>
  );
}

function LeewayBadge({ leeway }) {
  if (!Number.isFinite(leeway) || leeway < 0) return null;
  const tone = leeway >= 3 ? "bg-emerald-500/15 text-emerald-200" : leeway >= 1 ? "bg-sky-500/15 text-sky-200" : "bg-amber-500/15 text-amber-200";
  return (
    <span title="How many frames later the second attack could still land before the opponent can act" className={classes("rounded-lg px-2 py-1 text-xs font-black", tone)}>
      {leeway === 0 ? "frame perfect" : `${leeway} frame${leeway === 1 ? "" : "s"} to spare`}
    </span>
  );
}

function ComboCard({ combo, moveLabel, legends, stanceTotals, onPlay, focusHeroId, note }) {
  const [open, setOpen] = useState(false);
  const holders = focusHeroId ? combo.holders.filter((holder) => String(holder.heroId) === String(focusHeroId)) : combo.holders;
  const ranges = mergeRanges(holders.map((holder) => holder.ranges));
  const leeway = Math.max(...holders.map((holder) => Number(holder.leeway ?? -99)));
  const best = [...holders].sort((left, right) => Number(right.leeway ?? -99) - Number(left.leeway ?? -99))[0];
  const groups = groupHolders(holders);
  const everyone = holders.length >= combo.stanceCount;
  const defenseSpan = holders.some((holder) => holder.defenses)
    ? valueRanges(holders.flatMap((holder) => DEFENSES.filter((defense) => inDefenses(holder.defenses, defense))))
    : null;
  const details = [
    best?.drift === "toward" ? "hold toward" : "",
    Number.isFinite(Number(best?.distance)) && best?.distance !== null ? `start ${best.distance} units away` : "",
  ].filter(Boolean);
  return (
    <article className={classes(panel, "flex flex-col gap-3 p-4 transition hover:border-slate-500")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{combo.start === "air" ? "From a jump" : "From the ground"}</span>
          <ComboSteps start={combo.start} airDrift={best?.airDrift} jumpTick={best?.jumpTick} first={combo.first} heldDirection={best?.heldDirection} transition={best?.transition} hold={best?.hold} instant={best?.instant} direction={best?.direction} airJump={best?.airJump} reverse={best?.reverse} second={combo.second} moveLabel={moveLabel} />
        </div>
        <button
          onClick={() => onPlay(best)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-400"
        >
          <Play className="h-3.5 w-3.5" />
          Watch
        </button>
      </div>
      {note && <div className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-200">{note}</div>}
      <div className="grid grid-cols-4 gap-1.5">
        <StatPill label="Opp. DEF" value={defenseSpan ? defenseText(defenseSpan) : "5"} accent />
        {STAT_KEYS.map(([key, label]) => <StatPill key={key} label={label} value={statRange(holders, key) ?? "–"} />)}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="font-bold text-slate-400">True at <span className="font-black text-emerald-300">{rangeText(ranges)}</span></span>
          <LeewayBadge leeway={leeway} />
        </div>
        <DamageBar ranges={ranges} />
        {!!details.length && <span className="text-[11px] font-bold text-slate-500">{details.join(" · ")}</span>}
      </div>
      {!focusHeroId && (
        <div className="border-t border-slate-800 pt-3">
          {everyone ? (
            <span className="text-xs font-black text-emerald-200">Every legend and stance</span>
          ) : (
            <>
              <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex -space-x-2">
                    {groups.slice(0, 6).map((group) => (
                      <img key={group.heroId} src={legendImage(legends, group.heroId, group.legend)} alt={group.legend} title={group.legend} loading="lazy" className="h-7 w-7 rounded-lg border border-slate-900 bg-slate-800 object-contain" />
                    ))}
                  </span>
                  <span className="truncate text-xs font-bold text-slate-400">
                    {groups.length} legend{groups.length === 1 ? "" : "s"} · {holders.length} stance{holders.length === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronDown className={classes("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-2">
                  <HolderList holders={holders} stanceTotals={stanceTotals} legends={legends} onPlay={onPlay} />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {focusHeroId && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
          {holders.map((holder) => <StanceButton key={holder.stance} holder={holder} onPlay={onPlay} />)}
        </div>
      )}
    </article>
  );
}

function Progress({ data, label }) {
  return (
    <div className={classes(panel, "flex flex-col gap-2 p-4 text-sm text-slate-300")}>
      <span className="flex items-center gap-2 font-bold">
        <LoaderCircle className="h-4 w-4 animate-spin text-blue-400" />
        {label}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-blue-400 transition-all" style={{ width: `${data?.total ? (data.done / data.total) * 100 : 0}%` }} />
      </div>
      <span className="text-xs text-slate-500">
        {data?.total ? `${data.done} of ${data.total} checks` : "Waiting for earlier jobs to finish"}
      </span>
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 sm:w-32 sm:shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function MoveFilter({ moves, firstMove, setFirstMove }) {
  return (
    <FilterRow label="Starts with">
      {[{ key: "all", label: "Any move" }, ...(moves || [])].map((move) => (
        <button key={move.key} onClick={() => setFirstMove(move.key)} className={chip(firstMove === move.key)}>
          {move.label}
        </button>
      ))}
    </FilterRow>
  );
}

function DamageFilter({ damage, setDamage }) {
  return (
    <FilterRow label="Opponent damage">
      <input
        type="range"
        min={0}
        max={MAX_DAMAGE}
        step={20}
        value={damage ?? 0}
        onChange={(event) => setDamage(Number(event.target.value))}
        className="w-full max-w-xs accent-blue-400"
      />
      <span className="w-12 text-sm font-black text-white">{damage === null ? "Any" : `${damage}%`}</span>
      {damage !== null && (
        <button onClick={() => setDamage(null)} className="text-xs font-bold text-slate-400 underline hover:text-white">
          any
        </button>
      )}
    </FilterRow>
  );
}

function sortCombos(combos, sort) {
  const leeway = (combo) => combo.bestLeeway ?? Math.max(...combo.holders.map((holder) => Number(holder.leeway ?? -99)));
  const width = (combo) => rangeWidth(mergeRanges(combo.holders.map((holder) => holder.ranges)));
  const comparators = {
    stances: (left, right) => right.holders.length - left.holders.length || leeway(right) - leeway(left),
    leeway: (left, right) => leeway(right) - leeway(left) || right.holders.length - left.holders.length,
    damage: (left, right) => width(right) - width(left) || right.holders.length - left.holders.length,
  };
  return [...combos].sort(comparators[sort] || comparators.stances);
}

function filterCombos(combos, { firstMove, damage, heroId, baseOnly, start = "all" }) {
  return combos
    .map((combo) => {
      const holders = combo.holders.filter((holder) =>
        (!heroId || String(holder.heroId) === String(heroId))
        && (!baseOnly || holder.stance === "Base")
        && (damage === null || holder.ranges.some((range) => damage >= range.from && damage <= range.to)));
      return holders.length ? { ...combo, holders, stanceCount: combo.stanceCount } : null;
    })
    .filter(Boolean)
    .filter((combo) => firstMove === "all" || combo.first === firstMove)
    .filter((combo) => start === "all" || (combo.start === "air" ? "air" : "ground") === start);
}

function weaponReadiness(entry) {
  const ground = entry?.defenses?.status === "ready";
  const air = entry?.defenses?.airStatus === "ready";
  return { ground, air, label: ground && air ? "ready" : ground ? "ground ready" : "rebuilding" };
}

function WeaponPicker({ weapons, weapon, setWeapon }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
      {weapons.map((entry) => {
        const ready = weaponReadiness(entry);
        return (
          <button
            key={entry.weapon}
            onClick={() => setWeapon(entry.weapon)}
            title={`${weaponLabel(entry.weapon)}: ${ready.ground ? "ground combos ready" : "ground combos being rebuilt"}, ${ready.air ? "jump combos ready" : "jump combos being rebuilt"}`}
            className={classes(chip(weapon === entry.weapon), "flex shrink-0 items-center gap-2 whitespace-nowrap")}
          >
            <WeaponIcon name={entry.weapon} className="h-7 w-7" />
            <span>{weaponLabel(entry.weapon)}</span>
            <span className={classes("h-2 w-2 rounded-full", ready.ground && ready.air ? "bg-emerald-400" : ready.ground ? "bg-sky-400" : "bg-slate-600")} />
          </button>
        );
      })}
    </div>
  );
}

function WeaponSection({ legends, weapons, onPlay }) {
  const [weapon, setWeapon] = useState("Sword");
  const [firstMove, setFirstMove] = useState("all");
  const [start, setStart] = useState("all");
  const [damage, setDamage] = useState(null);
  const [heroId, setHeroId] = useState("");
  const [baseOnly, setBaseOnly] = useState(false);
  const [defense, setDefense] = useState(null);
  const [sort, setSort] = useState("stances");
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (picked || !weapons.length) return;
    const current = weapons.find((item) => item.weapon === weapon);
    if (current?.defenses?.status === "ready") return;
    const first = weapons.find((item) => item.defenses?.status === "ready");
    if (first) setWeapon(first.weapon);
  }, [weapons, picked, weapon]);
  const chooseWeapon = (name) => {
    setPicked(true);
    setWeapon(name);
  };
  const entry = weapons.find((item) => item.weapon === weapon);
  const readiness = weaponReadiness(entry);
  const { data: raw, error } = usePolled(weapons.length ? `${host}/game/combos/weapon/${encodeURIComponent(weapon)}?layout=defenses` : "", 60000);
  const data = useMemo(() => (raw?.status === "ready" ? flattenDefenses(raw, defense) : raw), [raw, defense]);

  useEffect(() => {
    setFirstMove("all");
    setHeroId("");
    setStart("all");
  }, [weapon]);

  const ready = data?.status === "ready";
  const moveLabel = (key) => data?.moves?.find((move) => move.key === key)?.label || key;
  const stanceTotals = useMemo(
    () => new Map(Object.entries(data?.stancesByLegend || {}).map(([id, count]) => [Number(id), Number(count)])),
    [data],
  );
  const combos = useMemo(
    () => (ready ? sortCombos(filterCombos((data.combos || []).map((combo) => ({ ...combo, stanceCount: data.stanceCount })), { firstMove, damage, heroId, baseOnly, start }), sort) : []),
    [data, ready, firstMove, damage, heroId, baseOnly, start, sort],
  );
  const filtered = firstMove !== "all" || damage !== null || heroId || baseOnly || defense !== null || start !== "all";
  const reset = () => {
    setFirstMove("all");
    setDamage(null);
    setHeroId("");
    setBaseOnly(false);
    setDefense(null);
    setStart("all");
  };

  return (
    <section className="flex flex-col gap-4">
      <div className={classes(panel, "p-3 sm:p-4")}>
        <WeaponPicker weapons={weapons.length ? weapons : [{ weapon: "Sword" }]} weapon={weapon} setWeapon={chooseWeapon} />
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />all combos ready</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />ground ready, jump combos still being simulated</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-600" />being rebuilt</span>
        </div>
      </div>
      {error && <Notice tone="rose">{error}</Notice>}
      {data && !ready && (
        <Notice tone="sky">
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
            The {weaponLabel(weapon)} list is being rebuilt after an engine fix. It appears here on its own once its ground combos are done; this page checks again every minute.
          </span>
        </Notice>
      )}
      {ready && (
        <>
          <div className={classes(panel, "flex flex-col gap-3 p-3 sm:p-4")}>
            <FilterRow label="Opponent defense">
              {[null, ...DEFENSES].map((value) => (
                <button
                  key={value ?? "any"}
                  onClick={() => setDefense(value)}
                  title={value === null ? "Combos that work against at least one defense" : `Combos that work against a DEF ${value} opponent`}
                  className={classes(chip(defense === value), "min-w-9")}
                >
                  {value === null ? "Any" : value}
                </button>
              ))}
            </FilterRow>
            {data.air?.status === "ready" && (
              <FilterRow label="Starts from">
                {[["all", "Anywhere"], ["ground", "Ground"], ["air", "A jump"]].map(([key, label]) => (
                  <button key={key} onClick={() => setStart(key)} className={chip(start === key)}>{label}</button>
                ))}
              </FilterRow>
            )}
            <MoveFilter moves={(data.moves || []).filter((move) => (data.combos || []).some((combo) => combo.first === move.key))} firstMove={firstMove} setFirstMove={setFirstMove} />
            <DamageFilter damage={damage} setDamage={setDamage} />
            <FilterRow label="Legend">
              <select value={heroId} onChange={(event) => setHeroId(event.target.value)} className={field}>
                <option value="">Any {weaponLabel(weapon)} user</option>
                {[...(data.legends || [])].sort((left, right) => left.legend.localeCompare(right.legend)).map((legend) => (
                  <option key={legend.heroId} value={legend.heroId}>{legend.legend}</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-200">
                <input type="checkbox" checked={baseOnly} onChange={(event) => setBaseOnly(event.target.checked)} className="h-4 w-4 accent-blue-400" />
                Base stance only
              </label>
            </FilterRow>
          </div>
          {data.air && data.air.status !== "ready" && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-400" />
              Combos that start with a jump are still being simulated for {weaponLabel(weapon)}; ground combos are complete.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-white">{combos.length} true combo{combos.length === 1 ? "" : "s"}</span>
              {filtered && (
                <button onClick={reset} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset filters
                </button>
              )}
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={field}>
              {SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {combos.map((combo) => (
              <ComboCard
                key={`${combo.start || "ground"}-${combo.first}-${combo.second}`}
                combo={combo}
                moveLabel={moveLabel}
                legends={legends}
                stanceTotals={stanceTotals}
                focusHeroId={heroId || null}
                onPlay={(holder) => onPlay({ weaponData: data, combo, holder, moveLabel, targetHeroId: 3, targetDefense: holder.playDefense, targetName: `a DEF ${holder.playDefense} opponent` })}
              />
            ))}
          </div>
          {!combos.length && <Notice>No true combos match these filters.</Notice>}
        </>
      )}
      {readiness.ground && !data && !error && <Notice>Loading the {weaponLabel(weapon)} list…</Notice>}
    </section>
  );
}

function LegendPicker({ legends, selected, onSelect }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return legends.filter((legend) => !needle || legendName(legend).toLowerCase().includes(needle));
  }, [legends, query]);
  return (
    <div className={classes(panel, "flex flex-col gap-3 p-3")}>
      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-blue-400">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a legend"
          className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
        />
      </label>
      <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((legend) => (
          <button
            key={legend.id}
            onClick={() => onSelect(legend)}
            title={legendName(legend)}
            className={classes(
              "flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] font-bold transition",
              String(selected?.id) === String(legend.id)
                ? "border-blue-400 bg-blue-500/15 text-blue-200"
                : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600",
            )}
          >
            <img src={legendImage(legends, legend.id, legendName(legend))} alt="" loading="lazy" className="h-12 w-12 object-contain" />
            <span className="w-full truncate text-center">{legendName(legend)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function weaponStances(data) {
  const byKey = new Map();
  for (const combo of data?.combos || []) {
    for (const holder of combo.holders) byKey.set(`${holder.heroId}|${holder.stance}`, holder);
  }
  return [...byKey.values()];
}

function onlyReason(combo, heroId, stances, weapon, name) {
  const mine = combo.holders.filter((holder) => String(holder.heroId) === String(heroId));
  const others = stances.filter((stance) => String(stance.heroId) !== String(heroId));
  if (!mine.length || !others.length) return "";
  for (const [key, label] of STAT_KEYS) {
    const low = Math.min(...mine.map((holder) => Number(holder[key])));
    const high = Math.max(...mine.map((holder) => Number(holder[key])));
    if (low > Math.max(...others.map((stance) => Number(stance[key])))) return `No other ${weapon} user has ${label} ${low} or more`;
    if (high < Math.min(...others.map((stance) => Number(stance[key])))) return `No other ${weapon} user has ${label} ${high} or less`;
  }
  const lines = [...new Set(mine.map((holder) => stanceStats(holder)))];
  if (lines.length > 2) return `No other ${weapon} user's stance has a stat line that lands it`;
  return `Only ${name}'s ${lines.length === 1 ? "stat line" : "stat lines"} ${lines.join(" / ")} ${lines.length === 1 ? "lands" : "land"} it`;
}

function LegendSection({ legends, weapons: weaponList, onPlay }) {
  const [legend, setLegend] = useState(null);
  const [weaponSlot, setWeaponSlot] = useState(1);
  const [firstMove, setFirstMove] = useState("all");
  const [damage, setDamage] = useState(null);
  useEffect(() => {
    if (!legend && legends.length) setLegend(legends.find((entry) => String(entry.id) === "3") || legends[0]);
  }, [legends, legend]);
  const weapons = legend
    ? [
        { slot: 1, name: legend.weapons?.main?.name },
        { slot: 2, name: legend.weapons?.secondary?.name },
      ].filter((weapon) => weapon.name)
    : [];
  const weaponName = weapons.find((weapon) => weapon.slot === weaponSlot)?.name || "";
  const weaponStatus = weaponList.find((item) => item.weapon === weaponName) || null;
  const readiness = weaponReadiness(weaponStatus);
  const sig = usePolled(legend ? `${host}/game/combos/${legend.id}?weapon=${weaponSlot}` : "");
  const weaponRaw = usePolled(readiness.ground ? `${host}/game/combos/weapon/${encodeURIComponent(weaponName)}?layout=defenses` : "", 60000);
  const weaponData = useMemo(() => (weaponRaw.data?.status === "ready" ? flattenDefenses(weaponRaw.data, LEGEND_TAB_DEFENSE) : weaponRaw.data), [weaponRaw.data]);
  const sigReady = sig.data?.status === "ready";
  const weaponReady = weaponData?.status === "ready";
  const name = legend ? legendName(legend) : "this legend";
  const label = weaponLabel(weaponName);
  const moveLabel = (key) => sig.data?.moves?.find((move) => move.key === key)?.label || weaponData?.moves?.find((move) => move.key === key)?.label || key;
  const sigCombos = useMemo(
    () => (sigReady ? sortCombos(filterCombos((sig.data.combos || []).map((combo) => ({ ...combo, stanceCount: sig.data.stanceCount })), { firstMove, damage, heroId: null, baseOnly: false }), "stances") : []),
    [sig.data, sigReady, firstMove, damage],
  );
  const stances = useMemo(() => (weaponReady ? weaponStances(weaponData) : []), [weaponData, weaponReady]);
  const statCombos = useMemo(() => {
    if (!weaponReady || !legend) return [];
    const only = (weaponData.combos || []).filter((combo) => combo.holders.length && combo.holders.every((holder) => String(holder.heroId) === String(legend.id)));
    return sortCombos(filterCombos(only.map((combo) => ({ ...combo, stanceCount: weaponData.stanceCount })), { firstMove, damage, heroId: legend.id, baseOnly: false }), "stances");
  }, [weaponData, weaponReady, legend, firstMove, damage]);
  const moves = useMemo(() => {
    const seen = new Map();
    for (const source of [sigReady ? sig.data : null, weaponReady ? weaponData : null]) {
      if (!source) continue;
      for (const move of source.moves || []) {
        if (!seen.has(move.key) && (source.combos || []).some((combo) => combo.first === move.key)) seen.set(move.key, move);
      }
    }
    return [...seen.values()];
  }, [sig.data, sigReady, weaponData, weaponReady]);
  const heading = (text, count) => (
    <h2 className="flex items-center gap-2 text-lg font-black text-white">
      {text}
      {count !== null && <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-black text-slate-300">{count}</span>}
    </h2>
  );
  return (
    <section className="flex flex-col gap-4 lg:flex-row">
      <aside className="lg:w-80 lg:shrink-0">
        <LegendPicker legends={legends} selected={legend} onSelect={(next) => { setLegend(next); setFirstMove("all"); }} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className={classes(panel, "flex flex-col gap-3 p-4")}>
          <div className="flex flex-wrap items-center gap-3">
            {legend && <img src={legendImage(legends, legend.id, name)} alt="" className="h-12 w-12 rounded-xl object-contain" />}
            <div className="min-w-0 flex-1">
              <div className={eyebrow}>Legend combos</div>
              <div className="text-2xl font-black text-white">{name}</div>
            </div>
            <div className="flex gap-2">
              {weapons.map((entry) => (
                <button
                  key={entry.slot}
                  onClick={() => { setWeaponSlot(entry.slot); setFirstMove("all"); }}
                  className={classes(chip(weaponSlot === entry.slot), "flex items-center gap-2")}
                >
                  <WeaponIcon name={entry.name} className="h-7 w-7" />
                  {weaponLabel(entry.name)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Combos only {name} can do with {label}: ones that start or end with {name}'s own signatures, and {label} combos that
            no other {label} user lands in any stance, because they only work with {name}'s strength, dexterity or speed (checked against a DEF {LEGEND_TAB_DEFENSE} opponent).
          </p>
          {(sigReady || weaponReady) && (
            <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
              <MoveFilter moves={moves} firstMove={firstMove} setFirstMove={setFirstMove} />
              <DamageFilter damage={damage} setDamage={setDamage} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {heading("Signature combos", sigReady ? sigCombos.length : null)}
          {sig.error && <Notice tone="rose">{sig.error}</Notice>}
          {sig.data && !sigReady && <Progress data={sig.data} label={`Simulating ${name}'s signature combos for each stance…`} />}
          {sigReady && (
            <div className="grid gap-3 xl:grid-cols-2">
              {sigCombos.map((combo) => (
                <ComboCard
                  key={`sig-${combo.first}-${combo.second}`}
                  combo={combo}
                  moveLabel={moveLabel}
                  legends={legends}
                  stanceTotals={new Map()}
                  focusHeroId={sig.data.heroId}
                  onPlay={(holder) => onPlay({ weaponData: sig.data, combo, holder, moveLabel })}
                />
              ))}
            </div>
          )}
          {sigReady && !sigCombos.length && <Notice>No signature combos match these filters.</Notice>}
        </div>
        <div className="flex flex-col gap-3">
          {heading(`Only ${name}'s stats`, weaponReady ? statCombos.length : null)}
          {weaponRaw.error && <Notice tone="rose">{weaponRaw.error}</Notice>}
          {weaponName && !readiness.ground && (
            <Notice tone="sky">
              These come from the full {label} list, which is being rebuilt after an engine fix. They show up here once its ground combos are done.
            </Notice>
          )}
          {readiness.ground && !weaponReady && !weaponRaw.error && <Notice>Loading the {label} list…</Notice>}
          {weaponReady && weaponRaw.data?.air?.status !== "ready" && (
            <div className="text-xs font-bold text-slate-400">Jump combos for {label} are still being simulated; only ground combos are compared so far.</div>
          )}
          {weaponReady && (
            <div className="grid gap-3 xl:grid-cols-2">
              {statCombos.map((combo) => (
                <ComboCard
                  key={`stat-${combo.start || "ground"}-${combo.first}-${combo.second}`}
                  combo={combo}
                  moveLabel={moveLabel}
                  legends={legends}
                  stanceTotals={new Map()}
                  focusHeroId={legend.id}
                  note={onlyReason(combo, legend.id, stances, label, name)}
                  onPlay={(holder) => onPlay({ weaponData, combo, holder, moveLabel, targetHeroId: 3, targetDefense: holder.playDefense, targetName: `a DEF ${holder.playDefense} opponent` })}
                />
              ))}
            </div>
          )}
          {weaponReady && !statCombos.length && <Notice>Every {label} combo {name} can do is also true for another {label} user{firstMove !== "all" || damage !== null ? " at these filters" : ""}.</Notice>}
        </div>
      </div>
    </section>
  );
}

function svgWithViewBox(svg, box) {
  if (!svg || !box) return svg || "";
  return svg.replace(/\bviewBox="[^"]+"/i, `viewBox="${box.x} ${box.y} ${box.width} ${box.height}"`);
}

function parseViewBox(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  const [x, y, width, height] = String(value).split(/[\s,]+/).map(Number);
  return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null;
}

function ComboPlayer({ play, onClose }) {
  const { weaponData, combo, holder, moveLabel, targetHeroId, targetDefense, targetName } = play;
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const playRanges = holder.playRanges || holder.ranges || [];
  const damageStart = playRanges[0]?.from ?? 0;
  const [damage, setDamage] = useState(damageStart);
  const heroId = holder.heroId;
  const weaponSlot = Number.isFinite(Number(holder.weaponSlot)) ? Number(holder.weaponSlot) : Number(weaponData.weaponSlot ?? 1);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === " " && event.target === document.body) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });
    setTick(0);
    getJson(`${host}/game/combos/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId,
          weapon: weaponSlot,
          first: combo.first,
          second: combo.second,
          damage,
          levels: { strength: holder.strength, dexterity: holder.dexterity, speed: holder.speed },
          ...(Number.isFinite(Number(holder.airStart)) && holder.airStart !== null && holder.airStart !== undefined ? { airStart: holder.airStart } : {}),
          ...(holder.distance !== null && holder.distance !== undefined ? { distance: holder.distance } : {}),
          ...(holder.heldDirection ? { heldDirection: holder.heldDirection } : {}),
          ...(holder.airDrift === 0 || holder.airDrift === 2 ? { airDrift: holder.airDrift } : {}),
          ...(typeof holder.jumpTick === "number" ? { approach: "jump", jumpTick: holder.jumpTick } : {}),
          ...(holder.transition ? { transitions: [holder.transition] } : {}),
          ...(targetHeroId && targetHeroId !== 3 ? { targetHeroId } : {}),
          ...(targetDefense ? { targetDefense } : {}),
        }),
      })
      .then((data) => !cancelled && setState({ loading: false, error: "", data }))
      .catch((reason) => !cancelled && setState({ loading: false, error: String(reason?.message || reason), data: null }));
    return () => {
      cancelled = true;
    };
  }, [heroId, targetHeroId, targetDefense, combo.first, combo.second, damage, holder.strength, holder.dexterity, holder.speed, holder.transition, holder.airStart, holder.airDrift, holder.jumpTick, holder.distance, holder.heldDirection]);

  const timeline = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const startTick = Number(data.verdict?.startTick ?? 0);
    const firstFrames = (data.firstPart?.frames || []).filter((frame) => frame.svg);
    const secondFrames = (data.secondPart?.frames || []).filter((frame) => frame.svg);
    if (!firstFrames.length || !secondFrames.length) return null;
    const pick = (frames, value) => {
      let chosen = frames[0];
      for (const frame of frames) {
        if (Number(frame.tick ?? 0) <= value) chosen = frame;
        else break;
      }
      return chosen;
    };
    const lastSecond = Number(secondFrames[secondFrames.length - 1].tick ?? 0);
    const total = startTick + lastSecond + 1;
    const frames = [];
    for (let value = 0; value < total; value += 1) {
      frames.push(value < startTick ? pick(firstFrames, value) : pick(secondFrames, value - startTick));
    }
    const points = frames.flatMap((frame) => [frame.actor, frame.target]).filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
    let box;
    if (points.length) {
      const left = Math.min(...points.map((point) => point.x)) - 220;
      const right = Math.max(...points.map((point) => point.x)) + 220;
      const top = Math.min(...points.map((point) => point.y)) - 380;
      const bottom = Math.max(...points.map((point) => point.y)) + 120;
      let width = right - left;
      let height = bottom - top;
      if (width / height > 16 / 9) height = (width * 9) / 16;
      else width = (height * 16) / 9;
      box = { x: (left + right) / 2 - width / 2, y: (top + bottom) / 2 - height / 2, width, height };
    } else {
      const boxes = [...firstFrames, ...secondFrames].map((frame) => parseViewBox(frame.viewBox)).filter(Boolean);
      const left = Math.min(...boxes.map((entry) => entry.x));
      const top = Math.min(...boxes.map((entry) => entry.y));
      box = { x: left, y: top, width: Math.max(...boxes.map((entry) => entry.x + entry.width)) - left, height: Math.max(...boxes.map((entry) => entry.y + entry.height)) - top };
    }
    const firstHitTicks = (data.firstPart?.targetHits || []).map((hit) => Number(hit.tick));
    const secondHitTick = Number(data.verdict?.secondHitTick);
    return {
      frames,
      box,
      startTick,
      endTick: Number(data.firstEndTick ?? 0),
      firstHitTicks,
      secondHitTick: Number.isFinite(secondHitTick) ? secondHitTick : null,
      freeTick: Number(data.verdict?.freeTick ?? 0),
    };
  }, [state.data]);

  useEffect(() => {
    if (!playing || !timeline) return undefined;
    const timer = setInterval(() => {
      setTick((value) => (value + 1 >= timeline.frames.length ? 0 : value + 1));
    }, TICK_MS / speed);
    return () => clearInterval(timer);
  }, [playing, timeline, speed]);

  const frame = timeline?.frames[Math.min(tick, (timeline?.frames.length || 1) - 1)];
  const svg = useMemo(() => svgWithViewBox(frame?.svg, timeline?.box), [frame, timeline?.box]);
  const verdict = state.data?.verdict;
  const phase = !timeline
    ? ""
    : tick < timeline.endTick
      ? moveLabel(combo.first)
      : tick < timeline.startTick
        ? transitionLabel(verdict?.transition || "link", verdict?.hold, verdict?.instant, verdict?.direction, verdict?.airJump ?? holder.airJump, verdict?.reverse ?? holder.reverse)
        : moveLabel(combo.second);
  const stunned = timeline && tick < timeline.freeTick;
  const markers = timeline ? [
    ...timeline.firstHitTicks.map((value) => [value, "bg-amber-400", "First hit"]),
    [timeline.endTick, "bg-slate-300", "First move ends"],
    [timeline.startTick, "bg-sky-400", "Second move starts"],
    [timeline.secondHitTick, "bg-emerald-400", "Second hit"],
    [timeline.freeTick, "bg-rose-400", "Target can act"],
  ].filter(([value]) => Number.isFinite(value)) : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={classes(panel, "flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto p-4")} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <ComboSteps
              start={combo.start}
              airDrift={holder.airDrift}
              jumpTick={holder.jumpTick}
              first={combo.first}
              heldDirection={verdict?.heldDirection ?? holder.heldDirection}
              transition={verdict?.transition || holder.transition}
              hold={verdict?.hold ?? holder.hold}
              instant={verdict?.instant ?? holder.instant}
              direction={verdict?.direction ?? holder.direction}
              airJump={verdict?.airJump ?? holder.airJump}
              reverse={verdict?.reverse ?? holder.reverse}
              second={combo.second}
              moveLabel={moveLabel}
            />
            <span className="text-xs font-bold text-slate-400">
              {holder.legend} · {holder.stance} stance · {stanceStats(holder)}{targetName ? ` · vs ${targetName}` : ""}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {state.data?.defs && (
            <svg width="0" height="0" aria-hidden="true" className="absolute">
              <defs dangerouslySetInnerHTML={{ __html: state.data.defs }} />
            </svg>
          )}
          {state.loading && (
            <div className="absolute inset-0 grid place-items-center text-sm font-bold text-slate-400">
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin text-blue-400" />
                Rendering the combo…
              </span>
            </div>
          )}
          {state.error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-bold text-rose-200">{state.error}</div>}
          {svg && (
            <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
          {timeline && (
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-lg bg-slate-900/85 px-2 py-1 text-white">{phase}</span>
              <span className={classes("rounded-lg px-2 py-1", stunned ? "bg-rose-500/85 text-white" : "bg-emerald-500/85 text-slate-950")}>
                {stunned ? "target stunned" : "target free"}
              </span>
            </div>
          )}
        </div>
        {timeline && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <input
                type="range"
                min={0}
                max={timeline.frames.length - 1}
                value={tick}
                onChange={(event) => { setPlaying(false); setTick(Number(event.target.value)); }}
                className="w-full accent-blue-400"
                aria-label="Frame"
              />
              <div className="relative h-2 rounded-full bg-slate-800">
                {markers.map(([value, color, label]) => (
                  <div
                    key={`${label}-${value}`}
                    title={`${label} (frame ${value})`}
                    className={classes("absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-sm", color)}
                    style={{ left: `${(value / Math.max(1, timeline.frames.length - 1)) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
              <button onClick={() => setPlaying((value) => !value)} className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 font-black text-white hover:bg-blue-400">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={() => { setTick(0); setPlaying(true); }} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700">
                <SkipBack className="h-3.5 w-3.5" />
                Restart
              </button>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5" aria-label="Speed">
                {[1, 0.5, 0.25, 0.1].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select>
              <span className="rounded-lg bg-slate-800 px-2 py-1.5 tabular-nums">Frame {tick}</span>
              <label className="flex items-center gap-2">
                Damage
                <select value={damage} onChange={(event) => setDamage(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5">
                  {(weaponData.damageSteps || []).filter((value) => playRanges.some((range) => value >= range.from && value <= range.to)).map((value) => (
                    <option key={value} value={value}>{value}%</option>
                  ))}
                </select>
              </label>
              {Number.isFinite(verdict?.gap) && (
                <span className="rounded-lg bg-emerald-500/15 px-2 py-1.5 text-emerald-200">
                  Hits {verdict.gap} frame{verdict.gap === 1 ? "" : "s"} before the target can act
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
              {[["bg-amber-400", "first hit"], ["bg-slate-300", "first move ends"], ["bg-sky-400", "second move starts"], ["bg-emerald-400", "second hit"], ["bg-rose-400", "target can act"]].map(([color, text]) => (
                <span key={text} className="flex items-center gap-1"><span className={classes("inline-block h-2 w-2 rounded-full", color)} />{text}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComboPage() {
  const legends = useLegends();
  const weapons = useWeaponStatus();
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get("tab") === "legend" ? "legend" : "weapon"));
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "legend") url.searchParams.set("tab", "legend");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }, [tab]);
  const [play, setPlay] = useState(null);
  const groundReady = weapons.filter((entry) => entry.defenses?.status === "ready").length;
  const airReady = weapons.filter((entry) => entry.defenses?.airStatus === "ready").length;
  return (
    <div className="min-h-screen bg-slate-950 p-3 text-white sm:p-4">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-4">
        <section className={classes(panel, "overflow-hidden")}>
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className={eyebrow}>Combo Database</div>
              <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight sm:text-4xl">
                <Swords className="h-8 w-8 text-blue-300" />
                True Combos
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Two-hit combos the opponent can't escape, checked frame by frame with the game's own rules.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-96">
              <SummaryTile label="Weapons" value={weapons.length || "–"} />
              <SummaryTile label="Ground lists" value={weapons.length ? `${groundReady}/${weapons.length}` : "–"} />
              <SummaryTile label="Jump lists" value={weapons.length ? `${airReady}/${weapons.length}` : "–"} />
            </div>
          </div>
          <details className="group border-t border-slate-800 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent px-4 py-3">
            <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-black text-slate-300 hover:text-blue-300">
              <Info className="h-4 w-4 text-blue-300" />
              How combos are checked
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 text-sm text-slate-400 md:grid-cols-3">
              <p>Every combo is simulated tick by tick with the game's hit, knockback, stun, jump and dash rules: the second attack has to land before the opponent can act again.</p>
              <p>The opponent stands on Small Brawlhaven and doesn't steer while stunned. Weapon combos are checked against every opponent defense from 1 to 11 and every damage from 0 to 200%.</p>
              <p>Each legend stance has its own strength, dexterity and speed: dexterity changes how soon an attack ends, and a higher defense takes less damage and slows down faster after a hit.</p>
            </div>
          </details>
        </section>
        <div className="flex w-fit gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1">
          {[
            ["weapon", "Weapon combos"],
            ["legend", "Legend combos"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={classes(
                "rounded-xl px-4 py-2 text-sm font-black transition",
                tab === key ? "bg-blue-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "weapon"
          ? <WeaponSection legends={legends} weapons={weapons} onPlay={setPlay} />
          : <LegendSection legends={legends} weapons={weapons} onPlay={setPlay} />}
      </div>
      {play && <ComboPlayer play={play} onClose={() => setPlay(null)} />}
    </div>
  );
}
