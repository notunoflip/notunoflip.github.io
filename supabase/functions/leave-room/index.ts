// supabase/functions/leave-room.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import getServiceClient from "../_shared/supabaseClient.ts";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const supabase = getServiceClient(authHeader);

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or missing user" }), { status: 401 });
    }

    const playerId = user.id;

    // Find the player’s current room
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("room_id")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError || !player?.room_id) {
      return new Response(JSON.stringify({ error: "Player not in a room" }), { status: 400 });
    }

    const roomId = player.room_id;

    // Fetch room and all players
    const { data: room } = await supabase
      .from("rooms")
      .select("host_id")
      .eq("id", roomId)
      .maybeSingle();

    const { data: players } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", roomId);

    // Remove this player from room
    await supabase.from("players").update({ room_id: null }).eq("id", playerId);

    // If host leaves
    if (room?.host_id === playerId) {
      const remaining = players?.filter((p) => p.id !== playerId);
      if (remaining?.length === 0) {
        await supabase.from("rooms").delete().eq("id", roomId);
        return new Response(JSON.stringify({ success: true, message: "Room deleted" }), { status: 200 });
      } else {
        await supabase.from("rooms").update({ host_id: remaining[0].id }).eq("id", roomId);
        return new Response(JSON.stringify({ success: true, message: "Host transferred" }), { status: 200 });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Left room" }), { status: 200 });
  } catch (err) {
    console.error("leave-room error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
});
