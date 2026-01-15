import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { getFanStyle, type PlayerCard } from "../lib/types";

interface PlayerHandProps {
  player: {
    id: string;
    nickname: string;
    cards: PlayerCard[];
  };
  isCurrent: boolean;
  isActive: boolean;
  inactive: boolean;
  isDarkSide: boolean;
  position: { translateX: number; translateY: number; rotation: number };
  onPlayCard?: (card: PlayerCard) => void;
}

export function PlayerHand({
  player,
  isCurrent,
  isActive,
  inactive,
  isDarkSide,
  position,
  onPlayCard,
}: PlayerHandProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showUnoPop, setShowUnoPop] = useState(false);
  const unoTriggeredRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isUno = player.cards.length === 1;

  useEffect(() => {
    if (isUno && !unoTriggeredRef.current) {
      unoTriggeredRef.current = true;
      setShowUnoPop(true);
      const t = setTimeout(() => setShowUnoPop(false), 1500);
      return () => clearTimeout(t);
    }
    if (!isUno) unoTriggeredRef.current = false;
  }, [isUno]);

  const handleCardClick = (_index: number, card: PlayerCard) => {
    if (!isCurrent) return;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      setSelectedCardId(null);
      onPlayCard?.(card); // double click → play
      return;
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      setSelectedCardId(card.room_card_id); // single click → select
    }, 220);
  };

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
      style={{
        transform: `translate(${position.translateX}px, ${position.translateY}px) scale(${isCurrent ? 1.2 : 1})`,
      }}
    >
      <div className="relative h-32 w-full flex justify-center mt-2" style={{ transform: `rotate(${position.rotation}deg)` }}>
        <AnimatePresence>
          {showUnoPop && (
            <motion.div
              initial={{ scale: 0, y: 20, opacity: 0 }}
              animate={{ scale: 1.4, y: -40, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="absolute -top-10 text-red-500 font-black text-2xl drop-shadow-lg pointer-events-none"
            >
              UNO!
            </motion.div>
          )}
        </AnimatePresence>

        {player.cards.map((card, index) => {
          const { light, dark } = card.visible_card ?? {
            light: { color: null, value: null },
            dark: { color: null, value: null },
          };

          const { rotation, offsetX } = getFanStyle(index, player.cards.length);
          const isSelected = selectedCardId === card.room_card_id;

          return (
            <motion.div
              key={card.room_card_id}
              className={`absolute top-0 cursor-pointer ${inactive ? "opacity-50" : ""}`}
              style={{ left: offsetX }}
              animate={isSelected ? { scale: 1.1, y: -20, zIndex: 10 } : { scale: 1, y: 0, zIndex: 1 }}
              onClick={() => handleCardClick(index, card)}
            >
              <Card
                lightColor={light.color ?? "red"}
                lightValue={light.value ?? "0"}
                darkColor={dark.color ?? "blue"}
                darkValue={dark.value ?? "flip"}
                isFlipped={false}
                showBothSides={isCurrent}
                isDarkSide={isDarkSide}
                isHoverable={false}
                rotation={rotation}
              />
            </motion.div>
          );
        })}

        <div className={`text-sm font-semibold -translate-y-8 px-3 py-1 h-7 rounded-full backdrop-blur-sm transition-colors z-50 ${
          inactive ? "bg-red-600/70 text-white" : isActive ? "bg-green-600 text-white" : "bg-black/40 text-white/90"
        }`}>
          {isCurrent ? "You" : player.nickname}
        </div>
      </div>
    </motion.div>
  );
}
