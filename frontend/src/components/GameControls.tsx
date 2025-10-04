interface GameControlsProps {
  handleStartGame: () => void;
  roomId: string | null;
  playerId: string | null;
}

export default function GameControls({ handleStartGame, roomId, playerId }: GameControlsProps) {
  if (!roomId || !playerId) return null;

  return (
    <button
      onClick={handleStartGame}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Start Game
    </button>
  );
}
