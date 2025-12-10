import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface RoomPlayer {
  player_id: string;
  is_host: boolean;
  players: { nickname: string }[]; // ✅ array
}


export function useRoomPlayers(roomCode: string) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  // 1️⃣ Resolve roomCode → roomId ONCE
  useEffect(() => {
    if (!roomCode) return;

    const resolveRoom = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", roomCode)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setRoomId(data.id);
    };

    resolveRoom();
  }, [roomCode]);

  // 2️⃣ Fetch players using roomId
  const fetchPlayers = async () => {
    if (!roomId) return;

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

    setPlayers(
      (data || []).map((p) => ({
        player_id: p.player_id,
        is_host: p.is_host,
        players: p.players ?? { nickname: "Unknown" },
      }))
    );

    setLoading(false);
  };

  // 3️⃣ Fetch + realtime subscription
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
