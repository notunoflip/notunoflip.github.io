import { corsHeaders } from "../_shared/cors.ts";
import {
  getServiceClient,
  requireUser,
  parseJSONBody,
  json,
  jsonError,
} from "../_shared/helpers.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {

    
    return new Response(null, { headers: corsHeaders });
  }

  // ✅ Authenticate user from token
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;


  try {
    const { room_id, cards_per_player } = await parseJSONBody<{
      room_id: string;
      cards_per_player?: number;
    }>(req);

    if (!room_id) return jsonError("Missing room_id", 400);

    const supabase = getServiceClient();

    // ✅ Verify that user is the host of the room
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("host_id")
      .eq("id", room_id)
      .single();

    if (roomErr || !room) {
      return jsonError("Room not found", 404);
    }

    if (room.host_id !== user.id) {
      return jsonError("Only host can start the game", 403);
    }


    // ✅ Check player count (minimum 2)
    const { count, error: countErr } = await supabase
      .from("room_players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room_id);

    if (countErr) {
      return jsonError(countErr.message, 500);
    }

    if ((count ?? 0) < 2) {
      return jsonError("Not enough players to start the game", 400);
    }

    // ✅ Call the RPC to start the game
    const { error: rpcErr } = await supabase.rpc("fn_start_game", {
      p_room: room_id,
      p_cards_per: cards_per_player ?? 7,
    });

    if (rpcErr) {
      console.error("RPC error:", rpcErr);
      return jsonError(rpcErr.message, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("Start game failed:", err);
    return jsonError(err.message ?? "Internal server error", 500);
  }
});
