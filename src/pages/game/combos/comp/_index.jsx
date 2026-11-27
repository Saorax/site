import "../../../../styles/global.css";
import "../../../../../fonts/style.css";
import { host } from "../../../../stuff";
import { ArrowRight, ChevronDown, Hand, Info, Pause, Play, RotateCcw, SkipBack, Swords, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CountPill, CountPills, EmptyState, ErrorState, LegendFace, LoadingState, PageHeader, PageShell, Pill, SearchInput, Section, SelectInput, Spinner, Tabs, Toggle, pillTones, useQueryFlag, useQueryState } from "../../../../components/ui";

const MAX_DAMAGE = 200;
const TICK_MS = 16;
const TRANSITIONS = {
  link: "then",
  jump: "jump",
  dash: "dash (dodge down-forward)",
  dashjump: "dash jump (dodge down-forward, then jump)",
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

const smallButton = "inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700";

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

function backThrowRanges(holder) {
  return holder?.throwHeldRanges || (holder?.throwHeld === "back" ? holder.ranges || [] : []);
}

function mixedThrow(holder) {
  const back = backThrowRanges(holder);
  return back.length > 0 && rangeText(back) !== rangeText(holder.ranges || []);
}

function mergeCharges(lists) {
  const byCharge = new Map();
  for (const entry of lists.flat()) {
    if (!entry?.charge) continue;
    byCharge.set(entry.charge, [...(byCharge.get(entry.charge) || []), entry.ranges || []]);
  }
  return [...byCharge.entries()].sort((left, right) => left[0] - right[0]).map(([charge, ranges]) => ({ charge, ranges: mergeRanges(ranges) }));
}

function chargeText(charges) {
  return charges.map((entry) => `charge the throw ${entry.charge} tick${entry.charge === 1 ? "" : "s"} at ${rangeText(entry.ranges)}`).join(", ");
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
      const { defenses: bestDefenses, throwHeldRanges: _bestBack, throwCharges: _bestCharges, ...fields } = best;
      const backRanges = mergeRanges(matching.map(backThrowRanges));
      const charges = mergeCharges(matching.map((verdict) => verdict.throwCharges || []));
      return {
        ...stance,
        ...fields,
        ranges: mergeRanges(matching.map((verdict) => verdict.ranges || [])),
        ...(backRanges.length ? { throwHeldRanges: backRanges } : {}),
        ...(charges.length ? { throwCharges: charges } : {}),
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
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    getJson(`${host}/game/legends/summary`)
      .then((list) => !cancelled && setLegends(
        list
          .filter((legend) => !legend.beta?.isBeta && !String(legend.id).startsWith("beta-"))
          .sort((left, right) => (left.releaseOrder ?? 9999) - (right.releaseOrder ?? 9999) || Number(left.release || 0) - Number(right.release || 0) || legendName(left).localeCompare(legendName(right))),
      ))
      .catch((reason) => {
        if (cancelled) return;
        setLegends([]);
        setError(String(reason?.message || reason));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { legends, error, retry };
}

function useWeaponStatus() {
  const [weapons, setWeapons] = useState([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setError("");
    getJson(`${host}/game/combos/weapons`, { cache: "no-store" })
      .then((list) => {
        if (cancelled) return;
        setWeapons(list);
        setLoaded(true);
      })
      .catch((reason) => !cancelled && setError(String(reason?.message || reason)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { weapons, loaded, error, retry };
}

function usePolled(url, interval = 4000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
          if (payload.status === "computing" || payload.air?.status === "computing") timer = setTimeout(load, interval);
        })
        .catch((reason) => !cancelled && setError(String(reason?.message || reason)));
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, interval, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, retry };
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

function Notice({ children }) {
  return <div className={classes("max-w-5xl rounded-xl border p-2 text-sm", pillTones.sky)}>{children}</div>;
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
  if (transition === "dashjump" && Number(hold) > 0) return `dash (dodge down-forward), wait ${hold}, jump`;
  if (transition === "jump" && instant) return "jump + attack together";
  if (transition === "gc") return `${airJump ? "jump, " : ""}${Number(hold) > 0 ? `gravity cancel, dodge after ${hold} frames` : "gravity cancel"}${direction === "forwardDown" ? " (dodge down-forward)" : direction === "down" ? " (dodge down)" : ""}`;
  return TRANSITIONS[transition] || transition;
}

function transitionLabel(transition, hold, instant, direction, airJump, reverse, dodgeWait) {
  const base = baseTransitionLabel(transition, hold, instant, direction, airJump);
  const label = Number(dodgeWait) > 0 ? `wait ${dodgeWait} frames, ${base}` : base;
  return reverse === "tap" ? `${label}, tap back on the last frame of the move to turn around` : reverse ? `${label}, turn around` : label;
}

function comboStepList({ start, mode, first, heldDirection, transition, hold, instant, direction, airJump, reverse, dodgeWait, second, throwHeld, chain, links }) {
  const tail = Array.isArray(chain) && chain.length
    ? chain.flatMap((key, index) => {
      const link = links?.[index] || (index === 0 ? { transition, hold, instant, direction, airJump, reverse, dodgeWait } : {});
      return [
        ...(link.transition && link.transition !== "link" && link.transition !== "throw" ? [{ kind: "transition", key: link.transition, link }] : link.reverse ? [{ kind: "transition", key: "link", link }] : []),
        { kind: "move", key },
      ];
    })
    : [
      ...(transition && transition !== "link" && transition !== "throw" ? [{ kind: "transition", key: transition }] : reverse ? [{ kind: "transition", key: "link" }] : []),
      { kind: "move", key: second, held: throwHeld },
    ];
  return [
    ...(start === "air" ? [{ kind: "transition", key: "jump", lead: true }] : []),
    { kind: "move", key: first, held: heldDirection, split: mode === "split" },
    ...tail,
  ];
}

function transitionStepText(step, { airDrift, hold, instant, direction, airJump, reverse, dodgeWait }) {
  if (step.lead) return airDrift === 0 ? "jump straight up" : airDrift === 2 ? "jump forward, then let go" : "jump";
  if (step.link) return transitionLabel(step.key, step.link.hold, step.link.instant, step.link.direction, step.link.airJump, step.link.backTap ? "tap" : step.link.reverse, step.link.dodgeWait);
  return transitionLabel(step.key, hold, instant, direction, airJump, reverse, dodgeWait);
}

function ComboSteps(props) {
  const { jumpTick, approach, momentum, moveLabel } = props;
  const steps = comboStepList(props);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <span key={`${step.key}-${index}-${step.lead ? "lead" : ""}`} className="flex items-center gap-1.5">
          {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-500" />}
          {step.kind === "transition" ? (
            <Pill tone="sky" className="whitespace-normal py-1">
              {transitionStepText(step, props)}
            </Pill>
          ) : (
            <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm font-bold text-white">
              {step.split ? <span title="Chakram split mode: the chakram was split by an earlier down light, so every move uses its split version until a down light joins it again" className="font-bold text-amber-300">split </span> : null}{moveLabel(step.key)}{step.held ? <span className="font-bold text-slate-400"> · hold {step.held}</span> : null}
            </span>
          )}
        </span>
      ))}
      {typeof jumpTick === "number" && (
        <Pill tone="amber" className="py-1" title="The first move misses a standing opponent at every spacing, so this was checked against an opponent who jumps into it">
          vs a jumping opponent
        </Pill>
      )}
      {approach === "run" && (
        <Pill tone="amber" className="py-1" title="Not true against a standing opponent: this was checked against an opponent who runs into the first move">
          vs a running opponent
        </Pill>
      )}
      {(momentum === "run" || momentum === "dash") && (
        <Pill tone="amber" className="py-1" title={momentum === "dash" ? "Dash into the first move and press it on the dash's first frame: the dash's speed carries into the attack and makes this combo true at more damage values than from standing" : "Run into the first move: the running speed carries into the attack and makes this combo true at more damage values than from standing"}>
          {momentum === "dash" ? "dash into it" : "run into it"}
        </Pill>
      )}
    </div>
  );
}

function driftText(entry) {
  if (!entry) return "";
  if (Number.isFinite(Number(entry.driftSwitch)) && entry.driftSwitch !== null) {
    const first = entry.drift === "away" ? "hold away" : entry.drift === "toward" ? "hold toward" : "hold nothing";
    const then = entry.driftAfter === "toward" ? "hold toward" : entry.driftAfter === "away" ? "hold away" : "let go";
    return `${first} for the first ${entry.driftSwitch} frames of the jump, then ${then}`;
  }
  return entry.drift === "toward" ? "hold toward" : "";
}

function stanceName(stance) {
  return String(stance ?? "").replace(/\bWeight\b/, "Defense");
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
  return `${stanceStats(holder)}${holder.defenses ? ` · opponent DEF ${defenseText(holder.defenses)}` : ""} · true at ${rangeText(holder.ranges)}${mixedThrow(holder) ? ` · hold back while throwing at ${rangeText(backThrowRanges(holder))}` : ""}${holder.throwCharges?.length ? ` · ${chargeText(holder.throwCharges)}` : ""}`;
}

function StanceButton({ holder, onPlay }) {
  if (!onPlay) {
    return (
      <span title={holderTitle(holder)} className={classes("rounded-md px-1.5 py-0.5 text-[11px] font-bold", holder.stance === "Base" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300")}>
        {stanceName(holder.stance)}
      </span>
    );
  }
  return (
    <button
      onClick={() => onPlay(holder)}
      title={holderTitle(holder)}
      className={classes(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold transition",
        holder.stance === "Base" ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
      )}
    >
      {stanceName(holder.stance)}
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
              {all && !onPlay ? (
                <Pill tone="emerald" className="text-[11px]">every stance</Pill>
              ) : all ? (
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
    <div className={classes("rounded-lg border px-2 py-1 text-center", accent ? pillTones.blue : pillTones.slate)}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xs font-bold text-white">{value}</div>
    </div>
  );
}

function LeewayBadge({ leeway }) {
  if (!Number.isFinite(leeway) || leeway < 0) return null;
  const tone = leeway >= 3 ? "emerald" : leeway >= 1 ? "sky" : "amber";
  return (
    <Pill tone={tone} className="py-1" title="How many frames later the second attack could still land before the opponent can act">
      {leeway === 0 ? "frame perfect" : `${leeway} frame${leeway === 1 ? "" : "s"} to spare`}
    </Pill>
  );
}

function comboKey(combo) {
  return `${combo.start || "ground"}-${combo.mode || "joined"}-${combo.first}-${(combo.chain || [combo.second]).join("-")}${combo.opponent ? `-vs-${combo.opponent}` : ""}${combo.attacker ? `-${combo.attacker}` : ""}`;
}

function comboSummary(combo, focusHeroId) {
  const holders = focusHeroId ? combo.holders.filter((holder) => String(holder.heroId) === String(focusHeroId)) : combo.holders;
  const ranges = mergeRanges(holders.map((holder) => holder.ranges));
  const leeway = Math.max(...holders.map((holder) => Number(holder.leeway ?? -99)));
  const best = [...holders].sort((left, right) => Number(right.leeway ?? -99) - Number(left.leeway ?? -99))[0];
  const groups = groupHolders(holders);
  const everyone = holders.length >= combo.stanceCount;
  const defenseSpan = holders.some((holder) => holder.defenses)
    ? valueRanges(holders.flatMap((holder) => DEFENSES.filter((defense) => inDefenses(holder.defenses, defense))))
    : null;
  const backRanges = mergeRanges(holders.map(backThrowRanges));
  const throwMix = backRanges.length > 0 && holders.some((holder) => mixedThrow(holder) || !backThrowRanges(holder).length);
  const charges = mergeCharges(holders.map((holder) => holder.throwCharges || []));
  const details = [
    throwMix ? `hold back while throwing for some stances (${rangeText(backRanges)})` : "",
    charges.length ? `${chargeText(charges)}${charges.length === 1 && rangeText(charges[0].ranges) === rangeText(ranges) ? "" : " (some stances)"}` : "",
  ].filter(Boolean);
  const steps = { start: combo.start, mode: combo.mode, airDrift: best?.airDrift, jumpTick: best?.jumpTick, approach: best?.approach, momentum: best?.momentum, first: combo.first, heldDirection: best?.heldDirection, transition: best?.transition, hold: best?.hold, instant: best?.instant, direction: best?.direction, airJump: best?.airJump, reverse: best?.backTap ? "tap" : best?.reverse, dodgeWait: best?.dodgeWait, second: combo.second, throwHeld: throwMix ? undefined : backRanges.length ? "back" : best?.throwHeld, chain: combo.chain, links: best?.steps };
  return { holders, ranges, leeway, best, groups, everyone, defenseSpan, details, steps };
}

function ComboCard({ combo, moveLabel, legends, stanceTotals, onPlay, focusHeroId, note, highlighted = false }) {
  const [open, setOpen] = useState(highlighted);
  const ref = useRef(null);
  const { holders, ranges, leeway, best, groups, everyone, defenseSpan, details, steps } = comboSummary(combo, focusHeroId);
  useEffect(() => {
    if (!highlighted) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  return (
    <div ref={ref}>
    <Card as="article" className={classes("flex h-full flex-col gap-3 p-3 transition hover:border-slate-500", highlighted && "ring-2 ring-blue-400")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{combo.start === "air" ? "From a jump" : "From the ground"}</span>
          <ComboSteps {...steps} moveLabel={moveLabel} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => onPlay(best)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-400"
          >
            <Play className="h-3.5 w-3.5" />
            Watch
          </button>
        </div>
      </div>
      {note && <div className={classes("rounded-lg border px-2.5 py-1.5 text-xs font-bold", pillTones.amber)}>{note}</div>}
      <div className="grid grid-cols-4 gap-1.5">
        <StatPill label="Opp. DEF" value={defenseSpan ? defenseText(defenseSpan) : "5"} accent />
        {STAT_KEYS.map(([key, label]) => <StatPill key={key} label={label} value={statRange(holders, key) ?? "–"} />)}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="font-bold text-slate-400">True at <span className="text-emerald-300">{rangeText(ranges)}</span></span>
          <LeewayBadge leeway={leeway} />
        </div>
        <DamageBar ranges={ranges} />
        {!!details.length && <span className="text-[11px] font-bold text-slate-500">{details.join(" · ")}</span>}
      </div>
      {!focusHeroId && (
        <div className="border-t border-slate-800 pt-3">
          {everyone ? (
            <Pill tone="emerald">Every legend and stance</Pill>
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
    </Card>
    </div>
  );
}

function Progress({ data, label }) {
  return (
    <Card role="status" className="flex max-w-3xl flex-col gap-2 text-sm text-slate-300">
      <span className="flex items-center gap-2">
        <Spinner />
        {label}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-blue-400 transition-all" style={{ width: `${data?.total ? (data.done / data.total) * 100 : 0}%` }} />
      </div>
      <span className="text-xs text-slate-500">
        {data?.total ? `${data.done} of ${data.total} checks` : "Waiting for earlier jobs to finish"}
      </span>
    </Card>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-sm text-slate-300 sm:w-36 sm:shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function MoveFilter({ moves, firstMove, setFirstMove }) {
  return (
    <FilterRow label="Starts with">
      <Tabs
        variant="small"
        label="Starts with"
        value={firstMove}
        onChange={setFirstMove}
        items={[{ key: "all", label: "Any move" }, ...(moves || []).filter((move) => !move.followOnly)].map((move) => ({ value: move.key, label: move.label }))}
      />
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
      <span className="w-12 text-sm font-bold text-white">{damage === null ? "Any" : `${damage}%`}</span>
      {damage !== null && (
        <button type="button" onClick={() => setDamage(null)} className={smallButton}>
          Any
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
  return { ground, air };
}

const READINESS_DOTS = [
  ["bg-emerald-400", "ground and jump"],
  ["bg-sky-400", "ground only"],
  ["bg-slate-600", "not published yet"],
];

function readinessDot(ready) {
  return READINESS_DOTS[ready.ground && ready.air ? 0 : ready.ground ? 1 : 2];
}

function WeaponPicker({ weapons, weapon, setWeapon }) {
  const allReady = weapons.every((entry) => {
    const ready = weaponReadiness(entry);
    return ready.ground && ready.air;
  });
  return (
    <>
    <Tabs
      variant="chips"
      label="Weapon"
      value={weapon}
      onChange={setWeapon}
      className="sm:flex-wrap sm:overflow-visible sm:pb-0"
      items={weapons.map((entry) => {
        const [dot, text] = readinessDot(weaponReadiness(entry));
        return {
          value: entry.weapon,
          title: allReady ? weaponLabel(entry.weapon) : `${weaponLabel(entry.weapon)}: ${text}`,
          icon: <WeaponIcon name={entry.weapon} className="h-7 w-7" />,
          label: (
            <span className="flex items-center gap-2 whitespace-nowrap">
              {weaponLabel(entry.weapon)}
              {!allReady && <span className={classes("h-2 w-2 rounded-full", dot)} />}
            </span>
          ),
        };
      })}
    />
    {!allReady && (
      <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
        {READINESS_DOTS.map(([dot, text]) => (
          <span key={text} className="flex items-center gap-1.5"><span className={classes("h-2 w-2 rounded-full", dot)} />{text}</span>
        ))}
      </div>
    )}
    </>
  );
}

function weaponSlug(name) {
  return weaponLabel(name).replace(/\s+/g, "");
}

function weaponFromParam(value, weapons) {
  const wanted = String(value || "").toLowerCase();
  if (!wanted) return "";
  const names = [...new Set([...weapons.map((entry) => entry.weapon), ...Object.keys(WEAPON_LABELS)])];
  return names.find((name) => name.toLowerCase() === wanted || weaponSlug(name).toLowerCase() === wanted) || value;
}

function numberParam(value) {
  return value === "" || value === null || !Number.isFinite(Number(value)) ? null : Number(value);
}

function useClearOnLeave(keys) {
  useEffect(() => () => {
    const url = new URL(window.location.href);
    keys.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(null, "", url);
  }, []);
}

function useNumberParam(key) {
  const [raw, setRaw] = useQueryState(key, "");
  const set = useCallback((value) => setRaw(value === null || value === undefined ? "" : String(value)), [setRaw]);
  return [numberParam(raw), set];
}

function WeaponSection({ legends, weapons, onPlay }) {
  useClearOnLeave(["weapon", "first", "start", "dmg", "hero", "base", "def", "sort", "open"]);
  const [weaponParam, setWeaponParam] = useQueryState("weapon", "Sword");
  const weapon = weaponFromParam(weaponParam, weapons) || "Sword";
  const setWeapon = (name) => setWeaponParam(weaponSlug(name));
  const [firstMove, setFirstMove] = useQueryState("first", "all");
  const [start, setStart] = useQueryState("start", "all");
  const [damage, setDamage] = useNumberParam("dmg");
  const [heroId, setHeroId] = useQueryState("hero", "");
  const [baseOnly, setBaseOnly] = useQueryFlag("base");
  const [defense, setDefense] = useNumberParam("def");
  const [sortParam, setSort] = useQueryState("sort", "stances");
  const sort = SORTS.some((option) => option.key === sortParam) ? sortParam : "stances";
  const [openKey, setOpenKey] = useQueryState("open", "");
  const [picked, setPicked] = useState(() => new URLSearchParams(window.location.search).has("weapon"));
  useEffect(() => {
    if (picked || !weapons.length) return;
    const current = weapons.find((item) => item.weapon === weapon);
    if (current?.defenses?.status === "ready") return;
    const first = weapons.find((item) => item.defenses?.status === "ready");
    if (first) setWeapon(first.weapon);
  }, [weapons, picked, weapon]);
  const chooseWeapon = (name) => {
    setPicked(true);
    if (name === weapon) return;
    setWeapon(name);
    setFirstMove("all");
    setHeroId("");
    setStart("all");
    setOpenKey("");
  };
  const entry = weapons.find((item) => item.weapon === weapon);
  const readiness = weaponReadiness(entry);
  const { data: raw, error, retry } = usePolled(readiness.ground ? `${host}/game/combos/weapon/${encodeURIComponent(weapon)}?layout=defenses` : "");
  const data = useMemo(() => (raw?.status === "ready" ? flattenDefenses(raw, defense) : raw), [raw, defense]);

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
    <div className="flex flex-col gap-3">
      <Section padded={false} bodyClassName="space-y-3 p-3">
        <WeaponPicker weapons={weapons.length ? weapons : [{ weapon: "Sword" }]} weapon={weapon} setWeapon={chooseWeapon} />
      </Section>
      {error && <ErrorState message={`Couldn't load the ${weaponLabel(weapon)} list.`} detail={error} onRetry={retry} />}
      {entry && (!readiness.ground || (data && !ready)) && (
        <Notice>The {weaponLabel(weapon)} list isn't published yet.</Notice>
      )}
      {ready && (
        <>
          <Section title="Filters" headingAs="h2" collapsible defaultOpen className="max-w-5xl" bodyClassName="space-y-3" actions={filtered ? (
            <button type="button" onClick={reset} className={smallButton}>
              <RotateCcw className="h-3.5 w-3.5" />
              Clear filters
            </button>
          ) : null}>
            <FilterRow label="Opponent defense">
              <Tabs
                variant="small"
                label="Opponent defense"
                value={defense === null ? "any" : defense}
                onChange={(value) => setDefense(value === "any" ? null : Number(value))}
                items={["any", ...DEFENSES].map((value) => ({
                  value,
                  label: value === "any" ? "Any" : value,
                  title: value === "any" ? "Combos that work against at least one defense" : `Combos that work against a DEF ${value} opponent`,
                }))}
              />
            </FilterRow>
            {data.air?.status === "ready" && (
              <FilterRow label="Starts from">
                <Tabs
                  variant="small"
                  label="Starts from"
                  value={start}
                  onChange={setStart}
                  items={[["all", "Anywhere"], ["ground", "Ground"], ["air", "A jump"]].map(([value, label]) => ({ value, label }))}
                />
              </FilterRow>
            )}
            <MoveFilter moves={(data.moves || []).filter((move) => (data.combos || []).some((combo) => combo.first === move.key))} firstMove={firstMove} setFirstMove={setFirstMove} />
            <DamageFilter damage={damage} setDamage={setDamage} />
            <FilterRow label="Legend">
              <SelectInput
                label="Legend"
                className="[&>span]:sr-only"
                value={heroId}
                onChange={setHeroId}
                options={[
                  { value: "", label: `Any ${weaponLabel(weapon)} user` },
                  ...[...(data.legends || [])].sort((left, right) => left.legend.localeCompare(right.legend)).map((legend) => ({ value: String(legend.heroId), label: legend.legend })),
                ]}
              />
              <Toggle label="Base stance only" checked={baseOnly} onChange={setBaseOnly} />
            </FilterRow>
          </Section>
          {data.air && data.air.status !== "ready" && (
            <Notice>{weaponLabel(weapon)} combos from a jump aren't published yet. Ground combos are all here.</Notice>
          )}
          <Section
            title={`${combos.length} true combo${combos.length === 1 ? "" : "s"}`}
            headingAs="h2"
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <SelectInput label="Sort" value={sort} onChange={setSort} options={SORTS.map((option) => ({ value: option.key, label: option.label }))} />
              </div>
            )}
          >
          {!!combos.length && (
          <div className="grid gap-3 xl:grid-cols-2 min-[112.5rem]:grid-cols-3 min-[137.5rem]:grid-cols-4">
            {combos.map((combo) => (
              <ComboCard
                key={comboKey(combo)}
                combo={combo}
                moveLabel={moveLabel}
                legends={legends}
                stanceTotals={stanceTotals}
                focusHeroId={heroId || null}
                highlighted={openKey === comboKey(combo)}
                onPlay={(holder) => onPlay({ weaponData: data, combo, holder, moveLabel, targetHeroId: 3, targetDefense: holder.playDefense, targetName: `a DEF ${holder.playDefense} opponent` })}
              />
            ))}
          </div>
          )}
          {!combos.length && (
            <EmptyState
              bare
              title="No True Combos match these filters"
              action={filtered ? <button type="button" onClick={reset} className={smallButton}>Clear filters</button> : null}
            />
          )}
          </Section>
        </>
      )}
      {readiness.ground && !data && !error && <LoadingState label={`Loading the ${weaponLabel(weapon)} list…`} />}
    </div>
  );
}

function LegendPicker({ legends, selected, onSelect, error, onRetry }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return legends.filter((legend) => !needle || legendName(legend).toLowerCase().includes(needle));
  }, [legends, query]);
  return (
    <Section padded={false} bodyClassName="flex flex-col gap-3 p-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Find a legend" />
      {error ? (
        <ErrorState message="Couldn't load the legend list." detail={error} onRetry={onRetry} />
      ) : !legends.length ? (
        <LoadingState bare label="Loading legends…" />
      ) : !filtered.length ? (
        <EmptyState bare title="No legend matches" action={<button type="button" onClick={() => setQuery("")} className={smallButton}>Clear search</button>} />
      ) : (
        <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto pr-1 app-scrollbar sm:grid-cols-6 lg:max-h-[60vh] lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((legend) => (
            <LegendFace
              key={legend.id}
              name={legendName(legend)}
              src={legendImage(legends, legend.id, legendName(legend))}
              onClick={() => onSelect(legend)}
              highlight={String(selected?.id) === String(legend.id) ? "selected" : ""}
              className="w-full border border-slate-800 bg-slate-950 font-bold"
            />
          ))}
        </div>
      )}
    </Section>
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

function LegendSection({ legends, legendsError, onRetryLegends, weapons: weaponList, onPlay }) {
  const [legend, setLegend] = useState(null);
  const [weaponSlot, setWeaponSlot] = useState(() => (new URLSearchParams(window.location.search).get("weapon") === "2" ? 2 : 1));
  useClearOnLeave(["first", "dmg", "open"]);
  const [firstMove, setFirstMove] = useQueryState("first", "all");
  const [damage, setDamage] = useNumberParam("dmg");
  const [openKey] = useQueryState("open", "");
  useEffect(() => {
    if (legend || !legends.length) return;
    const wanted = new URLSearchParams(window.location.search).get("legend");
    setLegend(legends.find((entry) => String(entry.id) === wanted) || legends.find((entry) => String(entry.id) === "3") || legends[0]);
  }, [legends, legend]);
  useEffect(() => {
    if (!legend) return undefined;
    const url = new URL(window.location.href);
    url.searchParams.set("legend", String(legend.id));
    if (weaponSlot === 2) url.searchParams.set("weapon", "2");
    else url.searchParams.delete("weapon");
    window.history.replaceState(null, "", url);
    return () => {
      const next = new URL(window.location.href);
      next.searchParams.delete("legend");
      next.searchParams.delete("weapon");
      window.history.replaceState(null, "", next);
    };
  }, [legend, weaponSlot]);
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
  const weaponRaw = usePolled(readiness.ground ? `${host}/game/combos/weapon/${encodeURIComponent(weaponName)}?layout=defenses` : "");
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
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <aside className="lg:w-80 lg:shrink-0">
        <LegendPicker legends={legends} error={legendsError} onRetry={onRetryLegends} selected={legend} onSelect={(next) => { setLegend(next); setFirstMove("all"); }} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Section padded={false} bodyClassName="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center gap-3">
            {legend && <img src={legendImage(legends, legend.id, name)} alt="" className="h-12 w-12 rounded-xl object-contain" />}
            <div className="min-w-[10rem] flex-1">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-300">Legend combos</div>
              <h2 className="text-2xl font-bold text-white">{name}</h2>
            </div>
            <Tabs
              variant="chips"
              label="Weapon"
              value={weaponSlot}
              onChange={(value) => { setWeaponSlot(Number(value)); setFirstMove("all"); }}
              items={weapons.map((entry) => ({
                value: entry.slot,
                icon: <WeaponIcon name={entry.name} className="h-7 w-7" />,
                label: weaponLabel(entry.name),
              }))}
            />
          </div>
          <p className="max-w-prose text-sm text-slate-400">
            Combos only {name} can do with {label}: ones that start or end with {name}'s own signatures, and {label} combos that
            no other {label} user lands in any stance, because they only work with {name}'s strength, dexterity or speed (checked against a DEF {LEGEND_TAB_DEFENSE} opponent).
          </p>
          {(sigReady || weaponReady) && (
            <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
              <MoveFilter moves={moves} firstMove={firstMove} setFirstMove={setFirstMove} />
              <DamageFilter damage={damage} setDamage={setDamage} />
            </div>
          )}
        </Section>
        <Section
          title="Signature combos"
          headingAs="h3"
          count={sigReady ? sigCombos.length : null}
        >
          {sig.error && <ErrorState message={`Couldn't load ${name}'s signature combos.`} detail={sig.error} onRetry={sig.retry} />}
          {sig.data?.status === "computing" && <Progress data={sig.data} label={`Simulating ${name}'s signature combos for each stance…`} />}
          {sig.data && !sigReady && sig.data.status !== "computing" && <Notice>{name}'s {label} signature combos aren't published yet.</Notice>}
          {legend && !sig.data && !sig.error && <LoadingState inline label="Loading signature combos…" />}
          {sigReady && !!sigCombos.length && (
            <div className="grid gap-3 xl:grid-cols-2 min-[112.5rem]:grid-cols-3 min-[137.5rem]:grid-cols-4">
              {sigCombos.map((combo) => (
                <ComboCard
                  key={`sig-${combo.first}-${(combo.chain || [combo.second]).join("-")}`}
                  combo={combo}
                  moveLabel={moveLabel}
                  legends={legends}
                  stanceTotals={new Map()}
                  focusHeroId={sig.data.heroId}
                  highlighted={openKey === comboKey(combo)}
                  onPlay={(holder) => onPlay({ weaponData: sig.data, combo, holder, moveLabel })}
                />
              ))}
            </div>
          )}
          {sigReady && !sigCombos.length && <EmptyState bare title="No signature combos match these filters" />}
        </Section>
        <Section
          title={`Only ${name}'s stats`}
          headingAs="h3"
          count={weaponReady ? statCombos.length : null}
        >
          {weaponRaw.error && <ErrorState message={`Couldn't load the ${label} list.`} detail={weaponRaw.error} onRetry={weaponRaw.retry} />}
          {weaponName && !readiness.ground && (
            <Notice>These come from the {label} list, which isn't published yet.</Notice>
          )}
          {readiness.ground && !weaponReady && !weaponRaw.error && (weaponRaw.data ? <Notice>The {label} list isn't published yet.</Notice> : <LoadingState inline label={`Loading the ${label} list…`} />)}
          {weaponReady && weaponRaw.data?.air?.status !== "ready" && (
            <div className="text-xs font-bold text-slate-400">{label} combos from a jump aren't published yet, so only ground combos are compared.</div>
          )}
          {weaponReady && !!statCombos.length && (
            <div className="grid gap-3 xl:grid-cols-2 min-[112.5rem]:grid-cols-3 min-[137.5rem]:grid-cols-4">
              {statCombos.map((combo) => (
                <ComboCard
                  key={`stat-${comboKey(combo)}`}
                  combo={combo}
                  moveLabel={moveLabel}
                  legends={legends}
                  stanceTotals={new Map()}
                  focusHeroId={legend.id}
                  highlighted={openKey === comboKey(combo)}
                  note={onlyReason(combo, legend.id, stances, label, name)}
                  onPlay={(holder) => onPlay({ weaponData, combo, holder, moveLabel, targetHeroId: 3, targetDefense: holder.playDefense, targetName: `a DEF ${holder.playDefense} opponent` })}
                />
              ))}
            </div>
          )}
          {weaponReady && !statCombos.length && <EmptyState bare title={`Every ${label} combo ${name} can do is also true for another ${label} user${firstMove !== "all" || damage !== null ? " at these filters" : ""}`} />}
        </Section>
      </div>
    </div>
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

function readShowBoxes() {
  try {
    return window.localStorage.getItem("combo-show-boxes") === "1";
  } catch {
    return false;
  }
}

function writeShowBoxes(value) {
  try {
    window.localStorage.setItem("combo-show-boxes", value ? "1" : "0");
  } catch {}
}

function BoxOverlay({ boxes, box }) {
  if (!boxes || !box) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {boxes.target && (
        <rect x={boxes.target.x - boxes.target.width / 2} y={boxes.target.y - boxes.target.height / 2} width={boxes.target.width} height={boxes.target.height} rx={boxes.target.width / 2} fill="rgba(250,204,21,.14)" stroke="#facc15" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      )}
      {(boxes.hurt || []).map((entry, index) => (
        <rect key={`hurt-${index}`} x={entry.x - entry.width / 2} y={entry.y - entry.height / 2} width={entry.width} height={entry.height} rx={entry.width / 2} fill="rgba(34,211,238,.14)" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      ))}
      {(boxes.hit || []).map((entry, index) => (
        <ellipse key={`hit-${index}`} cx={entry.x} cy={entry.y} rx={entry.rx} ry={entry.ry} fill="rgba(248,113,113,.25)" stroke="#fb7185" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function ComboPlayer({ play, onClose }) {
  const { weaponData, combo, holder, moveLabel, targetHeroId, targetDefense, targetName } = play;
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const [showBoxes, setShowBoxes] = useState(readShowBoxes);
  const playRanges = holder.playRanges || holder.ranges || [];
  const damageStart = playRanges[0]?.from ?? 0;
  const [damage, setDamage] = useState(damageStart);
  const [attempt, setAttempt] = useState(0);
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
          ...(combo.chain ? { chain: combo.chain } : {}),
          ...(combo.mode ? { mode: combo.mode } : {}),
          damage,
          levels: { strength: holder.strength, dexterity: holder.dexterity, speed: holder.speed },
          ...(Number.isFinite(Number(holder.airStart)) && holder.airStart !== null && holder.airStart !== undefined ? { airStart: holder.airStart } : {}),
          ...(holder.distance !== null && holder.distance !== undefined ? { distance: holder.distance } : {}),
          ...(holder.heldDirection ? { heldDirection: holder.heldDirection } : {}),
          ...(holder.airDrift === 0 || holder.airDrift === 2 ? { airDrift: holder.airDrift } : {}),
          ...(typeof holder.jumpTick === "number" ? { approach: "jump", jumpTick: holder.jumpTick } : {}),
          ...(holder.approach === "run" ? { approach: "run" } : {}),
          ...(holder.momentum === "run" || holder.momentum === "dash" ? { momentum: holder.momentum, ...(holder.momentum === "dash" ? { momentumDelay: Number(holder.momentumDelay) || 0 } : {}) } : {}),
          ...(holder.transition && !combo.chain ? { transitions: [holder.transition] } : {}),
          ...(targetHeroId && targetHeroId !== 3 ? { targetHeroId } : {}),
          ...(targetDefense ? { targetDefense } : {}),
        }),
      })
      .then((data) => !cancelled && setState({ loading: false, error: "", data }))
      .catch((reason) => !cancelled && setState({ loading: false, error: String(reason?.message || reason), data: null }));
    return () => {
      cancelled = true;
    };
  }, [heroId, targetHeroId, targetDefense, combo.mode, combo.first, combo.second, (combo.chain || []).join(">"), damage, holder.strength, holder.dexterity, holder.speed, holder.transition, holder.airStart, holder.airDrift, holder.jumpTick, holder.approach, holder.momentum, holder.momentumDelay, holder.distance, holder.heldDirection, attempt]);

  const timeline = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const startTick = Number(data.verdict?.startTick ?? 0);
    const parts = Array.isArray(data.parts)
      ? data.parts.map((part) => ({ start: Number(part.startTick || 0), frames: (part.frames || []).filter((frame) => frame.svg), hits: part.targetHits || [] }))
      : [
        { start: 0, frames: (data.firstPart?.frames || []).filter((frame) => frame.svg), hits: data.firstPart?.targetHits || [] },
        { start: startTick, frames: (data.secondPart?.frames || []).filter((frame) => frame.svg), hits: data.secondPart?.targetHits || [] },
      ];
    if (parts.length < 2 || parts.some((part) => !part.frames.length)) return null;
    const firstFrames = parts[0].frames;
    const secondFrames = parts.slice(1).flatMap((part) => part.frames);
    const pick = (frames, value) => {
      let chosen = frames[0];
      for (const frame of frames) {
        if (Number(frame.tick ?? 0) <= value) chosen = frame;
        else break;
      }
      return chosen;
    };
    const lastPart = parts[parts.length - 1];
    const total = lastPart.start + Number(lastPart.frames[lastPart.frames.length - 1].tick ?? 0) + 1;
    const frames = [];
    for (let value = 0; value < total; value += 1) {
      const part = parts.filter((entry) => entry.start <= value).pop() || parts[0];
      frames.push(pick(part.frames, value - part.start));
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
    const firstHitTicks = parts[0].hits.map((hit) => Number(hit.tick));
    const secondHitTick = Number(data.verdict?.secondHitTick);
    return {
      frames,
      box,
      startTick,
      endTick: Number(data.firstEndTick ?? 0),
      firstHitTicks,
      secondHitTick: Number.isFinite(secondHitTick) ? secondHitTick : null,
      freeTick: Number(data.verdict?.freeTick ?? 0),
      linkStarts: parts.slice(1).map((part) => part.start),
      partEnds: parts.map((part) => part.start + Number(part.frames[part.frames.length - 1].tick ?? 0)),
      steps: Array.isArray(data.chain) && Array.isArray(data.verdict?.steps) ? data.verdict.steps : null,
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
  const chainIndex = timeline && Array.isArray(state.data?.chain) ? timeline.linkStarts.filter((value) => value <= tick).length : 0;
  const chainStep = timeline?.steps && chainIndex < timeline.steps.length && tick >= (chainIndex === 0 ? timeline.endTick : timeline.partEnds[chainIndex] + 1) ? timeline.steps[chainIndex] : null;
  const phase = !timeline
    ? ""
    : chainStep
      ? transitionLabel(chainStep.transition || "link", chainStep.hold, chainStep.instant, chainStep.direction, chainStep.airJump, chainStep.backTap ? "tap" : chainStep.reverse, chainStep.dodgeWait)
    : chainIndex > 1
      ? moveLabel(state.data.chain[chainIndex - 1])
    : tick < timeline.endTick
      ? `${combo.mode === "split" ? "split " : ""}${moveLabel(combo.first)}`
      : tick < timeline.startTick
        ? transitionLabel(verdict?.transition && verdict.transition !== "throw" ? verdict.transition : "link", verdict?.hold, verdict?.instant, verdict?.direction, verdict?.airJump ?? holder.airJump, (verdict?.backTap ?? holder.backTap) ? "tap" : verdict?.reverse ?? holder.reverse, verdict?.dodgeWait ?? holder.dodgeWait)
        : moveLabel(combo.second);
  const stunned = timeline && tick < timeline.freeTick;
  const markers = timeline?.steps ? [
    ...timeline.firstHitTicks.map((value) => [value, "bg-amber-400", "First hit"]),
    [timeline.endTick, "bg-slate-300", "First move ends"],
    ...timeline.steps.flatMap((step, index) => [
      [Number(step.startTick), "bg-sky-400", `Move ${index + 2} starts`],
      [Number(step.secondHitTick), "bg-emerald-400", `Move ${index + 2} hits`],
      [Number(step.freeTick), "bg-rose-400", `Target can act after move ${index + 1}`],
    ]),
  ].filter(([value]) => Number.isFinite(value)) : timeline ? [
    ...timeline.firstHitTicks.map((value) => [value, "bg-amber-400", "First hit"]),
    [timeline.endTick, "bg-slate-300", "First move ends"],
    [timeline.startTick, "bg-sky-400", "Second move starts"],
    ...timeline.linkStarts.slice(1).map((value, index) => [value, "bg-sky-400", `Move ${index + 3} starts`]),
    [timeline.secondHitTick, "bg-emerald-400", "Second hit"],
    [timeline.freeTick, "bg-rose-400", "Target can act"],
  ].filter(([value]) => Number.isFinite(value)) : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Combo replay" className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-sm app-scrollbar" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <ComboSteps
              start={combo.start}
              mode={combo.mode}
              airDrift={holder.airDrift}
              jumpTick={holder.jumpTick}
              approach={holder.approach}
              momentum={holder.momentum}
              first={combo.first}
              heldDirection={verdict?.heldDirection ?? holder.heldDirection}
              transition={verdict?.transition || holder.transition}
              hold={verdict?.hold ?? holder.hold}
              instant={verdict?.instant ?? holder.instant}
              direction={verdict?.direction ?? holder.direction}
              airJump={verdict?.airJump ?? holder.airJump}
              reverse={(verdict?.backTap ?? holder.backTap) ? "tap" : verdict?.reverse ?? holder.reverse}
              dodgeWait={verdict?.dodgeWait ?? holder.dodgeWait}
              second={combo.second}
              throwHeld={verdict?.throwHeld ?? holder.throwHeld}
              moveLabel={moveLabel}
              chain={combo.chain}
              links={verdict?.steps ?? holder.steps}
            />
            <span className="text-xs font-bold text-slate-400">
              {holder.legend} · {stanceName(holder.stance)} stance · {stanceStats(holder)}{targetName ? ` · vs ${targetName}` : ""}{driftText(verdict?.driftSwitch !== undefined ? verdict : holder) ? ` · ${driftText(verdict?.driftSwitch !== undefined ? verdict : holder)}` : ""}{Number.isFinite(Number(holder.distance)) && holder.distance !== null ? ` · start ${holder.distance} units away` : ""}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
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
            <div className="absolute inset-0 grid place-items-center">
              <LoadingState inline label="Rendering the combo…" />
            </div>
          )}
          {state.error && (
            <div className="absolute inset-0 grid place-items-center p-3">
              <ErrorState className="w-full max-w-md" message="Couldn't render this combo." detail={state.error} onRetry={() => setAttempt((value) => value + 1)} />
            </div>
          )}
          {svg && (
            <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
          {svg && showBoxes && <BoxOverlay boxes={frame?.boxes} box={timeline?.box} />}
          {timeline && (
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs font-bold">
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
              <button type="button" onClick={() => setPlaying((value) => !value)} className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-white hover:bg-blue-400">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => { setTick(0); setPlaying(true); }} className={smallButton}>
                <SkipBack className="h-3.5 w-3.5" />
                Restart
              </button>
              <SelectInput
                label="Speed"
                value={String(speed)}
                onChange={(value) => setSpeed(Number(value))}
                options={[1, 0.5, 0.25, 0.1].map((value) => ({ value: String(value), label: `${value}×` }))}
              />
              <Pill className="py-1.5 tabular-nums">Frame {tick}</Pill>
              <Toggle label="Hitboxes" checked={showBoxes} onChange={(checked) => { setShowBoxes(checked); writeShowBoxes(checked); }} />
              <SelectInput
                label="Damage"
                value={String(damage)}
                onChange={(value) => setDamage(Number(value))}
                options={(weaponData.damageSteps || []).filter((value) => playRanges.some((range) => value >= range.from && value <= range.to)).map((value) => ({ value: String(value), label: `${value}%` }))}
              />
              {Number.isFinite(verdict?.gap) && (
                <Pill tone="emerald" className="whitespace-normal py-1.5">
                  Hits {verdict.gap} frame{verdict.gap === 1 ? "" : "s"} before the target can act
                </Pill>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
              {[["bg-amber-400", "first hit"], ["bg-slate-300", "first move ends"], ["bg-sky-400", timeline.steps ? "next move starts" : "second move starts"], ["bg-emerald-400", timeline.steps ? "next move hits" : "second hit"], ["bg-rose-400", timeline.steps ? "target can act after the move before" : "target can act"]].map(([color, text]) => (
                <span key={text} className="flex items-center gap-1"><span className={classes("inline-block h-2 w-2 rounded-full", color)} />{text}</span>
              ))}
              {showBoxes && [["border-rose-400 bg-rose-400/25", "hitbox"], ["border-cyan-400 bg-cyan-400/15", "attacker hurtbox"], ["border-yellow-400 bg-yellow-400/15", "target hurtbox"]].map(([color, text]) => (
                <span key={text} className="flex items-center gap-1"><span className={classes("inline-block h-2.5 w-2.5 rounded-full border", color)} />{text}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComboPage() {
  const { legends, error: legendsError, retry: retryLegends } = useLegends();
  const { weapons, loaded: weaponsLoaded, error: weaponsError, retry: retryWeapons } = useWeaponStatus();
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
  const nothingPublished = weaponsLoaded && !groundReady;
  const checkText = [
    "Every combo is simulated tick by tick with the game's hit, knockback, stun, jump and dash rules: the second attack has to land before the opponent can act again.",
    "The opponent stands on Small Brawlhaven and doesn't steer while stunned. Weapon combos are checked against every opponent defense from 1 to 11 and every damage from 0 to 200%.",
    "Legend combos use each stance's stats. Dexterity changes how soon an attack ends. More defense means less damage taken and slowing down sooner after a hit.",
  ];
  return (
    <PageShell>
      <PageHeader
        title="True Combos"
        image={<Swords className="mt-1 h-8 w-8 text-blue-300" />}
        subtitle="Two-hit combos the opponent can't escape."
        actions={(
          <CountPills>
            <CountPill label="Weapons" value={weapons.length || "–"} />
            <CountPill label="Ground lists" value={weapons.length ? `${groundReady}/${weapons.length}` : "–"} />
            <CountPill label="Jump lists" value={weapons.length ? `${airReady}/${weapons.length}` : "–"} />
          </CountPills>
        )}
      >
        <details className="group rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-bold text-slate-300 hover:text-blue-300">
            <Info className="h-4 w-4 text-blue-300" />
            How combos are checked
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-2 text-sm text-slate-400 md:grid-cols-3">
            {checkText.map((text) => <p key={text}>{text}</p>)}
          </div>
        </details>
      </PageHeader>
      {weaponsError && !weapons.length && <ErrorState message="Couldn't load the weapon list." detail={weaponsError} onRetry={retryWeapons} />}
      {!weaponsLoaded && !weaponsError && <LoadingState label="Loading combo lists…" />}
      {nothingPublished && (
        <EmptyState title="No combo lists are published yet">
          Each weapon's list is worked out offline and shows up here once it's uploaded.
        </EmptyState>
      )}
      {weaponsLoaded && !nothingPublished && (
        <>
          <Tabs
            label="Combo lists"
            value={tab}
            onChange={setTab}
            items={[
              { value: "weapon", label: "Weapon combos" },
              { value: "legend", label: "Legend combos" },
            ]}
          />
          {tab === "weapon"
            ? <WeaponSection legends={legends} weapons={weapons} onPlay={setPlay} />
            : <LegendSection legends={legends} legendsError={legendsError} onRetryLegends={retryLegends} weapons={weapons} onPlay={setPlay} />}
        </>
      )}
      {play && <ComboPlayer play={play} onClose={() => setPlay(null)} />}
    </PageShell>
  );
}
