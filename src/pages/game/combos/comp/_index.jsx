import "../../../../styles/global.css";
import "../../../../../fonts/style.css";
import { host } from "../../../../stuff";
import { ArrowRight, LoaderCircle, Pause, Play, Search, SkipBack, Swords, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

function useLegends() {
  const [legends, setLegends] = useState([]);
  useEffect(() => {
    getJson(`${host}/game/legends/summary`)
      .then((list) => setLegends([...list].sort((left, right) => legendName(left).localeCompare(legendName(right)))))
      .catch(() => setLegends([]));
  }, []);
  return legends;
}

function usePolled(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    let timer = null;
    setData(null);
    setError("");
    const load = () => {
      getJson(url, { cache: "no-store" })
        .then((payload) => {
          if (cancelled) return;
          setData(payload);
          if (payload.status !== "ready") timer = setTimeout(load, 4000);
        })
        .catch((reason) => !cancelled && setError(String(reason?.message || reason)));
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url]);
  return { data, error };
}

function legendImage(legends, heroId, fallbackName) {
  const legend = legends.find((entry) => String(entry.id) === String(heroId));
  if (legend?.image) return `${host}${legend.image}`;
  return `${host}/game/legends/art/${encodeURIComponent(legend ? legendName(legend) : fallbackName)}`;
}

