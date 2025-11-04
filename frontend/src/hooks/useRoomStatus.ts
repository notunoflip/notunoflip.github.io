import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

export function useRoomStatus(session: any, roomId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!session || !roomId) return;

    const checkRoomStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("room_players")
        .select("is_host, rooms(started_game)")
        .eq("room_id", roomId)
        .eq("player_id", session.user.id)
        .maybeSingle();

      if (error) toast.error("Failed to fetch room status");
      else if (!data) toast.error("Room not found");
      else {
        setIsHost(!!data.is_host);
        // @ts-ignore
        setStarted(!!data.rooms?.started_game);
      }

      setLoading(false);
    };

    checkRoomStatus();
  }, [session, roomId]);

  return { loading, isHost, started, setStarted };
}
