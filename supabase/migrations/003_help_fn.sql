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
    AND rc.location = 'discard'
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
  WHERE room_id = p_room AND location = 'deck';
$$;
ALTER FUNCTION public.fn_deck_count(uuid) OWNER TO postgres;


-- ===============================================================
-- Check if card is playable
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_is_playable(p_room uuid, p_card uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_card_id uuid;
  side text;
  top_card public.cards%ROWTYPE;
  my_card public.cards%ROWTYPE;
BEGIN
  SELECT current_card, current_side
  INTO current_card_id, side
  FROM public.rooms
  WHERE id = p_room;

  -- If there's no current card (first turn)
  IF current_card_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT * INTO top_card FROM public.cards WHERE id = current_card_id;
  SELECT * INTO my_card FROM public.cards WHERE id = p_card;

  -- Wild cards can always be played
  IF my_card.is_wild THEN
    RETURN true;
  END IF;

  IF side = 'light' THEN
    IF my_card.light_color = top_card.light_color OR my_card.light_value = top_card.light_value THEN
      RETURN true;
    END IF;
  ELSE
    IF my_card.dark_color = top_card.dark_color OR my_card.dark_value = top_card.dark_value THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;


-- ===============================================================
-- Get next player (respects direction)
-- ===============================================================
-- CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_current uuid)
-- RETURNS uuid
-- LANGUAGE sql
-- SECURITY INVOKER
-- SET search_path = public
-- AS $$
-- WITH current AS (
--   SELECT joined_at
--   FROM public.room_players
--   WHERE room_id = p_room
--     AND player_id = p_current
-- ),
-- room_dir AS (
--   SELECT direction FROM public.rooms WHERE id = p_room
-- ),
-- next_candidates AS (
--   SELECT rp.player_id, rp.joined_at
--   FROM public.room_players rp, room_dir rd
--   WHERE rp.room_id = p_room
--     AND rp.is_spectator = false
--     AND (
--       (rd.direction = 'clockwise' AND rp.joined_at > (SELECT joined_at FROM current))
--       OR
--       (rd.direction = 'counterclockwise' AND rp.joined_at < (SELECT joined_at FROM current))
--     )
-- )
-- SELECT player_id
-- FROM next_candidates, room_dir
-- ORDER BY
--   CASE
--     WHEN room_dir.direction = 'clockwise' THEN joined_at
--   END ASC,
--   CASE
--     WHEN room_dir.direction = 'counterclockwise' THEN joined_at
--   END DESC
-- LIMIT 1

-- UNION ALL

-- -- Wrap-around case
-- SELECT rp.player_id
-- FROM public.room_players rp, room_dir
-- WHERE rp.room_id = p_room
--   AND rp.is_spectator = false
-- ORDER BY
--   CASE
--     WHEN room_dir.direction = 'clockwise' THEN joined_at
--   END ASC,
--   CASE
--     WHEN room_dir.direction = 'counterclockwise' THEN joined_at
--   END DESC
-- LIMIT 1;
-- $$;


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
  INSERT INTO public.room_cards (room_id, card_id, location)
  SELECT p_room, c.id, 'deck'
  FROM public.cards c;

  -- Shuffle the deck
  UPDATE public.room_cards
  SET order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room AND location = 'deck';
END;
$$;
ALTER FUNCTION public.fn_build_deck(uuid) OWNER TO postgres;


-- ===============================================================
-- Draw cards
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_draw(p_room uuid, p_n int, p_player uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drawn RECORD;
BEGIN
  -- Draw p_n cards for the given player
  FOR drawn IN
    SELECT id
    FROM public.room_cards
    WHERE room_id = p_room AND location = 'deck'
    ORDER BY order_index ASC
    LIMIT p_n
  LOOP
    UPDATE public.room_cards
    SET location = 'hand',
        owner_id = p_player
    WHERE id = drawn.id;
  END LOOP;
END;
$$;

ALTER FUNCTION public.fn_draw(uuid, int, uuid) OWNER TO postgres;



-- ===============================================================
-- Play card (authenticated player)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_play_card(p_room uuid, p_card uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  next_player uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE player_id = v_uid AND room_id = p_room AND is_spectator = false
  ) THEN
    RAISE EXCEPTION 'You are not a player in this room';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room AND started = true
  ) THEN
    RAISE EXCEPTION 'Game not started';
  END IF;

  IF NOT public.fn_is_playable(p_room, p_card) THEN
    RAISE EXCEPTION 'Card % not playable', p_card;
  END IF;

  UPDATE public.room_cards
  SET location = 'discard',
      owner_id = NULL,
      order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room
    AND card_id = p_card
    AND owner_id = v_uid;

  next_player := public.fn_next_player(p_room, v_uid);

  UPDATE public.rooms
  SET turn_player_id = next_player,
      current_card = p_card
  WHERE id = p_room;
END;
$$;
ALTER FUNCTION public.fn_play_card(uuid, uuid) OWNER TO postgres;


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
BEGIN
  RAISE NOTICE '>>> fn_start_game() BEGIN: room_id=% cards_per=%', p_room, p_cards_per;

  -- Build a fresh deck
  RAISE NOTICE '>>> Building deck...';
  PERFORM public.fn_build_deck(p_room);
  RAISE NOTICE '>>> Deck built.';

  -- Count players
  SELECT COUNT(*) INTO player_count
  FROM public.room_players
  WHERE room_id = p_room AND is_spectator = false;

  RAISE NOTICE '>>> Player count = %', player_count;

  IF player_count < 2 THEN
    RAISE EXCEPTION 'Not enough players (%). Need at least 2.', player_count;
  END IF;

  -- Deal cards to each non-spectator player
  RAISE NOTICE '>>> Starting to deal cards...';
  FOR p IN
    SELECT player_id
    FROM public.room_players
    WHERE room_id = p_room AND is_spectator = false
  LOOP
    RAISE NOTICE '>>> Dealing to player_id=%', p.player_id;
    PERFORM public.fn_draw(p_room, p_cards_per, p.player_id);
  END LOOP;

  RAISE NOTICE '>>> Finished dealing cards.';

  -- Mark game as started and set first turn
  UPDATE public.rooms
  SET started = true,
      turn_player_id = (
        SELECT player_id
        FROM public.room_players
        WHERE room_id = p_room AND is_spectator = false
        ORDER BY joined_at ASC
        LIMIT 1
      )
  WHERE id = p_room;

  RAISE NOTICE '>>> Game marked as started.';
  RAISE NOTICE '>>> fn_start_game() COMPLETE.';
END;
$$;
ALTER FUNCTION public.fn_start_game(uuid, int) OWNER TO postgres;


