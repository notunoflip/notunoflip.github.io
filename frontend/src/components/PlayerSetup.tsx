interface PlayerSetupProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  handleCreateRoom: () => void;
  roomId: string | null;
}

export default function PlayerSetup({ playerName, setPlayerName, handleCreateRoom, roomId }: PlayerSetupProps) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Enter your player name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
      />
      {!roomId && (
        <button
          onClick={handleCreateRoom}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Create Room
        </button>
      )}
    </div>
  );
}
