import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GameTable } from "./components/GameTable";
import GameWaiting from "./components/GameWaiting";
import type { Session } from "@supabase/supabase-js";
import type { PlayerCard } from "./lib/types";

const LOCAL_EDGE_URL = import.meta.env.VITE_EDGE_URL;

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();

  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentPlayerCards, setCurrentPlayerCards] = useState<PlayerCard[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const checkRoomStatus = async () => {
      if (!session || !roomId) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("room_players")
        .select("is_host, rooms(started_game)")
        .eq("room_id", roomId)
        .eq("player_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking host/started status:", error);
        toast.error("Failed to fetch room status");
      } else if (!data) {
        // ❌ Room doesn't exist → redirect to lobby
        toast.error("Room not found, returning to lobby");
        navigate("/");
        return;
      } else {
        setIsHost(!!data.is_host);
        // @ts-ignore
        setStarted(!!data.rooms?.started_game);
      }

      setLoading(false);
    };

    checkRoomStatus();
  }, [session, roomId, navigate]);


  // Subscribe to changes in rooms.started_game
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new.started_game && !started) {
            toast.success("Game started!");
            setStarted(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, started]);

  // Fetch player hand once game is started
  // Fetch player hands once game is started
  useEffect(() => {
    const fetchPlayerHand = async () => {
      if (!session || !started || !roomId) return;

      const { data, error } = await supabase
        .from("secure_room_cards")
        .select("room_card_id, owner_id, nickname, visible_card")
        .eq("room_id", roomId);

      if (error) {
        console.error("Error fetching hands:", error);
        toast.error("Could not fetch cards");
        return;
      }

      if (!data || data.length === 0) {
        console.warn("No cards found for this room");
        return;
      }

      console.log(data)

      // ✅ Map raw DB response into `PlayerCard` format
      const formatted = (data as PlayerCard[]).map((c) => {
        // Ensure visible_card structure is normalized
        let normalizedVisible;
        if ("side" in c.visible_card) {
          normalizedVisible = c.visible_card; // single side
        } else {
          normalizedVisible = {
            dark: {
              color: c.visible_card.dark?.color ?? null,
              value: c.visible_card.dark?.value ?? null,
            },
            light: {
              color: c.visible_card.light?.color ?? null,
              value: c.visible_card.light?.value ?? null,
            },
          };
        }

        return {
          ...c,
          visible_card: normalizedVisible,
        };
      });

      // ✅ Pass full deck of all players' visible cards to GameTable
      setCurrentPlayerCards(formatted);
    };

    fetchPlayerHand();
  }, [started, session, roomId]);


  // Start Game handler (host only)
  const handleStartGame = async () => {
    if (!session || !roomId) return;
    setStarting(true);

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
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

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to start game");
      }

      toast.success("Game started!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  // Loading state
  if (loading || !session || !roomId) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600 dark:text-gray-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading...
      </div>
    );
  }

  // Waiting Room (before start)
  if (!started) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-5 border border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-center">Waiting Room</h1>
          <GameWaiting roomId={roomId} />

          {isHost && (
            <div className="pt-4 text-center">
              <button
                onClick={handleStartGame}
                disabled={starting}
                className={`px-5 py-2 rounded-xl shadow-md transition ${starting
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
              >
                {starting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" /> Starting...
                  </span>
                ) : (
                  "Start Game"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Game UI (after start)
  return (
    <GameTable
      cards={currentPlayerCards}
      currentUserId={session.user.id}
      discardPile={{ color: "red", value: "3" }}
      onDrawCard={() => toast.info("Draw card pressed (hook later)")}
    />

  );
}
