import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

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
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [created, setCreated] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('access_token') || localStorage.getItem('accessToken');
    if (token) {
      localStorage.setItem('accessToken', token);
      setAccessToken(token);
      fetchUserInfo(token);
      fetchUserEvents(token, currentPage);
    } else {
      window.location.href = '/';
    }
  }, [currentPage]);

  useEffect(() => {
    if (accessToken) {
      fetchUserEvents(accessToken, 1);
    }
  }, [upcomingOnly, created]);

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(`http://localhost:3001/auth/events/user?upcoming=${upcomingOnly}&owned=${created}&page=${currentPage}&perPage=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error("Failed to fetch user info", error);
    }
  };

  const fetchUserEvents = async (token, page) => {
    setLoadingTournaments(true);
    try {
      const response = await fetch(
        `http://localhost:3001/auth/events/user?upcoming=${upcomingOnly}&owned=${created}&page=${page}&perPage=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setTournaments(data.tournaments);
      setTotalPages(Math.ceil(data.totalTournaments / 10));
    } catch (error) {
      console.error("Failed to fetch tournaments", error);
    } finally {
      setLoadingTournaments(false);
    }
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
    try {
      const response = await fetch(`http://localhost:3001/auth/tournaments/${tournamentId}/events`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      setEvents(data.events);
      setSelectedTournament(tournamentId);
    } catch (error) {
      console.error("Failed to fetch events", error);
    }
  };

  const fetchPhases = async (eventId) => {
    setPhases([]);
    setSeeding([]);
    setModifiedSeeding([]);
    try {
      const response = await fetch(`http://localhost:3001/auth/events/${eventId}/phases`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      setPhases(data.phases);
      setSelectedEvent(eventId);
    } catch (error) {
      console.error("Failed to fetch phases", error);
    }
  };

  const fetchSeeding = async (phaseId) => {
    try {
      const response = await fetch(`http://localhost:3001/auth/phases/${phaseId}/seeding`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      setSeeding(data.seeding.sort((a, b) => parseFloat(a.seedNum) - parseFloat(b.seedNum)));
      setModifiedSeeding(data.seeding.map((seed) => ({ ...seed })));
      setSelectedPhase(phaseId);
    } catch (error) {
      console.error("Failed to fetch seeding", error);
    }
  };

  const fetchCustomPRSeeding = async () => {
    try {
      console.log(seeding)
      const response = await fetch(`http://localhost:3001/auth/phases/${selectedPhase}/custom-pr-seeding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          players: seeding,
        }),
      });
      const data = await response.json();
      console.log(data)
      setModifiedSeeding(data);
    } catch (error) {
      console.error("Failed to fetch custom PR seeding", error);
    }
  };

  const fetchOfficialPRSeeding = async () => {
    try {
      const response = await fetch(`http://localhost:3001/auth/phases/${selectedPhase}/official-pr-seeding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          players: seeding.map(({ seedId, seedNum, entrant }) => ({
            seedId,
            seedNum,
            gamerTag: entrant.participants.map(p => p.player?.gamerTag).join(', '),
          })),
        }),
      });
      const data = await response.json();
      setModifiedSeeding(data.seeding);
    } catch (error) {
      console.error("Failed to fetch official PR seeding", error);
    }
  };

  const uploadModifiedSeeding = async () => {
    try {
      const response = await fetch(`http://localhost:3001/auth/phases/${selectedPhase}/upload-seeding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seeding: modifiedSeeding.map(({ seedId, seedNum }) => ({ seedId, seedNum }))
        }),
      });
      if (response.ok) {
        alert("Seeding uploaded successfully!");
      } else {
        console.error("Failed to upload modified seeding", await response.text());
      }
    } catch (error) {
      console.error("Failed to upload modified seeding", error);
    }
  };

  const updateModifiedSeed = (index, field, value) => {
    setModifiedSeeding((prev) => {
      const newSeeding = [...prev];
      newSeeding[index][field] = value;
      return newSeeding;
    });
  };

  const renderParticipantNames = (participants) => {
    return participants
      .map((participant) => participant.player?.gamerTag)
      .join(', ');
  };

  const renderImage = (src, fallbackText = '') => {
    if (src) {
      return <img className="w-12 h-12 rounded-lg" src={src} alt={fallbackText} />;
    } else {
      return (
        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-white">
          {fallbackText.charAt(0).toUpperCase() || '?'}
        </div>
      );
    }
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

  return (
    <div className="text-white p-4">
      <div className="flex items-center mb-4">
        {renderImage(user.images?.[0]?.url, user.player?.gamerTag)}
        <div className="pl-2">
          <p className="text-3xl">{user.player?.gamerTag}</p>
          <a className="text-slate-400 text-xl" target="_blank" rel="noopener noreferrer" href={"https://start.gg/" + user.slug}>{user.slug}</a>
        </div>
      </div>
      <div className="flex">
        <div className="w-[30%]">
          <div className="flex space-x-4 text-base">
            <p>{tournaments.length} tournaments</p>
            <div className="flex">
              <input type="checkbox" checked={upcomingOnly} onChange={() => setUpcomingOnly((prev) => !prev)} />
              <p className="pl-1">Show Upcoming</p>
            </div>
            <div className="flex">
              <input type="checkbox" checked={created} onChange={() => setCreated((prev) => !prev)} />
              <p className="pl-1">Show Created</p>
            </div>
          </div>
          {loadingTournaments ? (
            <p>Loading tournaments...</p>
          ) : (
            <div className="h-[48rem] overflow-y-auto scrollbar-thin pr-2 scrollbar-track-rose-800">
              {tournaments.length > 0 ? (
                tournaments.map((tournament) => (
                  <div key={tournament.id} onClick={() => handleTournamentSelect(tournament.id)} className="border-2 border-slate-700 bg-slate-900 rounded-xl p-2 my-1.5 cursor-pointer hover:bg-slate-800 transition-all">
                    <div className="flex">
                      {renderImage(tournament.images?.[0]?.url, tournament.name)}
                      <div className="ml-2">
                        <p className="text-lg">{tournament.name}</p>
                        <p className="text-sm">{new Date(tournament.startAt * 1000).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p>No tournaments found</p>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
            </button>
          </div>
        </div>
        <div className="w-full pl-2">
          <div className="flex">
            <div className="w-[25%]">
              <p className="text-xl mb-2">Events</p>
              <div>
                {events.length > 0 ? (
                  events.map((event) => (
                    <div key={event.id} onClick={() => fetchPhases(event.id)} className="p-2 border-2 border-gray-600 rounded-md my-1 cursor-pointer hover:bg-gray-700 transition-all">
                      {event.name}
                    </div>
                  ))
                ) : (
                  <p>Select a tournament to view events</p>
                )}
              </div>
            </div>
            <div className="w-[25%] ml-4">
              <p className="text-xl mb-2">Phases</p>
              <div>
                {phases.length > 0 ? (
                  phases.map((phase) => (
                    <div key={phase.id} onClick={() => fetchSeeding(phase.id)} className="p-2 border-2 border-gray-600 rounded-md my-1 cursor-pointer hover:bg-gray-700 transition-all">
                      {phase.name}
                    </div>
                  ))
                ) : (
                  <p>Select an event to view phases</p>
                )}
              </div>
            </div>
          </div>
          <div className="min-w-[25%] mt-4">
            <h2 className="text-2xl mb-2">Seeding Information</h2>
            <div className="flex">
              <div className="w-1/2 pr-2">
                <h3 className="text-xl mb-2">Original Seeding</h3>
                <table className="table-auto w-full text-left border border-gray-600 rounded-lg">
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
                        <td className="px-4 py-2 border-b border-gray-600">{renderParticipantNames(seed.entrant.participants)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="w-1/2 pl-2">
                <h3 className="text-xl mb-2">Modified Seeding</h3>
                <DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="modifiedSeeding">
    {(provided) => (
      <table
        className="table-auto w-full text-left border border-gray-600 rounded-lg"
        {...provided.droppableProps}
        ref={provided.innerRef}
      >
        <thead>
          <tr className="bg-gray-800">
            <th className="px-4 py-2 border-b border-gray-600">Seed #</th>
            <th className="px-4 py-2 border-b border-gray-600">Entrants</th>
            <th className="px-4 py-2 border-b border-gray-600">PR Place</th>
            <th className="px-4 py-2 border-b border-gray-600">PR Total</th>
            <th className="px-4 py-2 border-b border-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {modifiedSeeding.map((seed, index) => (
            <Draggable key={seed.seedId} draggableId={seed.seedId.toString()} index={index}>
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
                      className="bg-gray-800 border border-gray-600 rounded p-1 w-full text-center"
                      value={seed.seedNum}
                      readOnly
                    />
                  </td>
                  <td className="px-4 py-2 border-b border-gray-600">{seed.gamerTag}</td>
                  <td className="px-4 py-2 border-b border-gray-600">
                    {seed.prData && seed.prData.length > 0 ? seed.prData[0].place : 'N/A'}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-600">
                    {seed.prData && seed.prData.length > 0 ? seed.prData[0].total.toFixed(2) : 'N/A'}
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

                <div className="mt-4 space-x-2">
                  <button onClick={fetchCustomPRSeeding} className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 transition-all">Custom PR Seeding</button>
                  <button onClick={fetchOfficialPRSeeding} className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 transition-all">Official PR Seeding</button>
                  <button onClick={uploadModifiedSeeding} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-all">Upload Modified Seeding</button>
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
