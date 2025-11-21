-- ==========================================================
-- EXTENSIONS
-- ==========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ==========================================================
-- ENUMS
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'side') THEN
    CREATE TYPE side AS ENUM ('light','dark');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'direction') THEN
    CREATE TYPE direction AS ENUM ('clockwise','counterclockwise');
  END IF;
END$$;


-- ==========================================================
-- TABLES
-- ==========================================================

-- === CARDS =================================================
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  light_color text,
  light_value text,
  dark_color text,
  dark_value text
);


-- === ROOMS =================================================
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_player_id uuid,
  current_side text DEFAULT 'light' CHECK (current_side IN ('light','dark')),
  current_card uuid,
  direction text DEFAULT 'clockwise' CHECK (direction IN ('clockwise','counterclockwise')),
  draw_stack int DEFAULT 0,
  started_game boolean DEFAULT false,
  skip_next boolean DEFAULT false,
  private_game boolean DEFAULT false,
  wild_color text, 
  created_at timestamptz DEFAULT now(),
  last_turn_started_at timestamptz DEFAULT now(),
  turn_duration int DEFAULT 30
);
CREATE UNIQUE INDEX one_room_per_host ON public.rooms(host_id);
CREATE INDEX idx_rooms_code ON public.rooms(code);


-- === PLAYERS ===============================================
CREATE TABLE public.players (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text UNIQUE NOT NULL CHECK (nickname ~ '^[a-z0-9]{3,10}$'),
  is_anonymous boolean DEFAULT false, -- may delete in future
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- === ROOM_PLAYERS ==========================================
CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  is_host boolean DEFAULT false,
  is_ready boolean DEFAULT false,
  is_spectator boolean DEFAULT false,
  joined_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uniq_room_player ON public.room_players(room_id, player_id);
CREATE INDEX idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX idx_room_players_player_id ON public.room_players(player_id);


-- === ROOM_CARDS ============================================
CREATE TABLE public.room_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  owner_id uuid,
  pile text CHECK (pile IN ('deck','discard','hand')) NOT NULL,
  order_index int
);
CREATE INDEX idx_room_cards_room_order ON public.room_cards(room_id, pile, order_index DESC);
CREATE INDEX idx_room_cards_room_id ON public.room_cards(room_id);
CREATE INDEX idx_room_cards_card_id ON public.room_cards(card_id);


-- ==========================================================
-- SECURE VIEW
-- ==========================================================

-- Returns only visible card information depending on ownership and room side
CREATE OR REPLACE VIEW public.secure_room_cards AS
SELECT
    rc.id AS room_card_id,
    rc.room_id,
    rc.card_id,
    rc.owner_id,
    p.nickname,
    rc.pile,
    rc.order_index,
    CASE
        -- 🟢 Player’s own hand: show both sides
        WHEN rc.pile = 'hand' AND rc.owner_id = auth.uid() THEN
            jsonb_build_object(
                'light', jsonb_build_object('color', c.light_color, 'value', c.light_value),
                'dark',  jsonb_build_object('color', c.dark_color,  'value', c.dark_value)
            )

        -- 🟣 Other players’ hand cards: hidden
        WHEN rc.pile = 'hand' THEN
            jsonb_build_object(
                'side', CASE WHEN rooms.current_side = 'light' THEN 'dark' ELSE 'light' END,
                'color', CASE WHEN rooms.current_side = 'light' THEN c.dark_color ELSE c.light_color END,
                'value', CASE WHEN rooms.current_side = 'light' THEN c.dark_value ELSE c.light_value END
            )

        ELSE NULL
    END AS visible_card
FROM public.room_cards rc
JOIN public.cards c ON c.id = rc.card_id
JOIN public.rooms rooms ON rooms.id = rc.room_id
LEFT JOIN public.players p ON p.id = rc.owner_id
WHERE rc.pile IN ('hand')
ORDER BY rc.pile, rc.order_index ASC;



-- Enable realtime replication for your tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_cards