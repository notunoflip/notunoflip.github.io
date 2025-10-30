import { motion } from "framer-motion";
import type { PlayerCard, CardColor, CardValue } from "../lib/types";
import { Card } from "./Card";
import { useState } from "react";

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
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        Waiting for cards...
      </div>
    );
  }

  // Group cards by owner
  const grouped = cards.reduce<Record<string, PlayerCard[]>>((acc, card) => {
    if (!acc[card.owner_id]) acc[card.owner_id] = [];
    acc[card.owner_id].push(card);
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
    const angle = relativeIndex * angleStep + 90; // bottom = current player
    const radius = 250;
    const rad = (angle * Math.PI) / 180;

    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);

    return {
      transform: `translate(${x}px, ${y}px)`,
      rotation: angle + 90,
    };
  };

  // Helper for fanned layout
  const getFanStyle = (index: number, total: number, spread = 60) => {
    const startAngle = -spread / 2;
    const step = total > 1 ? spread / (total - 1) : 0;
    const rotation = startAngle + index * step;
    const offsetX = index * 30 - ((total - 1) * 30) / 2; // slight horizontal offset
    return { rotation, offsetX };
  };

  return (
    <div className=" relative w-full h-[80vh] flex items-center justify-center">
      {/* Center piles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
        {/* Discard pile */}
        {discardPile && (
          <Card
            lightColor={discardPile.color}
            lightValue={discardPile.value}
            darkColor={discardPile.color}
            darkValue={discardPile.value}
            isDarkSide={isDarkSide}
          />
        )}

        {/* Draw pile */}
        <button onClick={onDrawCard}>
          <Card
            lightColor="blue"
            lightValue="4"
            darkColor="red"
            darkValue="4"
            isDarkSide={isDarkSide}
          />
        </button>
      </div>

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

            <div className="relative h-32 w-full flex justify-center mt-2">
              {player.cards.map((card, index) => {
                let light: { color: CardColor | null; value: CardValue | null } = {
                  color: null,
                  value: null,
                };
                let dark: { color: CardColor | null; value: CardValue | null } = {
                  color: null,
                  value: null,
                };

                if ("light" in card.visible_card && "dark" in card.visible_card) {
                  light = card.visible_card.light;
                  dark = card.visible_card.dark;
                } 
                const { rotation, offsetX } = getFanStyle(index, player.cards.length);

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
                      if (isCurrent) {
                        setSelectedCard(index);
                        onCardPlay?.(index);
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
                      isHoverable={false} // disable hover
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
