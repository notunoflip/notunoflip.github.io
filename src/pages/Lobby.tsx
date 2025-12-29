import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Auth from "../components/Auth";
import Modal from "../components/Modal";
import RoomsList from "../components/RoomsList";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BackgroundMusic } from "../components/BackgroundMusic";

const LOCAL_EDGE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

export default function Lobby() {
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [player, setPlayer] = useState<{ id: string; nickname?: string } | null>(null);

  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const navigate = useNavigate();
  
  const [musicEnabled] = useState(true);

  const playlist = [
    "/music/chill.mp3",
  ];


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
  }, [session, nicknameOpen]);

  const handleSaveNickname = async () => {
    if (!nicknameInput || !session) return;

    if (!/^[a-z0-9]{3,10}$/.test(nicknameInput)) {
      toast.error("Nickname must be 3–10 lowercase letters or numbers.");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .upsert({ id: session.user.id, nickname: nicknameInput }, { onConflict: "id" });

    if (error) {
      toast.error("Nickname taken. Choose another one");
      console.error(error);
      return;
    }

    setPlayer(data?.[0] || { id: session.user.id, nickname: nicknameInput });
    setNicknameOpen(false);
    toast.success("Nickname saved!");
    window.location.reload();
  };

  const handleCreateRoom = async () => {
    if (!player?.nickname) {
      toast.error("Set your nickname first..");
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

      const { room } = await res.json();

      toast.success(`Room ${room.code} created!`);
      navigate(`/room/${room.code}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  type FetchRoomResult = {
    roomId: string;
    roomCode: string;
    hostId: string;
    players: {
      player_id: string;
      is_host: boolean;
      players: {
        nickname: string;
      };
    }[];
  } | null;

  async function fetchRoomAndPlayers(playerId: string): Promise<FetchRoomResult> {
    const { data, error } = await supabase
      .from("room_players")
      .select(`
      room_id,
      room:rooms (
        id,
        code,
        host_id,
        players_in_room:room_players (
          player_id,
          is_host,
          players ( nickname )
        )
      )
    `)
      .eq("player_id", playerId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.room?.[0]) return null;

    const room = data.room[0];

    return {
      roomId: room.id,
      roomCode: room.code,
      hostId: room.host_id,
      players: room.players_in_room ?? [],
    };
  }



  useEffect(() => {
    const autojoin = async () => {
      if (!player?.id) return;

      try {
        const roomInfo = await fetchRoomAndPlayers(player.id);
        console.log(roomInfo);

        if (roomInfo?.roomCode) {
          navigate(`/room/${roomInfo.roomCode}`);
        }
      } catch (err) {
        console.error("Autojoin failed:", err);
      }
    };

    autojoin();
  }, [player]);






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
            onChange={(e) => {
              const cleaned = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ""); // strips invalid chars
              setNicknameInput(cleaned);
            }}
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

      <BackgroundMusic 
        playlist={playlist}
        volume={0.3}
        enabled={musicEnabled}
      />

    </div>
  );
}
