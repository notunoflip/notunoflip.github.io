import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { VisibleCard } from "../lib/types";

export function useCurrentCard(roomId?: string, started?: boolean) {
  const [currentCard, setCurrentCard] = useState<VisibleCard | null>(null);

  useEffect(() => {
    if (!roomId || !started) return;

    const fetchCurrentCard = async () => {
      try {
        const { data: discardData } = await supabase.rpc("fn_top_discard", { p_room: roomId });
        if (!discardData) return;

        const { data: cardData } = await supabase
          .from("cards")
          .select("*")
          .eq("id", discardData)
          .maybeSingle();

        if (!cardData) return;

        setCurrentCard({
          light: { color: cardData.light_color ?? "black", value: cardData.light_value ?? null },
          dark: { color: cardData.dark_color ?? "black", value: cardData.dark_value ?? null },
        });
      } catch (err) {
        console.error("Error fetching current card:", err);
      }
    };

    fetchCurrentCard();
    const interval = setInterval(fetchCurrentCard, 4000);
    return () => clearInterval(interval);
  }, [roomId, started]);

  return { currentCard, setCurrentCard };
}
