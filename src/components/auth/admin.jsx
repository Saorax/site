import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authFetch, readTokens } from "./session";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, Pill, Section, SidebarItem, Toggle, cx } from "../ui";

const cell = "px-3 py-2 ring-1 ring-slate-700/60";
const button = "rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";
const buttonTones = {
  emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
  blue: "border-blue-400/40 bg-blue-500 text-white hover:bg-blue-400",
  rose: "border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
};

function AdminPanel() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({});
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [seeding, setSeeding] = useState([]);
  const [modifiedSeeding, setModifiedSeeding] = useState([]);
  const [showOwned, setShowOwned] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [defaultSeeding, setDefaultSeeding] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingCustomPR, setLoadingCustomPR] = useState(false);
  const [loadingOfficialPR, setLoadingOfficialPR] = useState(false);
  const [uploadingSeeding, setUploadingSeeding] = useState(false);
  const [tournamentsError, setTournamentsError] = useState(null);
  const [loadingSeedingList, setLoadingSeedingList] = useState(false);

  const [signedOut, setSignedOut] = useState(null);

  const api = async (path, options) => {
    const result = await authFetch(path, options);
    if (result.signedOut) {
      setSignedOut(true);
      throw new Error("Your start.gg sign-in has expired.");
    }
    return result.response;
  };

  useEffect(() => {
    const token = readTokens().accessToken;
    if (!token) {
      setSignedOut(true);
      return;
    }
    setSignedOut(false);
    setAccessToken(token);
    fetchUserEvents();
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchUserEvents();
    }
  }, [showOwned, showUpcoming]);

  const fetchUserEvents = async () => {
    setLoadingTournaments(true);
    setTournamentsError(null);
    try {
      const response = await api(`/auth/events/user?upcoming=${showUpcoming}&owned=${showOwned}&page=1&perPage=10`);
      if (!response.ok) throw new Error(`start.gg request failed (${response.status}).`);
      const data = await response.json();
      if (data.user) setUser(data.user);
      setTournaments(data.tournaments);
    } catch (error) {
      setTournamentsError(error);
    } finally {
      setLoadingTournaments(false);
    }
  };

  const handleEventSelect = (eventId) => {
    setSelectedEvent(eventId);
    setPhases([]);
    setSeeding([]);
    setModifiedSeeding([]);
    fetchPhases(eventId);
  };

  const handleTournamentSelect = (tournamentId) => {
    setSelectedTournament(tournamentId);
    setEvents([]);
    setPhases([]);
    setSeeding([]);
    setModifiedSeeding([]);
    fetchEvents(tournamentId);
  };

  const fetchEvents = async (tournamentId) => {
    setLoadingEvents(true);
    try {
      const response = await api(`/auth/tournaments/${tournamentId}/events`);
      const data = await response.json();
      setEvents(data.events);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoadingEvents(false);
    }
  };


  const fetchPhases = async (eventId) => {
    setLoadingPhases(true);
    setPhases([]);
    setSeeding([]);
    setModifiedSeeding([]);
    try {
      const response = await api(`/auth/events/${eventId}/phases`);
      const data = await response.json();
      setPhases(data.phases);
    } catch (error) {
      console.error("Failed to fetch phases:", error);
    } finally {
      setLoadingPhases(false);
    }
  };


  const fetchSeeding = async (phaseId) => {
    setLoadingSeedingList(true);
    try {
      const response = await api(`/auth/phases/${phaseId}/seeding`);
      const data = await response.json();
      const sortedSeeding = data.seeding.sort((a, b) => parseFloat(a.seedNum) - parseFloat(b.seedNum));
      setSeeding(sortedSeeding);
      setDefaultSeeding(
        sortedSeeding.map((seed) => ({
          ...seed,
          displayName: seed.entrant.participants
            .map((participant) => participant.player.gamerTag)
            .join(" / "),
          pr: seed.pr || "Not Ranked",
        }))
      );
      setModifiedSeeding(
        sortedSeeding.map((seed) => ({
          ...seed,
          displayName: seed.entrant.participants
            .map((participant) => participant.player.gamerTag)
            .join(" / "),
          pr: seed.pr || "Not Ranked",
        }))
      );
      setSelectedPhase(phaseId);
    } catch (error) {
      console.error("Failed to fetch seeding:", error);
    } finally {
      setLoadingSeedingList(false);
    }
  };



  const fetchCustomPRSeeding = async () => {
    setLoadingCustomPR(true);
    try {
      const response = await api(`/auth/phases/${selectedPhase}/custom-pr-seeding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ players: seeding }),
        }
      );

      const data = await response.json();
      setModifiedSeeding(
        data.map((seed) => ({
          ...seed,
          displayName: seed.name,
          pr: seed.pr || "Not Ranked",
        }))
      );
    } catch (error) {
      console.error("Failed to fetch custom PR:", error);
    } finally {
      setLoadingCustomPR(false);
    }
  };


  const fetchOfficialPRSeeding = async () => {
    setLoadingOfficialPR(true);
    try {
      const response = await api(`/auth/phases/${selectedPhase}/official-pr-seeding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ players: seeding }),
        }
      );

      const data = await response.json();
      setModifiedSeeding(
        data.map((seed) => ({
          ...seed,
          displayName: seed.name,
          pr: seed.pr || "Not Ranked",
        }))
      );
    } catch (error) {
      console.error("Failed to fetch official PR:", error);
    } finally {
      setLoadingOfficialPR(false);
    }
  };


  const uploadModifiedSeeding = async () => {
    setUploadingSeeding(true);
    try {
      const response = await api(`/auth/phases/${selectedPhase}/upload-seeding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            seeding: modifiedSeeding.map(({ seedId, seedNum }) => ({
              seedId,
              seedNum,
            })),
          }),
        }
      );

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        toast.error(`Error: ${data.errors[0].message}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      } else {
        toast.success("Seeding uploaded.", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Seeding upload failed.", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    } finally {
      setUploadingSeeding(false);
    }
  };



  const updateModifiedSeed = (index, field, newSeedNum) => {
    setModifiedSeeding((prev) => {
      const newSeeding = [...prev];
      const currentSeedNum = newSeeding[index].seedNum;
      newSeeding[index][field] = newSeedNum;
      if (newSeedNum < currentSeedNum) {
        newSeeding.forEach((seed) => {
          if (seed.seedNum >= newSeedNum && seed.seedNum < currentSeedNum) {
            seed.seedNum += 1;
          }
        });
      } else if (newSeedNum > currentSeedNum) {
        newSeeding.forEach((seed) => {
          if (seed.seedNum > currentSeedNum && seed.seedNum <= newSeedNum) {
            seed.seedNum -= 1;
          }
        });
      }
      newSeeding.sort((a, b) => a.seedNum - b.seedNum);
      return newSeeding;
    });
  };

  const renderImage = (src, type, fallbackText = "") => {
    if (src) {
      return <img className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} shrink-0 rounded-lg object-cover`} src={src} alt={fallbackText} />;
    } else {
      return (
        <div className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} shrink-0 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-white`}>
          {fallbackText.charAt(0).toUpperCase() || "?"}
        </div>
      );
    }
  };
  const handleToggleOwned = () => {
    setShowOwned(!showOwned);
  };

  const handleToggleUpcoming = () => {
    setShowUpcoming(!showUpcoming);
  };
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const newSeeding = Array.from(modifiedSeeding);
    const [movedItem] = newSeeding.splice(result.source.index, 1);
    newSeeding.splice(result.destination.index, 0, movedItem);

    const updatedSeeding = newSeeding.map((seed, index) => ({
      ...seed,
      seedNum: index + 1,
    }));

    setModifiedSeeding(updatedSeeding);
  };
  const selectedTournamentData = tournaments?.find((t) => t.id === selectedTournament);
  const selectedEventData = events?.find((e) => e.id === selectedEvent);
  if (signedOut === null) {
    return (
      <PageShell>
        <LoadingState label="Checking sign-in" />
      </PageShell>
    );
  }
  if (signedOut) {
    return (
      <PageShell>
        <PageHeader title="Autoseed" />
        <EmptyState
          className="max-w-3xl"
          title="Sign in to use Autoseed"
          action={<a href="/esports/autoseed" className={cx(button, buttonTones.blue)}>Sign in with start.gg</a>}
        >
          Autoseed needs your start.gg account to list your tournaments and upload seeding.
        </EmptyState>
      </PageShell>
    );
  }
  return (
    <PageShell>
      <ToastContainer theme="dark" />
      <PageHeader title="Autoseed" meta={(
        <span className="flex flex-wrap gap-x-3">
          {user?.player?.gamerTag && <span>Signed in as {user.player.gamerTag}</span>}
          <a href="/esports/autoseed" className="text-blue-300 hover:underline">Account</a>
          <span className="lg:hidden">Seeding is drag and drop, so a computer works best.</span>
        </span>
      )} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        <div className="min-w-0 space-y-3">
          <Section
            title="Tournaments"
            actions={(
              <>
                <Toggle label="Show Owned" checked={showOwned} onChange={handleToggleOwned} />
                <Toggle label="Show Upcoming" checked={showUpcoming} onChange={handleToggleUpcoming} />
              </>
            )}
            bodyClassName="max-h-[25rem] overflow-y-auto app-scrollbar"
          >
            {loadingTournaments ? (
              <LoadingState bare label="Loading tournaments…" />
            ) : tournamentsError ? (
              <ErrorState message="Couldn't load your tournaments." detail={tournamentsError} onRetry={() => fetchUserEvents()} />
            ) : tournaments?.length > 0 ? (
              <div className="space-y-2">
                {tournaments.map((tournament) => (
                  <SidebarItem
                    key={tournament.id}
                    active={selectedTournament === tournament.id}
                    onClick={() => {
                      handleTournamentSelect(tournament.id);
                      setSelectedEvent(null);
                    }}
                  >
                    <span className="flex items-center gap-3">
                      {renderImage(tournament.images?.[0]?.url, 0, tournament.name)}
                      <span className="min-w-0 font-bold text-white">{tournament.name}</span>
                    </span>
                  </SidebarItem>
                ))}
              </div>
            ) : (
              <EmptyState bare title="No tournaments" />
            )}
          </Section>
          <div className="grid gap-3 sm:grid-cols-2">
            <Section title="Events" bodyClassName="max-h-[20rem] overflow-y-auto app-scrollbar">
              {loadingEvents ? (
                <LoadingState bare label="Loading events…" />
              ) : events?.length > 0 ? (
                <div className="space-y-2">
                  {events.map((event) => (
                    <SidebarItem key={event.id} active={selectedEvent === event.id} onClick={() => handleEventSelect(event.id)}>
                      <span className="font-bold text-white">{event.name}</span>
                    </SidebarItem>
                  ))}
                </div>
              ) : (
                <EmptyState bare title={selectedTournament ? "No events" : "Pick a tournament"} />
              )}
            </Section>
            <Section title="Phases" bodyClassName="max-h-[20rem] overflow-y-auto app-scrollbar">
              {loadingPhases ? (
                <LoadingState bare label="Loading phases…" />
              ) : phases?.length > 0 ? (
                <div className="space-y-2">
                  {phases.map((phase) => (
                    <SidebarItem key={phase.id} active={selectedPhase === phase.id} onClick={() => fetchSeeding(phase.id)}>
                      <span className="font-bold text-white">{phase.name}</span>
                    </SidebarItem>
                  ))}
                </div>
              ) : (
                <EmptyState bare title={selectedEvent ? "No phases" : "Pick an event"} />
              )}
            </Section>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          {selectedTournament && (
            <Card className="flex items-center gap-3">
              {renderImage(selectedTournamentData?.images?.[0]?.url, 1, selectedTournamentData?.name)}
              <div className="min-w-0">
                <a
                  href={`https://start.gg/${selectedTournamentData?.shortSlug || selectedTournamentData?.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-bold text-white hover:underline sm:text-2xl"
                >
                  {selectedTournamentData?.name || "Unknown"}
                  {selectedEvent && ` > ${selectedEventData?.name}`}
                </a>
                {selectedEvent && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300">
                    <p>
                      Entrants: {selectedEventData?.numEntrants || "N/A"}
                    </p>
                    <p>
                      Created At:{" "}
                      {new Date(selectedEventData?.createdAt * 1000).toLocaleString() || "Unknown"}
                    </p>
                    <p>
                      Start At:{" "}
                      {new Date(selectedEventData?.startAt * 1000).toLocaleString() || "Unknown"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Section title="Original Seeding" bodyClassName="max-h-[37rem] overflow-auto app-scrollbar">
              {loadingSeedingList ? (
                <LoadingState bare label="Loading seeding…" />
              ) : (
                <table className="w-full table-auto text-left text-sm">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className={cell}>Seed #</th>
                      <th className={cell}>Entrants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seeding.map((seed) => (
                      <tr key={seed.seedId} className="transition-all hover:bg-slate-800/70">
                        <td className={cell}>{seed.seedNum}</td>
                        <td className={cell}>
                          {seed.entrant.participants
                            .map((participant) => participant.player.gamerTag)
                            .join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
            <Section title="Modifiable Seeding">
              <div className="max-h-[34rem] overflow-auto app-scrollbar">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="modifiedSeeding">
                    {(provided) => (
                      <table
                        className="w-full table-auto text-left text-sm"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        <thead>
                          <tr className="bg-slate-800">
                            <th className={cell}>Seed #</th>
                            <th className={cell}>Name</th>
                            <th className={cell}>Power Ranking</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modifiedSeeding.map((seed, index) => (
                            <Draggable
                              key={seed.seedId}
                              draggableId={seed.seedId.toString()}
                              index={index}
                            >
                              {(provided) => (
                                <tr
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="bg-slate-900 transition-all hover:bg-slate-800/70"
                                >
                                  <td className={cell}>
                                    <input
                                      type="number"
                                      value={seed.seedNum}
                                      onChange={(e) =>
                                        updateModifiedSeed(
                                          index,
                                          "seedNum",
                                          parseInt(e.target.value, 10)
                                        )
                                      }
                                      className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-white outline-none focus:border-blue-400"
                                    />
                                  </td>
                                  <td className={cell}>
                                    {seed.displayName}
                                  </td>
                                  <td className={cell}>
                                    {seed.prData?.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {seed.prData.map((participantPr, i) => (
                                          <Pill key={i} tone="blue">
                                            PR:{" "}
                                            {(participantPr.data?.pr?.powerRanking || participantPr.place) ?? "N/A"}
                                          </Pill>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-slate-500">N/A</p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      </table>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fetchCustomPRSeeding}
                  className={cx(button, buttonTones.emerald)}
                  disabled={loadingCustomPR}
                >
                  {loadingCustomPR ? "Loading…" : "Custom PR (Saorax)"}
                </button>
                <button
                  type="button"
                  onClick={fetchOfficialPRSeeding}
                  className={cx(button, buttonTones.emerald)}
                  disabled={loadingOfficialPR}
                >
                  {loadingOfficialPR ? "Loading…" : "Official PR"}
                </button>
                <button
                  type="button"
                  onClick={uploadModifiedSeeding}
                  className={cx(button, buttonTones.blue)}
                  disabled={uploadingSeeding}
                >
                  {uploadingSeeding ? "Uploading…" : "Upload Seeding"}
                </button>
                <button
                  type="button"
                  onClick={() => setModifiedSeeding(defaultSeeding)}
                  className={cx(button, buttonTones.rose)}
                >
                  Restore default
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default AdminPanel;
