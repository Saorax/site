import React, { useState } from 'react';
import FileUpload from '../components/FileUpload.jsx';
import PlayerCard from '../components/PlayerCard.jsx';

const MatchDisplay = ({ matchData }) => {
    return (
      <div className="w-full mx-auto p-6">
        <h2 className="text-3xl font-bold text-center mb-6">Match Overview</h2>
        <p className="text-center text-lg mb-4">Map: {matchData.mapName}</p>
        <p className="text-center text-lg mb-6">Duration: {matchData.matchLength} seconds</p>
  
        <div className="w-full">
          {matchData.players[0].teamNum ? (
            <div className="flex justify-evenly">
              <div className="border p-2 rounded-lg bg-gray-800 text-white">
                <h3 className="text-2xl font-semibold mb-4">Team 1</h3>
                <div className="flex justify-center gap-3">
                  {matchData.players.filter((p) => p.teamNum === 1).map((player, index) => (
                    <PlayerCard key={index} player={player} />
                  ))}
                </div>
              </div>
              <div className="border p-2 rounded-lg bg-gray-800 text-white">
                <h3 className="text-2xl font-semibold mb-4">Team 2</h3>
                <div className="flex justify-center gap-3">
                  {matchData.players.filter((p) => p.teamNum === 2).map((player, index) => (
                    <PlayerCard key={index} player={player} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border p-4 rounded-lg bg-gray-800 text-white">
              <h3 className="text-2xl font-semibold mb-4">Team 1</h3>
              {matchData.players.map((player, index) => (
                <PlayerCard key={index} player={player} />
              ))}
            </div>
          )}
        </div>
        <div className="text-center mt-8">
          <p className="text-2xl font-bold text-green-500">{matchData.winner}</p>
        </div>
      </div>
    );
  };
const App = () => {
    const [matchData, setMatchData] = useState(null);

    const handleUpload = (data) => {
      setMatchData(data);
    };

    return (
      <div className="w-full justify-center items-center text-center mx-auto">
        <h1 className="text-4xl font-bold text-center mb-6">Brawlhalla Match Data</h1>
        <FileUpload onUpload={handleUpload} />
        {matchData ? <MatchDisplay matchData={matchData} /> : <p className="text-center mt-6">No data uploaded yet.</p>}
      </div>
    );
  };
export default App;
