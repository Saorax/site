import { useState, useEffect } from 'react';
import { host } from "../../stuff";
import { createRoot } from 'react-dom/client';
import { parse } from 'node-html-parser';
import moment from 'moment';
let ob = ['HitGfx', 'FireGfx', 'CastGfx'];
function HistMain(data) {
    console.log(data)
};
function getHistory(manifest) {
    let id = manifest.target.id !== '' ? manifest.target.id : manifest.target.parentElement.id;
    let main = document.getElementById('legendDataContent');
    console.log(id)
    main.innerHTML = ``;
    //*
    (async () => {
        const data = await fetch(host+'/game/legends/'+id).then(res => res.json()).then(res => res.data);
        console.log(data)
        const root = createRoot(main);
        const ste = ['def', 'dex', 'spe', 'str'];
        root.render((
            <div className="w-full p-2">
                <div className="flex h-full w-full text-[0.875rem] text-zinc-600 dark:text-zinc-300 p-2"
                    data-te-sidenav-link-ref>
                    <div className='flex w-full justify-between'>
                        <div className='flex'>
                            <img src={data.image} className='rounded-xl h-32 w-32'></img>
                            <div className='pr-3 flex flex-col ml-4 min-w-[20%]'>
                                <span className='text-xl font-normal'>{data.bio.aka}</span>
                                <span className='text-4xl font-bold'>{data.bio.name.normal}</span>
                                <span className='text-lg font-normal'>CodeName: {data.codeName}</span>
                                <span className='text-xl font-normal'>{new Date(data.release).toLocaleString(navigator.language, {year: "numeric",month: "long",day: "numeric",})} ({((new Date() - new Date(data.release)) / (1000 * 3600 * 24)).toFixed()} days ago)</span>
                            </div>
                        </div>
                        <div className='flex'>
                            <img src={data.weapons.main.image} className='w-16 h-16'></img>
                            <img src={data.weapons.secondary.image} className='w-16 h-16'></img>
                        </div>
                    </div>
                </div>
                <div className='flex w-full'>
                    <div className='flex w-[80%] space-x-2'>
                        <div className='flex'>
                            <div>
                                <span className='text-xl font-bold text-center justify-center items-center'>Base Stance</span>
                                <div className='flex'>
                                    <div class="flex flex-col mr-2">
                                        {ste.map(r => {
                                            let fdsa = <div className='flex my-0.5'><img src={'/game/' + (r === 'def' ? 'defense' : r === 'dex' ? 'dexterity' : r === 'spe' ? 'speed' : 'attack') + '.png'} className='h-8 w-8 mr-2'/><span className='text-xl font-bold'>{r === 'def' ? 'DEFENSE' : r === 'dex' ? 'DEXTERITY' : r === 'spe' ? 'SPEED' : 'STRENGTH'}</span></div>
                                            return <div className="flex">{fdsa}</div>
                                        })}
                                    </div>
                                    <div class="flex flex-col">
                                        {ste.map(r => {
                                            let fdsa = [<img src='/game/742.png' className='h-8'/>]
                                            for (var i = 1; i < 10; i++) {
                                                if (i === 9 && data.stances[r] === 10) fdsa.push(<img src='/game/750.png' className='h-8'/>);
                                                else if (i === 9 && data.stances[r] !== 10) fdsa.push(<img src='/game/753.png' className='h-8'/>);
                                                else if (data.stances[r] <= i) fdsa.push(<img src='/game/749.png' className='h-8'/>);
                                                else fdsa.push(<img src='/game/745.png' className='h-8'/>);
                                            }
                                            return <div className="flex my-0.5">{fdsa}</div>
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='w-[20%] flex flex-col'>
                        <div className='flex flex-col space-y-2 p-4 border-sky-800 rounded-lg border-4'>
                            <span className='text-xl whitespace-pre-wrap font-semibold'>{data.bio.quote.text}</span>
                            <span className='text-xl font-light italic'>{data.bio.quote.attrib.replace('-', '- ')}</span>
                        </div>
                        <div className='flex flex-col space-y-2 p-4 border-sky-800 rounded-lg border-4'>
                            <span className='text-xl whitespace-pre-wrap font-semibold'>{data.bio.quote2.text}</span>
                            <span className='text-xl font-light italic'>{data.bio.quote2.attrib.replace('-', '- ')}</span>
                        </div>
                    </div>
                </div>
            </div>));
    })();
    //*/
};
function PatchList(data) {
    data = data.data;
    return (<div className="relative">
            <div className="h-full w-full cursor-pointer items-center truncate rounded-[5px] text-[0.875rem] text-zinc-600 outline-none transition duration-300 ease-linear hover:bg-slate-50 hover:text-inherit hover:outline-none focus:bg-slate-50 focus:text-inherit focus:outline-none active:bg-slate-50 active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:active:bg-white/10"
                data-te-sidenav-link-ref>
                    <div id={data.id}
                        onClick={getHistory} className='flex flex-col mt-1.5 items-center text-center text-base'>
                        <img src={data.image} className='rounded-lg h-12 w-12'></img>
                        <span className='text-center'>{data.bio.name.normal}</span>
                    </div>
            </div>
        </div>)
};
function Cist() {
    const [historyItems, initHist] = useState([])
    const fetchData = async () => {
        const response = await fetch(host+'/game/legends/all').then(res => res.json()).then(res => res.data);
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
    <div className="flex flex-col h-screen">
        <div className="overflow-y-auto bg-cyan-950">
            <div className="max-h-36 grid grid-cols-[repeat(18,_minmax(0,_1fr))] max-xl:grid-cols-[repeat(14,_minmax(0,_1fr))] max-lg:grid-cols-[repeat(10,_minmax(0,_1fr))] max-md:grid-cols-[repeat(6,_minmax(0,_1fr))]">
                {historyItems.map((item) =>
                    <PatchList data={item} />)}
            </div>
        </div>
        <div className="w-full overflow-y-auto" id="legendDataContent">
            
        </div>
    </div>)
}
async function createHistory() {
    let main = document.getElementById('mainContent');
    const root = createRoot(main);
    return root.render(<Cist />);
};
export default function History() {
    return (<a onClick={async () => await createHistory()} 
        className="flex text-xl h-12 cursor-pointer items-center truncate rounded-[5px] px-6 py-4 text-[0.875rem] text-zinc-600 outline-none transition duration-300 ease-linear hover:bg-slate-50 hover:text-inherit hover:outline-none focus:bg-slate-50 focus:text-inherit focus:outline-none active:bg-slate-50 active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:active:bg-white/10"
        data-te-sidenav-link-ref>
        <span>Legend Data</span>
    </a>);
};