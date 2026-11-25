import { useEffect, useMemo, useState } from 'react';
import { host } from '../../stuff';
import { StatMiniLine } from './stanceStats';

const verdictStyles = {
  buff: { label: 'Buff', badge: 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100', text: 'text-emerald-200', mark: '▲' },
  nerf: { label: 'Nerf', badge: 'border-rose-300/40 bg-rose-500/20 text-rose-100', text: 'text-rose-200', mark: '▼' },
  mixed: { label: 'Mixed', badge: 'border-sky-300/40 bg-sky-500/20 text-sky-100', text: 'text-sky-200', mark: '◆' },
  changed: { label: 'Changed', badge: 'border-amber-300/40 bg-amber-500/20 text-amber-100', text: 'text-amber-100', mark: '•' },
  visual: { label: 'Visual', badge: 'border-slate-400/40 bg-slate-500/20 text-slate-100', text: 'text-slate-300', mark: '◇' },
};

const statRows = [['strength', 'Strength'], ['dexterity', 'Dexterity'], ['defense', 'Defense'], ['speed', 'Speed']];

const weaponIcon = (icon) => `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${icon}/1`;
const portraitUrl = (hero) => (hero?.portrait ? `${host}/game/getGfx/${hero.portraitFile || 'UI_Icons'}/${hero.portrait}/1` : '');
const mapThumb = (map) => (map?.thumbnail ? `${host}/game/images/images/thumbnails/${map.thumbnail}` : '');
const legendUrl = (name) => `/game/legends/${String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
const currencyUrl = (icon, currency) => (icon === 'special' || currency ? `${host}/game/getGfx/UI_Currencies/a_Currency_${currency}` : `${host}/game/getGfx/storeIcon/${icon}`);
const splashUrl = (data) => (data?.AnimRig ? `${host}/game/animMetadataRig/splash/${encodeURIComponent(data.AnimRig)}/Ready?customArt=${encodeURIComponent(data.AnimCustomArt || data.SplashArtName || '')}` : '');

function colorHex(value) {
  const text = String(value || '').trim();
  if (!text) return '#e2e8f0';
  if (text.startsWith('#')) return text;
  if (/^0x/i.test(text)) return `#${text.slice(2)}`;
  return text;
}

function Img({ src, className, alt = '' }) {
  if (!src) return null;
  return <img src={src} alt={alt} loading="lazy" className={className} onError={(event) => { event.currentTarget.style.display = 'none'; }} />;
}

function Price({ value, icon, currency, label, strike = false, tone = 'text-slate-100' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${strike ? 'text-slate-500 line-through' : tone}`} title={label}>
      <Img src={currencyUrl(icon, currency)} className="h-4 w-4 object-contain" alt={label} />
      <span className="font-bold">{Number(value).toLocaleString()}</span>
    </span>
  );
}

function Section({ id, title, subtitle, count, children, defaultOpen = true, tone = 'slate' }) {
  const [open, setOpen] = useState(defaultOpen);
  const border = tone === 'violet' ? 'border-violet-500/40' : 'border-slate-700';
  return (
    <section id={id} className={`scroll-mt-32 rounded-2xl border ${border} bg-slate-900/80 shadow-sm`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white">{title}{count !== undefined && <span className="ml-2 text-sm font-normal text-slate-400">{count}</span>}</h3>
          {subtitle && <p className="mt-1 max-w-prose text-sm text-slate-400">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-xs text-slate-300">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="space-y-3 border-t border-slate-800 p-3">{children}</div>}
    </section>
  );
}

function Heading({ children, tone = 'text-blue-200' }) {
  return <h4 className={`mb-2 text-sm font-bold uppercase tracking-wide ${tone}`}>{children}</h4>;
}

function Pill({ label, value, tone = 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
    rose: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
    sky: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
    amber: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
    slate: 'bg-slate-700/70 text-slate-200 border-slate-600',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[tone] || colors.slate}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-bold leading-tight">{value}</div>
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const style = verdictStyles[verdict] || verdictStyles.changed;
  return <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${style.badge}`}>{style.label}</span>;
}

function DeltaChip({ delta, verdict }) {
  if (delta === undefined || delta === null || delta === 0) return null;
  const style = verdictStyles[verdict] || verdictStyles.changed;
  return <span className={`ml-1.5 rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] ${style.text}`}>{delta > 0 ? '+' : ''}{delta}</span>;
}

