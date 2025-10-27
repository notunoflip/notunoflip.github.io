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

  if (!cards?.length)
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        Waiting for cards...
      </div>
    );

  // Group by owner
  const grouped = cards.reduce<Record<string, PlayerCard[]>>((acc, c) => {
    (acc[c.owner_id] ||= []).push(c);
    return acc;
  }, {});

  const players = Object.entries(grouped).map(([ownerId, cards]) => ({
    id: ownerId,
    nickname: cards[0]?.nickname || "Player",
    cards,
  }));

  const currentIndex = players.findIndex((p) => p.id === currentUserId);
  const numPlayers = players.length;
  const angleStep = 360 / numPlayers;

  const getPlayerPosition = (i: number) => {
    const rel = (i - currentIndex + numPlayers) % numPlayers;
    const angle = rel * angleStep + 90;
    const r = 250;
    const rad = (angle * Math.PI) / 180;
    return {
      transform: `translate(${r * Math.cos(rad)}px, ${r * Math.sin(rad)}px)`,
    };
  };

  const getFanStyle = (index: number, total: number, spread = 60) => {
    const start = -spread / 2;
    const step = total > 1 ? spread / (total - 1) : 0;
    const rotation = start + index * step;
    const offsetX = index * 30 - ((total - 1) * 30) / 2;
    return { rotation, offsetX };
  };

  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center">
      {/* Center piles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
        {discardPile && (
          <Card
            lightColor={discardPile.color}
            lightValue={discardPile.value}
            darkColor={discardPile.color}
            darkValue={discardPile.value}
            isDarkSide={isDarkSide}
          />
        )}
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
                const { light, dark } = card.visible_card;
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
                      lightColor={light.color}
                      lightValue={light.value}
                      darkColor={dark.color}
                      darkValue={dark.value}
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
