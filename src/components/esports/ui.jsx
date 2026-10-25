import React, { useEffect, useState } from "react";
import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";
import { host } from "../../stuff";

countries.registerLocale(english);


export function apiUrl(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return `${host}/v2/esports${path}${suffix ? `?${suffix}` : ""}`;
}

export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || `Request failed (${response.status})`);
        }
        return response.json();
      })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setState((previous) => ({ ...previous, error: error.message, loading: false }));
      });
    return () => controller.abort();
  }, [url]);
  return state;
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useQueryState(key, fallback) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl !== null) setValue(fromUrl);
  }, [key]);
  const update = (next) => {
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    if (next === fallback || next === "" || next === null) params.delete(key);
    else params.set(key, next);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  };
  return [value, update];
}


export const REGIONS = [
  ["NA", "North America"], ["EU", "Europe"], ["SA", "South America"],
  ["SEA", "Southeast Asia"], ["AUS", "Australia"], ["MENA", "Middle East"],
];
export const regionName = (code) =>
  !code || code === "ALL" ? "Global" : REGIONS.find(([key]) => key === code)?.[1] ?? code;
export const modeName = (mode) => (Number(mode) === 2 ? "2v2" : Number(mode) === 1 ? "1v1" : "Other");

export const number = (value) => Number(value ?? 0).toLocaleString("en-US");
export const points = (value) => Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
export const money = (value) => `$${Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const percent = (wins, total) => (total > 0 ? `${Math.round((wins / total) * 100)}%` : "—");

export function date(value, options = { dateStyle: "medium" }) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", options).format(parsed);
}

export function ordinal(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
}

export function flag(country) {
  if (!country) return null;
  const code = country.length === 2 ? country.toUpperCase() : countries.getAlpha2Code(country, "en");
  if (!code) return null;
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)));
}

export function FlagIcon({ country, className = "h-5 w-5" }) {
  if (!country) return null;
  const code = country.length === 2 ? country.toUpperCase() : countries.getAlpha2Code(country, "en");
  if (!code) return null;
  const file = [...code].map((letter) => (127397 + letter.charCodeAt(0)).toString(16)).join("-");
  return <img src={`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${file}.svg`} alt={country} title={country} loading="lazy" className={`inline-block shrink-0 ${className}`} />;
}


export function PageShell({ eyebrow, title, subtitle, actions, back, children }) {
  return (
    <div className="mx-auto w-full max-w-[120rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {back && (
        <a href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300">
          ← {back.label}
        </a>
      )}
      {(title || actions) && (
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && <div className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">{eyebrow}</div>}
            {title && <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">{title}</h1>}
            {subtitle && <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600 dark:text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = "", padded = true }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-black text-slate-950 dark:text-white">{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}


export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-black transition ${
            value === tab.key
              ? "bg-blue-500 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 opacity-70">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search...", autoFocus = false }) {
  return (
    <input
      type="search"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
    />
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const button = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-black disabled:opacity-40 dark:border-slate-700";
  return (
    <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="tabular-nums">Page {page} of {number(totalPages)}</span>
      <button type="button" className={button} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}


export function Loading({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm font-bold text-slate-500 dark:text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }) {
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      {message}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm font-bold text-slate-500 dark:text-slate-400">{children}</div>;
}


export const avatarUrl = (playerId) => (playerId ? apiUrl(`/players/${playerId}/avatar`) : null);

export function Avatar({ src, name, size = "md", playerId }) {
  const source = src || avatarUrl(playerId);
  const [failed, setFailed] = useState(null);
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl", xl: "h-28 w-28 text-3xl" };
  if (source && failed !== source) {
    return <img src={source} alt="" loading="lazy" onError={() => setFailed(source)} className={`${sizes[size]} shrink-0 rounded-full bg-slate-200 object-cover dark:bg-slate-800`} />;
  }
  const initials = String(name || "?").replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${sizes[size]} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-black text-white`}>
      {initials || "?"}
    </div>
  );
}

export function PlayerChip({ id, name, image, country, detail, size = "md" }) {
  const body = (
    <>
      <Avatar src={image} name={name} size={size} playerId={id} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate font-black text-slate-950 dark:text-white">
          <FlagIcon country={country} className="h-4 w-4" />
          <span className="truncate">{name || "Unknown player"}</span>
        </div>
        {detail && <div className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</div>}
      </div>
    </>
  );
  return id
    ? <a href={`/esports/player/id/${id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">{body}</a>
    : <div className="flex min-w-0 items-center gap-3">{body}</div>;
}

export function Medals({ gold = 0, silver = 0, bronze = 0 }) {
  if (!gold && !silver && !bronze) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-black tabular-nums text-slate-600 dark:text-slate-300">
      <span title="1st place finishes">🥇 {gold}</span>
      <span title="2nd place finishes">🥈 {silver}</span>
      <span title="3rd place finishes">🥉 {bronze}</span>
    </span>
  );
}

export function ProviderLink({ provider, url }) {
  if (!url) return <Badge>{provider === "challengermode" ? "Challengermode" : "start.gg"}</Badge>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:underline dark:text-blue-300">
      View on {provider === "challengermode" ? "Challengermode" : "start.gg"} ↗
    </a>
  );
}
