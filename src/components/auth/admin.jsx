import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../../stuff"
function AdminPanel() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({});
  const [tournaments, setTournaments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
  const [loadingSeedingList, setLoadingSeedingList] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("access_token") || localStorage.getItem("accessToken");
    if (token) {
      localStorage.setItem("accessToken", token);
      setAccessToken(token);
      fetchUserInfo(token);
      fetchUserEvents(token, currentPage);
      searchParams.delete("access_token");
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState(null, "", newUrl);
    } else {
      window.location.href = "./";
    }
  }, [currentPage]);

  useEffect(() => {
    if (accessToken) {
      fetchUserEvents(accessToken, 1);
    }
  }, [showOwned, showUpcoming]);

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(
        `${host}/auth/events/user?upcoming=${showUpcoming}&owned=${showOwned}&page=${currentPage}&perPage=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setUser(data.user);
    } catch (error) {}
  };

  const fetchUserEvents = async (token, page) => {
    setLoadingTournaments(true);
    try {
      const response = await fetch(
        `${host}/auth/events/user?upcoming=${showUpcoming}&owned=${showOwned}&page=${page}&perPage=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setTournaments(data.tournaments);
      setTotalPages(Math.ceil(data.totalTournaments / 10));
    } catch (error) {
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
      const response = await fetch(
        `${host}/auth/tournaments/${tournamentId}/events`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
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
      const response = await fetch(
        `${host}/auth/events/${eventId}/phases`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
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
      const response = await fetch(`${host}/auth/phases/${phaseId}/seeding`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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
      const response = await fetch(
        `${host}/auth/phases/${selectedPhase}/custom-pr-seeding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
      const response = await fetch(
        `${host}/auth/phases/${selectedPhase}/official-pr-seeding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
      const response = await fetch(
        `${host}/auth/phases/${selectedPhase}/upload-seeding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
        toast.success("Seeding uploaded successfully!", {
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
      toast.error("An unexpected error occurred while uploading the seeding.", {
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

  const renderParticipantNames = (participants) => {
    return participants.map((participant) => participant.player?.gamerTag).join(" / ");
  };

  const renderImage = (src, type, fallbackText = "") => {
    if (src) {
      return <img className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} rounded-lg`} src={src} alt={fallbackText} />;
    } else {
      return (
        <div className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} rounded-lg bg-slate-700 flex items-center justify-center text-white`}>
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
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "./";
  };
  return (
    <div className="text-white p-6 bg-gradient-to-b from-gray-900 to-gray-800 min-h-screen">
      <ToastContainer />
      <div className="mx-auto">
        <div className="flex">
          <div className="flex w-[35%] px-2">
            <div className="w-full">
              <div className="mb-2">
              <div className="flex items-center mb-4">
                {renderImage(user.images?.[0]?.url, user.player?.gamerTag)}
                <div className="pl-2">
                  <p className="text-3xl">{user.player?.gamerTag}</p>
                  <a
                    className="text-slate-400 text-xl"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={"https://start.gg/" + user.slug}
                  >
                    {user.slug}
                  </a>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded ml-3"
                >
                  Logout
                </button>
              </div>
                <div className="flex justify-between mb-2">
                  <h3 className="text-center text-3xl font-bold">Tournaments</h3>
                  <div className="flex justify-between">
                    <div>
                      <label className="text-lg inline-flex items-center">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={showOwned}
                          onChange={handleToggleOwned}
                        />
                        <span className="ml-2">Show Owned</span>
                      </label>
                      <label className="text-lg inline-flex items-center ml-4">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={showUpcoming}
                          onChange={handleToggleUpcoming}
                        />
                        <span className="ml-2">Show Upcoming</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="h-[25rem] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 border border-gray-700 rounded-lg p-4 bg-gray-900">
                {loadingTournaments ? (
                  <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-400"></div>
                  <p className="pl-2 text-gray-400">Loading tournaments...</p>
                </div>
                ) : (
                  tournaments.length > 0 &&
                  tournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      onClick={() => {
                        handleTournamentSelect(tournament.id);
                        setSelectedEvent(null);
                      }}
                      className={`p-2 border-2 border-gray-600 rounded-md my-1 cursor-pointer ${
                        selectedTournament === tournament.id ? "bg-gray-700" : "hover:bg-gray-700"
                      } transition-all`}
                    >
                      <div className="flex items-center">
                        {renderImage(tournament.images?.[0]?.url, 0, tournament.name)}
                        <p className="pl-2 text-lg">{tournament.name}</p>
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
              <div className="flex w-full space-x-2">
                <div className="w-[50%]">
                  <div className="h-[20rem] scrollbar-thin scrollbar-track-gray-800 border border-gray-700 rounded-lg p-4 bg-gray-900">
                  <h3 className="text-center text-3xl font-bold mb-3">Events</h3>
                  {loadingEvents ? (
                    <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-400"></div>
                    <p className="pl-2 text-gray-400">Loading events...</p>
                  </div>
                  ) : (
                    events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEventSelect(event.id)}
                        className={`p-2 text-lg border-2 ${
                          selectedEvent === event.id ? "bg-gray-700" : "hover:bg-gray-800"
                        } border-gray-600 rounded-md my-1 cursor-pointer transition-all`}
                      >
                        {event.name}
                      </div>
                    ))
                  )}
                  </div>
                </div>
                <div className="w-[50%]">
                  <div className="h-[20rem] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 border border-gray-700 rounded-lg p-4 bg-gray-900">
                  <h3 className="text-3xl text-center font-bold mb-3">Phases</h3>
                  {loadingPhases ? (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-400"></div>
                      <p className="pl-2 text-gray-400">Loading phases...</p>
                    </div>
                  ) : (
                    phases.map((phase) => (
                      <div
                        key={phase.id}
                        onClick={() => fetchSeeding(phase.id)}
                        className={`p-2 text-lg border-2 ${
                          selectedPhase === phase.id ? "bg-gray-700" : "hover:bg-gray-800"
                        } border-gray-600 rounded-md my-1 cursor-pointer transition-all`}
                      >
                        {phase.name}
                      </div>
                    ))
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="ml-2 flex w-[65%] flex-col">
            {selectedTournament && (
              <div className="flex items-center bg-gray-800 p-4 rounded-lg mb-8 shadow-lg">
                {renderImage(
                  tournaments.find((t) => t.id === selectedTournament)?.images?.[0]?.url,
                  1,
                  tournaments.find((t) => t.id === selectedTournament)?.name
                )}
                <div className="pl-4">
                  <a
                    href={`https://start.gg/${
                      tournaments.find((t) => t.id === selectedTournament)?.shortSlug ||
                      tournaments.find((t) => t.id === selectedTournament)?.slug
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl font-bold hover:underline"
                  >
                    {tournaments.find((t) => t.id === selectedTournament)?.name || "Unknown"} 
                    {selectedEvent && ` > ${events.find((e) => e.id === selectedEvent)?.name}`}
                  </a>
                  {selectedEvent && (
                    <div className="flex mt-2 space-x-6 text-lg text-gray-300">
                      <p>
                        Entrants: {events.find((e) => e.id === selectedEvent)?.numEntrants || "N/A"}
                      </p>
                      <p>
                        Created At:{" "}
                        {new Date(
                          events.find((e) => e.id === selectedEvent)?.createdAt * 1000
                        ).toLocaleString() || "Unknown"}
                      </p>
                      <p>
                        Start At:{" "}
                        {new Date(
                          events.find((e) => e.id === selectedEvent)?.startAt * 1000
                        ).toLocaleString() || "Unknown"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex mb-6">
              <div className="pr-6 w-[40%]">
                <h3 className="text-3xl font-bold mb-2">Original Seeding</h3>
                <div className="h-[37rem] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 rounded-lg p-4 bg-gray-900">
                {loadingSeedingList ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-400"></div>
                      <p className="ml-4 text-gray-400">Loading seeding...</p>
                    </div>
                  ) : ( <table className="table-auto text-left rounded-lg w-full">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="px-4 py-2 border-b border-gray-600">Seed #</th>
                        <th className="px-4 py-2 border-b border-gray-600">Entrants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seeding.map((seed) => (
                        <tr key={seed.seedId} className="hover:bg-gray-700 transition-all">
                          <td className="px-4 py-2 border-b border-gray-600">{seed.seedNum}</td>
                          <td className="px-4 py-2 border-b border-gray-600">
                            {seed.entrant.participants
                              .map((participant) => participant.player.gamerTag)
                              .join(" / ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>)}
                </div>
              </div>
              <div className="w-[60%]">
                <h3 className="text-3xl font-bold mb-2">Modifiable Seeding</h3>
                <div className="h-[34rem] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 rounded-lg p-4 bg-gray-900">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="modifiedSeeding">
                      {(provided) => (
                        <table
                          className="table-auto w-full text-left rounded-lg"
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          <thead>
                            <tr className="bg-gray-800">
                              <th className="px-4 py-2 border-b border-gray-600">Seed #</th>
                              <th className="px-4 py-2 border-b border-gray-600">Name</th>
                              <th className="px-4 py-2 border-b border-gray-600">Power Ranking</th>
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
                                    className="hover:bg-gray-700 transition-all"
                                  >
                                    <td className="px-4 py-2 border-b border-gray-600">
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
                                        className="w-16 bg-transparent border border-gray-600 rounded px-2 py-1 text-center"
                                      />
                                    </td>
                                    <td className="px-4 py-2 border-b border-gray-600">
                                      {seed.displayName}
                                    </td>
                                    <td className="px-4 py-2 border-b border-gray-600">
                                      {seed.prData?.length > 0 ? (
                                        <div className="flex space-x-4">
                                          {seed.prData.map((participantPr, i) => (
                                            <div key={i}>
                                              PR:{" "}
                                              {(participantPr.data?.pr?.powerRanking || participantPr.place) ?? "N/A"}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p>N/A</p>
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
                <div className="mt-2 space-x-2">
                  <button
                    onClick={fetchCustomPRSeeding}
                    className={`bg-green-600 px-4 py-2 rounded hover:bg-green-700 transition-all ${
                      loadingCustomPR ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={loadingCustomPR}
                  >
                    {loadingCustomPR ? "Loading..." : "Custom PR (Saorax)"}
                  </button>
                  <button
                    onClick={fetchOfficialPRSeeding}
                    className={`bg-green-600 px-4 py-2 rounded hover:bg-green-700 transition-all ${
                      loadingOfficialPR ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={loadingOfficialPR}
                  >
                    {loadingOfficialPR ? "Loading..." : "Official PR"}
                  </button>
                  <button
                    onClick={uploadModifiedSeeding}
                    className={`bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-all ${
                      uploadingSeeding ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={uploadingSeeding}
                  >
                    {uploadingSeeding ? "Uploading..." : "Upload Seeding"}
                  </button>
                  <button
                    onClick={() => setModifiedSeeding(defaultSeeding)}
                    className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition-all"
                  >
                    Restore Default
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
