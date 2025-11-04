import { useOutletContext, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

import { GameTable } from "../components/GameTable";
import GameWaiting from "../components/GameWaiting";

import type { Session } from "@supabase/supabase-js";
import type { PlayerCard } from "../lib/types";

import { useRoomStatus } from "../hooks/useRoomStatus";
import { useGameTurn } from "../hooks/useGameTurn";
import { useTableCards } from "../hooks/useTableCards";
import { useCurrentCard } from "../hooks/useCurrentCard";
import { usePreviewCard } from "../hooks/usePreviewCard";

const LOCAL_EDGE_URL = import.meta.env.VITE_EDGE_URL;

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();

  const { loading, isHost, started, setStarted } = useRoomStatus(session, roomId);
  const { activePlayerId } = useGameTurn(roomId);
  const { tableCards } = useTableCards(session, roomId, started);
  const { currentCard } = useCurrentCard(roomId, started);
  const { previewCard } = usePreviewCard(roomId, started);

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
  const handlePlayCard = async (roomCard: PlayerCard) => {
    if (!session || !roomId) return;
    if (activePlayerId !== session.user.id) return toast.error("Not your turn!");

    try {
      console.log(roomId)
      console.log(roomCard.room_card_id)
      const { error } = await supabase.rpc("fn_play_card", {
        p_room: roomId,
        p_card: roomCard.room_card_id,
      });

      if (error) throw error;
      toast.success("Card played!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to play card");
    }
  };

  // ✅ Draw a card
  const handleDrawCard = async () => {
    if (!session || !roomId) return;
    if (activePlayerId !== session.user.id) return toast.error("Not your turn!");

    try {
      const { error } = await supabase.rpc("fn_draw", {
        p_room: roomId,
        p_n: 1,
        p_player: session.user.id,
      });
      if (error) throw error;

      toast.success("Card drawn!");
      await supabase.rpc("fn_advance_turn", { p_room: roomId });
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
  if (!started)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl shadow-xl p-6 space-y-5 bg-gray-100 text-black border border-gray-200">
          <h1 className="text-2xl font-bold text-center">Waiting Room</h1>
          <GameWaiting roomId={roomId} />
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
      <GameTable
        cards={tableCards}
        currentUserId={session.user.id}
        drawCardTop={previewCard}
        currentCard={currentCard}
        activePlayerId={activePlayerId ?? undefined}
        onCardPlay={(index) => handlePlayCard(tableCards[index])}
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
