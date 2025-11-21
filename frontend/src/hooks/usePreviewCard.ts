import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { VisibleCard } from "../lib/types";

export function usePreviewCard(roomId?: string, started?: boolean) {
  const [previewCard, setPreviewCard] = useState<VisibleCard | null>(null);

  useEffect(() => {
    if (!roomId || !started) return;

    const fetchPreviewCard = async () => {
      try {
        const { data, error } = await supabase.rpc("fn_preview_draw", { p_room: roomId });
        if (error) throw error;
        if (!data || data.length === 0) return;

        const c = data[0];
        // ✅ Build full dual-side VisibleCard
        const vc: VisibleCard = {
          light: {
            color: c.visible_side === "light" ? c.color : "black",
            value: c.visible_side === "light" ? c.value : null,
          },
          dark: {
            color: c.visible_side === "dark" ? c.color : "black",
            value: c.visible_side === "dark" ? c.value : null,
          },
        };
        setPreviewCard(vc);
      } catch (err) {
        console.error("Error fetching preview card:", err);
      }
    };

    // Initial fetch
    fetchPreviewCard();

    // Subscribe to room_cards changes (when cards are drawn from deck)
    const channel = supabase
      .channel(`room-${roomId}-preview`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_cards",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Refetch preview when deck changes
          await fetchPreviewCard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, started]);

  return { previewCard, setPreviewCard };
}