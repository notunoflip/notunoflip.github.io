import { corsHeaders } from "../_shared/cors.ts";
import {
  getServiceClient,
  requireUser,
  parseJSONBody,
  json,
  jsonError,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 🔑 Authenticate user
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    // 🧠 Parse JSON body
    const { roomId } = await parseJSONBody<{ roomId: string }>(req);
    if (!roomId || typeof roomId !== "string") {
      return jsonError("Missing or invalid roomId", 400);
    }

    const supabase = getServiceClient();

    // 🧹 Remove player from room_players
    const { error: leaveError } = await supabase
      .from("room_players")
      .delete()
      .eq("room_id", roomId)
      .eq("player_id", user.id);

    if (leaveError) {
      console.error("leaveError", leaveError);
      return jsonError(leaveError.message, 500);
    }

    // 🏠 Check if user was host
    const { data: hostCheck, error: hostCheckError } = await supabase
      .from("rooms")
      .select("id, host_id")
      .eq("id", roomId)
      .single();

    if (hostCheckError) {
      console.error("hostCheckError", hostCheckError);
      return jsonError(hostCheckError.message, 500);
    }

    if (hostCheck && hostCheck.host_id === user.id) {
      // 🧨 Host leaving → delete room (cascade removes players/cards)
      const { error: roomDeleteError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (roomDeleteError) {
        console.error("roomDeleteError", roomDeleteError);
        return jsonError(roomDeleteError.message, 500);
      }

      return json({ message: "Host left — room deleted." }, 200);
    }

    // ✅ Success for non-host
    return json({ message: "Player left room successfully." }, 200);

  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonError(String(err), 500);
  }
});
