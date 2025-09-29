// supabase/functions/create-room/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import getServiceClient from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { playerName } = await req.json();
    if (!playerName) {
      return new Response("Missing playerName", { status: 400, headers: corsHeaders });
    }

    const supabase = getServiceClient();

    // 🎲 Generate a 6-char room code
    const roomCode = Math.random().toString(36).substring(2, 5).toUpperCase();

    // ✅ Create the room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert([{ code: roomCode }]) // no "state", defaults handle started=false, side=light, etc.
      .select()
      .single();

    if (roomError) {
      return new Response(roomError.message, { status: 500, headers: corsHeaders });
    }

    // ✅ Create the host player (anonymous allowed)
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert([{
        room_id: room.id,
        nickname: playerName,
        is_host: true,
        is_anonymous: true,
        order_index: 0
      }])
      .select()
      .single();

    if (playerError) {
      return new Response(playerError.message, { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ room, player }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
