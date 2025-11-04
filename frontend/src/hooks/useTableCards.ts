import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import type { PlayerCard } from "../lib/types";

export function useTableCards(session: any, roomId?: string, started?: boolean) {
  const [tableCards, setTableCards] = useState<PlayerCard[]>([]);

  useEffect(() => {
    if (!session || !roomId || !started) return;

    const fetchTableCards = async () => {
      const { data, error } = await supabase
        .from("secure_room_cards")
        .select("room_card_id, owner_id, nickname, visible_card")
        .eq("room_id", roomId);

      if (error) return toast.error("Could not fetch table cards");

      const formatted = data.map((c: any) => {
        const vc = c.visible_card ?? {};
        const def = { color: "black", value: null };
        let light = def;
        let dark = def;

        if (vc.light || vc.dark) {
          light = { color: vc.light?.color ?? "black", value: vc.light?.value ?? null };
          dark = { color: vc.dark?.color ?? "black", value: vc.dark?.value ?? null };
        } else if (vc.side === "light" || vc.side === "dark") {
          const sideData = { color: vc.color ?? "black", value: vc.value ?? null };
          if (vc.side === "light") light = sideData;
          else dark = sideData;
        }

        return { ...c, visible_card: { light, dark } };
      });

      setTableCards(formatted);
    };

    fetchTableCards();
  }, [session, roomId, started]);

  return { tableCards, setTableCards };
}
