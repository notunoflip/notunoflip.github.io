import { useState, useEffect, type JSX } from "react";
import { motion } from "framer-motion";
import { SkipForward, RotateCcw, Plus, Palette, FlipVertical2, Ban, CircleQuestionMark } from "lucide-react";
import type { CardValue, CardProps } from "../lib/types";

const COLORS = {
  red: "bg-gradient-to-br from-red-500 to-red-600",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  yellow: "bg-gradient-to-br from-yellow-400 to-yellow-500",
  green: "bg-gradient-to-br from-green-500 to-green-600",
  orange: "bg-gradient-to-br from-orange-400 to-orange-600",
  purple: "bg-gradient-to-br from-purple-400 to-purple-600",
  pink: "bg-gradient-to-br from-pink-400 to-pink-600",
  light_blue: "bg-gradient-to-br from-sky-400 to-sky-600",
  black: "bg-gradient-to-br from-neutral-800 to-black",
} as const;

const DARK_MAP: Record<string, string> = {
  red: "orange",
  yellow: "purple",
  green: "pink",
  blue: "light_blue",
};

const getColor = (color?: string, dark?: boolean) =>
  COLORS[
    (dark ? DARK_MAP[color ?? ""] : color) as keyof typeof COLORS
  ] ?? COLORS.black;

const getIcon = (v?: CardValue, small = false) => {
  if (!v) return null;
  const sz = small ? "w-4 h-4" : "w-8 h-8";
  const num = (n: string) => (
    <div className="flex items-center">
      <Plus className={small ? "w-3 h-3" : "w-6 h-6"} />
      <span className={small ? "text-xs font-bold" : "text-2xl font-bold"}>{n}</span>
    </div>
  );
  const icons: Record<string, JSX.Element> = {
    skip: <Ban className={sz} />,
    skip_everyone: <SkipForward className={sz} />,
    reverse: <RotateCcw className={sz} />,
    draw_one: num("1"),
    draw_two: num("2"),
    draw_five: num("5"),
    wild_draw_two: num("2"),
    wild: <Palette className={sz} />,
    wild_draw_until:<CircleQuestionMark className={sz} />,
    flip: <FlipVertical2 className={sz} />,
  };
  return icons[v] ?? <span className={small ? "text-sm" : "text-4xl font-bold"}>{v}</span>;
};

export const Card = ({
  lightColor,
  lightValue,
  darkColor,
  darkValue,
  isFlipped = false,
  isHoverable,
  onClick,
  onDragEnd,
  delay = 0,
  className = "",
  style,
  rotation = 0,
  showBothSides = false,
  isDarkSide = false,
}: CardProps) => {
  const [flipped, setFlipped] = useState(isFlipped);

  // automatically flip based on showBothSides and isDarkSide
  useEffect(() => {
    if (showBothSides) {
      setFlipped(isDarkSide);
    } else {
      // hide card content if not ours (opponent’s card)
      setFlipped(!isDarkSide);
    }
  }, [showBothSides, isDarkSide]);

  const flip = () => {
    if (showBothSides) {
      setFlipped(!flipped);
      onClick?.();
    }
  };

  const side = (color?: string, value?: CardValue, dark = false) => (
    <div
      className={`absolute inset-0 rounded-xl shadow-lg border-4 ${
        dark ? "border-purple-900" : "border-white"
      } flex items-center justify-center ${getColor(color, dark)}`}
      style={{ transform: dark ? "rotateY(180deg)" : undefined, backfaceVisibility: "hidden" }}
    >
      <div className="absolute top-1 left-2 text-white drop-shadow">
        {getIcon(value, true)}
      </div>
      <div className="text-white">{getIcon(value)}</div>
      <div className="absolute bottom-1 right-2 text-white drop-shadow rotate-180">
        {getIcon(value, true)}
      </div>
    </div>
  );

  return (
    <motion.div
      className={`relative w-20 h-28 cursor-pointer ${className}`}
      style={{ ...style, rotate: rotation }}
      initial={{ opacity: 0, scale: 0.5, y: -200, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: rotation }}
      transition={{ delay: delay / 1000, type: "spring", stiffness: 260, damping: 20 }}
      whileHover={isHoverable ? { y: -20, scale: 1.05 } : {}}
      drag={isHoverable}
      dragElastic={0.8}
      onDragEnd={onDragEnd}
      onClick={flip}
    >
      <motion.div
        className="w-full h-full rounded-xl"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {side(lightColor ?? undefined, lightValue)}
        {side(darkColor ?? undefined, darkValue, true)}
      </motion.div>
    </motion.div>
  );
};
