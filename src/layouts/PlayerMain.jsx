import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../stuff";
import LoginButton from '../components/auth/butt.jsx';
const renderImage = (src, type, fallbackText = "") => {
  if (src) {
    return (
      <img
        className={`w-${type === 0 ? 12 : 16} h-${type === 0 ? 12 : 16} rounded-lg object-cover`}
        src={src}
        alt={fallbackText}
      />
    );
  } else {
    return (
      <div
        className={`w-${type === 0 ? 12 : 16} h-${type === 0 ? 12 : 16} rounded-lg bg-slate-700 flex items-center justify-center text-white text-xl font-bold`}
      >
        {fallbackText.charAt(0).toUpperCase() || "?"}
      </div>
    );
  }
};

function BcxTab({ players, year, gm }) {
  return (
    <div className="flex flex-col bg-slate-800 hover:bg-slate-700 rounded-lg mb-2 transition-colors border border-slate-700 p-2">
      <div className={`flex ${gm === '2v2' ? 'flex-row space-x-4' : 'flex-col'}`}>
        {players.map((p, idx) => (
          <a
            key={idx}
            target="_blank"
            rel="noopener noreferrer"
            href={`http://localhost:3000/esports/player/${p.slug}`}
            className="flex items-center bg-slate-900 hover:bg-slate-800 rounded-lg p-2 transition-colors w-full"
          >
            {renderImage(p.image, 0, p.name)}
            <div className="ml-3 text-xl font-medium">{p.name}</div>
          </a>
        ))}
      </div>
      <div className="mt-2 text-base text-slate-400">{year} World Champion</div>
    </div>
  );
}

function BcxTabs({ data, type }) {
  const [tab, setTab] = useState('1v1');

  const filtered = data
    .filter(entry => entry.gm === tab)
    .sort((a, b) => b.year - a.year);

  return (
    <div className="bg-slate-900 rounded-xl shadow-lg p-4 w-full max-w-md border border-slate-700">
      <div className="flex mb-4 space-x-2">
        {['1v1', '2v2'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${tab === t
                ? 'bg-blue-500 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <h2 className="text-center text-2xl font-semibold text-slate-200 mb-3 border-b border-slate-700 pb-1">
        {tab} World Champions
      </h2>

      <div className="h-64 overflow-y-auto pr-1 custom-scrollbar">
        {filtered.map((entry, idx) => (
          <BcxTab key={idx} players={entry.players} year={entry.year} gm={tab} />
        ))}
      </div>
    </div>
  );
}

function PlayerDiv() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({});
  const [mostGold, setMostGold] = useState([]);
  const [mostSilver, setMostSilver] = useState([]);
  const [mostBronze, setMostBronze] = useState([]);
  const [bcx, setBcx] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setAccessToken(token);
      fetchUserInfo(token);
    }
    fetchData();
    console.log('lol')
  }, []);
  const fetchUserInfo = async (token) => {
    try {
      const data = await fetch(
        `${host}/auth/user`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ).then(res => res.json());
      setUser(data.user);
    } catch (error) { }
  };
  const fetchData = async () => {
    try {
      const mostGold = await fetch(
        `${host}/psql/query`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "mostGold",
            query: [0]
          }),
        }
      ).then(res => res.json());
      const mostSilver = await fetch(
        `${host}/psql/query`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "mostSilver",
            query: [0]
          }),
        }
      ).then(res => res.json());
      const mostBronze = await fetch(
        `${host}/psql/query`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "mostBronze",
            query: [0]
          }),
        }
      ).then(res => res.json());
      const bcx = await fetch(
        `${host}/psql/query`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "bcx",
            query: null
          }),
        }
      ).then(res => res.json());
      setMostGold(mostGold);
      setMostSilver(mostSilver);
      setMostBronze(mostBronze);
      setBcx(bcx);
      console.log(bcx)
    } catch (error) { }
  };

  console.log(mostGold)
  return (
    <div className="h-screen bg-slate-950 text-slate-50">
      <div className="flex justify-between bg-slate-900 p-2">
        <p className="text-2xl pl-20">eSports Database</p>
      </div>
      <div className="justify-between flex mx-2 my-1">
        <div className="w-1/4">
          <p>to do</p>
          <p>most tourneys played</p>
          <p>most officials</p>
          <p>most communities</p>
          <p>most gold/silver/bronze medals</p>
          <p>most earnings</p>
          <p>upcoming tourneys</p>
          <p>search bar lol</p>
          <p>stat numbers for total users in database</p>
          <p></p>
        </div>
        <div className="">search</div>
        <div className="w-1/4">
          {bcx && <BcxTabs data={bcx} title="World Champions" type={0} />}
        </div>
      </div>
    </div>
  );
}

export default PlayerDiv;