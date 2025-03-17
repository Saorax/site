import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../stuff";
import LoginButton from '../components/auth/butt.jsx';
function PlayerDiv() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState({});
  const [mostGold, setMostGold] = useState([]);
  const [mostSilver, setMostSilver] = useState([]);
  const [mostBronze, setMostBronze] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setAccessToken(token);
      fetchUserInfo(token);
    }
    fetchMost();
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
    } catch (error) {}
  };
  const fetchMost = async () => {
    try {
      console.log(`${host}/psql/query`);
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
      
      console.log(mostGold,' hi');
      console.log('gi')
      setMostGold(mostGold);
    } catch (error) {}
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
        </div>
        <div className="flex mx-2 my-1">
          <div>
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
          
        </div>
    </div>
  );
}

export default PlayerDiv;