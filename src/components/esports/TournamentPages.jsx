import React, { useMemo, useRef, useState } from "react";
import {
  apiUrl, Avatar, Badge, Card, date, Empty, ErrorNote, LIVE_REFRESH_MS, LiveUpdates, Loading, modeName, number, ordinal, PageShell,
  Pagination, points, ProviderLink, regionName, SearchInput, Select, StreamBadge, Tabs, useApi, useDebounced, useQueryState,
} from "./ui";

const eventIsLive = (data) => data?.event?.state === "active";

const stateLabel = { upcoming: "Upcoming", active: "Live", complete: "Completed", cancelled: "Cancelled" };
const stateTone = { upcoming: "amber", active: "green", complete: "slate", cancelled: "red" };

function Banner({ image }) {
  return image
    ? <img src={image} alt="" loading="lazy" className="aspect-video w-full rounded-xl bg-slate-200 object-cover dark:bg-slate-800" />
    : <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900" />;
}


export function TournamentsPage() {
  const [search, setSearch] = useQueryState("search", "");
  const [official, setOfficial] = useQueryState("official", "all");
  const [state, setState] = useQueryState("state", "all");
  const [provider, setProvider] = useQueryState("provider", "all");
  const [page, setPage] = useState(1);
  const query = useDebounced(search.trim());
  const list = useApi(apiUrl("/tournaments", {
    search: query || undefined,
    official: official === "all" ? undefined : official,
    state: state === "all" ? undefined : state,
    provider: provider === "all" ? undefined : provider,
    page,
    perPage: 50,
  }));
  const reset = (setter) => (value) => { setter(value); setPage(1); };
  const items = (list.data?.items ?? []).filter((tournament) => !tournament.date_outlier);
  const pill = (active) => `rounded-lg px-3 py-1.5 text-sm font-black transition ${active ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`;

  return (
    <PageShell
      eyebrow="Brawlhalla esports"
      title="Tournaments"
      back={{ href: "/esports", label: "Esports Database" }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {[["all", "All"], ["official", "Official"], ["tier1", "Tier 1"], ["community", "Community"]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => reset(setOfficial)(key)} className={pill(official === key)}>{label}</button>
          ))}
        </div>
        <div className="w-full sm:w-72"><SearchInput value={search} onChange={reset(setSearch)} placeholder="Search tournaments" /></div>
        <select value={state} onChange={(event) => reset(setState)(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          {[["all", "Any status"], ["upcoming", "Upcoming"], ["active", "Live"], ["complete", "Completed"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={provider} onChange={(event) => reset(setProvider)(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          {[["all", "Any site"], ["startgg", "start.gg"], ["challengermode", "Challengermode"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <span className="ml-auto text-sm font-bold text-slate-500">{list.data ? `${number(list.data.total)} tournaments` : ""}</span>
      </div>
      {list.error && <ErrorNote message={list.error} />}
      {!list.data && list.loading && <Loading label="Loading tournaments..." />}
      {list.data && !items.length && <Card><Empty>No tournaments match these filters.</Empty></Card>}
      {items.length > 0 && (
        <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${list.loading ? "opacity-60" : ""}`}>
          <div className="grid xl:grid-cols-2">
            {items.map((tournament) => (
              <a
                key={tournament.id}
                href={`/esports/tournament/${tournament.id}`}
                className="group flex items-center gap-3 border-b border-slate-100 px-3 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 xl:odd:border-r"
              >
                {tournament.image
                  ? <img src={tournament.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-slate-200 object-cover dark:bg-slate-800" />
                  : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-200 text-sm font-black text-slate-500 dark:bg-slate-800">{String(tournament.name ?? "?")[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-950 group-hover:text-blue-500 dark:text-white">{tournament.name}</div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <span>{date(tournament.starts_at)}</span>
                    <span>· {tournament.provider === "challengermode" ? "Challengermode" : "start.gg"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {tournament.classification === "official" && <Badge tone="blue">Official</Badge>}
                  {tournament.classification === "tier1-community" && <Badge tone="amber">Tier 1</Badge>}
                  {tournament.state !== "complete" && <Badge tone={stateTone[tournament.state]}>{stateLabel[tournament.state] ?? tournament.state}</Badge>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      <Pagination page={page} totalPages={list.data?.totalPages} onChange={setPage} />
    </PageShell>
  );
}


export function TournamentPage({ tournamentId }) {
  const detail = useApi(apiUrl(`/tournaments/${tournamentId}`));
  const data = detail.data;
  if (detail.error) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}><ErrorNote message={detail.error} /></PageShell>;
  if (!data) return <PageShell><Loading label="Loading tournament..." /></PageShell>;
  const tournament = data.tournament;
  const events = data.events ?? [];

  return (
    <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}>
      <TournamentHeader tournament={tournament} />
      {events.length === 1
        ? <div className="mt-6"><EventBody eventId={events[0].id} /></div>
        : (
          <Card title="Events" className="mt-6" padded={false}>
            {!events.length && <Empty>No events were published for this tournament.</Empty>}
            {events.map((event) => (
              <a key={event.id} href={`/esports/event/${event.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-950 dark:text-white">{event.name}</div>
                  <div className="text-xs font-semibold text-slate-500">{modeName(event.game_mode)}{event.region ? ` · ${regionName(event.region)}` : ""}</div>
                </div>
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">{number(event.entrant_count)} entrants</div>
              </a>
            ))}
          </Card>
        )}
    </PageShell>
  );
}

function TournamentHeader({ tournament, eventName }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[18rem_minmax(0,1fr)]">
      <Banner image={tournament.image ?? tournament.tournament_image} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {(tournament.classification === "official" || tournament.is_official) && <Badge tone="blue">Official</Badge>}
          {tournament.state && <Badge tone={stateTone[tournament.state]}>{stateLabel[tournament.state] ?? tournament.state}</Badge>}
        </div>
        <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{tournament.name ?? tournament.tournament_name}</h1>
        {eventName && eventName !== (tournament.name ?? tournament.tournament_name) && (
          <div className="mt-1 text-lg font-black text-slate-600 dark:text-slate-300">{eventName}</div>
        )}
        <div className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
          {date(tournament.starts_at, { dateStyle: "long" })}
          {tournament.host_name && !tournament.host_name.startsWith("user/") && <> · Hosted by {tournament.host_name}</>}
        </div>
        <div className="mt-3"><ProviderLink provider={tournament.provider} url={tournament.url ?? tournament.tournament_url} /></div>
      </div>
    </section>
  );
}


export function EventPage({ eventId }) {
  const detail = useApi(apiUrl(`/events/${eventId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: eventIsLive });
  const event = detail.data?.event;
  return (
    <PageShell back={event ? { href: `/esports/tournament/${event.tournament_id}`, label: event.tournament_name } : { href: "/esports/tournaments", label: "Tournaments" }}>
      {detail.error && <ErrorNote message={detail.error} />}
      {!detail.data && !detail.error && <Loading label="Loading event..." />}
      {event && (
        <>
          <TournamentHeader
            eventName={event.name}
            tournament={{
              name: event.tournament_name, image: event.tournament_image, url: event.tournament_url,
              provider: event.provider, starts_at: event.starts_at, state: event.state, is_official: event.is_official,
            }}
          />
          <div className="mt-6"><EventBody eventId={eventId} preloaded={detail.data} updatedAt={detail.updatedAt} /></div>
        </>
      )}
    </PageShell>
  );
}

function EventBody({ eventId, preloaded, updatedAt }) {
  const fetched = useApi(preloaded ? null : apiUrl(`/events/${eventId}`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: eventIsLive });
  const data = preloaded ?? fetched.data;
  const [tab, setTab] = useQueryState("view", "standings");
  if (!data) return fetched.error ? <ErrorNote message={fetched.error} /> : <Loading />;
  const event = data.event;
  const facts = [
    modeName(event.game_mode),
    event.region && regionName(event.region),
    `${number(event.entrant_count)} entrants`,
  ].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "standings", label: "Standings" },
            { key: "matches", label: "Matches", count: data.sets?.length },
            ...(data.contributions?.length ? [{ key: "points", label: "Ranking points" }] : []),
          ]}
        />
        <span className="flex flex-wrap items-center gap-3">
          {event.state === "active" && <LiveUpdates updatedAt={preloaded ? updatedAt : fetched.updatedAt} />}
          <span className="text-sm font-bold text-slate-500">{facts}</span>
        </span>
      </div>
      {tab === "standings" && <Standings entrants={data.entrants ?? []} />}
      {tab === "matches" && <Matches eventId={eventId} sets={data.sets ?? []} />}
      {tab === "points" && <Points contributions={data.contributions ?? []} />}
    </div>
  );
}

function Standings({ entrants }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;
  const term = search.trim().toLowerCase();
  const filtered = entrants
    .filter((entrant) => !term || `${entrant.name} ${(entrant.members ?? []).map((member) => member.name).join(" ")}`.toLowerCase().includes(term))
    .sort((left, right) => (left.placement ?? 1e9) - (right.placement ?? 1e9) || (left.seed ?? 1e9) - (right.seed ?? 1e9));
  return (
    <Card padded={false}>
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="max-w-xs"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Find a player or team" /></div>
      </div>
      {!filtered.length && <Empty>No entrants found.</Empty>}
      {filtered.slice((page - 1) * perPage, page * perPage).map((entrant) => (
        <div key={entrant.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800">
          <span className={`text-lg font-black tabular-nums ${Number(entrant.placement) <= 3 ? "text-amber-500" : "text-slate-950 dark:text-white"}`}>
            {entrant.disqualified ? "DQ" : ordinal(entrant.placement)}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            {(entrant.members ?? []).length
              ? entrant.members.map((member) => (
                <a key={`${member.provider}:${member.providerPlayerId}`} href={member.playerId ? `/esports/player/id/${member.playerId}` : undefined} className="flex min-w-0 items-center gap-2 hover:opacity-80">
                  <Avatar src={member.image} name={member.name} size="sm" playerId={member.playerId} />
                  <span className="truncate font-black text-slate-950 dark:text-white">{member.name}</span>
                </a>
              ))
              : <span className="truncate font-black text-slate-950 dark:text-white">{entrant.name}</span>}
          </div>
          <span className="text-xs font-semibold text-slate-500">{entrant.seed ? `Seed ${entrant.seed}` : ""}</span>
        </div>
      ))}
      <Pagination page={page} totalPages={Math.ceil(filtered.length / perPage)} onChange={setPage} />
    </Card>
  );
}

function Matches({ eventId, sets }) {
  const [layout, setLayout] = useQueryState("layout", "bracket");
  return (
    <div className="grid gap-3">
      <div className="flex">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm font-black dark:border-slate-700 dark:bg-slate-900">
          {[["bracket", "Bracket"], ["list", "List"]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setLayout(key)} className={`px-4 py-2 transition ${layout === key ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{label}</button>
          ))}
        </div>
      </div>
      {layout === "bracket" ? <BracketView eventId={eventId} /> : <RoundList sets={sets} />}
    </div>
  );
}


const CARD_W = 232;
const CARD_H = 58;
const ROW_GAP = 14;
const COL_GAP = 44;
const HEADER_H = 44;

const entrantLabel = (entrant) => {
  if (!entrant) return "TBD";
  const members = (entrant.members ?? []).map((member) => member.name).filter(Boolean);
  return members.length ? members.join(" / ") : String(entrant.name ?? "").replace(/'s party$/i, "");
};

const groupKind = (group) => (group.type === "round_robin" ? "Round robin" : group.type === "swiss" ? "Swiss"
  : group.sections.some((section) => section.key === "losers") ? "Double elimination" : "Single elimination");

function BracketView({ eventId }) {
  const bracket = useApi(apiUrl(`/events/${eventId}/bracket`), { refreshMs: LIVE_REFRESH_MS, refreshWhile: (data) => data?.live });
  const [phaseKey, setPhaseKey] = useState(null);
  const [groupKey, setGroupKey] = useState(null);
  const [hovered, setHovered] = useState(null);
  const data = bracket.data;
  if (bracket.error) return <ErrorNote message={bracket.error} />;
  if (!data) return <Card><Loading label="Building the bracket... (an older start.gg event fetches its pools on first view)" /></Card>;
  if (!data.phases.length) return <Card><Empty>No matches were recorded for this event.</Empty></Card>;
  const phase = data.phases.find((item) => item.key === phaseKey) ?? data.phases[0];
  const group = phase.groups.find((item) => item.key === groupKey) ?? phase.groups[0];

  return (
    <div className="grid gap-3">
      {data.phases.length > 1 && (
        <Tabs
          value={phase.key}
          onChange={(value) => { setPhaseKey(value); setGroupKey(null); }}
          tabs={data.phases.map((item) => ({ key: item.key, label: item.name, count: item.groups.length > 1 ? item.groups.length : undefined }))}
        />
      )}
      {phase.groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {phase.groups.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setGroupKey(item.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-black transition ${item.key === group.key ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              {item.name ? `Pool ${item.name}` : "Pool"}
            </button>
          ))}
        </div>
      )}
      {!data.metadataComplete && <p className="text-xs font-semibold text-amber-600">start.gg couldn't be reached, so pools may be shown merged.</p>}
      <Card padded={false} title={`${phase.name}${group.name && phase.groups.length > 1 ? ` · Pool ${group.name}` : ""}`} action={<Badge>{groupKind(group)}</Badge>}>
        {group.type === "elimination"
          ? (
            <EliminationGroup
              key={`${phase.key}:${group.key}`}
              group={group}
              entrants={data.entrants}
              hovered={hovered}
              onHover={setHovered}
              sliced={phase === data.phases[data.phases.length - 1] && phase.groups.length === 1}
            />
          )
          : <PoolView group={group} entrants={data.entrants} hovered={hovered} onHover={setHovered} />}
      </Card>
    </div>
  );
}

const sliceSize = (remaining) => {
  let size = 8;
  while ((remaining ?? 2) > size) size *= 4;
  return size;
};
const sliceLabel = (size) => (size === 8 ? "Top 8 – Grand Finals" : `Top ${size} – Top ${size / 4}`);

function useDragScroll() {
  const ref = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const end = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    ref.current?.classList.remove("cursor-grabbing");
  };
  return {
    ref,
    onPointerDown: (event) => {
      if (event.button !== 0 || event.pointerType === "touch" || !ref.current) return;
      drag.current = { x: event.clientX, y: event.clientY, left: ref.current.scrollLeft, top: ref.current.scrollTop, moved: false };
    },
    onPointerMove: (event) => {
      const current = drag.current;
      if (!current || !ref.current) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      current.moved = true;
      ref.current.classList.add("cursor-grabbing");
      ref.current.scrollLeft = current.left - dx;
      ref.current.scrollTop = current.top - dy;
    },
    onPointerUp: end,
    onPointerLeave: end,
    onClickCapture: (event) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart: (event) => event.preventDefault(),
  };
}

function EliminationGroup({ group, entrants, hovered, onHover, sliced }) {
  const columns = group.sections.flatMap((section) => section.columns);
  const sizes = [...new Set(columns.map((column) => sliceSize(column.remaining)))].sort((left, right) => right - left);
  const [slice, setSlice] = useState(sliced && sizes.length > 1 ? sizes[sizes.length - 1] : "all");
  const [from, setFrom] = useState(null);
  const scroller = useDragScroll();
  const visible = (column) => (from
    ? (column.remaining ?? 0) <= from.remaining
    : slice === "all" || sliceSize(column.remaining) === slice);
  const sections = group.sections
    .map((section) => ({ ...section, columns: section.columns.filter(visible) }))
    .filter((section) => section.columns.length);
  const button = (active) => `rounded-lg border px-3 py-1.5 text-xs font-black transition ${active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:text-slate-200"}`;

  return (
    <div>
      {((sliced && sizes.length > 1) || from) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {sliced && sizes.length > 1 && sizes.map((size) => (
            <button key={size} type="button" onClick={() => { setSlice(size); setFrom(null); }} className={button(!from && slice === size)}>{sliceLabel(size)}</button>
          ))}
          {sliced && sizes.length > 1 && <button type="button" onClick={() => { setSlice("all"); setFrom(null); }} className={button(!from && slice === "all")}>Full bracket</button>}
          {from && (
            <button type="button" onClick={() => setFrom(null)} className="ml-auto rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-black text-blue-600 dark:text-blue-300">
              From {from.name} ✕
            </button>
          )}
        </div>
      )}
      <div
        ref={scroller.ref}
        onPointerDown={scroller.onPointerDown}
        onPointerMove={scroller.onPointerMove}
        onPointerUp={scroller.onPointerUp}
        onPointerLeave={scroller.onPointerLeave}
        onClickCapture={scroller.onClickCapture}
        onDragStart={scroller.onDragStart}
        className="max-h-[80vh] cursor-grab select-none overflow-auto p-4"
      >
        {sections.map((section) => (
          <EliminationSection
            key={section.key}
            section={section}
            entrants={entrants}
            hovered={hovered}
            onHover={onHover}
            showTitle={group.sections.length > 1}
            onPickColumn={(column) => setFrom(column)}
          />
        ))}
        {!sections.length && <Empty>No matches in this part of the bracket.</Empty>}
      </div>
      <p className="border-t border-slate-200 px-4 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-800">
        Drag to move around. Click a round's name to start the bracket there; losers rounds are trimmed to match.
      </p>
    </div>
  );
}

function EliminationSection({ section, entrants, hovered, onHover, showTitle, onPickColumn }) {
  const layout = useMemo(() => {
    const ys = section.columns.map(() => new Map());
    section.columns.forEach((column, index) => {
      let cursor = 0;
      for (const set of column.sets) {
        const fed = set.feeders.map((id) => ys[index - 1]?.get(id)).filter((value) => value != null);
        const y = Math.max(cursor, fed.length ? fed.reduce((total, value) => total + value, 0) / fed.length : cursor);
        ys[index].set(set.id, y);
        cursor = y + CARD_H + ROW_GAP;
      }
    });
    const height = Math.max(CARD_H, ...ys.flatMap((column) => [...column.values()].map((y) => y + CARD_H)));
    return { ys, height, width: section.columns.length * (CARD_W + COL_GAP) - COL_GAP };
  }, [section]);
  const x = (index) => index * (CARD_W + COL_GAP);

  return (
    <div className="mb-6 last:mb-0">
      {showTitle && <div className="mb-2 text-sm font-black uppercase tracking-wider text-slate-500">{section.name}</div>}
      <div>
        <div className="relative" style={{ width: layout.width, height: layout.height + HEADER_H }}>
          {section.columns.map((column, index) => (
            <button
              key={column.key}
              type="button"
              onClick={() => onPickColumn?.(column)}
              title="Show the bracket from this round"
              className="absolute top-0 rounded-md px-1 text-center transition hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ left: x(index), width: CARD_W, height: HEADER_H - 6 }}
            >
              <div className="truncate text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{column.name}</div>
              <div className="text-[11px] font-bold text-slate-400">
                {column.placement ? `Losers place ${ordinal(column.placement)}` : `${column.sets.length} ${column.sets.length === 1 ? "match" : "matches"}`}
              </div>
            </button>
          ))}
          <svg className="pointer-events-none absolute left-0" style={{ top: HEADER_H }} width={layout.width} height={layout.height}>
            {section.columns.flatMap((column, index) => column.sets.flatMap((set) => set.feeders.map((feederId) => {
              const fromY = layout.ys[index - 1]?.get(feederId);
              if (fromY == null) return null;
              const x1 = x(index - 1) + CARD_W;
              const x2 = x(index);
              const middle = x1 + COL_GAP / 2;
              const y1 = fromY + CARD_H / 2;
              const y2 = layout.ys[index].get(set.id) + CARD_H / 2;
              return <path key={`${feederId}-${set.id}`} d={`M${x1},${y1} H${middle} V${y2} H${x2}`} fill="none" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.5" />;
            })))}
          </svg>
          {section.columns.map((column, index) => column.sets.map((set) => (
            <div key={set.id} className="absolute" style={{ left: x(index), top: HEADER_H + layout.ys[index].get(set.id), width: CARD_W, height: CARD_H }}>
              <BracketCard set={set} entrants={entrants} hovered={hovered} onHover={onHover} />
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}

function slotResult(slot, decided, won) {
  if (!slot) return "";
  if (slot.score != null) return slot.score < 0 ? "DQ" : slot.score;
  return decided ? (won ? "W" : "L") : "";
}

function BracketCard({ set, entrants, hovered, onHover }) {
  const rows = [set.slots[0] ?? null, set.slots[1] ?? null];
  const decided = Boolean(set.winnerEntrantId);
  const live = set.state === "active" && set.slots.length === 2 && !decided;
  return (
    <a href={`/esports/set/${set.id}`} draggable={false} className={`relative flex h-full flex-col rounded-lg border bg-white shadow-sm transition hover:border-blue-400 dark:bg-slate-950 ${live ? "border-amber-400 dark:border-amber-500/70" : "border-slate-300 dark:border-slate-700"}`}>
      {set.stream && <StreamBadge stream={set.stream} className="absolute -top-2 right-1 z-10" />}
      {rows.map((slot, index) => {
        const entrant = slot ? entrants[slot.entrantId] : null;
        const won = Boolean(slot) && set.winnerEntrantId === slot.entrantId;
        const lit = Boolean(slot) && hovered === slot.entrantId;
        return (
          <div
            key={index}
            onMouseEnter={() => slot && onHover(slot.entrantId)}
            onMouseLeave={() => onHover(null)}
            className={`flex flex-1 items-center gap-2 px-2 text-sm ${index ? "border-t border-slate-200 dark:border-slate-800" : ""} ${lit ? "bg-blue-100 dark:bg-blue-500/20" : ""}`}
          >
            <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-400">{entrant?.seed ?? ""}</span>
            <span className={`min-w-0 flex-1 truncate ${won ? "font-black text-slate-950 dark:text-white" : slot ? (decided ? "font-semibold text-slate-500" : "font-semibold text-slate-800 dark:text-slate-200") : "italic text-slate-400"}`}>
              {slot ? entrantLabel(entrant) : set.slots.length === 1 && set.state === "complete" ? "Bye" : "TBD"}
            </span>
            <span className={`w-7 shrink-0 rounded text-center text-xs font-black tabular-nums ${won ? "bg-emerald-500 text-white" : slot && decided ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : slot && live ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" : ""}`}>
              {slotResult(slot, decided, won)}
            </span>
          </div>
        );
      })}
    </a>
  );
}

function PoolView({ group, entrants, hovered, onHover }) {
  const order = group.standings.map((row) => row.entrantId);
  const roundRobin = group.type === "round_robin";
  return (
    <div className="grid gap-4 p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="w-10 px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Entrant</th>
              {roundRobin && order.map((id, index) => <th key={id} className="w-14 px-1 py-2 text-center" title={entrantLabel(entrants[id])}>vs {index + 1}</th>)}
              <th className="w-16 px-2 py-2 text-center">Sets</th>
              <th className="w-16 px-2 py-2 text-center">Games</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row, rowIndex) => {
              const entrant = entrants[row.entrantId];
              const solo = entrant?.members?.length === 1 ? entrant.members[0] : null;
              return (
                <tr key={row.entrantId} onMouseEnter={() => onHover(row.entrantId)} onMouseLeave={() => onHover(null)} className={`border-t border-slate-200 dark:border-slate-800 ${hovered === row.entrantId ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}>
                  <td className="px-2 py-2 font-black tabular-nums text-slate-500">{rowIndex + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar src={solo?.image} name={entrantLabel(entrant)} size="sm" playerId={solo?.playerId} />
                      {solo?.playerId
                        ? <a href={`/esports/player/id/${solo.playerId}`} className="truncate font-black text-slate-950 hover:text-blue-500 dark:text-white">{entrantLabel(entrant)}</a>
                        : <span className="truncate font-black text-slate-950 dark:text-white">{entrantLabel(entrant)}</span>}
                      {entrant?.seed && <span className="shrink-0 text-xs font-semibold text-slate-400">Seed {entrant.seed}</span>}
                    </div>
                  </td>
                  {roundRobin && order.map((opponentId) => {
                    if (opponentId === row.entrantId) return <td key={opponentId} className="bg-slate-100 dark:bg-slate-800/60" />;
                    const result = group.results[`${row.entrantId}:${opponentId}`];
                    if (!result) return <td key={opponentId} className="text-center text-slate-300 dark:text-slate-700">—</td>;
                    const tone = result.won ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : result.won === false ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : "text-slate-500";
                    return (
                      <td key={opponentId} className="p-0.5 text-center">
                        <a href={`/esports/set/${result.setId}`} className={`block rounded py-1.5 text-xs font-black tabular-nums ${tone}`}>
                          {result.score != null && result.opponentScore != null ? `${result.score}-${result.opponentScore}` : result.won ? "W" : "L"}
                        </a>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-black tabular-nums"><span className="text-emerald-500">{row.wins}</span>-<span className="text-rose-500">{row.losses}</span></td>
                  <td className="px-2 py-2 text-center font-semibold tabular-nums text-slate-500">{row.gameWins}-{row.gameLosses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {group.rounds.map((round) => (
          <div key={round.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{round.name}</div>
            <div className="grid gap-2">
              {round.sets.map((set) => (
                <div key={set.id} style={{ height: CARD_H }}><BracketCard set={set} entrants={entrants} hovered={hovered} onHover={onHover} /></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundList({ sets }) {
  const [round, setRound] = useState("all");
  const rounds = useMemo(() => {
    const ordered = [...sets].sort((left, right) => (left.set_order ?? 0) - (right.set_order ?? 0));
    const groups = new Map();
    for (const set of ordered) {
      const name = set.round_name || "Matches";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(set);
    }
    return [...groups.entries()];
  }, [sets]);
  if (!sets.length) return <Card><Empty>No matches were recorded for this event.</Empty></Card>;
  const visible = round === "all" ? rounds : rounds.filter(([name]) => name === round);
  return (
    <div className="grid gap-4">
      <div className="max-w-xs">
        <Select label="Round" value={round} onChange={setRound} options={[["all", "All rounds"], ...rounds.map(([name]) => [name, name])]} />
      </div>
      {visible.map(([name, roundSets]) => (
        <Card key={name} title={name} action={<span className="text-xs font-bold text-slate-500">{roundSets.length} matches</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roundSets.map((set) => <SetCard key={set.id} set={set} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SetCard({ set }) {
  const slots = set.slots ?? [];
  const decided = slots.some((slot) => slot.winner);
  return (
    <a href={`/esports/set/${set.id}`} className="rounded-lg border border-slate-200 transition hover:border-blue-400 dark:border-slate-800">
      {slots.map((slot, index) => (
        <div key={slot.entrantId ?? index} className={`flex items-center justify-between gap-2 px-3 py-1.5 ${index ? "border-t border-slate-100 dark:border-slate-800" : ""}`}>
          <span className={`truncate text-sm ${slot.winner ? "font-black text-slate-950 dark:text-white" : "font-semibold text-slate-500"}`}>{slot.entrantName}</span>
          <span className={`text-sm tabular-nums ${slot.winner ? "font-black text-slate-950 dark:text-white" : "font-semibold text-slate-500"}`}>{slot.score ?? (decided ? (slot.winner ? "W" : "L") : "")}</span>
        </div>
      ))}
      {slots.length === 1 && <div className="border-t border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:border-slate-800">Bye</div>}
      {set.stream && <div className="border-t border-slate-100 px-3 py-1.5 dark:border-slate-800"><StreamBadge stream={set.stream} /></div>}
    </a>
  );
}

const eventPoints = (row) => Math.round(
  (Number(row.placement_points) + Number(row.win_points) + Number(row.loss_points)) * Number(row.tournament_multiplier ?? 1) * 1000,
) / 1000;

function Points({ contributions }) {
  const place = (row) => row.details?.placement ?? Number.MAX_SAFE_INTEGER;
  const rows = [...contributions].sort((left, right) => eventPoints(right) - eventPoints(left) || place(left) - place(right));
  const multiplier = Number(contributions[0]?.tournament_multiplier ?? 1);
  return (
    <Card padded={false}>
      <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">
        Points each player earned at this event toward their region's power ranking: placement points, plus points for wins and close losses against ranked opponents{multiplier !== 1 ? `, times this event's ×${multiplier} multiplier` : ""}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800">
              <th className="px-4 py-2">Player</th>
              <th className="px-2 py-2">Board</th>
              <th className="px-2 py-2 text-right">Place</th>
              <th className="px-2 py-2 text-right">Placement</th>
              <th className="px-2 py-2 text-right">Wins</th>
              <th className="px-2 py-2 text-right">Losses</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.player_id}:${row.region}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2"><a href={`/esports/player/id/${row.player_id}`} className="font-black text-slate-950 hover:text-blue-500 dark:text-white">{row.display_name}</a></td>
                <td className="px-2 py-2 text-xs font-bold text-slate-500">{regionName(row.region)}</td>
                <td className="px-2 py-2 text-right font-bold">{ordinal(row.details?.placement)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.placement_points)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.win_points)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{points(row.loss_points)}</td>
                <td className="px-4 py-2 text-right font-black tabular-nums">{points(eventPoints(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
