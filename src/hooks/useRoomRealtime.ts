import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { VisibleCard } from "../lib/types";

type CardSide = "light" | "dark";

export function useRoomRealtime(roomCode?: string) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentCard, setCurrentCard] = useState<VisibleCard | null>(null);
  
  // Use ref to track current room state without causing re-renders
  const roomRef = useRef<any>(null);
  const startedRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    roomRef.current = room;
    startedRef.current = started;
  }, [room, started]);

  // -----------------------------------------------------
  // Helper: Fetch a card by ID and apply wild-color logic
  // -----------------------------------------------------
  const fetchCard = async (cardId: string, roomState: any) => {
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

    // Apply wild color
    if (active.value?.startsWith("wild")) {
      card[side].color = roomState.wild_color ?? "black";
    }

    setCurrentCard(card);
  };

  // -----------------------------------------------------
  // 1) INITIAL LOAD - Only runs once per roomCode
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

      if (roomData && mounted) {
        setRoom(roomData);
        setStarted(roomData.started_game);

        if (roomData.current_card) {
          await fetchCard(roomData.current_card, roomData);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [roomCode]); // Only depends on roomCode

  // -----------------------------------------------------
  // 2) Live room updates - Uses refs to avoid stale closures
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

          // Always update to latest data
          setRoom(newRoom);

          // Handle game start
          if (!startedRef.current && newRoom.started_game) {
            toast.success("Game started!");
            setStarted(true);
          }
          if (!newRoom.started_game && startedRef.current) {
            setStarted(false);
          }

          // Handle card changes
          if (newRoom.current_card !== oldRoom.current_card) {
            if (newRoom.current_card) {
              await fetchCard(newRoom.current_card, newRoom);
            } else {
              setCurrentCard(null);
            }
          } else if (
            newRoom.current_card &&
            (newRoom.current_side !== oldRoom.current_side ||
              newRoom.wild_color !== oldRoom.wild_color)
          ) {
            await fetchCard(newRoom.current_card, newRoom);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]); // Only depends on roomCode

  // -----------------------------------------------------
  // 3) Heartbeat - Uses refs to avoid re-creating interval
  // -----------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const tick = async () => {
      const currentRoom = roomRef.current;
      if (!currentRoom?.id) return;

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Refresh room snapshot
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .single();

      if (!data) return;

      // Check if any relevant fields changed
      const shouldUpdate =
        data.host_id !== currentRoom.host_id ||
        data.started_game !== currentRoom.started_game ||
        data.turn_player_id !== currentRoom.turn_player_id ||
        data.current_side !== currentRoom.current_side ||
        data.current_card !== currentRoom.current_card ||
        data.winner_id !== currentRoom.winner_id;

      if (shouldUpdate) {
        setRoom(data);
      }
    };

    // Run immediately, then every 10 seconds
    tick();
    const interval = setInterval(tick, 10_000);
    
    return () => clearInterval(interval);
  }, [roomCode]);

  // console.log(room)
  return {
    loading,
    room,
    hostId: room?.host_id,
    started: room?.started_game ?? false,

    roomId: room?.id ?? null,
    activePlayerId: room?.turn_player_id ?? null,
    currentSide: (room?.current_side as CardSide) ?? "light",
    currentCardId: room?.current_card ?? null,

    currentCard,
    setCurrentCard,

    winner: room?.winner_id ?? null,
  };
}