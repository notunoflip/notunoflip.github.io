
import { type PlayerCard, type VisibleCard } from "../lib/types";
import { Card } from "./Card";
import { useRoomPlayers } from "../hooks/useRoomPlayers";
import { PlayerHand } from "./PlayerHand";
import { motion } from "framer-motion";

interface GameTableProps {
	cards: PlayerCard[];
	currentUserId: string;
	currentCard?: VisibleCard | null;
	drawCardTop?: VisibleCard | null;
	drawStack?: number;
	activePlayerId?: string;
	isDarkSide?: boolean;
	roomCode?: string;
	direction?: string;
	playerOrder?: string[];

	onCardPlay?: (card: PlayerCard) => void;
	onDrawCard?: () => void;
}

export const GameTable = ({
	cards,
	currentUserId,
	currentCard,
	drawCardTop,
	activePlayerId,
	isDarkSide = false,
	roomCode,
	direction,
	drawStack = 0,
	playerOrder,
	onCardPlay,
	onDrawCard,
}: GameTableProps) => {
	const { players: playersPresence } = useRoomPlayers(roomCode || "");
	const isYourTurn = activePlayerId === currentUserId;

	// Helper to check if player is inactive
	const isInactive = (playerId: string) => {
		const playerInfo = playersPresence.find((p) => p.player_id === playerId);
		if (!playerInfo?.last_seen) return true;

		const last = new Date(playerInfo.last_seen).getTime();
		const now = Date.now();

		return now - last > 40_000; // 40 seconds
	};

	if (!cards?.length) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-gray-400">
				Waiting for cards...
			</div>
		);
	}

	// Group cards by owner
	const grouped = cards.reduce<Record<string, PlayerCard[]>>((acc, card) => {
		const safeOwnerId = card.owner_id ?? "unknown";
		if (!acc[safeOwnerId]) acc[safeOwnerId] = [];
		acc[safeOwnerId].push(card);
		return acc;
	}, {});

	const orderedPlayerIds =
		playerOrder?.filter((id) => grouped[id]) ?? Object.keys(grouped);

	const players = orderedPlayerIds.map((playerId) => ({
		id: playerId,
		nickname: grouped[playerId][0]?.nickname || "Player",
		cards: grouped[playerId],
	}));

	const currentIndex = players.findIndex((p) => p.id === currentUserId);
	const numPlayers = players.length || 1;

	type Seat = {
		x: (w: number, h: number, m: number) => number;
		y: (w: number, h: number, m: number) => number;
		rotation: 0 | 90 | 180 | 270;
	};

	const SEATS = {
		bottom: { x: (w) => w / 2, y: (_, h, m) => h - m + 50, rotation: 0 },
		bottom1: { x: (w) => w * 0.25, y: (_, h, m) => h - m + 50, rotation: 0 },
		bottom2: { x: (w) => w * 0.75, y: (_, h, m) => h - m + 50, rotation: 0 },
		left: { x: (_, __, m) => m - 80, y: (_, h) => h / 2, rotation: 90 },
		left1: { x: (_, __, m) => m - 80, y: (_, h) => h * 0.25, rotation: 90 },
		left2: { x: (_, __, m) => m - 80, y: (_, h) => h * 0.75, rotation: 90 },
		top: { x: (w) => w / 2, y: (_, __, m) => m - 80, rotation: 180 },
		top1: { x: (w) => w * 0.25, y: (_, __, m) => m - 80, rotation: 180 },
		top2: { x: (w) => w * 0.75, y: (_, __, m) => m - 80, rotation: 180 },
		right: { x: (w, __, m) => w - m + 100, y: (_, h) => h / 2, rotation: 270 },
		right1: { x: (w, __, m) => w - m + 100, y: (_, h) => h * 0.25, rotation: 270 },
		right2: { x: (w, __, m) => w - m + 100, y: (_, h) => h * 0.75, rotation: 270 },
	} satisfies Record<string, Seat>;

	const LAYOUTS: Record<number, (keyof typeof SEATS)[]> = {
		2: ["bottom", "top"],
		3: ["bottom", "top", "right"],
		4: ["bottom", "left", "top", "right"],
		5: ["bottom1", "left", "top1", "top2", "right"],
		6: ["bottom1", "left1", "left2", "top", "right1", "right2"],
	};

	const getPlayerPosition = (index: number, isActive: boolean) => {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const m = 80;

		const relativeIndex = (index - currentIndex + numPlayers) % numPlayers;
		const seatKey = (LAYOUTS[numPlayers] ?? LAYOUTS[6])[relativeIndex];
		const seat = SEATS[seatKey];

		let x = seat.x(w, h, m);
		let y = seat.y(w, h, m);

		if (isActive) {
			const PULL = 50;
			switch (seatKey[0]) {
				case "r": x -= PULL; break;
				case "l": x += PULL; break;
				case "t": y += PULL; break;
				case "b": y -= PULL; break;
			}
		}

		return { translateX: x - w / 2, translateY: y - h / 2, rotation: seat.rotation };
	};

	return (
		<div className="relative w-full h-[95vh] flex items-center justify-center">
			{/* Center piles */}
			<motion.div
				className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
				animate={{ rotate: direction === "clockwise" ? 360 : -360 }}
				transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
				style={{ zIndex: 10, opacity: 0.5 }}
			>
				<svg width={300} height={300} viewBox="0 0 200 200">
					<circle
						cx="100"
						cy="100"
						r="90"
						stroke="white"
						strokeWidth="4"
						fill="none"
						strokeOpacity={0.2}
					/>
					<path
						d={direction === "clockwise"
							? "M190,100 L180,95 L180,105 Z"
							: "M10,100 L20,95 L20,105 Z"}
						fill="white"
						opacity={0.2}
					/>
				</svg>
			</motion.div>
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3">
				{currentCard && (
					<Card
						lightColor={currentCard.light.color ?? "black"}
						lightValue={currentCard.light.value ?? null}
						darkColor={currentCard.dark.color ?? "black"}
						darkValue={currentCard.dark.value ?? null}
						isDarkSide={!isDarkSide}
					/>
				)}

				{/* Draw pile */}
				<button
					onClick={() => isYourTurn && onDrawCard?.()}
					disabled={!isYourTurn}
					className={`relative group transition-transform ${isYourTurn
						? "hover:scale-105"
						: "opacity-40 cursor-not-allowed"
						}`}
				>
					{/* Another layer */}
					<div
						className="absolute inset-0 rounded-md scale-95 bg-black/10 rotate-3"
						style={{ zIndex: 0 }}
					/>

					{/* Main top card number + motion */}
					{drawStack > 0 && (
						<motion.div
							initial={{ scale: 0.8, opacity: 0 }}
							animate={{
								scale: Math.min(1 + drawStack * 0.05, 1.6),
								opacity: 1,
							}}
							transition={{ type: "spring", stiffness: 300 }}
							className={`
        absolute -top-3 -right-3 z-20
        rounded-full px-3 py-1
        font-extrabold text-white
        shadow-lg
        ${drawStack >= 6
									? "bg-red-600 animate-pulse"
									: drawStack >= 3
										? "bg-amber-500"
										: "bg-slate-700"
								}
      `}
						>
							+{drawStack}
						</motion.div>
					)}

					<Card
						lightColor={drawCardTop?.light.color ?? "blue"}
						lightValue={drawCardTop?.light.value ?? "7"}
						darkColor={drawCardTop?.dark.color ?? "red"}
						darkValue={drawCardTop?.dark.value ?? "7"}
						isDarkSide={isDarkSide}
						style={{ zIndex: 1, position: "relative" }}
					/>

					{/* Label */}
					<div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-300">
						Draw
					</div>
				</button>

			</div>

			{players.map((player, i) => {
				const pos = getPlayerPosition(i, player.id === activePlayerId);

				return (
					<PlayerHand
						key={player.id}
						player={player}
						isCurrent={player.id === currentUserId}
						isActive={player.id === activePlayerId}
						inactive={isInactive(player.id)}
						isDarkSide={isDarkSide}
						position={pos}
						onPlayCard={onCardPlay} // only called when a card is played
					/>
				);
			})}
		</div>
	);
};
