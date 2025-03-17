import React, { useState, useEffect } from 'react';
import { host } from "../../stuff";

function LoginButton() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({})
  const [backendLoginURL, setBackendLoginURL] = useState(null);
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(
        `${host}/auth/user`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let data = await response.json();
      if (response.status == 401) {
        //localStorage.removeItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        const rp2 = await fetch(`${host}/auth/token/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).then(res => res.json());
        document.cookie = `accessToken=${rp2.access_token}; Secure; SameSite=Strict; Path=/`;
        localStorage.setItem("accessToken", rp2.access_token);
        localStorage.setItem("refreshToken", rp2.refresh_token);
        data = await fetch(
          `${host}/auth/user`,
          {
            headers: { Authorization: `Bearer ${rp2.access_token}` },
          }
        ).then(res => res.json());
      }
      setUser(data.user);
    } catch (error) { console.log(error) }
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
  useEffect(() => {
    const currentPage = encodeURIComponent(window.location.href);
    setBackendLoginURL(`${host}/auth/login?redirect_uri=${currentPage}`);
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("access_token") || localStorage.getItem("accessToken");
    const refreshToken = searchParams.get("refresh_token") || localStorage.getItem("refreshToken");
    if (token) {
      localStorage.setItem("accessToken", token);
      localStorage.setItem("refreshToken", refreshToken);
      document.cookie = `accessToken=${token}; Secure; SameSite=Strict; Path=/`;
      setAccessToken(token);
      fetchUserInfo(token);
      searchParams.delete("access_token");
      searchParams.delete("refresh_token");
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    document.cookie = 'Secure; SameSite=Strict; Path=/';
    window.location.href = `${window.location.origin}${window.location.pathname}`;
  };
  if (!backendLoginURL) return null;
  return (
    <div className='text-white'>
      {accessToken && user ?
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
        </div> : <a className="flex" href={backendLoginURL}>
          <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded ml-3">
            Login with start.gg
          </button>
        </a>}
    </div>

  );
}

export default LoginButton;
