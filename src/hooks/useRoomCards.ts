import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { VisibleCard, PlayerCard } from "../lib/types";

export function useRoomCards(session: any, roomId?: string, started?: boolean) {
  const [previewCard, setPreviewCard] = useState<VisibleCard | null>(null);
  const [tableCards, setTableCards] = useState<PlayerCard[]>([]);

  // --- FETCH PREVIEW CARD ---
  const fetchPreviewCard = useCallback(async () => {
    if (!roomId || !started) return;

    try {
      const { data, error } = await supabase.rpc("fn_preview_draw", { p_room: roomId });
      if (error) throw error;
      if (!data || data.length === 0) return;

      const c = data[0];
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
  }, [roomId, started]);

  // --- FORMAT TABLE CARD ---
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

  // --- FETCH TABLE CARDS ---
  const fetchTableCards = useCallback(async () => {
    if (!roomId || !session || !started) return;

    const { data, error } = await supabase
      .from("secure_room_cards")
      .select("room_card_id, owner_id, nickname, visible_card")
      .eq("room_id", roomId);

    if (error) {
      toast.error("Could not fetch table cards");
      return;
    }

    setTableCards(data.map(formatCard));
  }, [roomId, session, started]);

  // --- SET UP SHARED REALTIME CHANNEL ---
  useEffect(() => {
    if (!roomId || !started) return;

    // Initial fetch
    fetchPreviewCard();
    fetchTableCards();

    // ONE channel for both hooks
    const channel = supabase
      .channel(`room-${roomId}-cards-shared`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_cards",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // both dependent on room_cards
          await fetchPreviewCard();
          await fetchTableCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, started, fetchPreviewCard, fetchTableCards]);

  return {
    previewCard,
    tableCards,
    setPreviewCard,
    setTableCards,
  };
}
