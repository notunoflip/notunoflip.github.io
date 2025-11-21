import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { PlayerCard } from "../lib/types";

export function useTableCards(session: any, roomId?: string, started?: boolean) {
  const [tableCards, setTableCards] = useState<PlayerCard[]>([]);

  useEffect(() => {
    if (!session || !roomId || !started) return;

    const formatCard = (c: any): PlayerCard => {
      const vc = c.visible_card ?? {};
      const def = { color: "black", value: null };
      let light = def;
      let dark = def;

      if (vc.light || vc.dark) {
        light = { color: vc.light?.color ?? "black", value: vc.light?.value ?? null };
        dark = { color: vc.dark?.color ?? "black", value: vc.dark?.value ?? null };
      } else if (vc.side === "light" || vc.side === "dark") {
        const sideData = { color: vc.color ?? "black", value: vc.value ?? null };
        if (vc.side === "light") light = sideData;
        else dark = sideData;
      }

      return { ...c, visible_card: { light, dark } };
    };

    // Fetch table cards from the secure view
    const fetchTableCards = async () => {
      const { data, error } = await supabase
        .from("secure_room_cards")
        .select("room_card_id, owner_id, nickname, visible_card")
        .eq("room_id", roomId);

      if (error) return toast.error("Could not fetch table cards");
      setTableCards(data.map(formatCard));
    };

    // Initial fetch
    fetchTableCards();

    // Subscribe to changes on the underlying room_cards table
    const channel = supabase
      .channel(`room-${roomId}-cards`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "room_cards",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Refetch from the secure view whenever room_cards changes
          // This ensures we always get properly secured data
          await fetchTableCards();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, roomId, started]);

  return { tableCards, setTableCards };
}