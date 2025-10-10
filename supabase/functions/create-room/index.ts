import { corsHeaders } from "../_shared/cors.ts";
import {
  getServiceClient,
  requireUser,
  json,
  jsonError,
  parseJSONBody,
  randomRoomCode,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 🔑 Authenticate user
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    // 🧠 Parse and validate input
    const { playerName } = await parseJSONBody<{ playerName: string }>(req);
    if (!playerName || !/^[a-z0-9]{3,10}$/i.test(playerName)) {
      return jsonError("Invalid or missing playerName", 400);
    }

    const supabase = getServiceClient();

    // 🧑‍🎮 Upsert player record
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        {
          id: user.id,
          nickname: playerName,
          is_anonymous: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (playerError) {
      console.error("playerError", playerError);
      return jsonError(playerError.message, 500);
    }

    // 🎲 Create or reuse host room
    const roomCode = randomRoomCode();
    const { data: newRoom, error: roomError } = await supabase
      .from("rooms")
      .insert([{ code: roomCode, host_id: user.id }])
      .select()
      .single();

    let room = newRoom;
    if (roomError) {
      if (roomError.code === "23505") {
        // host already has a room
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select()
          .eq("host_id", user.id)
          .single();
        room = existingRoom;
      } else {
        console.error("roomError", roomError);
        return jsonError(roomError.message, 500);
      }
    }

    // 🧩 Link player → room
    const { data: roomPlayer, error: linkError } = await supabase
      .from("room_players")
      .upsert(
        {
          room_id: room.id,
          player_id: user.id,
          is_host: true,
          is_spectator: false,
        },
        { onConflict: "room_id,player_id" },
      )
      .select()
      .single();

    if (linkError) {
      console.error("linkError", linkError);
      return jsonError(linkError.message, 500);
    }

    // ✅ Success
    return json({ room, player, roomPlayer });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonError(String(err), 500);
  }
});
