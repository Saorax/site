import React, { useState, useEffect } from 'react';

const PlayerCard = ({ player }) => {
  const [image, setImage] = useState(null);

  useEffect(() => {
    // Fetch the legend data from the API asynchronously
    const fetchLegendImage = async () => {
      try {
        const legendApi = await fetch(`https://api.saorax.xyz/game/legends/${player.loadout.LegendID}`).then(res => res.json());
        const skin = legendApi.skins.find(skin => skin.id == player.loadout.SkinID);
        const imageUrl = `https://api.saorax.xyz/game/legends/${player.loadout.LegendID}/${skin.index}/create`;
        setImage(imageUrl);
      } catch (error) {
        console.error('Error fetching legend image:', error);
      }
    };

    fetchLegendImage();
  }, [player.loadout.LegendID, player.loadout.SkinID]);

  return (
    <div className="bg-gray-700 p-2 rounded-xl mb-4 w-full  text-white">
      <div className='flex'>
      {image ? (
          <img src={image} className='h-48 w-48 rounded-3xl border-gray-500 border-2' alt={`${player.loadout.SkinName}`} />
        ) : (
          <p>Loading image...</p>
        )}
        <div className='flex flex-col ml-2 text-left'>
          <p className="text-2xl font-bold">{player.name}</p>
          <p className="text-lg font-semibold opacity-40">{player.loadout.LegendName}</p>
        </div>
        
      </div>

      <p className="mb-1">Damage Done: <span className="font-semibold">{player.dmgDone}</span></p>
      <p className="mb-1">Damage Taken: <span className="font-semibold">{player.dmgTaken}</span></p>

      <div className="mb-3">
        <p className="font-semibold">Stock Information:</p>
        {player.stockPercents.map((percent, index) => (
          <p key={index} className="text-sm">Stock {index + 1}: {percent}%</p>
        ))}
      </div>

      <div className="mt-2">
        <p className="font-semibold mb-1">Weapons</p>
        <p>Weapon 1: <span className="font-semibold">{player.loadout.WeaponSkin1.WeaponSkinName}</span></p>
        <p>Weapon 2: <span className="font-semibold">{player.loadout.WeaponSkin2.WeaponSkinName}</span></p>
        <div className="mt-2">
          <p className="font-semibold">Weapon Stats:</p>
          {player.weapon1 && (
            <div>
              <p>KOs (Weapon 1): {player.weapon1.heavy.kos}</p>
              <p>Accuracy (Weapon 1): {player.weapon1.accuracy}%</p>
            </div>
          )}
          {player.weapon2 && (
            <div>
              <p>KOs (Weapon 2): {player.weapon2.heavy.kos}</p>
              <p>Accuracy (Weapon 2): {player.weapon2.accuracy}%</p>
            </div>
          )}
        </div>
      </div>

      {player.teamNum && (
        <div className="mt-3">
          <p className="font-semibold">Team Information:</p>
          <p>Team: {player.teamNum}</p>
          <p>Team Damage Done: {player.teamDmgDealt}</p>
          <p>Team Damage Taken: {player.teamDmgTaken}</p>
        </div>
      )}
    </div>
  );
};

export default PlayerCard;