function HitboxDiagram({ hitbox }) {
  const windows = (hitbox?.windows || []).slice(0, 4);
  if (!windows.length) return null;
  const all = windows.flatMap((window) => [...window.before, ...window.after]);
  const minX = Math.min(0, ...all.map((box) => box.x - box.w)) - 20;
  const maxX = Math.max(0, ...all.map((box) => box.x + box.w)) + 20;
  const minY = Math.min(0, ...all.map((box) => box.y - box.h)) - 20;
  const maxY = Math.max(0, ...all.map((box) => box.y + box.h)) + 20;
  const width = maxX - minX;
  const height = maxY - minY;
  const shape = (box, index, kind) => (
    <rect
      key={`${kind}-${index}`}
      x={box.x - box.w}
      y={box.y - box.h}
      width={box.w * 2}
      height={box.h * 2}
      rx={Math.min(box.w, box.h)}
      className={kind === 'before' ? 'fill-rose-500/15 stroke-rose-400' : 'fill-emerald-500/15 stroke-emerald-300'}
      strokeWidth={Math.max(width, height) / (kind === 'before' ? 110 : 160)}
      strokeDasharray={kind === 'before' ? `${Math.max(width, height) / 60}` : undefined}
    />
  );
  return (
    <div className="mt-2 ml-5">
      <div className="flex flex-wrap gap-2">
        {windows.map((window) => (
          <figure key={window.index} className="rounded-lg border border-slate-700 bg-slate-950 p-1.5">
            <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="h-28 w-40" role="img" aria-label={`Hitbox in hit window ${window.index + 1}, before and after`}>
              <line x1={minX} x2={maxX} y1={0} y2={0} className="stroke-slate-800" strokeWidth={Math.max(width, height) / 300} />
              <line x1={0} x2={0} y1={minY} y2={maxY} className="stroke-slate-800" strokeWidth={Math.max(width, height) / 300} />
              {window.before.map((box, index) => shape(box, index, 'before'))}
              {window.after.map((box, index) => shape(box, index, 'after'))}
              <circle cx={0} cy={0} r={Math.max(width, height) / 70} className="fill-slate-300" />
            </svg>
            <figcaption className="text-center text-[10px] text-slate-500">hit window {window.index + 1}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span><span className="text-rose-300">- - -</span> before</span>
        <span><span className="text-emerald-300">▬</span> after</span>
        <span><span className="text-slate-300">●</span> legend's center, facing right</span>
      </div>
    </div>
  );
}

function Line({ line }) {
  const [open, setOpen] = useState(false);
  const style = verdictStyles[line.verdict] || verdictStyles.changed;
  return (
    <li className="text-sm">
      <div className="flex items-baseline gap-2">
        <span className={`w-3 shrink-0 text-center text-xs ${style.text}`} aria-hidden="true">{style.mark}</span>
        <div className="min-w-0 max-w-prose flex-1">
          {line.part && <span className="mr-1.5 rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-slate-300">{line.part}</span>}
          <span className={style.text}>{line.text}</span>
          <DeltaChip delta={line.delta} verdict={line.verdict} />
          {line.detail && (
            <button type="button" onClick={() => setOpen((value) => !value)} className="ml-1.5 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">
              {open ? 'hide data' : 'data'}
            </button>
          )}
        </div>
      </div>
      {line.hitbox && <HitboxDiagram hitbox={line.hitbox} />}
      {open && line.detail && <pre className="mt-1 ml-5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 font-mono text-[11px] text-slate-400 app-scrollbar">{line.detail}</pre>}
    </li>
  );
}

function MoveCard({ move, showWeapon = false }) {
  const [showParts, setShowParts] = useState(false);
  return (
    <div id={`move-${move.key}`} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {showWeapon && move.weaponIcon && <Img src={weaponIcon(move.weaponIcon)} className="h-6 w-6" />}
        <span className="font-bold text-white">{move.name}</span>
        <VerdictBadge verdict={move.verdict} />
        {move.type === 'added' && <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-100">New</span>}
        {move.type === 'removed' && <span className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-100">Removed</span>}
        {move.announced === false && <span className="rounded-lg border border-yellow-300/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-100" title="This attack is not mentioned in the official patch notes">Not in official notes</span>}
      </div>
      <ul className="mt-2 space-y-1.5">
        {move.lines.map((line, index) => <Line key={`${line.text}-${index}`} line={line} />)}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
        {move.viewerUrl && <a href={move.viewerUrl} className="font-bold text-blue-300 hover:underline" title="Opens the current version of this attack with its hitboxes">View in animation viewer</a>}
        <button type="button" onClick={() => setShowParts((value) => !value)} className="text-slate-500 hover:text-slate-300">
          {showParts ? 'Hide game data names' : `Game data: ${plural(move.parts.length, 'power')}`}
        </button>
      </div>
      {showParts && (
        <div className="mt-1 flex flex-wrap gap-1">
          {move.parts.map((part) => (
            <span key={`${part.powerName}-${part.id}`} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-slate-400" title={part.devNotes || ''}>
              {part.powerName}{part.id ? ` #${part.id}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const runeStats = (block) => ({ Strength: block?.strength ?? 0, Dexterity: block?.dexterity ?? 0, Weight: block?.defense ?? 0, Speed: block?.speed ?? 0 });
const stanceIconUrl = (entry) => (entry?.icon ? `${host}/game/getGfx/${entry.iconFile || 'UI_Icons'}/${entry.icon}/1` : '');

function statDeltas(before, after) {
  return statRows
    .map(([key, label]) => ({ key, label, diff: (after?.[key] ?? 0) - (before?.[key] ?? 0) }))
    .filter((entry) => entry.diff !== 0);
}

function StanceCard({ name, icon, iconFile, stats, base, before, tone = 'slate', label }) {
  const deltas = before ? statDeltas(before, stats) : base ? statDeltas(base, stats) : [];
  const tones = {
    slate: 'border-slate-700 bg-slate-950/60 text-slate-100',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  };
  return (
    <div className={`rounded-xl border p-2 ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <Img src={stanceIconUrl({ icon, iconFile })} className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <div className="text-sm font-black leading-tight">{name}{label ? <span className="ml-1.5 text-[11px] font-bold opacity-70">{label}</span> : null}</div>
          {deltas.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-black">
              {deltas.map((entry) => (
                <span key={entry.key} className={entry.diff > 0 ? 'text-emerald-300' : 'text-red-300'}>{entry.label} {entry.diff > 0 ? '+' : ''}{entry.diff}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {before ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-950/45 p-2">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">Before</div>
            <StatMiniLine source={runeStats(before)} base={runeStats(base || before)} />
          </div>
          <div className="rounded-lg bg-slate-950/45 p-2">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">After</div>
            <StatMiniLine source={runeStats(stats)} base={runeStats(base || stats)} />
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-slate-950/45 p-2">
          <StatMiniLine source={runeStats(stats)} base={runeStats(base || stats)} />
        </div>
      )}
    </div>
  );
}

function LegendCard({ legend }) {
  return (
    <div className="space-y-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Img src={portraitUrl(legend)} className="h-28 w-28 shrink-0 rounded-xl bg-slate-950 object-contain" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-200">New legend</span>
            <a href={legendUrl(legend.name)} className="text-xl font-bold text-white hover:underline">{legend.name}</a>
          </div>
          <div className="flex flex-wrap gap-2">
            {legend.weapons.map((weapon) => (
              <span key={weapon.weapon} className="flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-sm text-slate-100">
                <Img src={weaponIcon(weapon.icon)} className="h-5 w-5" />{weapon.label}
              </span>
            ))}
          </div>
          <div className="max-w-xs text-slate-100"><StatMiniLine source={runeStats(legend.stats)} base={runeStats(legend.stats)} /></div>
          {legend.signatureParts > 0 && <div className="text-xs text-slate-400">{plural(legend.signatureParts, 'signature power')} added</div>}
        </div>
      </div>
      {legend.stances?.length > 1 && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Stances</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2">
            {legend.stances.map((stance) => (
              <StanceCard
                key={stance.name}
                name={stance.name}
                icon={stance.icon}
                iconFile={stance.iconFile}
                stats={stance.stats}
                base={legend.stats}
                tone={/^super|challenge/i.test(stance.name) ? 'amber' : 'slate'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MapTile({ map, note, size = 'large' }) {
  if (size === 'small') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-1 pr-2 text-xs text-slate-100">
        {mapThumb(map) ? <Img src={mapThumb(map)} className="h-8 w-14 rounded object-cover" /> : <span className="h-8 w-14 rounded bg-slate-800" />}
        {map.displayName}
      </span>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60">
      {mapThumb(map) ? <Img src={mapThumb(map)} className="h-24 w-full object-cover" /> : <div className="h-24 w-full bg-slate-800" />}
      <div className="p-2">
        <div className="text-sm font-bold text-white">{map.displayName}</div>
        {note && <div className="text-xs text-slate-400">{note}</div>}
      </div>
    </div>
  );
}

function Chips({ items, tone = 'slate' }) {
  const colors = { emerald: 'bg-emerald-500/15 text-emerald-100', rose: 'bg-rose-500/15 text-rose-100', slate: 'bg-slate-800 text-slate-200' };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => <span key={`${typeof item === 'string' ? item : index}-${index}`} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${colors[tone]}`}>{item}</span>)}
    </div>
  );
}

function LegendFace({ legend, highlight }) {
  const tones = { added: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40', removed: 'bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/40' };
  return (
    <a href={legendUrl(legend.name)} title={legend.name} className={`flex w-16 flex-col items-center gap-1 rounded-lg p-1 text-[11px] ${tones[highlight] || 'text-slate-300'}`}>
      <Img src={portraitUrl(legend)} className="h-12 w-12 rounded-lg bg-slate-950 object-contain" />
      <span className="w-full truncate text-center">{legend.name}</span>
    </a>
  );
}

function RotationBlock({ rotation }) {
  const added = new Set(rotation.added.map((legend) => legend.code));
  const removed = new Set(rotation.removed.map((legend) => legend.code));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div>
        <div className="mb-1 text-xs text-slate-400">Free now <span className="text-emerald-300">(green = new this patch)</span></div>
        <div className="flex flex-wrap gap-1">{rotation.legends.map((legend) => <LegendFace key={legend.code} legend={legend} highlight={added.has(legend.code) ? 'added' : ''} />)}</div>
      </div>
      {rotation.previous?.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-slate-400">Free before <span className="text-rose-300">(red = no longer free)</span></div>
          <div className="flex flex-wrap gap-1 opacity-90">{rotation.previous.map((legend) => <LegendFace key={legend.code} legend={legend} highlight={removed.has(legend.code) ? 'removed' : ''} />)}</div>
        </div>
      )}
    </div>
  );
}

function Highlights({ notes }) {
  const rankedPools = notes.maps.pools.filter((pool) => pool.ranked);
  const newModes = notes.modes.filter((mode) => mode.type === 'added');
  const hasAny = notes.legends.added.length || notes.maps.added.length || notes.events.length || notes.rotation || rankedPools.length || newModes.length;
  if (!hasAny) return null;
  return (
    <Section id="highlights" title="Highlights">
      {notes.legends.added.map((legend) => <LegendCard key={legend.code} legend={legend} />)}
      {notes.maps.added.length > 0 && (
        <div>
          <Heading>New maps</Heading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
            {notes.maps.added.map((map) => <MapTile key={map.name} map={map} />)}
          </div>
        </div>
      )}
      {(notes.events.length > 0 || newModes.length > 0) && (
        <div>
          <Heading>Events and modes</Heading>
          <Chips items={[
            ...notes.events.map((event) => (
              <>
                {event.currency && <Img src={currencyUrl('special', event.currency)} className="h-4 w-4 object-contain" />}
                {event.name}
              </>
            )),
            ...newModes.map((mode) => `New mode: ${mode.name}`),
          ]} />
        </div>
      )}
      {rankedPools.length > 0 && (
        <div>
          <Heading>Ranked map pool</Heading>
          <div className="space-y-2">
            {rankedPools.map((pool) => (
              <div key={pool.name} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="mr-1 font-bold text-white">{pool.displayName}</span>
                {pool.added.map((map) => <span key={`in-${map.name}`} className="inline-flex items-center gap-1 text-emerald-200">+ <MapTile map={map} size="small" /></span>)}
                {pool.removed.map((map) => <span key={`out-${map.name}`} className="inline-flex items-center gap-1 text-rose-200">− <MapTile map={map} size="small" /></span>)}
              </div>
            ))}
          </div>
        </div>
      )}
      {notes.rotation && (
        <div>
          <Heading>Free legend rotation</Heading>
          <RotationBlock rotation={notes.rotation} />
        </div>
      )}
    </Section>
  );
}

function BalanceSection({ notes }) {
  const [filter, setFilter] = useState('');
  const { summary, weapons, legends, visual, gadgets } = notes.balance;
  const options = useMemo(() => [
    ...weapons.map((group) => ({ value: `w:${group.weapon}`, label: group.label })),
    ...legends.map((group) => ({ value: `l:${group.hero.code}`, label: group.hero.name })),
  ], [weapons, legends]);
  if (!summary.moves && !visual.length && !gadgets.length) return null;
  const matches = (move) => {
    if (!filter) return true;
    const [kind, value] = filter.split(':');
    return kind === 'w' ? move.weapon === value : move.hero?.code === value;
  };
  const weaponGroups = weapons.map((group) => ({ ...group, moves: group.moves.filter(matches) })).filter((group) => group.moves.length);
  const legendGroups = legends.map((group) => ({ ...group, moves: group.moves.filter(matches) })).filter((group) => group.moves.length);
  return (
    <Section id="balance" title="Balance changes" count={summary.moves} subtitle="Every attack whose numbers changed. Buff and nerf only where the direction is clear; hitbox position, angle and timing tweaks show as changed.">
      <div className="flex max-w-5xl flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {summary.buff > 0 && <Pill label="Buffs" value={summary.buff} tone="emerald" />}
          {summary.nerf > 0 && <Pill label="Nerfs" value={summary.nerf} tone="rose" />}
          {summary.mixed > 0 && <Pill label="Mixed" value={summary.mixed} tone="sky" />}
          {summary.changed > 0 && <Pill label="Changed" value={summary.changed} tone="amber" />}
        </div>
        {options.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Show only
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white">
              <option value="">Everything</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {weaponGroups.length > 0 && (
        <div className="space-y-3">
          <Heading>Weapons <span className="font-normal normal-case text-slate-400">· affects every legend using them</span></Heading>
          {weaponGroups.map((group) => (
            <div key={group.weapon}>
              <div className="mb-2 flex items-center gap-2 font-bold text-white"><Img src={weaponIcon(group.icon)} className="h-7 w-7" />{group.label}</div>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">{group.moves.map((move) => <MoveCard key={move.key} move={move} />)}</div>
            </div>
          ))}
        </div>
      )}
      {legendGroups.length > 0 && (
        <div className="space-y-3">
          <Heading>Legends <span className="font-normal normal-case text-slate-400">· signature attacks</span></Heading>
          {legendGroups.map((group) => (
            <div key={group.hero.code}>
              <a href={legendUrl(group.hero.name)} className="mb-2 flex items-center gap-2 font-bold text-white hover:underline"><Img src={portraitUrl(group.hero)} className="h-8 w-8 rounded-lg bg-slate-950 object-contain" />{group.hero.name}</a>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">{group.moves.map((move) => <MoveCard key={move.key} move={move} showWeapon />)}</div>
            </div>
          ))}
        </div>
      )}
      {gadgets.length > 0 && !filter && (
        <div className="space-y-2">
          <Heading>Gadgets and items</Heading>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">{gadgets.map((move) => <MoveCard key={move.key} move={move} />)}</div>
        </div>
      )}
      {visual.length > 0 && !filter && (
        <details className="rounded-xl border border-slate-800 bg-black/10 p-2 text-sm text-slate-300">
          <summary className="cursor-pointer font-bold">{plural(visual.length, 'attack')} only got visual or sound updates</summary>
          <div className="mt-2 max-w-prose text-xs leading-relaxed text-slate-400">{visual.map((move) => move.name).join(' · ')}</div>
        </details>
      )}
    </Section>
  );
}

function ExperimentalSection({ notes }) {
  const { added, changed, removed, promoted } = notes.experimental;
  const experimentalMaps = notes.maps.experimental || [];
  if (!added.length && !changed.length && !removed.length && !promoted.length && !experimentalMaps.length) return null;
  return (
    <Section id="experimental" tone="violet" title="Experimental queue" subtitle="Only in the Experimental queue, not in normal matches.">
      {promoted.length > 0 && (
        <div>
          <Heading tone="text-violet-200">Now live from the Experimental queue</Heading>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">{promoted.map((move) => <MoveCard key={move.key} move={move} showWeapon />)}</div>
        </div>
      )}
      {added.length > 0 && (
        <div>
          <Heading tone="text-violet-200">Added for testing</Heading>
          <Chips items={added.map((move) => (
            <>
              {move.weaponIcon && <Img src={weaponIcon(move.weaponIcon)} className="h-4 w-4" />}
              {move.viewerUrl ? <a href={move.viewerUrl} className="hover:underline">{move.name}</a> : move.name}
            </>
          ))} />
        </div>
      )}
      {changed.length > 0 && (
        <div>
          <Heading tone="text-violet-200">Test versions adjusted</Heading>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">{changed.map((move) => <MoveCard key={move.key} move={move} showWeapon />)}</div>
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <Heading tone="text-violet-200">Removed from testing</Heading>
          <Chips items={removed.map((move) => move.name)} tone="rose" />
        </div>
      )}
      {experimentalMaps.length > 0 && (
        <div>
          <Heading tone="text-violet-200">Experimental maps</Heading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">{experimentalMaps.map((map) => <MapTile key={map.name} map={map} />)}</div>
        </div>
      )}
    </Section>
  );
}

function LegendsSection({ notes }) {
  const { changed, stances, removed } = notes.legends;
  if (!changed.length && !stances.length && !removed.length) return null;
  return (
    <Section id="legends" title="Legend Changes" subtitle="Stance stats, weapons and roster changes.">
      {changed.map((entry) => (
        <div key={entry.hero.code} className="flex max-w-4xl gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <Img src={portraitUrl(entry.hero)} className="h-12 w-12 rounded-lg bg-slate-950 object-contain" />
          <div>
            <a href={legendUrl(entry.hero.name)} className="font-bold text-white hover:underline">{entry.hero.name}</a>
            <ul className="mt-1 space-y-1">{entry.lines.map((line, index) => <Line key={index} line={line} />)}</ul>
          </div>
        </div>
      ))}
      {stances.map((entry) => (
        <div key={entry.hero.code} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <a href={legendUrl(entry.hero.name)} className="mb-2 flex items-center gap-2 font-bold text-white hover:underline">
            <Img src={portraitUrl(entry.hero)} className="h-10 w-10 rounded-lg bg-slate-950 object-contain" />{entry.hero.name}
          </a>
          <div className="grid gap-3 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">
            {entry.changes.map((change, index) => (
              <StanceCard
                key={index}
                name={change.stance}
                icon={change.icon}
                iconFile={change.iconFile}
                stats={change.after}
                before={change.type === 'changed' ? change.before : undefined}
                base={entry.base}
                tone={change.type === 'added' ? 'emerald' : 'amber'}
                label={change.type === 'added' ? 'New stance' : ''}
              />
            ))}
          </div>
        </div>
      ))}
      {removed.length > 0 && <Chips items={removed.map((hero) => `Removed: ${hero.name}`)} tone="rose" />}
    </Section>
  );
}

function MechanicsSection({ notes }) {
  const { stats, dodges, hurtboxes } = notes.mechanics;
  if (!stats.length && !dodges.length && !hurtboxes) return null;
  return (
    <Section id="mechanics" title="Game mechanics" subtitle="Changes that affect every legend: how stats scale, dodges and hurtboxes.">
      {stats.map((entry) => (
        <div key={entry.stat} className="max-w-4xl rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <div className="font-bold text-white">{entry.stat} scaling</div>
          <ul className="mt-1 space-y-1">{entry.lines.map((line, index) => <Line key={index} line={line} />)}</ul>
        </div>
      ))}
      {dodges.map((entry, index) => (
        <div key={index} className="max-w-4xl rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <div className="font-bold text-white">Dodges: {entry.names.join(', ')}</div>
          <ul className="mt-1 space-y-1">{entry.lines.map((line, lineIndex) => <Line key={lineIndex} line={line} />)}</ul>
        </div>
      ))}
      {hurtboxes && (
        <details className="max-w-4xl rounded-xl border border-slate-700 bg-slate-950/60 p-2 text-sm">
          <summary className="cursor-pointer font-bold text-white">
            {[
              hurtboxes.changed ? `Hurtboxes adjusted on ${plural(hurtboxes.changed, 'animation')}` : '',
              hurtboxes.added ? `${plural(hurtboxes.added, 'hurtbox', 'hurtboxes')} added` : '',
              hurtboxes.removed ? `${plural(hurtboxes.removed, 'hurtbox', 'hurtboxes')} removed` : '',
            ].filter(Boolean).join(' · ')}
          </summary>
          <p className="mt-1 text-xs text-slate-400">A hurtbox is the area where a legend can be hit during an animation.</p>
          {hurtboxes.names.length > 0 && <div className="mt-2 max-w-prose text-xs text-slate-400">{hurtboxes.names.join(' · ')}</div>}
        </details>
      )}
    </Section>
  );
}

function PoolTable({ pools }) {
  return (
    <div className="grid gap-2 xl:grid-cols-2 min-[137.5rem]:grid-cols-3">
      {pools.map((pool) => (
        <div key={pool.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-bold text-white">{pool.displayName}</span>
            <span className="text-xs text-slate-500">{pool.ranked ? 'Ranked · ' : ''}{pool.isNew ? 'New pool · ' : ''}{plural(pool.count, 'map')}</span>
          </div>
          {pool.added.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="w-8 text-xs font-bold text-emerald-300">In</span>
              {pool.added.map((map) => <MapTile key={`in-${map.name}`} map={map} size="small" />)}
            </div>
          )}
          {pool.removed.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="w-8 text-xs font-bold text-rose-300">Out</span>
              {pool.removed.map((map) => <MapTile key={`out-${map.name}`} map={map} size="small" />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MapsSection({ notes }) {
  const { pools, changed, removed } = notes.maps;
  const modes = notes.modes.filter((mode) => mode.type !== 'added');
  const mainPools = pools.filter((pool) => /^(Ranked|Standard|Tournament)/i.test(pool.name));
  const otherPools = pools.filter((pool) => !mainPools.includes(pool));
  if (!pools.length && !changed.length && !removed.length && !modes.length) return null;
  return (
    <Section id="maps" title="Maps and modes">
      {mainPools.length > 0 && <PoolTable pools={mainPools} />}
      {otherPools.length > 0 && (
        <details className="rounded-xl border border-slate-800 bg-black/10 p-2">
          <summary className="cursor-pointer text-sm font-bold text-slate-300">{plural(otherPools.length, 'more map pool')} for events and special modes</summary>
          <div className="mt-2"><PoolTable pools={otherPools} /></div>
        </details>
      )}
      {changed.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 min-[137.5rem]:grid-cols-3">
          {changed.map((map) => (
            <div key={map.name} className={`flex gap-3 rounded-xl border p-2 ${map.gameplay ? 'border-amber-400/30 bg-amber-500/5' : 'border-slate-700 bg-slate-950/60'}`}>
              {mapThumb(map) ? <Img src={mapThumb(map)} className="h-16 w-28 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-28 shrink-0 rounded-lg bg-slate-800" />}
              <div className="min-w-0">
                <div className="font-bold text-white">{map.displayName}</div>
                <ul className="mt-1 space-y-0.5">{map.lines.map((line, index) => <Line key={index} line={line} />)}</ul>
              </div>
            </div>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-rose-300">Removed maps</span>
          {removed.map((map) => <MapTile key={map.name} map={map} size="small" />)}
        </div>
      )}
      {modes.length > 0 && (
        <div className="space-y-2">
          <Heading>Game modes</Heading>
          {modes.map((mode, index) => (
            <div key={`${mode.name}-${index}`} className="max-w-prose text-sm">
              <span className="font-bold text-white">{mode.name}</span>
              {mode.type === 'removed' ? <span className="text-rose-200"> · removed</span> : <span className="text-slate-300"> · {mode.lines.map((line) => line.text).join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CosmeticTile({ group, item, imageFor, databaseUrlFor }) {
  const href = databaseUrlFor ? databaseUrlFor(group.file, item.data) : '';
  const Tag = href ? 'a' : 'div';
  const count = item.count > 1 ? ` ×${item.count}` : '';
  if (group.type === 'title') {
    return (
      <Tag href={href || undefined} className="flex min-h-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm font-bold leading-tight hover:border-slate-500" style={{ color: colorHex(item.data?.Color) }}>
        {item.name}{count}
      </Tag>
    );
  }
  if (group.type === 'splashArt') {
    const src = splashUrl(item.data);
    return (
      <Tag href={href || undefined} className="col-span-2 flex flex-col gap-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center hover:border-slate-600">
        {src ? <Img src={src} className="h-32 w-full object-contain" /> : <div className="h-32 w-full rounded bg-slate-800" />}
        <span className="text-[11px] leading-tight text-slate-200">{item.name}{count}</span>
      </Tag>
    );
  }
  const src = imageFor ? imageFor(group.file, item.data) : '';
  return (
    <Tag href={href || undefined} className="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center hover:border-slate-600">
      {src ? <Img src={src} className="h-16 w-16 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center text-[11px] text-slate-500">{group.label}</div>}
      <span className="line-clamp-2 text-[11px] leading-tight text-slate-200">{item.name}{count}</span>
    </Tag>
  );
}

function CosmeticsSection({ notes, imageFor, databaseUrlFor }) {
  const count = notes.cosmetics.reduce((sum, group) => sum + group.items.length, 0);
  if (!notes.cosmetics.length) return null;
  return (
    <Section id="cosmetics" title="New cosmetics" count={count}>
      {notes.cosmetics.map((group) => (
        <div key={group.type}>
          <Heading>{group.label} <span className="font-normal text-slate-400">{group.items.length || ''}</span></Heading>
          <div className={`grid gap-2 ${group.type === 'title' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 min-[112.5rem]:grid-cols-8 min-[137.5rem]:grid-cols-10' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 min-[112.5rem]:grid-cols-10 min-[137.5rem]:grid-cols-12'}`}>
            {group.items.map((item, index) => <CosmeticTile key={`${item.name}-${index}`} group={group} item={item} imageFor={imageFor} databaseUrlFor={databaseUrlFor} />)}
          </div>
          {group.renamed?.length > 0 && <div className="mt-2 max-w-prose text-xs text-slate-400">Renamed: {group.renamed.map((entry) => `${entry.from} → ${entry.to}`).join(', ')}</div>}
          {group.removed?.length > 0 && <div className="mt-1 max-w-prose text-xs text-rose-200">Removed: {group.removed.map((entry) => entry.name).join(', ')}</div>}
        </div>
      ))}
    </Section>
  );
}

function StoreItemTile({ item, storeImageFor, databaseUrlFor, children }) {
  const preview = storeImageFor ? storeImageFor(item.data) : null;
  const href = databaseUrlFor ? databaseUrlFor('Game/storeTypes.csv', item.data) : '';
  const Tag = href ? 'a' : 'div';
  return (
    <Tag href={href || undefined} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2 hover:border-slate-600">
      {preview?.type === 'image' && <Img src={preview.src} className="h-12 w-12 shrink-0 object-contain" />}
      {preview?.type === 'moniker' && <span className="flex h-12 w-12 shrink-0 items-center justify-center text-center text-[9px] font-bold leading-tight" style={{ color: preview.color }}>{preview.label}</span>}
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-white" title={item.name}>{item.name}</div>
        <div className="text-[11px] text-slate-500">{item.typeLabel}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">{children}</div>
      </div>
    </Tag>
  );
}

function StoreSection({ notes, storeImageFor, databaseUrlFor }) {
  const store = notes.store;
  if (!store || (!store.prices.length && !store.added.length && !store.removed.length)) return null;
  return (
    <Section id="store" title="Store">
      {store.prices.length > 0 && (
        <div className="space-y-3">
          <Heading>Price changes</Heading>
          {store.prices.map((entry, index) => (
            <div key={index} className="rounded-xl border border-slate-800 bg-black/10 p-2">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                {entry.before !== '0' && <Price value={entry.before} icon={entry.icon} currency={entry.currencyType} label={entry.currency} strike />}
                <span className="text-slate-500">→</span>
                {entry.after !== '0'
                  ? <Price value={entry.after} icon={entry.icon} currency={entry.currencyType} label={entry.currency} tone={entry.verdict === 'cheaper' ? 'text-emerald-200' : entry.verdict === 'pricier' ? 'text-rose-200' : 'text-amber-100'} />
                  : <span className="text-rose-200">no longer sold for {entry.currency}</span>}
                <span className="text-xs text-slate-500">{plural(entry.items?.length || entry.names.length, 'item')}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
                {(entry.items || []).map((item, itemIndex) => <StoreItemTile key={`${item.id}-${itemIndex}`} item={item} storeImageFor={storeImageFor} databaseUrlFor={databaseUrlFor} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {store.added.map((group) => (
        <div key={group.group}>
          <Heading>New in the store: {group.group}</Heading>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
            {group.items.map((item, index) => (
              <StoreItemTile key={`${item.id}-${index}`} item={item} storeImageFor={storeImageFor} databaseUrlFor={databaseUrlFor}>
                {(item.prices || []).map((price) => <Price key={`${price.field}-${price.currency || ''}`} value={price.value} icon={price.icon} currency={price.currency} label={price.label} />)}
              </StoreItemTile>
            ))}
          </div>
        </div>
      ))}
      {store.removed.length > 0 && (
        <div>
          <Heading tone="text-rose-200">Leaving the store</Heading>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
            {store.removed.flatMap((group) => group.items).map((item, index) => <StoreItemTile key={`${item.id}-${index}`} item={item} storeImageFor={storeImageFor} />)}
          </div>
        </div>
      )}
    </Section>
  );
}

function OtherSection({ notes, onOpenFull }) {
  const { other, engine, tutorials } = notes;
  const unused = notes.balance.unusedSignatures;
  const unusedCount = unused.added + unused.changed + unused.removed;
  if (!other.length && !engine.files && !tutorials.files && !unusedCount && !notes.maps.migratedFiles) return null;
  return (
    <Section id="other" title="Everything else" defaultOpen={false} subtitle="Smaller content and file changes. Every value is in the full data diff.">
      {other.length > 0 && (
        <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">
          {other.map((file) => (
            <li key={file.path} className="flex justify-between gap-3 rounded-lg bg-black/20 px-3 py-1.5">
              <span className="text-slate-200">{file.label}</span>
              <span className="text-xs text-slate-400">{[file.added && `${file.added} added`, file.changed && `${file.changed} changed`, file.removed && `${file.removed} removed`].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1 text-xs text-slate-400">
        {tutorials.files > 0 && <li>{plural(tutorials.files, 'tutorial lesson')} updated.</li>}
        {unusedCount > 0 && <li>{plural(unusedCount, 'old unused signature entry', 'old unused signature entries')} cleaned up in the game data.</li>}
        {notes.maps.migratedFiles > 0 && <li>{plural(notes.maps.migratedFiles, 'map file')} moved to a new format without changes to the maps.</li>}
        {engine.files > 0 && <li>{plural(engine.files, 'animation and asset file')} changed ({engine.changes} entries). These are art and engine data, not gameplay.</li>}
      </ul>
      {onOpenFull && <button type="button" onClick={onOpenFull} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-100 hover:bg-slate-700">Open the full data diff</button>}
    </Section>
  );
}

export function patchContents(notes) {
  if (!notes || notes.empty) return [];
  return [
    ['highlights', 'Highlights', notes.legends.added.length || notes.maps.added.length || notes.events.length || notes.rotation || notes.maps.pools.some((pool) => pool.ranked)],
    ['balance', `Balance${notes.balance.summary.moves ? ` (${notes.balance.summary.moves})` : ''}`, notes.balance.summary.moves || notes.balance.visual.length || notes.balance.gadgets.length],
    ['experimental', 'Experimental', notes.counts.experimental || notes.experimental.promoted.length || notes.maps.experimental?.length],
    ['legends', 'Legends', notes.legends.changed.length || notes.legends.stances.length || notes.legends.removed.length],
    ['mechanics', 'Mechanics', notes.mechanics.stats.length || notes.mechanics.dodges.length || notes.mechanics.hurtboxes],
    ['maps', 'Maps & modes', notes.maps.pools.length || notes.maps.changed.length || notes.maps.removed.length || notes.modes.some((mode) => mode.type !== 'added')],
    ['cosmetics', `Cosmetics${notes.counts.cosmetics ? ` (${notes.counts.cosmetics})` : ''}`, notes.cosmetics.length],
    ['store', 'Store', notes.store && (notes.store.prices.length || notes.store.added.length || notes.store.removed.length)],
    ['other', 'Everything else', notes.other.length || notes.engine.files || notes.tutorials.files],
  ].filter(([, , show]) => show);
}

function Contents({ notes }) {
  const entries = patchContents(notes);
  if (entries.length < 2) return null;
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 app-scrollbar 2xl:hidden" aria-label="Sections">
      {entries.map(([id, label]) => (
        <a key={id} href={`#${id}`} className="shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500">{label}</a>
      ))}
    </nav>
  );
}

export function usePatchNotes(manifest, from) {
  const [state, setState] = useState({ notes: null, loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!manifest) return undefined;
    let cancelled = false;
    setState({ notes: null, loading: true, error: '' });
    const query = from ? `?from=${encodeURIComponent(from)}` : '';
    fetch(`${host}/game/history/${manifest}/notes${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Patch notes request failed: ${res.status}`);
        return res.json();
      })
      .then((notes) => { if (!cancelled) setState({ notes, loading: false, error: '' }); })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ notes: null, loading: false, error: "Couldn't load these patch notes." });
      });
    return () => { cancelled = true; };
  }, [manifest, from, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

export default function PatchNotes({ notes, imageFor, storeImageFor, databaseUrlFor, onOpenFull }) {
  if (!notes) return null;
  if (notes.empty) {
    return (
      <div className="max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-300">
        No game data changed. Probably a client, art or server update.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Contents notes={notes} />
      <Highlights notes={notes} />
      <BalanceSection notes={notes} />
      <ExperimentalSection notes={notes} />
      <LegendsSection notes={notes} />
      <MechanicsSection notes={notes} />
      <MapsSection notes={notes} />
      <CosmeticsSection notes={notes} imageFor={imageFor} databaseUrlFor={databaseUrlFor} />
      <StoreSection notes={notes} storeImageFor={storeImageFor} databaseUrlFor={databaseUrlFor} />
      <OtherSection notes={notes} onOpenFull={onOpenFull} />
    </div>
  );
}
