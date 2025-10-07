import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function RoomsList({ nickname }: { nickname: string }) {
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, code, started, created_at");

      if (!error && data) setRooms(data);
    };
    fetchRooms();
  }, []);

  return (
    <div className="p-4">
      <h2 className="font-bold mb-2">Welcome {nickname} 👋</h2>
      <ul className="space-y-2">
        {rooms.map((r) => (
          <li key={r.id} className="border rounded p-2">
            <p>Code: {r.code}</p>
            <p>Status: {r.started ? "In Progress" : "Waiting"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
