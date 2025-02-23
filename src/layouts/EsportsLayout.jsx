import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../stuff";
import LoginButton from '../components/auth/butt.jsx';


function EsportsDiv() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({})

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("access_token") || localStorage.getItem("accessToken");
    if (token) {
      localStorage.setItem("accessToken", token);
      document.cookie = `accessToken=${token}; path=/; Secure; HttpOnly`;
      setAccessToken(token);
      fetchUserInfo(token);
      searchParams.delete("access_token");
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "./";
  };
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(
        `${host}/auth/user`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (response.status == 401) {
        localStorage.removeItem("accessToken");
        window.location.href = "./";
      }
      setUser(data.user);
    } catch (error) { }
  };
  const renderImage = (src, type, fallbackText = "") => {
    if (src) {
      return <img className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} rounded-lg`} src={src} alt={fallbackText} />;
    } else {
      return (
        <div className={`w-${type == 0 ? 12 : 16} h-${type == 0 ? 12 : 16} rounded-lg bg-slate-700 flex items-center justify-center text-white`}>
          {fallbackText.charAt(0).toUpperCase() || "?"}
        </div>
      );
    }
  };
  return (
    <div className="h-screen bg-slate-950 text-slate-50">
      <div className="flex justify-between bg-slate-900 p-2">
        <p className="text-2xl pl-20">eSports Database</p>
        <div>
          {accessToken ?
            <div className="flex">
              {renderImage(user.images?.[0]?.url, 0, user.player?.gamerTag)}
              <div className="pl-2">
                <p className="text-xl">{user.player?.gamerTag}</p>
                <a
                  className="text-slate-400 text-base"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={"https://start.gg/" + user.slug}
                >
                  {user.slug}
                </a>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded ml-3"
              >
                Logout
              </button>
            </div> : <LoginButton client:load />}
        </div>
      </div>
      <div>
        <div>{0} players in database</div>
        <div>{0} tourneys in database</div>
      </div>
      <div>
        LINKS BELOW vvvv
        <div className="flex space-x-2">
          <div>
            <a href="./esports/tourney">
              <div>
                tournament database
              </div>
            </a>
            <a href="./esports/player">
              <div>
                player database
              </div>
            </a>
            <a href="./esports/autoseed/admin">
              <div>
                autoseed (LOG IN BEFORE GOING IN)
              </div>
            </a>
            <a href="./esports/altgg">
              <div>
                altgg (placeholder, never finishing)
              </div>
            </a>
          </div>
          <div>
            <p>upcoming tourneys</p>
            <p>past tourneys</p>
          </div>
          <div>streams?</div>
        </div>
        <div className="mt-10">
          <p>most tourneys played</p>
          <p>most officials</p>
          <p>most communities</p>
          <p>most gold/silver/bronze medals</p>
          <p>most earnings</p>
          <p>upcoming tourneys</p>
          <p>search bar lol</p>
          <p>confirm if user/stsartID is real</p>
          <p>stat numbers for total users in database</p>
          <p>you shouldn't be here</p>
        </div>
      </div>
    </div>
  );
}

export default EsportsDiv;