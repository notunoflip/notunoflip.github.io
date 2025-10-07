import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

export function useNickname() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNickname = async () => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        setLoading(false);
        return;
      }
    //   console.log(user)

      const { data, error } = await supabase
        .from("players")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load nickname");
        console.error(error);
      } else {
        setNickname(data?.nickname ?? null);
      }
      setLoading(false);
    };

    fetchNickname();
  }, []);

  return { nickname, setNickname, loading };
}
