import { useState, useEffect } from 'react';
import { host } from "../../stuff";
import { createRoot } from 'react-dom/client';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function PatchList({ data }) {
    const handleClick = () => {
        window.location.href = `/game/legends/${normalizeString(data.bio.name.normal)}`;
    };

    return (
        <div className="relative flex flex-col md:flex-row items-center p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer" onClick={handleClick}>
            <div className="flex flex-shrink-0">
                <div className="flex flex-col justify-center md:justify-start">
                    <img src={data.weapons.main.image} className="h-8 w-8 md:h-12 md:w-12" alt={`${data.weapons.main.name}`} />
                    <img src={data.weapons.secondary.image} className="h-8 w-8 md:h-12 md:w-12" alt={`${data.weapons.secondary.name}`} />
                </div>
                <img src={data.image} className="rounded-lg h-16 w-16 md:h-24 md:w-24" alt={`${data.bio.name.normal} icon`} />
            </div>
            <div className="flex flex-col justify-center text-center md:text-left ml-1 md:mt-0">
                
                <span className="text-xl md:text-2xl font-bold">{data.bio.name.normal}</span>
                <span className="text-sm text-gray-500">Code Name: {data.codeName}</span>
                <span className="text-sm text-gray-500">Release: {new Date(data.release).toLocaleDateString()}</span>
            </div>
        </div>
    );
}

function Cist() {
    const weaponList = [
        "Sword", "Hammer", "Pistol", "RocketLance", "Spear", "Katar", "Axe", 
        "Bow", "Fists", "Scythe", "Cannon", "Orb", "Greatsword", "Boots",
        "Blasters", "Rocket Lance", "Katars", "Gauntlets", "Battle Boots"
    ];

    const [historyItems, setHistoryItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedWeapon, setSelectedWeapon] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [showTags, setShowTags] = useState(false);

    const fetchData = async () => {
        const response = await fetch(host + '/game/legends/all').then(res => res.json());
        return response;
    };

    useEffect(() => {
        fetchData()
            .then((res) => setHistoryItems(res))
            .catch((e) => console.log(e.message));
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setShowTags(window.innerWidth >= 768);
        };

        handleResize();

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const nonWeaponTags = Array.from(
        new Set(
            historyItems.flatMap(item => item.missionTagsFull)
                .filter(tag => !weaponList.includes(tag))
        )
    ).sort();

    const toggleTag = (tag) => {
        setSelectedTags((prevTags) =>
            prevTags.includes(tag) ? prevTags.filter(t => t !== tag) : [...prevTags, tag]
        );
    };

    const filteredLegends = historyItems.filter((item) => {
        const searchQuery = normalizeString(searchTerm);
        const matchesSearch = normalizeString(item.codeName).includes(searchQuery)
            || normalizeString(item.bio.name.normal).includes(searchQuery)
            || normalizeString(item.bio.botName).includes(searchQuery);

        const matchesWeapon = selectedWeapon
            ? item.weapons.main.name === selectedWeapon || item.weapons.secondary.name === selectedWeapon
            : true;

        const matchesTags = selectedTags.every(tag => item.missionTagsFull.includes(tag));

        return matchesSearch && matchesWeapon && matchesTags;
    });

    return (
        <div className="flex flex-col h-screen p-2">
            <div className="flex flex-col md:flex-row justify-center py-2">
                <input
                    type="text"
                    placeholder="Search for a legend..."
                    className="p-2 border rounded-lg w-full md:w-1/2"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex flex-wrap justify-center md:space-x-4">
                {weaponList.slice(0, -5).map((item) => (
                    <img
                        key={item}
                        src={`https://saorax.github.io/images/weapons/${item.toLowerCase()}.png`}
                        alt={item}
                        className={`h-8 w-8 md:h-12 md:w-12 cursor-pointer ${selectedWeapon === item ? 'border-2 rounded-lg border-slate-500' : ''}`}
                        onClick={() => setSelectedWeapon(selectedWeapon === item ? null : item)}
                    />
                ))}
            </div>

            <div className="flex justify-center py-2 md:hidden">
                <button onClick={() => setShowTags(!showTags)} className="bg-blue-500 text-white py-2 px-4 rounded-lg">
                    {showTags ? 'Hide Tags' : 'Show Tags'}
                </button>
            </div>

            <div className={`flex flex-wrap justify-center space-x-2 py-4 ${showTags ? 'flex' : 'hidden'} md:flex`}>
                {nonWeaponTags.map((tag) => (
                    <span
                        key={tag}
                        className={`px-3 py-1 cursor-pointer rounded-full text-sm md:text-base m-1 ${selectedTags.includes(tag) ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-black dark:text-white'}`}
                        onClick={() => toggleTag(tag)}
                    >
                        {tag}
                    </span>
                ))}
            </div>

            <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full scrollbar-track-rounded-full bg-slate-900 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredLegends.map((item) => (
                        <PatchList key={item.id} data={item} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Cist;
