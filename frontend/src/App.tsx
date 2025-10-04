import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Header from "./components/Header";
import Auth from "./components/Auth";
import PlayerSetup from "./components/PlayerSetup";
import GameControls from "./components/GameControls";

const LOCAL_EDGE_URL = "http://localhost:54321/functions/v1";

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.theme === "dark" ||
    (!localStorage.theme && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
  const [status, setStatus] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.theme = "dark";
    } else {
      root.classList.remove("dark");
      localStorage.theme = "light";
    }
  }, [isDark]);

  const handleCreateRoom = async () => {
    if (!playerName) return setStatus("Enter player name first.");
    if (!session) return setStatus("You must be logged in first.");

    try {
      setStatus("Creating room...");
      const res = await fetch(`${LOCAL_EDGE_URL}/create-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ playerName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { room, player } = await res.json();
      setRoomId(room.id);
      setPlayerId(player.id);
      localStorage.setItem("playerId", player.id);
      localStorage.setItem("roomId", room.id);
      window.history.pushState({}, "", `/room/${room.id}`);
      setStatus(`Room created: ${room.id}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleStartGame = async () => {
    if (!roomId || !playerId) return setStatus("You must create a room first.");
    try {
      setStatus("Starting game...");
      const res = await fetch(`${LOCAL_EDGE_URL}/start-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ room_id: roomId, player_id: playerId, cards_per_player: 7 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setStatus(`Game started: ${JSON.stringify(result)}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleTheme={() => setIsDark(!isDark)} />
      <main className="p-4 text-gray-900 dark:text-white space-y-4">
        {!session ? (
          <Auth onLogin={setSession} setStatus={setStatus} />
        ) : (
          <>
            <p>Logged in as: {session.user?.email}</p>
            <PlayerSetup
              playerName={playerName}
              setPlayerName={setPlayerName}
              handleCreateRoom={handleCreateRoom}
              roomId={roomId}
            />
            <GameControls
              handleStartGame={handleStartGame}
              roomId={roomId}
              playerId={playerId}
            />
          </>
        )}
        {roomId && <p><strong>Room ID:</strong> {roomId}</p>}
        {playerId && <p><strong>Your Player ID:</strong> {playerId}</p>}
        {status && <p>{status}</p>}
      </main>
    </div>
  );
}
