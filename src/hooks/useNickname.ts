import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

export function useNickname() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNickname = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNickname(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast.error("Failed to load nickname");
    }

    setNickname(data?.nickname ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchNickname();
  }, []);

  return {
    nickname,
    loading,
    refreshNickname: fetchNickname, // <-- add this
    setNickname, // still allowed for internal UI state if needed
  };
}
