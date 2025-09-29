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

-- === CARDS (master definitions) ===
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
  host_id uuid NOT NULL,
  turn_player_id uuid,
  current_side text DEFAULT 'light' CHECK (current_side IN ('light','dark')),
  current_card uuid, -- FK added later
  direction text DEFAULT 'clockwise' CHECK (direction IN ('clockwise','counterclockwise')),
  draw_stack int DEFAULT 0,
  started boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- === ROOM_CARDS (instances in a room) ===
CREATE TABLE public.room_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  owner_id uuid,
  location text CHECK (location IN ('deck','discard','hand')) NOT NULL,
  order_index int
);

ALTER TABLE public.rooms
  ADD CONSTRAINT fk_rooms_current_card
  FOREIGN KEY (current_card)
  REFERENCES public.room_cards(id)
  ON DELETE SET NULL;

-- === PLAYERS ===
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NULL,
  nickname text,
  is_host boolean DEFAULT false,
  is_anonymous boolean DEFAULT true,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_players_room ON public.players(room_id);


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
      AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
  )
);
CREATE POLICY room_update_host ON public.rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id = rooms.id AND p.is_host = true
      AND (p.user_id = auth.uid() OR auth.uid() IS NULL)
  )
);

-- Players policies
CREATE POLICY players_insert_anyone ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY players_select_room ON public.players FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE user_id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY players_update_self ON public.players FOR UPDATE USING (id = auth.uid());

-- Cards policies
CREATE POLICY cards_read_all ON public.cards FOR SELECT USING (true);

-- Room cards policies
CREATE POLICY room_cards_select_room ON public.room_cards FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.players WHERE user_id = auth.uid())
  OR auth.uid() IS NULL
);
CREATE POLICY room_cards_service_insert ON public.room_cards FOR INSERT WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.rooms FROM anon;
REVOKE ALL ON TABLE public.room_cards FROM anon;
GRANT SELECT ON TABLE public.rooms TO anon;
GRANT SELECT ON TABLE public.players TO anon;
GRANT SELECT ON TABLE public.room_cards TO anon;
GRANT SELECT ON TABLE public.cards TO anon;

-- HELPER FUNCTIONS ===============================================================

-- top discard
CREATE OR REPLACE FUNCTION public.fn_top_discard(p_room uuid)
RETURNS public.room_cards AS $$
  SELECT rc.* FROM public.room_cards rc
   WHERE rc.room_id = p_room AND rc.location = 'discard'
   ORDER BY rc.order_index DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

-- deck count
CREATE OR REPLACE FUNCTION public.fn_deck_count(p_room uuid)
RETURNS int AS $$
  SELECT COUNT(*) FROM public.room_cards
   WHERE room_id = p_room AND location = 'deck';
$$ LANGUAGE sql STABLE;

-- draw
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
        SET location='deck', owner_id=NULL, order_index=floor(random()*1000000)
        WHERE room_id=p_room AND location='discard' AND id<>top_discard_id;
      SELECT public.fn_deck_count(p_room) INTO deck_left;
      IF deck_left = 0 THEN RETURN; END IF;
    END IF;
    UPDATE public.room_cards
      SET location='hand', owner_id=p_player, order_index=NULL
      WHERE id = (
        SELECT id FROM public.room_cards
         WHERE room_id=p_room AND location='deck'
         ORDER BY order_index DESC LIMIT 1
      );
    need := need - 1;
  END LOOP;
END;
$$;

-- next player
CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_from uuid, p_steps int DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE dir text;
        plist uuid[];
        idx int;
        n int;
        target int;
        next_id uuid;
BEGIN
  SELECT direction INTO dir FROM public.rooms WHERE id=p_room;
  SELECT array_agg(id ORDER BY order_index) INTO plist FROM public.players WHERE room_id=p_room;
  n := array_length(plist,1);
  IF n IS NULL OR n=0 THEN RAISE EXCEPTION 'no players'; END IF;
  FOR idx IN 1..n LOOP
    IF plist[idx]=p_from THEN EXIT; END IF;
  END LOOP;
  IF dir='clockwise' THEN
    target := ((idx-1+p_steps)%n)+1;
  ELSE
    target := ((idx-1-p_steps+n)%n)+1;
  END IF;
  next_id := plist[target];
  RETURN next_id;
