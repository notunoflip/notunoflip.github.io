import { useState } from "react";
import { GameTable } from "./components/GameTable";
import type { CardColor, CardValue } from "./components/Card";
import { toast } from "sonner";

const Index = () => {
  // Sample game state
  const [currentPlayerCards, setCurrentPlayerCards] = useState<{ color: CardColor; value: CardValue }[]>([
    { color: "red", value: "5" },
    { color: "blue", value: "7" },
    { color: "yellow", value: "2" },
    { color: "green", value: "skip" },
    { color: "red", value: "reverse" },
    { color: "blue", value: "9" },
    { color: "yellow", value: "1" },
  ]);

  const handleDrawCard = () => {
    // Simulate drawing a card
    const colors: CardColor[] = ["red", "blue", "yellow", "green"];
    const values: CardValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const newCard = {
      color: colors[Math.floor(Math.random() * colors.length)],
      value: values[Math.floor(Math.random() * values.length)]
    };
    setCurrentPlayerCards([...currentPlayerCards, newCard]);
    toast.success("Card drawn!");
  };

  const topPlayerCards: { color: CardColor; value: CardValue }[] = [
    { color: "red", value: "5" },
    { color: "blue", value: "7" },
    { color: "yellow", value: "2" },
    { color: "green", value: "3" },
    { color: "red", value: "8" },
  ];

  const leftPlayerCards: { color: CardColor; value: CardValue }[] = [
    { color: "red", value: "5" },
    { color: "blue", value: "7" },
    { color: "yellow", value: "2" },
    { color: "green", value: "3" },
  ];

  const rightPlayerCards: { color: CardColor; value: CardValue }[] = [
    { color: "red", value: "5" },
    { color: "blue", value: "7" },
    { color: "yellow", value: "2" },
    { color: "green", value: "3" },
    { color: "red", value: "8" },
    { color: "blue", value: "4" },
  ];

  const discardPile: { color: CardColor; value: CardValue } = {
    color: "red",
    value: "3",
  };

  return (
    <GameTable
      currentPlayer={currentPlayerCards}
      topPlayer={topPlayerCards}
      leftPlayer={leftPlayerCards}
      rightPlayer={rightPlayerCards}
      discardPile={discardPile}
      onDrawCard={handleDrawCard}
    />
  );
};

export default Index;
