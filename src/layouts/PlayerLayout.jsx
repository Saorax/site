import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment';
import { host } from "../stuff";
function gamemode(gm) {
  if (gm === 1) return "1v1";
  if (gm === 2) return "2v2";
  return "Other"
};

const swapIds = [
  [169, 1496], // Lord Vraxx > Princess Bubblegum
  [179, 1495], // Kor > Jake
  [167, 1494], // Jhala > Finn
];
function legendFetch(lsd) {
  let legends = lsd.videogame.characters.map((m) => {
    return {
      id: m.id,
      name: m.name,
      image: `https://saorax.github.io/images/legends/${encodeURI(m.name.toLocaleLowerCase())}/icons/0.png`,
      games: 0,
      wins: 0
    };
  });
  for (var i = 0; i < legends.length; i++) {
    if (swapIds.filter(r => r[1] == legends[i].id)[0] !== undefined) {
      legends[i].name = legends.filter(r => r.id == swapIds.filter(r => r[1] == legends[i].id)[0][0])[0].name;
      legends[i].image = legends.filter(r => r.id == swapIds.filter(r => r[1] == legends[i].id)[0][0])[0].image;
    }
  }
  return legends;
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
async function Event(event, user, lsd, setEventData) {
  const eventData = await fetch(`${host}/player/event/${event}/${user}`).then(res => res.json());
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
              <a className={`flex w-8 h-8 rounded-2xl bg-slate-700 justify-center items-center text-center`}>
                <div className="text-2xl text-slate-100 place-self-center">
                  {part.player.gamerTag[0].toLocaleUpperCase()}
                </div>
              </a>
              <div>
                {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                <span>{part.gamerTag}</span>
              </div>
            </div>
          } else {
            return <div className='flex space-x-2'>
              <img className={`w-8 h-8 rounded-xl`} src={part.player.user.images[0].url} />
              <div>
                {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                <span>{part.gamerTag}</span>
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
                          return <a className={`flex w-14 h-14 rounded-2xl mt-${index * 2} bg-slate-700 justify-center items-center text-center`}>
                            <div className="text-2xl text-slate-100 place-self-center">
                              {part.player.gamerTag[0].toLocaleUpperCase()}
                            </div>
                          </a>
                        } else {
                          return <img className={`w-14 h-14 rounded-2xl mt-${index * 2}`} src={part.player.user.images[0].url} />
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
                              {part.player.prefix && <span className="text-slate-400 mr-1.5">{part.player.prefix}</span>}
                              <span>{part.player.gamerTag}</span>
                              {index < userEntrant.participants.length - 1 && <span> &nbsp;&&nbsp; </span>}
                            </React.Fragment>
                          ))}
                        </>
                      </div>
                      <div className='lg:hidden text-xl'>
                        <>
                          <div className='lg:flex lg:space-x-2'>
                            {userEntrant.participants.map((part, index) => (
                              <React.Fragment key={index} className="flex">
                                <div>{part.player.prefix && <span className="text-slate-400 mr-1.5">{part.player.prefix}</span>}
                                  <span>{part.player.gamerTag}</span></div>
                              </React.Fragment>
                            ))}
                          </div>
                        </>
                      </div>
                    </div>
                    <div className="text-lg justify-between w-full flex lg:text-xl font-thin text-slate-800 dark:text-slate-200 space-x-4">
                      <p><span className="font-bold">{ordinal(userEntrant.standing.placement)}</span> out of {data.data.numEntrants}</p>
                      <p className="mr-5 font-bold">Seed {ordinal(userEntrant.initialSeedNum)}</p>
                      <p className='font-bold flex'>${data.data.prizingInfo.enablePrizing == true && data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0] !== undefined ? <div className='flex'>{data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0].amount / userEntrant.participants.length}{userEntrant.participants.length >= 2 && <p> &nbsp;(${data.data.prizingInfo.prizing.filter(p => p.placement == userEntrant.standing.placement)[0].amount} before split)</p>}</div> : 0}</p>
                    </div>
                  </div>
                  <div>
                  </div>
                </div>
                <div className="lg:mr-2 lg:ml-4 justify-evenly lg:justify-start lg:space-x-8 flex">
                  <div className="flex flex-col text-center">
                    <span className="text-xl font-semibold">Set Count</span>
                    <a className="text-lg">{userEntrant.paginatedSets.nodes.map(a => { return 1 }).reduce((a, b) => a + b, 0)} {gc[1] == 1 ? 'Set' : 'Sets'}</a>
                    <div className="flex text-lg justify-evenly">
                      <a className="text-green-500">
                        {userEntrant.paginatedSets.nodes.map(a => {
                          if (a.winnerId == userEntrant.id) return 1;
                          return 0
                        }).reduce((a, b) => a + b, 0)} W
                      </a>
                      <a className="text-red-500">
                        L {userEntrant.paginatedSets.nodes.map(a => {
                          if (a.winnerId != userEntrant.id) return 1;
                          return 0
                        }).reduce((a, b) => a + b, 0)}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-xl font-semibold">Game Count</span>
                    <a className="text-lg">{userEntrant.paginatedSets.nodes.map(a => {
                      if (a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value >= 0 && a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value >= 0)
                        return a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value + a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value;
                      return 0
                    }).reduce((a, b) => a + b, 0)} {gc[0] == 1 ? 'Game' : 'Games'}</a>
                    <div className="flex text-lg justify-evenly">
                      <a className="text-green-500">
                        {userEntrant.paginatedSets.nodes.map(a => {
                          if (a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value >= 0)
                            return a.slots.filter(p => p.entrant.id == userEntrant.id)[0].standing.stats.score.value;
                          return 0
                        }).reduce((a, b) => a + b, 0)} W
                      </a>
                      <a className="text-red-500">
                        L {userEntrant.paginatedSets.nodes.map(a => {
                          if (a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value >= 0)
                            return a.slots.filter(p => p.entrant.id != userEntrant.id)[0].standing.stats.score.value;
                          return 0
                        }).reduce((a, b) => a + b, 0)}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* legend / stage info */}
          <div className="lg:flex cursor-default lg:space-x-2 space-y-2 lg:space-y-0 text-center lg:h-64  bg-slate-900 p-2 rounded-2xl w-full">
            <div className="rounded-2xl lg:w-[50%] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full bg-slate-950">
              <span className="text-2xl font-medium">Legends Played</span>
              <div className={`p-1 scrollbar-thin w-full items-center text-center scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${data.data.stages.length >= 1 ? 'grid grid-cols-2 lg:grid-cols-3' : ''} justify-evenly`}>
                {data.data.legends.length == 0 ? <a className="text-xl">no legends reported</a> : data.data.legends.map(leg => {
                  return <div className="m-0.5 flex items-center rounded-2xl shadow border-slate-700 bg-slate-900 hover:bg-slate-800 transition duration-200">
                    <img className="w-18 h-18 rounded-2xl" src={leg.image} alt={leg.name} />
                    <div className="flex w-full flex-col justify-between p-1.5 leading-normal">
                      <p className="mb-0.5 text-2xl font-bold text-gray-900 dark:text-white">{leg.name}</p>
                      <div className="text-base flex space-x-3 justify-evenly lg:justify-normal">
                        <p><span className='font-semibold text-xl p-1'>{leg.games}</span> {leg.games == 1 ? 'Game' : 'Games'}</p>
                        <p><span className='font-semibold text-xl p-1'>{leg.wins}</span> {leg.wins == 1 ? 'Win' : 'Wins'}</p>
                      </div>
                    </div>
                  </div>
                })}
              </div>
            </div>
            <div className="lg:w-[50%] scrollbar-thin scrollbar-thumb-slate-800 overflow-x-hidden scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full rounded-2xl bg-slate-950">
              <span className="text-2xl font-medium">Stages Played</span>
              <div className={`p-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${data.data.stages.length >= 1 ? 'grid grid-cols-2 lg:grid-cols-3' : ''} justify-evenly`}>
                {data.data.stages.length == 0 ? <a className="text-xl">no stages reported</a> : data.data.stages.map(stage => {
                  return <div className="m-0.5 relative text-center items-center flex flex-col group">
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
            return <div className={`${newData.length > 1 ? i == 0 ? "mb-2 " : "mt-2 " : ""}text-xl lg:text-3xl text-center`}>
              <a>{matchData.type.name == "Bracket" ? `${matchData.type.name} ${matchData.type.ident}` : matchData.type.name}</a>
              <div className="pt-3 text-start">
                {matchData.array.map((mArray, mai) => {
                  let user = mArray.slots.filter(d => d.entrant.id == userEntrant.id)[0];
                  let opponent = mArray.slots.filter(d => d.entrant.id != userEntrant.id)[0];
                  return <div
                    onClick={() => MatchDataFunc(mArray, user, opponent, data.lsd, data.setmd)}
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
                            return <a className={`flex w-12 h-12 rounded-2xl mt-${index * 2} bg-slate-700 justify-center items-center text-center`}>
                              <div className="text-2xl text-slate-100 place-self-center">
                                {part.player.gamerTag[0].toLocaleUpperCase()}
                              </div>
                            </a>
                          } else {
                            return <img className={`w-12 h-12 rounded-2xl mt-${index * 2}`} src={part.player.user.images[0].url} />
                          }
                        })}
                      </div>
                      <div className="flex text-start flex-col">
                        <div className='lg:flex hidden'>
                          <>
                            {opponent.entrant.participants.map((part, index) => (
                              <React.Fragment key={index}>
                                {part.prefix && <span className="text-slate-400 mr-1.5">{part.prefix}</span>}
                                <span>{part.gamerTag}</span>
                                {index < opponent.entrant.participants.length - 1 && <span> &nbsp;&&nbsp; </span>}
                              </React.Fragment>
                            ))}
                          </>
                        </div>
                        <div className='lg:hidden'>
                          <>
                            <div className='lg:flex lg:space-x-2'>
                              {opponent.entrant.participants.map((part, index) => (
                                <React.Fragment key={index} className="flex">
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
    <div onClick={async () => await Event(eventData.id, data.userId, data.lsd, data.eventData)} className="cursor-pointer py-1 w-full flex md:items-center shadow hover:bg-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-700">
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

function MainLayout({ data, lsd }) {
  const [legendData, setLegendData] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [curId, setCurId] = useState(0);

  const [filters, setFilters] = useState({
    gamemode: "0",
    year: "0",
    sorting: "0",
  });
  const handleFilterChange = (filterKey, value) => {
    setFilters({ ...filters, [filterKey]: value });
  };
  useEffect(() => {
    setCurId(data.events[0]?.id)
  }, [])
  const events = data.events;
  return (
    <div className="rounded-lg" role="tabpanel" aria-labelledby="main-tab">
      <div className="lg:flex">
        {/* Sidebar Filters */}
        <div className="lg:w-1/3">
          <div className="py-1 text-center">
            <a id="tourneyCount" className="text-xl lg:text-2xl font-medium text-slate-800 dark:text-slate-200">{events.nodes.length} tourneys</a>
          </div>
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
                { value: "2023", label: "2023" },
                { value: "2022", label: "2022" },
                { value: "2021", label: "2021" },
                { value: "2020", label: "2020" },
                { value: "2019", label: "2019" },
                { value: "2018", label: "2018" },
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
          <div className="flex w-full flex-col overflow-y-auto h-[25vh] lg:h-screen scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {events.nodes.map((item) =>
              <Events data={item} userId={data.id} playerId={data.player.id} lsd={lsd} eventData={setEventData} />)
            }
          </div>
        </div>
        {eventData && <EventData data={eventData} lsd={lsd} md={matchData} setmd={setMatchData} id={curId} sid={setCurId} />}
      </div>
    </div>
  )
}

function TabLayout({ data }) {
  const [activeTab, setActiveTab] = useState(0);
  const [legendStartData, setLegendStart] = useState([]);
  useEffect(() => {
    async function lsd() {
      const lsd = await fetch(host + '/player/legends').then(res => res.json())
      setLegendStart(lsd);
    }
    lsd()
  }, []);
  const tabs = [
    { id: "main", label: "Main" },
    { id: "opponents", label: "Opponent History" },
    { id: "legends", label: "Legend Data" },
    { id: "twos", label: "2v2 Data" },
  ];
  return (
    <div>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div id="myTabContent">
        {activeTab === 0 && (
          <MainLayout data={data} lsd={legendStartData} />
        )}
        {activeTab === 1 && <div role="tabpanel">Opponent History Content</div>}
        {activeTab === 2 && <div role="tabpanel">Legend Data Content</div>}
        {activeTab === 3 && <div role="tabpanel">2v2 Data Content</div>}
      </div>
    </div>
  );
};

export default TabLayout;
