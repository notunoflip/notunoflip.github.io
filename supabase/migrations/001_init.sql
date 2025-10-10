-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'side') THEN
    CREATE TYPE side AS ENUM ('light','dark');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'direction') THEN
    CREATE TYPE direction AS ENUM ('clockwise','counterclockwise');
  END IF;
END$$;

-- TABLES ========================================================================

-- === CARDS ===
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  light_color text,
  light_value text,
  dark_color text,
  dark_value text,
  is_wild boolean DEFAULT false
);

-- === ROOMS ===
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_player_id uuid,
  current_side text DEFAULT 'light' CHECK (current_side IN ('light','dark')),
  current_card uuid,
  direction text DEFAULT 'clockwise' CHECK (direction IN ('clockwise','counterclockwise')),
  draw_stack int DEFAULT 0,
  started boolean DEFAULT false,
  private boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX one_room_per_host ON public.rooms(host_id);
CREATE INDEX idx_rooms_code ON public.rooms(code);

-- === ROOM_CARDS ===
CREATE TABLE public.room_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  owner_id uuid,
  location text CHECK (location IN ('deck','discard','hand')) NOT NULL,
  order_index int,
  turn_start timestamptz DEFAULT now(),
  turn_duration int DEFAULT 30 -- seconds per turn
);
CREATE INDEX idx_room_cards_room_order ON public.room_cards(room_id,location,order_index DESC);
CREATE INDEX IF NOT EXISTS idx_room_cards_room_id ON public.room_cards(room_id);
CREATE INDEX IF NOT EXISTS idx_room_cards_card_id ON public.room_cards(card_id);

-- === PLAYERS ===
CREATE TABLE public.players (
  id uuid PRIMARY KEY,
  nickname text UNIQUE NOT NULL CHECK (nickname ~ '^[a-z0-9]{3,10}$'),
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- === ROOM_PLAYERS ===
CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  is_host boolean DEFAULT false,
  is_spectator boolean DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

-- Ensure a player cannot join the same room twice
CREATE UNIQUE INDEX uniq_room_player ON public.room_players(room_id, player_id);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_player_id ON public.room_players(player_id);

-- RLS ===========================================================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cards ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- ROOMS
-- ==========================================================

CREATE POLICY room_insert_anyone
ON public.rooms
FOR INSERT
WITH CHECK (true);

CREATE POLICY room_select_public
ON public.rooms
FOR SELECT
USING (true);

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

-- ==========================================================
-- PLAYERS
-- ==========================================================

CREATE POLICY players_insert_anyone
ON public.players
FOR INSERT
WITH CHECK (true);

CREATE POLICY players_select_self
ON public.players
FOR SELECT
USING (id = (select auth.uid()));

CREATE POLICY players_update_self
ON public.players
FOR UPDATE
USING (id = (select auth.uid()));

-- ==========================================================
-- ROOM_PLAYERS
-- ==========================================================

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
);

CREATE POLICY room_players_select_self_or_host
ON public.room_players
FOR SELECT
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

-- Merge self and host update policies into one
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

-- ==========================================================
-- CARDS
-- ==========================================================

CREATE POLICY cards_read_all
ON public.cards
FOR SELECT
USING (true);

-- ==========================================================
-- ROOM_CARDS
-- ==========================================================

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

GRANT SELECT ON TABLE public.cards TO anon; -- okay for static data
