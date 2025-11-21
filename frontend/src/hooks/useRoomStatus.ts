import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

interface RoomStatusRow {
  is_host: boolean;
  rooms: {
    started_game: boolean;
  } | null;
}

export function useRoomStatus(session: any, roomId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [started, setStarted] = useState(false);

  // ✅ Fetch initial room status once
  useEffect(() => {
    if (!session || !roomId) return;

    const checkRoomStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("room_players")
        .select("is_host, rooms(started_game)")
        .eq("room_id", roomId)
        .eq("player_id", session.user.id)
        .maybeSingle<RoomStatusRow>();

      if (error) toast.error("Failed to fetch room status");
      else if (!data) toast.error("Room not found");
      else {
        setIsHost(!!data.is_host);
        setStarted(!!data.rooms?.started_game);
      }

      setLoading(false);
    };

    checkRoomStatus();
  }, [session, roomId]);

  // ✅ Listen for game start in realtime
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new?.started_game && !started) {
            toast.success("Game started!");
            setStarted(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, started]);

  return { loading, isHost, started, setStarted };
}
