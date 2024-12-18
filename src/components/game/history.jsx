import { useState, useEffect } from 'react';
import moment from 'moment';
import { host } from "../../stuff";

function App() {
    const [selectedPatch, setSelectedPatch] = useState(null);
    const [patches, setPatches] = useState([]);
    const [historyData, setHistoryData] = useState(null);
    const [expandedItems, setExpandedItems] = useState({ adds: {}, changes: {} });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        fetch(`${host}/game/history/all`)
            .then(res => res.json())
            .then(data => setPatches(data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (selectedPatch) {
            fetch(`${host}/game/history/${selectedPatch}`)
                .then(res => res.json())
                .then(data => setHistoryData(data))
                .catch(err => console.error(err));
        }
    }, [selectedPatch]);

    const flattenObject = (obj, parentKey = '', result = {}) => {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = parentKey ? `${parentKey}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    flattenObject(obj[key], newKey, result);
                } else {
                    result[newKey] = obj[key];
                }
            }
        }
        return result;
    };

    const flattenChangeObject = (obj, parentKey = '', result = {}) => {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = parentKey ? `${parentKey}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    if ('old' in obj[key] && 'new' in obj[key]) {
                        result[newKey] = obj[key];
                    } else {
                        flattenChangeObject(obj[key], newKey, result);
                    }
                } else {
                    result[newKey] = obj[key];
                }
            }
        }
        return result;
    };

    const toggleAccordion = (section, id) => {
        setExpandedItems(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [id]: !prev[section][id]
            }
        }));
    };

    const handleSelectPatch = (patch) => {
        setSelectedPatch(patch);
        setIsSidebarOpen(false);
    };

    return (
        <div className="flex max-lg:flex-col h-screen bg-gray-900 text-gray-100">
            <div className="lg:hidden p-4">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="text-white focus:outline-none"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            <div className={`fixed lg:static inset-0 bg-zinc-800 lg:translate-x-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:w-64 p-4 shadow-lg overflow-y-auto`}>
                <h1 className="text-lg font-bold mb-4 text-white">Patch History</h1>
                <ul className="space-y-2">
                    {patches.map(patch => (
                        <li key={patch.manifest}>
                            <button
                                className="block w-full text-left p-3 rounded-lg bg-zinc-700 hover:bg-blue-700 transition-colors duration-200"
                                onClick={() => handleSelectPatch(patch.manifest)}
                            >
                                <span className="text-base font-semibold">{patch.patch}</span>
                                <br />
                                <span className="text-xs text-gray-400">{moment(patch.date.replace(' –', '')).format('MMMM Do YYYY, h:mm:ss a')}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 overflow-y-auto">
                {historyData ? (
                    <div>
                        {/* Patch Info */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold">
                                    Patch {historyData.patch}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    {moment(historyData.date.replace(' –', '')).format('MMMM Do YYYY, h:mm:ss a')}
                                </p>
                            </div>
                            <div className="text-sm text-gray-400 flex space-x-4">
                                <span className="bg-blue-800 py-1 px-2 rounded-md">Added: {historyData.adds.length}</span>
                                <span className="bg-yellow-800 py-1 px-2 rounded-md">Changed: {historyData.changes.length}</span>
                                <span className="bg-red-800 py-1 px-2 rounded-md">Removed: {historyData.removes.length}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {/* Added Data */}
                            {historyData.adds.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setHistoryData(prev => ({...prev, addsOpen: !prev.addsOpen }))}
                                        className="w-full text-left py-2 text-lg font-semibold bg-blue-800 hover:bg-blue-900 transition p-3 rounded-lg mb-2"
                                    >
                                        Added Data
                                    </button>
                                    {historyData.addsOpen && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {historyData.adds.map((add, index) => {
                                                const flattenedAdd = flattenObject(add);
                                                const isExpanded = expandedItems.adds[index];

                                                return (
                                                    <div
                                                        key={index}
                                                        className="bg-zinc-800 p-3 rounded-lg shadow-md cursor-pointer"
                                                        onClick={() => toggleAccordion('adds', index)}
                                                    >
                                                        <div className="text-lg font-bold mb-1">
                                                            {add.PowerName} {isExpanded ? '▼' : '▶'}
                                                        </div>
                                                        <div className="text-sm text-gray-400 mb-2">ID {add.PowerID}</div>
                                                        {isExpanded && (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {Object.keys(flattenedAdd).map((key) => (
                                                                    key !== "PowerName" && key !== "PowerID" && (
                                                                        <div key={key} className="p-2 bg-blue-900 rounded text-center shadow-sm">
                                                                            <div className="text-sm font-semibold">{key}</div>
                                                                            <div className="text-xs">{flattenedAdd[key]}</div>
                                                                        </div>
                                                                    )
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Changed Data */}
                            {historyData.changes.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setHistoryData(prev => ({...prev, changesOpen: !prev.changesOpen }))}
                                        className="w-full text-left py-2 text-lg font-semibold bg-yellow-800 hover:bg-yellow-900 transition p-3 rounded-lg mb-2"
                                    >
                                        Changed Data
                                    </button>
                                    {historyData.changesOpen && (
                                        <div>
                                            {historyData.varChanges.new.length !== 0 && (
                                                <div>
                                                    <span className='text-lg'>New Variables</span>
                                                    <div>
                                                        {historyData.varChanges.new.map((cng) => {
                                                            return (
                                                                <li>{cng}</li>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {historyData.varChanges.deleted.length !== 0 && (
                                                <div>
                                                    <span>Deleted Variables</span>
                                                    <div>
                                                        {historyData.varChanges.deleted.map((cng) => {
                                                            return (
                                                                <li>{cng}</li>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            
                                            {historyData.changes.map((change, index) => {
                                                const flattenedChange = flattenChangeObject(change);
                                                const isExpanded = expandedItems.changes[index];

                                                return (
                                                    <div
                                                        key={index}
                                                        className="bg-zinc-800 p-3 rounded-lg shadow-md cursor-pointer"
                                                        onClick={() => toggleAccordion('changes', index)}
                                                    >
                                                        <div className="text-lg font-bold mb-1">
                                                            {change.PowerName.old || change.PowerName} {isExpanded ? '▼' : '▶'}
                                                        </div>
                                                        <div className="text-sm text-gray-400 mb-2">ID {change.PowerID}</div>
                                                        {isExpanded && (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {Object.keys(flattenedChange).map((key) => (
                                                                    key !== "PowerName" && key !== "PowerID" && (
                                                                        <div key={key} className="p-2 bg-yellow-900 rounded text-center shadow-sm">
                                                                            <div className="text-sm font-semibold">{key}</div>
                                                                            <div className="text-xs">
                                                                                {flattenedChange[key].old && (
                                                                                    <span className="text-red-400">{flattenedChange[key].old}</span>
                                                                                )}
                                                                                {flattenedChange[key].new && (
                                                                                    <>
                                                                                        <br />
                                                                                        <span className="text-green-400">{flattenedChange[key].new}</span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Removed Data */}
                            {historyData.removes.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setHistoryData(prev => ({...prev, removesOpen: !prev.removesOpen }))}
                                        className="w-full text-left py-2 text-lg font-semibold bg-red-800 hover:bg-red-900 transition p-3 rounded-lg mb-2"
                                    >
                                        Removed Data
                                    </button>
                                    {historyData.removesOpen && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-1">
                                            {historyData.removes.map(remove => {
                                                const flattenedRemove = flattenObject(remove);
                                                return (
                                                    <div className="bg-red-900 p-3 rounded-lg shadow-md">
                                                        <div className="text-base font-bold">{remove.PowerName}</div>
                                                        <div className="text-xs text-gray-400">ID {remove.PowerID}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-xl">Select a patch to view its history.</div>
                )}
            </div>
        </div>
    );
}

export default App;
