import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "./Card";
import type { CardColor, CardValue } from "./Card";
import { PlayerHand } from "./PlayerHand";
import { Clock } from "lucide-react";
import Header from "./Header";

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
  const [isDark, setIsDark] = useState(false); // default: light mode

  useEffect(() => {
    const interval = setInterval(() => {
      setTurnTimer((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
    document.documentElement.classList.toggle("dark", !isDark);
  };

  const handleCardPlay = (playerIndex: number, cardIndex: number) => {
    console.log(`Player ${playerIndex} played card ${cardIndex}`);
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden transition-colors ${isDark ? "dark" : "bg-green-100"}`}>
      {/* Header overlay */}
      <div className="absolute top-0 left-0 w-full z-50">
        <Header isDark={isDark} toggleTheme={toggleTheme} />
      </div>

      {/* Table background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-green-800 to-green-900 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.15) 10px, rgba(0,0,0,.1) 20px)",
            }}
          ></div>
        </div>
      </div>

      {/* Game area */}
      <div className="relative w-full h-full flex items-center justify-center p-8 pt-20">
        {/* Top player */}
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-gray-900 dark:text-white">
          <PlayerHand cards={topPlayer} position="top" playerName="Player 2" />
        </div>

        {/* Left player */}
        <div className="absolute left-8 top-1/2 transform -translate-y-1/2 text-gray-900 dark:text-white">
          <PlayerHand cards={leftPlayer} position="left" playerName="Player 3" />
        </div>

        {/* Right player */}
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-900 dark:text-white">
          <PlayerHand cards={rightPlayer} position="right" playerName="Player 4" />
        </div>




        {/* Center play area */}
        <div className="flex items-center gap-8">
          {/* Draw pile */}
          <div className="relative">
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
                  <Card isFlipped={true} />
                </div>
              ))}
              <motion.div
                animate={
                  isDrawPileHovered
                    ? { boxShadow: "0 0 30px rgba(66, 184, 131, 0.6)" }
                    : { boxShadow: "0 0 20px rgba(66, 184, 131, 0.3)" }
                }
                transition={{ duration: 0.3 }}
              >
                <Card isFlipped={true} />
              </motion.div>
            </motion.div>
          </div>

          {/* Discard pile */}
          <div className="relative">
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.1, rotate: 2 }}
              transition={{ duration: 0.3 }}
            >
              <Card color={discardPile.color} value={discardPile.value} className="shadow-2xl" />
            </motion.div>
          </div>
        </div>

        {/* Current player */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-gray-900 dark:text-white">
          <PlayerHand
            cards={currentPlayer}
            isCurrentPlayer={true}
            onCardPlay={(cardIndex) => handleCardPlay(0, cardIndex)}
          />
        </div>
      </div>

      {/* Turn timer overlay */}
      <div className="absolute top-24 right-4 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md rounded-lg px-4 py-3 shadow-lg border-2 border-green-400 dark:border-primary/30 z-40">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="text-xs font-medium mb-1 text-gray-100/70 dark:text-white/70">Your Turn</div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-200 dark:text-white" />
              <motion.div
                className="text-2xl font-bold text-white dark:text-white"
                animate={{
                  scale: turnTimer <= 10 && turnTimer % 2 === 0 ? 1.1 : 1,
                  color:
                    turnTimer <= 10
                      ? isDark
                        ? "hsl(0, 80%, 70%)"
                        : "hsl(0, 80%, 50%)"
                      : undefined,
                }}
                transition={{ duration: 0.2 }}
              >
                {turnTimer}s
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
