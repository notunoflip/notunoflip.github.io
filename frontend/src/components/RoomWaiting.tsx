import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Loader2, Crown } from "lucide-react";

interface RoomPlayer {
  player_id: string;
  is_host: boolean;
  players: { nickname: string };
}

export default function RoomWaiting({ roomId }: { roomId: string }) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const fetchPlayers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("room_players")
        .select("player_id,is_host,players(nickname)")
        .eq("room_id", roomId);

      if (error) {
        console.error("Failed to fetch players:", error);
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((p: any) => ({
        player_id: p.player_id,
        is_host: p.is_host,
        players: p.players ?? { nickname: "Unknown" },
      }));

      setPlayers(mapped);
      setLoading(false);
    };

    fetchPlayers();

    const channel = supabase
      .channel(`room_players:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        fetchPlayers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-gray-500">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading players...
      </div>
    );
  }

  if (players.length === 0) {
    return <p className="text-center text-gray-500">No players joined yet.</p>;
  }
  

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {players.map((p) => (
        <li
          key={p.player_id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          <span className="font-medium">{p.players.nickname}</span>
          {p.is_host && (
            <div className="flex items-center text-yellow-500 text-sm">
              <Crown className="w-4 h-4 mr-1" />
              Host
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
