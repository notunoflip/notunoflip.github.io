import { useState, useEffect } from "react";
import Header from "./components/Header";

const LOCAL_EDGE_URL = "http://localhost:54321/functions/v1"; // Adjust if your local port differs

const App = () => {
  const [isDark, setIsDark] = useState(
    () =>
      localStorage.theme === "dark" ||
      (!localStorage.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
  const [status, setStatus] = useState<string>("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");

  // ✅ Load playerName from localStorage (persist across refreshes)
  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setPlayerName(savedName);
    } else {
      const name = prompt("Enter your player name:") || "Anonymous";
      setPlayerName(name);
      localStorage.setItem("playerName", name);
    }
  }, []);

  // Sync dark mode with DOM and localStorage
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
    try {
      if (!playerName) {
        setStatus("Missing player name.");
        return;
      }

      setStatus("Creating room...");

      const res = await fetch(`${LOCAL_EDGE_URL}/create-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ playerName }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to create room");
      }

      const { room, player } = await res.json();
      setRoomId(room.id);
      setPlayerId(player.id);

      // Save IDs for persistence
      localStorage.setItem("playerId", player.id);
      localStorage.setItem("roomId", room.id);

      // Update the browser URL to include the room ID
      window.history.pushState({}, "", `/room/${room.id}`);

      setStatus(`Room created successfully! Room ID: ${room.id}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleStartGame = async () => {
    if (!roomId || !playerId) {
      setStatus("You must create a room first.");
      return;
    }

    try {
      setStatus("Starting game...");
      const res = await fetch(`${LOCAL_EDGE_URL}/start-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          player_id: playerId,
          cards_per_player: 7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to start game");
      }

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
        <p>
          <strong>Player:</strong> {playerName}
        </p>

        <button
          onClick={handleCreateRoom}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Create Room
        </button>

        <button
          onClick={handleStartGame}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Start Game
        </button>

        {roomId && (
          <p>
            <strong>Room ID:</strong> {roomId}
          </p>
        )}
        {playerId && (
          <p>
            <strong>Your Player ID:</strong> {playerId}
          </p>
        )}
        {status && <p>{status}</p>}
      </main>
    </div>
  );
};

export default App;
