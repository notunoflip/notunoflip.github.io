import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { playerName } = await req.json();
  if (!playerName) return new Response("Missing playerName", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Generate a random 6-char code
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: room, error } = await supabase
    .from("rooms")
    .insert([{ code: roomCode, state: "lobby" }])
    .select()
    .single();
  if (error) return new Response(error.message, { status: 500 });

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert([{ room_id: room.id, name: playerName, is_host: true }])
    .select()
    .single();
  if (playerError) return new Response(playerError.message, { status: 500 });

  return new Response(JSON.stringify({ room, player }), {
    headers: { "Content-Type": "application/json" },
  });
});
