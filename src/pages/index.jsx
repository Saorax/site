
import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/Pagination';
import PlayerDetails from '../components/PlayerDetails';
import Layout from '../layouts/Layout.astro';
import Card from '../components/Card.astro';

const IndexPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const handlePlayerClick = (playerId) => {
    setSelectedPlayer(playerId);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <div className="container mx-auto p-4">
          <h1 className="text-3xl mb-4">Brawlhalla Power Rankings</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card onClick={() => handlePlayerClick('some-player-id')} />
          </div>
          <Pagination totalPlayers={1128} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
        {selectedPlayer && <PlayerDetails playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      </div>
    </Layout>
  );
};

export default IndexPage;
