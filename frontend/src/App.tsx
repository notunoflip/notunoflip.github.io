import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js"; // <-- only import createClient
import type { Session } from "@supabase/supabase-js"; // <-- for TypeScript types only
import Header from "./components/Header";


const LOCAL_EDGE_URL = "http://localhost:54321/functions/v1";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

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
  const [userEmail, setUserEmail] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);
  const [loginCode, setLoginCode] = useState<string>("");

  // Dark mode sync
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

  // Listen for Supabase auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Send magic link
  const handleMagicLinkLogin = async () => {
    if (!userEmail) {
      setStatus("Please enter your email.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: window.location.href // keep the user on this page after login
      },
    });
    if (error) setStatus(`Login error: ${error.message}`);
    else setStatus(`Magic link sent to ${userEmail}. Check Mailpit at http://127.0.0.1:54324`);
  };

  // Code-based login fallback
  const handleCodeLogin = async () => {
    if (!userEmail || !loginCode) {
      setStatus("Enter email and code.");
      return;
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: loginCode,
      type: "magiclink"
    });
    if (error) setStatus(`Code login error: ${error.message}`);
    else setStatus(`Logged in as ${data?.user?.email}`);
  };

  const handleCreateRoom = async () => {
    if (!playerName) {
      setStatus("Enter player name first.");
      return;
    }
    if (!session) {
      setStatus("You must be logged in first.");
      return;
    }

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

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to create room");
      }

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
    if (!roomId || !playerId) {
      setStatus("You must create a room first.");
      return;
    }

    try {
      setStatus("Starting game...");
      const res = await fetch(`${LOCAL_EDGE_URL}/start-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
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
        {!session ? (
          <>
            <input
              type="email"
              placeholder="Enter your email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handleMagicLinkLogin}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              Send Magic Link
            </button>

            <input
              type="text"
              placeholder="Or enter code from email"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handleCodeLogin}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Login with Code
            </button>
          </>
        ) : (
          <p>Logged in as: {session.user?.email}</p>
        )}

        {session && (
          <>
            <input
              type="text"
              placeholder="Enter your player name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
            />

            {!roomId && (
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Create Room
              </button>
            )}

            {roomId && (
              <button
                onClick={handleStartGame}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Start Game
              </button>
            )}
          </>
        )}

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
