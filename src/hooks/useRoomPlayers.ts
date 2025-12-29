import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export interface RoomPlayer {
  player_id: string;
  nickname: string;
  last_seen: string;
  joined_at: string;
}

export function useRoomPlayers(roomCode: string) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  const mountedRef = useRef(true);

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
        if (mountedRef.current) {
          setError(error.message);
          setLoading(false);
        }
        return;
      }

      if (mountedRef.current && data) {
        setRoomId(data.id);
      }
    };

    resolveRoom();
  }, [roomCode]);

  // 2️⃣ Fetch players - useCallback prevents recreation
  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("room_players")
      .select("player_id,is_host,last_seen,joined_at,players(nickname)")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true }); // Sort by join order

    if (error) {
      console.error("Failed to fetch players:", error);
      if (mountedRef.current) {
        setError(error.message);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setPlayers(
        (data || []).map((p) => ({
          player_id: p.player_id,
          last_seen: p.last_seen,
          joined_at: p.joined_at,
          // @ts-ignore
          nickname: p.players?.nickname,
        }))
      );
      setLoading(false);
    }
  }, [roomId]); // Only recreate when roomId changes

  // 3️⃣ Update presence/last_seen
  useEffect(() => {
    if (!roomId) return;

    const updatePresence = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      await supabase
        .from("room_players")
        .update({ last_seen: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("player_id", user.id);
    };

    updatePresence();
    const interval = setInterval(updatePresence, 10_000);

    return () => clearInterval(interval);
  }, [roomId]);

  // 4️⃣ Fetch + realtime subscription
  useEffect(() => {
    if (!roomId) return;

    // Initial fetch
    fetchPlayers();

    // Subscribe to changes
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
        () => {
          // Callback when changes detected
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchPlayers]); // fetchPlayers is now stable via useCallback

  // Track mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { players, loading, error };
}