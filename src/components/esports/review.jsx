import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { host } from "../../stuff";
import { Card, EmptyState, ErrorState, Heading, LoadingState, PageHeader, PageShell, Pagination, Pill, SearchInput, Section, SelectInput, cx } from "../ui";

const classificationLabel = (value) =>
  value === true ? "Official" : "Community";

const responseError = async (response) => {
  const payload = await response.json().catch(() => null);
  const message = Array.isArray(payload?.message)
    ? payload.message.join(", ")
    : payload?.message;
  return message || `Request failed (${response.status})`;
};

const field = "rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400";
const buttonBase = "rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
const buttonTones = {
  amber: "border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25",
  blue: "border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30",
  slate: "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
};

function ReviewButton({ children, disabled, onClick, tone = "slate" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(buttonBase, buttonTones[tone] || buttonTones.slate)}
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
  const [organizerError, setOrganizerError] = useState(null);
  const [identityError, setIdentityError] = useState(null);
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
    setOrganizerError(null);
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
      if (requestId === organizerRequest.current) setOrganizerError(requestError.message);
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
    setIdentityError(null);
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
      if (requestId === identityRequest.current) setIdentityError(requestError.message);
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

  const organizerPageChange = (page) => {
    if (!loading && !working) setOrganizerPage(Math.min(organizerMeta.totalPages, Math.max(1, page)));
  };
  const identityPageChange = (page) => {
    if (!identityLoading && !working) setIdentityPage(Math.min(identityMeta.totalPages, Math.max(1, page)));
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Local warehouse administration"
        title="Classification review"
        subtitle="Classify organizers or single tournaments. Each change needs a reason, is logged, survives provider refreshes and rebuilds the rankings it affects. Ranking exclusions such as Eternal Sports are separate."
      />

      <Section padded={false} className="max-w-6xl" bodyClassName="grid gap-3 p-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-300">
          Local ranking admin token
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            className={field}
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
            className={field}
            placeholder="How the organizer or tournament was verified"
          />
        </label>
      </Section>

      {notice && <div role="status" className="max-w-6xl rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-100">{notice}</div>}
      {error && <ErrorState message={error} className="max-w-6xl" />}

      <Section
        className="max-w-6xl"
        title="Register a missing tournament"
        subtitle="For invite-only, unlisted or capped tournaments the search missed. Give the link; the rest is read from start.gg or Challengermode."
      >
        <div className="flex flex-wrap gap-2">
          <SelectInput
            label="Provider"
            value={registrationProvider}
            onChange={setRegistrationProvider}
            options={[
              { value: "challengermode", label: "Challengermode" },
              { value: "startgg", label: "start.gg" },
            ]}
          />
          <input
            value={registrationReference}
            onChange={(event) => setRegistrationReference(event.target.value)}
            placeholder={registrationProvider === "challengermode" ? "Exact tournament UUID" : "Tournament slug or start.gg URL"}
            aria-label="Tournament reference"
            className={cx(field, "min-w-0 flex-1 sm:min-w-64")}
          />
          <ReviewButton
            tone="blue"
            disabled={Boolean(working) || !registrationReference.trim() || !token.trim()}
            onClick={registerTournament}
          >
            {working === "tournament-registration" ? "Reading provider…" : "Register and ingest"}
          </ReviewButton>
        </div>
        <p className="max-w-prose text-xs text-slate-500">
          Challengermode: the UUID from the tournament URL. start.gg: the tournament slug or full URL.
        </p>
      </Section>

      <Section
        className="max-w-6xl"
        title="Community organizers"
        count={organizerMeta.total.toLocaleString()}
        subtitle={`${organizerMeta.total.toLocaleString()} provider-scoped organizers are classified Community unless promoted to Official.`}
        actions={<ReviewButton disabled={loading || Boolean(working)} onClick={loadOrganizers}>Refresh</ReviewButton>}
      >
        <SearchInput
          value={organizerSearch}
          onChange={setOrganizerSearch}
          label="Search the complete review queue"
          placeholder="Organizer name or provider ID"
        />
        {organizerError && <ErrorState message="Couldn't load the organizer queue." detail={organizerError} onRetry={loadOrganizers} />}
        <div className="grid gap-3">
          {organizers.map((organizer) => {
            const key = `${organizer.provider}:${organizer.host_provider_id}`;
            return (
              <Card as="article" key={organizer.id} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-white">{organizer.host_name || organizer.host_provider_id}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <Pill>{organizer.provider}</Pill>
                    <span className="break-all">{organizer.host_provider_id}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{Number(organizer.tournaments).toLocaleString()} tournaments · {Number(organizer.events).toLocaleString()} events</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewOrganizer(organizer, true)}>{working === key ? "Saving…" : "Mark official"}</ReviewButton>
                  <ReviewButton tone="blue" disabled={Boolean(working)} onClick={() => reviewOrganizer(organizer, false)}>Mark community</ReviewButton>
                </div>
              </Card>
            );
          })}
          {!loading && !organizerError && !organizers.length && <EmptyState bare title="No community organizers on this page." />}
          {loading && <LoadingState bare label="Loading review queue…" />}
        </div>
        <Pagination page={organizerMeta.page} totalPages={organizerMeta.totalPages} onChange={organizerPageChange} className="border-t border-slate-800" />

        <div className="border-t border-slate-800 pt-4">
          <Heading as="h4">Review a specific organizer</Heading>
          <p className="max-w-prose text-sm text-slate-500">
            Change an earlier decision, or go back to the provider's classification, by organizer ID.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SelectInput
              label="Provider"
              value={organizerProvider}
              onChange={setOrganizerProvider}
              options={[
                { value: "startgg", label: "start.gg" },
                { value: "challengermode", label: "Challengermode" },
              ]}
            />
            <input
              value={organizerHostId}
              onChange={(event) => setOrganizerHostId(event.target.value)}
              placeholder="Provider organizer ID"
              aria-label="Provider organizer ID"
              className={cx(field, "min-w-0 flex-1 sm:min-w-56")}
            />
            <ReviewButton
              tone="amber"
              disabled={Boolean(working) || !organizerHostId.trim()}
              onClick={() => reviewOrganizer({ provider: organizerProvider, host_provider_id: organizerHostId.trim() }, true)}
            >
              Official
            </ReviewButton>
            <ReviewButton
              tone="blue"
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
      </Section>

      <Section className="max-w-6xl" title="Individual tournament" subtitle="Use the numeric warehouse ID shown in tournament URLs.">
        <div className="flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            value={tournamentId}
            onChange={(event) => setTournamentId(event.target.value)}
            placeholder="Tournament ID"
            aria-label="Tournament ID"
            className={cx(field, "min-w-0 flex-1 sm:min-w-48")}
          />
          <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewTournament(true)}>Official</ReviewButton>
          <ReviewButton tone="blue" disabled={Boolean(working)} onClick={() => reviewTournament(false)}>Community</ReviewButton>
          <ReviewButton disabled={Boolean(working)} onClick={() => reviewTournament(undefined, true)}>Restore provider</ReviewButton>
          <ReviewButton disabled={Boolean(working)} onClick={() => loadAudit()}>Load audit</ReviewButton>
        </div>
        {!!audit.length && (
          <ol className="grid gap-2">
            {audit.map((entry) => (
              <Card as="li" key={entry.id} className="text-sm">
                <div className="font-semibold text-slate-200">{entry.reason}</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()} · {entry.actor} · {classificationLabel(entry.before_values?.is_official)} → {classificationLabel(entry.after_values?.is_official)}</div>
              </Card>
            ))}
          </ol>
        )}
      </Section>

      <Section
        className="max-w-6xl"
        title="Event classification"
        subtitle="Fix one event field at a time. Restore drops the override and goes back to the provider value."
      >
        <div className="flex flex-wrap gap-2">
          <input
            inputMode="numeric"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            placeholder="Event ID"
            aria-label="Event ID"
            className={cx(field, "min-w-0 flex-1 sm:min-w-48")}
          />
          <ReviewButton disabled={Boolean(working)} onClick={loadEventReview}>Load event and audit</ReviewButton>
        </div>
        {eventDetails && (
          <Card className="text-sm text-slate-300">
            <div className="font-bold text-white">{eventDetails.name || `Event ${eventDetails.id}`}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-slate-500">
              <span>Current:</span>
              <Pill>{eventDetails.region || "unknown region"}</Pill>
              <Pill>{eventDetails.game_mode ? `${eventDetails.game_mode}v${eventDetails.game_mode}` : "unknown mode"}</Pill>
              <Pill>{Number(eventDetails.multiplier ?? 1).toLocaleString()}×</Pill>
            </div>
          </Card>
        )}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">
              Region code
              <input value={eventRegion} onChange={(event) => setEventRegion(event.target.value)} placeholder="NA, EU, ALL…" className={field} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("region")}>Set region</ReviewButton>
              <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("region", true)}>Restore</ReviewButton>
            </div>
          </Card>
          <Card>
            <SelectInput
              inline={false}
              label="Game mode"
              value={eventGameMode}
              onChange={setEventGameMode}
              className="font-semibold"
              options={[
                { value: "1", label: "1v1" },
                { value: "2", label: "2v2" },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("gameMode")}>Set mode</ReviewButton>
              <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("gameMode", true)}>Restore</ReviewButton>
            </div>
          </Card>
          <Card>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">
              Multiplier
              <input inputMode="decimal" value={eventMultiplier} onChange={(event) => setEventMultiplier(event.target.value)} placeholder="1.125" className={field} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => reviewEvent("multiplier")}>Set multiplier</ReviewButton>
              <ReviewButton disabled={Boolean(working)} onClick={() => reviewEvent("multiplier", true)}>Restore</ReviewButton>
            </div>
          </Card>
        </div>
        {!!eventAudit.length && (
          <ol className="grid gap-2">
            {eventAudit.map((entry) => (
              <Card as="li" key={entry.id} className="text-sm">
                <div className="font-semibold text-slate-200">{entry.reason}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {new Date(entry.created_at).toLocaleString()} · {entry.actor} · {entry.before_values?.region || "?"}/{entry.before_values?.game_mode || "?"}/{Number(entry.before_values?.multiplier ?? 1).toLocaleString()}× → {entry.after_values?.region || "?"}/{entry.after_values?.game_mode || "?"}/{Number(entry.after_values?.multiplier ?? 1).toLocaleString()}×
                </div>
              </Card>
            ))}
          </ol>
        )}
      </Section>

      <Section
        className="max-w-6xl"
        title="Identity review"
        count={identityMeta.total.toLocaleString()}
        subtitle={`${identityMeta.total.toLocaleString()} provider-scoped identities match this queue. They are never merged by gamer tag alone.`}
        actions={(
          <>
            <SelectInput
              label="Status"
              value={identityStatus}
              onChange={setIdentityStatus}
              options={[
                { value: "conflict", label: "Conflicts" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
                { value: "not_found", label: "Not Found" },
                { value: "unsupported", label: "Unsupported" },
                { value: "all", label: "All unresolved" },
              ]}
            />
            <ReviewButton disabled={identityLoading || Boolean(working)} onClick={loadIdentities}>Refresh</ReviewButton>
          </>
        )}
      >
        <SearchInput
          value={identitySearch}
          onChange={setIdentitySearch}
          shortcut={false}
          label="Search identities"
          placeholder="Provider name, player ID, or Brawlhalla ID"
        />
        {identityError && <ErrorState message="Couldn't load the identity queue." detail={identityError} onRetry={loadIdentities} />}
        <div className="grid gap-3">
          {identities.map((identity) => (
            <Card as="article" key={identity.id} className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{identity.provider}</Pill>
                  <Pill tone="amber">{identity.lookup_status}</Pill>
                </div>
                <div className="mt-2 font-bold text-white">{identity.provider_name || "Unnamed identity"}</div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{identity.provider_player_id}</div>
                <div className="mt-2 text-sm text-slate-400">Canonical player {identity.player_id} · {Number(identity.entrant_appearances).toLocaleString()} appearances{identity.provider_brawlhalla_id ? ` · Brawlhalla ID ${identity.provider_brawlhalla_id}` : ""}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/esports/player/id/${identity.player_id}`} className={cx(buttonBase, buttonTones.slate)}>Inspect player</a>
                <ReviewButton tone="amber" disabled={Boolean(working)} onClick={() => verifyIdentity(identity)}>{working === `identity:${identity.id}` ? "Saving…" : "Verify identity"}</ReviewButton>
              </div>
            </Card>
          ))}
          {!identityLoading && !identityError && !identities.length && <EmptyState bare title="No identities match this review status." />}
          {identityLoading && <LoadingState bare label="Loading identity queue…" />}
        </div>
        <Pagination page={identityMeta.page} totalPages={identityMeta.totalPages} onChange={identityPageChange} className="border-t border-slate-800" />

        <div className="border-t border-slate-800 pt-4">
          <Heading as="h4">Manual canonical merge</Heading>
          <p className="max-w-prose text-sm text-slate-500">Move every identity from a duplicate player into the right one. Unmerge brings the duplicate back from its log entry.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input inputMode="numeric" value={sourcePlayerId} onChange={(event) => setSourcePlayerId(event.target.value)} placeholder="Source player ID" aria-label="Source player ID" className={cx(field, "min-w-0 flex-1 sm:min-w-44")} />
            <input inputMode="numeric" value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)} placeholder="Target player ID" aria-label="Target player ID" className={cx(field, "min-w-0 flex-1 sm:min-w-44")} />
            <ReviewButton tone="amber" disabled={Boolean(working)} onClick={mergePlayers}>Merge</ReviewButton>
            <ReviewButton disabled={Boolean(working)} onClick={unmergePlayer}>Unmerge source</ReviewButton>
            <ReviewButton disabled={Boolean(working)} onClick={loadIdentityAudit}>Load identity audit</ReviewButton>
          </div>
          {!!identityAudit.length && (
            <ol className="mt-3 grid gap-2">
              {identityAudit.slice(0, 50).map((entry) => (
                <Card as="li" key={entry.id} className="text-sm">
                  <div className="font-semibold text-slate-200">{entry.action}: {entry.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()} · source {entry.source_player_id ?? "—"} · target {entry.target_player_id ?? "—"} · identity {entry.identity_id ?? "—"}</div>
                </Card>
              ))}
            </ol>
          )}
        </div>
      </Section>
    </PageShell>
  );
}
