import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { VisibleCard } from "../lib/types";
type CardSide = "light" | "dark";

export function useRoomRealtime(roomId?: string) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isHost, setIsHost] = useState(false);
  const [started, setStarted] = useState(false);

  const [currentCard, setCurrentCard] = useState<VisibleCard | null>(null);

  // -----------------------------------------------------
  // 1) INITIAL LOAD — room, is_host, started, current_card
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomId) return;

    const load = async () => {
      setLoading(true);

      const user = (await supabase.auth.getUser()).data.user;

      // Fetch full room row
      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (roomData) {
        setRoom(roomData);
        setStarted(roomData.started_game);

        // Fetch card if exists
        if (roomData.current_card) {
          await fetchCard(roomData);
        }
      }

      // Fetch is_host
      if (user) {
        const { data: rp } = await supabase
          .from("room_players")
          .select("is_host")
          .eq("room_id", roomId)
          .eq("player_id", user.id)
          .maybeSingle();

        setIsHost(rp?.is_host ?? false);
      }

      setLoading(false);
    };

    load();
  }, [roomId]);

  // -----------------------------------------------------
  // Helper: Fetch and set card
  // -----------------------------------------------------
  const fetchCard = async (cardId: string) => {
    const { data: cardData } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .maybeSingle();

    if (!cardData) return;

    // Base card object
    const card: VisibleCard = {
      light: {
        color: cardData.light_color ?? "black",
        value: cardData.light_value ?? null,
      },
      dark: {
        color: cardData.dark_color ?? "black",
        value: cardData.dark_value ?? null,
      },
    };

    // Get which side is active
    const side = room?.current_side as CardSide ?? "light";
    const active = card[side];

    // 🚨 If card value begins with "wild", force color = wildColor
    if (active.value && active.value.startsWith("wild")) {
      card[side].color = room?.wild_color ?? "black";
    }

    setCurrentCard(card);
  };

  // -----------------------------------------------------
  // 2) REALTIME SUB — react to all room changes (including current_card)
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}-merged`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          void (async () => {
            const newRoom = payload.new;
            const oldRoom = payload.old;

            setRoom(newRoom);

            if (!started && newRoom.started_game) {
              toast.success("Game started!");
              setStarted(true);
            }
            if (!newRoom.started_game) {
              setStarted(false);
            }

            if (newRoom.current_card !== oldRoom.current_card) {
              if (newRoom.current_card) {
                await fetchCard(newRoom.current_card);
              } else {
                setCurrentCard(null);
              }
            }
          })();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, started]);

  // -----------------------------------------------------
  // RETURN MERGED RESULT
  // -----------------------------------------------------
  document.documentElement.classList.toggle(
    "dark",
    room?.current_side === "dark",
  );
  return {
    loading,
    room,
    isHost,
    started,

    activePlayerId: room?.turn_player_id ?? null,
    currentSide: room?.current_side as CardSide ?? "light",
    currentCardId: room?.current_card ?? null,

    currentCard,
    setCurrentCard,

    winner: room?.winner_id ?? null,
  };
}
