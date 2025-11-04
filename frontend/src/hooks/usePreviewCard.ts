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
        // console.log(vc)

        setPreviewCard(vc);
      } catch (err) {
        console.error("Error fetching preview card:", err);
      }
    };

    fetchPreviewCard();
    const interval = setInterval(fetchPreviewCard, 4000);
    return () => clearInterval(interval);
  }, [roomId, started]);

  return { previewCard, setPreviewCard };
}
