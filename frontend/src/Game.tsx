// Game.tsx
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import RoomWaiting from "./components/RoomWaiting";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleStartGame = () => {
    navigate(`/game/${roomId}/board`);
  };

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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-5 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-center">Waiting Room</h1>
        <RoomWaiting roomId={roomId} />

        {isHost && (
          <div className="pt-4 text-center">
            <button
              onClick={handleStartGame}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md transition"
            >
              Start Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
