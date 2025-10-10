import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface RoomPlayer {
    player_id: string;
    is_host: boolean;
    players: { nickname: string }; // single object
}


export default function RoomWaiting({ roomId }: { roomId: string }) {
    const [players, setPlayers] = useState<RoomPlayer[]>([]);

    useEffect(() => {
        if (!roomId) return;

        // Fetch initial room players
        const fetchPlayers = async () => {
            const { data, error } = await supabase
                .from("room_players")
                .select("player_id,is_host,players(nickname)")
                .eq("room_id", roomId);

            if (error) {
                console.error("Failed to fetch players:", error);
                return;
            }

            const mapped = (data || []).map((p: any) => ({
                player_id: p.player_id,
                is_host: p.is_host,
                // Safely pick the first player or fallback
                players: p.players && p.players.length > 0
                    ? p.players[0]
                    : { nickname: "Unknown" },
            }));

            setPlayers(mapped);
        };

        fetchPlayers();

        // Set up Realtime subscription
        const channel = supabase
            .channel(`room_players:${roomId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
                (payload) => {
                    console.log("Realtime update:", payload);
                    // Fetch updated list (or update state based on payload)
                    fetchPlayers();
                }
            )
            .subscribe();

        // Synchronous cleanup function
        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    return (
        <div>
            <br /><br /><br /><br />
            <h2>Waiting Room</h2>
            <ul>
                {players.map((p) => (
                    <li key={p.player_id}>
                        {p.players.nickname} {p.is_host ? "(Host)" : ""}
                    </li>
                ))}
            </ul>
        </div>
    );
}