function DamageBar({ ranges }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
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

function ComboSteps({ start, airDrift, first, heldDirection, transition, hold, instant, direction, airJump, reverse, second, moveLabel }) {
  const steps = [
    ...(start === "air" ? [{ kind: "transition", key: "jump", lead: true }] : []),
    { kind: "move", key: first, held: heldDirection },
    ...(transition && transition !== "link" ? [{ kind: "transition", key: transition }] : []),
    { kind: "move", key: second },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, index) => (
        <span key={`${step.key}-${index}-${step.lead ? "lead" : ""}`} className="flex items-center gap-2">
          {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-500" />}
          {step.kind === "transition" ? (
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-sky-200">{step.lead ? (airDrift === 0 ? "jump straight up" : airDrift === 2 ? "jump forward, then let go" : "jump") : transitionLabel(step.key, hold, instant, direction, airJump, reverse)}</span>
          ) : (
            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium text-slate-100">{moveLabel(step.key)}{step.held ? ` (hold ${step.held})` : ""}</span>
          )}
        </span>
      ))}
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

function HolderList({ holders, stanceTotals, legends, onPlay }) {
  const groups = groupHolders(holders);
  return (
    <div className="flex flex-col gap-1.5">
      {groups.map((group) => {
        const total = stanceTotals.get(group.heroId) || group.stances.length;
        const all = group.stances.length >= total;
        return (
          <div key={group.heroId} className="flex flex-wrap items-center gap-1.5 text-xs">
            <img src={legendImage(legends, group.heroId, group.legend)} alt="" loading="lazy" className="h-6 w-6 rounded object-contain" />
            <span className="mr-1 font-medium text-slate-200">{group.legend}</span>
            {all ? (
              <button
                onClick={() => onPlay(group.stances.find((stance) => stance.stance === "Base") || group.stances[0])}
                className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200 hover:bg-emerald-500/25"
              >
                every stance
              </button>
            ) : (
              group.stances.map((stance) => (
                <button
                  key={stance.stance}
                  onClick={() => onPlay(stance)}
                  title={`${stanceStats(stance)} · true at ${rangeText(stance.ranges)}`}
                  className={classes(
                    "rounded px-1.5 py-0.5",
                    stance.stance === "Base" ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                  )}
                >
                  {stance.stance}
                </button>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComboCard({ combo, moveLabel, legends, stanceTotals, onPlay, focusHeroId }) {
  const holders = focusHeroId ? combo.holders.filter((holder) => String(holder.heroId) === String(focusHeroId)) : combo.holders;
  const ranges = mergeRanges(holders.map((holder) => holder.ranges));
  const leeway = Math.max(...holders.map((holder) => Number(holder.leeway ?? -99)));
  const best = [...holders].sort((left, right) => Number(right.leeway ?? -99) - Number(left.leeway ?? -99))[0];
  const legendCount = new Set(holders.map((holder) => holder.heroId)).size;
  const everyone = holders.length >= combo.stanceCount;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <ComboSteps start={combo.start} airDrift={best?.airDrift} first={combo.first} heldDirection={best?.heldDirection} transition={best?.transition} hold={best?.hold} instant={best?.instant} direction={best?.direction} airJump={best?.airJump} reverse={best?.reverse} second={combo.second} moveLabel={moveLabel} />
        <button
          onClick={() => onPlay(best)}
          className="flex shrink-0 items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300"
        >
          <Play className="h-3.5 w-3.5" />
          Watch
        </button>
      </div>
      <DamageBar ranges={ranges} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>True at {rangeText(ranges)}</span>
        {Number.isFinite(leeway) && leeway >= 0 && (
          <span>
            {leeway} frame{leeway === 1 ? "" : "s"} to spare
            {best?.drift === "toward" ? ", hold toward" : ""}
            {Number.isFinite(Number(best?.distance)) && best?.distance !== null ? `, start ${best.distance} units away` : ""}
          </span>
        )}
      </div>
      {!focusHeroId && (
        <div className="border-t border-slate-800 pt-3">
          {everyone ? (
            <span className="text-xs text-emerald-200">Every legend and stance</span>
          ) : (
            <>
              <div className="mb-2 text-xs text-slate-500">
                {legendCount} legend{legendCount === 1 ? "" : "s"} · {holders.length} stance{holders.length === 1 ? "" : "s"}
              </div>
              <HolderList holders={holders} stanceTotals={stanceTotals} legends={legends} onPlay={onPlay} />
            </>
          )}
        </div>
      )}
      {focusHeroId && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-800 pt-3 text-xs">
          {holders.map((holder) => (
            <button
              key={holder.stance}
              onClick={() => onPlay(holder)}
              title={`${stanceStats(holder)} · true at ${rangeText(holder.ranges)}`}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 hover:bg-slate-700"
            >
              {holder.stance}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Progress({ data, label }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
      <span className="flex items-center gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin text-amber-400" />
        {label}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${data?.total ? (data.done / data.total) * 100 : 0}%` }} />
      </div>
      <span className="text-xs text-slate-500">
        {data?.total ? `${data.done} of ${data.total} checks` : "Waiting for earlier jobs to finish"}
      </span>
    </div>
  );
}

function Filters({ moves, firstMove, setFirstMove, damage, setDamage, children }) {
  const startingMoves = moves || [];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-slate-400">Starts with</span>
        {[{ key: "all", label: "Any move" }, ...startingMoves].map((move) => (
          <button
            key={move.key}
            onClick={() => setFirstMove(move.key)}
            className={classes(
              "rounded-md px-2 py-1",
              firstMove === move.key ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
          >
            {move.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-28 text-slate-400">Target damage</span>
        <input
          type="range"
          min={0}
          max={MAX_DAMAGE}
          step={20}
          value={damage ?? 0}
          onChange={(event) => setDamage(Number(event.target.value))}
          className="w-56 accent-amber-400"
        />
        <span className="w-20 text-slate-200">{damage === null ? "Any" : `${damage}%`}</span>
        {damage !== null && (
          <button onClick={() => setDamage(null)} className="text-xs text-slate-400 underline">
            Any damage
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function filterCombos(combos, { firstMove, damage, heroId, baseOnly }) {
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
    .sort((left, right) => right.holders.length - left.holders.length || (right.bestLeeway ?? -99) - (left.bestLeeway ?? -99));
}

function WeaponSection({ legends, onPlay }) {
  const [weapons, setWeapons] = useState([]);
  const [weapon, setWeapon] = useState("Sword");
  const [firstMove, setFirstMove] = useState("all");
  const [damage, setDamage] = useState(null);
  const [heroId, setHeroId] = useState("");
  const [baseOnly, setBaseOnly] = useState(false);
  const { data, error } = usePolled(`${host}/game/combos/weapon/${encodeURIComponent(weapon)}`);

  useEffect(() => {
    getJson(`${host}/game/combos/weapons`, { cache: "no-store" }).then(setWeapons).catch(() => setWeapons([]));
  }, [data?.status]);
  useEffect(() => {
    setFirstMove("all");
    setHeroId("");
  }, [weapon]);

  const ready = data?.status === "ready";
  const moveLabel = (key) => data?.moves?.find((move) => move.key === key)?.label || key;
  const stanceTotals = useMemo(
    () => new Map(Object.entries(data?.stancesByLegend || {}).map(([id, count]) => [Number(id), Number(count)])),
    [data],
  );
  const combos = useMemo(
    () => (ready ? filterCombos((data.combos || []).map((combo) => ({ ...combo, stanceCount: data.stanceCount })), { firstMove, damage, heroId, baseOnly }) : []),
    [data, ready, firstMove, damage, heroId, baseOnly],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(weapons.length ? weapons : [{ weapon: "Sword" }]).map((entry) => (
          <button
            key={entry.weapon}
            onClick={() => setWeapon(entry.weapon)}
            className={classes(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm",
              weapon === entry.weapon
                ? "border-amber-400 bg-amber-400/10 text-amber-200"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500",
            )}
          >
            {weaponLabel(entry.weapon)}
            {entry.status === "computing" && <LoaderCircle className="h-3 w-3 animate-spin text-slate-500" />}
          </button>
        ))}
      </div>
      <p className="max-w-3xl text-sm text-slate-400">
        Combos any {weaponLabel(weapon)} user can do without signatures (recovery and ground pound count). Each stance has its own
        strength, dexterity and speed, and dexterity changes how soon an attack ends, so some combos only work for some legends or
        stances. Click a stance to watch it.
      </p>
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {data && !ready && <Progress data={data} label={`Simulating every ${weaponLabel(weapon)} move pair for each stance…`} />}
      {ready && (
        <>
          {data.air && data.air.status !== "ready" && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-400" />
              Combos that start with a jump and an aerial are still being simulated
              {data.air.total ? ` (${data.air.done} of ${data.air.total} checks)` : ""}.
            </div>
          )}
          <Filters moves={(data.moves || []).filter((move) => (data.combos || []).some((combo) => combo.first === move.key))} firstMove={firstMove} setFirstMove={setFirstMove} damage={damage} setDamage={setDamage}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-28 text-slate-400">Legend</span>
              <select
                value={heroId}
                onChange={(event) => setHeroId(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
              >
                <option value="">Any {weaponLabel(weapon)} user</option>
                {[...(data.legends || [])].sort((left, right) => left.legend.localeCompare(right.legend)).map((legend) => (
                  <option key={legend.heroId} value={legend.heroId}>{legend.legend}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={baseOnly} onChange={(event) => setBaseOnly(event.target.checked)} className="accent-amber-400" />
                Base stance only
              </label>
            </div>
          </Filters>
          <div className="text-sm text-slate-400">
            {combos.length} true combo{combos.length === 1 ? "" : "s"}
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
                onPlay={(holder) => onPlay({ weaponData: data, combo, holder, moveLabel })}
              />
            ))}
          </div>
          {!combos.length && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
              No true combos match these filters.
            </div>
          )}
        </>
      )}
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
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a legend"
          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </label>
      <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((legend) => (
          <button
            key={legend.id}
            onClick={() => onSelect(legend)}
            title={legendName(legend)}
            className={classes(
              "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] transition",
              String(selected?.id) === String(legend.id)
                ? "border-amber-400 bg-amber-400/10 text-amber-200"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600",
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

function LegendSection({ legends, onPlay }) {
  const [legend, setLegend] = useState(null);
  const [weaponSlot, setWeaponSlot] = useState(1);
  const [firstMove, setFirstMove] = useState("all");
  const [damage, setDamage] = useState(null);
  useEffect(() => {
    if (!legend && legends.length) setLegend(legends.find((entry) => String(entry.id) === "3") || legends[0]);
  }, [legends, legend]);
  const { data, error } = usePolled(legend ? `${host}/game/combos/${legend.id}?weapon=${weaponSlot}` : "");
  const ready = data?.status === "ready";
  const moveLabel = (key) => data?.moves?.find((move) => move.key === key)?.label || key;
  const combos = useMemo(
    () => (ready ? filterCombos((data.combos || []).map((combo) => ({ ...combo, stanceCount: data.stanceCount })), { firstMove, damage, heroId: null, baseOnly: false }) : []),
    [data, ready, firstMove, damage],
  );
  const weapons = legend
    ? [
        { slot: 1, name: legend.weapons?.main?.name },
        { slot: 2, name: legend.weapons?.secondary?.name },
      ].filter((weapon) => weapon.name)
    : [];
  return (
    <section className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-80 lg:shrink-0">
        <LegendPicker legends={legends} selected={legend} onSelect={(next) => { setLegend(next); setFirstMove("all"); }} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {weapons.map((weapon) => (
            <button
              key={weapon.slot}
              onClick={() => { setWeaponSlot(weapon.slot); setFirstMove("all"); }}
              className={classes(
                "rounded-lg border px-3 py-1.5 text-sm",
                weaponSlot === weapon.slot
                  ? "border-amber-400 bg-amber-400/10 text-amber-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500",
              )}
            >
              {weapon.name}
            </button>
          ))}
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Combos that start or end with {legend ? legendName(legend) : "this legend"}'s own signatures. Each one lists the stances
          it works in.
        </p>
        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        {data && !ready && <Progress data={data} label={`Simulating ${data.legend || "this legend"}'s signature combos for each stance…`} />}
        {ready && (
          <>
            <Filters moves={(data.moves || []).filter((move) => !move.air)} firstMove={firstMove} setFirstMove={setFirstMove} damage={damage} setDamage={setDamage} />
            <div className="text-sm text-slate-400">
              {combos.length} signature combo{combos.length === 1 ? "" : "s"}
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {combos.map((combo) => (
                <ComboCard
                  key={`${combo.first}-${combo.second}`}
                  combo={combo}
                  moveLabel={moveLabel}
                  legends={legends}
                  stanceTotals={new Map()}
                  focusHeroId={data.heroId}
                  onPlay={(holder) => onPlay({ weaponData: data, combo, holder, moveLabel })}
                />
              ))}
            </div>
            {!combos.length && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
                No signature combos match these filters.
              </div>
            )}
          </>
        )}
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
  const { weaponData, combo, holder, moveLabel } = play;
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const damageStart = holder.ranges?.[0]?.from ?? 0;
  const [damage, setDamage] = useState(damageStart);
  const heroId = holder.heroId;
  const weaponSlot = Number.isFinite(Number(holder.weaponSlot)) ? Number(holder.weaponSlot) : Number(weaponData.weaponSlot ?? 1);

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
          ...(holder.transition ? { transitions: [holder.transition] } : {}),
        }),
      })
      .then((data) => !cancelled && setState({ loading: false, error: "", data }))
      .catch((reason) => !cancelled && setState({ loading: false, error: String(reason?.message || reason), data: null }));
    return () => {
      cancelled = true;
    };
  }, [heroId, combo.first, combo.second, damage, holder.strength, holder.dexterity, holder.speed, holder.transition, holder.airStart, holder.airDrift, holder.distance, holder.heldDirection]);

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
  const phase = !timeline
    ? ""
    : tick < timeline.endTick
      ? moveLabel(combo.first)
      : tick < timeline.startTick
        ? transitionLabel(state.data?.verdict?.transition || "link", state.data?.verdict?.hold, state.data?.verdict?.instant, state.data?.verdict?.direction, state.data?.verdict?.airJump ?? holder.airJump, state.data?.verdict?.reverse ?? holder.reverse)
        : moveLabel(combo.second);
  const stunned = timeline && tick < timeline.freeTick;
  const marker = (value, color, label) => timeline && Number.isFinite(value) && (
    <div
      key={`${label}-${value}`}
      title={`${label} (frame ${value})`}
      className={classes("absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-sm", color)}
      style={{ left: `${(value / Math.max(1, timeline.frames.length - 1)) * 100}%` }}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <ComboSteps
              start={combo.start}
              airDrift={holder.airDrift}
              first={combo.first}
              heldDirection={state.data?.verdict?.heldDirection ?? holder.heldDirection}
              transition={state.data?.verdict?.transition || holder.transition}
              hold={state.data?.verdict?.hold ?? holder.hold}
              instant={state.data?.verdict?.instant ?? holder.instant}
              direction={state.data?.verdict?.direction ?? holder.direction}
              airJump={state.data?.verdict?.airJump ?? holder.airJump}
              reverse={state.data?.verdict?.reverse ?? holder.reverse}
              second={combo.second}
              moveLabel={moveLabel}
            />
            <span className="text-xs text-slate-400">
              {holder.legend} · {holder.stance} stance · {stanceStats(holder)}
            </span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950">
          {state.data?.defs && (
            <svg width="0" height="0" aria-hidden="true" className="absolute">
              <defs dangerouslySetInnerHTML={{ __html: state.data.defs }} />
            </svg>
          )}
          {state.loading && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin text-amber-400" />
                Rendering the combo…
              </span>
            </div>
          )}
          {state.error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-rose-200">{state.error}</div>}
          {svg && (
            <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
          {timeline && (
            <div className="absolute left-3 top-3 flex gap-2 text-xs">
              <span className="rounded bg-slate-900/80 px-2 py-1 text-slate-100">{phase}</span>
              <span className={classes("rounded px-2 py-1", stunned ? "bg-rose-500/80 text-white" : "bg-emerald-500/80 text-slate-950")}>
                {stunned ? "target stunned" : "target free"}
              </span>
            </div>
          )}
        </div>
        {timeline && (
          <div className="flex flex-col gap-2">
            <div className="relative h-3">
              <input
                type="range"
                min={0}
                max={timeline.frames.length - 1}
                value={tick}
                onChange={(event) => { setPlaying(false); setTick(Number(event.target.value)); }}
                className="absolute inset-0 w-full accent-amber-400"
              />
            </div>
            <div className="relative h-2 rounded bg-slate-800">
              {timeline.firstHitTicks.map((value) => marker(value, "bg-amber-400", "First hit"))}
              {marker(timeline.endTick, "bg-slate-400", "First move ends")}
              {marker(timeline.startTick, "bg-sky-400", "Second move starts")}
              {marker(timeline.secondHitTick, "bg-emerald-400", "Second hit")}
              {marker(timeline.freeTick, "bg-rose-400", "Target can act")}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <button onClick={() => setPlaying((value) => !value)} className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 hover:bg-slate-700">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={() => { setTick(0); setPlaying(true); }} className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 hover:bg-slate-700">
                <SkipBack className="h-3.5 w-3.5" />
                Restart
              </button>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                {[1, 0.5, 0.25, 0.1].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select>
              <span>Frame {tick}</span>
              <label className="flex items-center gap-2">
                Target damage
                <select value={damage} onChange={(event) => setDamage(Number(event.target.value))} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                  {(weaponData.damageSteps || []).filter((value) => holder.ranges.some((range) => value >= range.from && value <= range.to)).map((value) => (
                    <option key={value} value={value}>{value}%</option>
                  ))}
                </select>
              </label>
              {Number.isFinite(state.data?.verdict?.gap) && (
                <span className="text-emerald-300">
                  Hits {state.data.verdict.gap} frame{state.data.verdict.gap === 1 ? "" : "s"} before the target can act
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />first hit</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-400" />first move ends</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" />second move starts</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />second hit</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-400" />target can act</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComboPage() {
  const legends = useLegends();
  const [tab, setTab] = useState("weapon");
  const [play, setPlay] = useState(null);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Swords className="h-6 w-6 text-amber-400" />
            True combos
          </h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Every combo here is checked tick by tick with the game's own hit, knockback, stun, jump and dash rules: the second
            attack lands before the opponent can act again. The target is Bödvar on Small Brawlhaven and does not steer while
            stunned.
          </p>
        </header>
        <div className="flex gap-2 border-b border-slate-800">
          {[
            ["weapon", "Weapon combos"],
            ["legend", "Signature combos"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={classes(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === key ? "border-amber-400 text-amber-200" : "border-transparent text-slate-400 hover:text-slate-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "weapon" ? <WeaponSection legends={legends} onPlay={setPlay} /> : <LegendSection legends={legends} onPlay={setPlay} />}
      </div>
      {play && <ComboPlayer play={play} onClose={() => setPlay(null)} />}
    </div>
  );
}
