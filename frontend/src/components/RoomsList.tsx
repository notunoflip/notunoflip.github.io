import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNickname } from "../hooks/useNickname";
import { toast } from "sonner";

interface Room {
  id: string;
  code: string;
  started: boolean;
  created_at: string;
}

export default function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const { nickname, loading } = useNickname();
  const LOCAL_EDGE_URL = "http://localhost:54321/functions/v1";

  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, code, started, created_at");

      if (error) {
        toast.error("Failed to fetch rooms");
        console.error(error);
      } else if (data) {
        setRooms(data as Room[]);
      }
    };
    fetchRooms();
  }, []);

  const handleJoinRoom = async (roomCode: string) => {
    if (!nickname) {
      toast.error("Set your nickname first.");
      return;
    }

    try {
      // 🔑 Get current session
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session) throw new Error("No active session");

      const res = await fetch(`${LOCAL_EDGE_URL}/join-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomCode, playerName: nickname }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { room, player } = await res.json();
      localStorage.setItem("playerId", player.id);
      localStorage.setItem("roomId", room.id);

      toast.success(`Joined room ${room.code}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to join room");
    }
  };

  if (loading) return <p>Loading nickname...</p>;

  return (
    <div className="p-4 text-white">
      <h2 className="font-bold mb-2">Lobbies</h2>
      <ul className="space-y-2">
        {rooms.map((r) => (
          <li
            key={r.id}
            className="border rounded p-2 flex justify-between items-center"
          >
            <div>
              <p>Code: {r.code}</p>
              <p>Status: {r.started ? "In Progress" : "Waiting"}</p>
            </div>
            {!r.started && (
              <button
                className="px-3 py-1 bg-green-500 rounded"
                onClick={() => handleJoinRoom(r.code)}
              >
                Join
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
