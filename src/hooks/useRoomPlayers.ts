import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface RoomPlayer {
  player_id: string;
  is_host: boolean;
  players: { nickname: string };
}

export function useRoomPlayers(roomId: string) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch players once
  const fetchPlayers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("room_players")
      .select("player_id,is_host,players(nickname)")
      .eq("room_id", roomId);

    if (error) {
      console.error("Failed to fetch players:", error);
      setError(error.message);
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

  useEffect(() => {
    if (!roomId) return;

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

  return { players, loading, error };
}
