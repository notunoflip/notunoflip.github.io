import { motion } from "framer-motion";
import { getFanStyle, type PlayerCard, type VisibleCard } from "../lib/types";
import { Card } from "./Card";
import { useRef, useState } from "react";
import { useRoomPlayers } from "../hooks/useRoomPlayers";

interface GameTableProps {
  cards: PlayerCard[];
  currentUserId: string;
  currentCard?: VisibleCard | null;
  drawCardTop?: VisibleCard | null;
  drawStack?: number;
  activePlayerId?: string;
  isDarkSide?: boolean;
  roomCode?: string;

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
  roomCode,
  drawStack = 0,
  onCardPlay,
  onDrawCard,
}: GameTableProps) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const { players: playersPresence } = useRoomPlayers(roomCode || "");
  const isYourTurn = activePlayerId === currentUserId;
  const clickTimeouts = useRef<Record<string, NodeJS.Timeout | null>>({});

  // Helper to check if player is inactive
  const isInactive = (playerId: string) => {
    const playerInfo = playersPresence.find((p) => p.player_id === playerId);
    if (!playerInfo?.last_seen) return true;

    const last = new Date(playerInfo.last_seen).getTime();
    const now = Date.now();

    return now - last > 40_000; // 40 seconds
  };

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

  const handleCardClick = (
    playerId: string,
    index: number,
    card: PlayerCard
  ) => {
    if (!isYourTurn || playerId !== currentUserId) return;

    const timeout = clickTimeouts.current[playerId];

    // DOUBLE CLICK
    if (timeout) {
      clearTimeout(timeout);
      clickTimeouts.current[playerId] = null;

      onCardPlay?.(card);
      setSelectedCard(null);
      return;
    }

    // SINGLE CLICK (start delay)
    clickTimeouts.current[playerId] = setTimeout(() => {
      clickTimeouts.current[playerId] = null;
      setSelectedCard(index);
    }, 250);
  };

  return (
    <div className="relative w-full h-[95vh] flex items-center justify-center">
      {/* Center piles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3">
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
          {drawStack > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: Math.min(1 + drawStack * 0.05, 1.6),
                opacity: 1,
              }}
              transition={{ type: "spring", stiffness: 300 }}
              className={`
      absolute -top-3 -right-3 z-20
      rounded-full px-3 py-1
      font-extrabold text-white
      shadow-lg
      ${drawStack >= 6
                  ? "bg-red-600 animate-pulse"
                  : drawStack >= 3
                    ? "bg-amber-500"
                    : "bg-slate-700"
                }
    `}
            >
              +{drawStack}
            </motion.div>
          )}

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
              animate={{
                boxShadow: [
                  "0 0 0px",
                  "0 0 15px rgb(255 255 255 / 0.3)",
                ],
              }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ zIndex: -1 }}
            />
          )}
        </button>
      </div>

      {/* Player hands */}
      {players.map((player, i) => {
        const isCurrent = player.id === currentUserId;
        const pos = getPlayerPosition(i);
        const inactive = isInactive(player.id);

        return (

          <motion.div
            key={player.id}
            className="absolute flex flex-col items-center gap-1"
            style={{
              transform: `${pos.transform} scale(${isCurrent ? 1.2 : 1})`,
            }}
          >

            <div
              className="relative h-32 w-full flex justify-center mt-2"
              style={{
                transform: `rotate(${((i - currentIndex + numPlayers) % numPlayers) * angleStep
                  }deg)`,
              }}
            >

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
                    className={`absolute top-0 cursor-pointer ${inactive ? "opacity-50" : ""
                      }`}
                    style={{ left: offsetX }}
                    animate={
                      selectedCard === index && isCurrent
                        ? { scale: 1.1, y: -20, zIndex: 10 }
                        : { scale: 1, y: 0, zIndex: 1 }
                    }
                    onClick={() => handleCardClick(player.id, index, card)}
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
            <div
              className={`text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm transition-colors ${inactive
                ? "bg-red-600/70 text-white" // Disconnected style
                : player.id === activePlayerId
                  ? "bg-green-600 text-white"
                  : "bg-black/40 text-white/90"
                }`}
            >
              {isCurrent ? "You" : player.nickname}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};