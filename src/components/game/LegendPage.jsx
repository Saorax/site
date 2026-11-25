import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import '../../../fonts/style.css';
import { host } from "../../stuff";
import { ImageWithLoader, LoadingSpinner } from "./database/comp/LoadingImage";
import { commonPowerFieldMessage, summarizeCommonPowerFields } from "./powerHistorySummary";
import { StatMiniLine, statPipIcon, stats, statValue } from "./stanceStats";
import { PlayersTab, WhoPlaysCard } from "./legendPlayers";
import { ScrollX, ChainPill, ChainStages, DataViewToggle, EmptyState, ErrorState, FullOnly, LoadingState, PageShell, Pill, PriceList, RawData, Section as KitSection, SelectInput, ShowFullData, SourceLine, SourceList, Tabs, firstPatchNumber, groupChains, hasSources, sortSourceFilterValues, sourceFilterValues, useChainLookup, useDataView, useQueryState, weaponName } from "../ui";

const historyPatchName = (entry) => {
  const patch = firstPatchNumber(entry?.patch, entry?.version);
  return patch ? `Patch ${patch}` : "Unnumbered update";
};

const apiAsset = (src) => typeof src === 'string' && src.startsWith('/game/') ? `${host}${src}` : src;
const clean = (value) => value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '--';
const asArray = (value) => !value ? [] : Array.isArray(value) ? value : [value];

const LangContext = createContext({});
const resolveLang = (value, lang) => {
  const text = String(value ?? '').trim();
  return (text && lang?.[text]) || value;
};
const resolveKeyField = (field, lang) => (/Key$/.test(String(field?.field || ''))
  ? { ...field, before: resolveLang(field.before, lang), after: resolveLang(field.after, lang) }
  : field);

const tabs = [
  { key: 'main', label: 'Main' },
  { key: 'weapons', label: 'Weapons & Signatures' },
  { key: 'skins', label: 'Skins' },
  { key: 'players', label: 'Players' },
  { key: 'history', label: 'History' },
];

function normalizeString(input) {
  return String(input || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isBetaLegend(legend) {
  return !!legend?.beta?.isBeta || asArray(legend?.tags).includes('beta') || String(legend?.id || '').startsWith('beta-');
}

function releaseDateValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 100000000000 ? numeric * 1000 : numeric;
}

function formatDate(value, includeAgo = false) {
  const ms = releaseDateValue(value) || Date.parse(value || '');
  if (!ms) return 'Unknown';
  const formatted = new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  if (!includeAgo) return formatted;
  const days = Math.max(0, Math.round((Date.now() - ms) / (1000 * 3600 * 24)));
  return `${formatted} (${days} days ago)`;
}

function weaponIcon(weapon) {
  return `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon}`;
}

function legendHref(legend) {
  return `/game/legends/${normalizeString(legend?.bio?.name?.normal)}`;
}

function displayWeaponName(value) {
  return weaponName(value);
}

function skinTitle(skin) {
  return skin?.name || (Number(skin?.index) === 0 ? 'Default' : skin?.codeName);
}

function displayFieldName(value) {
  return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^Weight$/, 'Defense');
}

function formatDefineLabel(base) {
  if (!base) return '';
  const lower = String(base).toLowerCase();
  let suffix = '';
  let suffixLen = 0;
  if (lower.endsWith('acc')) {
    suffix = 'Accessory';
    suffixLen = 3;
  } else if (lower.endsWith('lt')) {
    suffix = 'Light';
    suffixLen = 2;
  } else if (lower.endsWith('dk')) {
    suffix = 'Dark';
    suffixLen = 2;
  } else if (lower.endsWith('vl')) {
    suffix = 'Very Light';
    suffixLen = 2;
  } else if (lower.endsWith('vd')) {
    suffix = 'Very Dark';
    suffixLen = 2;
  }
  let root = suffixLen ? String(base).slice(0, -suffixLen) : String(base);
  let isRight = false;
  if (root.length > 1 && root[0] === 'R' && root[1] === root[1].toUpperCase()) {
    isRight = true;
    root = root.slice(1);
  }
  const human = root.replace(/([A-Za-z]+)(\d+)/g, '$1 $2').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return [isRight ? 'Right' : '', human || base, suffix].filter(Boolean).join(' ');
}

function hex(value, fallback = '#334155') {
  if (!clean(value)) return fallback;
  const text = String(value).trim();
  if (text.startsWith('#')) return text;
  if (text.startsWith('0x')) return `#${text.slice(2)}`;
  return text.length === 6 ? `#${text}` : fallback;
}

function textColor(background) {
  const value = hex(background).replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return ((r * 299 + g * 587 + b * 114) / 1000) > 145 ? '#0f172a' : '#f8fafc';
}

function Section({ title, count, children, action }) {
  return <KitSection title={title} count={count} actions={action} headingAs="h2">{children}</KitSection>;
}

function InfoChip({ label, value }) {
  if (!clean(value)) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function TagChips({ tags }) {
  const visible = [...new Set(asArray(tags).filter(clean))];
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((tag) => <Pill key={tag} tone="blue">{tag}</Pill>)}
    </div>
  );
}