END;
$$;

-- build deck
CREATE OR REPLACE FUNCTION public.fn_build_deck(p_room uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.room_cards WHERE room_id=p_room) THEN RETURN; END IF;
  INSERT INTO public.room_cards (room_id, card_id, location, order_index)
    SELECT p_room, id, 'deck', floor(random()*1000000) FROM public.cards;
END;
$$;

-- start game
CREATE OR REPLACE FUNCTION public.fn_start_game(p_room uuid, p_cards_per_player int DEFAULT 7)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pid uuid;
        first_card_row public.room_cards;
BEGIN
  PERFORM public.fn_build_deck(p_room);
  UPDATE public.room_cards
     SET order_index=floor(random()*1000000)
   WHERE room_id=p_room AND location='deck';
  -- deal cards
  FOR pid IN SELECT id FROM public.players WHERE room_id=p_room ORDER BY order_index LOOP
    PERFORM public.fn_draw(p_room,pid,p_cards_per_player);
  END LOOP;
  -- flip first discard
  UPDATE public.room_cards
     SET location='discard', order_index=1
   WHERE id = (
     SELECT id FROM public.room_cards
      WHERE room_id=p_room AND location='deck'
      ORDER BY order_index DESC LIMIT 1
   ) RETURNING * INTO first_card_row;
  UPDATE public.rooms
     SET current_card=first_card_row.id,
         current_side=COALESCE(current_side,'light'),
         turn_player_id=(SELECT id FROM public.players WHERE room_id=p_room ORDER BY order_index LIMIT 1),
         started=true
   WHERE id=p_room;
END;
$$;

