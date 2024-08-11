import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { host } from "../../stuff";
import { parse } from 'node-html-parser';
import moment from 'moment';
let ob = ['HitGfx', 'FireGfx', 'CastGfx'];
function HistMain(data) {
    console.log(data)
};
function getHistory(manifest) {
    let id = manifest.target.id !== '' ? manifest.target.id : manifest.target.parentElement.id;
    let main = document.getElementById('historyContent');
    (async () => {
        const data = await fetch(host+'/game/history/'+id).then(res => res.json());
        console.log(data)
        main.innerHTML = `
        <div class="w-full scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 relative overflow-auto">
            <div class="hs-accordion-group scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 relative overflow-auto">
            ${data.powerTypes.adds.length === 0 && data.powerTypes.changes.length === 0 && data.powerTypes.removes.length === 0 ? "" : `
                <div class="hs-accordion scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 relative overflow-auto" id="pr-main">
                    <button class="hs-accordion-toggle hs-accordion-active:text-blue-600 py-3 inline-flex items-center gap-x-3 w-full font-semibold text-left text-zinc-800 transition hover:text-zinc-500 dark:hs-accordion-active:text-blue-500 dark:text-zinc-200 dark:hover:text-zinc-400" aria-controls="pr-collapse-main">
                        <svg class="hs-accordion-active:hidden hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 block w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <path d="M8.12421 13.36V2.35999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <svg class="hs-accordion-active:block hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 hidden w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <div class="hs-tooltip inline-block [--placement:right]">
                            <a class="text-2xl">powerTypes</a>
                            <span class="ml-3 w-64 hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-zinc-900 text-xs font-medium text-white rounded-md shadow-sm dark:bg-slate-700" role="tooltip">
                                <a>This is where all the frame data is stored.</a>
                                <a>Includes attacks, taunts, emotes, etc.</a>
                            </span>
                        </div>
                    </button>
                    <div id="pr-collapse-main" class="hs-accordion-content w-full overflow-hidden transition-[height] duration-300" aria-labelledby="pr-main" style="height: 0px;">
                        <div class="hs-accordion-group pl-6">
                            ${data.powerTypes.adds.length !== 0 ?
                                `<div class="hs-accordion" id="pr-one">
                                        <button class="hs-accordion-toggle hs-accordion-active:text-blue-600 py-3 inline-flex items-center gap-x-3 w-full font-semibold text-left text-zinc-800 transition hover:text-zinc-500 dark:hs-accordion-active:text-blue-500 dark:text-zinc-200 dark:hover:text-zinc-400" aria-controls="pr-collapse-one">
                                            <svg class="hs-accordion-active:hidden hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 block w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                            <path d="M8.12421 13.36V2.35999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                            </svg>
                                            <svg class="hs-accordion-active:block hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 hidden w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                            </svg>
                                            <p class="text-lg">Added Data</p>
                                        </button>
                                        <div id="pr-collapse-one" class="flex flex-col hs-accordion-content w-full overflow-hidden transition-[height] duration-300" aria-labelledby="pr-one" style="height: 0px;">
                                            ${data.powerTypes.adds.map((add) => {
                                                return `
                                                <div class="flex flex-col w-full py-1">
                                                    <div class="items-center">
                                                        <a class="text-2xl">${add.PowerName}</a>
                                                        <a class="text-sm ml-2 items-center">ID ${add.PowerID}</a>
                                                    </div>
                                                    <div class="grid grid-cols-4 break-all">
                                                        ${Object.keys(add).map((key) => [key, add[key]]).map((ss) => {
                                                            if (ss[0] !== "PowerName" && ss[0] !== "PowerID") {
                                                                if (ob.includes(ss[0])) {
                                                                    return Object.keys(ss[1]).map((key) => [key, ss[1][key]]).map((ss2) => {
                                                                        return `
                                                                            <div class="p-1.5 m-1 cursor-default flex flex-col justify-center items-center rounded-lg border-blue-700 bg-zinc-800 hover:bg-zinc-700">
                                                                                <a class="text-lg font-semibold">${ss[0]}.${ss2[0]}</a>
                                                                                <a class="text-xs whitespace-pre-wrap text-center">${ss2[1]}</a>
                                                                            </div>`
                                                                    }).join('');
                                                                } else return `
                                                                    <div class="p-1.5 m-1 cursor-default flex flex-col justify-center items-center rounded-lg border-blue-700 bg-zinc-800 hover:bg-zinc-700">
                                                                        <a class="text-lg font-semibold">${ss[0]}</a>
                                                                        <a class="text-xs whitespace-pre-wrap text-center">${ss[1]}</a>
                                                                    </div>`
                                                            }
                                                        }).join('')}
                                                    </div>
                                                </div>`
                                            }).join('')}
                                        </div>
                                </div>` : ""
                            }
                            ${data.powerTypes.changes.length !== 0 ?
                                `<div class="hs-accordion" id="pr-two">
                                    <button class="hs-accordion-toggle hs-accordion-active:text-blue-600 py-3 inline-flex items-center gap-x-3 w-full font-semibold text-left text-zinc-800 transition hover:text-zinc-500 dark:hs-accordion-active:text-blue-500 dark:text-zinc-200 dark:hover:text-zinc-400" aria-controls="pr-collapse-two">
                                        <svg class="hs-accordion-active:hidden hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 block w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        <path d="M8.12421 13.36V2.35999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        </svg>
                                        <svg class="hs-accordion-active:block hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 hidden w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        </svg>
                                        <p class="text-lg">Changed Data</p>
                                    </button>
                                    <div id="pr-collapse-two" class="flex flex-col hs-accordion-content w-full overflow-hidden transition-[height] duration-300" aria-labelledby="pr-two" style="height: 0px;">
                                        ${data.powerTypes.changes.map((add) => {
                                                return `
                                                <div class="flex flex-col w-full py-1">
                                                    <div class="items-center">
                                                        <a class="text-2xl">${add.PowerName.old ? add.PowerName.old : add.PowerName}</a>
                                                        <a class="text-sm ml-2 items-center">ID ${add.PowerID}</a>
                                                    </div>
                                                    <div class="grid grid-cols-4 break-all">
                                                        ${Object.keys(add).map((key) => [key, add[key]]).map((ss) => {
                                                            if (ss[0] !== "PowerName" && ss[0] !== "PowerID" || add.PowerName.old !== undefined && ss[0] !== "PowerID") {
                                                                if (ob.includes(ss[0])) {
                                                                    return Object.keys(ss[1]).map((key) => [key, ss[1][key]]).map((ss2) => {
                                                                        return `
                                                                            <div class="p-1.5 m-1 cursor-default flex flex-col justify-center items-center rounded-lg border-blue-700 bg-zinc-800 hover:bg-zinc-700">
                                                                                <a class="text-lg font-semibold">${ss[0]}.${ss2[0]}</a>
                                                                                <div class="items-center flex flex-col space-y-1">
                                                                                    <span class="text-base whitespace-pre-wrap text-center">${ss2[1].old === "" ? "empty" : ss2[1].old}</span>
                                                                                    <span class="text-xs">changed to</span> 
                                                                                    <span class="text-base whitespace-pre-wrap text-center">${ss2[1].new === "" ? "empty" : ss2[1].new}</span>
                                                                                </div>
                                                                            </div>`
                                                                    }).join('');
                                                                } else return `
                                                                    <div class="p-1.5 m-1 cursor-default flex flex-col justify-center items-center rounded-lg border-blue-700 bg-zinc-800 hover:bg-zinc-700">
                                                                        <a class="text-lg font-semibold">${ss[0]}</a>
                                                                        <div class="items-center flex flex-col space-y-1">
                                                                            <span class="text-base whitespace-pre-wrap text-center">${ss[1].old === "" ? "empty" : ss[1].old}</span>
                                                                            <span class="text-xs">changed to</span> 
                                                                            <span class="text-base whitespace-pre-wrap text-center">${ss[1].new === "" ? "empty" : ss[1].new}</span>
                                                                        </div>
                                                                    </div>`
                                                            }
                                                        }).join('')}
                                                    </div>
                                                </div>`
                                            }).join('')}
                                    </div>
                                </div>` : ""
                            }
                            ${data.powerTypes.removes.length !== 0 ?
                                `<div class="hs-accordion" id="pr-three">
                                    <button class="hs-accordion-toggle hs-accordion-active:text-blue-600 py-3 inline-flex items-center gap-x-3 w-full font-semibold text-left text-zinc-800 transition hover:text-zinc-500 dark:hs-accordion-active:text-blue-500 dark:text-zinc-200 dark:hover:text-zinc-400" aria-controls="pr-collapse-three">
                                        <svg class="hs-accordion-active:hidden hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 block w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        <path d="M8.12421 13.36V2.35999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        </svg>
                                        <svg class="hs-accordion-active:block hs-accordion-active:text-blue-600 hs-accordion-active:group-hover:text-blue-600 hidden w-3 h-3 text-zinc-600 group-hover:text-zinc-500 dark:text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.62421 7.86L13.6242 7.85999" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        </svg>
                                        <p class="text-lg">Removed Data</p>
                                    </button>
                                    <div id="pr-collapse-three" class="flex flex-col hs-accordion-content w-full overflow-hidden transition-[height] duration-300" aria-labelledby="pr-three" style="height: 0px;">
                                        <div class="grid grid-cols-4 break-all">
                                            ${data.powerTypes.removes.map((add) => {
                                                return `
                                                <div class="flex flex-col w-full py-1">
                                                    <div class="p-1.5 m-1 cursor-default flex flex-col justify-center items-center rounded-lg border-blue-700 bg-zinc-800 hover:bg-zinc-700">
                                                        <a class="text-lg font-semibold">ID ${add.PowerID}</a>
                                                        <a class="text-xs whitespace-pre-wrap text-center">${add.PowerName}</a>
                                                    </div>
                                                </div>`
                                            }).join('')}
                                        </div>
                                    </div>
                                </div>` : ""
                            }
                        </div>
                    </div>
                </div>`
            }
            </div>
        </div>`
    })();
};
function PatchList(data) {
    data = data.data;
    return (<li className="relative">
            <a id={data.manifest}
                onClick={getHistory} className="px-2 flex h-12 cursor-pointer items-center truncate rounded-[5px] text-[0.875rem] text-zinc-600 outline-none transition duration-300 ease-linear hover:bg-slate-50 hover:text-inherit hover:outline-none focus:bg-slate-50 focus:text-inherit focus:outline-none active:bg-slate-50 active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:active:bg-white/10"
                data-te-sidenav-link-ref>
                <span>Patch {data.patch} ({moment(data.date.replace(' –', '')).format('MMMM Do YYYY, h:mm:ss a')})</span>
            </a>
        </li>)
};
function Cist() {
    const [historyItems, initHist] = useState([])
    const fetchData = async () => {
        const response = await fetch(host+'/game/history/all').then(res => res.json());
        return response;
    }
    useEffect(() => {
        fetchData()
        .then((res) => {
            initHist(res)
        })
        .catch((e) => {
            console.log(e.message)
        })
    }, []);
    console.log(historyItems)
    return (
    <div className="flex h-screen space-x-1">
        <div className="p-1 bg-zinc-800">
            <ul className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 relative overflow-auto h-screen m-0 list-none" data-te-sidenav-menu-ref>
                {historyItems.map((item) =>
                    <PatchList data={item} />)}
            </ul>
        </div>
        <div className="w-full p-1 overflow-y-auto h-screen" id="historyContent">
            history
        </div>
    </div>)
}
async function createHistory() {
    let main = document.getElementById('mainContent');
    const root = createRoot(main);
    return root.render(<Cist />);
};
export default function History() {
    return (
    <div>
        <div>
            content
            <a onClick={async () => await createHistory()} 
                className="flex text-xl h-12 cursor-pointer items-center truncate rounded-[5px] px-6 py-4 text-[0.875rem] text-zinc-600 outline-none transition duration-300 ease-linear hover:bg-slate-50 hover:text-inherit hover:outline-none focus:bg-slate-50 focus:text-inherit focus:outline-none active:bg-slate-50 active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:active:bg-white/10"
                data-te-sidenav-link-ref>
                <span>Historical Changes</span>
            </a>
        </div>
        <div id='mainContent'></div>
    </div>);
};