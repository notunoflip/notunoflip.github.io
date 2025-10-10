// _shared/helpers.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

/* ---------- SUPABASE CLIENT ---------- */
export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- AUTH ---------- */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = getServiceClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: jsonError("Invalid token", 401) };
  }

  return { user, token };
}

/* ---------- RESPONSE HELPERS ---------- */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 400) {
  return json({ error: message }, status);
}

/* ---------- UTILS ---------- */
export async function parseJSONBody<T = Record<string, unknown>>(req: Request) {
  try {
    return await req.json() as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function randomRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
