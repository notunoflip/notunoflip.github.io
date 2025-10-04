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
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX one_room_per_host ON public.rooms(host_id);
CREATE INDEX idx_rooms_code ON public.rooms(code);

-- === ROOM_CARDS (instances in a room) ===
CREATE TABLE public.room_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  owner_id uuid,
  location text CHECK (location IN ('deck','discard','hand')) NOT NULL,
  order_index int
);
CREATE INDEX idx_room_cards_room_order ON public.room_cards(room_id,location,order_index DESC);

-- === PLAYERS ===
CREATE TABLE public.players (
  id uuid PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  nickname text NOT NULL,
  is_host boolean DEFAULT false,
  is_anonymous boolean DEFAULT false,
  order_index integer DEFAULT 0
);

-- RLS ===========================================================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cards ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY room_insert_anyone ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY room_select_if_member ON public.rooms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id = rooms.id
      AND (p.id = auth.uid() OR auth.uid() IS NULL)
  )
);
CREATE POLICY room_update_host ON public.rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id = rooms.id AND p.is_host = true
      AND (p.id = auth.uid() OR auth.uid() IS NULL)
  )
);

-- Players policies
CREATE POLICY players_insert_anyone ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY players_select_room ON public.players FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY players_update_self ON public.players FOR UPDATE USING (id = auth.uid());

-- Cards policies
CREATE POLICY cards_read_all ON public.cards FOR SELECT USING (true);

-- Room cards policies
CREATE POLICY room_cards_select_room ON public.room_cards FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY room_cards_service_insert ON public.room_cards FOR INSERT WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.rooms FROM anon;
REVOKE ALL ON TABLE public.room_cards FROM anon;
GRANT SELECT ON TABLE public.rooms TO anon;
GRANT SELECT ON TABLE public.players TO anon;
GRANT SELECT ON TABLE public.room_cards TO anon;
GRANT SELECT ON TABLE public.cards TO anon;
