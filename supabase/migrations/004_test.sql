-- migrations/20251010_create_room_players_view.sql
CREATE OR REPLACE VIEW public.room_players_view AS
SELECT
  rp.id,
  rp.room_id,
  rp.player_id,
  rp.is_host,
  rp.is_spectator,
  p.nickname
FROM public.room_players rp
JOIN public.players p ON rp.player_id = p.id;


ALTER TABLE public.room_players_view ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_any_room_players
ON public.room_players_view
FOR SELECT
USING (true);
