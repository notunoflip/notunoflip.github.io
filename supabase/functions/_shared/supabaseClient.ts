// _shared/supabaseClient.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Export a function that returns a Supabase client
export default function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
