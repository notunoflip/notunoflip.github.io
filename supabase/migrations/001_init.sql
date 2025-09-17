-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- TABLES ========================================================================

-- === ROOMS ===
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL,
  turn_player_id uuid,
  current_side text DEFAULT 'light', -- 'light' | 'dark'
  started boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- === PLAYERS ===
CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NULL,
  nickname text,
  is_host boolean DEFAULT false,
  is_anonymous boolean DEFAULT true,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_room ON public.players(room_id);

-- === CARDS ===
CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  light_color text,
  light_value text,
  dark_color text,
  dark_value text,
  is_wild boolean DEFAULT false
);

-- === ROOM_CARDS ===
CREATE TABLE IF NOT EXISTS public.room_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id),
  location text NOT NULL CHECK (location IN ('deck','discard','hand')),
  owner_id uuid REFERENCES public.players(id),
  order_index int
);
CREATE INDEX IF NOT EXISTS idx_room_cards_room ON public.room_cards(room_id);

-- === GAME_STATE ===
CREATE TABLE IF NOT EXISTS public.game_state (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_color text,
  current_value text,
  flip_mode boolean DEFAULT false,
  direction text DEFAULT 'clockwise',
  draw_stack int DEFAULT 0,
  last_played_card uuid REFERENCES public.room_cards(id)
);

-- === ENABLE RLS ===
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;


-- Policies  ======================================================================

-- Rooms
CREATE POLICY room_insert_anyone ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY room_select_if_member ON public.rooms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.players p WHERE p.room_id = rooms.id AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
  )
);
CREATE POLICY room_update_host ON public.rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.players p WHERE p.room_id = rooms.id AND p.is_host = true AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
  )
);

-- Players
CREATE POLICY "players_insert_anyone" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_select_room" ON public.players FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE user_id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY "players_update_self" ON public.players FOR UPDATE USING (id = auth.uid());

-- Cards (metadata readable by everyone)
CREATE POLICY "cards_read_all" ON public.cards FOR SELECT USING (true);

-- Room cards (players in room can select; insertion restricted to service role)
CREATE POLICY "room_cards_select_room" ON public.room_cards FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE user_id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY "room_cards_service_insert" ON public.room_cards FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Game state (readable by players in same room; write via service role & fn)
CREATE POLICY "game_state_select_room" ON public.game_state FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE user_id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY "game_state_service_write" ON public.game_state FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "game_state_service_insert" ON public.game_state FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- restrict anon writes: still allow SELECTs to drive UI; write ops go through Edge Functions or service role
REVOKE ALL ON TABLE public.rooms FROM anon;
REVOKE ALL ON TABLE public.room_cards FROM anon;
REVOKE ALL ON TABLE public.game_state FROM anon;
GRANT SELECT ON TABLE public.rooms TO anon;
GRANT SELECT ON TABLE public.players TO anon;
GRANT SELECT ON TABLE public.room_cards TO anon;
GRANT SELECT ON TABLE public.game_state TO anon;
GRANT SELECT ON TABLE public.cards TO anon;




-- Helper Fn =======================================================================

-- fn_top_discard
CREATE OR REPLACE FUNCTION public.fn_top_discard(p_room uuid)
RETURNS public.room_cards AS $$
  SELECT rc.* FROM public.room_cards rc
   WHERE rc.room_id = p_room AND rc.location = 'discard'
   ORDER BY rc.order_index DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

-- fn_deck_count
CREATE OR REPLACE FUNCTION public.fn_deck_count(p_room uuid)
RETURNS int AS $$
  SELECT COUNT(*) FROM public.room_cards WHERE room_id = p_room AND location = 'deck';
$$ LANGUAGE sql STABLE;

