import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import getServiceClient from "../_shared/helpers.ts";

serve(async (req) => {
  try {
    const { room_id, player_id, room_card_id, chosen_color } = await req.json();
    const supabase = getServiceClient();

    const { data, error } = await supabase.rpc("fn_play_card", {
      p_room: room_id,
      p_player: player_id,
      p_room_card: room_card_id,
      p_chosen_color: chosen_color ?? null,
    });

    if (error) throw error;
    return new Response(
      JSON.stringify({ ok: true, result: (data?.[0] ?? data) }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error
      ? e.message
      : typeof e === "string"
      ? e
      : JSON.stringify(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
    });
  }
});
