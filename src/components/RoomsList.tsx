import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { User, Play, Clock, ArrowRight } from "lucide-react";

interface Room {
  id: string;
  code: string;
  started_game: boolean;
  created_at: string;
  player_count: number;
}

export default function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const navigate = useNavigate();

  // =========================================
  // Initial Fetch
  // =========================================
  useEffect(() => {
    const fetchRooms = async (_access_token?: string) => {
      const { data, error } = await supabase
        .from("rooms")
        .select(`
          id, 
          code, 
          started_game, 
          created_at,
          room_players(count)
        `)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Failed to fetch rooms");
        console.error(error);
      } else {
        // Transform data to include player_count
        const transformedData = (data as any[]).map((room) => ({
          id: room.id,
          code: room.code,
          started_game: room.started_game,
          created_at: room.created_at,
          player_count: room.room_players[0]?.count || 0,
        }));
        setRooms(transformedData);
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
      .channel("realtime-rooms-and-players")
      .on(
        "postgres_changes",
        {
          event: "*", // listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "rooms",
        },
        async (payload) => {
          console.log("Realtime rooms change:", payload);

          // Refetch room with player count
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data } = await supabase
              .from("rooms")
              .select(`
                id, 
                code, 
                started_game, 
                created_at,
                room_players(count)
              `)
              .eq("id", payload.new.id)
              .single();

            if (data) {
              const transformedRoom = {
                id: data.id,
                code: data.code,
                started_game: data.started_game,
                created_at: data.created_at,
                player_count: (data as any).room_players[0]?.count || 0,
              };

              setRooms((current) => {
                if (payload.eventType === "INSERT") {
                  return [transformedRoom, ...current];
                } else {
                  return current.map((r) =>
                    r.id === transformedRoom.id ? transformedRoom : r
                  );
                }
              });
            }
          } else if (payload.eventType === "DELETE") {
            setRooms((current) => current.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
        },
        async (payload) => {
          console.log("Realtime room_players change:", payload);
          // Refetch the affected room's player count
          const roomId = (payload.new as any)?.room_id || (payload.old as any)?.room_id;
          if (roomId) {
            const { data } = await supabase
              .from("rooms")
              .select(`
                id, 
                code, 
                started_game, 
                created_at,
                room_players(count)
              `)
              .eq("id", roomId)
              .single();

            if (data) {
              const transformedRoom = {
                id: data.id,
                code: data.code,
                started_game: data.started_game,
                created_at: data.created_at,
                player_count: (data as any).room_players[0]?.count || 0,
              };

              setRooms((current) =>
                current.map((r) => (r.id === roomId ? transformedRoom : r))
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 mx-auto text-gray-100 mb-3" />
        <p className="text-gray-200">No rooms available</p>
        <p className="text-sm text-gray-200 mt-1">Create one to get started</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {rooms.map((r) => (
          <div
            key={r.id}
            className="bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all"
          >
            {/* Room Code & Player Count */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-400 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  {r.started_game ? (
                    <Play className="w-5 h-5" />

                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Room Code</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {r.code}
                  </p>
                </div>
              </div>

              {/* Player Count - Right aligned */}
              <div className="flex items-center gap-1">
                {Array.from({ length: r.player_count }).map((_, i) => (
                  <User key={i} className="w-4 h-4 text-black dark:text-green-400" />
                ))}
              </div>
            </div>

            <p className="text-s font-bold text-gray-400 dark:text-gray-800 mb-4">
              Created{" "}
              {new Date(r.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}

            </p>



            {/* Join Button */}
            {!r.started_game && (
              <button
                onClick={() => navigate(`/room/${r.code}`)}
                className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                Join Room
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {r.started_game && (
              <button
                disabled
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 py-2.5 rounded-lg font-medium cursor-not-allowed"
              >
                Game in Progress
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}