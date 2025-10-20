
import { useState } from "react";
import { motion } from "framer-motion";
import { SkipForward, RotateCcw, Plus, Palette } from "lucide-react";
import type { CardColor, CardValue, CardProps } from "../lib/types";


const colorClasses: Record<Exclude<CardColor, null> | "black", string> = {
  red: "bg-gradient-to-br from-red-500 to-red-600",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  yellow: "bg-gradient-to-br from-yellow-400 to-yellow-500",
  green: "bg-gradient-to-br from-green-500 to-green-600",
  black: "bg-gradient-to-br from-neutral-800 to-black",
};


const getCardIcon = (value?: CardValue, small = false) => {
  if (!value) return null;
  const size = small ? "w-4 h-4" : "w-8 h-8";
  const fontSize = small ? "text-sm" : "text-4xl font-bold";

  switch (value) {
    case "skip":
      return <SkipForward className={size} />;
    case "reverse":
      return <RotateCcw className={size} />;
    case "wild_draw_two":
      return (
        <div className={`flex items-center ${small ? "gap-0.5" : "gap-1"}`}>
          <Plus className={small ? "w-3 h-3" : "w-6 h-6"} />
          <span className={small ? "text-xs font-bold" : "text-2xl font-bold"}>2</span>
        </div>
      );
    case "draw_one":
      return (
        <div className="flex items-center">
          <Plus className={small ? "w-3 h-3" : "w-6 h-6"} />
          <span className={small ? "text-xs font-bold" : "text-2xl font-bold"}>1</span>
        </div>
      );
    case "wild":
      return <Palette className={size} />;
    case "flip":
      return <RotateCcw className={size} />;
    default:
      return <span className={fontSize}>{value}</span>;
  }
};

export const Card = ({
  lightColor = "red",
  lightValue = "5",
  darkColor = "blue",
  darkValue = "flip",
  isFlipped = false,
  showBothSides = false,
  isDarkSide = false,
  isHoverable = false,
  onClick,
  onDragEnd,
  delay = 0,
  className = "",
  style,
  rotation = 0,
}: CardProps) => {
  const [, setIsHovered] = useState(false);

  // Choose which side to show (dark or light)
  const activeColor = isDarkSide ? darkColor : lightColor;
  const activeValue = isDarkSide ? darkValue : lightValue;
  const colorKey = activeColor ?? "black";
  const frontColorClass = colorClasses[colorKey];

  // For flipped/opponent cards, back is generic
  const backColorClass = "black";

  return (
    <motion.div
      className={`relative w-20 h-28 cursor-pointer ${className}`}
      style={{ ...style, rotate: rotation }}
      initial={{ opacity: 0, scale: 0.5, y: -200, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: rotation }}
      transition={{
        delay: delay / 1000,
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      whileHover={
        isHoverable
          ? {
            y: -20,
            scale: 1.05,
            transition: { type: "spring", stiffness: 400, damping: 10 },
          }
          : {}
      }
      drag={isHoverable}
      dragElastic={0.8}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Flip animation container */}
      <motion.div
        className="w-full h-full rounded-xl"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* FRONT (visible side) */}
        <div
          className={`absolute inset-0 rounded-xl shadow-lg border-4 border-white flex items-center justify-center ${frontColorClass}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute top-1 left-2 text-white drop-shadow">
            {getCardIcon(activeValue, true)}
          </div>
          <div className="absolute bottom-1 right-2 text-white drop-shadow rotate-180">
            {getCardIcon(activeValue, true)}
          </div>
          <div className="text-white drop-shadow-lg flex items-center justify-center">
            {getCardIcon(activeValue)}
          </div>
        </div>

        {/* BACK (flipped/opposite side) */}
        <div
          className={`absolute inset-0 rounded-xl shadow-lg flex items-center justify-center ${backColorClass}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {showBothSides && (
            <div className="text-white drop-shadow-lg flex items-center justify-center">
              {getCardIcon(isDarkSide ? lightValue : darkValue)}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
