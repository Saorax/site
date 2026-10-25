import React from "react";
import { host } from "../../stuff";
import {
  apiUrl, Avatar, Badge, Card, date, Empty, ErrorNote, Loading, modeName, PageShell, percent, ProviderLink,
  useApi,
} from "./ui";

export const mapName = (value) => {
  const name = String(value ?? "").trim();
  if (!name) return "Unknown map";
  if (name.replace(/[^a-z]/gi, "").toLowerCase() === "fortressofthelions") return "Fortress of Lions";
  return name.replace(/^Small\s+/i, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
};

export const legendKey = (value) => String(value ?? "").normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function useLegendNames() {
  const legends = useApi(`${host}/game/legends/summary`);
  const names = new Map();
  for (const legend of Array.isArray(legends.data) ? legends.data : []) {
    const display = legend.bio?.name?.normal ?? legend.codeName;
    names.set(legendKey(legend.codeName), display);
    names.set(legendKey(display), display);
  }
  return (code) => names.get(legendKey(code)) ?? code ?? "Unknown";
}


export function SetPage({ setId }) {
  const detail = useApi(apiUrl(`/sets/${setId}`));
  const legendName = useLegendNames();
  const data = detail.data;
  if (detail.error) return <PageShell back={{ href: "/esports/tournaments", label: "Tournaments" }}><ErrorNote message={detail.error} /></PageShell>;
  if (!data) return <PageShell><Loading label="Loading match..." /></PageShell>;
  const set = data.set;
  const slots = data.slots ?? [];
  const games = set.games ?? [];
  const sideOf = (accountId) => slots.findIndex((slot) => (slot.members ?? []).some((member) => member.gameAccountId === accountId));
  const picks = (game) => game.entrantSelections?.length
    ? game.entrantSelections.map((pick) => ({ key: `${pick.providerEntrantId}:${pick.legend}`, legend: pick.legend, side: slots.findIndex((slot) => String(slot.provider_entrant_id) === String(pick.providerEntrantId)) }))
    : (game.selections ?? []).map((pick) => ({ key: pick.gameAccountId ?? pick.name, legend: pick.legend, name: pick.name, side: sideOf(pick.gameAccountId) }));
  const winnerSide = (game) => (game.winnerProviderEntrantId == null ? -1 : slots.findIndex((slot) => String(slot.provider_entrant_id) === String(game.winnerProviderEntrantId)));

  return (
    <PageShell back={{ href: `/esports/event/${set.event_id}?view=matches`, label: set.event_name }}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-500">
          <span>{set.tournament_name} · {set.round_name} · {date(set.history_at ?? set.starts_at)}</span>
          <span className="flex items-center gap-2">
            {set.is_official && <Badge tone="blue">Official</Badge>}
            <Badge>{modeName(set.game_mode)}</Badge>
          </span>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          {[0, 1].map((index) => {
            const slot = slots[index];
            const side = (
              <div key={index} className={`flex min-w-0 flex-col gap-2 ${index ? "items-end text-right" : ""}`}>
                {(slot?.members?.length ? slot.members : [{ gamerTag: slot?.entrant_name }]).map((member) => (
                  <a key={member.identityId ?? member.gamerTag} href={member.playerId ? `/esports/player/id/${member.playerId}` : undefined} className={`flex min-w-0 items-center gap-3 ${index ? "flex-row-reverse" : ""} hover:opacity-80`}>
                    <Avatar src={member.image} name={member.gamerTag} playerId={member.playerId} />
                    <span className={`truncate text-lg font-black ${slot?.score > (slots[1 - index]?.score ?? -1) ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>{member.gamerTag ?? "TBD"}</span>
                  </a>
                ))}
              </div>
            );
            return index === 0 ? side : [
              <div key="score" className="text-center text-4xl font-black tabular-nums text-slate-950 dark:text-white">
                {slots[0]?.score ?? "–"}<span className="mx-2 text-slate-400">:</span>{slots[1]?.score ?? "–"}
              </div>,
              side,
            ];
          })}
        </div>
        <div className="mt-4"><ProviderLink provider={set.provider} url={set.url} /></div>
      </section>

      <Card title="Games" className="mt-6" padded={false}>
        {!games.length && <Empty>Game-by-game details weren't reported for this match.</Empty>}
        {games.map((game) => (
          <div key={game.providerGameId ?? game.gameNumber} className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="flex items-center gap-3">
              <img src={`${host}/game/maps/thumbnail/${encodeURIComponent(game.map ?? "")}`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} className="h-12 w-20 rounded-md bg-slate-200 object-cover dark:bg-slate-800" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Game {game.gameNumber}</div>
                <div className="font-black text-slate-950 dark:text-white">{mapName(game.map)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((side) => (
                <div key={side} className={`flex flex-wrap items-center gap-2 ${side ? "flex-row-reverse" : ""}`}>
                  {winnerSide(game) >= 0 && (
                    <span className={`w-6 text-center font-mono text-lg font-black ${winnerSide(game) === side ? "text-emerald-500" : "text-rose-500"}`}>{winnerSide(game) === side ? "W" : "L"}</span>
                  )}
                  {picks(game).filter((pick) => pick.side === side).map((pick) => (
                    <span key={pick.key} className="flex items-center gap-2 rounded-lg bg-slate-100 py-1 pl-1 pr-2 text-sm font-bold dark:bg-slate-800">
                      <img src={`${host}/game/legends/art/${encodeURIComponent(pick.legend ?? "")}`} alt="" loading="lazy" className="h-7 w-7 rounded-md object-cover" />
                      <span className="text-slate-900 dark:text-white">{legendName(pick.legend)}</span>
                      {pick.name && <span className="text-xs text-slate-500">{pick.name}</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}


export function HeadToHeadPage() {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [first, second] = [params.get("a"), params.get("b")];
  const ready = first && second;
  const h2h = useApi(ready ? apiUrl(`/head-to-head/${first}/${second}`) : null);
  const firstPlayer = useApi(ready ? apiUrl(`/players/${first}/history`) : null);
  const secondPlayer = useApi(ready ? apiUrl(`/players/${second}/history`) : null);

  if (!ready) return <PageShell title="Head to head"><Empty>Pick an opponent from a player's Opponents tab to compare them.</Empty></PageShell>;
  if (h2h.error) return <PageShell title="Head to head"><ErrorNote message={h2h.error} /></PageShell>;
  if (!h2h.data) return <PageShell><Loading label="Comparing players..." /></PageShell>;

  const players = [firstPlayer.data?.player, secondPlayer.data?.player];
  const ids = [first, second];
  const wins = ids.map((id) => Number(h2h.data.wins?.[id] ?? 0));
  const total = wins[0] + wins[1];
  const sets = h2h.data.sets ?? [];

  return (
    <PageShell back={{ href: `/esports/player/id/${first}?tab=opponents`, label: players[0]?.display_name ?? "Player" }}>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          {[0, 1].map((index) => {
            const player = players[index];
            const block = (
              <a key={ids[index]} href={`/esports/player/id/${ids[index]}`} className={`flex min-w-0 items-center gap-4 hover:opacity-80 ${index ? "flex-row-reverse text-right" : ""}`}>
                <Avatar src={player?.image} name={player?.display_name} size="lg" playerId={ids[index]} />
                <div className="min-w-0">
                  <div className="truncate text-2xl font-black text-slate-950 dark:text-white">{player?.display_name ?? "..."}</div>
                  <div className="text-sm font-bold text-slate-500">{percent(wins[index], total)} of sets</div>
                </div>
              </a>
            );
            return index === 0 ? block : [
              <div key="score" className="text-center">
                <div className="text-5xl font-black tabular-nums text-slate-950 dark:text-white">{wins[0]}<span className="mx-2 text-slate-400">–</span>{wins[1]}</div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">{total} sets played</div>
              </div>,
              block,
            ];
          })}
        </div>
        {total > 0 && (
          <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="bg-blue-500" style={{ width: `${(wins[0] / total) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(wins[1] / total) * 100}%` }} />
          </div>
        )}
      </section>

      <Card title="Every set" className="mt-6" padded={false}>
        {!sets.length && <Empty>These players haven't played each other in a recorded match.</Empty>}
        {sets.map((set) => {
          const firstWon = (set.winner_player_ids ?? []).map(String).includes(String(first));
          return (
            <a key={set.id} href={`/esports/set/${set.id}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
              <span className={`truncate rounded-md py-1 text-center text-xs font-black ${firstWon ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}>
                {(firstWon ? players[0] : players[1])?.display_name ?? (firstWon ? "P1" : "P2")}
              </span>
              <div className="min-w-0">
                <div className="truncate font-black text-slate-950 dark:text-white">{set.tournament_name}</div>
                <div className="truncate text-xs font-semibold text-slate-500">{set.event_name} · {set.round_name} · {date(set.history_at ?? set.tournament_starts_at)}</div>
              </div>
              <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">
                {(set.slots ?? []).map((slot) => slot.score ?? "–").join("–")}
              </span>
            </a>
          );
        })}
      </Card>
    </PageShell>
  );
}