function StatViewer({ legend, activeStance, setActiveStance }) {
  if (!legend?.stances) {
    return (
      <Section title="Stances">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-sm font-bold text-amber-200">
          No stance data for this beta legend yet.
        </div>
      </Section>
    );
  }

  const base = legend.stances;
  const normalStances = [
    { key: 'base', label: 'Base', data: base },
    { key: 'str', label: 'Strength', data: legend.stances.stanceChanges?.str },
    { key: 'dex', label: 'Dexterity', data: legend.stances.stanceChanges?.dex },
    { key: 'def', label: 'Defense', data: legend.stances.stanceChanges?.def },
    { key: 'spe', label: 'Speed', data: legend.stances.stanceChanges?.spe },
  ].filter((stance) => stance.key === 'base' || stance.data);

  const superStances = [
    { key: 'superStr', label: 'Super Strength', data: legend.stances.superStanceChanges?.str || legend.stances.stanceChanges?.superStr },
    { key: 'superDex', label: 'Super Dexterity', data: legend.stances.superStanceChanges?.dex || legend.stances.stanceChanges?.superDex },
    { key: 'superDef', label: 'Super Defense', data: legend.stances.superStanceChanges?.def || legend.stances.stanceChanges?.superDef },
    { key: 'superSpe', label: 'Super Speed', data: legend.stances.superStanceChanges?.spe || legend.stances.stanceChanges?.superSpe },
    { key: 'challenge', label: 'Challenge', data: legend.stances.challenge || legend.stances.stanceChanges?.challenge },
  ].filter((stance) => stance.data);

  const allStances = [...normalStances, ...superStances];
  const current = allStances.find((stance) => stance.key === activeStance) || allStances[0];
  const selectStance = (key) => setActiveStance(activeStance === key && key !== 'base' ? 'base' : key);

  return (
    <Section
      title="Stances"
      action={<span className="rounded-lg px-2 py-1 text-xs font-black bg-slate-950 text-slate-300">{current?.label}</span>}
    >
      <div className="flex flex-wrap gap-2">
        {normalStances.map((stance) => (
          <button key={stance.key} onClick={() => selectStance(stance.key)} className={`${current?.key === stance.key ? 'border-blue-400 bg-blue-500 text-white' : 'hover:border-blue-300 border-slate-700 bg-slate-950 text-slate-100'} rounded-xl border px-3 py-2 text-sm font-black transition`}>
            {stance.label}
          </button>
        ))}
      </div>

      {!!superStances.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {superStances.map((stance) => (
            <button key={stance.key} onClick={() => selectStance(stance.key)} className={`${current?.key === stance.key ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200'} rounded-xl border px-3 py-2 text-sm font-black transition`}>
              {stance.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2">
        {stats.map((stat) => {
          const value = statValue(current?.data, stat);
          const baseValue = statValue(base, stat);
          return (
            <div key={stat.key} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
              <img src={stat.icon} className="h-7 w-8 object-contain" alt={stat.label} />
              <div className="flex min-w-0">
                {Array.from({ length: 10 }, (_, index) => (
                  <img key={index} src={`/game/${statPipIcon(value, baseValue, index)}.png`} className="h-7 w-6 shrink-0 object-fill" alt="" aria-hidden="true" />
                ))}
              </div>
              <div className="text-right text-lg font-black text-white">{value}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function HomeStages({ legend }) {
  const { full } = useDataView();
  const fallbackStages = String(legend?.home || '').split(',').map((name) => name.trim()).filter(Boolean);
  const stages = asArray(legend?.homeStages).length
    ? asArray(legend.homeStages)
    : fallbackStages.map((name) => ({ name, displayName: name }));
  if (!stages.length) return null;

  return (
    <Section title="Home">
      <div className="grid gap-3 sm:grid-cols-2">
        {stages.map((stage) => (
          <a
            key={stage.name}
            title={stage.name}
            href={`/game/maps?name=${encodeURIComponent(stage.name)}`}
            className="group overflow-hidden rounded-xl border transition hover:border-blue-400 border-slate-800 bg-slate-950/70"
          >
            {stage.image && (
              <img
                src={apiAsset(stage.image)}
                alt={stage.displayName || stage.name}
                className="aspect-video w-full object-cover transition group-hover:scale-[1.02] bg-slate-900"
                loading="lazy"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="p-3">
              <div className="text-base font-black text-white">{stage.displayName || stage.name}</div>
              {full && stage.displayName && stage.displayName !== stage.name && <div className="mt-0.5 text-xs font-bold text-slate-400">{stage.name}</div>}
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

function HeroHeader({ legend, prevLegends, nextLegends }) {
  const weapons = [legend?.weapons?.main, legend?.weapons?.secondary].filter((weapon) => clean(weapon?.name));
  const beta = isBetaLegend(legend);
  const headerTags = asArray(legend?.missionTagsFull || legend?.missionTags).slice(2);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-sm">
      <div className="grid gap-3 p-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-col gap-2">
            {weapons.map((weapon) => (
              <img key={weapon.name} src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-16 w-16 object-contain drop-shadow" alt={weapon.name} />
            ))}
          </div>
          {legend?.image && (
            <div className="flex h-36 w-36 items-end justify-center rounded-xl bg-slate-950/60 p-2">
              <img src={apiAsset(legend.image)} className="h-full w-auto object-contain drop-shadow-xl" alt={legend?.bio?.name?.normal} />
            </div>
          )}
        </div>

        <div className="min-w-0 text-center lg:text-left">
          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {beta && <Pill tone="amber">Beta</Pill>}
            {weapons.map((weapon) => <Pill key={weapon.name} tone="blue">{displayWeaponName(weapon.name)}</Pill>)}
            <TagChips tags={headerTags} />
          </div>
          <div className="mt-2 text-xs font-bold uppercase tracking-wide text-blue-300">{legend?.bio?.aka || legend?.codeName || 'Legend'}</div>
          <h1 style={{ fontFamily: 'BHLatinBold, BHSlim, sans-serif' }} className="mt-1 break-words text-4xl leading-none text-white sm:text-5xl">{legend?.bio?.name?.normal || legend?.codeName}</h1>
          {clean(legend?.codeName) && (
            <FullOnly>
              <div className="mt-2 font-mono text-xs font-bold text-slate-500">
                {legend.codeName}
              </div>
            </FullOnly>
          )}
          <div className="mt-2 text-base font-bold text-slate-200 sm:text-lg">
            {beta ? 'First Seen' : 'Released'}: {beta ? formatDate(legend?.beta?.firstSeen?.dateTime || legend?.beta?.firstSeen?.date) : formatDate(legend?.release, true)}
          </div>
          <LegendPrice legend={legend} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoChip label="Known As" value={legend?.known} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
            {weapons.map((weapon) => (
              <a key={weapon.name} href={`/game/combos?weapon=${encodeURIComponent(weapon.name)}&hero=${legend.id}`} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">{displayWeaponName(weapon.name)} combos</a>
            ))}
            {!beta && <a href={`/game/colors?hero=${encodeURIComponent(legend?.bio?.name?.normal || legend?.codeName)}`} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Colors</a>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:w-80">
          {prevLegends.slice(-1).map((item) => <MiniLegendLink key={item.id} legend={item} label="Previous" />)}
          {nextLegends.slice(0, 1).map((item) => <MiniLegendLink key={item.id} legend={item} label="Next" />)}
        </div>
      </div>
    </section>
  );
}

function legendPrices(legend) {
  const skins = asArray(legend?.skins);
  const base = skins.find((skin) => Number(skin?.index) === 0) || skins[0];
  const coins = Number(base?.cost?.coins);
  const mammothCoins = Number(base?.cost?.mammothCoins);
  return [
    coins > 0 ? { value: coins, currency: 'gold', showName: true } : null,
    mammothCoins > 0 ? { value: mammothCoins, currency: 'mc', showName: true } : null,
  ].filter(Boolean);
}

function LegendPrice({ legend }) {
  const prices = legendPrices(legend);
  if (!prices.length) return null;
  return (
    <div className="mt-2 flex justify-center lg:justify-start">
      <PriceList prices={prices} />
    </div>
  );
}

function MiniLegendLink({ legend, label }) {
  const weapons = [legend?.weapons?.main, legend?.weapons?.secondary].filter((weapon) => clean(weapon?.name));
  return (
    <a href={legendHref(legend)} className="flex items-center gap-2 rounded-xl border p-2 text-left transition hover:border-blue-400 border-slate-700 bg-slate-950 hover:bg-slate-800 lg:flex-col lg:gap-0 lg:text-center">
      {legend?.image && <img src={apiAsset(legend.image)} className="h-10 w-10 shrink-0 object-contain lg:hidden" alt="" />}
      <div className="min-w-0 lg:contents">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 hidden items-center justify-center gap-1.5 lg:flex">
        <div className="flex flex-col gap-1">
          {weapons.map((weapon) => (
            <img key={weapon.name} src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-6 w-6 object-contain" alt={weapon.name} />
          ))}
        </div>
        {legend?.image && <img src={apiAsset(legend.image)} className="h-16 w-16 object-contain" alt={legend?.bio?.name?.normal} />}
      </div>
      <div className="text-sm font-black leading-tight text-white lg:mt-1">{legend?.bio?.name?.normal}</div>
      <div className="mt-1 hidden text-[10px] font-black text-blue-200 lg:block">
        {formatDate(legend?.release)}
      </div>
      </div>
    </a>
  );
}

function Quotes({ legend }) {
  const quotes = [legend?.bio?.quote, legend?.bio?.quote2].filter((quote) => clean(quote?.text));
  if (!quotes.length) return null;
  return (
    <Section title="Quotes">
      <div className="grid gap-3">
        {quotes.map((quote, index) => (
          <div key={index} className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
            <p className="text-lg font-bold italic text-white">"{quote.text}"</p>
            {clean(quote.attrib) && <p className="mt-2 text-right text-sm font-black text-slate-400">{quote.attrib}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Biography({ legend }) {
  return (
    <Section title="Biography">
      {clean(legend?.bio?.text) ? (
        <div className="max-w-prose space-y-3 text-base font-semibold leading-relaxed text-slate-300">
          {String(legend.bio.text).split(/\r?\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-sm font-bold text-amber-200">
          No biography for this beta legend yet.
        </div>
      )}
    </Section>
  );
}

function signatureAnimationName(animation) {
  const displayName = String(animation?.displayName ?? '').trim();
  return clean(displayName) ? displayName : 'Normal';
}

const speedLabels = { fast: 'Fast', medium: 'Medium', slow: 'Slow' };
const speedTones = { fast: 'text-emerald-300', medium: 'text-slate-300', slow: 'text-amber-300' };
const frameCount = (value) => (value === null || value === undefined ? '–' : `${value} ${Number(value) === 1 ? 'frame' : 'frames'}`);

function SignatureNumber({ label, value, note, noteClass = 'text-slate-400', title }) {
  return (
    <div title={title} className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-1.5 py-1 sm:px-2">
      <div className="truncate text-[10px] font-bold uppercase tracking-normal text-slate-400 sm:tracking-wide">{label}</div>
      <div className="text-sm font-black leading-tight tabular-nums text-white">{value}</div>
      {note && <div className={`text-[11px] font-bold leading-tight ${noteClass}`}>{note}</div>}
    </div>
  );
}

function SignatureNumbers({ frames }) {
  if (!frames) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      <SignatureNumber
        label="Startup"
        value={frameCount(frames.startup)}
        note={[speedLabels[frames.speed], frames.projectile ? 'projectile' : ''].filter(Boolean).join(', ')}
        noteClass={speedTones[frames.speed]}
        title="First frame the move can hit, at minimum charge"
      />
      <SignatureNumber
        label="Damage"
        value={frames.damage ?? frames.biggestHit ?? '–'}
        note={frames.damage === undefined && frames.biggestHit != null ? 'biggest hit' : frames.chargedDamage ? `${frames.chargedDamage} fully charged` : ''}
        title="Base damage when every hit lands, at equal Strength and Defense"
      />
      <SignatureNumber
        label="Cooldown"
        value={frameCount(frames.cooldown)}
        note={frames.cooldownOnHit !== null && frames.cooldownOnHit !== frames.cooldown ? `${frames.cooldownOnHit} on hit` : ''}
        title="Time before this signature can be used again"
      />
    </div>
  );
}

const frameBranchLabels = { cast: '', miss: 'On miss', hit: 'On hit', release: 'On release', wall: 'On wall', interrupt: 'On interrupt', 'button-min': 'Min charge', 'button-max': 'Max charge', 'button-h': 'While held', background: 'Projectile' };

function frameBranchLabel(row) {
  if (row.via === 'BGPowerOnFire') return 'Projectile';
  if (row.branch?.startsWith('direction-')) return `Held ${row.branch.slice('direction-'.length).replace(/-/g, ' ')}`;
  return frameBranchLabels[row.branch] ?? row.branch;
}

function SignatureFrameData({ legend, weapons }) {
  const signatures = asArray(weapons).flatMap((weapon) => asArray(weapon.signatures).map((signature) => ({ ...signature, weaponSlot: weapon.slot, weaponName: weapon.name }))).filter((signature) => signature.frames);
  if (!signatures.length) return null;
  return (
    <Section title="Frame data" count={`${signatures.length} signatures`}>
      <p className="max-w-prose text-xs text-slate-400">Frames are 16 ms game ticks, counted from the button press at minimum charge. "Starts" follows the move when it misses, "on hit" when it connects. Damage, impulse and hitbox values are the raw power data, one value per cast.</p>
      {signatures.map((signature) => {
        const viewer = new Map(asArray(signature.powers).map((power) => [power.powerName, asArray(power.animations)[0]?.viewerUrl]));
        const combos = `/game/combos?tab=legend&legend=${encodeURIComponent(legend?.id)}&weapon=${signature.weaponSlot}`;
        return (
          <div key={`${signature.weaponSlot}:${signature.powerName}`} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-white">{displayWeaponName(signature.weaponName)} {signature.label}</h3>
              <span className="font-mono text-xs text-slate-500">{signature.powerName}</span>
              <a href={combos} className="text-xs font-bold text-blue-300 hover:text-blue-200">Combos</a>
            </div>
            <ScrollX className="rounded-lg border border-slate-800">
              <table className="w-full min-w-[64rem] text-xs">
                <thead>
                  <tr className="bg-slate-950/60 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-1">Power</th>
                    <th className="px-2 py-1">Branch</th>
                    <th className="px-2 py-1 text-right">Starts</th>
                    <th className="px-2 py-1 text-right">On hit</th>
                    <th className="px-2 py-1 text-right">First hit</th>
                    <th className="px-2 py-1">CastTime</th>
                    <th className="px-2 py-1">Recover</th>
                    <th className="px-2 py-1">Min charge</th>
                    <th className="px-2 py-1">Cooldown</th>
                    <th className="px-2 py-1">Damage</th>
                    <th className="px-2 py-1">Impulse</th>
                    <th className="px-2 py-1">Stun</th>
                    <th className="px-2 py-1">Hitbox</th>
                    <th className="px-2 py-1">Notes</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {asArray(signature.frames.powers).map((row) => (
                    <tr key={row.powerName} className="border-t border-slate-800 align-top">
                      <td className="px-2 py-1" style={{ paddingLeft: `${0.5 + row.depth * 0.75}rem` }}>
                        {viewer.get(row.powerName)
                          ? <a href={viewer.get(row.powerName)} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">{row.powerName}</a>
                          : <span className="text-slate-200">{row.powerName}</span>}
                      </td>
                      <td className="px-2 py-1 font-sans text-slate-300">{frameBranchLabel(row)}</td>
                      <td className="px-2 py-1 text-right text-slate-200">{row.missStart ?? '–'}</td>
                      <td className="px-2 py-1 text-right text-slate-200">{row.hitStart ?? '–'}</td>
                      <td className="px-2 py-1 text-right font-bold text-white">{row.firstHit ?? '–'}</td>
                      <td className="max-w-[10rem] break-all px-2 py-1 text-slate-300">{row.castTime || '–'}</td>
                      <td className="px-2 py-1 text-slate-300">{[row.fixedRecoverTime, row.recoverTime].filter(Boolean).join(' + ') || '–'}</td>
                      <td className="px-2 py-1 text-slate-300">{row.minChargeTime || '–'}</td>
                      <td className="px-2 py-1 text-slate-300">{row.cooldownTime ? `${row.cooldownTime}${row.onHitCooldownTime ? ` / ${row.onHitCooldownTime}` : ''}` : '–'}</td>
                      <td className="max-w-[8rem] break-all px-2 py-1 text-slate-300">{row.baseDamage || '–'}</td>
                      <td className="max-w-[8rem] break-all px-2 py-1 text-slate-300">{[row.fixedImpulse, row.variableImpulse].filter(Boolean).join(' / ') || '–'}</td>
                      <td className="max-w-[6rem] break-all px-2 py-1 text-slate-300">{row.fixedStunTime || '–'}</td>
                      <td className="max-w-[10rem] break-all px-2 py-1 text-slate-300">{row.aoeRadiusX || row.aoeRadiusY ? `${row.aoeRadiusX || '0'} × ${row.aoeRadiusY || '0'}` : '–'}</td>
                      <td className="max-w-[16rem] px-2 py-1 font-sans text-slate-400">{row.devNotes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>
        );
      })}
    </Section>
  );
}

function SignatureAnimationGroup({ signature }) {
  const available = useMemo(
    () => asArray(signature?.powers).flatMap((power) =>
      asArray(power?.animations).map((animation) => ({
        ...animation,
        powerName: power.powerName,
      }))
    ),
    [signature],
  );
  const [selectedKey, setSelectedKey] = useState(available[0]
    ? `${available[0].powerName}:${available[0].field}:${available[0].path}`
    : '');
  const [open, setOpen] = useState(true);
  const selected = available.find((animation) =>
    `${animation.powerName}:${animation.field}:${animation.path}` === selectedKey
  ) || available[0];

  useEffect(() => {
    const first = available[0];
    setSelectedKey(first
      ? `${first.powerName}:${first.field}:${first.path}`
      : '');
  }, [signature?.powerName]);

  if (!available.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`${open ? 'border-b border-slate-800' : ''} flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800/60`}
      >
        <span className="text-base font-black text-white">{signature.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`${open ? 'rotate-180' : ''} h-5 w-5 shrink-0 transition-transform text-slate-300`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && <div className="space-y-2 p-3">
        <SignatureNumbers frames={signature.frames} />
        <div className="rounded-xl border p-2 border-slate-800 bg-slate-950/80">
          <ImageWithLoader
            src={apiAsset(selected.animationUrl)}
            alt={selected.animation}
            eager
            className="h-72 rounded-lg bg-slate-900"
            imgClassName="h-full w-full object-contain"
          />
          <div className="mt-2 min-w-0">
            <div className="break-words text-sm font-black text-white">
              {signatureAnimationName(selected)}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a
              href={selected.viewerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border px-3 py-1.5 text-xs font-black border-slate-700 bg-slate-900 text-blue-300"
            >
              Full viewer
            </a>
          </div>
          {available.length > 1 && <div className="mt-2 flex flex-wrap gap-1.5">
            {asArray(signature.powers).flatMap((power) =>
              asArray(power.animations).map((animation) => {
                  const key = `${power.powerName}:${animation.field}:${animation.path}`;
                  const active = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`${active ? 'border-blue-400 bg-blue-500 text-white' : 'hover:border-blue-300 border-slate-700 bg-slate-900 text-slate-200'} min-w-0 rounded-lg border px-2 py-1.5 text-left`}
                    >
                      <span className="block max-w-56 break-words text-xs font-black">
                        {signatureAnimationName(animation)}
                      </span>
                    </button>
                  );
              })
            )}
          </div>}
        </div>
      </div>}
    </section>
  );
}

function SignaturePanel({ legend }) {
  const weapons = [
    { label: 'First Weapon', ...legend?.weapons?.main },
    { label: 'Second Weapon', ...legend?.weapons?.secondary },
  ].filter((weapon) => clean(weapon?.name));
  const [animationData, setAnimationData] = useState(null);
  const [animationError, setAnimationError] = useState('');
  const [animationLoading, setAnimationLoading] = useState(true);

  useEffect(() => {
    if (!legend?.id) return;
    const controller = new AbortController();
    setAnimationLoading(true);
    setAnimationError('');
    fetch(`${host}/game/legends/${encodeURIComponent(legend.id)}/animations`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Couldn't load the move data (${response.status})`);
        return response.json();
      })
      .then(setAnimationData)
      .catch((error) => {
        if (error.name !== 'AbortError') setAnimationError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnimationLoading(false);
      });
    return () => controller.abort();
  }, [legend?.id]);

  if (!weapons.length) return null;
  return (
    <>
    <Section title="Weapons & Signatures">
      <div className="grid gap-3 lg:grid-cols-2">
        {weapons.map((weapon, weaponIndex) => {
          const animationWeapon = asArray(animationData?.weapons).find((entry) => entry.slot === weaponIndex + 1);
          return (
          <div key={weapon.label} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2">
            <div className="flex items-center gap-3">
              <img src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-14 w-14 object-contain" alt={weapon.name} />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{weapon.label}</div>
                <div className="text-xl font-black text-white">{displayWeaponName(weapon.name)}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 min-[137.5rem]:grid-cols-2 min-[137.5rem]:items-start">
              {animationLoading ? (
                <div className="relative min-h-40 overflow-hidden rounded-xl bg-slate-900"><LoadingSpinner /></div>
              ) : animationError ? (
                <ErrorState message="Couldn't load the signature previews." detail={animationError} />
              ) : asArray(animationWeapon?.signatures).length ? (
                animationWeapon.signatures.map((signature) => (
                  <SignatureAnimationGroup key={signature.powerName} signature={signature} />
                ))
              ) : (
                [
                  ['Neutral Signature', weapon.sigNames?.nSig],
                  ['Side Signature', weapon.sigNames?.sSig],
                  ['Down Signature', weapon.sigNames?.dSig],
                ].map(([label, value]) => clean(value) && (
                  <div key={label} className="rounded-lg px-3 py-2 text-sm font-bold bg-slate-900">
                    <span className="text-slate-400">{label}: </span>
                    <span className="text-white">{value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          );
        })}
      </div>
    </Section>
    <FullOnly>
      <SignatureFrameData legend={legend} weapons={animationData?.weapons} />
    </FullOnly>
    </>
  );
}

function skinAnimationOptions(skin) {
  return {
    idle: skin?.animTypes?.idleOther || skin?.animTypes?.idle,
    lockIn: skin?.animTypes?.selectedOther || skin?.animTypes?.selected || skin?.SelectedAnimation,
  };
}

function skinAnimUrl(skin, animation = 'lockIn', playback = 'loop') {
  const heroId = skin?.HeroID;
  const skinInt = skin?.SkinInt ?? skin?.index;
  const options = skinAnimationOptions(skin);
  const selected = options[animation] || options.lockIn || options.idle;
  const frame = playback === 'full' ? 'all' : 'loop';
  if (clean(heroId) && clean(skinInt) && clean(selected)) {
    return `${host}/game/anim/char/${heroId}-${skinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${selected}/${frame}`;
  }
  return apiAsset(skin?.image);
}

function LoadingImage({ src, alt, className }) {
  return (
    <ImageWithLoader
      src={src}
      alt={alt}
      className="h-full w-full"
      imgClassName={className || 'max-h-full max-w-full object-contain'}
    />
  );
}

function storeIcon(type) {
  return `${host}/game/getGfx/storeIcon/${type}`;
}

function costBadges(skin) {
  const rows = [];
  const mammothCoins = Number(skin?.cost?.mammothCoins);
  const saleMammothCoins = Number(skin?.cost?.saleMammothCoins);
  const coins = Number(skin?.cost?.coins);
  const saleCoins = Number(skin?.cost?.saleCoins);
  if (clean(skin?.cost?.rarity)) rows.push({ label: skin.cost.rarity, tone: 'blue' });
  const priceBadge = (price, salePrice, tone, icon, title) => {
    if (price > 0) rows.push({ label: price, tone, icon, title, note: salePrice > 0 && salePrice < price ? `${salePrice} in sales` : null });
    else if (salePrice > 0) rows.push({ label: salePrice, tone, icon, title });
  };
  priceBadge(mammothCoins, saleMammothCoins, 'slate', storeIcon('mc'), 'Mammoth Coins');
  priceBadge(coins, saleCoins, 'gold', storeIcon('gold'), 'Gold');
  if (Number(skin?.cost?.glory) > 0) rows.push({ label: skin.cost.glory, tone: 'purple', icon: storeIcon('glory'), title: 'RankedPointsCost' });
  if (clean(skin?.timed?.eventType)) rows.push({ label: skin.timed.eventType, tone: 'rose' });
  if (clean(skin?.timed?.typeOfEvent)) rows.push({ label: skin.timed.typeOfEvent, tone: 'amber' });
  if (skin?.metadev === 'true' || skin?.metadev === true) rows.push({ label: 'Metadev', tone: 'emerald' });
  return rows;
}

const rarityNames = { EpicCrossover: 'Crossover' };

const skinChainName = (skin) => String(skin?.codeName || skin?.costumeData?.CostumeName || '').trim();

function rarityBadge(skin) {
  const rarity = clean(skin?.cost?.rarity);
  return rarity ? { label: rarityNames[rarity] || rarity, tone: 'blue' } : null;
}

function SkinSourceBadges({ skin, align = 'start' }) {
  const rarity = rarityBadge(skin);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rarity && <Badge badge={rarity} />}
      <SourceLine sources={skin.sources} align={align} max={3} />
    </div>
  );
}

function Badge({ badge }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-200',
    slate: 'bg-slate-700 text-slate-100',
    gold: 'bg-yellow-400/20 text-yellow-200',
    purple: 'bg-purple-500/10 text-purple-200',
    rose: 'bg-rose-500/10 text-rose-200',
    amber: 'bg-amber-500/10 text-amber-200',
    emerald: 'bg-emerald-500/10 text-emerald-200',
  };
  return (
    <span title={badge.title} className={`${colors[badge.tone] || colors.slate} inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black`}>
      {badge.icon && <img src={badge.icon} className="h-4 w-4 object-contain" loading="lazy" alt="" />}
      <span>{badge.label}</span>
      {badge.note && <span className="font-semibold opacity-70" title="Price during store sales">· {badge.note}</span>}
    </span>
  );
}

function costFieldIcon(field) {
  if (/idol/i.test(field)) return storeIcon('mc');
  if (/gold/i.test(field)) return storeIcon('gold');
  if (/rankedpoints|glory/i.test(field)) return storeIcon('glory');
  return null;
}

function DataValue({ fieldKey, value }) {
  const icon = costFieldIcon(fieldKey);
  if (icon) {
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-sm font-black text-white">
        <img src={icon} className="h-5 w-5 object-contain" loading="lazy" alt="" />
        <span>{renderChangeValue(value)}</span>
        {/salecost/i.test(fieldKey) && <span className="text-xs font-semibold text-slate-400">during store sales</span>}
      </span>
    );
  }
  return <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-sm font-bold text-white">{renderChangeValue(value)}</pre>;
}

function DataGrid({ title, data }) {
  const rows = Object.entries(data || {}).filter(([_, value]) => clean(renderChangeValue(value)));
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-white">{title}</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="rounded-lg border p-2 border-slate-800 bg-slate-900">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{displayFieldName(key)}</div>
            <DataValue fieldKey={key} value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkinDefines({ skin }) {
  const source = { ...(skin?.pieces || {}), ...(skin?.costumeData || {}) };
  const defineRows = Object.entries(source).filter(([key, value]) => /_Define$/i.test(key) && clean(value));
  const swapRows = Object.entries(source).filter(([key, value]) => /_Swap$/i.test(key) && clean(value));
  if (!defineRows.length && !swapRows.length) return null;
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-white">Color Defines</h4>
      {!!defineRows.length && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {defineRows.map(([key, value]) => {
            const bg = hex(value);
            return (
              <div key={key} className="rounded-lg border border-slate-700 p-2 text-sm font-black" style={{ backgroundColor: bg, color: textColor(bg) }}>
                <div className="text-[10px] uppercase tracking-wide opacity-75">{formatDefineLabel(key.replace(/_Define$/i, ''))}</div>
                <div className="mt-1">{hex(value)}</div>
              </div>
            );
          })}
        </div>
      )}
      {!!swapRows.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {swapRows.map(([key, value]) => (
            <span key={key} className="rounded-lg px-2 py-1 text-xs font-black bg-slate-800 text-slate-100">
              {formatDefineLabel(key.replace(/_Swap$/i, ''))}: {formatDefineLabel(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPill({ color, label }) {
  if (!color) return null;
  const bg = hex(color.IndicatorColor);
  return (
    <div className="flex items-center gap-2 rounded-xl border p-2 border-slate-700" style={{ backgroundColor: bg, color: textColor(bg) }}>
      {color.IconName && <img src={`${host}/game/getGfx/UI_Icons/${color.IconName}`} className="h-9 w-9 object-contain" loading="lazy" alt="" />}
      <div className="min-w-0">
        {label && <div className="text-[10px] font-black uppercase tracking-wide opacity-75">{label}</div>}
        <div className="break-words text-sm font-black">{color.displayName || color.ColorSchemeName}</div>
      </div>
    </div>
  );
}

function SkinColors({ skin }) {
  const excluded = asArray(skin?.colors?.excludedData);
  const fallbackNames = String(skin?.colors?.excluded || '').split(',').map((entry) => entry.trim()).filter(clean);
  const hasColors = skin?.colors?.defaultData || excluded.length || fallbackNames.length || clean(skin?.colors?.default);
  if (!hasColors) return null;
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-white">Colors</h4>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Default / fallback</div>
          {skin?.colors?.defaultData ? <ColorPill color={skin.colors.defaultData} /> : clean(skin?.colors?.default) && <span className="rounded-lg px-2 py-1 text-xs font-black bg-slate-800">{skin.colors.default}</span>}
        </div>
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Excluded Color Schemes</div>
          <div className="flex flex-wrap gap-2">
            {excluded.length ? excluded.map((color) => <ColorPill key={color.ColorSchemeID || color.ColorSchemeName} color={color} />) : fallbackNames.map((name) => <span key={name} className="rounded-lg px-2 py-1 text-xs font-black bg-slate-800">{name}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function weaponDisplayData(weapon) {
  const allowed = new Set(['DisplayNameKey', 'InheritCostumeDefines']);
  return Object.fromEntries(Object.entries(weapon || {}).filter(([key]) => allowed.has(key) || /^CustomArt\d*$/i.test(key)));
}

function WeaponDetail({ weapon }) {
  const { full } = useDataView();
  const data = weaponDisplayData(weapon);
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
      <div className="flex items-center gap-3">
        <div className="flex h-28 w-36 shrink-0 items-center justify-center rounded-lg p-2 bg-slate-900">
          <ImageWithLoader
            src={`${host}/game/anim/weapon/${weapon?.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon?.BaseWeapon}Pose/all`}
            alt={weapon?.DisplayNameFull || weapon?.WeaponSkinName}
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 break-words text-lg font-black text-white">{weapon?.DisplayNameFull || weapon?.WeaponSkinName}</div>
            {full && clean(weapon?.WeaponSkinID) && (
              <div className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black bg-slate-800 text-slate-200">
                ID {weapon.WeaponSkinID}
              </div>
            )}
          </div>
          {full && clean(weapon?.WeaponSkinName) && <div className="mt-1 break-words font-mono text-xs font-bold text-slate-400">{weapon.WeaponSkinName}</div>}
        </div>
      </div>
      {full && <div className="mt-3">
        <div className="rounded-xl border p-2 border-slate-700 bg-slate-950/70">
          <h4 className="mb-3 text-base font-black text-white">Weapon Data</h4>
          <div className="grid gap-2">
            {Object.entries(data).filter(([_, value]) => clean(renderChangeValue(value))).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-2 border-slate-800 bg-slate-900">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{displayFieldName(key)}</div>
                <DataValue fieldKey={key} value={value} />
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}

function SkinModal({ skin, chain, onPick, onClose }) {
  const { full } = useDataView();
  const [animationMode, setAnimationMode] = useState('lockIn');
  const [playbackMode, setPlaybackMode] = useState('loop');
  useEffect(() => {
    if (!skin) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skin, onClose]);
  if (!skin) return null;
  const animationOptions = skinAnimationOptions(skin);
  const selectedAnimationMode = animationOptions[animationMode] ? animationMode : animationOptions.lockIn ? 'lockIn' : 'idle';
  const weapons = asArray(skin?.stuff?.WeaponSet2).filter((weapon) => !isStanceVariantRecord(weapon));
  const rawCostumeData = skin?.costumeData || {
    CostumeID: skin?.id,
    CostumeName: skin?.codeName,
    DisplayName: skin?.name,
    WeaponSet: skin?.stuff?.WeaponSet,
    ReplacementHeroName: skin?.stuff?.ReplacementHeroName,
    GfxType: skin?.gfx,
    ExcludeColorScheme: skin?.colors?.excluded,
    ForgivenessColorScheme: skin?.colors?.default,
  };
  const costumeData = Object.fromEntries(Object.entries(rawCostumeData).filter(([key]) => !/_(Define|Swap)$/i.test(key)));
  const rawStoreData = skin?.storeData || {
    Rarity: skin?.cost?.rarity,
    IdolCost: skin?.cost?.mammothCoins,
    IdolSaleCost: skin?.cost?.saleMammothCoins,
    GoldCost: skin?.cost?.coins,
    GoldSaleCost: skin?.cost?.saleCoins,
    RankedPointsCost: skin?.cost?.glory,
    TimedEvent: skin?.timed?.eventType,
    Label: skin?.timed?.typeOfEvent,
    DescriptionKey: skin?.description,
  };
  const storeData = rawStoreData;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[96rem] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wide text-blue-300">Skin #{Number(skin?.index || 0) + 1}</div>
            <h3 className="break-words text-2xl font-bold text-white sm:text-3xl">{skinTitle(skin)}</h3>
            {full && clean(skin?.codeName) && <div className="font-mono text-sm font-bold text-slate-400">{skin.codeName}</div>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <DataViewToggle size="sm" />
            <button type="button" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[26rem_1fr]">
          <div className="grid content-start gap-3">
            <ChainStages chain={chain} onPick={onPick} full={full} firstLabel="Base skin" />
            <div className="flex min-h-72 items-center justify-center rounded-xl p-3 bg-slate-950/70">
              <LoadingImage src={skinAnimUrl(skin, selectedAnimationMode, playbackMode)} className="max-h-full max-w-full object-contain" alt={skinTitle(skin)} />
            </div>
            <div className="grid gap-2 rounded-xl border p-2 border-slate-700 bg-slate-950/70">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['idle', 'Idle'],
                  ['lockIn', 'Lock-in'],
                ].map(([key, label]) => animationOptions[key] && (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnimationMode(key)}
                    className={`${selectedAnimationMode === key ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-100 hover:bg-slate-800'} rounded-lg px-3 py-2 text-xs font-black transition`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['loop', 'Loop'],
                  ['full', 'Full'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlaybackMode(key)}
                    className={`${playbackMode === key ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-100 hover:bg-slate-800'} rounded-lg px-3 py-2 text-xs font-black transition`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {hasSources(skin) ? (
              <div className="grid gap-2">
                {rarityBadge(skin) && <div><Badge badge={rarityBadge(skin)} /></div>}
                <h4 className="text-sm font-bold text-white">How to get</h4>
                <SourceList sources={skin.sources} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {costBadges(skin).map((badge) => <Badge key={`${badge.title || badge.label}-${badge.label}`} badge={badge} />)}
              </div>
            )}
            <TagChips tags={skin?.tagsFull || skin?.tags} />
            {!!weapons.length && (
              <div className="grid gap-3">
                <h4 className="text-base font-black text-white">Weapons</h4>
                {weapons.map((weapon) => <WeaponDetail key={weapon.WeaponSkinID || weapon.WeaponSkinName} weapon={weapon} />)}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <SkinDefines skin={skin} />
            <SkinColors skin={skin} />
            {full ? (
              <>
                <DataGrid title="Costume Data" data={costumeData} />
                <DataGrid title="Store Data" data={storeData} />
                <RawData data={skin} title="Raw skin data" filename={`skin-${skin?.id || skin?.codeName || 'data'}`} />
              </>
            ) : (
              <ShowFullData className="justify-self-start" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkinCard({ skin, chain, onSelect }) {
  const { full } = useDataView();
  const weapons = asArray(skin?.stuff?.WeaponSet2).slice(0, 2);
  return (
    <button type="button" onClick={() => onSelect(skin)} className="flex flex-col rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-left transition hover:border-blue-400 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-blue-300">Skin #{Number(skin?.index || 0) + 1}</div>
          <h3 className="break-words text-lg font-bold leading-tight text-white">{skinTitle(skin)}</h3>
          {full && clean(skin?.codeName) && <div className="font-mono text-xs font-bold text-slate-400">{skin.codeName}</div>}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        <div className="flex h-52 items-center justify-center rounded-lg bg-slate-900/70 p-2">
          <img src={skinAnimUrl(skin)} className="max-h-full max-w-full object-contain" loading="lazy" alt={skinTitle(skin)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {weapons.map((weapon) => (
            <div key={weapon.WeaponSkinID || weapon.WeaponSkinName} className="flex h-32 items-center justify-center rounded-lg bg-slate-900/70 p-1">
              <ImageWithLoader
                src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                alt={weapon.DisplayNameFull || weapon.WeaponSkinName}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
      {hasSources(skin) ? (
        <div className="mt-3"><SkinSourceBadges skin={skin} /></div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {costBadges(skin).map((badge) => <Badge key={badge.label} badge={badge} />)}
        </div>
      )}
      {chain && <div className="mt-2"><ChainPill chain={chain} /></div>}
      <div className="mt-3">
        <TagChips tags={skin?.tagsFull || skin?.tags} />
      </div>
    </button>
  );
}

function SkinsPage({ legend }) {
  const skins = asArray(legend?.skins);
  const [selectedSkin, setSelectedSkin] = useState(null);
  const chainLookup = useChainLookup(skins, skinChainName, (skin) => skin?.upgradesTo);
  const chainOf = (skin) => chainLookup.get(skinChainName(skin));
  const pickStage = (stage) => {
    const next = skins.find((skin) => skinChainName(skin) === stage.name);
    if (next) setSelectedSkin(next);
  };
  const [how, setHow] = useQueryState('how', '');
  const howCounts = useMemo(() => {
    const counts = {};
    for (const skin of skins) for (const value of sourceFilterValues(skin)) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, [skins]);
  const howValues = sortSourceFilterValues(Object.keys(howCounts));
  const activeHow = howCounts[how] ? how : '';
  const shown = groupChains(activeHow ? skins.filter((skin) => sourceFilterValues(skin).includes(activeHow)) : skins, chainOf);
  const total = groupChains(skins, chainOf).length;
  if (!skins.length) {
    return (
      <EmptyState title="No skins for this legend yet" />
    );
  }

  return (
    <div className="grid gap-3">
      <Section title="Skins" count={activeHow ? `${shown.length} of ${total}` : total}>
        {howValues.length > 1 && (
          <Tabs
            variant="chips"
            label="How to get"
            className="mb-3"
            value={activeHow}
            onChange={setHow}
            items={[{ value: '', label: 'All', count: total }, ...howValues.map((value) => ({ value, label: value, count: howCounts[value] }))]}
          />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
          {shown.map((skin) => <SkinCard key={skin?.id || skin?.codeName} skin={skin} chain={chainOf(skin)} onSelect={setSelectedSkin} />)}
        </div>
      </Section>
      <SkinModal skin={selectedSkin} chain={chainOf(selectedSkin)} onPick={pickStage} onClose={() => setSelectedSkin(null)} />
    </div>
  );
}

function renderChangeValue(value) {
  if (Array.isArray(value)) return value.map(renderChangeValue).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

function isEmptyChangeValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function isSimpleScalarChange(field) {
  return !field?.propertyAdded
    && !field?.propertyRemoved
    && !asArray(field?.addedValues).length
    && !asArray(field?.removedValues).length
    && !isEmptyChangeValue(field?.before)
    && !isEmptyChangeValue(field?.after)
    && typeof field?.before !== 'object'
    && typeof field?.after !== 'object';
}

function changeListValues(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function HighlightedListValue({ value, highlighted, color }) {
  const values = changeListValues(value);
  const marked = new Set(asArray(highlighted).map((item) => String(item)));
  return (
    <div className="flex flex-wrap gap-x-1 font-mono">
      {values.map((item, index) => (
        <React.Fragment key={`${item}-${index}`}>
          {index > 0 && <span>,</span>}
          <span className={marked.has(item) ? color : ''}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function ChangeFieldBody({ field, compact = false }) {
  const addedValues = asArray(field?.addedValues);
  const removedValues = asArray(field?.removedValues);
  if (field?.objectChanges?.length) {
    return (
      <div className="mt-2 grid gap-2">
        {field.objectChanges.map((change, index) => (
          <div key={`${change.path}-${index}`} className="rounded-lg p-2 font-mono text-xs bg-slate-950/50">
            <div className="mb-1 font-black">{change.path}</div>
            {change.addedValues?.length || change.removedValues?.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                <HighlightedListValue value={change.before} highlighted={change.removedValues} color="text-red-300" />
                <HighlightedListValue value={change.after} highlighted={change.addedValues} color="text-emerald-300" />
              </div>
            ) : change.propertyAdded ? (
              <pre className="whitespace-pre-wrap break-words font-black text-emerald-300">{renderChangeValue(change.after)}</pre>
            ) : change.propertyRemoved ? (
              <pre className="whitespace-pre-wrap break-words font-black text-red-300">{renderChangeValue(change.before)}</pre>
            ) : (
              <div>{renderChangeValue(change.before)} {'->'} {renderChangeValue(change.after)}</div>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (addedValues.length || removedValues.length) {
    return (
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-red-500/5 p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">Before</div>
          <HighlightedListValue value={field?.before} highlighted={removedValues} color="text-red-300" />
        </div>
        <div className="rounded-lg bg-emerald-500/5 p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">After</div>
          <HighlightedListValue value={field?.after} highlighted={addedValues} color="text-emerald-300" />
        </div>
      </div>
    );
  }
  if (field?.propertyAdded || (isEmptyChangeValue(field?.before) && !isEmptyChangeValue(field?.after))) {
    return <pre className="mt-1 whitespace-pre-wrap break-words font-mono font-black text-emerald-300">{renderChangeValue(field?.after)}</pre>;
  }
  if (field?.propertyRemoved || (!isEmptyChangeValue(field?.before) && isEmptyChangeValue(field?.after))) {
    return <pre className="mt-1 whitespace-pre-wrap break-words font-mono font-black text-red-300">{renderChangeValue(field?.before)}</pre>;
  }
  if (compact || isSimpleScalarChange(field)) {
    return <span>{renderChangeValue(field?.before)} {'->'} {renderChangeValue(field?.after)}</span>;
  }
  return (
    <div className="mt-1 grid gap-1">
      <div><span className="font-black">Before:</span> {renderChangeValue(field?.before)}</div>
      <div><span className="font-black">After:</span> {renderChangeValue(field?.after)}</div>
    </div>
  );
}

function historyPath(file) {
  return `${file?.section || ''}/${file?.file || ''}`.replace(/\.(xml|csv|json)$/i, '').toLowerCase();
}

function historyRows(file) {
  return [
    ...asArray(file?.added).map((record) => ({ type: 'added', record })),
    ...asArray(file?.changed).map((record) => ({ type: 'changed', record })),
    ...asArray(file?.removed).map((record) => ({ type: 'removed', record })),
  ];
}

function historyRecordData(row) {
  return row?.record?.after || row?.record?.data || row?.record?.before || row?.record || {};
}

function skinHistoryKey(data) {
  const costumeId = data?.CostumeID;
  if (clean(costumeId)) return `costume:${costumeId}`;
  const name = data?.CostumeName || data?.Item || data?.StoreName || data?.WeaponSet;
  return clean(name) ? `name:${normalizeString(name)}` : '';
}

function resolvedSkinHistoryKey(legend, data) {
  const skin = findLegendSkin(legend, data);
  if (skin) return { key: `skin:${skin.id || skin.codeName}`, skin };
  return { key: skinHistoryKey(data), skin: null };
}

function weaponHistoryKey(data) {
  const id = data?.WeaponSkinID;
  if (clean(id)) return `weapon:${id}`;
  const name = data?.WeaponSkinName || data?.DisplayNameKey;
  return clean(name) ? `weapon-name:${normalizeString(name)}` : '';
}

function isStanceVariantName(value) {
  return /stance2?$/i.test(String(value || '').trim());
}

function isStanceVariantRecord(data) {
  return [
    data?.CostumeName,
    data?.Item,
    data?.StoreName,
    data?.WeaponSet,
    data?.WeaponSkinName,
    data?.InheritCostumeDefines,
  ].some(isStanceVariantName);
}

function findLegendSkin(legend, data) {
  const costumeId = String(data?.CostumeID || '');
  const names = [data?.CostumeName, data?.Item, data?.StoreName].map(normalizeString).filter(Boolean);
  return asArray(legend?.skins).find((skin) => {
    const skinIds = [skin?.id, skin?.costumeId, skin?.CostumeID, skin?.stuff?.CostumeID].map((value) => String(value || '')).filter(Boolean);
    if (costumeId && skinIds.includes(costumeId)) return true;
    const skinNames = [skin?.codeName, skin?.costumeName, skin?.CostumeName, skin?.stuff?.CostumeName].map(normalizeString).filter(Boolean);
    return names.some((name) => skinNames.includes(name));
  });
}

function usefulSkinFields(group, lang) {
  const costume = group.costume || {};
  const store = group.store || {};
  const rows = [
    ['Name', group.name],
    ['Description', resolveLang(store.DescriptionKey || costume.DescriptionKey, lang)],
    ['Internal Name', costume.CostumeName || store.Item || store.StoreName],
    ['Costume ID', costume.CostumeID],
    ['Store ID', store.StoreID],
    ['Weapon Set', costume.WeaponSet || group.skin?.stuff?.WeaponSet],
    ['Mammoth Coins', store.IdolCost],
    ['Mammoth Coins during sales', store.IdolSaleCost],
    ['Gold', store.GoldCost],
    ['Glory', store.GloryCost],
    ['Special Currency', [store.SpecialCurrencyType, store.SpecialCurrencyCost].filter(clean).join(' ')],
    ['Popularity', store.Popularity],
    ['Label', store.Label === 'LastChance' ? store.Label : ''],
  ];
  return rows.filter(([, value]) => clean(value));
}

const usefulSkinChangeFieldNames = new Set([
  'DisplayNameKey',
  'DescriptionKey',
  'CostumeName',
  'CostumeID',
  'WeaponSet',
  'StoreName',
  'StoreID',
  'Item',
  'IdolCost',
  'IdolSaleCost',
  'GoldCost',
  'GloryCost',
  'SpecialCurrencyType',
  'SpecialCurrencyCost',
  'Popularity',
  'Label',
]);

function skinChangeFields(rows) {
  const fields = rows.flatMap((row) => asArray(row.record?.fields));
  const isUseful = (field) => usefulSkinChangeFieldNames.has(field?.field)
    && (field.field !== 'Label' || field.before === 'LastChance' || field.after === 'LastChance');
  return {
    useful: fields.filter(isUseful),
    other: fields.filter((field) => !isUseful(field)),
  };
}

function skinImageUrl(legend, group) {
  const heroId = group.skin?.HeroID || legend?.id;
  const skinInt = group.skin?.SkinInt ?? group.skin?.index;
  const selected = group.skin?.animTypes?.selectedOther || group.skin?.animTypes?.selected || group.skin?.SelectedAnimation;
  if (clean(heroId) && clean(skinInt) && clean(selected)) {
    return `${host}/game/anim/char/${heroId}-${skinInt}/Animation_CharacterSelect/a__CharacterSelectAnimation/${selected}/loop`;
  }
  return null;
}

function weaponImageUrl(data) {
  if (!clean(data?.WeaponSkinID)) return null;
  const base = data?.BaseWeapon || 'Sword';
  return `${host}/game/anim/weapon/${data.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${base}Pose/all`;
}

function isSkinHistoryRow(file, row, legend) {
  const path = historyPath(file);
  const data = historyRecordData(row);
  if (path === 'game/costumetypes') return !!findLegendSkin(legend, data);
  if (path === 'game/storetypes') {
    return !!findLegendSkin(legend, data);
  }
  return false;
}

function buildHistoryVisualGroups(entry, legend) {
  const runeRows = [];
  const weaponRows = [];
  const skinGroups = new Map();

  for (const file of asArray(entry?.files)) {
    const path = historyPath(file);
    for (const row of historyRows(file)) {
      const data = historyRecordData(row);
      if (path === 'game/runetypes') {
        runeRows.push({ ...row, file });
        continue;
      }
      if (path === 'game/weaponskintypes') {
        if (row.type !== 'added' || isStanceVariantRecord(data)) continue;
        const key = weaponHistoryKey(data) || `${path}:${row.type}:${row.record?.id || weaponRows.length}`;
        if (!weaponRows.some((weaponRow) => weaponRow.key === key)) {
          weaponRows.push({ ...row, file, key });
        }
        continue;
      }
      if (isSkinHistoryRow(file, row, legend)) {
        if (isStanceVariantRecord(data)) continue;
        const resolved = resolvedSkinHistoryKey(legend, data);
        const key = resolved.key;
        if (!key) continue;
        const group = skinGroups.get(key) || {
          key,
          type: row.type,
          rows: [],
          costume: null,
          store: null,
          skin: null,
          weaponRows: [],
          name: row.record?.name,
        };
        group.rows.push({ ...row, file });
        if (path === 'game/costumetypes') group.costume = data;
        if (path === 'game/storetypes') group.store = data;
        group.skin ||= resolved.skin || findLegendSkin(legend, data);
        group.name = group.name || row.record?.name || group.skin?.name || group.skin?.codeName;
        if (group.type !== 'added' && row.type === 'changed') group.type = 'changed';
        skinGroups.set(key, group);
      }
    }
  }

  const skinGroupsList = [...skinGroups.values()];
  const addedSkinByDefine = new Map();
  for (const group of skinGroupsList) {
    if (group.type !== 'added') continue;
    const defineNames = [
      group.costume?.WeaponSet,
      group.costume?.CostumeName,
      group.store?.Item,
      group.store?.StoreName,
      group.skin?.stuff?.WeaponSet,
      group.skin?.codeName,
    ].map(normalizeString).filter(Boolean);
    for (const defineName of defineNames) addedSkinByDefine.set(defineName, group);
  }

  const standaloneWeaponRows = [];
  for (const row of weaponRows) {
    const data = historyRecordData(row);
    const skinGroup = addedSkinByDefine.get(normalizeString(data?.InheritCostumeDefines));
    if (skinGroup) {
      if (!skinGroup.weaponRows.some((weaponRow) => weaponHistoryKey(historyRecordData(weaponRow)) === weaponHistoryKey(data))) {
        skinGroup.weaponRows.push(row);
      }
      continue;
    }
    standaloneWeaponRows.push(row);
  }

  return {
    runes: runeRows,
    weaponSkins: standaloneWeaponRows,
    skins: skinGroupsList,
  };
}

function cloneFileForGenericHistory(file, legend) {
  const path = historyPath(file);
  if (path === 'game/runetypes' || path === 'game/weaponskintypes') return null;
  const filter = (record, type) => {
    const data = historyRecordData({ type, record });
    if (isStanceVariantRecord(data)) return false;
    return !isSkinHistoryRow(file, { type, record }, legend);
  };
  const added = asArray(file?.added).filter((record) => filter(record, 'added'));
  const changed = asArray(file?.changed).filter((record) => filter(record, 'changed'));
  const removed = asArray(file?.removed).filter((record) => filter(record, 'removed'));
  if (!added.length && !changed.length && !removed.length) return null;
  return {
    ...file,
    added,
    changed,
    removed,
    summary: { added: added.length, changed: changed.length, removed: removed.length },
  };
}

function visibleHistoryEntry(entry, legend) {
  const groups = buildHistoryVisualGroups(entry, legend);
  const files = asArray(entry?.files)
    .map((file) => cloneFileForGenericHistory(file, legend))
    .filter(Boolean);
  const visibleCount = groups.runes.length + groups.skins.length + groups.weaponSkins.length + files.length;
  if (!visibleCount) return null;
  return { entry, groups, files };
}

const historyCategoryOptions = [
  ['all', 'All Changes'],
  ['signatures', 'Signature Changes'],
  ['stances', 'Stance Changes'],
  ['skins', 'Skin Changes'],
  ['weaponSkins', 'Weapon Skin Changes'],
  ['hurtboxes', 'Hurtbox Changes'],
  ['legend', 'Legend Data'],
  ['store', 'Store Changes'],
  ['other', 'Other Changes'],
];

function historyFileCategories(file) {
  const path = historyPath(file);
  if (path === 'game/powertypes') return ['signatures'];
  if (path === 'game/runetypes') return ['stances'];
  if (path === 'game/costumetypes') return ['skins'];
  if (path === 'game/weaponskintypes') return ['weaponSkins', 'skins'];
  if (path === 'game/hurtboxtypes') return ['hurtboxes'];
  if (path === 'game/herotypes') return ['legend'];
  if (path === 'game/storetypes') return ['store', 'skins'];
  return ['other'];
}

function legendSignatureOptions(legend) {
  const directions = [
    ['nSig', 'Neutral Signature'],
    ['sSig', 'Side Signature'],
    ['dSig', 'Down Signature'],
  ];
  return [
    legend?.weapons?.main,
    legend?.weapons?.secondary,
  ].flatMap((weapon) => directions
    .map(([key, label]) => ({
      value: weapon?.sigNames?.[key],
      label: `${displayWeaponName(weapon?.name)} ${label}`,
    }))
    .filter((option) => clean(option.value)));
}

function signaturePowerParts(signature) {
  const match = String(signature || '').match(/^(.*Smash(?:Neutral|Side|Down))(.*)$/i);
  return match ? { prefix: normalizeString(match[1]), suffix: normalizeString(match[2]) } : null;
}

function recordMatchesSignature(record, signature) {
  if (!clean(signature)) return true;
  const root = normalizeString(signature);
  const parts = signaturePowerParts(signature);
  const sources = [record?.data, record?.before, record?.after, record];
  const names = sources.flatMap((source) => [
    source?.PowerName,
    source?.OriginPower,
    source?.ComboName,
    source?.ComboOverrideIfHit,
    source?.ComboOverrideIfMiss,
  ]).concat(record?.name).map(normalizeString).filter(Boolean);
  return names.some((name) => (
    name === root
    || (parts && name.startsWith(parts.prefix) && (!parts.suffix || name.slice(parts.prefix.length).includes(parts.suffix)))
  ));
}

function summarizeHistoryFiles(files) {
  return asArray(files).reduce((summary, file) => {
    const added = asArray(file?.added).length;
    const changed = asArray(file?.changed).length;
    const removed = asArray(file?.removed).length;
    if (added + changed + removed > 0) summary.files += 1;
    summary.added += added;
    summary.changed += changed;
    summary.removed += removed;
    return summary;
  }, { files: 0, added: 0, changed: 0, removed: 0 });
}

function filterHistoryEntry(entry, category, signature) {
  const files = asArray(entry?.files).map((file) => {
    const categories = historyFileCategories(file);
    if (category !== 'all' && !categories.includes(category)) return null;
    if (clean(signature) && !categories.includes('signatures')) return null;
    const selectRows = (rows) => asArray(rows).filter((record) => !clean(signature) || recordMatchesSignature(record, signature));
    const added = selectRows(file?.added);
    const changed = selectRows(file?.changed);
    const removed = selectRows(file?.removed);
    if (!added.length && !changed.length && !removed.length) return null;
    return {
      ...file,
      added,
      changed,
      removed,
      summary: { added: added.length, changed: changed.length, removed: removed.length },
    };
  }).filter(Boolean);
  if (!files.length) return null;
  return { ...entry, files, summary: summarizeHistoryFiles(files) };
}

function RuneHistoryCard({ row, legend }) {
  const data = historyRecordData(row);
  const isBase = String(data?.RuneIndex || '') === '0' || normalizeString(data?.StanceName) === 'base';
  const before = row.type === 'added' ? legend?.stances : row.record?.before;
  const after = row.type === 'removed' ? legend?.stances : row.record?.after || row.record?.data;
  const deltas = stats.map((stat) => {
    const beforeValue = statValue(before, stat);
    const afterValue = statValue(after, stat);
    return { ...stat, diff: afterValue - beforeValue };
  }).filter((stat) => stat.diff !== 0);

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-amber-100">
      <div className="flex items-center gap-3">
        {clean(data?.IconName) && <img src={`${host}/game/getGfx/${data.IconFileName || 'UI_Icons'}/${data.IconName}/1`} className="h-10 w-10 object-contain" alt="" />}
        <div className="min-w-0">
          <div className="text-sm font-black leading-tight">{data?.StanceName || row.record?.name || 'Stance'}</div>
          {!!deltas.length && (
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-black">
              {deltas.map((stat) => (
                <span key={stat.key} className={stat.diff > 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {displayFieldName(stat.runeKey)} {stat.diff > 0 ? '+' : ''}{stat.diff}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {isBase ? (
        <div className="mt-3 rounded-lg p-2 bg-slate-950/45">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">Stats</div>
          <StatMiniLine source={after || before} base={after || before || legend?.stances} />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg p-2 bg-slate-950/45">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">{row.type === 'added' ? 'Base' : 'Before'}</div>
            <StatMiniLine source={before} base={legend?.stances} />
          </div>
          <div className="rounded-lg p-2 bg-slate-950/45">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">{row.type === 'removed' ? 'Base' : 'After'}</div>
            <StatMiniLine source={after} base={legend?.stances} />
          </div>
        </div>
      )}
    </div>
  );
}

function WeaponSkinHistoryCard({ row }) {
  const data = historyRecordData(row);
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl p-2 bg-slate-950/70">
          {weaponImageUrl(data) && <img src={weaponImageUrl(data)} className="max-h-full max-w-full object-contain" loading="lazy" alt={row.record?.name || data?.WeaponSkinName} />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wide text-blue-300">{displayWeaponName(data?.BaseWeapon || 'Weapon')}</div>
          <div className="break-words text-base font-black text-white">{row.record?.name || data?.WeaponSkinName}</div>
          {clean(data?.WeaponSkinName) && <div className="mt-1 text-xs font-bold text-slate-400">{data.WeaponSkinName}</div>}
        </div>
      </div>
    </div>
  );
}

function SkinHistoryCard({ group, legend }) {
  const image = skinImageUrl(legend, group);
  const groupedWeapons = asArray(group.weaponRows).map((row) => historyRecordData(row)).filter((weapon) => !isStanceVariantRecord(weapon));
  const fallbackWeapons = group.type === 'added' ? asArray(group.skin?.stuff?.WeaponSet2).slice(0, 2).filter((weapon) => !isStanceVariantRecord(weapon)) : [];
  const weapons = groupedWeapons.length ? groupedWeapons : fallbackWeapons;
  const lang = useContext(LangContext);
  const fields = group.type === 'added' ? usefulSkinFields(group, lang) : [];
  const { useful, other } = skinChangeFields(group.rows);
  const changeFields = useful.map((field) => resolveKeyField(field, lang));
  const changeFieldGrid = changeFields.length <= 1
    ? 'mt-3 grid gap-2'
    : 'mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3';
  return (
    <div className="rounded-xl border p-2 border-slate-700 bg-slate-900">
      <div className="grid gap-3 lg:grid-cols-[12rem_1fr]">
        <div className="grid gap-2">
          <div className="flex h-44 items-center justify-center rounded-xl p-2 bg-slate-950/70">
            {image && <img src={image} className="max-h-full max-w-full object-contain" loading="lazy" alt={group.name || group.costume?.CostumeName || group.store?.StoreName} />}
          </div>
          {!!weapons.length && (
            <div className="grid grid-cols-2 gap-2">
              {weapons.map((weapon) => (
                <div key={weapon.WeaponSkinID || weapon.WeaponSkinName} className="flex h-20 items-center justify-center rounded-lg p-1 bg-slate-950/70">
                  <ImageWithLoader
                    src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                    alt={weapon.DisplayNameFull || weapon.WeaponSkinName}
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wide text-blue-300">{group.type === 'added' ? 'Skin Added' : group.type === 'removed' ? 'Skin Removed' : 'Skin Updated'}</div>
          <h4 className="break-words text-xl font-black text-white">{group.name || group.costume?.CostumeName || group.store?.StoreName}</h4>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-lg border p-2 border-slate-800 bg-slate-950/70">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-0.5 break-words text-sm font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
          {!!changeFields.length && (
            <div className={changeFieldGrid}>
              {changeFields.map((field, index) => (
                <div key={`${field.field}-${index}`} className="rounded-lg bg-blue-500/10 p-2 text-sm font-bold text-blue-200">
                  {isSimpleScalarChange(field) ? (
                    <div><span className="font-black">{displayFieldName(field.field)}:</span> <ChangeFieldBody field={field} compact /></div>
                  ) : (
                    <>
                      <div className="font-black">{displayFieldName(field.field)}</div>
                      <ChangeFieldBody field={field} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {!!other.length && (
            <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70">
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
                {useful.length ? 'Other field changes' : 'Field changes'} ({other.length})
              </summary>
              <div className="grid gap-2 border-t p-2 border-slate-800">
                {other.map((field, index) => (
                  <div key={`${field.field}-${index}`} className="rounded-lg p-2 text-sm bg-slate-950/50">
                    {isSimpleScalarChange(field) ? (
                      <div><span className="font-black">{field.field}:</span> <ChangeFieldBody field={field} compact /></div>
                    ) : (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-wide opacity-70">{field.field}</div>
                        <ChangeFieldBody field={field} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function VisualHistorySection({ title, children, count }) {
  if (!count) return null;
  return (
    <details open className="group rounded-xl border border-slate-700 bg-slate-950/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:hidden">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <span className="flex items-center gap-2">
          <span className="rounded-lg px-2 py-1 text-xs font-black bg-slate-800 text-slate-200">{count}</span>
          <span className="text-sm font-black transition group-open:rotate-180 text-slate-400">v</span>
        </span>
      </summary>
      <div className="border-t p-3 border-slate-800">{children}</div>
    </details>
  );
}

function EntryVisualHistory({ entry, legend, groups: providedGroups }) {
  const groups = providedGroups || buildHistoryVisualGroups(entry, legend);
  const addedSkins = groups.skins.filter((group) => group.type === 'added');
  const changedSkins = groups.skins.filter((group) => group.type !== 'added');
  return (
    <div className="grid gap-3">
      <VisualHistorySection title="Stance Changes" count={groups.runes.length}>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-4">
          {groups.runes.map((row, index) => <RuneHistoryCard key={`${row.record?.id || index}`} row={row} legend={legend} />)}
        </div>
      </VisualHistorySection>
      <VisualHistorySection title="Skin Changes" count={groups.skins.length}>
        <div className="grid gap-3">
          {addedSkins.map((group) => <SkinHistoryCard key={group.key} group={group} legend={legend} />)}
          {!!changedSkins.length && (
            <div className="grid gap-3 xl:grid-cols-3">
              {changedSkins.map((group) => <SkinHistoryCard key={group.key} group={group} legend={legend} />)}
            </div>
          )}
        </div>
      </VisualHistorySection>
      <VisualHistorySection title="Weapon Skin Changes" count={groups.weaponSkins.length}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[112.5rem]:grid-cols-5 min-[137.5rem]:grid-cols-6">
          {groups.weaponSkins.map((row, index) => <WeaponSkinHistoryCard key={`${row.key || index}`} row={row} />)}
        </div>
      </VisualHistorySection>
    </div>
  );
}

function ChangeFields({ data, dense = false }) {
  if (!data || typeof data !== 'object') return null;
  const rows = Object.entries(data).filter(([_, value]) => clean(renderChangeValue(value)));
  if (!rows.length) return null;
  const fieldGridClass = rows.length === 1
    ? 'grid gap-2'
    : dense
      ? 'grid gap-2 lg:grid-cols-2'
      : 'grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  return (
    <div className={fieldGridClass}>
      {rows.map(([key, value]) => (
        <div key={key} className="rounded-lg border p-2 text-sm border-slate-800 bg-slate-950/70">
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{key}</div>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans font-bold text-white">{renderChangeValue(value)}</pre>
        </div>
      ))}
    </div>
  );
}

function rawPropertyValue(value) {
  if (value === undefined) return 'undefined';
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}

function CommonPowerDelta({ field, detail }) {
  const path = [field.field, detail.path].filter(Boolean).join('.');
  return (
    <div className="font-mono">
      <span>{path}: </span>
      <span className="text-red-300">{rawPropertyValue(detail.before)}</span>
      {' -> '}
      <span className="text-emerald-300">{rawPropertyValue(detail.after)}</span>
    </div>
  );
}

function HighlightedPropertyData({ value, details, side }) {
  const highlighted = new Set(details
    .filter((detail) => side === 'before' ? detail.action !== 'added' : detail.action !== 'removed')
    .map((detail) => String(detail.path || '').split('.').pop())
    .filter(Boolean));
  const serialized = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs app-scrollbar">
      {String(serialized).split('\n').map((line, index) => {
        const changed = [...highlighted].some((key) => line.includes(`${JSON.stringify(key)}:`));
        const color = changed
          ? side === 'before' ? 'text-red-300' : 'text-emerald-300'
          : '';
        return <span key={index} className={`${color} block`}>{line}</span>;
      })}
    </pre>
  );
}

function CommonPowerFieldData({ field }) {
  const structuralChange = field.details.some((detail) => detail.action === 'added' || detail.action === 'removed');
  if (!structuralChange) {
    return (
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg px-3 py-2 bg-slate-950/50">
        {field.details.map((detail) => <CommonPowerDelta key={`${detail.action}-${detail.path}`} field={field} detail={detail} />)}
      </div>
    );
  }
  return (
    <div className="mt-2 grid gap-2">
      {field.variants.map((variant, index) => (
        <div key={index} className="rounded-lg p-2 bg-slate-950/50">
          {field.variants.length > 1 && <div className="mb-2 text-xs font-black opacity-70">{variant.count} powers</div>}
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg bg-red-500/5 p-2">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-red-300">Before</div>
              <HighlightedPropertyData value={variant.before} details={field.details} side="before" />
            </div>
            <div className="rounded-lg bg-emerald-500/5 p-2">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">After</div>
              <HighlightedPropertyData value={variant.after} details={field.details} side="after" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangeList({ title, items, tone, file }) {
  const lang = useContext(LangContext);
  const sourceRows = asArray(items);
  if (!sourceRows.length) return null;
  const isPowerFile = historyPath(file) === 'game/powertypes';
  const isHurtboxFile = historyPath(file) === 'game/hurtboxtypes';
  const summarized = isPowerFile
    ? summarizeCommonPowerFields(sourceRows.map((record) => ({ type: tone, record })))
    : { entries: sourceRows.map((record) => ({ type: tone, record })), commonFields: [] };
  const rows = summarized.entries.map((entry) => entry.record);
  const recordGridClass = rows.length === 1
    ? 'grid gap-2'
    : isHurtboxFile
      ? 'grid gap-2 lg:grid-cols-3'
    : isPowerFile
      ? 'grid gap-3 2xl:grid-cols-2'
      : tone === 'changed'
        ? 'grid gap-2 xl:grid-cols-2'
        : 'grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  const toneClass = {
    added: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    changed: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
    removed: 'border-red-400/30 bg-red-500/10 text-red-200',
  }[tone] || 'border-slate-700 bg-slate-950/70 text-slate-200';

  return (
    <details open className="group rounded-lg border border-slate-800 bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:hidden">
        <span className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</span>
        <span className="flex items-center gap-2 text-xs font-black text-slate-400">
          {sourceRows.length}
          <span className="transition group-open:rotate-180">v</span>
        </span>
      </summary>
      <div className="border-t p-3 border-slate-800">
      {!!summarized.commonFields.length && (
        <div className="mb-3 grid gap-2">
          {summarized.commonFields.map((field) => (
            <div key={field.field} className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-2 text-sm font-black text-blue-200">
              <div>{commonPowerFieldMessage(field)}</div>
              <CommonPowerFieldData field={field} />
            </div>
          ))}
        </div>
      )}
      {!!rows.length && <div className={recordGridClass}>
        {rows.map((item, index) => (
          <div key={`${item?.id || item?.name || index}`} className={`min-w-0 rounded-lg border p-2 [overflow-wrap:anywhere] ${toneClass}`}>
            <div className="font-black">{item?.name || item?.id || `${title} ${index + 1}`}</div>
            {item?.fields ? (
              <div className={asArray(item.fields).length === 1 ? 'mt-2 grid gap-2' : isPowerFile ? 'mt-2 grid gap-2 lg:grid-cols-2' : isHurtboxFile ? 'mt-2 grid gap-2 lg:grid-cols-3' : 'mt-2 grid gap-2 md:grid-cols-2 2xl:grid-cols-3'}>
                {asArray(item.fields).map((record) => resolveKeyField(record, lang)).map((field, fieldIndex) => (
                  <div key={`${field?.field || fieldIndex}`} className="rounded-lg p-2 text-sm bg-slate-950/50">
                    {isSimpleScalarChange(field) ? (
                      <div><span className="font-black">{field?.field}:</span> <ChangeFieldBody field={field} compact /></div>
                    ) : (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-wide opacity-70">{field?.field}</div>
                        <ChangeFieldBody field={field} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <ChangeFields data={item?.data || item} dense={isPowerFile} />
              </div>
            )}
          </div>
        ))}
      </div>}
      </div>
    </details>
  );
}

function HistoryFile({ file }) {
  const { full } = useDataView();
  return (
    <details open className="group rounded-xl border border-slate-700 bg-slate-900">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 marker:hidden">
        <div>
          {full && <div className="font-mono text-[10px] font-black text-blue-300">{file?.section}/{file?.file}</div>}
          <div className="text-lg font-black text-white">{file?.label || file?.file}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
          {!!file?.summary?.added && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-200">+{file.summary.added}</span>}
          {!!file?.summary?.changed && <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-blue-200">~{file.summary.changed}</span>}
          {!!file?.summary?.removed && <span className="rounded-lg bg-red-500/10 px-2 py-1 text-red-200">-{file.summary.removed}</span>}
          <span className="ml-1 text-sm transition group-open:rotate-180 text-slate-400">v</span>
        </div>
      </summary>
      <div className="grid gap-3 border-t p-3 border-slate-800">
        <ChangeList title="Added" items={file?.added} tone="added" file={file} />
        <ChangeList title="Changed" items={file?.changed} tone="changed" file={file} />
        <ChangeList title="Removed" items={file?.removed} tone="removed" file={file} />
      </div>
    </details>
  );
}

function SelectedHistoryEntry({ entry, legend }) {
  const visible = useMemo(() => visibleHistoryEntry(entry, legend), [entry, legend]);
  if (!visible) {
    return <div className="mt-3 text-sm font-bold text-slate-400">No visible changes match these filters.</div>;
  }
  return (
    <div className="mt-3 grid gap-3">
      <EntryVisualHistory entry={visible.entry} legend={legend} groups={visible.groups} />
      {visible.files.length
        ? visible.files.map((file) => <HistoryFile key={`${file.section}-${file.file}`} file={file} />)
        : !asArray(visible.entry?.files).length && <ChangeFields data={visible.entry?.data || visible.entry?.changes || visible.entry} />}
    </div>
  );
}

function withoutMinorChanges(entries) {
  let hidden = 0;
  const kept = entries.map((entry) => {
    if (!Array.isArray(entry?.files)) return entry;
    const files = entry.files.map((file) => {
      if (!Array.isArray(file?.changed)) return file;
      const changed = file.changed
        .map((change) => {
          if (change?.minor) {
            hidden += 1;
            return null;
          }
          if (!Array.isArray(change?.fields) || !change.fields.some((field) => field?.minor)) return change;
          return { ...change, fields: change.fields.filter((field) => !field?.minor) };
        })
        .filter(Boolean);
      if (changed.length === file.changed.length && changed.every((change, index) => change === file.changed[index])) return file;
      return { ...file, changed, summary: { ...(file.summary || {}), changed: changed.length } };
    }).filter((file) => !Array.isArray(file?.changed) || asArray(file?.added).length || asArray(file?.removed).length || file.changed.length);
    if (!files.length) return null;
    if (files.length === entry.files.length && files.every((file, index) => file === entry.files[index])) return entry;
    const summary = files.reduce((acc, file) => ({
      files: acc.files + 1,
      added: acc.added + asArray(file?.added).length,
      changed: acc.changed + asArray(file?.changed).length,
      removed: acc.removed + asArray(file?.removed).length,
    }), { files: 0, added: 0, changed: 0, removed: 0 });
    return { ...entry, files, summary };
  }).filter(Boolean);
  return { entries: kept, hidden };
}

function HistoryPage({ legend, history }) {
  const { full } = useDataView();
  const allEntries = useMemo(() => asArray(history?.history || history), [history]);
  const minorFiltered = useMemo(() => (full ? { entries: allEntries, hidden: 0 } : withoutMinorChanges(allEntries)), [allEntries, full]);
  const entries = minorFiltered.entries;
  const signatures = useMemo(() => legendSignatureOptions(legend), [legend]);
  const [category, setCategory] = useState('all');
  const [signature, setSignature] = useState('');
  const [selectedPatch, setSelectedPatch] = useState('');
  const filteredEntries = useMemo(() => entries
    .map((entry, index) => {
      const filtered = filterHistoryEntry(entry, category, signature);
      if (!filtered) return null;
      return {
        key: String(entry?.manifest || `${entry?.patch || 'patch'}-${index}`),
        entry: filtered,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const dateDifference = Number(right.entry?.date || 0) - Number(left.entry?.date || 0);
      if (dateDifference) return dateDifference;
      return String(right.entry?.patch || '').localeCompare(String(left.entry?.patch || ''), undefined, { numeric: true });
    }), [entries, category, signature]);
  const selected = filteredEntries.find((item) => item.key === selectedPatch);
  const beta = isBetaLegend(legend);

  useEffect(() => {
    if (!filteredEntries.length) {
      if (selectedPatch) setSelectedPatch('');
      return;
    }
    if (!selectedPatch || !filteredEntries.some((item) => item.key === selectedPatch)) {
      setSelectedPatch(filteredEntries[0].key);
    }
  }, [filteredEntries, selectedPatch]);

  if (!entries.length) {
    return (
      <Section title="History">
        {beta ? (
          <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
            <InfoChip label="First Seen" value={formatDate(legend?.beta?.firstSeen?.dateTime || legend?.beta?.firstSeen?.date)} />
            <InfoChip label="Last Seen" value={formatDate(legend?.beta?.lastSeen?.dateTime || legend?.beta?.lastSeen?.date)} />
            <InfoChip label="First Patch" value={legend?.beta?.firstSeen?.patch} />
            <InfoChip label="Last Patch" value={legend?.beta?.lastSeen?.patch} />
            <InfoChip label="Source Hero IDs" value={asArray(legend?.beta?.sourceHeroIDs).join(', ')} />
          </div>
        ) : (
          <EmptyState title="No patch changes recorded for this legend yet" />
        )}
      </Section>
    );
  }

  return (
    <Section title="History" count={entries.length}>
      <div className="grid max-w-5xl gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SelectInput
          inline={false}
          label="Change Category"
          value={category}
          onChange={(value) => {
            setCategory(value);
            if (value !== 'all' && value !== 'signatures') setSignature('');
          }}
          options={historyCategoryOptions.map(([value, label]) => ({ value, label }))}
        />
        <SelectInput
          inline={false}
          label="Signature"
          value={signature}
          onChange={setSignature}
          options={[{ value: '', label: 'All signatures' }, ...signatures.map((option) => ({ value: option.value, label: option.label }))]}
        />
        <SelectInput
          inline={false}
          label={`Patch (${filteredEntries.length})`}
          value={selectedPatch}
          onChange={setSelectedPatch}
          options={[{ value: '', label: 'Select a patch' }, ...filteredEntries.map(({ key, entry }) => ({
            value: key,
            label: `${historyPatchName(entry)}${clean(entry?.date) ? ` - ${formatDate(entry.date)}` : ''}`,
          }))]}
        />
      </div>
      {minorFiltered.hidden > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>{minorFiltered.hidden.toLocaleString()} art, sound and store-order changes hidden.</span>
          <ShowFullData label="Show them" className="px-2 py-1 text-xs" />
        </div>
      )}
      {!filteredEntries.length && <EmptyState title="No patches match these filters" />}

      <div>
        {!selected && filteredEntries.length > 0 && <EmptyState title="Pick a patch" />}
        {selected && (
          <div key={selected.key} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2">
            <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
                <span>{historyPatchName(selected.entry)}</span>
                {clean(selected.entry?.date) && <span className="text-sm text-slate-400">{formatDate(selected.entry.date)}</span>}
                <span className="rounded-lg px-2 py-1 text-xs bg-slate-800 text-slate-200">
                  {selected.entry.summary.files} files, {selected.entry.summary.added} added, {selected.entry.summary.changed} changed, {selected.entry.summary.removed} removed
                </span>
            </div>
            <SelectedHistoryEntry entry={selected.entry} legend={legend} />
          </div>
        )}
      </div>
    </Section>
  );
}

function BetaIntel({ legend }) {
  if (!isBetaLegend(legend)) return null;
  return (
    <Section title="Beta Data">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
        <InfoChip label="Original Hero ID" value={legend?.originalId} />
        <InfoChip label="First Patch" value={legend?.beta?.firstSeen?.patch} />
        <InfoChip label="Last Patch" value={legend?.beta?.lastSeen?.patch} />
        <InfoChip label="Source Hero IDs" value={asArray(legend?.beta?.sourceHeroIDs).join(', ')} />
      </div>
    </Section>
  );
}

const LegendPage = ({ legend, prevLegends = [], nextLegends = [], history, missingName, suggestions = [] }) => {
  const [tabParam, setCurrentTab] = useQueryState("tab", "main");
  const beta = isBetaLegend(legend);
  const legendTabs = beta ? tabs.filter((tab) => tab.key !== "players") : tabs;
  const currentTab = legendTabs.some((tab) => tab.key === tabParam) ? tabParam : "main";
  const [activeStance, setActiveStance] = useState("base");
  const [historyData, setHistoryData] = useState(history ?? null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRequest, setHistoryRequest] = useState(0);
  const [historyBuilding, setHistoryBuilding] = useState(false);
  const [lang, setLang] = useState(null);

  const safePrev = useMemo(() => asArray(prevLegends).filter(Boolean), [prevLegends]);
  const safeNext = useMemo(() => asArray(nextLegends).filter(Boolean), [nextLegends]);

  useEffect(() => {
    if (currentTab !== "history" || historyData || !legend?.id) return;
    const controller = new AbortController();
    let retryTimer;
    setHistoryLoading(true);
    setHistoryError("");
    fetch(`${host}/game/history/legend/${encodeURIComponent(legend.id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Couldn't load the patch history (${response.status})`);
        const data = await response.json();
        if (response.status === 202 || data?.status === "building") {
          setHistoryBuilding(true);
          retryTimer = setTimeout(() => setHistoryRequest((value) => value + 1), 10000);
          return;
        }
        setHistoryBuilding(false);
        setHistoryData(data);
        setHistoryLoading(false);
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setHistoryBuilding(false);
        setHistoryError(error?.message || "Couldn't load the patch history.");
        setHistoryLoading(false);
      });
    return () => {
      clearTimeout(retryTimer);
      controller.abort();
    };
  }, [currentTab, historyData, historyRequest, legend?.id]);

  useEffect(() => {
    if (currentTab !== "history" || lang) return;
    fetch(`${host}/game/langs/0`)
      .then((response) => response.json())
      .then((data) => setLang(data?.[0]?.content || {}))
      .catch(() => setLang({}));
  }, [currentTab, lang]);

  if (!legend) {
    return (
      <PageShell>
        <a href="/game/legends" className="-my-2 inline-flex py-2.5 text-sm font-bold text-blue-300 hover:text-blue-200">← Legends</a>
        <EmptyState
          title="Legend not found"
          action={<>
            {suggestions.map((item) => <a key={item.href} href={item.href} className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-sm font-bold text-blue-200 hover:bg-blue-500/20">{item.name}</a>)}
            <a href="/game/legends" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">All legends</a>
          </>}
        >
          {missingName ? <>No legend is called <span className="font-bold text-slate-200">{missingName}</span>.{suggestions.length ? " Did you mean:" : ""}</> : null}
        </EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <a href="/game/legends" className="-my-2 inline-flex py-2.5 text-sm font-bold text-blue-300 hover:text-blue-200">← Legends</a>
      <HeroHeader legend={legend} prevLegends={safePrev} nextLegends={safeNext} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Legend sections" value={currentTab} onChange={setCurrentTab} items={legendTabs.map((tab) => ({ value: tab.key, label: tab.label }))} />
        <DataViewToggle />
      </div>

      {currentTab === "main" && (
        <div className={`grid gap-3 ${beta ? 'xl:grid-cols-[28rem_minmax(0,1fr)] min-[118.75rem]:grid-cols-[28rem_minmax(0,60rem)]' : 'lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] min-[118.75rem]:grid-cols-[26rem_minmax(0,1fr)_minmax(0,26rem)] min-[137.5rem]:grid-cols-[26rem_minmax(0,46rem)_minmax(0,1fr)]'}`}>
          <div className="grid content-start gap-3">
            <StatViewer legend={legend} activeStance={activeStance} setActiveStance={setActiveStance} />
            <Quotes legend={legend} />
            <HomeStages legend={legend} />
            <BetaIntel legend={legend} />
          </div>
          <Biography legend={legend} />
          {!beta && (
            <div className="grid content-start gap-3 lg:col-span-2 min-[118.75rem]:col-span-1">
              <WhoPlaysCard legend={legend} onMore={() => setCurrentTab("players")} />
            </div>
          )}
        </div>
      )}

      {currentTab === "weapons" && <SignaturePanel legend={legend} />}
      {currentTab === "skins" && <SkinsPage legend={legend} />}
      {currentTab === "players" && <PlayersTab legend={legend} />}
      {currentTab === "history" && (
        historyLoading ? (
          <LoadingState label={historyBuilding ? "Building this legend's history for the new patch. The page updates on its own when it's done." : "Loading patch history"} rows={4} />
        ) : historyError ? (
          <ErrorState message="Couldn't load the patch history." detail={historyError} onRetry={() => setHistoryRequest((value) => value + 1)} />
        ) : (
          <LangContext.Provider value={lang || {}}>
            <HistoryPage legend={legend} history={historyData} />
          </LangContext.Provider>
        )
      )}
    </PageShell>
  );
};

export default LegendPage;
