import { useEffect, useMemo, useRef, useState } from "react";
import { host } from "../../stuff";
import groups from "./moveGroups.json";
import { highlight } from "./highlight.js";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, SearchInput, Section, Tabs, matchesWords } from "../ui";

const STORE = "bifrost-move-editor";
const LOCKED = new Set(["PowerName", "PowerID", "OrderID"]);
const TABS = ["Move", "Hitbox", "All columns", "My changes"];
const HIT_COLS = ["CenterOffsetX", "CenterOffsetY", "AoERadiusX", "AoERadiusY"];

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    return { edits: saved.edits || {}, mod: saved.mod || null };
  } catch {
    return { edits: {}, mod: null };
  }
}

function parts(value) {
  return String(value ?? "").split(",");
}

function firstNumber(text) {
  const n = parseFloat(String(text ?? "").split("&")[0]);
  return Number.isFinite(n) ? n : 0;
}

function withPart(value, index, count, n) {
  const list = parts(value);
  while (list.length < count) list.push(list[0] ?? "0");
  const old = list[index] ?? "0";
  const rest = old.includes("&") ? old.slice(old.indexOf("&")) : "";
  list[index] = String(Math.round(n)) + rest;
  return list.join(",");
}

function Field({ col, label, help, game, value, onChange, onReset }) {
  const changed = value !== undefined && value !== game;
  return (
    <label className="grid gap-1 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-white">{label || col}</span>
        {changed && (
          <button type="button" onClick={onReset} className="rounded-lg px-2 text-xs font-bold text-blue-300 hover:bg-blue-500/10">Reset</button>
        )}
      </span>
      <input
        type="text"
        value={changed ? value : game ?? ""}
        disabled={LOCKED.has(col)}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-slate-950 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-blue-400 disabled:opacity-60 ${changed ? "border-blue-400 text-blue-200" : "border-slate-700"}`}
      />
      <span className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
        <span>{help}</span>
        {changed && <span className="font-mono">game: {game === "" ? "(empty)" : game}</span>}
      </span>
    </label>
  );
}

function Hitboxes({ row, edits, onEdit }) {
  const svg = useRef(null);
  const [drag, setDrag] = useState(null);
  const value = (col) => (edits[col] !== undefined ? edits[col] : row[col] ?? "");
  const count = Math.max(...HIT_COLS.map((c) => parts(value(c)).length));
  const hits = Array.from({ length: count }, (_, i) => {
    const pick = (c) => {
      const list = parts(value(c));
      return firstNumber(list[i] ?? list[0]);
    };
    return { x: pick("CenterOffsetX"), y: pick("CenterOffsetY"), rx: Math.abs(pick("AoERadiusX")), ry: Math.abs(pick("AoERadiusY")) };
  });
  const span = Math.max(220, ...hits.map((h) => Math.max(Math.abs(h.x) + h.rx, Math.abs(h.y) + h.ry) + 40));
  const view = `${-span} ${-span} ${span * 2} ${span * 2}`;
  const colors = ["#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

  const latest = useRef(null);
  latest.current = { hits, count, span, value, onEdit };

  useEffect(() => {
    if (!drag) return;
    function move(e) {
      const { hits: hs, count: n, span: sp, value: val, onEdit: edit } = latest.current;
      const r = svg.current.getBoundingClientRect();
      const p = { x: ((e.clientX - r.left) / r.width) * sp * 2 - sp, y: ((e.clientY - r.top) / r.height) * sp * 2 - sp };
      const h = hs[drag.i];
      if (drag.what === "centre") {
        edit("CenterOffsetX", withPart(val("CenterOffsetX"), drag.i, n, p.x));
        edit("CenterOffsetY", withPart(val("CenterOffsetY"), drag.i, n, p.y));
      } else {
        edit("AoERadiusX", withPart(val("AoERadiusX"), drag.i, n, Math.max(1, Math.abs(p.x - h.x))));
        edit("AoERadiusY", withPart(val("AoERadiusY"), drag.i, n, Math.max(1, Math.abs(p.y - h.y))));
      }
    }
    function up() {
      setDrag(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag]);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_16rem] 2xl:grid-cols-[minmax(0,calc(100dvh_-_8rem))_16rem]">
      <svg
        ref={svg}
        viewBox={view}
        className="aspect-square w-full touch-none select-none rounded-xl border border-slate-700 bg-slate-950"
      >
        {Array.from({ length: Math.floor(span / 50) * 2 + 1 }, (_, k) => {
          const v = (k - Math.floor(span / 50)) * 50;
          return (
            <g key={k} stroke="#1e293b" strokeWidth={v === 0 ? 2 : 1}>
              <line x1={v} y1={-span} x2={v} y2={span} />
              <line x1={-span} y1={v} x2={span} y2={v} />
            </g>
          );
        })}
        <rect x={-28} y={-70} width={56} height={140} rx={20} fill="#334155" opacity="0.7" />
        <text x={0} y={92} textAnchor="middle" fill="#94a3b8" fontSize={14} fontWeight="700">legend, facing right</text>
        {hits.map((h, i) => (
          <g key={i}>
            <ellipse cx={h.x} cy={h.y} rx={h.rx || 1} ry={h.ry || 1} fill={colors[i % colors.length]} fillOpacity="0.25" stroke={colors[i % colors.length]} strokeWidth={3} />
            <circle cx={h.x} cy={h.y} r={9} fill={colors[i % colors.length]} className="cursor-move" onPointerDown={(e) => { e.preventDefault(); setDrag({ i, what: "centre" }); }} />
            <rect x={h.x + h.rx - 8} y={h.y + h.ry - 8} width={16} height={16} fill="#fff" stroke={colors[i % colors.length]} strokeWidth={3} className="cursor-nwse-resize" onPointerDown={(e) => { e.preventDefault(); setDrag({ i, what: "size" }); }} />
            <text x={h.x} y={h.y - (h.ry || 1) - 8} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight="800">hit {i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="grid content-start gap-2 text-sm">
        <p className="text-slate-300">Drag a dot to move a hit, drag the white square to resize it. One grid square is 50 game units. Negative Y is up.</p>
        {hits.map((h, i) => (
          <div key={i} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2 font-mono text-xs">
            <span className="font-bold" style={{ color: colors[i % colors.length] }}>hit {i + 1}</span> x {Math.round(h.x)}, y {Math.round(h.y)}, size {Math.round(h.rx)} × {Math.round(h.ry)}
          </div>
        ))}
        <p className="text-xs text-slate-500">Capsule hitboxes ("49&25") keep their second number when you drag.</p>
      </div>
    </div>
  );
}

export default function MoveEditor() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState(null);
  const [rows, setRows] = useState({});
  const [edits, setEdits] = useState({});
  const [tab, setTab] = useState(0);
  const [colSearch, setColSearch] = useState("");
  const [mod, setMod] = useState({ id: "my-moves", name: "My moves", version: "1.0" });
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);

  useEffect(() => {
    const saved = loadSaved();
    setEdits(saved.edits);
    if (saved.mod) setMod(saved.mod);
    ready.current = true;
    setError(null);
    fetch(`${host}/game/powers`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`The move list didn't load (${r.status})`))))
      .then((data) => {
        setIndex(data);
        const first = Object.keys(saved.edits)[0] || "BaseNeutral";
        setName(data.powers.some(([n]) => n === first) ? first : data.powers[0]?.[0]);
      })
      .catch((e) => setError(e.message));
  }, [attempt]);

  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ edits, mod }));
    } catch {}
  }, [edits, mod]);

  useEffect(() => {
    if (!name || rows[name]) return;
    fetch(`${host}/game/powers/${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${name} didn't load (${r.status})`))))
      .then((data) => setRows((old) => ({ ...old, [name]: data.power })))
      .catch((e) => setError(e.message));
  }, [name]);

  const labels = useMemo(() => new Map((index?.powers || []).map(([n, , label]) => [n, label || n])), [index]);
  const matching = useMemo(() => {
    if (!index) return [];
    return index.powers.filter(([n, , label, legend]) => matchesWords(search, [n, label, legend]));
  }, [index, search]);
  const shown = matching.slice(0, 300);
  const label = name ? labels.get(name) || name : "";

  const row = name ? rows[name] : null;
  const mine = (name && edits[name]) || {};
  const changedMoves = Object.keys(edits).filter((n) => Object.keys(edits[n] || {}).length > 0);

  function edit(col, value) {
    setEdits((old) => {
      const forMove = { ...(old[name] || {}) };
      if (row && value === row[col]) delete forMove[col];
      else forMove[col] = value;
      const next = { ...old, [name]: forMove };
      if (Object.keys(forMove).length === 0) delete next[name];
      return next;
    });
  }

  function reset(col, move = name) {
    setEdits((old) => {
      const forMove = { ...(old[move] || {}) };
      delete forMove[col];
      const next = { ...old, [move]: forMove };
      if (Object.keys(forMove).length === 0) delete next[move];
      return next;
    });
  }

  const modJson = useMemo(() => JSON.stringify({
    id: mod.id || "my-moves",
    name: mod.name || "My moves",
    version: mod.version || "1.0",
    description: `Changes ${changedMoves.length} move${changedMoves.length === 1 ? "" : "s"}. Made with the Bifrost move editor on saorax.com.`,
    tables: { powerTypes: changedMoves.map((n) => ({ copy: n, set: edits[n] })) },
  }, null, 2), [edits, mod]);

  function copy() {
    navigator.clipboard?.writeText(modJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function download() {
    const url = URL.createObjectURL(new Blob([modJson], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mod.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const field = (col, label, help) => (
    <Field key={col} col={col} label={label} help={help} game={row?.[col] ?? ""} value={mine[col]}
      onChange={(v) => edit(col, v)} onReset={() => reset(col)} />
  );

  const retry = () => { setError(null); setAttempt((value) => value + 1); };

  if (error && !index) {
    return (
      <PageShell>
        <PageHeader title="Move Editor" />
        <ErrorState message="The move list didn't load. Try again in a minute." detail={error} onRetry={retry} />
      </PageShell>
    );
  }

  const moveList = ({ close }) => (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Move, legend or power name" className="flex-none" />
      <div className="grid content-start gap-0.5 rounded-2xl border border-slate-700 bg-slate-900/80 p-1">
        {!index && <LoadingState inline label="Loading moves" className="p-3" />}
        {index && !shown.length && <p className="p-3 text-sm text-slate-400">No moves match</p>}
        {shown.map(([n, , moveLabel]) => (
          <button key={n} type="button" onClick={() => { setName(n); close(); }}
            className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs ${n === name ? "bg-blue-500 text-white" : "text-slate-200 hover:bg-slate-800"}`}>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{moveLabel || n}</span>
              {moveLabel && moveLabel !== n && <span className={`block truncate font-mono text-[11px] ${n === name ? "text-blue-100" : "text-slate-500"}`}>{n}</span>}
            </span>
            {edits[n] && <span className={`h-2 w-2 shrink-0 rounded-full ${n === name ? "bg-white" : "bg-blue-400"}`} />}
          </button>
        ))}
        {index && matching.length > shown.length && <p className="p-2 text-xs text-slate-500">Showing 300 of {matching.length.toLocaleString()}. Type more to narrow it down.</p>}
      </div>
    </>
  );

  return (
    <PageShell title="Move Editor" subtitle={label || undefined} sidebarLabel="Moves" sidebar={moveList}>
      <PageHeader
        eyebrow="Move Editor"
        title={<span className="break-words">{label || "…"}</span>}
        meta={<span className="block max-w-prose">{name && label !== name && <><code className="break-all font-mono text-slate-300">{name}</code>{" · "}</>}{index?.version ? `Game data from patch ${index.version}` : null}</span>}
      >
        <Tabs
          label="Editor views"
          value={tab}
          onChange={(value) => setTab(Number(value))}
          items={TABS.map((t, i) => ({ value: i, label: t, count: i === 3 && changedMoves.length > 0 ? changedMoves.length : undefined }))}
        />
      </PageHeader>

      {!row && tab !== 3 && <LoadingState label={`Loading ${name || "move"}`} />}

      {row && tab === 0 && groups.map((g) => (
        <Section key={g.name} title={g.name}>
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">{g.cols.map((c) => field(c.col, c.label, c.help))}</div>
        </Section>
      ))}

      {row && tab === 1 && <Section title="Hitboxes"><Hitboxes row={row} edits={mine} onEdit={edit} /></Section>}

      {row && tab === 2 && (
        <Section title="All columns" count={index?.columns.length}>
          <div className="max-w-sm"><SearchInput value={colSearch} onChange={setColSearch} shortcut={false} placeholder={`Find one of ${index?.columns.length ?? 184} columns`} /></div>
          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">
            {(index?.columns ?? Object.keys(row)).filter((c) => !colSearch || c.toLowerCase().includes(colSearch.toLowerCase())).map((c) => field(c, c, ""))}
          </div>
        </Section>
      )}

      {tab === 3 && (
        changedMoves.length === 0 ? <EmptyState title="No changes yet">Pick a move and change a value.</EmptyState> : (
          <Section title="My changes" count={changedMoves.length}>
            {changedMoves.map((n) => (
              <Card key={n} className="max-w-4xl">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => { setName(n); setTab(0); }} className="min-w-0 text-left text-sm font-bold text-blue-300 hover:underline">{labels.get(n) || n}{labels.get(n) && labels.get(n) !== n && <span className="ml-2 font-mono text-xs font-normal text-slate-500">{n}</span>}</button>
                  <button type="button" onClick={() => setEdits((old) => { const next = { ...old }; delete next[n]; return next; })} className="rounded-lg px-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Undo all</button>
                </div>
                <div className="mt-1 grid gap-1">
                  {Object.entries(edits[n]).map(([c, v]) => (
                    <div key={c} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="text-slate-500">{c}</span>
                      {rows[n] && <span className="text-slate-400 line-through">{rows[n][c] || "(empty)"}</span>}
                      <span className="text-blue-300">{v}</span>
                      <button type="button" onClick={() => reset(c, n)} className="text-slate-400 hover:text-rose-300">undo</button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </Section>
        )
      )}

      <Section
        title="Your mod"
        subtitle={<>Put this file in <code>mods\{mod.id || "my-moves"}\mod.json</code> next to Brawlhalla.exe and restart Bifrost. Move changes are gameplay mods: they work offline and in custom rooms where everyone has them.</>}
        actions={(
          <>
            <button type="button" onClick={copy} disabled={changedMoves.length === 0} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300 hover:border-slate-500 disabled:opacity-40">{copied ? "Copied" : "Copy"}</button>
            <button type="button" onClick={download} disabled={changedMoves.length === 0} className="rounded-xl border border-blue-400 bg-blue-500 px-3 py-2 text-sm font-bold text-white hover:bg-blue-400 disabled:opacity-40">Download mod.json</button>
          </>
        )}
      >
        <div className="grid max-w-3xl gap-2 sm:grid-cols-3">
          {[["id", "Mod id"], ["name", "Name"], ["version", "Version"]].map(([k, l]) => (
            <label key={k} className="grid gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{l}</span>
              <input type="text" value={mod[k]} onChange={(e) => setMod({ ...mod, [k]: k === "id" ? e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "-") : e.target.value })}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-blue-400" />
            </label>
          ))}
        </div>
        <pre className="app-scrollbar max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 text-[13px] leading-relaxed text-slate-200 ring-1 ring-slate-800"><code dangerouslySetInnerHTML={{ __html: highlight(modJson) }} /></pre>
      </Section>
    </PageShell>
  );
}
