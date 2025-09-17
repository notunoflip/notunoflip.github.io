import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { roomCode, playerName } = await req.json();
  if (!roomCode || !playerName) {
    return new Response("Missing fields", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", roomCode)
    .single();
  if (roomError || !room) {
    return new Response("Room not found", { status: 404 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert([{ room_id: room.id, name: playerName }])
    .select()
    .single();
  if (playerError) return new Response(playerError.message, { status: 500 });

  return new Response(JSON.stringify({ room, player }), {
    headers: { "Content-Type": "application/json" },
  });
});
