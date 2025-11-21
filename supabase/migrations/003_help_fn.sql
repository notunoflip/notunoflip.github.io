-- ===============================================================
-- Get top card of discard pile
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_top_discard(p_room uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.card_id
  FROM public.room_cards rc
  WHERE rc.room_id = p_room
    AND rc.pile = 'discard'
  ORDER BY rc.order_index DESC
  LIMIT 1;
$$;
ALTER FUNCTION public.fn_top_discard(uuid) OWNER TO postgres;


-- ===============================================================
-- Count cards left in deck
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_deck_count(p_room uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.room_cards
  WHERE room_id = p_room AND pile = 'deck';
$$;
ALTER FUNCTION public.fn_deck_count(uuid) OWNER TO postgres;






CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_current uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_direction direction;
  v_next uuid;
  v_players uuid[];
  v_count int;
  v_idx int;
BEGIN
  -- Get the room’s direction
  SELECT direction INTO v_direction FROM public.rooms WHERE id = p_room;

  -- Collect all active players in join order
  SELECT array_agg(player_id ORDER BY joined_at ASC)
  INTO v_players
  FROM public.room_players
  WHERE room_id = p_room
    AND is_spectator = false;

  v_count := array_length(v_players, 1);

  IF v_count IS NULL OR v_count < 2 THEN
    RAISE EXCEPTION 'Not enough players in room %', p_room;
  END IF;

  -- Find current player's index
  SELECT i INTO v_idx
  FROM generate_subscripts(v_players, 1) AS s(i)
  WHERE v_players[s.i] = p_current;

  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'Current player % not found in room %', p_current, p_room;
  END IF;

  -- Clockwise or counterclockwise logic with wrap-around
  IF v_direction = 'clockwise' THEN
    v_next := v_players[ ((v_idx) % v_count) + 1 ];
  ELSE
    v_next := v_players[ ((v_idx + v_count - 2) % v_count) + 1 ];
  END IF;

  RETURN v_next;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_advance_turn(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_player uuid;
  next_player uuid;
BEGIN
  SELECT turn_player_id INTO current_player FROM public.rooms WHERE id = p_room;

  IF current_player IS NULL THEN
    -- first turn: pick first joined player
    SELECT player_id INTO next_player
    FROM public.room_players
    WHERE room_id = p_room
      AND is_spectator = false
    ORDER BY joined_at ASC
    LIMIT 1;
  ELSE
    next_player := public.fn_next_player(p_room, current_player);
  END IF;

  UPDATE public.rooms
  SET turn_player_id = next_player,
      last_turn_started_at = now()
  WHERE id = p_room;

  RAISE NOTICE 'Advanced turn in room % -> next player %', p_room, next_player;
END;
$$;



-- ===============================================================
-- Build deck for a room (service-only, but safe via SECURITY DEFINER)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_build_deck(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear any existing deck
  DELETE FROM public.room_cards WHERE room_id = p_room;

  -- Insert full deck
  INSERT INTO public.room_cards (room_id, card_id, pile)
  SELECT p_room, c.id, 'deck'
  FROM public.cards c;

  -- Shuffle the deck
  UPDATE public.room_cards
  SET order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room AND pile = 'deck';
END;
$$;
ALTER FUNCTION public.fn_build_deck(uuid) OWNER TO postgres;


-- ===============================================================
-- Draw cards
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_draw_card(
  p_room uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_uuid uuid := auth.uid();  -- ✅ Current authenticated player
  v_room public.rooms%ROWTYPE;
  v_cards_to_draw integer := 1;
  v_next_card uuid;
BEGIN
  -- ===========================================================
  -- 1️⃣ Validate room and current turn
  -- ===========================================================
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- ✅ Ensure it’s actually the player’s turn
  IF v_room.turn_player_id IS DISTINCT FROM v_player_uuid THEN
    RAISE EXCEPTION 'It is not your turn!';
  END IF;

  -- ===========================================================
  -- 2️⃣ Determine how many cards to draw (stacking logic)
  -- ===========================================================
  IF v_room.draw_stack > 0 THEN
    v_cards_to_draw := v_room.draw_stack;
  END IF;

  -- ===========================================================
  -- 3️⃣ Draw from deck into player’s hand
  -- ===========================================================
  FOR i IN 1..v_cards_to_draw LOOP
    SELECT rc.id INTO v_next_card
    FROM public.room_cards rc
    WHERE rc.room_id = p_room AND rc.pile = 'deck'
    ORDER BY rc.order_index ASC
    LIMIT 1;

    IF v_next_card IS NULL THEN
      RAISE EXCEPTION 'The deck is empty!';
    END IF;

    UPDATE public.room_cards
    SET
      pile = 'hand',
      owner_id = v_player_uuid,
      order_index = (
        SELECT COALESCE(MAX(order_index), 0) + 1
        FROM public.room_cards
        WHERE room_id = p_room
          AND pile = 'hand'
          AND owner_id = v_player_uuid
      )
    WHERE id = v_next_card;
  END LOOP;

  -- ===========================================================
  -- 4️⃣ Reset draw stack and advance turn
  -- ===========================================================
  UPDATE public.rooms
  SET draw_stack = 0
  WHERE id = p_room;

  PERFORM public.fn_advance_turn(p_room);

  RAISE NOTICE 'Player % drew % card(s)', v_player_uuid, v_cards_to_draw;
END;
$$;

ALTER FUNCTION public.fn_draw_card(uuid) OWNER TO postgres;







CREATE OR REPLACE FUNCTION public.fn_deal_cards(
  p_room uuid,
  p_player uuid,
  p_count int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card uuid;
BEGIN
  FOR i IN 1..p_count LOOP
    SELECT rc.id INTO v_card
    FROM public.room_cards rc
    WHERE rc.room_id = p_room AND rc.pile='deck'
    ORDER BY rc.order_index ASC
    LIMIT 1;

    IF v_card IS NULL THEN
      RAISE EXCEPTION 'Deck empty!';
    END IF;

    UPDATE public.room_cards
    SET pile='hand',
        owner_id = p_player,
        order_index = (
          SELECT COALESCE(MAX(order_index),0)+1
          FROM public.room_cards
          WHERE room_id=p_room
            AND pile='hand'
            AND owner_id=p_player
        )
    WHERE id = v_card;
  END LOOP;
END;
$$;



-- ===============================================================
-- Preview draw cards (see opposite side of the next cards)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_preview_draw(p_room uuid)
RETURNS TABLE (
  room_card_id uuid,
  card_id uuid,
  visible_side text,
  color text,
  value text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rc.id AS room_card_id,
    c.id AS card_id,
    CASE r.current_side WHEN 'light' THEN 'dark' ELSE 'light' END AS visible_side,
    CASE r.current_side WHEN 'light' THEN c.dark_color ELSE c.light_color END AS color,
    CASE r.current_side WHEN 'light' THEN c.dark_value ELSE c.light_value END AS value
  FROM public.rooms r
  JOIN public.room_cards rc ON rc.room_id = r.id
  JOIN public.cards c ON c.id = rc.card_id
  WHERE r.id = p_room
    AND rc.pile = 'deck'
  ORDER BY rc.order_index ASC
  LIMIT 1;
$$;

ALTER FUNCTION public.fn_preview_draw(uuid) OWNER TO postgres;




-- ===============================================================
-- Play card (authenticated player)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_play_card(
  p_room uuid,
  p_room_card uuid,  -- ✅ Changed from p_card to p_room_card (room_cards.id)
  p_chosen_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.rooms%ROWTYPE;
  v_room_card public.room_cards%ROWTYPE;  -- ✅ Added room_card variable
  v_top public.cards%ROWTYPE;
  v_card public.cards%ROWTYPE;
  v_top_value text;
  v_top_color text;
  v_my_value text;
  v_my_color text;
  v_is_playable boolean := false;
BEGIN
  -- ===========================================================
  -- 1️⃣ Security: ensure authenticated user exists
  -- ===========================================================
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ===========================================================
  -- 2️⃣ Validate player belongs to this room and not a spectator
  -- ===========================================================
  IF NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = p_room AND player_id = v_uid AND is_spectator = false
  ) THEN
    RAISE EXCEPTION 'You are not a player in this room';
  END IF;

  -- ===========================================================
  -- 3️⃣ Load current room + ensure it's your turn
  -- ===========================================================
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.turn_player_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'It is not your turn!';
  END IF;

  -- ===========================================================
  -- 4️⃣ Load the room_card entry and verify ownership
  -- ===========================================================
  SELECT * INTO v_room_card 
  FROM public.room_cards 
  WHERE id = p_room_card 
    AND room_id = p_room 
    AND owner_id = v_uid 
    AND pile = 'hand';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found in your hand';
  END IF;

  -- ===========================================================
  -- 5️⃣ Load current card (top of discard) + played card info
  -- ===========================================================
  IF v_room.current_card IS NOT NULL THEN
    SELECT * INTO v_top FROM public.cards WHERE id = v_room.current_card;
  END IF;

  SELECT * INTO v_card FROM public.cards WHERE id = v_room_card.card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card data not found';
  END IF;

  -- ===========================================================
  -- 6️⃣ Resolve color/value for the current side
  -- ===========================================================
  IF v_room.current_side = 'light' THEN
    v_top_value := v_top.light_value;
    v_top_color := v_top.light_color;
    v_my_value := v_card.light_value;
    v_my_color := v_card.light_color;
  ELSE
    v_top_value := v_top.dark_value;
    v_top_color := v_top.dark_color;
    v_my_value := v_card.dark_value;
    v_my_color := v_card.dark_color;
  END IF;

  -- ===========================================================
  -- 7️⃣ Determine playability
  -- ===========================================================
  IF v_room.current_card IS NULL THEN
    v_is_playable := true; -- first play
  ELSIF v_my_value ILIKE 'wild%' THEN
    v_is_playable := true; -- wilds always playable
  ELSIF (v_top_value = '+1' AND v_my_value = '+1')
     OR (v_top_value = '+2' AND v_my_value = '+2')
     OR (v_top_value = '+5' AND v_my_value = '+5') THEN
    v_is_playable := true; -- stacking rule
  ELSIF v_top_value ILIKE 'wild%' AND v_room.wild_color IS NOT NULL THEN
    v_is_playable := (v_my_color = v_room.wild_color);
  ELSE
    v_is_playable := (v_my_color = v_top_color OR v_my_value = v_top_value);
  END IF;

  IF NOT v_is_playable THEN
    RAISE EXCEPTION 'You cannot play % on %', v_my_value, v_top_value;
  END IF;

  -- ===========================================================
  -- 8️⃣ Move card from hand → discard
  -- ===========================================================
  UPDATE public.room_cards
  SET pile = 'discard',
      owner_id = NULL,
      order_index = COALESCE(
        (SELECT MAX(order_index)
         FROM public.room_cards
         WHERE room_id = p_room AND pile = 'discard'),
        0
      ) + 1
  WHERE id = p_room_card;  -- ✅ Use the room_card id directly

  -- ===========================================================
  -- 9️⃣ Apply card effects and update room
  -- ===========================================================
  UPDATE public.rooms
  SET
    current_card = v_room_card.card_id,  -- ✅ Use the card_id from room_card
    wild_color = COALESCE(p_chosen_color, v_my_color),  -- ✅ Fixed: was current_color
    last_turn_started_at = now()
  WHERE id = p_room;

  -- Special card effects
  IF v_my_value = 'skip' THEN
    UPDATE public.rooms SET skip_next = true WHERE id = p_room;

  ELSIF v_my_value = 'reverse' THEN
    UPDATE public.rooms
    SET direction = CASE
      WHEN direction = 'clockwise' THEN 'counterclockwise'
      ELSE 'clockwise'
    END
    WHERE id = p_room;

  ELSIF v_my_value = '+1' THEN
    UPDATE public.rooms SET draw_stack = draw_stack + 1 WHERE id = p_room;

  ELSIF v_my_value = '+2' THEN
    UPDATE public.rooms SET draw_stack = draw_stack + 2 WHERE id = p_room;

  ELSIF v_my_value = '+5' THEN
    UPDATE public.rooms SET draw_stack = draw_stack + 5 WHERE id = p_room;

  ELSIF v_my_value = 'flip' THEN
    UPDATE public.rooms
    SET current_side = CASE
      WHEN current_side = 'light' THEN 'dark'
      ELSE 'light'
    END
    WHERE id = p_room;
  END IF;

  -- ===========================================================
  -- 🔟 Advance to next player
  -- ===========================================================
  PERFORM public.fn_advance_turn(p_room);

  RAISE NOTICE 'Player % played % (% side)', v_uid, v_my_value, v_room.current_side;
END;
$$;

ALTER FUNCTION public.fn_play_card(uuid, uuid, text) OWNER TO postgres;







-- ===============================================================
-- Start game
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_start_game(p_room uuid, p_cards_per int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  player_count int;
  first_card_id uuid;
  first_card_value text;
  is_wild boolean := true;
BEGIN
  RAISE NOTICE '>>> fn_start_game() BEGIN: room_id=% cards_per=%', p_room, p_cards_per;

  -- Build a fresh deck
  PERFORM public.fn_build_deck(p_room);

  -- Count players
  SELECT COUNT(*) INTO player_count
  FROM public.room_players
  WHERE room_id = p_room AND is_spectator = false;

  IF player_count < 2 THEN
    RAISE EXCEPTION 'Not enough players (%). Need at least 2.', player_count;
  END IF;

  -- Deal cards to each non-spectator player
  FOR p IN
    SELECT player_id
    FROM public.room_players
    WHERE room_id = p_room AND is_spectator = false
  LOOP
    PERFORM public.fn_deal_cards(p_room, p.player_id, p_cards_per);
  END LOOP;

  -- Pick the first discard card
  -- Keep drawing until we get a non-wild card (optional)
  LOOP
    SELECT rc.card_id
    INTO first_card_id
    FROM public.room_cards rc
    JOIN public.cards c ON rc.card_id = c.id
    WHERE rc.room_id = p_room
      AND rc.pile = 'deck'
    ORDER BY rc.order_index ASC
    LIMIT 1;

    IF first_card_id IS NULL THEN
      RAISE EXCEPTION 'No cards left in deck for first discard!';
    END IF;

    -- (optional rule) skip wilds as the first discard
    SELECT (c.light_value ILIKE 'wild%' OR c.dark_value ILIKE 'wild%')
    INTO is_wild
    FROM public.cards c
    WHERE c.id = first_card_id;

    EXIT WHEN NOT is_wild;

    -- If wild, move it to bottom of deck and continue
    UPDATE public.room_cards
    SET order_index = (SELECT MAX(order_index) + 1 FROM public.room_cards WHERE room_id = p_room AND pile = 'deck')
    WHERE room_id = p_room AND card_id = first_card_id;
  END LOOP;

  -- Move first card from deck → discard
  UPDATE public.room_cards
  SET pile = 'discard',
      owner_id = NULL,
      order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room
    AND card_id = first_card_id;

  -- Set it as the room’s current card
  UPDATE public.rooms
  SET started_game = true,
      current_card = first_card_id,
      current_side = 'light',
      turn_player_id = (
        SELECT player_id
        FROM public.room_players
        WHERE room_id = p_room AND is_spectator = false
        ORDER BY joined_at ASC
        LIMIT 1
      )
  WHERE id = p_room;

  RAISE NOTICE '>>> Game started. First discard card: %', first_card_id;
END;
$$;
ALTER FUNCTION public.fn_start_game(uuid, int) OWNER TO postgres;



