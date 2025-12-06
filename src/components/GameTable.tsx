import { motion } from "framer-motion";
import { getFanStyle, type PlayerCard, type VisibleCard } from "../lib/types";
import { Card } from "./Card";
import { useState } from "react";

interface GameTableProps {
  cards: PlayerCard[];
  currentUserId: string;
  currentCard?: VisibleCard | null;
  drawCardTop?: VisibleCard | null;
  activePlayerId?: string;
  isDarkSide?: boolean;

  // ✅ UPDATED: now passes the full card object
  onCardPlay?: (card: PlayerCard) => void;

  onDrawCard?: () => void;
}

export const GameTable = ({
  cards,
  currentUserId,
  currentCard,
  drawCardTop,
  activePlayerId,
  isDarkSide = false,
  onCardPlay,
  onDrawCard,
}: GameTableProps) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  if (!cards?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        Waiting for cards...
      </div>
    );
  }

  // Group cards by owner
  const grouped = cards.reduce<Record<string, PlayerCard[]>>((acc, card) => {
    const safeOwnerId = card.owner_id ?? "unknown";
    if (!acc[safeOwnerId]) acc[safeOwnerId] = [];
    acc[safeOwnerId].push(card);

    return acc;
  }, {});

  const players = Object.entries(grouped).map(([ownerId, playerCards]) => ({
    id: ownerId,
    nickname: playerCards[0]?.nickname || "Player",
    cards: playerCards,
  }));

  const currentIndex = players.findIndex((p) => p.id === currentUserId);
  const numPlayers = players.length || 1;
  const angleStep = 360 / numPlayers;

  const getPlayerPosition = (index: number) => {
    const relativeIndex = (index - currentIndex + numPlayers) % numPlayers;
    const angle = relativeIndex * angleStep + 90;
    const radius = 250;
    const rad = (angle * Math.PI) / 180;
    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);
    return { transform: `translate(${x}px, ${y}px)` };
  };

  const isYourTurn = activePlayerId === currentUserId;

  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center">
      {/* Center piles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
        {currentCard && (
          <Card
            lightColor={currentCard.light.color ?? "black"}
            lightValue={currentCard.light.value ?? null}
            darkColor={currentCard.dark.color ?? "black"}
            darkValue={currentCard.dark.value ?? null}
            isDarkSide={!isDarkSide}
          />
        )}

        {/* Draw pile */}
        <button
          onClick={() => isYourTurn && onDrawCard?.()}
          disabled={!isYourTurn}
          className={`relative group transition-transform ${isYourTurn
              ? "hover:scale-105"
              : "opacity-40 cursor-not-allowed"
            }`}
        >

          {/* Another layer */}
          <div
            className="absolute inset-0 rounded-md scale-95 bg-black/10 rotate-3"
            style={{ zIndex: 0 }}
          />

          {/* Main top card */}
          <Card
            lightColor={drawCardTop?.light.color ?? "blue"}
            lightValue={drawCardTop?.light.value ?? "7"}
            darkColor={drawCardTop?.dark.color ?? "red"}
            darkValue={drawCardTop?.dark.value ?? "7"}
            isDarkSide={isDarkSide}
            style={{ zIndex: 1, position: "relative" }}
          />

          {/* Label */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-300">
            Draw
          </div>

          {/* Soft pulse when it's your turn */}
          {isYourTurn && (
            <motion.div
              className="absolute inset-0 rounded-md"
              animate={{ boxShadow: ["0 0 0px", "0 0 15px rgb(255 255 255 / 0.3)"] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ zIndex: -1 }}
            ></motion.div>
          )}
        </button>

      </div>

      {/* Player hands */}
      {players.map((player, i) => {
        const isCurrent = player.id === currentUserId;
        const pos = getPlayerPosition(i);

        return (
          <motion.div
            key={player.id}
            className="absolute flex flex-col items-center gap-2"
            style={{ transform: pos.transform }}
          >
            <div
              className={`text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm ${player.id === activePlayerId
                ? "bg-green-600 text-white"
                : "bg-black/40 text-white/90"
                }`}
            >
              {isCurrent ? "You" : player.nickname}
            </div>

            <div className="relative h-32 w-full flex justify-center mt-2">
              {player.cards.map((card, index) => {
                const { light, dark } = card.visible_card ?? {
                  light: { color: null, value: null },
                  dark: { color: null, value: null },
                };

                const { rotation, offsetX } = getFanStyle(
                  index,
                  player.cards.length
                );

                return (
                  <motion.div
                    key={card.room_card_id}
                    className="absolute top-0 cursor-pointer"
                    style={{ left: offsetX }}
                    animate={
                      selectedCard === index && isCurrent
                        ? { scale: 1.1, y: -20, zIndex: 10 }
                        : { scale: 1, y: 0, zIndex: 1 }
                    }
                    onClick={() => {
                      if (isCurrent && isYourTurn) {
                        setSelectedCard(index);

                        // ✅ UPDATED: pass full card object
                        onCardPlay?.(card);
                      }
                    }}
                    onDoubleClick={() => {
                      if (isCurrent && isYourTurn) {
                        onCardPlay?.(card);
                        setSelectedCard(null);
                      }
                    }}
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
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
