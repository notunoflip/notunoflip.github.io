import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

serve(async (req) => {
  try {
    const { room_id, player_id, count = 1 } = await req.json();
    const supabase = getServiceClient();
    const { error } = await supabase.rpc("fn_player_draw", {
      p_room: room_id,
      p_player: player_id,
      p_n: count,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 400,
    });
  }
});
