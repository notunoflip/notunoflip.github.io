import { corsHeaders } from "../_shared/cors.ts";
import getServiceClient from "../_shared/supabaseClient.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id, player_id, cards_per_player } = await req.json();
    const supabase = getServiceClient();

    // Verify host
    const { data: hostRow, error: hostErr } = await supabase
      .from("rooms")
      .select("host_id")
      .eq("id", room_id)
      .single();

    if (hostErr || !hostRow) {
      return new Response(JSON.stringify({ error: "room not found" }), {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if (hostRow.host_id !== player_id) {
      return new Response(JSON.stringify({ error: "only host can start" }), {
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Require at least 2 players
    const { count, error: countError } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id);

    if (countError) {
      return new Response(JSON.stringify({ error: countError.message }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if ((count ?? 0) < 2) {
      return new Response(JSON.stringify({ error: "Not enough players" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Start game RPC
    const { error } = await supabase.rpc("fn_start_game", {
      p_room: room_id,
      p_cards_per_player: cards_per_player ?? 7,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});
