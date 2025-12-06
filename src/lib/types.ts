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
  | "wild_draw_until"
  | "skip_everyone"
  | "flip"
  | null;

// ✅ Every visible card is dual-sided (light + dark)
export interface VisibleCard {
  dark: {
    color: CardColor;
    value: CardValue | null;
  };
  light: {
    color: CardColor;
    value: CardValue | null;
  };
}

// ✅ Player's card data
export interface PlayerCard {
  room_card_id: string;
  owner_id: string | null;
  nickname: string | null;
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

export const getFanStyle = (index: number, total: number, spread = 60) => {
    const startAngle = -spread / 2;
    const step = total > 1 ? spread / (total - 1) : 0;
    const rotation = startAngle + index * step;
    const offsetX = index * 30 - ((total - 1) * 30) / 2;
    return { rotation, offsetX };
  };