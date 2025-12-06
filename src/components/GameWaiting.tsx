import { useEffect } from "react";
import { Loader2, Crown, Trophy, Copy, User } from "lucide-react";
import { Card } from "./Card";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { useRoomPlayers } from "../hooks/useRoomPlayers";

interface GameWaitingProps {
  roomId: string;
  winner?: any;          // winner object from useWinner()
  currentCard?: any;     // visible current card
  currentSide?: "light" | "dark";
}

export default function GameWaiting({
  roomId,
  winner,
  currentCard,
  currentSide,
}: GameWaitingProps) {
  const navigate = useNavigate();
  const roomUrl = `unoflip.site/room/${roomId}`;

  const { players, loading, error } = useRoomPlayers(roomId);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(roomUrl);
    toast.success("Room link copied!");
  };

  // 🎉 Confetti when winner changes
  useEffect(() => {
    if (!winner) return;

    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.3 },
    });
  }, [winner]);

  // Error handling
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-gray-500">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading players...
      </div>
    );
  }

  if (players.length === 0) {
    toast.error("No players found in the room.");
    navigate("/");
  }

  return (
    <div>
      {/* --- COPY URL BAR --- */}
      <div className="flex items-center gap-3 bg-gray-100 px-3 py-1 my-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <input
          type="text"
          value={roomUrl}
          readOnly
          className="flex-1 bg-transparent text-sm px-2 py-1 outline-none overflow-hidden text-ellipsis"
        />

        <button
          onClick={copyUrl}
          className="flex items-center gap-1 px-3 py-2 rounded-md bg-green-100 text-white text-sm hover:bg-white transition"
        >
          <Copy className="w-4 h-4 mr-1 text-green-500" />
        </button>
      </div>

      {/* --- PLAYER LIST + WINNING CARD --- */}
      <div className="flex items-start gap-3">
        {/* LEFT — player list */}
        <ul
          className="flex-1 divide-y divide-gray-200 dark:divide-gray-700 rounded-lg 
                   border border-gray-200 dark:border-gray-800 overflow-hidden"
        >
          {players.map((p) => (
            <li
              key={p.player_id}
              className={`flex items-center justify-between px-4 py-3 transition relative overflow-hidden
                hover:bg-gray-50 dark:text-gray-800 dark:hover:bg-gray-300
                ${
                  winner === p.player_id
                    ? `before:absolute before:inset-1 before:rounded-md
                       before:bg-yellow-200 before:blur-lg before:opacity-40 before:-z-10
                       animate-pulse`
                    : ""
                }`}
            >
              <span className="font-medium flex items-center gap-2">
                <User className="w-6 h-6 text-gray-900 dark:text-gray-800" />
                {p.players.nickname}
                {winner === p.player_id && (
                  <Trophy className="w-4 h-4 mr-1 text-yellow-500" />
                )}
              </span>

              {p.is_host && (
                <div className="flex items-center text-yellow-500 text-sm">
                  <Crown className="w-4 h-4 mr-1" />
                  Host
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* RIGHT — winning card */}
        {winner && currentCard && (
          <div className="shrink-0 m-1">
            <Card
              lightColor={currentCard.light.color}
              lightValue={currentCard.light.value}
              darkColor={currentCard.dark.color}
              darkValue={currentCard.dark.value}
              isDarkSide={currentSide === "dark"}
              showBothSides
              className="scale-110"
            />
          </div>
        )}
      </div>
    </div>
  );
}
