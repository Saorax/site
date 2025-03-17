import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { host } from "../stuff";
import LoginButton from '../components/auth/butt.jsx';


function EsportsDiv() {
  return (
    <div className="h-screen bg-slate-950 text-slate-50">
      <div className="flex justify-between bg-slate-900 p-2">
        <p className="text-2xl pl-20">eSports Database</p>
        
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