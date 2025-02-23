import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment';
import { host } from "../stuff";
function gamemode(gm) {
  if (gm === 1) return "1v1";
  if (gm === 2) return "2v2";
  return "Other"
};
async function fetchData(url, token) {
  const response = await fetch(url,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data;
}
const swapIds = [
  [169, 1496], // Lord Vraxx > Princess Bubblegum
  [179, 1495], // Kor > Jake
  [167, 1494], // Jhala > Finn
];
function legendFetch(lsd) {
  return lsd.videogame.characters.map((m) => {
    let legend = {
      id: m.id,
      name: m.name,
      image: `https://saorax.github.io/images/legends/${encodeURI(m.name.toLocaleLowerCase())}/icons/0-menu.png`,
      games: 0,
      wins: 0,
    };

    const swap = swapIds.find(r => r[1] === legend.id);
    if (swap) {
      const original = lsd.videogame.characters.find(r => r.id === swap[0]);
      if (original) {
        legend.name = original.name;
        legend.image = original.image;
      }
    }
    return legend;
  });
}
async function legendFunc(data, entrantId, lsd) {
  let tempLegend = legendFetch(lsd);
  data = data.userEntrant.paginatedSets.nodes;
  for (var i = 0; i < data.length; i++) {
    let l = data[i];
    if (l.games != null) {
      for (var z = 0; z < l.games.length; z++) {
        if (l.games[z].selections != null) {
          let sl = l.games[z].selections.filter(f => f.entrant.id == entrantId)[0];
          if (sl !== undefined) {
            tempLegend.filter((id) => id.id === (swapIds.filter((r) => r[1] === sl.selectionValue).length === 0 ? sl.selectionValue : swapIds.filter((r) => r[1] === sl.selectionValue)[0][0]))[0].games++;
            if (l.games[z].winnerId == entrantId) tempLegend.filter((id) => id.id === (swapIds.filter((r) => r[1] === sl.selectionValue).length === 0 ? sl.selectionValue : swapIds.filter((r) => r[1] === sl.selectionValue)[0][0]))[0].wins++;
          }
        }
      }
    }
  };
  tempLegend = tempLegend.filter(l => l.games !== 0);
  tempLegend = tempLegend.sort(function (a, b) {
    return b.games - a.games;
  });
  return tempLegend
};
async function stageFunc(data, entrantId) {
  let stages = [];
  data = data.userEntrant.paginatedSets.nodes;
  for (var i = 0; i < data.length; i++) {
    let l = data[i];
    if (l.games != null) {
      for (var z = 0; z < l.games.length; z++) {
        if (l.games[z].stage != null) {
          if (stages.filter(s => s.id === l.games[z].stage.id)[0] === undefined) stages.push({
            id: l.games[z].stage.id,
            name: l.games[z].stage.name.replace("Small ", ""),
            url: `https://saorax.github.io/images/brawlhalla/mapBg/${l.games[z].stage.name.replaceAll(" ", "-").toLocaleLowerCase()}.jpg`,
            games: 0,
            wins: 0
          });
          stages.filter(s => s.id === l.games[z].stage.id)[0].games++;
          if (l.games[z].winnerId == entrantId) stages.filter(s => s.id === l.games[z].stage.id)[0].wins++;
        }
      }
    }
  };
  for (var i = 0; i < stages.length; i++) {
    if (stages.filter(n => n.name == stages[i].name && n.id != stages[i].id)[0] !== undefined) {
      stages[i].games += stages.filter(n => n.name == stages[i].name && n.id != stages[i].id)[0].games;
      stages[i].wins += stages.filter(n => n.name == stages[i].name && n.id != stages[i].id)[0].wins;
      stages.filter(n => n.name == stages[i].name && n.id != stages[i].id)[0].wins = 0;
      stages.filter(n => n.name == stages[i].name && n.id != stages[i].id)[0].games = 0;
    }
  };
  stages = stages.filter(p => p.games !== 0);
  stages = stages.sort(function (a, b) {
    return b.games - a.games;
  });
  return stages;
};

export function determineGamemode(string) {
  let check1 = false,
    check2 = false;
  if (string.toLocaleLowerCase().includes("1v1") || string.toLocaleLowerCase().includes("1vs1") || string.toLocaleLowerCase().includes("singles")) check1 = true;
  if (string.toLocaleLowerCase().includes("2v2") || string.toLocaleLowerCase().includes("2vs2") || string.toLocaleLowerCase().includes("doubles") || string.toLocaleLowerCase().includes("duos")) check2 = true;
  if (check1 === true && check2 === true) return 4;
  if (check1 === false && check2 === false) return 3;
  if (check1 === false && check2 === true) return 2;
  if (check1 === true && check2 === false) return 1;
}
function ordinal(i) {
  var j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }
  if (j == 2 && k != 12) {
    return i + "nd";
  }
  if (j == 3 && k != 13) {
    return i + "rd";
  }
  return i + "th";
};
function WinrateBar({ wins, games, type, type2 }) {
  const winrate = games ? ((wins / games) * 100).toFixed(2) : 0;
  return (
    <div className='lg:px-2 px-1 pb-2'>
      {type2 == 2 && <span className="text-2xl font-medium">{games} {type} {type !== null ? "Played" : 'Games'}</span>}
      <div className='justify-between flex pb-2'>
        <span className={`${type2 != 1 ? 'text-xl' : 'text-lg'} text-blue-400`}>{wins}W</span>
        {type2 != 2 && <span className={`${type2 != 1 ? 'text-xl' : 'text-lg'} font-medium`}>{games}{type !== null ? ` ${type} Played` : " Games"}</span>}
        <span className={`${type2 != 1 ? 'text-xl' : 'text-lg'} text-red-400`}>{games - wins}L</span>
      </div>
      <div className="relative h-6 bg-red-500 rounded-md flex items-center justify-center">
        <div
          className="absolute left-0 h-full bg-blue-500 rounded-md"
          style={{ width: `${winrate}%` }}
        ></div>
        <span className="absolute text-lg text-white font-bold">{winrate}%</span>
      </div>
    </div>
  );
}
async function Event(event, user, lsd, setEventData, acs) {
  const eventData = await fetchData(`${host}/player/event/${event}/${user}`, acs);
  console.log(eventData)
  const stages = await stageFunc(eventData, eventData.userEntrant.id);
  const legends = await legendFunc(eventData, eventData.userEntrant.id, lsd);
  setEventData({
    ...eventData,
    stages: stages,
    legends: legends
  });
}
function MatchDataFunc(match, user, opp, legend, setmd, md) {
  legend = legendFetch(legend);
  const omd = [];
  if (match.games !== null) {
    for (var i = 0; i < match.games.length; i++) {
      omd.push(
        <div className='flex justify-between w-full'>
          {/* user */}
          <div className='flex space-x-2'>
            {user.entrant.participants.length == 1 && (
              match.games[i].selections !== null && match.games[i].selections.filter(d => d.entrant.id == user.entrant.id)[0] !== undefined && match.games[i].selections.filter(d => d.entrant.id == user.entrant.id)[0] !== null
                ? <img src={legend.filter(p => p.id == match.games[i].selections.filter(d => d.entrant.id == user.entrant.id)[0].selectionValue)[0].image} className="object-cover h-10 w-10" />
                : <img src="https://saorax.github.io/images/legends/random.png" className="object-cover h-10 w-10" />)}
            <span className={`text-2xl font-medium font-mono ${match.games[i].winnerId == user.entrant.id ? "text-green-500" : "text-red-500"}`}>{match.games[i].winnerId == user.entrant.id ? "W" : "L"}</span>
          </div>
          {/* mid */}
          <div className='flex flex-col'>
            <span className="text-lg font-medium">Game {i + 1}</span>
            {match.games[i].stage != null && <span className="text-base font-thin text-slate-300">{match.games[i].stage.name.replace("Small ", "")}</span>}
          </div>
          {/* opp */}
          <div className='flex space-x-2'>
            <span className={`text-2xl font-medium font-mono ${match.games[i].winnerId != user.entrant.id ? "text-green-500" : "text-red-500"}`}>{match.games[i].winnerId != user.entrant.id ? "W" : "L"}</span>
            {user.entrant.participants.length == 1 && (
              match.games[i].selections !== null && match.games[i].selections.filter(d => d.entrant.id != user.entrant.id)[0] !== undefined && match.games[i].selections.filter(d => d.entrant.id != user.entrant.id)[0] !== null
                ? <img src={legend.filter(p => p.id == match.games[i].selections.filter(d => d.entrant.id != user.entrant.id)[0].selectionValue)[0].image} className="object-cover h-10 w-10" />
                : <img src="https://saorax.github.io/images/legends/random.png" className="object-cover h-10 w-10" />)}
          </div>
        </div>);
    }
  }
  setmd(
    <div className="w-full">
      <div className="text-2xl flex flex-col text-center items-center">
        {opp.entrant.participants.map((part, index) => {
          if (part.player.user == null || part.player.user.images.length == 0) {
            return <div className='flex space-x-2'>
              <a className={`flex w-10 h-10 rounded-2xl  bg-slate-700 justify-center items-center text-center`}>
                <div className="text-2xl text-slate-100 place-self-center">
                  {part.player.gamerTag[0].toLocaleUpperCase()}
                </div>
              </a>
              <div>
                {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                <a className="text-2xl" target="_blank" rel="noopener noreferrer" href={`/esports/player/${part.player.user.slug.split('/')[1]}`}>{part.gamerTag}</a>
              </div>
            </div>
          } else {
            return <div className='flex space-x-2'>
              <img className={`w-10 h-10 rounded-xl`} src={part.player.user.images[0].url} />
              <div>
                {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                <a className="text-2xl" target="_blank" rel="noopener noreferrer" href={`/esports/player/${part.player.user.slug.split('/')[1]}`}>{part.gamerTag}</a>
              </div>
            </div>
          }
        })}
      </div>
      <p className='pb-2'>Set Length: {moment.utc(moment(new Date(match.completedAt * 1000), "DD/MM/YYYY HH:mm:ss").diff(moment(new Date(match.startedAt * 1000), "DD/MM/YYYY HH:mm:ss"))).format("mm:ss")}</p>
      {match.games == null || match.games[0].winnerId == null ? <span className="text-xl">no game data reported</span> :
        <div className='flex flex-col space-y-2'>
          {omd}
        </div>}
    </div>);
}
function EventData(data) {
  const userEntrant = data.data.userEntrant;
  const newData = [];
  const gc = [userEntrant.paginatedSets.nodes.map(a => {
    if (a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value >= 0 && a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value >= 0)
      return a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value + a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value;
    return 0
  }).reduce((a, b) => a + b, 0), userEntrant.paginatedSets.nodes.map(a => { return 1 }).reduce((a, b) => a + b, 0)]
  for (var i = userEntrant.paginatedSets.nodes.length; i--;) {
    if (newData.filter(p => p.type.name === userEntrant.paginatedSets.nodes[i].phaseGroup.phase.name)[0] === undefined) {
      newData.push({
        type: {
          name: userEntrant.paginatedSets.nodes[i].phaseGroup.phase.name,
          ident: userEntrant.paginatedSets.nodes[i].phaseGroup.displayIdentifier
        },
        array: [userEntrant.paginatedSets.nodes[i]]
      })
    } else {
      newData.filter(p => p.type.name === userEntrant.paginatedSets.nodes[i].phaseGroup.phase.name)[0].array.push(userEntrant.paginatedSets.nodes[i])
    }
    newData.filter(p => p.type.name === userEntrant.paginatedSets.nodes[i].phaseGroup.phase.name)[0].array.sort(function (a, b) {
      return (a.startedAt === null ? a.completedAt : a.startedAt) - (b.startedAt === null ? b.completedAt : b.startedAt);
    });
  };
  if (data.id !== data.data.id) {
    data.sid(data.data.id);
    MatchDataFunc(newData[0].array[0], newData[0].array[0].slots.filter(d => d.entrant.id == userEntrant.id)[0], newData[0].array[0].slots.filter(d => d.entrant.id != userEntrant.id)[0], data.lsd, data.setmd)
  }
  return (<div className="lg:max-h-[113.5vh] lg:w-[70%] p-2 lg:flex lg:flex-col scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
    <div className=" text-slate-100 w-full">
      {/* tournament info */}
      <div className="flex w-full">
        <div className="flex flex-col w-full">
          {/* tournament title thing */}
          <div className="bg-slate-800 p-2 rounded-t-2xl flex">
            <div className="mr-1.5">
              {data.data.tournament.images.filter(r => r.type === 'profile')[0] !== undefined
                ? <img className="w-20 h-20 rounded-2xl" src={data.data.tournament.images.filter(r => r.type === 'profile')[0].url} />
                : <a className="flex w-20 h-20 rounded-2xl bg-slate-700 justify-center items-center text-center">
                  <div className="text-4xl text-slate-100 place-self-center">
                    {userEntrant.sets.nodes[0].event.tournament.name[0].toLocaleUpperCase()}
                  </div>
                </a>}
            </div>
            <div className="flex flex-col w-[75%]">
              <a className="text-2xl" target="_blank" rel="noopener noreferrer" href={`https://start.gg/${data.data.slug}`}>{data.data.tournament.name}</a>
              <span className="text-lg text-slate-300">{data.data.name}</span>
            </div>
          </div>
          {/* entrant info */}
          <div className="mb-1.5 flex text-lg text-center items-center w-full">
            <div className="p-2 pr-4 lg:flex items-center bg-slate-900 rounded-b-2xl w-full">
              <div className="lg:flex items-center justify-between w-full">
                <div className='flex mb-2 lg:mb-0'>
                  <div className="flex items-center text-xl">
                    <div className="flex mr-1.5 -space-x-4">
                      {userEntrant.participants.map((part, index) => {
                        if (part.player.user == null || part.player.user.images.length == 0) {
                          return <div key={part.player?.user?.id} >
                            <a className={`flex w-14 h-14 rounded-2xl mt-${index * 2} bg-slate-700 justify-center items-center text-center`}>
                            <div className="text-2xl text-slate-100 place-self-center">
                              {part.gamerTag[0].toLocaleUpperCase()}
                            </div>
                          </a>
                          </div>
                        } else {
                          return <div key={part.player?.user?.id} ><img className={`w-14 h-14 rounded-2xl mt-${index * 2}`} src={part.player.user.images[0].url} /></div>
                        }
                      })}
                    </div>
                  </div>
                  <div className='text-start'>
                    <div className="flex text-start flex-col mb-0.5">
                      <div className='lg:flex hidden text-2xl'>
                        <>
                          {userEntrant.participants.map((part, index) => (
                            <React.Fragment key={index}>
                              {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                              <span>{part.gamerTag}</span>
                              {index < userEntrant.participants.length - 1 && <span> &nbsp;&&nbsp; </span>}
                            </React.Fragment>
                          ))}
                        </>
                      </div>
                      <div className='lg:hidden text-xl'>
                        <>
                          <div className='lg:flex lg:space-x-2'>
                            {userEntrant.participants.map((part, index) => (
                              <React.Fragment key={index}>
                                <div>{part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                                  <span>{part.gamerTag}</span></div>
                              </React.Fragment>
                            ))}
                          </div>
                        </>
                      </div>
                    </div>
                    <div className="text-lg  w-full lg:text-xl font-thin text-slate-800 dark:text-slate-200">
                      <div className='flex w-full space-x-4'>
                        <p><span className="font-bold">{ordinal(userEntrant.standing.placement)}</span> out of {data.data.numEntrants}</p>
                        <p className="ml-5 font-bold">Seed {ordinal(userEntrant.initialSeedNum)}</p>
                      </div>
                      <p className='font-bold flex'>${data.data.prizingInfo.enablePrizing == true && data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0] !== undefined ? <div className='flex'>{data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0].amount / userEntrant.participants.length}{userEntrant.participants.length >= 2 && <p> &nbsp;(${data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0].amount} before split)</p>}</div> : 0}</p>
                    </div>
                  </div>
                  <div>
                  </div>
                </div>
                <div className="lg:mr-2 lg:ml-4 justify-evenly lg:justify-start lg:space-x-8 flex">
                  <div className="flex flex-col text-center">

                    <WinrateBar wins={userEntrant.paginatedSets.nodes.map(a => {
                      if (a.winnerId == userEntrant.id) return 1;
                      return 0
                    }).reduce((a, b) => a + b, 0)} games={userEntrant.paginatedSets.nodes.length} type={gc[1] == 1 ? 'Set' : 'Sets'} type2={2} />
                  </div>
                  <div className="flex flex-col text-center">
                    <WinrateBar
                      wins={userEntrant.paginatedSets.nodes.map(a => {
                        if (a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value >= 0)
                          return a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value;
                        return 0
                      }).reduce((a, b) => a + b, 0)}
                      games={userEntrant.paginatedSets.nodes.map(a => {
                        if (a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value >= 0 && a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value >= 0)
                          return a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value + a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value;
                        return 0
                      }).reduce((a, b) => a + b, 0)}
                      type={gc[0] == 1 ? 'Game' : 'Games'}
                      type2={2} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* legend / stage info */}
          <div className="lg:flex cursor-default lg:space-x-2 space-y-2 lg:space-y-0 text-center lg:h-64  bg-slate-900 p-2 rounded-2xl w-full">
            <div className="rounded-2xl lg:w-[50%] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full bg-slate-950">
              <span className="text-2xl font-medium">Legends Played</span>
              <div className={`p-1 scrollbar-thin w-full items-center text-center scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${data.data.legends.length >= 1 ? 'grid grid-cols-2 lg:grid-cols-3' : ''} justify-evenly`}>
                {data.data.legends.length == 0 ? <a className="text-xl">no legends reported</a> : data.data.legends.map(leg => {
                  return <div key={leg.name} className="flex flex-col m-0.5 text-center justify-center items-center rounded-2xl shadow border-slate-700 bg-slate-900 hover:bg-slate-800 transition duration-200">
                    <img className="flex w-16 h-16 justify-center items-center text-center rounded-2xl" src={leg.image} alt={leg.name} />
                    <div className="flex w-full flex-col justify-between p-1.5 leading-normal">
                      <p className="mb-0.5 text-2xl font-bold text-gray-900 dark:text-white">{leg.name}</p>
                      <WinrateBar
                        wins={leg.wins}
                        games={leg.games}
                        type={null}
                        type2={3} />
                    </div>
                  </div>
                })}
              </div>
            </div>
            <div className="lg:w-[50%] scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full rounded-2xl bg-slate-950">
              <span className="text-2xl font-medium">Stages Played</span>
              <div className={`p-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${data.data.stages.length >= 1 ? 'grid grid-cols-2 lg:grid-cols-3' : ''} justify-evenly`}>
                {data.data.stages.length == 0 ? <a className="text-xl">no stages reported</a> : data.data.stages.map(stage => {
                  return <div key={stage.name} className="m-0.5 relative text-center items-center flex flex-col group">
                    <img
                      src={stage.url}
                      className="rounded-2xl h-24 w-full brightness-50 group-hover:brightness-75 transition duration-200"
                      alt={stage.name}
                    />
                    <div className="flex flex-col text-center items-center h-full justify-between p-1.5 leading-normal absolute">
                      <p className="mb-0.5 text-lg font-medium text-gray-900 dark:text-white">
                        {stage.name}
                      </p>
                      <div className="text-sm flex space-x-2">
                        <p>
                          <span className="font-semibold text-xl">{stage.games}</span> {stage.games == 1 ? 'Game' : 'Games'}
                        </p>
                        <p>
                          <span className="font-semibold text-xl">{stage.wins}</span> {stage.wins == 1 ? 'Win' : 'Wins'}
                        </p>
                      </div>
                    </div>
                  </div>

                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="lg:flex mt-1.5 ">
      <div className="lg:w-2/3">
        {/* history */}
        <div className="max-h-[60.5vh] divide-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 w-full p-1 divide-slate-700 rounded-2xl bg-slate-900 text-slate-100">
          {newData.map(matchData => {
            return <div key={matchData.type.ident} className={`${newData.length > 1 ? i == 0 ? "mb-2 " : "mt-2 " : ""}text-xl lg:text-3xl text-center`}>
              <a>{matchData.type.name == "Bracket" ? `${matchData.type.name} ${matchData.type.ident}` : matchData.type.name}</a>
              <div className="pt-3 text-start">
                {matchData.array.map((mArray, mai) => {
                  let user = mArray.slots.filter(d => d.entrant.id == userEntrant.id)[0];
                  let opponent = mArray.slots.filter(d => d.entrant.id != userEntrant.id)[0];
                  return <div
                    key={mai} onClick={() => MatchDataFunc(mArray, user, opponent, data.lsd, data.setmd)}
                    className={`rounded-2xl hover:bg-slate-800 transition duration-200 cursor-pointer flex ${matchData.array.length != mai - 1 ? "mb-2" : ""}`}
                  >
                    <div className="w-24 flex flex-col text-center items-center">
                      <a className={`text-xl ${user.standing.stats.score.value == -1 || user.standing.stats.score.value < opponent.standing.stats.score.value ? "text-red-500" : "text-green-500"}`}>
                        {user.standing.stats.score.value == -1 || opponent.standing.stats.score.value == -1
                          ? `DQ`
                          : `${user.standing.stats.score.value} - ${opponent.standing.stats.score.value}`
                        }
                      </a>
                      <a className='text-sm font-bold'>{moment.utc(moment(new Date(mArray.completedAt * 1000), "DD/MM/YYYY HH:mm:ss").diff(moment(new Date(mArray.startedAt * 1000), "DD/MM/YYYY HH:mm:ss"))).format("mm:ss")}</a>
                      <a className="text-sm font-thin text-slate-800 dark:text-slate-200">Seed: {opponent.entrant.initialSeedNum}</a>
                      <a className="text-sm font-thin text-slate-800 dark:text-slate-200">Placed: {ordinal(opponent.entrant.standing.placement)}</a>
                    </div>
                    <div className="flex items-center text-xl">
                      <div className="flex mr-1.5 -space-x-4">
                        {opponent.entrant.participants.map((part, index) => {
                          if (part.player.user == null || part.player.user.images.length == 0) {
                            return <div  key={part.player?.user?.id} ><a className={`flex w-12 h-12 rounded-2xl mt-${index * 2} bg-slate-700 justify-center items-center text-center`}>
                              <div className="text-2xl text-slate-100 place-self-center">
                                {part.player.gamerTag[0].toLocaleUpperCase()}
                              </div>
                            </a></div>
                          } else {
                            return <div  key={part.player?.user?.id} ><img className={`w-12 h-12 rounded-2xl mt-${index * 2}`} src={part.player.user.images[0].url} /></div>
                          }
                        })}
                      </div>
                      <div className="flex text-start flex-col">
                        <div className='lg:flex lg:flex-col hidden'>
                          <>
                          {opponent.entrant.participants.map((part, index) => (
                                <React.Fragment key={index}>
                                  <div>{part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                                    <span>{part.gamerTag}</span></div>
                                </React.Fragment>
                              ))}
                          </>
                        </div>
                        <div className='lg:hidden'>
                          <>
                            <div className='lg:flex lg:space-x-2'>
                              {opponent.entrant.participants.map((part, index) => (
                                <React.Fragment key={index}>
                                  <div>{part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                                    <span>{part.gamerTag}</span></div>
                                </React.Fragment>
                              ))}
                            </div>
                          </>
                        </div>
                        <div className="space-x-3 justify-between flex text-base text-slate-300">
                          <span>{mArray.fullRoundText}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                })}
              </div>
            </div>
          })}
        </div>
      </div>
      <div className="lg:w-1/3 p-2 lg:ml-2 mt-1.5 lg:mt-0 bg-gray-900 rounded-lg">
        {/* match */}
        <div className="bg-slate-950 p-2.5 rounded-l-lg">
          <div className="w-full text-center items-center" id={history.id}>
            {data.md && data.md}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
function Events(data) {
  const eventData = data.data
  let sets = eventData.userEntrant.paginatedSets !== undefined
    ? eventData.userEntrant.paginatedSets.nodes.sort(function (a, b) { return b.completedAt - a.completedAt })
    : [];
  return (
    <div onClick={async () => await Event(eventData.id, data.userId, data.lsd, data.eventData, data.accessToken)} className="cursor-pointer py-1 w-full flex md:items-center shadow hover:bg-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-700">
      {
        eventData.tournament.images.filter(p => p.type === "profile")[0] !== undefined
          ? <img className="ml-1 w-16 h-16 rounded-2xl" src={eventData.tournament.images.filter(p => p.type === "profile")[0].url} />
          : <a className="ml-1 flex w-16 h-16 rounded-2xl bg-slate-700 justify-center items-center text-center">
            <div className="text-4xl text-slate-100 place-self-center">
              {eventData.tournament.name[0].toLocaleUpperCase()}
            </div>
          </a>
      }
      <div className="ml-1.5 w-full justify-between flex">
        <div className='w-full'>
          <div>
            <p className="text-base font-medium text-slate-100">{eventData.tournament.name}</p>
          </div>
          <div className='text-sm lg:text-base flex justify-between'>
            <p className="font-normal text-slate-300">{eventData.name}</p>
            <div className="font-thin text-slate-800 dark:text-slate-200 px-2">
              {
                eventData.userEntrant.standing !== null
                  ? <p><span className="font-bold">{ordinal(eventData.userEntrant.standing.placement)}</span> out of {eventData.numEntrants}</p>
                  : <p>no placement</p>
              }
            </div>
          </div>
          <div className="text-slate-400">
            <div className='flex justify-between lg:text-sm text-xs'>
              <p>{moment(new Date(eventData.startAt * 1000)).format('lll')}</p>
              {sets !== null && sets.length !== 0 ?
                <div className="px-2">
                  in tourney for {moment.utc(moment(new Date(sets[0].completedAt * 1000), "DD/MM/YYYY HH:mm:ss").diff(moment(new Date(sets[sets.length - 1].startedAt * 1000), "DD/MM/YYYY HH:mm:ss"))).format("H:mm:ss")}
                </div> : ""}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const Tabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="border-b max-w-full border-gray-200 dark:border-gray-700">
      <ul className="flex items-center text-slate-300 -mb-px text-sm lg:text-lg font-medium text-center" role="tablist">
        {tabs.map((tab, index) => (
          <li key={index} className="flex-1" role="presentation">
            <button
              className={`inline-block w-full p-4 border-b rounded-t-lg ${activeTab === index ? 'border-gray-300 text-gray-900 dark:text-white' : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 transition duration-200'}`}
              onClick={() => onTabChange(index)}
              role="tab"
              aria-controls={tab.id}
              aria-selected={activeTab === index}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Filter = ({ label, id, options, value, onChange }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block mb-1 text-base font-medium text-gray-900 dark:text-white">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-slate-500 focus:border-slate-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white dark:focus:ring-slate-500 dark:focus:border-slate-500"
      >
        {options.map((option, idx) => (
          <option key={idx} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};



function MainLayout({ data, lsd, accessToken }) {
  const [legendData, setLegendData] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [curId, setCurId] = useState(0);
  const [filters, setFilters] = useState({
    gamemode: "0",
    year: "0",
    sorting: "0",
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 50;

  const handleFilterChange = (filterKey, value) => {
    setFilters({ ...filters, [filterKey]: value });
    setCurrentPage(1);
  };

  useEffect(() => {
    if (data.events.nodes.length > 0) {
      const firstEventId = data.events.nodes[0].id;
      setCurId(firstEventId);
      async function aa() {
        await Event(firstEventId, data.id, lsd, setEventData, accessToken);
      } aa();
    }
  }, [data]); 

  const filterAndSortEvents = () => {
    const events = data.isFull ? data.events.nodes : data.events.nodes;

    return events
      .filter(event => {
        const searchTerm = filters.search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const eventName = event.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const tourneyName = event.tournament.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return (eventName.includes(searchTerm) || tourneyName.includes(searchTerm))
      })
      .filter(event => {
        if (filters.year === "0") return true;
        const eventYear = new Date(event.startAt * 1000).getFullYear();
        return eventYear.toString() === filters.year;
      })
      .filter(event => {
        if (filters.gamemode === "0") return true;
        const participantCount = event.userEntrant.participants.length;
        if (filters.gamemode === "1" && participantCount === 1) return true;
        if (filters.gamemode === "2" && participantCount === 2) return true;
        if (filters.gamemode === "3" && participantCount >= 3) return true;
        return false;
      })
      .sort((a, b) => {
        if (filters.sorting === "0") return b.startAt - a.startAt;
        if (filters.sorting === "1") return a.startAt - b.startAt;
        if (filters.sorting === "2") return a.userEntrant.standing.placement - b.userEntrant.standing.placement;
        if (filters.sorting === "3") return b.userEntrant.standing.placement - a.userEntrant.standing.placement;
        return 0;
      });
  };

  const paginatedEvents = () => {
    const filteredEvents = filterAndSortEvents();
    const startIndex = (currentPage - 1) * eventsPerPage;
    return filteredEvents.slice(startIndex, startIndex + eventsPerPage);
  };

  const totalPages = Math.ceil(filterAndSortEvents().length / eventsPerPage);

  return (
    <div className="rounded-lg" role="tabpanel" aria-labelledby="main-tab">
      <div className="lg:flex">
        <div className="lg:w-1/3">
          <div className="py-1 text-center">
            <a id="tourneyCount" className="text-xl lg:text-2xl font-medium text-slate-800 dark:text-slate-200">
              {filterAndSortEvents().length} events
            </a>
          </div>
          <input
            type="text"
            placeholder="Search by event name"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full text-white bg-slate-900 p-2 mb-4 border border-slate-600 rounded"
          />
          <div className="space-x-4 flex">
            <Filter
              label="Gamemode"
              id="gamemode"
              value={filters.gamemode}
              onChange={(value) => handleFilterChange("gamemode", value)}
              options={[
                { value: "0", label: "Default (All Gamemodes)" },
                { value: "1", label: "1v1" },
                { value: "2", label: "2v2" },
                { value: "3", label: "Other" },
              ]}
            />
            <Filter
              label="Year"
              id="year"
              value={filters.year}
              onChange={(value) => handleFilterChange("year", value)}
              options={[
                { value: "0", label: "Default (All Years)" },
                { value: "2025", label: "2025" },
                { value: "2024", label: "2024" },
                { value: "2023", label: "2023" },
                { value: "2022", label: "2022" },
                { value: "2021", label: "2021" },
                { value: "2020", label: "2020" },
                { value: "2019", label: "2019" },
                { value: "2018", label: "2018" },
                { value: "2017", label: "2017" },
                { value: "2016", label: "2016" },
              ]}
            />
            <Filter
              label="Sorting"
              id="sorting"
              value={filters.sorting}
              onChange={(value) => handleFilterChange("sorting", value)}
              options={[
                { value: "0", label: "Default (Date Desc.)" },
                { value: "1", label: "Date Asc." },
                { value: "2", label: "Placement Asc." },
                { value: "3", label: "Placement Desc." },
              ]}
            />
          </div>
          <div className="flex justify-center my-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-4 py-2 mx-1 bg-slate-700 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-4 py-2 mx-1 bg-slate-700 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="flex w-full flex-col overflow-y-auto h-[60vh] lg:h-screen scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {paginatedEvents().map((item) => (
              <Events
                key={item.id}
                data={item}
                userId={data.id}
                playerId={data.player.id}
                lsd={lsd}
                eventData={setEventData}
                accessToken={accessToken}
              />
            ))}
          </div>
        </div>
        {eventData && (
          <EventData
            data={eventData}
            lsd={lsd}
            md={matchData}
            setmd={setMatchData}
            id={curId}
            sid={setCurId}
          />
        )}
      </div>
    </div>
  );
}
function MakeOppPage(data, opp, setOpp) {
  console.log(data)
  if (opp.id !== data.id) return setOpp(data)
}
function OppList({ data, opp, setOpp }) {
  return (<div
    key={data.id || index}
    className="border-2 my-2 bg-slate-900 rounded-xl border-slate-600 hover:border-slate-400 transition duration-200 cursor-pointer" onClick={() => MakeOppPage(data, opp, setOpp)}
  >
    <div className="lg:flex rounded-xl relative text-white bg-slate-900 lg:text-left lg:items-start text-center items-center flex lg:flex-row flex-col group">
      {data.images.filter((img) => img.type === "banner").length === 0 ? (
        <div src="" className="rounded-xl opacity-25 w-full lg:h-24 h-16 bg-gray-700"></div>
      ) : (
        <img
          src={data.images.filter((img) => img.type === "banner")[0].url}
          className="rounded-2xl opacity-35 w-full lg:h-24 h-16"
        />
      )}
      <div className="flex text-left items-center h-full lg:justify-normal justify-between p-1.5 leading-normal absolute">
        <div>
          <div className="relative w-16 h-16">
            {data.images.filter((img) => img.type === "profile").length === 0 ? (
              <a className="flex w-16 h-16 rounded-2xl bg-slate-700 justify-center items-center text-center">
                <div className="text-4xl text-slate-100 place-self-center">
                  {data.name[0].toLocaleUpperCase()}
                </div>
              </a>
            ) : (
              <img
                src={data.images.filter((img) => img.type === "profile")[0].url}
                className="w-full h-full rounded-lg uns"
                style={{ display: "unset !important" }}
                alt={data.name}
              />
            )}
          </div>
        </div>
        <div className="pl-2 place-content-end">
          {data.prefix && (
            <p className="lg:text-xl text-lg text-gray-600 dark:text-gray-400">
              {data.prefix}
            </p>
          )}
          {data.name && (
            <p className="lg:text-3xl text-2xl dark:text-white">
              {data.name}
            </p>
          )}
        </div>
      </div>
    </div>
    <div className="w-full ">
      <div className="text-center items-center">
        <WinrateBar wins={data.score.sets.wins} games={data.score.sets.num} type="Sets" type2={1} />
      </div>
      <div className="text-center items-center">
        <WinrateBar wins={data.score.games.wins} games={data.score.games.num} type="Games" type2={1} />
      </div>
    </div>
  </div>)
}
function OpponentLayout({ data, lsd, accessToken }) {
  const [activeTab, setActiveTab] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [opp, setOpp] = useState({});
  const [selectedLegend, setSelectedLegend] = useState(null);
  const [sortOption, setSortOption] = useState("gamesPlayed"); 
  const [sortOrder, setSortOrder] = useState("desc");

  const handleLegendClick = (legend) => {
    setSelectedLegend(legend);
  };

  const opponentData = data.opponentData;
  const itemsPerPage = 25;
  const sortedData = [...opponentData].sort((a, b) => {
    let comparison = 0;
    if (sortOption === "gamesPlayed") comparison = b.score.games.num - a.score.games.num;
    if (sortOption === "setsPlayed") comparison = b.score.sets.num - a.score.sets.num;
    if (sortOption === "gameWinrate") comparison = (b.score.games.wins / b.score.games.num) - (a.score.games.wins / a.score.games.num);
    if (sortOption === "setWinrate") comparison = (b.score.sets.wins / b.score.sets.num) - (a.score.sets.wins / a.score.sets.num);
    return sortOrder === "asc" ? -comparison : comparison;
  });
  const filteredData = sortedData.filter((data) =>
    data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (data.prefix && data.prefix.toLowerCase().includes(searchTerm.toLowerCase()))
  );
 
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (direction) => {
    setCurrentPage((prev) => {
      if (direction === "next" && prev < totalPages) return prev + 1;
      if (direction === "prev" && prev > 1) return prev - 1;
      return prev;
    });
  };
  console.log(opp);
  const tabs = [
    { id: `events-${opp.id}`, label: "Events" },
    { id: `legends-${opp.id}`, label: "Legend Data" },
    { id: `stages-${opp.id}`, label: "Stage Data" },
  ];
  return (
    <div className='lg:flex'>
      <div className='lg:w-1/3'>
        <div className="my-4">
          <input
            type="text"
            placeholder="Search opponents"
            value={searchTerm}
            onChange={handleSearch}
            className="w-full text-white bg-slate-900 p-2 border border-slate-600 rounded"
          />
        </div>
        <div className="flex space-x-4 my-4">
          <Filter
            label="Sort by"
            id="sortOption"
            value={sortOption}
            onChange={(value) => setSortOption(value)}
            options={[
              { value: "gamesPlayed", label: "Games Played" },
              { value: "gameWinrate", label: "Game Winrate %" },
              { value: "setsPlayed", label: "Sets Played" },
              { value: "setWinrate", label: "Set Winrate %" }
            ]}
          />
          <Filter
            label="Order"
            id="sortOrder"
            value={sortOrder}
            onChange={(value) => setSortOrder(value)}
            options={[
              { value: "desc", label: "Descending" },
              { value: "asc", label: "Ascending" }
            ]}
          />
        </div>
        <div className="flex justify-between my-4">
          <button
            onClick={() => handlePageChange("prev")}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <div className="text-white flex flex-col text-center">
            <span>Page {currentPage} of {totalPages}</span>
            <span>{filteredData.length} players</span>
          </div>
          <button
            onClick={() => handlePageChange("next")}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className='px-1 lg:h-screen h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900'>
          {paginatedData.map((data, index) => (
            <OppList data={data} opp={opp} setOpp={setOpp} key={index} />
          ))}
        </div>
      </div>
      {opp.name && (
        <div className='lg:w-2/3 p-2'>
          <div className='lg:flex lg:h-48 bg-slate-900 rounded-2xl'>
            <div className="lg:flex rounded-2xl lg:w-1/2 relative text-white lg:text-left lg:items-start text-center items-center flex lg:flex-row flex-col group">
              {opp.images.filter(img => img.type === "banner").length === 0
                ? <div src="" className="opacity-25 rounded-2xl w-full lg:h-48 h-32 bg-gray-700"></div>
                : <img src={opp.images.filter(img => img.type === "banner")[0].url} className="rounded-2xl opacity-25 w-full lg:h-48 h-32" />}
              <div className="flex rounded-2xl text-left items-center h-full lg:justify-normal justify-between p-1.5 leading-normal absolute">
                <div>
                  <div className="relative w-24 h-24">
                    {opp.images.filter(img => img.type === "profile").length === 0 ? (
                      <a className="flex w-24 h-24 rounded-2xl bg-slate-700 justify-center items-center text-center">
                        <div className="text-5xl text-slate-100 place-self-center">
                          {opp.name[0].toLocaleUpperCase()}
                        </div>
                      </a>
                    ) : (
                      <img
                        src={opp.images.filter(img => img.type === "profile")[0].url}
                        className="w-full h-full rounded-lg uns"
                        style={{ display: "unset !important" }}
                        alt={opp.name}
                      />
                    )}
                  </div>
                </div>
                <div className="pl-2 place-content-end">
                  {opp.prefix && (<p className="lg:text-2xl text-xl text-gray-600 dark:text-gray-400">{opp.prefix}</p>)}
                  {opp.name && (<a className="lg:text-3xl text-2xl dark:text-white" target="_blank" rel="noopener noreferrer" href={`/esports/player/${opp.slug.split('/')[1]}`}>{opp.name}</a>)}
                </div>
              </div>
            </div>
            <div className='lg:w-1/2 h-full items-center flex justify-between '>
              <div className='w-1/2 text-center items-center'>
                <WinrateBar
                  wins={opp.score.sets.wins}
                  games={opp.score.sets.num}
                  type={'Sets'}
                  type2={2} />
              </div>
              <div className='w-1/2 text-center items-center'>
                <WinrateBar
                  wins={opp.score.games.wins}
                  games={opp.score.games.num}
                  type={'Games'}
                  type2={2} />
              </div>
            </div>
          </div>
          <div>
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className='lg:flex lg:flex-col cursor-default lg:space-x-2 space-y-2 lg:space-y-0 text-center bg-slate-900 p-2 rounded-2xl w-full'>
              {activeTab === 0 && <div>s</div>}
              {activeTab === 1 &&
                (<div className="lg:flex w-full rounded-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full bg-slate-950">
                  <div className="p-1 lg:w-[50%] lg:h-[50%]  h-96 scrollbar-thin items-center text-center scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto grid grid-cols-2 lg:grid-cols-3 justify-evenly">
                    {opp.legends.length === 0 ? (
                      <a className="text-xl">no legends reported</a>
                    ) : (
                      opp.legends.map((leg) => (
                        <div
                          key={leg.id}
                          className="flex flex-col m-0.5 text-center justify-center items-center rounded-2xl shadow border-slate-700 bg-slate-900 hover:bg-slate-800 transition duration-200 cursor-pointer"
                          onClick={() => handleLegendClick(leg)}
                        >
                          <img className="flex w-16 h-16 justify-center items-center text-center rounded-2xl" src={leg.image} alt={leg.name} />
                          <div className="flex w-full flex-col justify-between p-1.5 leading-normal">
                            <p className="mb-0.5 text-2xl font-bold text-gray-900 dark:text-white">{leg.name}</p>
                            <WinrateBar wins={leg.score.wins} games={leg.score.games} type={null} type2={2} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedLegend && (
                    <div className="lg:w-[50%] overflow-y-auto items-center text-center bg-gray-900 p-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full rounded-lg m-1.5 lg:mt-1.5 mt-4">
                      <div className='flex justify-center'>
                        <div>
                          <img className="w-20 h-20" src={selectedLegend.image} alt={selectedLegend.startData.name} />
                          <h2 className="text-center text-xl font-bold">{selectedLegend.startData.name}</h2>
                        </div>
                        <WinrateBar
                          wins={selectedLegend.score.wins}
                          games={selectedLegend.score.games}
                          type={'Games'}
                          type2={2} />
                      </div>
                      {/* opponent legend data */}
                      <div className='bg-slate-900 rounded-lg overflow-y-auto w-full'>
                        <div className='lg:min-w-[50%] overflow-y-auto rounded-lg bg-slate-950'>
                          <h3 className="text-3xl font-bold mt-2">{opp.name}'s Legends</h3>
                          <div className="bg-slate-950 max-h-[400px] rounded-lg p-1 scrollbar-thin w-full items-center text-center scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto grid grid-cols-2 lg:grid-cols-3 justify-evenly">
                            {selectedLegend.oppLegends?.length === 0 ? (
                              <a className="text-xl">no legends reported</a>
                            ) : (
                              selectedLegend.oppLegends?.map((opp) => (
                                <div
                                  key={opp.id}
                                  className="flex flex-col m-0.5 text-center justify-center items-center rounded-2xl shadow border-slate-700 bg-slate-900 hover:bg-slate-800 transition duration-200"
                                >
                                  <img className="flex w-16 h-16 justify-center items-center text-center rounded-2xl" src={opp.image} alt={opp.startData.name} />
                                  <div className="flex w-full flex-col justify-between p-1.5 leading-normal">
                                    <WinrateBar wins={opp.score.wins} games={opp.score.games} type={null} type2={2} />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className='lg:min-w-[50%] mt-1.5 rounded-lg bg-slate-950'>
                          <div className="scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full rounded-2xl ">
                            <span className="text-3xl font-medium">Stages Played</span>
                            <div className={` h-full p-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${selectedLegend.stages.length > 1 ? 'grid grid-cols-2 lg:grid-cols-3' : ''} justify-evenly`}>
                              {selectedLegend.stages.length == 0 ? <a className="text-xl">no stages reported</a> : selectedLegend.stages.map(stage => {
                                return <div className="m-0.5 relative text-center items-center flex flex-col group">
                                  <img
                                    src={`https://saorax.github.io/images/brawlhalla/mapBg/${stage.name.replaceAll(" ", "-").toLocaleLowerCase()}.jpg`}
                                    className="rounded-2xl h-24 w-full brightness-50 group-hover:brightness-75 transition duration-200"
                                    alt={stage.name}
                                  />
                                  <div className="flex flex-col text-center items-center h-full justify-between p-1.5 leading-normal absolute">
                                    <p className="mb-0.5 text-lg font-medium text-gray-900 dark:text-white">
                                      {stage.name}
                                    </p>
                                    <div className="text-sm flex space-x-2">
                                      <p>
                                        <span className="font-semibold text-xl">{stage.games}</span> {stage.games == 1 ? 'Game' : 'Games'}
                                      </p>
                                      <p>
                                        <span className="font-semibold text-xl">{stage.wins}</span> {stage.wins == 1 ? 'Win' : 'Wins'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>)}
              {activeTab === 2 && <div className="w-full scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full rounded-2xl bg-slate-950">
                <span className="text-3xl font-medium">Stages Played</span>
                <div className={`p-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${opp.stages.length >= 1 ? 'grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : ''} justify-evenly`}>
                  {opp.stages.length == 0 ? <a className="text-xl">no stages reported</a> : opp.stages.map(stage => {
                    return <div className="m-0.5 relative text-center items-center flex flex-col group">
                      <img
                        src={stage.image}
                        className="rounded-2xl h-24 w-full brightness-50 group-hover:brightness-75 transition duration-200"
                        alt={stage.name}
                      />
                      <div className="flex flex-col text-center items-center h-full justify-between p-1.5 leading-normal absolute">
                        <p className="mb-0.5 text-lg font-medium text-gray-900 dark:text-white">
                          {stage.name}
                        </p>
                        <div className="text-sm flex space-x-2">
                          <p>
                            <span className="font-semibold text-xl">{stage.games}</span> {stage.games == 1 ? 'Game' : 'Games'}
                          </p>
                          <p>
                            <span className="font-semibold text-xl">{stage.wins}</span> {stage.wins == 1 ? 'Win' : 'Wins'}
                          </p>
                        </div>
                      </div>
                    </div>
                  })}
                </div>
              </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TabLayout({ data, accessToken }) {
  const [activeTab, setActiveTab] = useState(0);
  const [legendStartData, setLegendStart] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function lsd() {
      try {
        const lsdData = await fetchData(host + '/player/legends', accessToken);
        setLegendStart(lsdData);
      } catch (error) {
        console.error("Failed to fetch legend data:", error);
      } finally {
        setLoading(false);
      }
    }
    lsd();
  }, []);

  const tabs = [
    { id: "main", label: "Events" },
    { id: "opponents", label: "Opponent History" },
    { id: "legends", label: "Legend Data" },
    { id: "twos", label: "2v2 Data" },
  ];

  if (loading) return <div className='text-lg text-slate-300'>Loading...</div>;

  return (
    <div>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div id="myTabContent">
        {activeTab === 0 && (
          <MainLayout data={data} lsd={legendStartData} accessToken={accessToken} />
        )}
        {activeTab === 1 && <OpponentLayout data={data} lsd={legendStartData} accessToken={accessToken} />}
        {activeTab === 2 && <div role="tabpanel">Legend Data Content</div>}
        {activeTab === 3 && <div role="tabpanel">2v2 Data Content</div>}
      </div>
    </div>
  );
}


export default TabLayout;
