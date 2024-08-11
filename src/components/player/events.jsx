import { useState } from 'react';
import { parse } from 'node-html-parser';
import moment from 'moment';
import { host } from "../../stuff";
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
let legendF = [];
async function legf() {
    legendF = await fetch(host+'/player/legends').then(res => res.json()).then(res => res.data);
};
(async () => legf())();
async function legendFetch() {
    let legends = legendF.videogame.characters.map((m) => {
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
async function legendFunc(data, userId) {
    let tempLegend = await legendFetch();
    for (var i = 0; i < data.length; i++) {
        let l = data[i];
        if (l.games != null) {
            for (var z = 0; z < l.games.length; z++) {
                if (l.games[z].selections != null) {
                    let sl = l.games[z].selections.filter(f => f.entrant.id == userId)[0];
                    if (sl !== undefined) {
                        tempLegend.filter((id) => id.id === (swapIds.filter((r) => r[1] === sl.selectionValue).length === 0 ? sl.selectionValue : swapIds.filter((r) => r[1] === sl.selectionValue)[0][0]))[0].games++;
                        if (l.games[z].winnerId == userId) tempLegend.filter((id) => id.id === (swapIds.filter((r) => r[1] === sl.selectionValue).length === 0 ? sl.selectionValue : swapIds.filter((r) => r[1] === sl.selectionValue)[0][0]))[0].wins++;
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
async function stageFunc(data, userId) {
    let stages = [];
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
                    if (l.games[z].winnerId == userId) stages.filter(s => s.id === l.games[z].stage.id)[0].wins++;
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
async function matchFunc(data, userId, oppName) {
    let mdata = `
    <div class="w-full">
        <div class="text-2xl"><span class="text-lg">vs</span> ${oppName}</div>
        <div>Set Length: ${moment.utc(moment(new Date(data.completedAt * 1000),"DD/MM/YYYY HH:mm:ss").diff(moment(new Date(data.startedAt * 1000),"DD/MM/YYYY HH:mm:ss"))).format("mm:ss:").replace(":", "m ").replace(":", "s")}</div>`;
    let legends = await legendFetch();
    if (data.games === null) return mdata+'<span class="text-xl">no game data reported</span></div>';
    for (var i = 0; i < data.games.length; i++) {
        let userSide = `<div class="space-x-3 flex items-center text-center justify-start">`;
        let oppSide = `<div class="space-x-3 flex items-center text-center justify-end">`;
        if (data.games[i].selections !== null && data.games[i].selections.filter(d => d.entrant.id == userId)[0] !== undefined) userSide += `<img src="${legends.filter(p => p.id == data.games[i].selections.filter(d => d.entrant.id == userId)[0].selectionValue)[0].image}" class="object-cover h-10 w-10"/>`;
        else userSide += `<img src="https://saorax.github.io/images/legends/random.png" class="object-cover h-10 w-10"/>`;
        userSide += `<span class="text-2xl font-medium font-mono ${data.games[i].winnerId == userId ? "text-green-500" : "text-red-500"}">${data.games[i].winnerId == userId ? "W" : "L"}</span></div>`;
        oppSide += `<span class="text-2xl font-medium font-mono ${data.games[i].winnerId != userId ? "text-green-500" : "text-red-500"}">${data.games[i].winnerId != userId ? "W" : "L"}</span>`;
        if (data.games[i].selections !== null && data.games[i].selections.filter(d => d.entrant.id != userId)[0] !== undefined) oppSide += `<img src="${legends.filter(p => p.id == data.games[i].selections.filter(d => d.entrant.id != userId)[0].selectionValue)[0].image}" class="object-cover h-10 w-10"/>`;
        else oppSide += `<img src="https://saorax.github.io/images/legends/random.png" class="object-cover h-10 w-10"/>`;
        oppSide += '</div>';
        mdata += `
        <div class="p-1 grid grid-cols-3 text-center items-center w-full">
            ${userSide}
            <div class="flex flex-col">
                <span class="text-lg font-medium">Game ${i+1}</span>
                ${data.games[i].stage != null ? `<span class="text-base font-thin text-slate-300">${data.games[i].stage.name.replace("Small ", "")}</span>` : ""}
            </div>
            ${oppSide}
        </div>`;
    };
    mdata += "</div>"
    return mdata;
};
async function lols(t) {
    let td = document.getElementById('tdHistory');
    let tdI = document.getElementById("tdInfo");
    let tdM = document.getElementById("tdMatch");
    let tdd = document.getElementById("tdMain");
    let data = await fetch(host+'/player/event/'+t).then(res => res.json()).then(res => res.data.user);
    const legends = await legendFunc(data.events.nodes[0].sets.nodes, data.events.nodes[0].sets.nodes[0].event.userEntrant.id);
    const stages = await stageFunc(data.events.nodes[0].sets.nodes, data.events.nodes[ 0].sets.nodes[0].event.userEntrant.id);
    tdd.classList.remove('lg:max-h-[42.5%]');
    tdd.classList.remove('lg:max-h-[51.5%]');
    tdd.classList.remove('lg:max-h-[54.5%]');
    tdd.classList.remove('lg:max-h-[60%]');
    if (stages.length === 0 && legends.length === 0) tdd.classList.add('lg:max-h-[60%]');
    else if (stages.length == 0 && legends.length <= 2) tdd.classList.add('lg:max-h-[54.5%]');
    else if (stages.length <= 3 && legends.length <= 3) tdd.classList.add('lg:max-h-[51.5%]');
    else tdd.classList.add('lg:max-h-[42.5%]');
    let newData = [];
    let tdML = '';
    tdI.innerHTML = `
        <div class="flex">
            <div class="flex flex-col w-full">
                <div class="flex mb-1.5">
                    <div class="mr-1.5">
                    ${data.events.nodes[0].sets.nodes[0].event.tournament.images[0] !== undefined
                        ? `<img class="w-20 h-20 rounded-2xl" src="${data.events.nodes[0].sets.nodes[0].event.tournament.images[0].url}"/>`
                        : `<a class="flex w-20 h-20 rounded-2xl bg-slate-700 justify-center items-center text-center">
                                <div class="text-4xl text-slate-100 place-self-center">
                                    ${data.events.nodes[0].sets.nodes[0].event.tournament.name[0].toLocaleUpperCase()}
                                </div>
                            </a>`}
                    </div>
                    <div class="flex flex-col w-[75%]">
                        <a class="text-2xl" target="_blank" rel="noopener noreferrer" href="https://start.gg/${data.events.nodes[0].sets.nodes[0].event.slug}">${data.events.nodes[0].sets.nodes[0].event.tournament.name}</a>
                        <span class="text-lg text-slate-300">${data.events.nodes[0].sets.nodes[0].event.name}</span>
                    </div>
                </div>
                <div class="mb-1.5 flex text-lg text-center items-center">
                    <div class="p-2 pr-4 lg:flex items-center bg-slate-900 w-full rounded-2xl">
                        <div class="flex items-center">
                            <div class="flex pr-1.5 -space-x-4">
                                ${data.events.nodes[0].sets.nodes[0].slots.filter(d => d.standing.entrant.id == data.events.nodes[0].sets.nodes[0].event.userEntrant.id)[0].standing.entrant.participants.map((part, index) => {
                                    if (part.user == null || part.user.images.length == 0) {
                                        return `<a class="flex w-16 h-16 rounded-2xl bg-slate-700 justify-center items-center text-center">
                                            <div class="text-2xl text-slate-100 place-self-center">
                                                ${part.gamerTag[0].toLocaleUpperCase()}
                                            </div>
                                        </a>`
                                    } else {
                                        return `<img class="mt-${index*2} w-16 h-16 rounded-2xl" src="${part.user.images[0].url}"/>`
                                    }
                                }).join('')}
                            </div>
                            <div class="flex flex-col text-start">
                                <div class="text-2xl font-thin">
                                    ${data.events.nodes[0].sets.nodes[0].slots.filter(d => d.standing.entrant.id == data.events.nodes[0].sets.nodes[0].event.userEntrant.id)[0].standing.entrant.participants.map(part => {
                                        return part.gamerTag
                                    }).join(' / ')}
                                </div>
                                <div class="text-lg flex lg:text-xl font-thin text-slate-800 dark:text-slate-200">
                                    <div>
                                        <span class="font-bold">${ordinal(data.events.nodes[0].sets.nodes[0].event.userEntrant.standing.placement)}</span>
                                        out of 
                                        ${data.events.nodes[0].sets.nodes[0].event.numEntrants}
                                    </div>
                                </div>
                                <div>
                                    <span class="mr-5">Seeded ${ordinal(data.events.nodes[0].sets.nodes[0].event.userEntrant.initialSeedNum)}</span>
                                    <span>Prizing: $${data.events.nodes[0].sets.nodes[0].event.prizingInfo.enablePrizing == true && data.events.nodes[0].sets.nodes[0].event.prizingInfo.prizing.filter(p => p.placement == data.events.nodes[0].sets.nodes[0].event.userEntrant.standing.placement)[0] !== undefined ? data.events.nodes[0].sets.nodes[0].event.prizingInfo.prizing.filter(p => p.placement == data.events.nodes[0].sets.nodes[0].event.userEntrant.standing.placement)[0].amount : 0}</span>
                                </div>
                            </div>
                        </div>
                        <div class="mr-2 ml-4 justify-evenly lg:justify-start space-x-4 flex">
                            <div class="flex flex-col text-center">
                                <span class="text-xl">Set Count</span>
                                <a class="text-lg">${data.events.nodes[0].sets.nodes.map(a => { return 1 }).reduce((a, b) => a + b, 0)} Sets</a>
                                <div class="flex text-lg justify-evenly">
                                    <a class="text-green-500">
                                        ${data.events.nodes[0].sets.nodes.map(a => {
                                            if (a.winnerId == a.event.userEntrant.id) return 1;
                                            return 0
                                        }).reduce((a, b) => a + b, 0)} W
                                    </a>
                                    <a class="text-red-500">
                                        L ${data.events.nodes[0].sets.nodes.map(a => {
                                            if (a.winnerId != a.event.userEntrant.id) return 1;
                                            return 0
                                        }).reduce((a, b) => a + b, 0)}
                                    </a>
                                </div>
                            </div>
                            <div class="flex flex-col text-center">
                                <span class="text-xl">Game Count</span>
                                <a class="text-lg">${data.events.nodes[0].sets.nodes.map(a => {
                                    if (a.slots.filter(p => p.standing.entrant.id == a.event.userEntrant.id)[0].standing.stats.score.value >= 0 && a.slots.filter(p => p.standing.entrant.id != a.event.userEntrant.id)[0].standing.stats.score.value >= 0)
                                        return a.slots.filter(p => p.standing.entrant.id == a.event.userEntrant.id)[0].standing.stats.score.value + a.slots.filter(p => p.standing.entrant.id != a.event.userEntrant.id)[0].standing.stats.score.value;
                                    return 0
                                }).reduce((a, b) => a + b, 0)} Games</a>
                                <div class="flex text-lg justify-evenly">
                                    <a class="text-green-500">
                                        ${data.events.nodes[0].sets.nodes.map(a => {
                                            if (a.slots.filter(p => p.standing.entrant.id == a.event.userEntrant.id)[0].standing.stats.score.value >= 0)
                                                return a.slots.filter(p => p.standing.entrant.id == a.event.userEntrant.id)[0].standing.stats.score.value;
                                            return 0
                                        }).reduce((a, b) => a + b, 0)} W
                                    </a>
                                    <a class="text-red-500">
                                        L ${data.events.nodes[0].sets.nodes.map(a => {
                                            if (a.slots.filter(p => p.standing.entrant.id != a.event.userEntrant.id)[0].standing.stats.score.value >= 0)
                                                return a.slots.filter(p => p.standing.entrant.id != a.event.userEntrant.id)[0].standing.stats.score.value;
                                            return 0
                                        }).reduce((a, b) => a + b, 0)}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="space-y-2 lg:space-y-0 lg:flex text-center rounded-2xl p-3 w-full lg:space-x-4 bg-slate-900">
                        <div class="rounded-2xl lg:w-[50%] bg-slate-950">
                            <span class="text-2xl font-medium">Legends Played</span>
                            <div class="max-h-48 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${legends.length === 0 ? "" : legends.length >= 3 ? "grid grid-cols-2 lg:grid-cols-3" : "grid grid-cols-"+legends.length} justify-evenly">
                            ${legends.length === 0 ? `<a class="text-xl">no legends reported</a>` : legends.map(leg => {
                                return `
                                <a class="m-1 flex items-center rounded-2xl shadow border-slate-700 bg-slate-900 hover:bg-slate-800">
                                    <img class="object-cover w-14 h-14 rounded-2xl" src="${leg.image}" alt="${leg.name}">
                                    <div class="flex flex-col justify-between p-1.5 leading-normal">
                                        <h4 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">${leg.name}</h4>
                                        <div class="text-sm flex space-x-2">
                                            <span>${leg.games} Games</span>
                                            <span>${leg.wins} Wins</span>
                                        </div>
                                    </div>
                                </a>`
                            }).join('')}
                            </div>
                        </div>
                        <div class="lg:w-[50%] rounded-2xl bg-slate-950">
                            <span class="text-2xl font-medium">Stages Played</span>
                            <div class="max-h-48 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 scrollbar-thumb-rounded-full scrollbar-track-rounded-full overflow-y-auto ${stages.length === 0 ? "" : stages.length >= 3 ? "grid grid-cols-3" : "grid grid-cols-"+stages.length} justify-evenly">
                            ${stages.length === 0 ? `<a class="text-xl">no stages reported</a>` : stages.map(stage => {
                                return `
                                <div class="m-1 relative items-center flex flex-col">
                                    <img src="${stage.url}" class="rounded-2xl h-24 w-36" alt="${stage.name}" style="filter: brightness(40%)">
                                    <div class="flex flex-col text-center items-center justify-between p-1.5 leading-normal absolute">
                                        <h4 class="mb-2 text-lg font-medium tracking-tight text-gray-900 dark:text-white">${stage.name}</h4>
                                        <div class="text-sm flex space-x-2">
                                            <span>${stage.games} Games</span>
                                            <span>${stage.wins} Wins</span>
                                        </div>
                                    </div>
                                </div>`
                            }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    for (var i = data.events.nodes[0].sets.nodes.length; i--;) {
        if (newData.filter(p => p.type.name === data.events.nodes[0].sets.nodes[i].phaseGroup.phase.name)[0] === undefined) {
            newData.push({
                type: {
                    name: data.events.nodes[0].sets.nodes[i].phaseGroup.phase.name,
                    ident: data.events.nodes[0].sets.nodes[i].phaseGroup.displayIdentifier
                },
                array: [data.events.nodes[0].sets.nodes[i]]
            })
        } else {
            newData.filter(p => p.type.name === data.events.nodes[0].sets.nodes[i].phaseGroup.phase.name)[0].array.push(data.events.nodes[0].sets.nodes[i])
        }
        newData.filter(p => p.type.name === data.events.nodes[0].sets.nodes[i].phaseGroup.phase.name)[0].array.sort(function (a, b) {
            return (a.startedAt === null ? a.completedAt : a.startedAt) - (b.startedAt === null ? b.completedAt : b.startedAt);
          });
    };
    if (data.events.nodes[0].sets.nodes.length === 0) {
        td.innerHTML = `<a class="text-2xl text-slate-100 place-self-center">Did not play in this tournament, so there is no data available</a>`
    } else {
        let lists = "";
        for (var i = 0; i < newData.length; i++) {
            let tempList = `<div class="${newData.length > 1 ? i == 0 ? "mb-2 " : "mt-2 ": ""}text-xl lg:text-3xl text-center">
                <a>${newData[i].type.name == "Bracket" ? `${newData[i].type.name} ${newData[i].type.ident}` : newData[i].type.name}</a>
                <div class="pt-3 text-start">`;
            for (var o = 0; o < newData[i].array.length; o++) {
                let history = newData[i].array[o];
                let user = history.slots.filter(d => d.standing.entrant.id == history.event.userEntrant.id)[0];
                let opponent = history.slots.filter(d => d.standing.entrant.id != history.event.userEntrant.id)[0];
                tdML += `
                    <div class="w-full hidden text-center items-center" id=${history.id}>
                        ${await matchFunc(history, history.event.userEntrant.id, opponent.standing.entrant.participants.map(part => {
                            return part.gamerTag
                        }).join(' / '))}
                    </div>`
                tempList += `
                <div onClick="test(${history.id})" class="rounded-2xl hover:bg-slate-800 cursor-pointer flex ${newData[i].array.length != o-1 ? "mb-2" : ""}">
                    <div class="w-24 flex flex-col text-center items-center">
                        <a class="text-xl ${user.standing.stats.score.value == -1 || user.standing.stats.score.value < opponent.standing.stats.score.value ? "text-red-500" : "text-green-500"}">
                            ${user.standing.stats.score.value == -1 || opponent.standing.stats.score.value == -1 
                                ? `DQ`
                                : `${user.standing.stats.score.value} - ${opponent.standing.stats.score.value}`
                            }
                        </a>
                        <a class="text-sm font-thin text-slate-800 dark:text-slate-200">Seed: ${opponent.standing.entrant.initialSeedNum}</a>
                        <a class="text-sm font-thin text-slate-800 dark:text-slate-200">Placed: ${ordinal(opponent.standing.entrant.standing.placement)}</a>
                    </div>
                    <div class="flex items-center text-xl">
                        <div class="flex mr-1.5 -space-x-4">
                            ${opponent.standing.entrant.participants.map((part, index) => {
                                if (part.user == null || part.user.images.length == 0) {
                                    return `<a class="flex w-12 h-12 rounded-2xl mt-${index*2} bg-slate-700 justify-center items-center text-center">
                                    <div class="text-2xl text-slate-100 place-self-center">
                                        ${part.gamerTag[0].toLocaleUpperCase()}
                                    </div>
                                </a>`
                                } else {
                                    return `<img class="w-12 h-12 rounded-2xl mt-${index*2}" src="${part.user.images[0].url}"/>`
                                }
                            }).join('')}
                        </div>
                        <div class="flex flex-col">
                            <div>
                                ${opponent.standing.entrant.participants.map(part => {
                                    return part.gamerTag
                                }).join(' / ')}
                            </div>
                            <div class="space-x-3 flex text-base text-slate-400">
                                <span>${history.fullRoundText}</span>
                                <span>~</span>
                                <span>${moment.utc(moment(new Date(history.completedAt * 1000),"DD/MM/YYYY HH:mm:ss").diff(moment(new Date(history.startedAt * 1000),"DD/MM/YYYY HH:mm:ss"))).format("mm:ss:").replace(":", "m ").replace(":", "s")}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            };
            tempList += "</div></div>";
            lists += tempList;
        };
        tdM.innerHTML = `<div class="bg-slate-900 ml-2 p-2.5 rounded-l-lg">${tdML}</div>`;
        td.innerHTML = `
        <div class="divide-y-2 w-full p-1 divide-slate-700 rounded-2xl bg-slate-900 text-slate-100">
            ${lists}
        </div>`
    }
};
/*
<div class="flex font-medium text-sm lg:text-base text-slate-300 text-center items-center">
    {data.data.userEntrant.participants.length > 1 ? data.data.userEntrant.participants.map(part => {
        return part.gamerTag
    }).join(' / ') : ""}
</div>
*/
export default function Counter(data) {
    let sets = data.data.sets !== undefined
        ? data.data.sets.nodes.sort(function (a, b) {return b.completedAt - a.completedAt})
        : [];
    return (
    <div onClick={async () => await lols(data.userId+'/'+data.playerId+'/'+data.data.id)} class="cursor-pointer py-1 w-full flex md:items-center shadow md:max-w-xl hover:bg-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-700">
        {
            data.data.tournament.images.filter(p => p.type === "profile")[0] !== undefined
                ? <img class="ml-1 w-16 h-16 rounded-2xl" src={data.data.tournament.images.filter(p => p.type === "profile")[0].url}/>
                : <a class="ml-1 flex w-16 h-16 rounded-2xl bg-slate-700 justify-center items-center text-center">
                    <div class="text-4xl text-slate-100 place-self-center">
                        {data.data.tournament.name[0].toLocaleUpperCase()}
                    </div>
                </a>
        }
        <div class="ml-1.5 w-full flex flex-col">
            <header class="flex gap-4">
                <div>
                    <h3 class="text-base font-medium text-slate-100">{data.data.tournament.name}</h3>
                    <p class="text-xs lg:text-sm text-slate-400">{gamemode(data.data.gamemode)} ~ {moment(new Date(data.data.startAt * 1000)).format('llll')}</p>
                </div>
            </header>
            <div class="flex  justify-between text-slate-100">
                {
                    data.data.userEntrant.standing !== null 
                    ? <div class="text-sm lg:text-base font-thin text-slate-800 dark:text-slate-200"><span class="font-bold">{ordinal(data.data.userEntrant.standing.placement)}</span> out of {data.data.numEntrants}</div>
                    : <div class="text-sm lg:text-base font-thin text-slate-800 dark:text-slate-200">no placement</div>
                }
                {sets !== null && sets.length !== 0 ? <div class="text-sm">in tourney for {moment.utc(moment(new Date(sets[0].completedAt * 1000),"DD/MM/YYYY HH:mm:ss").diff(moment(new Date(sets[sets.length-1].startedAt * 1000),"DD/MM/YYYY HH:mm:ss"))).format("H:mm:ss:").replace(":", "h ").replace(":", "m ").replace(":", "s")}</div> : ""}
            </div>
        </div>
    </div>
    );
};