import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";
import { host } from "../../stuff";
import {
  EmptyState, ErrorState, LoadingState, PageHeader, PageShell as KitShell, Pagination as KitPagination, Pill,
  SearchInput as KitSearch, Section, SelectInput, Tabs as KitTabs, REGIONS,
} from "../ui";

countries.registerLocale(english);


export function apiUrl(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return `${host}/v2/esports${path}${suffix ? `?${suffix}` : ""}`;
}

export const LIVE_REFRESH_MS = 60_000;

export async function fetchAllPages(path, params = {}, { perPage = 100, maxPages = 100, list = (data) => data?.items ?? [], onProgress } = {}) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(apiUrl(path, { ...params, page, perPage }));
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();
    rows.push(...list(data));
    const totalPages = Math.min(maxPages, data?.totalPages ?? data?.pagination?.totalPages ?? 1);
    onProgress?.(page, totalPages);
    if (page >= totalPages) break;
  }
  return rows;
}

export function useApi(url, { refreshMs = 0, refreshWhile } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url), updatedAt: null });
  const latest = useRef(state);
  latest.current = state;
  const condition = useRef(refreshWhile);
  condition.current = refreshWhile;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false, updatedAt: null });
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
      .then((data) => setState({ data, error: null, loading: false, updatedAt: Date.now() }))
      .catch((error) => {
        if (error.name !== "AbortError") setState((previous) => ({ ...previous, error: error.message, loading: false }));
      });
    return () => controller.abort();
  }, [url, attempt]);
  useEffect(() => {
    if (!url || !refreshMs) return undefined;
    let controller = null;
    const refresh = () => {
      const current = latest.current;
      if (document.visibilityState !== "visible" || current.loading || !current.data) return;
      if (condition.current && !condition.current(current.data)) return;
      if (current.updatedAt && Date.now() - current.updatedAt < refreshMs - 1000) return;
      controller?.abort();
      controller = new AbortController();
      fetch(url, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((data) => setState({ data, error: null, loading: false, updatedAt: Date.now() }))
        .catch(() => {});
    };
    const timer = setInterval(refresh, Math.min(refreshMs, 15_000));
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      controller?.abort();
    };
  }, [url, refreshMs]);
  return { ...state, retry };
}

export const vodTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(hours ? 2 : 1, "0");
  return `${hours ? `${hours}:` : ""}${minutes}:${String(total % 60).padStart(2, "0")}`;
};

export const vodTitle = (stream) => `Watch on the ${stream.name} VOD from ${vodTime(stream.vod.offsetSeconds)}${stream.vod.estimated ? " (start time estimated)" : ""}`;

export const youtubeLabel = (youtube) => youtube.kind === "set" ? "Set VOD" : `Stream VOD at ${youtube.estimated ? "about " : ""}${vodTime(youtube.offsetSeconds)}`;

export const youtubeTitle = (youtube) => youtube.kind === "set"
  ? `${youtube.title} (${youtube.channel} on YouTube)`
  : `${youtube.title} (${youtube.channel} on YouTube)${youtube.featured ? "" : ". Official stream at the time this set started; it may not be the set on screen"}`;

export function StreamBadge({ stream, youtube, className = "" }) {
  if (!stream?.name && !youtube) return null;
  const target = youtube?.url ?? stream?.vod?.url ?? stream?.url;
  const open = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };
  const title = youtube ? `YouTube ${youtubeLabel(youtube)}: ${youtubeTitle(youtube)}`
    : stream.vod ? vodTitle(stream) : stream.url ? `Streamed on ${stream.name}` : `Assigned to stream ${stream.name}`;
  return (
    <span
      role={target ? "link" : undefined}
      tabIndex={target ? 0 : undefined}
      onClick={open}
      onKeyDown={(event) => { if (event.key === "Enter") open(event); }}
      title={title}
      className={`inline-flex max-w-[9rem] items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black text-white shadow ${youtube ? "bg-red-600" : "bg-violet-600"} ${target ? `cursor-pointer ${youtube ? "hover:bg-red-500" : "hover:bg-violet-500"}` : ""} ${className}`}
    >
      <span aria-hidden="true">▶</span>
      <span className="truncate">{stream?.name ?? "YouTube"}</span>
      {(youtube || stream?.vod) && <span className="shrink-0 rounded bg-white/20 px-1">{youtube?.kind === "set" ? "Set" : "VOD"}</span>}
    </span>
  );
}

export function LiveUpdates({ updatedAt, every = LIVE_REFRESH_MS }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!updatedAt) return null;
  const ago = Math.max(0, Math.round((now - updatedAt) / 1000));
  const next = Math.max(0, Math.round((updatedAt + every - now) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300" title="Refreshes automatically while the event is live">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      Live · updated {ago}s ago{next > 0 ? ` · next in ${next}s` : " · updating"}
    </span>
  );
}

export { useDebounced, useQueryState } from "../ui";


export { REGIONS, OFFICIAL_REGIONS, officialRegions } from "../ui";
export const regionName = (code) =>
  !code || code === "ALL" ? "Global" : REGIONS.find(([key]) => key === code)?.[1] ?? code;