-- fn_draw (draw N cards into player's hand; reshuffle discard -> deck if needed)
CREATE OR REPLACE FUNCTION public.fn_draw(p_room uuid, p_player uuid, p_n int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE need int := p_n;
        deck_left int;
        top_discard_id uuid;
BEGIN
  WHILE need > 0 LOOP
    SELECT public.fn_deck_count(p_room) INTO deck_left;
    IF deck_left = 0 THEN
      SELECT (public.fn_top_discard(p_room)).id INTO top_discard_id;
      UPDATE public.room_cards
        SET location='deck', owner_id = NULL, order_index = floor(random()*1000000)
        WHERE room_id = p_room AND location = 'discard' AND id <> top_discard_id;
      SELECT public.fn_deck_count(p_room) INTO deck_left;
      IF deck_left = 0 THEN
        RAISE NOTICE 'no cards available to draw';
        RETURN;
      END IF;
    END IF;
    UPDATE public.room_cards
      SET location='hand', owner_id = p_player, order_index = NULL
      WHERE id = (
        SELECT id FROM public.room_cards
         WHERE room_id = p_room AND location = 'deck'
         ORDER BY order_index DESC LIMIT 1
      );
    need := need - 1;
  END LOOP;
END;
$$;

-- fn_next_player
CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_from uuid, p_steps int DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE dir text;
        plist uuid[];
        idx int;
        n int;
        target int;
        next_id uuid;
BEGIN
  SELECT direction INTO dir FROM public.game_state WHERE room_id = p_room;
  SELECT array_agg(id ORDER BY order_index) INTO plist FROM public.players WHERE room_id = p_room;
  n := array_length(plist,1);
  IF n IS NULL OR n = 0 THEN RAISE EXCEPTION 'no players'; END IF;
  FOR idx IN 1..n LOOP
    IF plist[idx] = p_from THEN EXIT; END IF;
  END LOOP;
  IF idx IS NULL THEN RAISE EXCEPTION 'current player not found'; END IF;
  IF dir = 'clockwise' THEN
    target := ((idx - 1 + p_steps) % n) + 1;
  ELSE
    target := ((idx - 1 - p_steps) % n + n) % n + 1;
  END IF;
  next_id := plist[target];
  RETURN next_id;
END;
$$;

-- fn_build_deck
CREATE OR REPLACE FUNCTION public.fn_build_deck(p_room uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.room_cards WHERE room_id = p_room) THEN RETURN; END IF;
  INSERT INTO public.room_cards (room_id, card_id, location, order_index)
    SELECT p_room, id, 'deck', floor(random()*1000000) FROM public.cards;
END;
$$;

-- fn_start_game
CREATE OR REPLACE FUNCTION public.fn_start_game(p_room uuid, p_cards_per_player int DEFAULT 7)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pid uuid;
        first_card_row public.room_cards;
BEGIN
  PERFORM public.fn_build_deck(p_room);
  UPDATE public.room_cards SET order_index = floor(random()*1000000) WHERE room_id = p_room AND location='deck';
  INSERT INTO public.game_state (room_id) VALUES (p_room) ON CONFLICT (room_id) DO NOTHING;
  FOR pid IN SELECT id FROM public.players WHERE room_id = p_room ORDER BY order_index LOOP
    PERFORM public.fn_draw(p_room, pid, p_cards_per_player);
  END LOOP;
  UPDATE public.room_cards SET location='discard', order_index = 1 WHERE id = (
    SELECT id FROM public.room_cards WHERE room_id = p_room AND location='deck' ORDER BY order_index DESC LIMIT 1
  ) RETURNING * INTO first_card_row;
  UPDATE public.rooms SET current_side = COALESCE(current_side,'light') WHERE id = p_room;
  IF (SELECT current_side FROM public.rooms WHERE id = p_room) = 'light' THEN
    UPDATE public.game_state SET current_color = (SELECT light_color FROM public.cards WHERE id = first_card_row.card_id),
                                  current_value = (SELECT light_value FROM public.cards WHERE id = first_card_row.card_id)
    WHERE room_id = p_room;
  ELSE
    UPDATE public.game_state SET current_color = (SELECT dark_color FROM public.cards WHERE id = first_card_row.card_id),
                                  current_value = (SELECT dark_value FROM public.cards WHERE id = first_card_row.card_id)
    WHERE room_id = p_room;
  END IF;
  UPDATE public.rooms SET turn_player_id = (
    SELECT id FROM public.players WHERE room_id = p_room ORDER BY order_index LIMIT 1
  ), started = true WHERE id = p_room;
END;
$$;

-- fn_is_playable
CREATE OR REPLACE FUNCTION public.fn_is_playable(p_room uuid, p_room_card uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE side text;
        cid uuid;
        col text; val text;
        cur_col text; cur_val text;
        wild boolean;
BEGIN
  SELECT current_side INTO side FROM public.rooms WHERE id = p_room;
  SELECT card_id INTO cid FROM public.room_cards WHERE id = p_room_card;
  SELECT current_color, current_value INTO cur_col, cur_val FROM public.game_state WHERE room_id = p_room;
  SELECT is_wild INTO wild FROM public.cards WHERE id = cid;
  IF wild THEN RETURN true; END IF;
  IF side = 'light' THEN
    SELECT light_color, light_value INTO col, val FROM public.cards WHERE id = cid;
  ELSE
    SELECT dark_color, dark_value INTO col, val FROM public.cards WHERE id = cid;
  END IF;
  RETURN (col IS NOT DISTINCT FROM cur_col) OR (val IS NOT DISTINCT FROM cur_val);
END;
$$;

-- fn_play_card (big transactional function)
CREATE OR REPLACE FUNCTION public.fn_play_card(
  p_room uuid, p_player uuid, p_room_card uuid, p_chosen_color text DEFAULT NULL
)
RETURNS TABLE (
  next_player uuid,
  new_color text,
  new_value text,
  flip_mode boolean,
  draw_stack int,
  direction text
) LANGUAGE plpgsql AS $$
DECLARE side text; cid uuid; is_owner boolean; playable boolean;
        v_color text; v_value text; cur_player uuid; cur_dir text; stack int;
        skip_steps int := 1; target uuid;
BEGIN
  SELECT turn_player_id INTO cur_player FROM public.rooms WHERE id = p_room;
  IF cur_player IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'Not your turn'; END IF;
  SELECT (owner_id = p_player) INTO is_owner FROM public.room_cards WHERE id = p_room_card AND room_id = p_room AND location = 'hand';
  IF NOT is_owner THEN RAISE EXCEPTION 'Player does not own this card'; END IF;
  SELECT public.fn_is_playable(p_room, p_room_card) INTO playable;
  IF NOT playable THEN RAISE EXCEPTION 'Card not playable'; END IF;
  SELECT current_side INTO side FROM public.rooms WHERE id = p_room;
  SELECT card_id INTO cid FROM public.room_cards WHERE id = p_room_card;
  IF side = 'light' THEN SELECT light_color, light_value INTO v_color, v_value FROM public.cards WHERE id = cid;
  ELSE SELECT dark_color, dark_value INTO v_color, v_value FROM public.cards WHERE id = cid; END IF;
  -- move to discard
  UPDATE public.room_cards SET location = 'discard', owner_id = NULL,
    order_index = COALESCE((SELECT order_index FROM public.room_cards WHERE room_id = p_room AND location='discard' ORDER BY order_index DESC LIMIT 1),0) + 1
  WHERE id = p_room_card;
  -- wild chosen color
  IF (SELECT is_wild FROM public.cards WHERE id = cid) AND p_chosen_color IS NOT NULL THEN v_color := p_chosen_color; END IF;
  SELECT direction, draw_stack INTO cur_dir, stack FROM public.game_state WHERE room_id = p_room;
  IF v_value = 'reverse' THEN
    cur_dir := CASE WHEN cur_dir='clockwise' THEN 'counterclockwise' ELSE 'clockwise' END;
    UPDATE public.game_state SET direction = cur_dir WHERE room_id = p_room;
  ELSIF v_value = 'skip' THEN skip_steps := 2;
  ELSIF v_value = 'skip_everyone' THEN skip_steps := (SELECT count(*) FROM public.players WHERE room_id = p_room);
  ELSIF v_value = 'draw_one' THEN stack := stack + 1; UPDATE public.game_state SET draw_stack = stack WHERE room_id = p_room;
  ELSIF v_value = 'draw_five' THEN stack := stack + 5; UPDATE public.game_state SET draw_stack = stack WHERE room_id = p_room;
  ELSIF v_value = 'wild_draw_two' THEN stack := stack + 2; UPDATE public.game_state SET draw_stack = stack WHERE room_id = p_room;
  ELSIF v_value = 'flip' THEN UPDATE public.rooms SET current_side = CASE WHEN current_side='light' THEN 'dark' ELSE 'light' END WHERE id = p_room;
  END IF;
  UPDATE public.game_state SET current_color = v_color, current_value = v_value WHERE room_id = p_room;
  target := p_player;
  target := public.fn_next_player(p_room, target, skip_steps);
  IF (SELECT draw_stack FROM public.game_state WHERE room_id = p_room) > 0 THEN
    PERFORM public.fn_draw(p_room, target, (SELECT draw_stack FROM public.game_state WHERE room_id = p_room));
    UPDATE public.game_state SET draw_stack = 0 WHERE room_id = p_room;
    target := public.fn_next_player(p_room, target, 1);
  END IF;
  UPDATE public.rooms SET turn_player_id = target WHERE id = p_room;
  RETURN QUERY SELECT target,
    (SELECT current_color FROM public.game_state WHERE room_id = p_room),
    (SELECT current_value FROM public.game_state WHERE room_id = p_room),
    (SELECT CASE WHEN (SELECT current_side FROM public.rooms WHERE id = p_room)='dark' THEN true ELSE false END),
    (SELECT draw_stack FROM public.game_state WHERE room_id = p_room),
    (SELECT direction FROM public.game_state WHERE room_id = p_room);
END;
$$;

-- fn_player_draw
CREATE OR REPLACE FUNCTION public.fn_player_draw(p_room uuid, p_player uuid, p_n int DEFAULT 1)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE cur_player uuid;
BEGIN
  SELECT turn_player_id INTO cur_player FROM public.rooms WHERE id = p_room;
  IF cur_player IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'Not your turn'; END IF;
  PERFORM public.fn_draw(p_room, p_player, p_n);
END;
$$;


-- Seed initial cards ===============================================================

-- === Seed master deck (UNO Flip) ===
-- Wilds
INSERT INTO public.cards (light_color, light_value, dark_color, dark_value, is_wild) VALUES
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true);

DO $$
DECLARE colors text[] := array['red','yellow','green','blue'];
c text;
n int;
BEGIN
  FOREACH c IN ARRAY colors LOOP
    -- 0 x1
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (c,'0',c,'0');
    -- 1..9 x2
    FOR n IN 1..9 LOOP
      INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (c, n::text, c, n::text);
      INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (c, n::text, c, n::text);
    END LOOP;
    -- actions
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES
      (c,'reverse',c,'reverse'),
      (c,'reverse',c,'reverse'),
      (c,'skip',c,'skip_everyone'),
      (c,'skip',c,'skip_everyone'),
      (c,'draw_one',c,'draw_five'),
      (c,'draw_one',c,'draw_five'),
      (c,'flip',c,'flip');
  END LOOP;
END$$;

-- indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_cards_room_order ON public.room_cards(room_id, location, order_index DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);