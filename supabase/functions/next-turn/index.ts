import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { room_id } = await req.json();
    if (!room_id) {
      return new Response(JSON.stringify({ error: "Missing room_id" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const supabase = getServiceClient();

    // Check if the turn timer has expired (optional but good)
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, turn_player_id, last_turn_started_at")
      .eq("id", room_id)
      .single();

    if (roomError) throw roomError;

    // Optional:  set your turn duration in seconds
    const TURN_DURATION = 30;
    const now = new Date();
    const lastTurn = new Date(room.last_turn_started_at);
    const secondsPassed = (now.getTime() - lastTurn.getTime()) / 1000;

    if (secondsPassed < TURN_DURATION) {
      return new Response(
        JSON.stringify({ message: "Turn not expired yet" }),
        { headers: corsHeaders, status: 200 }
      );
    }

    // Call fn_advance_turn to update next player
    const { error: advanceError } = await supabase.rpc("fn_advance_turn", {
      p_room: room_id,
    });

    if (advanceError) throw advanceError;

    return new Response(
      JSON.stringify({ success: true, message: "Advanced to next turn" }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (error) {
    console.error("auto-next-turn error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
