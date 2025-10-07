import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Auth from "./components/Auth";
import Modal from "./components/ui/Modal";
import { useNavigate } from "react-router-dom";
import { useNickname } from "./hooks/useNickname";

const LOCAL_EDGE_URL = "http://localhost:54321/functions/v1";

export default function App() {
  const [isDark] = useState(
    () =>
      localStorage.theme === "dark" ||
      (!localStorage.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
  const [status, setStatus] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);

  const { nickname, setNickname, loading } = useNickname();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
      } else {
        setAuthOpen(true); // open login modal if not logged in
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setAuthOpen(!session);
      }
    );

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

  useEffect(() => {
    if (!loading && session && !nickname) {
      setNicknameOpen(true);
    } else {
      setNicknameOpen(false);
    }
  }, [loading, session, nickname]);

  const handleSaveNickname = async (newNick: string) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from("players")
        .upsert({ id: session.user.id, nickname: newNick }, { onConflict: "id" });

      if (error) throw error;

      setNickname(newNick);
      setNicknameOpen(false);
      setStatus("Nickname saved!");
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleCreateRoom = async () => {
    if (!nickname) return setStatus("Set your nickname first.");
    if (!session) {
      setAuthOpen(true);
      return;
    }

    try {
      setStatus("Creating room...");
      const res = await fetch(`${LOCAL_EDGE_URL}/create-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ playerName: nickname }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { room, player } = await res.json();
      localStorage.setItem("playerId", player.id);
      localStorage.setItem("roomId", room.id);

      navigate(`/room/${room.id}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div> 
      <br />
      <br />
      <br />
     
      <main className="p-4 text-gray-900 dark:text-white space-y-4">

            <button
              className="px-4 py-2 bg-green-500 text-white rounded"
              onClick={handleCreateRoom}
            >
              Create Room
            </button>
        {status && <p>{status}</p>}
      </main>

      {/* Auth popup */}
      <Modal open={authOpen} onClose={() => setAuthOpen(false)}>
        <Auth onLogin={setSession} setStatus={setStatus} />
      </Modal>

      {/* Nickname popup */}
      <Modal open={nicknameOpen} onClose={() => setNicknameOpen(false)}>
        <div className="p-4 space-y-2">
          <h2 className="text-lg font-bold">Choose a nickname</h2>
          <input
            type="text"
            placeholder="Nickname"
            className="border p-2 rounded w-full text-black"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveNickname((e.target as HTMLInputElement).value);
              }
            }}
          />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>("input");
              if (input?.value) handleSaveNickname(input.value);
            }}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
