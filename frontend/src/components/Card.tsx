import { useState } from "react";
import { motion } from "framer-motion";
import { SkipForward, RotateCcw, Plus, Palette } from "lucide-react";

export type CardColor = "red" | "blue" | "yellow" | "green";
export type CardValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2" | "wild" | "wild-draw4";

interface CardProps {
  color?: CardColor;
  value?: CardValue;
  isFlipped?: boolean;
  isHoverable?: boolean;
  onClick?: () => void;
  onDragEnd?: (event: any, info: any) => void;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  rotation?: number;
  index?: number;
}

const colorClasses: Record<CardColor, string> = {
  red: "bg-gradient-to-br from-red-500 to-red-600",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  yellow: "bg-gradient-to-br from-yellow-400 to-yellow-500",
  green: "bg-gradient-to-br from-green-500 to-green-600",
};

const getCardIcon = (value: CardValue, small = false) => {
  const size = small ? "w-4 h-4" : "w-8 h-8";
  const fontSize = small ? "text-sm" : "text-4xl font-bold";

  switch (value) {
    case "skip":
      return <SkipForward className={size} />;
    case "reverse":
      return <RotateCcw className={size} />;
    case "draw2":
      return (
        <div className={`flex items-center ${small ? "gap-0.5" : "gap-1"}`}>
          <Plus className={small ? "w-3 h-3" : "w-6 h-6"} />
          <span className={small ? "text-xs font-bold" : "text-2xl font-bold"}>2</span>
        </div>
      );
    case "wild":
      return <Palette className={size} />;
    case "wild-draw4":
      return (
        <div className="flex flex-col items-center">
          <Palette className={small ? "w-3 h-3" : "w-6 h-6"} />
          <div className="flex items-center">
            <Plus className={small ? "w-2 h-2" : "w-4 h-4"} />
            <span className={small ? "text-xs font-bold" : "text-lg font-bold"}>4</span>
          </div>
        </div>
      );
    default:
      return <span className={fontSize}>{value}</span>;
  }
};

export const Card = ({
  color = "red",
  value = "5",
  isFlipped = false,
  isHoverable = false,
  onClick,
  onDragEnd,
  delay = 0,
  className = "",
  style,
  rotation = 0,
  index = 0,
}: CardProps) => {
  const [isHovered, setIsHovered] = useState(false);

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
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.8}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="w-full h-full rounded-xl"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Front of card */}
        <div
          className={`absolute inset-0 rounded-xl shadow-lg backface-hidden border-4 border-white ${colorClasses[color]} flex items-center justify-center`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Corner icons */}
          <div className="absolute top-1 left-2 text-white drop-shadow">
            {getCardIcon(value, true)}
          </div>
          <div className="absolute bottom-1 right-2 text-white drop-shadow rotate-180">
            {getCardIcon(value, true)}
          </div>

          {/* Main icon */}
          <div className="text-white drop-shadow-lg flex items-center justify-center">
            {getCardIcon(value)}
          </div>
        </div>

        {/* Back of card - UnoFlip dark side */}
        {/* Back of card - UnoFlip dark side */}
        <div
          className="absolute inset-0 rounded-xl shadow-lg backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 border-4 border-purple-700 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 16px)",
                }}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="text-orange-400 text-2xl font-bold tracking-wider">
                UNO
              </div>
              <div className="text-orange-300/60 text-xs font-semibold">
                FLIP
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
};
