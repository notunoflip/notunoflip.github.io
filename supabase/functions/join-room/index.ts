import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import getServiceClient from "../_shared/supabaseClient.ts"; 


serve(async (req) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ msg: "Missing authorization header" }), { status: 401 });
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { roomCode, playerName } = await req.json();
    if (!roomCode || !playerName) {
      return new Response("Missing fields", { status: 400 });
    }

    // check room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();
    if (roomError || !room) {
      return new Response("Room not found", { status: 404 });
    }

    // update or insert player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        { id: user.id, room_id: room.id, nickname: playerName }, 
        { onConflict: "id" }
      )
      .select()
      .single();

    if (playerError) {
      console.error(playerError);
      return new Response(playerError.message, { status: 500 });
    }

    return new Response(JSON.stringify({ room, player }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ msg: errorMessage }), {
      status: 500,
    });
  }
});
