import { corsHeaders } from "../_shared/cors.ts";
import getServiceClient from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    // 🔑 Extract token
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // ✅ Get auth user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    const { playerName } = await req.json();
    if (!playerName || !/^[a-z0-9]{3,10}$/.test(playerName)) {
      return new Response("Invalid or missing playerName", { status: 400, headers: corsHeaders });
    }

    // 🧑‍🎮 Ensure player record exists
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        {
          id: user.id,
          nickname: playerName,
          is_anonymous: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (playerError) {
      console.error("playerError", playerError);
      return new Response(JSON.stringify({ error: playerError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 🎲 Generate unique room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 🏠 Create new room (one per host enforced by DB)
    let room;
    const { data: newRoom, error: roomError } = await supabase
      .from("rooms")
      .insert([{ code: roomCode, host_id: user.id }])
      .select()
      .single();

    if (roomError) {
      if (roomError.code === "23505") {
        // host already has a room
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select()
          .eq("host_id", user.id)
          .single();
        room = existingRoom;
      } else {
        console.error("roomError", roomError);
        return new Response(JSON.stringify({ error: roomError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    } else {
      room = newRoom;
    }

    // 🧩 Link player → room in room_players (as host)
    const { data: roomPlayer, error: linkError } = await supabase
      .from("room_players")
      .upsert(
        {
          room_id: room.id,
          player_id: user.id,
          is_host: true,
          is_spectator: false,
        },
        { onConflict: "room_id,player_id" }
      )
      .select()
      .single();

    if (linkError) {
      console.error("linkError", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ room, player, roomPlayer }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
