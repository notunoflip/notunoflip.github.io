// Game.tsx
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import RoomWaiting from "./components/RoomWaiting"
import type { Session } from "@supabase/supabase-js";

export default function Game() {
  const { session } = useOutletContext<{ session: Session | null }>();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  if (!session || !roomId) return <p>Loading...</p>;

  const handleStartGame = () => {
    // Navigate to actual game board once host starts
    navigate(`/game/${roomId}`);
  };

  return (
    <RoomWaiting
      session={session}
      roomId={roomId}
      onStartGame={handleStartGame}
    />
  );
}