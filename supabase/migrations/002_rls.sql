-- ==========================================================
-- RLS POLICIES
-- ==========================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cards ENABLE ROW LEVEL SECURITY;


-- === ROOMS ================================================

-- checks one host one room through the unique index
-- TODO make it impossible to create/join room if already in another room
CREATE POLICY room_insert_anyone
ON public.rooms
FOR INSERT
WITH CHECK (true);

CREATE POLICY room_select_public
ON public.rooms
FOR SELECT
USING (true);

-- Not sure if this works
CREATE POLICY room_update_host
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.room_players rp
    WHERE rp.room_id = rooms.id
      AND rp.player_id = (select auth.uid())
      AND rp.is_host = true
  )
);


-- === PLAYERS ==============================================

CREATE POLICY players_insert_authenticated
ON public.players
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND id = auth.uid()
);

CREATE POLICY players_select_all
ON public.players
FOR SELECT
USING (true);

CREATE POLICY players_update_self
ON public.players
FOR UPDATE
USING (id = (select auth.uid()));


-- === ROOM_PLAYERS =========================================

-- TODO fix recursive
CREATE POLICY room_players_insert_self
ON public.room_players
FOR INSERT
WITH CHECK (
  player_id = (select auth.uid())
  AND (
    SELECT COUNT(*)
    FROM public.room_players rp
    WHERE rp.room_id = room_players.room_id
      AND rp.is_spectator = false
  ) < 6
--   AND (
--     -- Allow host insert only if no host exists
--     NOT room_players.is_host
--     OR NOT EXISTS (
--       SELECT 1
--       FROM public.room_players rp2
--       WHERE rp2.room_id = room_players.room_id
--         AND rp2.is_host = true
--     )
--   )
);

-- Maybe fix in future
CREATE POLICY room_players_select_same_room
ON public.room_players
FOR SELECT
USING 
( true
--   room_id IN (
--     SELECT room_id
--     FROM public.room_players rp
--     WHERE rp.player_id = (select auth.uid())
--   )
);

CREATE POLICY room_players_update_self_or_host
ON public.room_players
FOR UPDATE
USING (
  player_id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.room_players rp
    WHERE rp.room_id = room_players.room_id
      AND rp.player_id = (select auth.uid())
      AND rp.is_host = true
  )
);


-- === CARDS ================================================

CREATE POLICY cards_read_all
ON public.cards
FOR SELECT
USING (true);


-- === ROOM_CARDS ===========================================

CREATE POLICY room_cards_select_room
ON public.room_cards
FOR SELECT
USING (
  room_id IN (
    SELECT room_id
    FROM public.room_players
    WHERE player_id = (select auth.uid())
  )
);

CREATE POLICY room_cards_service_insert
ON public.room_cards
FOR INSERT
WITH CHECK ((select auth.role()) = 'service_role');


-- ==========================================================
-- GRANTS
-- ==========================================================

REVOKE ALL ON TABLE public.rooms FROM anon;
REVOKE ALL ON TABLE public.players FROM anon;
REVOKE ALL ON TABLE public.room_players FROM anon;
REVOKE ALL ON TABLE public.room_cards FROM anon;
REVOKE ALL ON TABLE public.cards FROM anon;

GRANT SELECT ON TABLE public.cards TO authenticated;
GRANT SELECT ON public.players TO authenticated;