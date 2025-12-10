import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { VisibleCard } from "../lib/types";

type CardSide = "light" | "dark";

export function useRoomRealtime(roomCode?: string) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isHost, setIsHost] = useState(false);
  const [started, setStarted] = useState(false);

  const [currentCard, setCurrentCard] = useState<VisibleCard | null>(null);

  // -----------------------------------------------------
  // Helper: Fetch a card by ID and apply wild-color logic
  // -----------------------------------------------------
  const fetchCard = async (cardId: string, roomState: any) => {
    const { data: cardData } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .maybeSingle();

    if (!cardData) return;

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

    const side = roomState.current_side as CardSide ?? "light";
    const active = card[side];

    // Apply wild color
    if (active.value?.startsWith("wild")) {
      card[side].color = roomState.wild_color ?? "black";
    }

    setCurrentCard(card);
  };

  // -----------------------------------------------------
  // 1) INITIAL LOAD
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const load = async () => {
      setLoading(true);

      const user = (await supabase.auth.getUser()).data.user;

      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();

      if (roomData) {
        setRoom(roomData);
        setStarted(roomData.started_game);

        if (roomData.current_card) {
          await fetchCard(roomData.current_card, roomData);
        }
      }

      if (user) {
        const { data: rp } = await supabase
          .from("room_players")
          .select("is_host")
          .eq("room_id", roomData.id)
          .eq("player_id", user.id)
          .maybeSingle();

        setIsHost(rp?.is_host ?? false);
      }

      setLoading(false);
    };

    load();
  }, [roomCode]);

  // -----------------------------------------------------
  // 2) Live room updates
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase
      .channel(`room-${roomCode}-merged`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        async (payload) => {
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

          // If the card ID changed → fetch new card
          if (newRoom.current_card !== oldRoom.current_card) {
            if (newRoom.current_card) {
              await fetchCard(newRoom.current_card, newRoom);
            } else {
              setCurrentCard(null);
            }
            return;
          }

          // Even if card ID didn't change:
          // wild_color OR current_side may change → update card appearance
          const wildChanged = newRoom.wild_color !== oldRoom.wild_color;
          const sideChanged = newRoom.current_side !== oldRoom.current_side;

          if ((wildChanged || sideChanged) && newRoom.current_card) {
            await fetchCard(newRoom.current_card, newRoom);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, started]);

  document.documentElement.classList.toggle(
    "dark",
    room?.current_side === "dark"
  );

  return {
    loading,
    room,
    isHost,
    started: room?.started_game ?? false,

    roomId: room?.id ?? null,
    activePlayerId: room?.turn_player_id ?? null,
    currentSide: room?.current_side as CardSide ?? "light",
    currentCardId: room?.current_card ?? null,

    currentCard,
    setCurrentCard,

    winner: room?.winner_id ?? null,
  };
}
