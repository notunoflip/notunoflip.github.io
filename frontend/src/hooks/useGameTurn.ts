import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useGameTurn(roomId?: string) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const fetchTurn = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("turn_player_id")
        .eq("id", roomId)
        .maybeSingle();
      
      if (data?.turn_player_id) setActivePlayerId(data.turn_player_id);
    };

    // Initial fetch
    fetchTurn();

    // Subscribe to turn changes
    const channel = supabase
      .channel(`room-${roomId}-turn`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "rooms", 
          filter: `id=eq.${roomId}` 
        },
        (payload) => {
          if (payload.new.turn_player_id) {
            setActivePlayerId(payload.new.turn_player_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { activePlayerId, setActivePlayerId };
}