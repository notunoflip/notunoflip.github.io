//  root.classList.add("dark");
//  root.classList.remove("dark");

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Auth from "./components/Auth";
import Modal from "./components/ui/Modal";
import { useNavigate } from "react-router-dom";
import RoomsList from "./components/RoomsList";
import { toast } from "sonner";

const LOCAL_EDGE_URL = import.meta.env.VITE_EDGE_URL;

export default function Lobby() {
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [player, setPlayer] = useState<{ id: string; nickname?: string } | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameOpen, setNicknameOpen] = useState(false);

  const navigate = useNavigate();

  // Restore session or prompt login
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
      } else {
        setAuthOpen(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthOpen(!session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Check if player exists for the logged-in user
  useEffect(() => {
    const checkPlayer = async () => {
      if (!session) return;

      const { data: existingPlayer, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking player:", error);
        return;
      }

      if (!existingPlayer) {
        // No player → prompt for nickname
        setNicknameOpen(true);
      } else {
        // Player exists → store in state
        setPlayer(existingPlayer);
      }
    };

    checkPlayer();
  }, [session]);

  const handleSaveNickname = async () => {
    if (!nicknameInput || !session) return;

    const { data, error } = await supabase
      .from("players")
      .upsert({ id: session.user.id, nickname: nicknameInput }, { onConflict: "id" });

    if (error) {
      toast.error("Failed to save nickname");
      console.error(error);
      return;
    }

    setPlayer(data?.[0] || { id: session.user.id, nickname: nicknameInput });
    setNicknameOpen(false);
    toast.success("Nickname saved!");
  };

  const handleCreateRoom = async () => {
    if (!player?.nickname) {
      toast.error("Set your nickname first.");
      setNicknameOpen(true);
      return;
    }

    try {
      toast.info("Creating room...");
      const res = await fetch(`${LOCAL_EDGE_URL}/create-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ playerName: player.nickname }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { room, player: returnedPlayer } = await res.json();
      localStorage.setItem("playerId", returnedPlayer.id);
      localStorage.setItem("roomId", room.id);

      toast.success(`Room ${room.code} created!`);
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  return (
    <div>
      <main className="p-5 text-gray-900 dark:text-white space-y-4">
        <br /><br />
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={handleCreateRoom}
        >
          Create Room
        </button>
        <RoomsList />
      </main>

      {/* Auth modal */}
      <Modal open={authOpen} onClose={() => setAuthOpen(false)}>
        <Auth
          onLogin={setSession}
        />
      </Modal>

      {/* Nickname modal */}
      <Modal open={nicknameOpen} onClose={() => setNicknameOpen(false)}>
        <div className="p-4 space-y-2 text-white">
          <h2 className="text-lg text-black dark:text-white font-bold">Choose a nickname</h2>
          <input
            type="text"
            placeholder="alphanumeric 3-10 characters"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            className="border p-2 rounded w-full text-white bg-gray-900"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveNickname();
            }}
          />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={handleSaveNickname}
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
