import { useOutletContext, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

import { GameTable } from "../components/GameTable";
import GameWaiting from "../components/GameWaiting";

import type { Session } from "@supabase/supabase-js";
import { getFanStyle, type CardColor, type PlayerCard } from "../lib/types";

import { useRoomCards } from "../hooks/useRoomCards";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { useState } from "react";
import Modal from "../components/Modal";
import { Card } from "../components/Card";
import { motion } from "framer-motion";


const LOCAL_EDGE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();


  const {
    loading,
    started,
    isHost,
    activePlayerId,
    currentSide,
    currentCard,
    winner,
  } = useRoomRealtime(roomId);

  const { tableCards, previewCard } = useRoomCards(session, roomId, started);

  const [showWildModal, setShowWildModal] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<PlayerCard | null>(null);



  // ✅ Host starts game
  const handleStartGame = async () => {
    if (!session || !roomId) return;

    try {
      const { data: sessionData, error: sessionErr } = await fetchSession();
      if (sessionErr || !sessionData?.session) throw new Error("No active session");

      toast.info("Starting game...");
      const res = await fetch(`${LOCAL_EDGE_URL}/start-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ room_id: roomId, cards_per_player: 7 }),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success("Game started!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    }
  };

  // ✅ Play a card
  const handlePlayCard = (roomCard: PlayerCard) => {
    if (!session || !roomId) return;
    if (activePlayerId !== session.user.id) return toast.error("Not your turn!");

    const side = currentSide as "light" | "dark";
    const value = roomCard.visible_card[side]?.value;

    const isWild =
      value === "wild" ||
      value === "wild_draw_two" ||
      value === "wild_draw_until";

      if (isWild) {
        setPendingWildCard(roomCard);
        setShowWildModal(true)
      return;
    }

    // Normal card play
    playCardRPC(roomCard, null);
  };


  const playCardRPC = async (roomCard: PlayerCard, chosenColor: string | null) => {
    if (!roomId) return;

    try {
      const { error } = await supabase.rpc("fn_play_card", {
        p_room: roomId,
        p_room_card: roomCard.room_card_id,
        p_chosen_color: chosenColor,
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to play card");
    } finally {
      setPendingWildCard(null);
    }
  };




  // ✅ Draw a card
  const handleDrawCard = async () => {
    if (!session || !roomId) return;
    if (activePlayerId !== session.user.id) return toast.error("Not your turn!");

    try {
      const { error } = await supabase.rpc("fn_draw_card", {
        p_room: roomId,
      });
      if (error) throw error;

      // toast.success("Card drawn!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to draw card");
    }
  };

  // ✅ Loading screen
  if (loading || !session || !roomId)
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading...
      </div>
    );

  // ✅ Waiting room
  if (!started || winner)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl shadow-xl p-6 space-y-5 bg-gray-100 text-black border border-gray-200">
          <h1 className="text-2xl font-bold text-center">Waiting Room</h1>
          <GameWaiting
            roomId={roomId}
            winner={winner}
            currentCard={currentCard}
            currentSide={currentSide}
          />

          {isHost && (
            <div className="pt-4 text-center">
              <button
                onClick={handleStartGame}
                className="px-5 py-2 rounded-xl shadow-md bg-green-600 hover:bg-green-700 text-white"
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      </div>
    );

  // ✅ Game table (main gameplay)
  return (
    <div className="pt-16">

        <Modal
          open={showWildModal}
          onClose={() => {
            setShowWildModal(false);
            setPendingWildCard(null);
          }}
        >
          <h2 className="text-xl font-bold text-center mb-4">Choose a Color</h2>

          <div className="relative h-36">
            {["red", "yellow", "green", "blue"].map((color, index, arr) => {
              const { rotation, offsetX } = getFanStyle(index, arr.length, 60);

              return (
                <motion.div
                  key={color}
                  className="absolute top-0 cursor-pointer"
                  style={{ left: "42%" }}
                  initial={{ y: -50, scale: 0.8, opacity: 0 }}
                  animate={{ y: 0, scale: 1, opacity: 1, rotate: rotation, x: offsetX }}
                  whileHover={{ scale: 1.1, y: -10, zIndex: 10 }}
                  onClick={() => {
                    if (!pendingWildCard) return;
                    playCardRPC(pendingWildCard, color);
                    setShowWildModal(false);
                  }}
                >
                  <Card
                    lightColor={color as CardColor}
                    lightValue="wild"
                    darkColor={color as CardColor}
                    darkValue="wild"
                    isHoverable={false}
                    showBothSides={true}
                    isDarkSide={currentSide === "dark"}
                    rotation={0} // rotation handled by motion.div
                  />
                </motion.div>
              );
            })}
          </div>
        </Modal>





      <GameTable
        cards={tableCards}
        currentUserId={session.user.id}
        drawCardTop={previewCard}
        currentCard={currentCard}
        activePlayerId={activePlayerId ?? undefined}
        isDarkSide={currentSide === "dark"}
        onCardPlay={(card) => handlePlayCard(card)}
        onDrawCard={handleDrawCard}
      />
    </div>
  );
}

// Small helper for fetching session
async function fetchSession() {
  try {
    return await supabase.auth.getSession();
  } catch (err) {
    return { data: null, error: err };
  }
}
