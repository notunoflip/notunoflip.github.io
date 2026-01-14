import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { VisibleCard } from "../lib/types";

type CardSide = "light" | "dark";

export function useRoomRealtime(roomCode?: string) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentCard, setCurrentCard] = useState<VisibleCard | null>(null);

  // -----------------------------------------------------
  // Refs (prevent stale closures)
  // -----------------------------------------------------
  const roomRef = useRef<any>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
    startedRef.current = started;
  }, [room, started]);

  // -----------------------------------------------------
  // Helper: Fetch card + apply wild color
  // -----------------------------------------------------
  const fetchCard = async (cardId: string, roomState: any) => {
    if (!cardId) return;

    const { data: cardData } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

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

    const side = (roomState.current_side as CardSide) ?? "light";
    const active = card[side];

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

    let mounted = true;

    const load = async () => {
      setLoading(true);

      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .single();

      if (!mounted || !roomData) return;

      setRoom(roomData);
      setStarted(roomData.started_game);

      if (roomData.current_card) {
        await fetchCard(roomData.current_card, roomData);
      }

      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [roomCode]);

  // -----------------------------------------------------
  // 2) REALTIME (authoritative)
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        async ({ new: newRoom, old: oldRoom }) => {
          setRoom(newRoom);

          // Game start / stop
          if (!startedRef.current && newRoom.started_game) {
            toast.success("Game started!");
            setStarted(true);
            window.location.reload();
          } else if (startedRef.current && !newRoom.started_game) {
            setStarted(false);
          }

          // Card changed
          if (newRoom.current_card !== oldRoom.current_card) {
            if (newRoom.current_card) {
              await fetchCard(newRoom.current_card, newRoom);
            } else {
              setCurrentCard(null);
            }
            return;
          }

          // Same card, visual change
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
  }, [roomCode]);

  // -----------------------------------------------------
  // 3) HEARTBEAT (safety net ONLY)
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const tick = async () => {
      const currentRoom = roomRef.current;
      if (!currentRoom?.id) return;

      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .single();

      if (!data) return;

      // Only patch if realtime missed something
      const shouldUpdate =
        data.started_game !== currentRoom.started_game ||
        data.turn_player_id !== currentRoom.turn_player_id ||
        data.current_side !== currentRoom.current_side ||
        data.current_card !== currentRoom.current_card ||
        data.winner_id !== currentRoom.winner_id ||
        data.draw_stack !== currentRoom.draw_stack;

      if (!shouldUpdate) return;

      setRoom(data);

      if (data.current_card) {
        await fetchCard(data.current_card, data);
      } else {
        setCurrentCard(null);
      }
    };

    tick();
    const interval = setInterval(tick, 30_000);

    return () => clearInterval(interval);
  }, [roomCode]);

  // -----------------------------------------------------
  // Theme sync
  // -----------------------------------------------------
  document.documentElement.classList.toggle(
    "dark",
    room?.current_side === "dark"
  );

  // -----------------------------------------------------
  // Public API
  // -----------------------------------------------------
  return {
    loading,
    room,

    started: room?.started_game ?? false,
    roomId: room?.id ?? null,
    hostId: room?.host_id ?? null,
    activePlayerId: room?.turn_player_id ?? null,
    direction: room?.direction ?? "clockwise",

    player_order: room?.player_order ?? [],

    currentSide: (room?.current_side as CardSide) ?? "light",
    currentCardId: room?.current_card ?? null,
    drawStack: room?.draw_stack ?? 0,

    currentCard,
    setCurrentCard,

    winner: room?.winner_id ?? null,
  };
}
