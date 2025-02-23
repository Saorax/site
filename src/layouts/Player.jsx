import React, { useState, useEffect, useRef } from "react";
import { Twitter, Twitch, MessageSquare } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../stuff";
import { countryCodeEmoji } from 'country-code-emoji';
import { getCode } from 'country-list';
import twemoji from 'twemoji';
import Layout from "./PlayerLayout.jsx";


const TwemojiText = ({ text }) => {
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      twemoji.parse(textRef.current, {
        base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/',
        folder: 'svg',
        ext: '.svg',
      });
      const imgs = textRef.current.querySelectorAll('img');
      imgs.forEach((img) => {
        img.style.width = '2.4rem';
        img.style.height = '3rem';
        img.style.verticalAlign = 'middle';
      });
    }
  }, [text]);

  return <div ref={textRef}>{text}</div>;
};
function Player({ id, playerData }) {
  const [accessToken, setAccessToken] = useState(null);
  const [signedInUser, setSignedInUser] = useState({})
  const [user, setUser] = useState(playerData)
  console.log(playerData)
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.error("No access token found.");
      return;
    }
    setAccessToken(token);
  }, [id]);

  if (!user) {
    return <div className="text-center text-white text-xl">Failed to load player data</div>;
  }
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(
        `${host}/auth/user`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setSignedInUser(data.user);
    } catch (error) {
      console.error(error)
    }
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
  async function loadFull() {
    const response2 = await fetch(
      `${host}/player/user/loadAll/${user.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const data2 = await response2.json();
    window.location.reload()
  }
  const statsTabs = [
    { key: "career", label: "Career" },
    { key: "1v1", label: "1v1" },
    { key: "2v2", label: "2v2" },
    { key: "other", label: "Other" }
  ];

  const renderStats = (stats, earnings, gm) => (
    <div className="">
      <p className="font-bold text-2xl">{gm == 1 ? "1v1" : gm == 2 ? "2v2" : gm == 3 ? "Other" : "Career"} Stats</p>
      <div className="lg:flex lg:space-x-6">
        <div className="flex lg:space-x-6 justify-between">
          <div><p className="text-slate-400 lg:text-lg text-sm">Earnings</p><p className="lg:text-xl font-bold">${earnings.toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Events</p><p className="lg:text-xl font-bold">{stats[6].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Gold</p><p className="lg:text-xl font-bold">{stats[0].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Silver</p><p className="lg:text-xl font-bold">{stats[1].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Bronze</p><p className="lg:text-xl font-bold">{stats[2].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Top 8</p><p className="lg:text-xl font-bold">{stats[3].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Top 16</p><p className="lg:text-xl font-bold">{stats[4].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Top 32</p><p className="lg:text-xl font-bold">{stats[5].toLocaleString()}</p></div>
        </div>
        <div className="flex lg:space-x-6 justify-between">
          <div><p className="text-slate-400 lg:text-lg text-sm">Games Played</p><p className="lg:text-xl font-bold">{stats[7].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Games Won</p><p className="lg:text-xl font-bold">{stats[8].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sm">Sets Played</p><p className="lg:text-xl font-bold">{stats[9].toLocaleString()}</p></div>
          <div><p className="text-slate-400 lg:text-lg text-sms">Sets Won</p><p className="lg:text-xl font-bold">{stats[10].toLocaleString()}</p></div>
        </div>
      </div>
    </div>
  );
  return user && accessToken && (
    <div className="dark:text-white dark:bg-slate-950 overflow-y-hidden overflow-x-hidden flex flex-col">
      <div className="overflow-hidden rounded text-slate-500 shadow-slate-200">
        <div className="w-full">
          <div className="w-full relative">
            <div
              className="absolute inset-0 lg:h-full h-auto bg-gray-800 bg-cover bg-center opacity-25"
              style={{
                backgroundImage: user.images.filter(img => img.type === "banner").length > 0
                  ? `url(${user.images.filter(img => img.type === "banner")[0].url})`
                  : "none",
                width: "100%",
              }}
            ></div>

            <div className="relative w-full lg:flex lg:justify-between">
              <div className="">
                <div className=" p-4 w-full flex">
                  <div className="relative lg:w-36 w-24 lg:h-36 h-24">
                    {user.images.filter(img => img.type === "profile").length === 0 ? (
                      <div className="w-full h-full rounded-lg uns" alt={user.player.gamerTag}></div>
                    ) : (
                      <img
                        src={user.images.filter(img => img.type === "profile")[0].url}
                        className="w-full h-full rounded-lg uns"
                        alt={user.player.gamerTag}
                      />
                    )}
                    {user.location.country !== null && (
                      <div className="absolute bottom-0 left-0 w-9 h-9">
                        <TwemojiText
                          text={countryCodeEmoji(getCode(user.location.country))}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                  <div className="pl-2 place-content-end">
                    {user.player.prefix && (
                      <p className="lg:text-2xl text-xl text-gray-600 dark:text-gray-400">{user.player.prefix}</p>
                    )}
                    {user.player.gamerTag && (
                      <p className="lg:text-3xl text-2xl dark:text-white">{user.player.gamerTag}</p>
                    )}
                    <div className="flex space-x-1">
                    {user.authorizations?.sort((a, b) => (a.type === "DISCORD" ? 1 : -1)).map((auth) => {
                      if (auth.type === "TWITTER") {
                        return (
                          <a
                            key="twitter"
                            href={auth.url || `https://twitter.com/${auth.externalUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative group"
                          >
                            <Twitter className="w-6 h-6 text-blue-500 hover:text-blue-400" />
                            <span className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition">
                              @{auth.externalUsername}
                            </span>
                          </a>
                        );
                      }
                      if (auth.type === "TWITCH") {
                        return (
                          <a
                            key="twitch"
                            href={auth.url || `https://twitch.tv/${auth.externalUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative group"
                          >
                            <Twitch className="w-6 h-6 text-purple-600 hover:text-purple-500" />
                            <span className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition">
                              {auth.externalUsername}
                            </span>
                          </a>
                        );
                      }
                      if (auth.type === "DISCORD") {
                        return (
                          <div key="discord" className="relative group">
                            <MessageSquare className="w-6 h-6 text-gray-500 hover:text-gray-400" />
                            <span className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition">
                              {auth.externalUsername}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                    </div>
                    {user.bio && (
                      <p className="text-base text-gray-700 dark:text-gray-300">Bio: {user.bio}</p>
                    )}
                    {user.isFull == false && (
                      <div onClick={loadFull} className="flex">
                        <button className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-1 px-2 rounded">
                          Load Full Data
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {user.isFull == true && <div>
                  {user.names?.length !== 0 ? (
                    <p className="lg:text-xl pl-1 text-lg text-gray-600 dark:text-gray-400">Past Names: <span className="lg:text-xl text-lg text-gray-700 dark:text-gray-300">{user.names?.join(", ")}</span></p>
                  ) : ""}
                  {user.prefixes?.length !== 0 ? (
                    <p className="lg:text-xl pl-1 text-lg text-gray-600 dark:text-gray-400">Past Prefixes: <span className="lg:text-xl text-lg text-gray-700 dark:text-gray-300">{user.prefixes?.join(", ")}</span></p>
                  ) : ""}</div>}
                {user.pr && <div className="lg:flex lg:space-x-4">
                  {user.pr[0].pr && <div className="p-2">
                    <div className="text-slate-200">
                      <p className="font-bold text-2xl">1v1 PR</p>
                      <div className="">
                        <div className="flex lg:space-x-6 justify-between">
                          <div><p className="text-slate-400 lg:text-lg text-sm">Region</p><p className="lg:text-xl font-bold">{user.pr[0].pr.region.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Ranking</p><p className="lg:text-xl font-bold">{user.pr[0].pr.powerRanking.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Earnings</p><p className="lg:text-xl font-bold">${user.pr[0].earnings.toLocaleString()}</p></div>
                        </div>
                        <div className="flex lg:space-x-6 justify-between">
                          <div><p className="text-slate-400 lg:text-lg text-sm">Gold</p><p className="lg:text-xl font-bold">{user.pr[0].pr.gold.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Silver</p><p className="lg:text-xl font-bold">{user.pr[0].pr.silver.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Bronze</p><p className="lg:text-xl font-bold">{user.pr[0].pr.bronze.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Top 8</p><p className="lg:text-xl font-bold">{user.pr[0].pr.top8.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Top 32</p><p className="lg:text-xl font-bold">{user.pr[0].pr.top32.toLocaleString()}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>}
                  {user.pr[1].pr && <div className="p-2">
                    <div className="text-slate-200">
                      <p className="font-bold text-2xl">2v2 PR</p>
                      <div className="">
                        <div className="flex lg:space-x-6 justify-between">
                          <div><p className="text-slate-400 lg:text-lg text-sm">Region</p><p className="lg:text-xl font-bold">{user.pr[1].pr.region.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Ranking</p><p className="lg:text-xl font-bold">{user.pr[1].pr.powerRanking.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Earnings</p><p className="lg:text-xl font-bold">${user.pr[1].earnings.toLocaleString()}</p></div>
                        </div>
                        <div className="flex lg:space-x-6 justify-between">
                          <div><p className="text-slate-400 lg:text-lg text-sm">Gold</p><p className="lg:text-xl font-bold">{user.pr[1].pr.gold.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Silver</p><p className="lg:text-xl font-bold">{user.pr[1].pr.silver.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Bronze</p><p className="lg:text-xl font-bold">{user.pr[1].pr.bronze.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Top 8</p><p className="lg:text-xl font-bold">{user.pr[1].pr.top8.toLocaleString()}</p></div>
                          <div><p className="text-slate-400 lg:text-lg text-sm">Top 32</p><p className="lg:text-xl font-bold">{user.pr[1].pr.top32.toLocaleString()}</p></div>
                        </div>
                      </div>
                    </div>
                  </div>}
                </div>}
              </div>

              {user.isFull == true && (
                <div className="text-slate-200 p-2">
                  <div className="space-y-4">
                    {renderStats(
                      [
                        user.onesStats[0] + user.twosStats[0] + user.otherStats[0],
                        user.onesStats[1] + user.twosStats[1] + user.otherStats[1],
                        user.onesStats[2] + user.twosStats[2] + user.otherStats[2],
                        user.onesStats[3] + user.twosStats[3] + user.otherStats[3],
                        user.onesStats[4] + user.twosStats[4] + user.otherStats[4],
                        user.onesStats[5] + user.twosStats[5] + user.otherStats[5],
                        user.onesStats[6] + user.twosStats[6] + user.otherStats[6],
                        user.onesStats[7] + user.twosStats[7] + user.otherStats[7],
                        user.onesStats[8] + user.twosStats[8] + user.otherStats[8],
                        user.onesStats[9] + user.twosStats[9] + user.otherStats[9],
                        user.onesStats[10] + user.twosStats[10] + user.otherStats[10]
                      ],
                      user.earnings.reduce((a, b) => a + b, 0)
                    )}
                    {renderStats(user.onesStats, user.earnings[0], 1)}
                    {renderStats(user.twosStats, user.earnings[1], 2)}
                    {renderStats(user.otherStats, user.earnings[2], 3)}
                  </div>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
      <Layout data={user} accessToken={accessToken} />
    </div>
  );
}

export default Player;