import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNickname } from "../hooks/useNickname";
import { toast } from "sonner";
import { useNavigate} from "react-router-dom";

interface Room {
  id: string;
  code: string;
  started_game: boolean;
  created_at: string;
}

export default function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const { nickname, loading, refreshNickname } = useNickname();
  const LOCAL_EDGE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";
  const navigate = useNavigate();

  // =========================================
  // Initial Fetch
  // =========================================
useEffect(() => {
  const fetchRooms = async (_access_token?: string) => {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, code, started_game, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch rooms");
      console.error(error);
    } else {
      setRooms(data as Room[]);
    }
  };

  const init = async () => {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;

    if (error) {
      console.error("Error fetching session:", error);
      return;
    }

    if (session) {
      fetchRooms(session.access_token);
    } else {
      // Listen for login event
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session) {
            fetchRooms(session.access_token);
          }
        }
      );

      return () => listener.subscription.unsubscribe();
    }
  };

  init();
}, []);

  // =========================================
  // Realtime Subscriptions
  // =========================================
  useEffect(() => {
    const channel = supabase
      .channel("realtime-rooms")
      .on(
        "postgres_changes",
        {
          event: "*", // listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "rooms",
        },
        (payload) => {
          console.log("Realtime change:", payload);

          setRooms((current) => {
            switch (payload.eventType) {
              case "INSERT":
                return [payload.new as Room, ...current];

              case "UPDATE":
                return current.map((r) =>
                  r.id === payload.new.id ? (payload.new as Room) : r
                );

              case "DELETE":
                return current.filter((r) => r.id !== payload.old.id);

              default:
                return current;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // =========================================
  // Join Room Handler
  // =========================================
  const handleJoinRoom = async (roomCode: string) => {
    if (!nickname) {
      // toast.error("Set your nickname first.");
      refreshNickname();
      return;
    }

    try {
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session) throw new Error("No active session");

      toast.info("Joining room...");

      const res = await fetch(`${LOCAL_EDGE_URL}/join-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomCode, playerName: nickname }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { room } = await res.json();

      // const { room, playerId } = await res.json();
      // localStorage.setItem("playerId", playerId);
      // localStorage.setItem("roomId", room.id);

      toast.success(`Joined room ${room.code}`);
      navigate(`/room/${room.id}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to join room");
    }
  };

  if (loading) return <p>Loading ...</p>;

  // =========================================
  // Render
  // =========================================
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
              <p>Status: {r.started_game ? "In Progress" : "Waiting"}</p>
            </div>
            {!r.started_game && (
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
