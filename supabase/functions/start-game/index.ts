import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

serve(async (req) => {
  try {
    const { room_id, player_id, cards_per_player } = await req.json();
    const supabase = getServiceClient();

    // verify host
    const { data: hostRow, error: hostErr } = await supabase
      .from("rooms").select("host_id").eq("id", room_id).single();
    if (hostErr || !hostRow) {
      return new Response(JSON.stringify({ error: "room not found" }), {
        status: 404,
      });
    }
    if (hostRow.host_id !== player_id) {
      return new Response(JSON.stringify({ error: "only host can start" }), {
        status: 403,
      });
    }

    // Example: require at least 2 players to start
    const { count, error: countError } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);
    if (countError) return new Response(countError.message, { status: 500 });
    if ((count ?? 0) < 2) {
      return new Response("Not enough players", { status: 400 });
    }

    const { error } = await supabase.rpc("fn_start_game", {
      p_room: room_id,
      p_cards_per_player: cards_per_player ?? 7,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
    });
  }
});
