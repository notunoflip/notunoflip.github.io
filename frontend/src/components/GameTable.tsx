import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "./Card";
import type { CardColor, CardValue } from "./Card";
import { PlayerHand } from "./PlayerHand";
import { Clock } from "lucide-react";

interface GameTableProps {
  currentPlayer: { color: CardColor; value: CardValue }[];
  topPlayer: { color: CardColor; value: CardValue }[];
  leftPlayer: { color: CardColor; value: CardValue }[];
  rightPlayer: { color: CardColor; value: CardValue }[];
  discardPile: { color: CardColor; value: CardValue };
  onDrawCard?: () => void;
}

export const GameTable = ({
  currentPlayer,
  topPlayer,
  leftPlayer,
  rightPlayer,
  discardPile,
  onDrawCard,
}: GameTableProps) => {
  const [isDrawPileHovered, setIsDrawPileHovered] = useState(false);
  const [turnTimer, setTurnTimer] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setTurnTimer((t) => (t <= 1 ? 30 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCardPlay = (playerIndex: number, cardIndex: number) => {
    console.log(`Player ${playerIndex} played card ${cardIndex}`);
  };

  const timeColor = turnTimer <= 10 ? "text-red-400" : "text-white";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-green-700 via-green-800 to-green-900 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(0,0,0,0.1)_20px)]" />

      {/* Game area */}
      <div className="relative w-full h-full flex items-center justify-center p-8 pt-20">
        {/* Top / Left / Right players */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2">
          <PlayerHand cards={topPlayer} position="top" playerName="Player 2" />
        </div>
        <div className="absolute left-8 top-1/2 -translate-y-1/2">
          <PlayerHand cards={leftPlayer} position="left" playerName="Player 3" />
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <PlayerHand cards={rightPlayer} position="right" playerName="Player 4" />
        </div>

        {/* Center play area */}
        <div className="flex items-center gap-8">
          {/* Draw pile */}
          <motion.div
            className="relative cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDrawCard}
            onMouseEnter={() => setIsDrawPileHovered(true)}
            onMouseLeave={() => setIsDrawPileHovered(false)}
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 left-0"
                style={{
                  transform: `translate(${i * 2}px, ${i * 2}px)`,
                  zIndex: i,
                }}
              >
                <Card isFlipped />
              </div>
            ))}
            <motion.div
              animate={{
                boxShadow: isDrawPileHovered
                  ? "0 0 30px rgba(66, 184, 131, 0.6)"
                  : "0 0 20px rgba(66, 184, 131, 0.3)",
              }}
              transition={{ duration: 0.3 }}
            >
              <Card isFlipped />
            </motion.div>
          </motion.div>

          {/* Discard pile */}
          <motion.div animate={{ rotate: 2 }} transition={{ duration: 0.3 }}>
            <Card color={discardPile.color} value={discardPile.value} className="shadow-2xl" />
          </motion.div>
        </div>

        {/* Current player */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <PlayerHand
            cards={currentPlayer}
            isCurrentPlayer
            onCardPlay={(cardIndex) => handleCardPlay(0, cardIndex)}
          />
        </div>
      </div>

      <div className="absolute top-24 right-4 z-40 flex flex-col items-center gap-3 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md rounded-lg px-4 py-3 shadow-lg border-2 border-green-400 dark:border-primary/30">
        {/* Timer */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-green-200 dark:text-white" />
          <motion.span
            className={`text-2xl font-bold ${timeColor}`}
            animate={{
              scale: turnTimer <= 10 && turnTimer % 2 === 0 ? 1.1 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {turnTimer}s
          </motion.span>
        </div>
      </div>
    </div>
  );
};
