// supabase/functions/leave-room.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import getServiceClient from "../_shared/supabaseClient.ts";


serve(async (req) => {
    try {
        const supabase = getServiceClient();
        
        const { playerId } = await req.json();
        if (!playerId) {
            return new Response(JSON.stringify({ error: "Missing playerId" }), { status: 400 });
        }

        // Find the player and their room
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("id, room_id")
            .eq("id", playerId)
            .maybeSingle();

        if (playerError || !player?.room_id) {
            return new Response(JSON.stringify({ error: "Player not in a room" }), { status: 400 });
        }

        const roomId = player.room_id;

        // Find the room
        const { data: room, error: roomError } = await supabase
            .from("rooms")
            .select("id, host_id")
            .eq("id", roomId)
            .maybeSingle();

        if (roomError || !room) {
            return new Response(JSON.stringify({ error: "Room not found" }), { status: 404 });
        }

        // Get all players in the room
        const { data: players, error: playersError } = await supabase
            .from("players")
            .select("id")
            .eq("room_id", roomId);

        if (playersError) {
            return new Response(JSON.stringify({ error: "Failed to fetch players" }), { status: 500 });
        }

        // Remove this player from the room
        await supabase
            .from("players")
            .update({ room_id: null })
            .eq("id", playerId);

        if (room.host_id === playerId) {
            // If host is leaving
            const remainingPlayers = players.filter((p) => p.id !== playerId);

            if (remainingPlayers.length === 0) {
                // Delete the room if empty
                await supabase.from("rooms").delete().eq("id", roomId);
                return new Response(JSON.stringify({ success: true, message: "Room deleted" }), { status: 200 });
            } else {
                // Transfer host to first remaining player
                const newHostId = remainingPlayers[0].id;
                await supabase
                    .from("rooms")
                    .update({ host_id: newHostId })
                    .eq("id", roomId);

                return new Response(
                    JSON.stringify({ success: true, message: "Host transferred", newHostId }),
                    { status: 200 }
                );
            }
        }

        return new Response(JSON.stringify({ success: true, message: "Player left room" }), { status: 200 });

    } catch (err) {
        console.error("leave-room error:", err);
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
    }
});
