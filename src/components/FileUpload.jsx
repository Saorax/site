import React, { useState } from 'react';

const FileUpload = ({ onUpload }) => {
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          const matchData = convertToMatchData(json);
          onUpload(matchData);
        } catch (err) {
          setError('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    } else {
      setError('Please upload a valid JSON file.');
    }
  };

  const convertToMatchData = (file) => {
    let players = ['Player1', 'Player2', file.Teams !== false ? 'Player3' : null, file.Teams !== false ? 'Player4' : null].filter(Boolean);
    let weapons = [
      ['Unarmed', 'Unarmed'],
      ['Katar', 'Katars'],
      ['Pistol', 'Blasters'],
      ['Bow', 'Bow'],
      ['Boots', 'Battle Boots'],
      ['Cannon', 'Cannon'],
      ['Scythe', 'Scythe'],
      ['RocketLance', 'Lance'],
      ['Orb', 'Orb'],
      ['Greatsword', 'Greatsword'],
      ['Spear', 'Spear'],
      ['Sword', 'Sword'],
      ['Hammer', 'Hammer'],
      ['Fists', 'Gauntlets'],
      ['Axe', 'Axe']
    ];

    let moves = ['GroundPound', 'Recovery', 'Throw', 'dHeavy', 'dLight', 'dAir', 'sHeavy', 'sLight', 'sAir', 'nHeavy', 'nLight', 'nAir'];
    let playerArray = [];

    for (var i = 0; i < (file.Teams === true ? 4 : 2); i++) {
      if (file[players[i]] !== undefined) {
        let weapon1, weapon2, unarmed;
        let dmgDone = 0, dmgTaken = 0, totalHeavyUsed = 0, totalLightUsed = 0, totalHeavyHits = 0, totalLightHits = 0, deathPercent = [];
        let stockLen = [0];
        let num = 0;

        for (var w = 0; w < weapons.length; w++) {
          if (file[players[i]][weapons[w][0]] !== undefined) {
            let tempWeapon = {
              name: weapons[w][1],
              image: `\\weapons\\${weapons[w][1].toLowerCase()}.png`,
              heavy: { dmgDone: 0, uses: 0, hits: 0, kos: 0, teamHits: 0, teamDmg: 0, accuracy: 0 },
              light: { dmgDone: 0, uses: 0, hits: 0, kos: 0, teamHits: 0, teamDmg: 0, accuracy: 0 },
              dmgTaken: Math.round(file[players[i]][weapons[w][0]].DamageTaken),
              dmgDone: 0,
              accuracy: 0,
              throws: file[players[i]][weapons[w][0]].Throw ? file[players[i]][weapons[w][0]].Throw.Uses : 0,
              timeHeld: Math.round(file[players[i]][weapons[w][0]].TimeHeld / 1000)
            };

            for (var m = 0; m < moves.length; m++) {
              if (file[players[i]][weapons[w][0]][moves[m]]) {
                let move = file[players[i]][weapons[w][0]][moves[m]];

                if (moves[m].includes("Heavy") || moves[m] === "GroundPound" || moves[m] === "Recovery") {
                  tempWeapon.heavy.dmgDone += Math.round(move.EnemyDamage || 0);
                  tempWeapon.heavy.uses += Math.round(move.Uses || 0);
                  tempWeapon.heavy.hits += Math.round(move.EnemyHits || 0);
                  tempWeapon.heavy.teamHits += Math.round(move.TeamHits || 0);
                  tempWeapon.heavy.teamDmg += Math.round(move.TeamDamage || 0);
                  tempWeapon.heavy.kos += Math.round(move.EnemyKOs || 0);
                } else if (moves[m].includes("Light") || moves[m].includes("Air")) {
                  tempWeapon.light.dmgDone += Math.round(move.EnemyDamage || 0);
                  tempWeapon.light.uses += Math.round(move.Uses || 0);
                  tempWeapon.light.hits += Math.round(move.EnemyHits || 0);
                  tempWeapon.light.teamHits += Math.round(move.TeamHits || 0);
                  tempWeapon.light.teamDmg += Math.round(move.TeamDamage || 0);
                  tempWeapon.light.kos += Math.round(move.EnemyKOs || 0);
                }
              }
            }

            tempWeapon.dmgDone = Math.round(tempWeapon.heavy.dmgDone + tempWeapon.light.dmgDone);
            dmgDone += tempWeapon.dmgDone;
            dmgTaken += tempWeapon.dmgTaken;
            totalHeavyHits += tempWeapon.heavy.hits;
            totalLightHits += tempWeapon.light.hits;
            totalHeavyUsed += tempWeapon.heavy.uses;
            totalLightUsed += tempWeapon.light.uses;

            tempWeapon.accuracy = Math.round(
              ((tempWeapon.heavy.hits / tempWeapon.heavy.uses + tempWeapon.light.hits / tempWeapon.light.uses) * 100) || 0
            );
            tempWeapon.heavy.accuracy = Math.round((tempWeapon.heavy.hits / tempWeapon.heavy.uses) * 100 || 0);
            tempWeapon.light.accuracy = Math.round((tempWeapon.light.hits / tempWeapon.light.uses) * 100 || 0);

            if (weapons[w][0] === "Unarmed") {
              unarmed = tempWeapon;
            } else if (!weapon1) {
              weapon1 = tempWeapon;
            } else {
              weapon2 = tempWeapon;
            }
          }
        }

        for (var s = 0; s < file[players[i]].Sequence.length; s++) {
          let seq = file[players[i]].Sequence[s];
          if (seq !== undefined) {
            if (seq.d === 0 && s !== 0) {
              let lastDmg = 0, ta = s;
              while (lastDmg === 0) {
                stockLen[num] = file[players[i]].Sequence[ta + 1 < file[players[i]].Sequence.length ? ta + 1 : ta].t;
                if (file[players[i]].Sequence[ta].d) {
                  lastDmg = file[players[i]].Sequence[ta].d;
                  deathPercent.push(Math.round(lastDmg));
                  num++;
                  stockLen.push(0);
                }
                ta--;
              }
              if (s === file[players[i]].Sequence.length - 1 && seq.d !== 0) {
                deathPercent.push(seq.d);
              }
            } else if (seq.d > 0 && file[players[i]].Sequence.length - 1 === s) {
              let lastDmg = 0, ta = s;
              while (lastDmg === 0) {
                stockLen[num] = file[players[i]].Sequence[ta + 1 < file[players[i]].Sequence.length ? ta + 1 : ta].t;
                if (file[players[i]].Sequence[ta] !== undefined && file[players[i]].Sequence[ta].d) {
                  lastDmg = file[players[i]].Sequence[ta].d;
                  deathPercent.push(Math.round(lastDmg));
                  num++;
                }
                ta--;
              }
            }
          }
        }

        if (stockLen.length === 4) stockLen = [stockLen[0], stockLen[1], stockLen[2]];
        if (stockLen.length === 2) {
          stockLen[stockLen.length - 1] = Math.round((file.GameDuration - stockLen[0]) / 1000);
          stockLen[0] = Math.round(stockLen[0] / 1000);
        } else if (stockLen.length === 1) {
          stockLen[0] = Math.round(file.GameDuration / 1000);
        } else {
          for (var v = deathPercent.length - 1; v >= 1; v--) {
            stockLen[v] = Math.round((stockLen[v] - stockLen[v - 1]) / 1000);
          }
          stockLen[0] = Math.round(stockLen[0] / 1000);
        }

        playerArray.push({
          name: file[players[i]].PlayerName,
          brawlId: file[players[i]].BrawlhallaID,
          legendImage: `\\legends\\${file[players[i]].Loadout.LegendName.toLowerCase()}.png`,
          loadout: file[players[i]].Loadout,
          throws: (weapon1 ? weapon1.throws : 0) + (weapon2 ? weapon2.throws : 0),
          dmgDone: Math.round(dmgDone),
          dmgTaken: Math.round(file[players[i]].DamageTaken),
          stockPercents: deathPercent,
          stockLength: stockLen,
          teamNum: file.Teams === false ? null : file[players[i]].TeamNum,
          teamDmgTaken: file.Teams === false ? null : Math.round(file[players[i]].TeamDamageTaken),
          teamDmgDealt: file.Teams === false ? null : Math.round(file[players[i]].TeamDamageDealt),
          light: {
            accuracy: Math.round((totalLightHits / totalLightUsed) * 100 || 0),
            used: totalLightUsed,
            hits: totalLightHits
          },
          heavy: {
            accuracy: Math.round((totalHeavyHits / totalHeavyUsed) * 100 || 0),
            used: totalHeavyUsed,
            hits: totalHeavyHits
          },
          weapon1,
          weapon2,
          unarmed
        });
      }
    }

    return {
      matchLength: Math.round(file.GameDuration / 1000),
      mapName: file.MapName,
      players: playerArray
    };
  };

  return (
    <div className="mt-4">
      <input
        type="file"
        accept=".json"
        className="file-input file-input-bordered file-input-primary w-full max-w-xs"
        onChange={handleFileChange}
      />
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default FileUpload;
