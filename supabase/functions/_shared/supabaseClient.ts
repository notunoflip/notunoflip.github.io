// supabase/functions/_shared/supabaseClient.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default function getServiceClient(authHeader?: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // If auth header is passed, use it for user context
  return createClient(url, serviceKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: { persistSession: false }, // for serverside fn
  });
}
