// src/lib/types.ts

// ✅ Include both light and dark-side UNO Flip colors
export type CardColor =
  | "red"
  | "yellow"
  | "green"
  | "blue"
  | "orange"
  | "purple"
  | "pink"
  | "light_blue"
  | "black"
  | null;

// ✅ Full list of UNO and UNO Flip card values
export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw_one"
  | "draw_two"
  | "draw_five"
  | "wild"
  | "wild_draw_two"
  | "wild_draw_color"
  | "skip_everyone"
  | "flip"
  | null;

// ✅ Every visible card is dual-sided (light + dark)
export interface VisibleCard {
  dark: {
    color: CardColor;
    value: CardValue;
  };
  light: {
    color: CardColor;
    value: CardValue;
  };
}

// ✅ Player's card data
export interface PlayerCard {
  room_card_id: string;
  owner_id: string;
  nickname: string;
  visible_card: VisibleCard;
}

// ✅ Props for <Card /> component
export interface CardProps {
  lightColor: CardColor;
  lightValue: CardValue;
  darkColor: CardColor;
  darkValue: CardValue;
  isFlipped?: boolean;
  showBothSides?: boolean;
  isDarkSide?: boolean;
  isHoverable?: boolean;
  onClick?: () => void;
  onDragEnd?: (event: any, info: any) => void;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  rotation?: number;
}
