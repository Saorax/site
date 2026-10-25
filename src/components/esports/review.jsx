import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { host } from "../../stuff";

const classificationLabel = (value) =>
  value === true ? "Official" : "Community";

const responseError = async (response) => {
  const payload = await response.json().catch(() => null);
  const message = Array.isArray(payload?.message)
    ? payload.message.join(", ")
    : payload?.message;
  return message || `Request failed (${response.status})`;
};

function ReviewButton({ children, disabled, onClick, tone = "slate" }) {
  const tones = {
    amber: "border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25",
    cyan: "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
    slate: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function EsportsReview() {
  const [token, setToken] = useState("");
  const [reason, setReason] = useState("");
  const [organizers, setOrganizers] = useState([]);
  const organizerRequest = useRef(0);
  const [organizerPage, setOrganizerPage] = useState(1);
  const [organizerSearch, setOrganizerSearch] = useState("");
  const deferredOrganizerSearch = useDeferredValue(organizerSearch.trim());
  const [organizerMeta, setOrganizerMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [registrationProvider, setRegistrationProvider] = useState("challengermode");
  const [registrationReference, setRegistrationReference] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [audit, setAudit] = useState([]);
  const [eventId, setEventId] = useState("");
  const [eventRegion, setEventRegion] = useState("");
  const [eventGameMode, setEventGameMode] = useState("1");
  const [eventMultiplier, setEventMultiplier] = useState("");
  const [eventDetails, setEventDetails] = useState(null);
  const [eventAudit, setEventAudit] = useState([]);
  const [identities, setIdentities] = useState([]);
  const identityRequest = useRef(0);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityStatus, setIdentityStatus] = useState("conflict");
  const [identityPage, setIdentityPage] = useState(1);
  const [identitySearch, setIdentitySearch] = useState("");
  const deferredIdentitySearch = useDeferredValue(identitySearch.trim());
  const [identityMeta, setIdentityMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [organizerProvider, setOrganizerProvider] = useState("startgg");
  const [organizerHostId, setOrganizerHostId] = useState("");
  const [sourcePlayerId, setSourcePlayerId] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [identityAudit, setIdentityAudit] = useState([]);

  const loadOrganizers = useCallback(async () => {
    const requestId = ++organizerRequest.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${host}/v2/esports/organizers?official=community&page=${organizerPage}&perPage=25${deferredOrganizerSearch ? `&search=${encodeURIComponent(deferredOrganizerSearch)}` : ""}`,
      );
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      if (requestId !== organizerRequest.current) return;
      setOrganizers(payload.items ?? []);
      setOrganizerMeta({
        page: Number(payload.page ?? organizerPage),
        total: Number(payload.total ?? 0),
        totalPages: Math.max(1, Number(payload.totalPages ?? 1)),
      });
    } catch (requestError) {
      if (requestId === organizerRequest.current) setError(requestError.message);
    } finally {
      if (requestId === organizerRequest.current) setLoading(false);
    }
  }, [deferredOrganizerSearch, organizerPage]);

  useEffect(() => {
    setOrganizerPage(1);
  }, [deferredOrganizerSearch]);

  useEffect(() => {
    loadOrganizers();
  }, [loadOrganizers]);

  const loadIdentities = useCallback(async () => {
    const requestId = ++identityRequest.current;
    setIdentityLoading(true);
    setError(null);
    try {
      const status = identityStatus === "all" ? "" : `&lookupStatus=${encodeURIComponent(identityStatus)}`;
      const search = deferredIdentitySearch ? `&search=${encodeURIComponent(deferredIdentitySearch)}` : "";
      const response = await fetch(
        `${host}/v2/esports/identities/unresolved?page=${identityPage}&perPage=25${status}${search}`,
      );
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      if (requestId !== identityRequest.current) return;
      setIdentities(payload.items ?? []);
      setIdentityMeta({
        page: Number(payload.page ?? identityPage),
        total: Number(payload.total ?? 0),
        totalPages: Math.max(1, Number(payload.totalPages ?? 1)),
      });
    } catch (requestError) {
      if (requestId === identityRequest.current) setError(requestError.message);
    } finally {
      if (requestId === identityRequest.current) setIdentityLoading(false);
    }
  }, [deferredIdentitySearch, identityPage, identityStatus]);

  useEffect(() => {
    setIdentityPage(1);
  }, [deferredIdentitySearch, identityStatus]);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  const headers = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const registerTournament = async () => {
    const reference = registrationReference.trim();
    if (!token.trim() || !reference) {
      setError("Enter the local admin token and an exact provider tournament reference first.");
      return;
    }
    setWorking("tournament-registration");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${host}/v2/esports/admin/tournaments`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          provider: registrationProvider,
          providerTournamentReference: reference,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      if (result.tournamentId) setTournamentId(String(result.tournamentId));
      if (result.eventId) setEventId(String(result.eventId));
      setRegistrationReference("");
      const discoveredEvents = Number(result.eventsDiscovered ?? (result.eventId ? 1 : 0));
      setNotice(
        `${registrationProvider === "challengermode" ? "Challengermode" : "start.gg"} tournament ${result.providerTournamentId || result.providerEventId || reference} was read directly from the provider and stored${discoveredEvents ? ` with ${discoveredEvents.toLocaleString()} event${discoveredEvents === 1 ? "" : "s"}` : ""}.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const reviewOrganizer = async (organizer, official, reset = false) => {
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    const key = `${organizer.provider}:${organizer.host_provider_id}`;
    setWorking(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `${host}/v2/esports/admin/organizers/${encodeURIComponent(organizer.provider)}/${encodeURIComponent(organizer.host_provider_id)}/classification`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(reset ? { reset: true, reason: reason.trim() } : { official, reason: reason.trim() }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      if (organizer.id) {
        setOrganizers((items) => items.filter((item) => item.id !== organizer.id));
        setOrganizerMeta((meta) => ({ ...meta, total: Math.max(0, meta.total - 1) }));
      } else {
        await loadOrganizers();
      }
      setNotice(
        `${organizer.host_name || organizer.host_provider_id} ${reset ? "now follows provider classification" : `is now ${classificationLabel(official).toLowerCase()}`}; ${Number(result.tournamentsUpdated ?? 0).toLocaleString()} tournaments reviewed and ${Number(result.rankingSnapshotsRefreshed ?? 0).toLocaleString()} ranking snapshots refreshed.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const reviewTournament = async (official, reset = false) => {
    const parsedId = Number.parseInt(tournamentId, 10);
    if (!Number.isSafeInteger(parsedId) || parsedId < 1) {
      setError("Enter a valid warehouse tournament ID.");
      return;
    }
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    setWorking(`tournament:${parsedId}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `${host}/v2/esports/admin/tournaments/${parsedId}/classification`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(reset ? { reset: true, reason: reason.trim() } : { official, reason: reason.trim() }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      setNotice(
        `Tournament ${parsedId} ${reset ? "now follows its provider classification" : `is now ${classificationLabel(official).toLowerCase()}`}; ${Number(result.rankingSnapshotsRefreshed ?? 0).toLocaleString()} ranking snapshots refreshed.`,
      );
      await loadAudit(parsedId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const loadAudit = async (id = Number.parseInt(tournamentId, 10)) => {
    if (!Number.isSafeInteger(id) || id < 1 || !token.trim()) {
      setError("Enter a valid tournament ID and local admin token first.");
      return;
    }
    setWorking(`audit:${id}`);
    setError(null);
    try {
      const response = await fetch(
        `${host}/v2/esports/admin/tournaments/${id}/classification-audit`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(await responseError(response));
      setAudit(await response.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const parsedEventId = () => {
    const id = Number.parseInt(eventId, 10);
    if (!Number.isSafeInteger(id) || id < 1) {
      setError("Enter a valid warehouse event ID.");
      return null;
    }
    return id;
  };

  const loadEventReview = async () => {
    const id = parsedEventId();
    if (id === null) return;
    if (!token.trim()) {
      setError("Enter the local admin token first.");
      return;
    }
    setWorking(`event-load:${id}`);
    setError(null);
    try {
      const [detailResponse, auditResponse] = await Promise.all([
        fetch(`${host}/v2/esports/events/${id}`),
        fetch(`${host}/v2/esports/admin/events/${id}/classification-audit`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!detailResponse.ok) throw new Error(await responseError(detailResponse));
      if (!auditResponse.ok) throw new Error(await responseError(auditResponse));
      const detail = await detailResponse.json();
      setEventDetails(detail.event ?? null);
      setEventAudit(await auditResponse.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const reviewEvent = async (field, restore = false) => {
    const id = parsedEventId();
    if (id === null) return;
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    let value;
    if (!restore && field === "region") {
      value = eventRegion.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,16}$/.test(value)) {
        setError("Enter a region code between 2 and 16 letters, numbers, underscores, or dashes.");
        return;
      }
    } else if (!restore && field === "gameMode") {
      value = Number(eventGameMode);
    } else if (!restore) {
      value = Number(eventMultiplier);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        setError("Enter a multiplier greater than 0 and at most 100.");
        return;
      }
    }
    setWorking(`event-save:${id}:${field}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${host}/v2/esports/admin/events/${id}/classification`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ [field]: restore ? null : value, reason: reason.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      setNotice(
        `Event ${id} ${field} ${restore ? "now follows provider metadata" : "was updated"}; ${Number(result.rankingSnapshotsRefreshed ?? 0).toLocaleString()} ranking snapshots refreshed.`,
      );
      await loadEventReview();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const verifyIdentity = async (identity) => {
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    setWorking(`identity:${identity.id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `${host}/v2/esports/admin/identities/${identity.id}/verify`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      setIdentities((items) => items.filter((item) => item.id !== identity.id));
      setIdentityMeta((meta) => ({ ...meta, total: Math.max(0, meta.total - 1) }));
      setNotice(`Verified ${identity.provider_name || identity.provider_player_id} on canonical player ${identity.player_id}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const mergePlayers = async () => {
    const source = Number.parseInt(sourcePlayerId, 10);
    const target = Number.parseInt(targetPlayerId, 10);
    if (!Number.isSafeInteger(source) || source < 1 || !Number.isSafeInteger(target) || target < 1 || source === target) {
      setError("Enter two different valid canonical player IDs.");
      return;
    }
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    setWorking("identity-merge");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${host}/v2/esports/admin/identities/merge`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sourcePlayerId: source, targetPlayerId: target, reason: reason.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      setNotice(`Merged player ${source} into ${target}; ${Number(result.identitiesMoved ?? 0).toLocaleString()} provider identities moved and ${Number(result.rankingSnapshotsRefreshed ?? 0).toLocaleString()} ranking snapshots refreshed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const unmergePlayer = async () => {
    const source = Number.parseInt(sourcePlayerId, 10);
    if (!Number.isSafeInteger(source) || source < 1) {
      setError("Enter the retired source player ID to restore.");
      return;
    }
    if (!token.trim() || !reason.trim()) {
      setError("Enter the local admin token and an audit reason first.");
      return;
    }
    setWorking("identity-unmerge");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${host}/v2/esports/admin/identities/unmerge`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ sourcePlayerId: source, reason: reason.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      setNotice(`Restored player ${source}; ${Number(result.identitiesRestored ?? 0).toLocaleString()} provider identities restored and ${Number(result.rankingSnapshotsRefreshed ?? 0).toLocaleString()} ranking snapshots refreshed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  const loadIdentityAudit = async () => {
    if (!token.trim()) {
      setError("Enter the local admin token first.");
      return;
    }
    setWorking("identity-audit");
    setError(null);
    try {
      const response = await fetch(`${host}/v2/esports/identities/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await responseError(response));
      setIdentityAudit(await response.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-800 pb-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
            Local warehouse administration
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Classification review</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            Review provider-scoped organizers or individual tournaments. Every change requires a reason, is audited, survives provider refreshes, and rebuilds affected rankings. Ranking exclusions such as Eternal Sports are kept separate.
          </p>
        </header>

        <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Local ranking admin token
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
            <span className="text-xs font-normal text-slate-500">
              Kept only in this page&apos;s memory and sent directly to the local API.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Required audit reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              placeholder="How the organizer or tournament was verified"
            />
          </label>
        </section>

        {notice && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{notice}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-black text-white">Register a missing tournament</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use this when a readable invite-only, unlisted, or provider-capped tournament is absent from discovery. The API reads all tournament and result data directly from the selected provider; this form only supplies the exact lookup reference.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              value={registrationProvider}
              onChange={(event) => setRegistrationProvider(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="challengermode">Challengermode</option>
              <option value="startgg">start.gg</option>
            </select>
            <input
              value={registrationReference}
              onChange={(event) => setRegistrationReference(event.target.value)}
              placeholder={registrationProvider === "challengermode" ? "Exact tournament UUID" : "Tournament slug or start.gg URL"}
              className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
            <ReviewButton
              tone="cyan"
              disabled={Boolean(working) || !registrationReference.trim() || !token.trim()}
              onClick={registerTournament}
            >
              {working === "tournament-registration" ? "Reading provider..." : "Register and ingest"}
            </ReviewButton>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Challengermode expects the UUID from its tournament URL. start.gg accepts either a tournament slug or a full tournament URL. Credentials remain environment-only.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Community organizers</h2>
              <p className="mt-1 text-sm text-slate-500">
                {organizerMeta.total.toLocaleString()} provider-scoped organizers are classified Community unless promoted to Official.
              </p>
            </div>
            <ReviewButton disabled={loading || Boolean(working)} onClick={loadOrganizers}>Refresh</ReviewButton>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-300">
            Search the complete review queue
            <input
              type="search"
              value={organizerSearch}
              onChange={(event) => setOrganizerSearch(event.target.value)}
              placeholder="Organizer name or provider ID"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
          </label>
          <div className="mt-4 grid gap-3">
            {organizers.map((organizer) => {
              const key = `${organizer.provider}:${organizer.host_provider_id}`;
              return (
                <article key={organizer.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-white">{organizer.host_name || organizer.host_provider_id}</div>
                    <div className="mt-1 text-xs text-slate-500">{organizer.provider} · {organizer.host_provider_id}</div>
                    <div className="mt-2 text-sm text-slate-400">{Number(organizer.tournaments).toLocaleString()} tournaments · {Number(organizer.events).toLocaleString()} events</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewOrganizer(organizer, true)}>{working === key ? "Saving..." : "Mark official"}</ReviewButton>
                    <ReviewButton tone="cyan" disabled={Boolean(working)} onClick={() => reviewOrganizer(organizer, false)}>Mark community</ReviewButton>
                  </div>
                </article>
              );
            })}
            {!loading && !organizers.length && <p className="py-6 text-center text-sm text-slate-500">No community organizers in this page.</p>}
            {loading && <p className="py-6 text-center text-sm text-slate-500">Loading review queue...</p>}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span className="text-sm text-slate-500">
              Page {organizerMeta.page.toLocaleString()} of {organizerMeta.totalPages.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <ReviewButton
                disabled={loading || Boolean(working) || organizerPage <= 1}
                onClick={() => setOrganizerPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </ReviewButton>
              <ReviewButton
                disabled={loading || Boolean(working) || organizerPage >= organizerMeta.totalPages}
                onClick={() => setOrganizerPage((page) => Math.min(organizerMeta.totalPages, page + 1))}
              >
                Next
              </ReviewButton>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <h3 className="font-bold text-white">Review a specific organizer</h3>
            <p className="mt-1 text-sm text-slate-500">
              Use a provider-scoped organizer ID to revise an earlier decision or restore provider classification.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={organizerProvider}
                onChange={(event) => setOrganizerProvider(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="startgg">start.gg</option>
                <option value="challengermode">Challengermode</option>
              </select>
              <input
                value={organizerHostId}
                onChange={(event) => setOrganizerHostId(event.target.value)}
                placeholder="Provider organizer ID"
                className="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
              <ReviewButton
                tone="amber"
                disabled={Boolean(working) || !organizerHostId.trim()}
                onClick={() => reviewOrganizer({ provider: organizerProvider, host_provider_id: organizerHostId.trim() }, true)}
              >
                Official
              </ReviewButton>
              <ReviewButton
                tone="cyan"
                disabled={Boolean(working) || !organizerHostId.trim()}
                onClick={() => reviewOrganizer({ provider: organizerProvider, host_provider_id: organizerHostId.trim() }, false)}
              >
                Community
              </ReviewButton>
              <ReviewButton
                disabled={Boolean(working) || !organizerHostId.trim()}
                onClick={() => reviewOrganizer({ provider: organizerProvider, host_provider_id: organizerHostId.trim() }, undefined, true)}
              >
                Restore provider
              </ReviewButton>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-black text-white">Individual tournament</h2>
          <p className="mt-1 text-sm text-slate-500">Use the numeric warehouse ID shown in tournament URLs.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              inputMode="numeric"
              value={tournamentId}
              onChange={(event) => setTournamentId(event.target.value)}
              placeholder="Tournament ID"
              className="min-w-48 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
            <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewTournament(true)}>Official</ReviewButton>
            <ReviewButton tone="cyan" disabled={Boolean(working)} onClick={() => reviewTournament(false)}>Community</ReviewButton>
            <ReviewButton disabled={Boolean(working)} onClick={() => reviewTournament(undefined, true)}>Restore provider</ReviewButton>
            <ReviewButton disabled={Boolean(working)} onClick={() => loadAudit()}>Load audit</ReviewButton>
          </div>
          {!!audit.length && (
            <ol className="mt-4 grid gap-2">
              {audit.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                  <div className="font-semibold text-slate-200">{entry.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()} · {entry.actor} · {classificationLabel(entry.before_values?.is_official)} → {classificationLabel(entry.after_values?.is_official)}</div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-black text-white">Event classification</h2>
          <p className="mt-1 text-sm text-slate-500">
            Correct one event field at a time. Restoring a field removes its manual override and uses normalized provider metadata.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              inputMode="numeric"
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              placeholder="Event ID"
              className="min-w-48 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
            <ReviewButton disabled={Boolean(working)} onClick={loadEventReview}>Load event and audit</ReviewButton>
          </div>
          {eventDetails && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              <div className="font-bold text-white">{eventDetails.name || `Event ${eventDetails.id}`}</div>
              <div className="mt-1 text-slate-500">
                Current: {eventDetails.region || "unknown region"} · {eventDetails.game_mode ? `${eventDetails.game_mode}v${eventDetails.game_mode}` : "unknown mode"} · {Number(eventDetails.multiplier ?? 1).toLocaleString()}×
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Region code
                <input value={eventRegion} onChange={(event) => setEventRegion(event.target.value)} placeholder="NA, EU, ALL..." className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("region")}>Set region</ReviewButton>
                <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("region", true)}>Restore</ReviewButton>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Game mode
                <select value={eventGameMode} onChange={(event) => setEventGameMode(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                  <option value="1">1v1</option>
                  <option value="2">2v2</option>
                </select>
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("gameMode")}>Set mode</ReviewButton>
                <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("gameMode", true)}>Restore</ReviewButton>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Multiplier
                <input inputMode="decimal" value={eventMultiplier} onChange={(event) => setEventMultiplier(event.target.value)} placeholder="1.125" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("multiplier")}>Set multiplier</ReviewButton>
                <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("multiplier", true)}>Restore</ReviewButton>
              </div>
            </div>
          </div>
          {!!eventAudit.length && (
            <ol className="mt-4 grid gap-2">
              {eventAudit.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                  <div className="font-semibold text-slate-200">{entry.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(entry.created_at).toLocaleString()} · {entry.actor} · {entry.before_values?.region || "?"}/{entry.before_values?.game_mode || "?"}/{Number(entry.before_values?.multiplier ?? 1).toLocaleString()}× → {entry.after_values?.region || "?"}/{entry.after_values?.game_mode || "?"}/{Number(entry.after_values?.multiplier ?? 1).toLocaleString()}×
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Identity review</h2>
              <p className="mt-1 text-sm text-slate-500">
                {identityMeta.total.toLocaleString()} provider-scoped identities match this queue. They are never merged by gamer tag alone.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={identityStatus}
                onChange={(event) => setIdentityStatus(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="conflict">Conflicts</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="not_found">Not found</option>
                <option value="unsupported">Unsupported</option>
                <option value="all">All unresolved</option>
              </select>
              <ReviewButton disabled={identityLoading || Boolean(working)} onClick={loadIdentities}>Refresh</ReviewButton>
            </div>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-300">
            Search identities
            <input
              type="search"
              value={identitySearch}
              onChange={(event) => setIdentitySearch(event.target.value)}
              placeholder="Provider name, player ID, or Brawlhalla ID"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
          </label>
          <div className="mt-4 grid gap-3">
            {identities.map((identity) => (
              <article key={identity.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">{identity.provider}</span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-200">{identity.lookup_status}</span>
                  </div>
                  <div className="mt-2 font-bold text-white">{identity.provider_name || "Unnamed identity"}</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-500">{identity.provider_player_id}</div>
                  <div className="mt-2 text-sm text-slate-400">Canonical player {identity.player_id} · {Number(identity.entrant_appearances).toLocaleString()} appearances{identity.provider_brawlhalla_id ? ` · Brawlhalla ID ${identity.provider_brawlhalla_id}` : ""}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/esports/player/id/${identity.player_id}`} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">Inspect player</a>
                  <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => verifyIdentity(identity)}>{working === `identity:${identity.id}` ? "Saving..." : "Verify identity"}</ReviewButton>
                </div>
              </article>
            ))}
            {!identityLoading && !identities.length && <p className="py-6 text-center text-sm text-slate-500">No identities match this review status.</p>}
            {identityLoading && <p className="py-6 text-center text-sm text-slate-500">Loading identity queue...</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span className="text-sm text-slate-500">
              Page {identityMeta.page.toLocaleString()} of {identityMeta.totalPages.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <ReviewButton
                disabled={identityLoading || Boolean(working) || identityPage <= 1}
                onClick={() => setIdentityPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </ReviewButton>
              <ReviewButton
                disabled={identityLoading || Boolean(working) || identityPage >= identityMeta.totalPages}
                onClick={() => setIdentityPage((page) => Math.min(identityMeta.totalPages, page + 1))}
              >
                Next
              </ReviewButton>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <h3 className="font-bold text-white">Manual canonical merge</h3>
            <p className="mt-1 text-sm text-slate-500">Move all provider identities from a duplicate source player into a verified target. Unmerge restores the retired source using its audit record.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input inputMode="numeric" value={sourcePlayerId} onChange={(event) => setSourcePlayerId(event.target.value)} placeholder="Source player ID" className="min-w-44 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <input inputMode="numeric" value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)} placeholder="Target player ID" className="min-w-44 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <ReviewButton tone="amber" disabled={Boolean(working)} onClick={mergePlayers}>Merge</ReviewButton>
              <ReviewButton disabled={Boolean(working)} onClick={unmergePlayer}>Unmerge source</ReviewButton>
              <ReviewButton disabled={Boolean(working)} onClick={loadIdentityAudit}>Load identity audit</ReviewButton>
            </div>
            {!!identityAudit.length && (
              <ol className="mt-4 grid gap-2">
                {identityAudit.slice(0, 50).map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                    <div className="font-semibold text-slate-200">{entry.action}: {entry.reason}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()} · source {entry.source_player_id ?? "—"} · target {entry.target_player_id ?? "—"} · identity {entry.identity_id ?? "—"}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
