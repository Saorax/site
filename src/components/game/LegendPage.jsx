import React, { useEffect, useMemo, useState } from "react";
import '../../../fonts/style.css';
import { host } from "../../stuff";
import { ImageWithLoader, LoadingSpinner } from "./database/comp/LoadingImage";
import { commonPowerFieldMessage, summarizeCommonPowerFields } from "./powerHistorySummary";

const apiAsset = (src) => typeof src === 'string' && src.startsWith('/game/') ? `${host}${src}` : src;
const clean = (value) => value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '--';
const asArray = (value) => !value ? [] : Array.isArray(value) ? value : [value];

const stats = [
  { key: 'str', label: 'Strength', runeKey: 'Strength', icon: '/game/attack.png' },
  { key: 'dex', label: 'Dexterity', runeKey: 'Dexterity', icon: '/game/dexterity.png' },
  { key: 'def', label: 'Defense', runeKey: 'Weight', icon: '/game/defense.png' },
  { key: 'spe', label: 'Speed', runeKey: 'Speed', icon: '/game/speed.png' },
];

const tabs = [
  { key: 'main', label: 'Main' },
  { key: 'weapons', label: 'Weapons & Signatures' },
  { key: 'skins', label: 'Skins' },
  { key: 'history', label: 'Historical Changes' },
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

function statValue(source, stat) {
  const direct = Number(source?.[stat.key]);
  if (Number.isFinite(direct)) return direct;
  const rune = Number(source?.[stat.runeKey]);
  if (Number.isFinite(rune)) return rune;
  return 0;
}

function statPipIcon(value, base, index) {
  const pip = index + 1;
  const filled = value >= pip;
  const baseFilled = base >= pip;
  if (index === 0 && filled) return '742';
  if (index === 9 && filled) return '751';
  if (index === 9 && !filled) return '753';
  if (filled && !baseFilled) return '746';
  if (!filled && baseFilled) return '747';
  if (filled) return '745';
  return '749';
}

function weaponIcon(weapon) {
  return `${host}/game/getGfx/UI_Icons/a_WeaponIcon_${weapon}`;
}

function legendHref(legend) {
  return `/game/legends/${normalizeString(legend?.bio?.name?.normal)}`;
}

function displayWeaponName(value) {
  return String(value || '').replace('RocketLance', 'Rocket Lance').replace('Fists', 'Gauntlets').replace('Boots', 'Battle Boots');
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

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoChip({ label, value }) {
  if (!clean(value)) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-black text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function TagChips({ tags }) {
  const visible = [...new Set(asArray(tags).filter(clean))];
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((tag) => (
        <span key={tag} className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-200">
          {tag}
        </span>
      ))}
    </div>
  );
}

function StatViewer({ legend, activeStance, setActiveStance }) {
  if (!legend?.stances) {
    return (
      <Section title="Stances">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700 dark:text-amber-200">
          Stance data is not available for this beta legend yet.
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
      action={<span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600 dark:bg-slate-950 dark:text-slate-300">{current?.label}</span>}
    >
      <div className="flex flex-wrap gap-2">
        {normalStances.map((stance) => (
          <button key={stance.key} onClick={() => selectStance(stance.key)} className={`${current?.key === stance.key ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'} rounded-xl border px-3 py-2 text-sm font-black transition`}>
            {stance.label}
          </button>
        ))}
      </div>

      {!!superStances.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {superStances.map((stance) => (
            <button key={stance.key} onClick={() => selectStance(stance.key)} className={`${current?.key === stance.key ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-amber-400/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-200'} rounded-xl border px-3 py-2 text-sm font-black transition`}>
              {stance.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2">
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
              <div className="text-right text-lg font-black text-slate-900 dark:text-white">{value}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function HomeStages({ legend }) {
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
            href={`/game/maps?name=${encodeURIComponent(stage.name)}`}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-950/70"
          >
            {stage.image && (
              <img
                src={apiAsset(stage.image)}
                alt={stage.displayName || stage.name}
                className="aspect-video w-full bg-slate-200 object-cover transition group-hover:scale-[1.02] dark:bg-slate-900"
                loading="lazy"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="p-3">
              <div className="text-base font-black text-slate-950 dark:text-white">{stage.displayName || stage.name}</div>
              {stage.displayName !== stage.name && <div className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">{stage.name}</div>}
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
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <a href="/game/legends" className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-blue-700 transition hover:bg-blue-50 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-800">
          Back to Legends
        </a>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col gap-2">
            {weapons.map((weapon) => (
              <img key={weapon.name} src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-16 w-16 object-contain drop-shadow" alt={weapon.name} />
            ))}
          </div>
          {legend?.image && (
            <div className="flex h-36 w-36 items-end justify-center rounded-2xl bg-slate-100/80 p-2 dark:bg-slate-950/45">
              <img src={apiAsset(legend.image)} className="h-full w-auto object-contain drop-shadow-xl" alt={legend?.bio?.name?.normal} />
            </div>
          )}
        </div>

        <div className="min-w-0 text-center lg:text-left">
          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {beta && <span className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-200">Beta</span>}
            {weapons.map((weapon) => (
              <span key={weapon.name} className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-200">
                {displayWeaponName(weapon.name)}
              </span>
            ))}
            <TagChips tags={headerTags} />
          </div>
          <div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">{legend?.bio?.aka || legend?.codeName || 'Legend'}</div>
          <h1 className="mt-1 text-4xl font-black leading-none tracking-tight text-slate-950 dark:text-white sm:text-6xl">{legend?.bio?.name?.normal || legend?.codeName}</h1>
          {clean(legend?.codeName) && (
            <div className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {legend.codeName}
            </div>
          )}
          <div className="mt-2 text-lg font-black text-blue-700 dark:text-blue-200 sm:text-2xl">
            {beta ? 'First Seen' : 'Released'}: {beta ? formatDate(legend?.beta?.firstSeen?.dateTime || legend?.beta?.firstSeen?.date) : formatDate(legend?.release, true)}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoChip label="Known As" value={legend?.known} />
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

function MiniLegendLink({ legend, label }) {
  const weapons = [legend?.weapons?.main, legend?.weapons?.secondary].filter((weapon) => clean(weapon?.name));
  return (
    <a href={legendHref(legend)} className="flex flex-col rounded-xl border border-slate-300 bg-slate-100 p-2 text-center transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <div className="flex flex-col gap-1">
          {weapons.map((weapon) => (
            <img key={weapon.name} src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-6 w-6 object-contain" alt={weapon.name} />
          ))}
        </div>
        {legend?.image && <img src={apiAsset(legend.image)} className="h-16 w-16 object-contain" alt={legend?.bio?.name?.normal} />}
      </div>
      <div className="mt-1 text-sm font-black leading-tight text-slate-900 dark:text-white">{legend?.bio?.name?.normal}</div>
      <div className="mt-1 text-[10px] font-black text-blue-700 dark:text-blue-200">
        {formatDate(legend?.release)}
      </div>
    </a>
  );
}

function Biography({ legend }) {
  const quotes = [legend?.bio?.quote, legend?.bio?.quote2].filter((quote) => clean(quote?.text));
  return (
    <Section title="Biography">
      {clean(legend?.bio?.text) ? (
        <p className="text-base font-semibold leading-relaxed text-slate-700 dark:text-slate-300">{legend.bio.text}</p>
      ) : (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700 dark:text-amber-200">
          Biography text is not available for this beta legend.
        </div>
      )}
      {!!quotes.length && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {quotes.map((quote, index) => (
            <div key={index} className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/70">
              <p className="text-lg font-bold italic text-slate-900 dark:text-white">"{quote.text}"</p>
              {clean(quote.attrib) && <p className="mt-2 text-right text-sm font-black text-slate-500 dark:text-slate-400">{quote.attrib}</p>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function signatureAnimationName(animation) {
  const displayName = String(animation?.displayName ?? '').trim();
  return clean(displayName) ? displayName : 'Normal';
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`${open ? 'border-b border-slate-200 dark:border-slate-800' : ''} flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60`}
      >
        <span className="text-base font-black text-slate-950 dark:text-white">{signature.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`${open ? 'rotate-180' : ''} h-5 w-5 shrink-0 text-slate-500 transition-transform dark:text-slate-300`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && <div className="p-3">
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950/80">
          <ImageWithLoader
            src={apiAsset(selected.animationUrl)}
            alt={selected.animation}
            eager
            className="h-72 rounded-lg bg-slate-200/70 dark:bg-slate-900"
            imgClassName="h-full w-full object-contain"
          />
          <div className="mt-2 min-w-0">
            <div className="break-words text-sm font-black text-slate-950 dark:text-white">
              {signatureAnimationName(selected)}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a
              href={selected.viewerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300"
            >
              Full Viewer
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
                      className={`${active ? 'border-blue-400 bg-blue-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'} min-w-0 rounded-lg border px-2 py-1.5 text-left`}
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
        if (!response.ok) throw new Error(`Animation data failed to load (${response.status})`);
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
    <Section title="Weapons & Signatures">
      <div className="grid gap-4 lg:grid-cols-2">
        {weapons.map((weapon, weaponIndex) => {
          const animationWeapon = asArray(animationData?.weapons).find((entry) => entry.slot === weaponIndex + 1);
          return (
          <div key={weapon.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-center gap-3">
              <img src={apiAsset(weapon.image) || weaponIcon(weapon.name)} className="h-14 w-14 object-contain" alt={weapon.name} />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{weapon.label}</div>
                <div className="text-xl font-black text-slate-950 dark:text-white">{displayWeaponName(weapon.name)}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              {animationLoading ? (
                <div className="relative min-h-40 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-900"><LoadingSpinner /></div>
              ) : animationError ? (
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-700 dark:text-red-200">{animationError}</div>
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
                  <div key={label} className="rounded-lg bg-white px-3 py-2 text-sm font-bold dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">{label}: </span>
                    <span className="text-slate-950 dark:text-white">{value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          );
        })}
      </div>
    </Section>
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
  if (mammothCoins > 0) rows.push({ label: skin.cost.mammothCoins, tone: 'slate', icon: storeIcon('mc'), title: 'IdolCost' });
  if (saleMammothCoins > 0) rows.push({ label: skin.cost.saleMammothCoins, originalLabel: skin.cost.mammothCoins, tone: 'emerald', icon: storeIcon('mc'), title: 'IdolSaleCost', saleBadge: true });
  if (coins > 0) rows.push({ label: skin.cost.coins, tone: 'gold', icon: storeIcon('gold'), title: 'GoldCost' });
  if (saleCoins > 0) rows.push({ label: skin.cost.saleCoins, originalLabel: skin.cost.coins, tone: 'emerald', icon: storeIcon('gold'), title: 'GoldSaleCost', saleBadge: true });
  if (Number(skin?.cost?.glory) > 0) rows.push({ label: skin.cost.glory, tone: 'purple', icon: storeIcon('glory'), title: 'RankedPointsCost' });
  if (clean(skin?.timed?.eventType)) rows.push({ label: skin.timed.eventType, tone: 'rose' });
  if (clean(skin?.timed?.typeOfEvent)) rows.push({ label: skin.timed.typeOfEvent, tone: 'amber' });
  if (skin?.metadev === 'true' || skin?.metadev === true) rows.push({ label: 'Metadev', tone: 'emerald' });
  if (clean(skin?.upgradesTo)) rows.push({ label: `Upgrades to ${skin.upgradesTo}`, tone: 'emerald' });
  return rows;
}

function Badge({ badge }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-200',
    slate: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    gold: 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-200',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-200',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-200',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-200',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  };
  const saleClass = 'border border-emerald-400/60 bg-emerald-500/15 text-emerald-700 shadow-sm shadow-emerald-500/10 dark:text-emerald-200';
  return (
    <span title={badge.title} className={`${badge.saleBadge ? saleClass : colors[badge.tone] || colors.slate} inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black`}>
      {badge.icon && <img src={badge.icon} className="h-4 w-4 object-contain" loading="lazy" alt="" />}
      {badge.saleBadge && <span className="rounded bg-emerald-500/25 px-1 text-[9px] uppercase text-emerald-800 dark:text-emerald-100">Sale</span>}
      {badge.saleBadge && clean(badge.originalLabel) && <span className="text-red-600 line-through decoration-2 dark:text-red-300">{badge.originalLabel}</span>}
      <span>{badge.label}</span>
    </span>
  );
}

function costFieldIcon(field) {
  if (/idol/i.test(field)) return storeIcon('mc');
  if (/gold/i.test(field)) return storeIcon('gold');
  if (/rankedpoints|glory/i.test(field)) return storeIcon('glory');
  return null;
}

function saleBaseField(field) {
  if (/^IdolSaleCost$/i.test(field)) return 'IdolCost';
  if (/^GoldSaleCost$/i.test(field)) return 'GoldCost';
  return null;
}

function DataValue({ fieldKey, value, sourceData }) {
  const icon = costFieldIcon(fieldKey);
  const isSaleCost = /salecost/i.test(fieldKey);
  const originalValue = isSaleCost ? sourceData?.[saleBaseField(fieldKey)] : null;
  if (icon || isSaleCost) {
    return (
      <span className={`mt-0.5 inline-flex flex-wrap items-center gap-1 text-sm font-black ${isSaleCost ? 'rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-200' : 'text-slate-950 dark:text-white'}`}>
        {icon && <img src={icon} className="h-5 w-5 object-contain" loading="lazy" alt="" />}
        {isSaleCost && <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] uppercase text-emerald-800 dark:text-emerald-100">Sale</span>}
        {isSaleCost && clean(originalValue) && <span className="text-red-600 line-through decoration-2 dark:text-red-300">{renderChangeValue(originalValue)}</span>}
        <span>{renderChangeValue(value)}</span>
      </span>
    );
  }
  return <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans text-sm font-bold text-slate-950 dark:text-white">{renderChangeValue(value)}</pre>;
}

function DataGrid({ title, data }) {
  const rows = Object.entries(data || {}).filter(([_, value]) => clean(renderChangeValue(value)));
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-slate-950 dark:text-white">{title}</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{displayFieldName(key)}</div>
            <DataValue fieldKey={key} value={value} sourceData={data} />
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
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-slate-950 dark:text-white">Color Defines</h4>
      {!!defineRows.length && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {defineRows.map(([key, value]) => {
            const bg = hex(value);
            return (
              <div key={key} className="rounded-lg border border-slate-700 p-3 text-sm font-black" style={{ backgroundColor: bg, color: textColor(bg) }}>
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
            <span key={key} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100">
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
    <div className="flex items-center gap-2 rounded-xl border border-slate-300 p-2 dark:border-slate-700" style={{ backgroundColor: bg, color: textColor(bg) }}>
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
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <h4 className="mb-3 text-base font-black text-slate-950 dark:text-white">Colors</h4>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Default / Fallback</div>
          {skin?.colors?.defaultData ? <ColorPill color={skin.colors.defaultData} /> : clean(skin?.colors?.default) && <span className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black dark:bg-slate-800">{skin.colors.default}</span>}
        </div>
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Excluded Color Schemes</div>
          <div className="flex flex-wrap gap-2">
            {excluded.length ? excluded.map((color) => <ColorPill key={color.ColorSchemeID || color.ColorSchemeName} color={color} />) : fallbackNames.map((name) => <span key={name} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black dark:bg-slate-800">{name}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function weaponTags(weapon) {
  return String(weapon?.MissionTags || weapon?.Tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(clean)
    .slice(2);
}

function weaponDisplayData(weapon) {
  const allowed = new Set(['DisplayNameKey', 'InheritCostumeDefines']);
  return Object.fromEntries(Object.entries(weapon || {}).filter(([key]) => allowed.has(key) || /^CustomArt\d*$/i.test(key)));
}

function WeaponDetail({ weapon }) {
  const data = weaponDisplayData(weapon);
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <div className="flex items-center gap-3">
        <div className="flex h-28 w-36 shrink-0 items-center justify-center rounded-lg bg-white p-2 dark:bg-slate-900">
          <ImageWithLoader
            src={`${host}/game/anim/weapon/${weapon?.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon?.BaseWeapon}Pose/all`}
            alt={weapon?.DisplayNameFull || weapon?.WeaponSkinName}
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 break-words text-lg font-black text-slate-950 dark:text-white">{weapon?.DisplayNameFull || weapon?.WeaponSkinName}</div>
            {clean(weapon?.WeaponSkinID) && (
              <div className="shrink-0 rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                ID {weapon.WeaponSkinID}
              </div>
            )}
          </div>
          {clean(weapon?.WeaponSkinName) && <div className="mt-1 break-words text-xs font-bold text-slate-500 dark:text-slate-400">{weapon.WeaponSkinName}</div>}
        </div>
      </div>
      <div className="mt-3">
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
          <h4 className="mb-3 text-base font-black text-slate-950 dark:text-white">Weapon Data</h4>
          <div className="grid gap-2">
            {Object.entries(data).filter(([_, value]) => clean(renderChangeValue(value))).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{displayFieldName(key)}</div>
                <DataValue fieldKey={key} value={value} sourceData={data} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkinModal({ skin, onClose }) {
  const [animationMode, setAnimationMode] = useState('lockIn');
  const [playbackMode, setPlaybackMode] = useState('loop');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[96rem] overflow-y-auto rounded-2xl border border-slate-700 bg-white p-4 shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Skin #{Number(skin?.index || 0) + 1}</div>
            <h3 className="break-words text-3xl font-black text-slate-950 dark:text-white">{skin?.name || skin?.codeName}</h3>
            {clean(skin?.codeName) && <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{skin.codeName}</div>}
          </div>
          <button className="rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white hover:bg-red-600" onClick={onClose}>Close</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[26rem_1fr]">
          <div className="grid content-start gap-3">
            <div className="flex min-h-72 items-center justify-center rounded-xl bg-slate-100 p-3 dark:bg-slate-950/70">
              <LoadingImage src={skinAnimUrl(skin, selectedAnimationMode, playbackMode)} className="max-h-full max-w-full object-contain" alt={skin?.name || skin?.codeName} />
            </div>
            <div className="grid gap-2 rounded-xl border border-slate-300 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/70">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['idle', 'Idle'],
                  ['lockIn', 'Lock In'],
                ].map(([key, label]) => animationOptions[key] && (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnimationMode(key)}
                    className={`${selectedAnimationMode === key ? 'bg-blue-500 text-white' : 'bg-white text-slate-800 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'} rounded-lg px-3 py-2 text-xs font-black transition`}
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
                    className={`${playbackMode === key ? 'bg-blue-500 text-white' : 'bg-white text-slate-800 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'} rounded-lg px-3 py-2 text-xs font-black transition`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {costBadges(skin).map((badge) => <Badge key={`${badge.title || badge.label}-${badge.label}`} badge={badge} />)}
            </div>
            <TagChips tags={skin?.tagsFull || skin?.tags} />
            {!!weapons.length && (
              <div className="grid gap-3">
                <h4 className="text-base font-black text-slate-950 dark:text-white">Weapons</h4>
                {weapons.map((weapon) => <WeaponDetail key={weapon.WeaponSkinID || weapon.WeaponSkinName} weapon={weapon} />)}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <SkinDefines skin={skin} />
            <DataGrid title="Costume Data" data={costumeData} />
            <DataGrid title="Store Data" data={storeData} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkinCard({ skin, onSelect }) {
  const weapons = asArray(skin?.stuff?.WeaponSet2).slice(0, 2);
  return (
    <button type="button" onClick={() => onSelect(skin)} className="flex flex-col rounded-2xl border border-slate-300 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Skin #{Number(skin?.index || 0) + 1}</div>
          <h3 className="break-words text-lg font-black leading-tight text-slate-950 dark:text-white">{skin?.name || skin?.codeName}</h3>
          {clean(skin?.codeName) && <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{skin.codeName}</div>}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        <div className="flex h-52 items-center justify-center rounded-xl bg-slate-100 p-2 dark:bg-slate-950/70">
          <img src={skinAnimUrl(skin)} className="max-h-full max-w-full object-contain" loading="lazy" alt={skin?.name || skin?.codeName} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {weapons.map((weapon) => (
            <div key={weapon.WeaponSkinID || weapon.WeaponSkinName} className="flex h-32 items-center justify-center rounded-lg bg-slate-100 p-1 dark:bg-slate-950/70">
              <ImageWithLoader
                src={`${host}/game/anim/weapon/${weapon.WeaponSkinID}/UI_TooltipAnimations/a__TooltipAnimation/${weapon.BaseWeapon}Pose/all`}
                alt={weapon.DisplayNameFull || weapon.WeaponSkinName}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {costBadges(skin).map((badge) => <Badge key={badge.label} badge={badge} />)}
      </div>
      <div className="mt-3">
        <TagChips tags={skin?.tagsFull || skin?.tags} />
      </div>
    </button>
  );
}

function SkinsPage({ legend }) {
  const skins = asArray(legend?.skins);
  const [selectedSkin, setSelectedSkin] = useState(null);
  if (!skins.length) {
    return (
      <Section title="Skins">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700 dark:text-amber-200">
          No skin data is available for this legend yet.
        </div>
      </Section>
    );
  }

  return (
    <div className="grid gap-4">
      <Section title={`Skins (${skins.length})`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {skins.map((skin) => <SkinCard key={skin?.id || skin?.codeName} skin={skin} onSelect={setSelectedSkin} />)}
        </div>
      </Section>
      <SkinModal skin={selectedSkin} onClose={() => setSelectedSkin(null)} />
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
          <div key={`${change.path}-${index}`} className="rounded-lg bg-slate-950/5 p-2 font-mono text-xs dark:bg-slate-950/50">
            <div className="mb-1 font-black">{change.path}</div>
            {change.addedValues?.length || change.removedValues?.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                <HighlightedListValue value={change.before} highlighted={change.removedValues} color="text-red-600 dark:text-red-300" />
                <HighlightedListValue value={change.after} highlighted={change.addedValues} color="text-emerald-600 dark:text-emerald-300" />
              </div>
            ) : change.propertyAdded ? (
              <pre className="whitespace-pre-wrap break-words font-black text-emerald-600 dark:text-emerald-300">{renderChangeValue(change.after)}</pre>
            ) : change.propertyRemoved ? (
              <pre className="whitespace-pre-wrap break-words font-black text-red-600 dark:text-red-300">{renderChangeValue(change.before)}</pre>
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
          <HighlightedListValue value={field?.before} highlighted={removedValues} color="text-red-600 dark:text-red-300" />
        </div>
        <div className="rounded-lg bg-emerald-500/5 p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">After</div>
          <HighlightedListValue value={field?.after} highlighted={addedValues} color="text-emerald-600 dark:text-emerald-300" />
        </div>
      </div>
    );
  }
  if (field?.propertyAdded || (isEmptyChangeValue(field?.before) && !isEmptyChangeValue(field?.after))) {
    return <pre className="mt-1 whitespace-pre-wrap break-words font-mono font-black text-emerald-600 dark:text-emerald-300">{renderChangeValue(field?.after)}</pre>;
  }
  if (field?.propertyRemoved || (!isEmptyChangeValue(field?.before) && isEmptyChangeValue(field?.after))) {
    return <pre className="mt-1 whitespace-pre-wrap break-words font-mono font-black text-red-600 dark:text-red-300">{renderChangeValue(field?.before)}</pre>;
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

function usefulSkinFields(group) {
  const costume = group.costume || {};
  const store = group.store || {};
  const rows = [
    ['Name', group.name],
    ['Description', store.DescriptionKey || costume.DescriptionKey],
    ['Internal Name', costume.CostumeName || store.Item || store.StoreName],
    ['Costume ID', costume.CostumeID],
    ['Store ID', store.StoreID],
    ['Weapon Set', costume.WeaponSet || group.skin?.stuff?.WeaponSet],
    ['Mammoth Coins', store.IdolCost],
    ['Sale Mammoth Coins', store.IdolSaleCost],
    ['Gold', store.GoldCost],
    ['Glory', store.GloryCost],
    ['Special Currency', [store.SpecialCurrencyType, store.SpecialCurrencyCost].filter(clean).join(' ')],
    ['Popularity', store.Popularity],
    ['Label', store.Label === 'LastChance' ? store.Label : ''],
  ];
  return rows.filter(([, value]) => clean(value));
}

function usefulSkinChangeFields(rows) {
  const allowed = new Set([
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
  return rows
    .flatMap((row) => asArray(row.record?.fields))
    .filter((field) => allowed.has(field?.field))
    .filter((field) => field.field !== 'Label' || field.before === 'LastChance' || field.after === 'LastChance');
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
    skins: skinGroupsList.filter((group) => group.type !== 'changed' || usefulSkinChangeFields(group.rows).length > 0),
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
    || (parts && name.startsWith(parts.prefix) && (!parts.suffix || name.endsWith(parts.suffix)))
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

function StatMiniLine({ source, base }) {
  return (
    <div className="grid gap-1.5">
      {stats.map((stat) => {
        const value = statValue(source, stat);
        const baseValue = statValue(base, stat);
        return (
          <div key={stat.key} className="grid grid-cols-[1.5rem_1fr_1.75rem] items-center gap-1.5">
            <img src={stat.icon} className="h-5 w-5 object-contain" alt={stat.label} />
            <div className="flex min-w-0">
              {Array.from({ length: 10 }, (_, index) => (
                <img key={index} src={`/game/${statPipIcon(value, baseValue, index)}.png`} className="h-4 w-3.5 shrink-0 object-fill" alt="" aria-hidden="true" />
              ))}
            </div>
            <span className="text-right text-xs font-black">{value}</span>
          </div>
        );
      })}
    </div>
  );
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
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
      <div className="flex items-center gap-3">
        {clean(data?.IconName) && <img src={`${host}/game/getGfx/${data.IconFileName || 'UI_Icons'}/${data.IconName}/1`} className="h-10 w-10 object-contain" alt="" />}
        <div className="min-w-0">
          <div className="text-sm font-black leading-tight">{data?.StanceName || row.record?.name || 'Stance'}</div>
          {!!deltas.length && (
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-black">
              {deltas.map((stat) => (
                <span key={stat.key} className={stat.diff > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
                  {displayFieldName(stat.runeKey)} {stat.diff > 0 ? '+' : ''}{stat.diff}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {isBase ? (
        <div className="mt-3 rounded-lg bg-white/65 p-2 dark:bg-slate-950/45">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">Stats</div>
          <StatMiniLine source={after || before} base={after || before || legend?.stances} />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-white/65 p-2 dark:bg-slate-950/45">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wide opacity-70">{row.type === 'added' ? 'Base' : 'Before'}</div>
            <StatMiniLine source={before} base={legend?.stances} />
          </div>
          <div className="rounded-lg bg-white/65 p-2 dark:bg-slate-950/45">
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
    <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-2 dark:bg-slate-950/70">
          {weaponImageUrl(data) && <img src={weaponImageUrl(data)} className="max-h-full max-w-full object-contain" loading="lazy" alt={row.record?.name || data?.WeaponSkinName} />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">{displayWeaponName(data?.BaseWeapon || 'Weapon')}</div>
          <div className="break-words text-base font-black text-slate-950 dark:text-white">{row.record?.name || data?.WeaponSkinName}</div>
          {clean(data?.WeaponSkinName) && <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{data.WeaponSkinName}</div>}
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
  const fields = group.type === 'added' ? usefulSkinFields(group) : [];
  const changeFields = usefulSkinChangeFields(group.rows);
  const changeFieldGrid = changeFields.length <= 1
    ? 'mt-3 grid gap-2'
    : 'mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3';
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-3 lg:grid-cols-[12rem_1fr]">
        <div className="grid gap-2">
          <div className="flex h-44 items-center justify-center rounded-xl bg-slate-100 p-2 dark:bg-slate-950/70">
            {image && <img src={image} className="max-h-full max-w-full object-contain" loading="lazy" alt={group.name || group.costume?.CostumeName || group.store?.StoreName} />}
          </div>
          {!!weapons.length && (
            <div className="grid grid-cols-2 gap-2">
              {weapons.map((weapon) => (
                <div key={weapon.WeaponSkinID || weapon.WeaponSkinName} className="flex h-20 items-center justify-center rounded-lg bg-slate-100 p-1 dark:bg-slate-950/70">
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
          <div className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">{group.type === 'added' ? 'Skin Added' : 'Skin Updated'}</div>
          <h4 className="break-words text-xl font-black text-slate-950 dark:text-white">{group.name || group.costume?.CostumeName || group.store?.StoreName}</h4>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
                <div className="mt-0.5 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
          {!!changeFields.length && (
            <div className={changeFieldGrid}>
              {changeFields.map((field, index) => (
                <div key={`${field.field}-${index}`} className="rounded-lg bg-blue-500/10 p-2 text-sm font-bold text-blue-700 dark:text-blue-200">
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
        </div>
      </div>
    </div>
  );
}

function VisualHistorySection({ title, children, count }) {
  if (!count) return null;
  return (
    <details open className="group rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:hidden">
        <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
        <span className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{count}</span>
          <span className="text-sm font-black text-slate-500 transition group-open:rotate-180 dark:text-slate-400">v</span>
        </span>
      </summary>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">{children}</div>
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
        <div className="grid gap-3 lg:grid-cols-2">
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{key}</div>
          <pre className="mt-1 whitespace-pre-wrap break-words font-sans font-bold text-slate-900 dark:text-white">{renderChangeValue(value)}</pre>
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
      <span className="text-red-600 dark:text-red-300">{rawPropertyValue(detail.before)}</span>
      {' -> '}
      <span className="text-emerald-600 dark:text-emerald-300">{rawPropertyValue(detail.after)}</span>
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
          ? side === 'before' ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'
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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-white/60 px-3 py-2 dark:bg-slate-950/50">
        {field.details.map((detail) => <CommonPowerDelta key={`${detail.action}-${detail.path}`} field={field} detail={detail} />)}
      </div>
    );
  }
  return (
    <div className="mt-2 grid gap-2">
      {field.variants.map((variant, index) => (
        <div key={index} className="rounded-lg bg-white/60 p-2 dark:bg-slate-950/50">
          {field.variants.length > 1 && <div className="mb-2 text-xs font-black opacity-70">{variant.count} powers</div>}
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg bg-red-500/5 p-2">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-300">Before</div>
              <HighlightedPropertyData value={variant.before} details={field.details} side="before" />
            </div>
            <div className="rounded-lg bg-emerald-500/5 p-2">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">After</div>
              <HighlightedPropertyData value={variant.after} details={field.details} side="after" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangeList({ title, items, tone, file }) {
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
    added: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    changed: 'border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-200',
    removed: 'border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200',
  }[tone] || 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200';

  return (
    <details open className="group rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:hidden">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</span>
        <span className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
          {sourceRows.length}
          <span className="transition group-open:rotate-180">v</span>
        </span>
      </summary>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      {!!summarized.commonFields.length && (
        <div className="mb-3 grid gap-2">
          {summarized.commonFields.map((field) => (
            <div key={field.field} className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-3 text-sm font-black text-blue-700 dark:text-blue-200">
              <div>{commonPowerFieldMessage(field)}</div>
              <CommonPowerFieldData field={field} />
            </div>
          ))}
        </div>
      )}
      {!!rows.length && <div className={recordGridClass}>
        {rows.map((item, index) => (
          <div key={`${item?.id || item?.name || index}`} className={`rounded-lg border p-3 ${toneClass}`}>
            <div className="font-black">{item?.name || item?.id || `${title} ${index + 1}`}</div>
            {item?.fields ? (
              <div className={asArray(item.fields).length === 1 ? 'mt-2 grid gap-2' : isPowerFile ? 'mt-2 grid gap-2 lg:grid-cols-2' : isHurtboxFile ? 'mt-2 grid gap-2 lg:grid-cols-3' : 'mt-2 grid gap-2 md:grid-cols-2 2xl:grid-cols-3'}>
                {asArray(item.fields).map((field, fieldIndex) => (
                  <div key={`${field?.field || fieldIndex}`} className="rounded-lg bg-white/60 p-2 text-sm dark:bg-slate-950/50">
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
  return (
    <details open className="group rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 marker:hidden">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">{file?.section}/{file?.file}</div>
          <div className="text-lg font-black text-slate-950 dark:text-white">{file?.label || file?.file}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
          {!!file?.summary?.added && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-200">+{file.summary.added}</span>}
          {!!file?.summary?.changed && <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-200">~{file.summary.changed}</span>}
          {!!file?.summary?.removed && <span className="rounded-lg bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-200">-{file.summary.removed}</span>}
          <span className="ml-1 text-sm text-slate-500 transition group-open:rotate-180 dark:text-slate-400">v</span>
        </div>
      </summary>
      <div className="grid gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
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
    return <div className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">No visible changes match these filters.</div>;
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

function HistoryPage({ legend, history }) {
  const entries = asArray(history?.history || history);
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
      <Section title="Historical Changes">
        {beta ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoChip label="First Seen" value={formatDate(legend?.beta?.firstSeen?.dateTime || legend?.beta?.firstSeen?.date)} />
            <InfoChip label="Last Seen" value={formatDate(legend?.beta?.lastSeen?.dateTime || legend?.beta?.lastSeen?.date)} />
            <InfoChip label="First Patch" value={legend?.beta?.firstSeen?.patch} />
            <InfoChip label="Last Patch" value={legend?.beta?.lastSeen?.patch} />
            <InfoChip label="Source Hero IDs" value={asArray(legend?.beta?.sourceHeroIDs).join(', ')} />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
            No dedicated legend history entries were returned by the API yet. The page is ready to render them when `/game/history/legend/{legend.id}` starts returning timeline data.
          </div>
        )}
      </Section>
    );
  }

  return (
    <Section title={`Historical Changes (${entries.length})`}>
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Change Category</span>
            <select
              value={category}
              onChange={(event) => {
                const value = event.target.value;
                setCategory(value);
                if (value !== 'all' && value !== 'signatures') setSignature('');
              }}
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {historyCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Signature</span>
            <select
              value={signature}
              onChange={(event) => {
                const value = event.target.value;
                setSignature(value);
                if (value) setCategory('signatures');
              }}
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">All Signatures</option>
              {signatures.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Patch ({filteredEntries.length})</span>
            <select
              value={selectedPatch}
              onChange={(event) => setSelectedPatch(event.target.value)}
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Select a patch</option>
              {filteredEntries.map(({ key, entry }) => (
                <option key={key} value={key}>
                  Patch {entry?.patch || entry?.version || 'Unknown'}{clean(entry?.date) ? ` - ${formatDate(entry.date)}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!filteredEntries.length && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-700 dark:text-amber-200">
            No patches contain changes matching these filters.
          </div>
        )}
      </div>

      <div className="mt-3">
        {!selected && filteredEntries.length > 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-400">
            Select a patch to load its changes.
          </div>
        )}
        {selected && (
          <div key={selected.key} className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
            <div className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
                <span>Patch {selected.entry?.patch || selected.entry?.version || 'Unknown'}</span>
                {clean(selected.entry?.date) && <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(selected.entry.date)}</span>}
                <span className="rounded-lg bg-slate-200 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoChip label="Original Hero ID" value={legend?.originalId} />
        <InfoChip label="First Patch" value={legend?.beta?.firstSeen?.patch} />
        <InfoChip label="Last Patch" value={legend?.beta?.lastSeen?.patch} />
        <InfoChip label="Source Hero IDs" value={asArray(legend?.beta?.sourceHeroIDs).join(', ')} />
      </div>
    </Section>
  );
}

const LegendPage = ({ legend, prevLegends = [], nextLegends = [], history }) => {
  const [currentTab, setCurrentTab] = useState("main");
  const [activeStance, setActiveStance] = useState("base");
  const [historyData, setHistoryData] = useState(history ?? null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRequest, setHistoryRequest] = useState(0);

  const safePrev = useMemo(() => asArray(prevLegends).filter(Boolean), [prevLegends]);
  const safeNext = useMemo(() => asArray(nextLegends).filter(Boolean), [nextLegends]);

  useEffect(() => {
    if (currentTab !== "history" || historyData || !legend?.id) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    fetch(`${host}/game/history/legend/${encodeURIComponent(legend.id)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load history (${response.status})`);
        return response.json();
      })
      .then(setHistoryData)
      .catch((error) => {
        if (error?.name !== "AbortError") setHistoryError(error?.message || "Failed to load legend history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [currentTab, historyData, historyRequest, legend?.id]);

  if (!legend) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-center font-bold text-red-700 dark:text-red-200">
          Legend data could not be loaded.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'BHLatinBold, BHSlim, sans-serif' }} className="min-h-screen bg-slate-100 p-3 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-4">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-4">
        <HeroHeader legend={legend} prevLegends={safePrev} nextLegends={safeNext} />

        <nav className="flex flex-wrap justify-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setCurrentTab(tab.key)} className={`${currentTab === tab.key ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-800 hover:bg-blue-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800'} rounded-xl px-4 py-2 text-sm font-black transition`}>
              {tab.label}
            </button>
          ))}
        </nav>

        {currentTab === "main" && (
          <div className="grid gap-4 xl:grid-cols-[28rem_1fr]">
            <div className="grid content-start gap-4">
              <StatViewer legend={legend} activeStance={activeStance} setActiveStance={setActiveStance} />
              <HomeStages legend={legend} />
              <BetaIntel legend={legend} />
            </div>
            <Biography legend={legend} />
          </div>
        )}

        {currentTab === "weapons" && <SignaturePanel legend={legend} />}
        {currentTab === "skins" && <SkinsPage legend={legend} />}
        {currentTab === "history" && (
          historyLoading ? (
            <div className="relative min-h-48 overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <LoadingSpinner />
            </div>
          ) : historyError ? (
            <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-center">
              <div className="font-black text-red-700 dark:text-red-200">{historyError}</div>
              <button
                type="button"
                onClick={() => setHistoryRequest((value) => value + 1)}
                className="mt-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-black text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <HistoryPage legend={legend} history={historyData} />
          )
        )}
      </div>
    </div>
  );
};

export default LegendPage;
