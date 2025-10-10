import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import {
  getServiceClient,
  requireUser,
  parseJSONBody,
  json,
  jsonError,
} from "../_shared/helpers.ts";

serve(async (req) => {
  try {
    // 🔒 Auth check
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    // 🧾 Parse JSON body
    const { roomCode, playerName } = await parseJSONBody<{
      roomCode: string;
      playerName: string;
    }>(req);

    if (!roomCode || !playerName) {
      return jsonError("Missing fields: roomCode and playerName", 400);
    }

    const supabase = getServiceClient();

    // 🎮 Check if room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();

    if (roomError || !room) {
      return jsonError("Room not found", 404);
    }

    // 🧍 Ensure player exists (create or update nickname)
    const { data: existingPlayer, error: playerFetchErr } = await supabase
      .from("players")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (playerFetchErr) {
      console.error(playerFetchErr);
      return jsonError("Failed to fetch player", 500);
    }

    if (!existingPlayer) {
      const { error: insertErr } = await supabase
        .from("players")
        .insert({ id: user.id, nickname: playerName });

      if (insertErr) {
        console.error(insertErr);
        return jsonError("Failed to create player", 500);
      }
    } else if (existingPlayer.nickname !== playerName) {
      const { error: updateErr } = await supabase
        .from("players")
        .update({ nickname: playerName, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateErr) {
        console.error(updateErr);
        return jsonError("Failed to update nickname", 500);
      }
    }

    // 🔗 Join room (insert into room_players)
    const { data: existingMembership } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id)
      .eq("player_id", user.id)
      .maybeSingle();

    if (!existingMembership) {
      const { error: joinErr } = await supabase.from("room_players").insert({
        room_id: room.id,
        player_id: user.id,
      });

      if (joinErr) {
        console.error(joinErr);
        if (joinErr.message.includes("uniq_room_player")) {
          return jsonError("Already joined this room", 400);
        }
        return jsonError("Failed to join room", 500);
      }
    }

    // ✅ Success
    return json({ room, playerId: user.id });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(message, 500);
  }
});
