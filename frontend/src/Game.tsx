import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import RoomWaiting from "./components/RoomWaiting";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { toast } from "sonner"; // or your toast library

const LOCAL_EDGE_URL = import.meta.env.VITE_EDGE_URL;

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();

  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // ✅ Check if current player is host
  useEffect(() => {
    const checkHostStatus = async () => {
      if (!session || !roomId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("room_players")
        .select("is_host")
        .eq("room_id", roomId)
        .eq("player_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking host status:", error);
        setLoading(false);
        return;
      }

      setIsHost(!!data?.is_host);
      setLoading(false);
    };

    checkHostStatus();
  }, [session, roomId]);

  // ✅ Handle starting the game
  const handleStartGame = async () => {
    if (!session || !roomId) return;
    setStarting(true);

    try {
      // 🔑 Get current session (re-verify)
      const {
        data: { session: activeSession },
        error: sessionErr,
      } = await supabase.auth.getSession();
      if (sessionErr || !activeSession) throw new Error("No active session");

      toast.info("Starting game...");

      // 🚀 Call Edge Function
      const res = await fetch(`${LOCAL_EDGE_URL}/start-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`,
        },
        body: JSON.stringify({ room_id: roomId, cards_per_player: 7 }),
      });


      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to start game");
      }

      const { error } = await res.json();
      if (error) throw new Error(error);

      toast.success("Game started!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  // 🌀 Loading states
  if (!session || !roomId) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600 dark:text-gray-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600 dark:text-gray-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Checking room status...
      </div>
    );
  }

  // 🎮 UI
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-5 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-center">Waiting Room</h1>
        <RoomWaiting roomId={roomId} />

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
