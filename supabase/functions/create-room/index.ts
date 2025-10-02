import { corsHeaders } from "../_shared/cors.ts";
import getServiceClient from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    // 🔑 Extract JWT token from headers
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // ✅ Get user info
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    const { playerName } = await req.json();
    if (!playerName) {
      return new Response("Missing playerName", { status: 400, headers: corsHeaders });
    }

    // 🎲 Generate room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 🟢 Ensure player exists or update name if re-creating
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        {
          id: user.id, // stable auth.uid
          nickname: playerName,
          is_host: true,
          is_anonymous: false,
          order_index: 0,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (playerError) {
      return new Response(playerError.message, { status: 500, headers: corsHeaders });
    }

    // 🟢 Try inserting the room
    let room;
    const { data: newRoom, error: roomError } = await supabase
      .from("rooms")
      .insert([{ code: roomCode, host_id: user.id }])
      .select()
      .single();

    if (roomError) {
      // Handle unique constraint violation → return existing room
      if (roomError.code === "23505") {
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select()
          .eq("host_id", user.id)
          .single();
        room = existingRoom;
      } else {
        return new Response(roomError.message, { status: 500, headers: corsHeaders });
      }
    } else {
      room = newRoom;
    }

    // 🟢 Link player to room
    await supabase.from("players").update({ room_id: room.id }).eq("id", user.id);

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