-- is playable
CREATE OR REPLACE FUNCTION public.fn_is_playable(p_room uuid, p_room_card uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE side text; cid uuid;
        col text; val text;
        cur_col text; cur_val text;
        wild boolean;
        current_card_id uuid;
BEGIN
  SELECT current_side, current_card INTO side, current_card_id FROM public.rooms WHERE id=p_room;
  SELECT card_id INTO cid FROM public.room_cards WHERE id=p_room_card;
  SELECT is_wild INTO wild FROM public.cards WHERE id=cid;
  IF wild THEN RETURN true; END IF;
  IF current_card_id IS NULL THEN RETURN true; END IF; -- first move
  IF side='light' THEN
    SELECT light_color, light_value INTO col,val FROM public.cards WHERE id=cid;
    SELECT light_color, light_value INTO cur_col,cur_val FROM public.cards WHERE id=(SELECT card_id FROM public.room_cards WHERE id=current_card_id);
  ELSE
    SELECT dark_color, dark_value INTO col,val FROM public.cards WHERE id=cid;
    SELECT dark_color, dark_value INTO cur_col,cur_val FROM public.cards WHERE id=(SELECT card_id FROM public.room_cards WHERE id=current_card_id);
  END IF;
  RETURN (col IS NOT DISTINCT FROM cur_col) OR (val IS NOT DISTINCT FROM cur_val);
END;
$$;

-- play card
CREATE OR REPLACE FUNCTION public.fn_play_card(
  p_room uuid, p_player uuid, p_room_card uuid, p_chosen_color text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE side text; cid uuid; is_owner boolean; playable boolean;
        v_color text; v_value text; cur_player uuid; cur_dir direction; stack int;
        skip_steps int := 1; target uuid;
BEGIN
  SELECT turn_player_id INTO cur_player FROM public.rooms WHERE id=p_room;
  IF cur_player IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'Not your turn'; END IF;
  SELECT (owner_id=p_player) INTO is_owner FROM public.room_cards WHERE id=p_room_card AND room_id=p_room AND location='hand';
  IF NOT is_owner THEN RAISE EXCEPTION 'Not your card'; END IF;
  SELECT public.fn_is_playable(p_room,p_room_card) INTO playable;
  IF NOT playable THEN RAISE EXCEPTION 'Not playable'; END IF;
  SELECT current_side,direction,draw_stack INTO side,cur_dir,stack FROM public.rooms WHERE id=p_room;
  SELECT card_id INTO cid FROM public.room_cards WHERE id=p_room_card;
  IF side='light' THEN SELECT light_color,light_value INTO v_color,v_value FROM public.cards WHERE id=cid;
  ELSE SELECT dark_color,dark_value INTO v_color,v_value FROM public.cards WHERE id=cid; END IF;
  -- move card
  UPDATE public.room_cards
     SET location='discard',owner_id=NULL,
         order_index=COALESCE((SELECT order_index FROM public.room_cards WHERE room_id=p_room AND location='discard' ORDER BY order_index DESC LIMIT 1),0)+1
   WHERE id=p_room_card;
  UPDATE public.rooms SET current_card=p_room_card WHERE id=p_room;
  -- wild chosen color
  IF (SELECT is_wild FROM public.cards WHERE id=cid) AND p_chosen_color IS NOT NULL THEN v_color := p_chosen_color; END IF;
  -- effects
  IF v_value='reverse' THEN
    cur_dir := CASE WHEN cur_dir='clockwise' THEN 'counterclockwise' ELSE 'clockwise' END;
    UPDATE public.rooms SET direction=cur_dir WHERE id=p_room;
  ELSIF v_value='skip' THEN skip_steps := 2;
  ELSIF v_value='skip_everyone' THEN skip_steps := (SELECT count(*) FROM public.players WHERE room_id=p_room);
  ELSIF v_value='draw_one' THEN stack := stack+1; UPDATE public.rooms SET draw_stack=stack WHERE id=p_room;
  ELSIF v_value='draw_five' THEN stack := stack+5; UPDATE public.rooms SET draw_stack=stack WHERE id=p_room;
  ELSIF v_value='wild_draw_two' THEN stack := stack+2; UPDATE public.rooms SET draw_stack=stack WHERE id=p_room;
  ELSIF v_value='flip' THEN
    UPDATE public.rooms SET current_side=CASE WHEN current_side='light' THEN 'dark' ELSE 'light' END WHERE id=p_room;
  END IF;
  -- advance turn
  target := public.fn_next_player(p_room,p_player,skip_steps);
  IF (SELECT draw_stack FROM public.rooms WHERE id=p_room)>0 THEN
    PERFORM public.fn_draw(p_room,target,(SELECT draw_stack FROM public.rooms WHERE id=p_room));
    UPDATE public.rooms SET draw_stack=0 WHERE id=p_room;
    target := public.fn_next_player(p_room,target,1);
  END IF;
  UPDATE public.rooms SET turn_player_id=target WHERE id=p_room;
  RETURN target;
END;
$$;

-- player draw
CREATE OR REPLACE FUNCTION public.fn_player_draw(p_room uuid, p_player uuid, p_n int DEFAULT 1)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE cur_player uuid;
BEGIN
  SELECT turn_player_id INTO cur_player FROM public.rooms WHERE id=p_room;
  IF cur_player IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'Not your turn'; END IF;
  PERFORM public.fn_draw(p_room,p_player,p_n);
END;
$$;

-- SEED DECK ======================================================================

-- wilds
INSERT INTO public.cards (light_color,light_value,dark_color,dark_value,is_wild) VALUES
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
c text; n int;
BEGIN
  FOREACH c IN ARRAY colors LOOP
    INSERT INTO public.cards (light_color,light_value,dark_color,dark_value) VALUES (c,'0',c,'0');
    FOR n IN 1..9 LOOP
      INSERT INTO public.cards (light_color,light_value,dark_color,dark_value) VALUES (c,n::text,c,n::text);
      INSERT INTO public.cards (light_color,light_value,dark_color,dark_value) VALUES (c,n::text,c,n::text);
    END LOOP;
    INSERT INTO public.cards (light_color,light_value,dark_color,dark_value) VALUES
      (c,'reverse',c,'reverse'),
      (c,'reverse',c,'reverse'),
      (c,'skip',c,'skip_everyone'),
      (c,'skip',c,'skip_everyone'),
      (c,'draw_one',c,'draw_five'),
      (c,'draw_one',c,'draw_five'),
      (c,'flip',c,'flip');
  END LOOP;
END$$;

-- INDEXES ========================================================================
CREATE INDEX idx_room_cards_room_order ON public.room_cards(room_id,location,order_index DESC);
CREATE INDEX idx_rooms_code ON public.rooms(code);
