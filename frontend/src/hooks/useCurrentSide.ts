import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useCurrentSide(roomId?: string) {
    const [currentSide, setCurrentSide] = useState<"light" | "dark">("light");

    // Sync DOM theme with side
    useEffect(() => {
        const shouldBeDark = currentSide === "dark";
        document.documentElement.classList.toggle("dark", shouldBeDark);
    }, [currentSide]);

    useEffect(() => {
        if (!roomId) return;

        const fetchSide = async () => {
            const { data } = await supabase
                .from("rooms")
                .select("current_side")
                .eq("id", roomId)
                .maybeSingle();

            if (data?.current_side === "light" || data?.current_side === "dark") {
                setCurrentSide(data.current_side);
            }
        };

        // Initial fetch
        fetchSide();

        // Subscribe to DB changes
        const channel = supabase
            .channel(`room-${roomId}-side`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rooms",
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    const side = payload.new.current_side;
                    if (side === "light" || side === "dark") {
                        setCurrentSide(side);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    return { currentSide, setCurrentSide };
}
