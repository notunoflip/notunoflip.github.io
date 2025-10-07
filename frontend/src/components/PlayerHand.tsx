import { Card } from "./Card";
import type { CardColor, CardValue } from "./Card";

interface PlayerHandProps {
  cards: { color: CardColor; value: CardValue }[];
  isCurrentPlayer?: boolean;
  position?: "bottom" | "top" | "left" | "right";
  playerName?: string;
  onCardPlay?: (index: number) => void;
}

export const PlayerHand = ({
  cards,
  isCurrentPlayer = false,
  position = "bottom",
  playerName = "Player",
  onCardPlay,
}: PlayerHandProps) => {
  const handleCardDragEnd = (index: number) => (_event: any, info: any) => {
    if (info.offset.y < -50 && isCurrentPlayer) {
      onCardPlay?.(index);
    }
  };

  const getBaseRotation = () => {
    switch (position) {
      case "top":
        return 180;
      case "left":
        return 90;
      case "right":
        return -90;
      default:
        return 0;
    }
  };

  const baseRotation = getBaseRotation();

  const getLayoutStyle = () => {
    switch (position) {
      case "top":
      case "bottom":
        return {
          width: `${cards.length * 40}px`,
          height: "140px",
          flexDirection: "row" as const,
        };
      case "left":
      case "right":
        return {
          width: "140px",
          height: `${cards.length * 40}px`,
          flexDirection: "column" as const,
        };
      default:
        return {};
    }
  };

  const layout = getLayoutStyle();

  return (
    <div className="flex flex-col items-center gap-2">
      {!isCurrentPlayer && (
        <div className="text-gray-100 font-semibold text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          {playerName}
        </div>
      )}
      <div
        className="relative flex"
        style={{
          width: layout.width,
          height: layout.height,
          flexDirection: layout.flexDirection,
        }}
      >
        {cards.map((card, index) => (
          <div
            key={index}
            className="absolute"
            style={
              position === "top" || position === "bottom"
                ? { left: `${index * 30}px`, top: 0, zIndex: index }
                : { top: `${index * 30}px`, left: 0, zIndex: index }
            }
          >
            <Card
              color={card.color}
              value={card.value}
              isFlipped={!isCurrentPlayer}
              isHoverable={isCurrentPlayer}
              onDragEnd={handleCardDragEnd(index)}
              delay={index * 100}
              index={index}
              rotation={baseRotation}
            />
          </div>
        ))}
      </div>
      {isCurrentPlayer && (
        <div className="text-gray-100 font-semibold text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          You
        </div>
      )}
    </div>
  );
};
