import { motion } from "framer-motion";
import type { PlayerCard, CardColor, CardValue } from "../lib/types";
import { Card } from "./Card";

interface GameTableProps {
  cards: PlayerCard[];
  currentUserId: string;
  discardPile?: { color: CardColor; value: CardValue };
  isDarkSide?: boolean;
  onCardPlay?: (index: number) => void;
  onDrawCard?: () => void;
}

export const GameTable = ({
  cards,
  currentUserId,
  discardPile,
  isDarkSide = false,
  onCardPlay,
  onDrawCard,
}: GameTableProps) => {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        Waiting for cards...
      </div>
    );
  }

  // ✅ Group cards by owner
  const grouped = cards.reduce<Record<string, PlayerCard[]>>((acc, card) => {
    if (!acc[card.owner_id]) acc[card.owner_id] = [];
    acc[card.owner_id].push(card);
    return acc;
  }, {});

  // Build player list
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
    const angle = relativeIndex * angleStep - 90; // bottom = 0°
    const radius = 250;
    const rad = (angle * Math.PI) / 180;

    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);

    return {
      transform: `translate(${x}px, ${y}px)`,
      rotation: angle + 90, // face toward center
    };
  };

  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center">
      {/* Center discard pile */}
      <div className="absolute w-24 h-32 bg-gray-700 rounded-xl shadow-lg flex flex-col items-center justify-center text-white">
        <div className="text-xs opacity-70 mb-1">Discard</div>
        {discardPile && (
          <Card
            lightColor={discardPile.color}
            lightValue={discardPile.value}
            darkColor={discardPile.color}
            darkValue={discardPile.value}
            isDarkSide={isDarkSide}
          />
        )}
      </div>

      {/* Draw pile button */}
      <button
        onClick={onDrawCard}
        className="absolute right-[48%] top-[40%] bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg"
      >
        Draw
      </button>

      {/* Players */}
      {players.map((player, i) => {
        const isCurrent = player.id === currentUserId;
        const pos = getPlayerPosition(i);

        return (
          <motion.div
            key={player.id}
            className="absolute flex flex-col items-center gap-2"
            style={{ transform: pos.transform }}
          >
            <div className="text-white/90 text-sm font-semibold bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
              {isCurrent ? "You" : player.nickname}
            </div>

            <div className="flex gap-2">
              {player.cards.map((card, index) => {
                let light = { color: null as CardColor, value: null as CardValue };
                let dark = { color: null as CardColor, value: null as CardValue };

                if ("light" in card.visible_card && "dark" in card.visible_card) {
                  // Dual-sided card
                  light = card.visible_card.light;
                  dark = card.visible_card.dark;
                } else {
                  // Single-sided card
                  if (card.visible_card.side === "light") {
                    light = { color: card.visible_card.color, value: card.visible_card.value };
                  } else {
                    dark = { color: card.visible_card.color, value: card.visible_card.value };
                  }
                }

                return (
                  <motion.div
                    key={card.room_card_id}
                    whileHover={isCurrent ? { scale: 1.1, y: -10 } : {}}
                    onClick={() => isCurrent && onCardPlay?.(index)}
                  >
                    <Card
                      lightColor={light.color ?? "red"}
                      lightValue={light.value ?? "0"}
                      darkColor={dark.color ?? "blue"}
                      darkValue={dark.value ?? "flip"}
                      isFlipped={!isCurrent}
                      showBothSides={isCurrent}
                      isDarkSide={isDarkSide}
                      isHoverable={isCurrent}
                      rotation={pos.rotation}
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
