// src/lib/types.ts
export type CardColor =
  | "red"
  | "yellow"
  | "green"
  | "blue"
  | null;

export type CardValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw_one" | "draw_two" | "wild" | "wild_draw_two"
  | "skip_everyone"
  | "flip"
  | null;

// Each card may represent either both sides (light/dark) or just one
export interface DualSidedVisibleCard {
  dark: {
    color: CardColor;
    value: CardValue;
  };
  light: {
    color: CardColor;
    value: CardValue;
  };
}

export interface SingleSidedVisibleCard {
  side: "light" | "dark";
  color: CardColor;
  value: CardValue;
}

export type VisibleCard = DualSidedVisibleCard | SingleSidedVisibleCard;

export interface PlayerCard {
  room_card_id: string;
  owner_id: string;
  nickname: string;
  visible_card: VisibleCard;
}


export interface CardProps {
  lightColor?: CardColor | null;
  lightValue?: CardValue;
  darkColor?: CardColor | null;
  darkValue?: CardValue;
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