export const cleanEntrantName = (name) => {
  if (typeof name !== "string") return name;
  const stripped = name.replace(/\s*['’]s?\s+party$/i, "").trim();
  return stripped || name;
};
export const isDeletedAccountName = (name) =>
  typeof name === "string" && /^(deleted user|user with user id .+ deleted at .+)$/i.test(name.trim());
export const DELETED_ACCOUNT_NOTE = "start.gg account deleted";
const latinKey = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export const isLostSpelling = (name, current) =>
  typeof name === "string" && name.includes("?") && latinKey(name).length >= 3 && latinKey(name) === latinKey(current);
export const slotIsDq = (slot) => Boolean(slot?.dq) || (slot?.score != null && Number(slot.score) < 0);
export const isWalkover = (set) => Boolean(set?.walkover) || ((set?.slots ?? []).length === 2 && set.slots.some(slotIsDq));
export const isPlayedSet = (set) => (set?.slots ?? []).length === 2 && !isWalkover(set);
export function resultMark(set, slot, won, decided) {
  if (!slot) return "";
  if (isWalkover(set)) return won ? "W" : slotIsDq(slot) ? "DQ" : decided ? "L" : "";
  if (slot.score != null) return slot.score;
  return decided ? (won ? "W" : "L") : "";
}
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


export function PageShell({ eyebrow, title, subtitle, meta, actions, back, aside, asideLabel, children }) {
  return (
    <KitShell aside={aside} asideLabel={asideLabel}>
      {back && (
        <a href={back.href} className="-my-2 inline-flex max-w-full items-center gap-1 py-2.5 text-sm font-bold text-blue-300 hover:text-blue-200">
          <span aria-hidden="true">←</span><span className="truncate">{back.label}</span>
        </a>
      )}
      {(title || actions) && <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} meta={meta} actions={actions} />}
      {children}
    </KitShell>
  );
}

const InCard = createContext(false);

export function Card({ title, action, children, className = "", padded = true, id }) {
  return (
    <Section id={id} title={title} actions={action} headingAs="h2" padded={padded} className={`overflow-hidden ${className}`}>
      <InCard.Provider value>{children}</InCard.Provider>
    </Section>
  );
}

const badgeTone = { slate: "slate", blue: "blue", amber: "amber", green: "emerald", red: "rose", violet: "violet", sky: "sky" };

export function Badge({ children, tone = "slate", title }) {
  return <Pill tone={badgeTone[tone] || tone} title={title}>{children}</Pill>;
}

export function Tabs({ tabs, value, onChange, variant = "primary", label }) {
  return <KitTabs variant={variant} label={label} value={value} onChange={onChange} items={tabs.map((tab) => ({ value: tab.key, label: tab.label, count: tab.count, title: tab.title }))} />;
}

export function Select({ label, value, onChange, options }) {
  return <SelectInput inline={false} label={label} value={value} onChange={onChange} options={options.map(([key, text]) => ({ value: key, label: text }))} />;
}

export function SearchInput({ value, onChange, placeholder = "Search", autoFocus = false }) {
  return <KitSearch value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} />;
}

export function Pagination({ page, totalPages, onChange }) {
  return <KitPagination page={page} totalPages={totalPages} onChange={onChange} />;
}

export function Loading({ label = "Loading…", bare }) {
  const inCard = useContext(InCard);
  return <LoadingState label={label} rows={3} bare={bare ?? inCard} />;
}

export function ErrorNote({ message, onRetry }) {
  const generic = !message || /request failed|failed to fetch|networkerror/i.test(message);
  const missing = !generic && /not found/i.test(message);
  return <ErrorState message={generic ? "Couldn't load this. Try again in a moment." : message} detail={generic ? message : undefined} onRetry={missing ? undefined : onRetry} />;
}

export function Empty({ children, action, bare }) {
  const inCard = useContext(InCard);
  return <EmptyState title={children} action={action} bare={bare ?? inCard} />;
}


export const avatarUrl = (playerId) => (playerId ? apiUrl(`/players/${playerId}/avatar`) : null);

export function Avatar({ src, name, size = "md", playerId }) {
  const source = src || avatarUrl(playerId);
  const [failed, setFailed] = useState(null);
  const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl", xl: "h-28 w-28 text-3xl" };
  if (source && failed !== source) {
    return <img src={source} alt="" loading="lazy" onError={() => setFailed(source)} className={`${sizes[size]} shrink-0 rounded-full object-cover bg-slate-800`} />;
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
        <div className="flex items-center gap-1.5 truncate font-black text-white">
          <FlagIcon country={country} className="h-4 w-4" />
          <span className="truncate">{name || "Unknown player"}</span>
        </div>
        {detail && <div className="truncate text-xs font-semibold text-slate-400">{detail}</div>}
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
    <span className="inline-flex items-center gap-2 text-xs font-black tabular-nums text-slate-300">
      <span title="1st place finishes">🥇 {gold}</span>
      <span title="2nd place finishes">🥈 {silver}</span>
      <span title="3rd place finishes">🥉 {bronze}</span>
    </span>
  );
}

export function ProviderLink({ provider, url }) {
  if (!url) return <Badge>{provider === "challengermode" ? "Challengermode" : "start.gg"}</Badge>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-black hover:underline text-blue-300">
      View on {provider === "challengermode" ? "Challengermode" : "start.gg"} ↗
    </a>
  );
}
