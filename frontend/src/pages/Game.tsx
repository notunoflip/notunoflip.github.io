import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GameTable } from "../components/GameTable";
import GameWaiting from "../components/GameWaiting";
import type { Session } from "@supabase/supabase-js";
import type { PlayerCard, VisibleCard } from "../lib/types";

const LOCAL_EDGE_URL = import.meta.env.VITE_EDGE_URL;

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();

  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [tableCards, setTableCards] = useState<PlayerCard[]>([]);

  const navigate = useNavigate();

  // ✅ Check if player is host and if game started
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
        console.error("Error checking room:", error);
        toast.error("Failed to fetch room status");
      } else if (!data) {
        toast.error("Room not found");
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

  // ✅ Listen for game start in realtime
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

    return () => supabase.removeChannel(channel);
  }, [roomId, started]);

  // ✅ Fetch all table cards (your hand + others’ visible cards)
  useEffect(() => {
    const fetchTableCards = async () => {
      if (!session || !started || !roomId) return;

      const { data, error } = await supabase
        .from("secure_room_cards")
        .select("room_card_id, owner_id, nickname, visible_card")
        .eq("room_id", roomId);

      if (error) {
        console.error("Error fetching table cards:", error);
        toast.error("Could not fetch table cards");
        return;
      }

      if (!data?.length) {
        console.warn("No cards found for this room");
        return;
      }

      // ✅ Normalize all visible_card objects to have full structure
      const formatted: PlayerCard[] = data.map((c: any) => {
        const vc = c.visible_card ?? {};
        const visible_card: VisibleCard = {
          light: {
            color: vc.light?.color ?? "black",
            value: vc.light?.value ?? null,
          },
          dark: {
            color: vc.dark?.color ?? "black",
            value: vc.dark?.value ?? null,
          },
        };
        return { ...c, visible_card };
      });

      setTableCards(formatted);
    };

    fetchTableCards();
  }, [started, session, roomId]);

  // ✅ Host starts game
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

      if (!res.ok) throw new Error(await res.text());
      toast.success("Game started!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setStarting(false);
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
                disabled={starting}
                className={`px-5 py-2 rounded-xl shadow-md transition ${
                  starting
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

  // ✅ Game table (main gameplay)
  return (
    <div className="pt-16">
      <GameTable
        cards={tableCards}
        currentUserId={session.user.id}
        discardPile={{ color: "red", value: "3" }}
        onDrawCard={() => toast.info("Draw card pressed")}
      />
    </div>
  );
}
