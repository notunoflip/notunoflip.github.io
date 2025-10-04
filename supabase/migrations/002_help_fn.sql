-- ===============================================================
-- Get the top card of the discard pile
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_top_discard(p_room uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  top_card uuid;
BEGIN
  SELECT rc.card_id
  INTO top_card
  FROM public.room_cards rc
  WHERE rc.room_id = p_room
    AND rc.location = 'discard'
  ORDER BY rc.order_index DESC
  LIMIT 1;

  RETURN top_card;
END;
$$;


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
  WHERE room_id = $1 AND location = 'deck';
$$;


-- ===============================================================
-- Check if card is playable
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_is_playable(p_room uuid, p_card uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  top uuid;
  playable boolean := false;
BEGIN
  top := public.fn_top_discard(p_room);

  IF top IS NULL THEN
    RETURN true; -- First card can always be played
  END IF;

  -- Example simplified logic: allow play if same color or value (extend later)
  SELECT true INTO playable
  FROM public.cards c1
  JOIN public.cards c2 ON c2.id = top
  WHERE c1.id = p_card
    AND (
      c1.light_color = c2.light_color OR
      c1.light_value = c2.light_value OR
      c1.is_wild = true
    )
  LIMIT 1;

  RETURN COALESCE(playable, false);
END;
$$;


-- ===============================================================
-- Get next player
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_current uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_id uuid;
BEGIN
  -- Naive implementation: just pick a different player in room
  SELECT p.id
  INTO next_id
  FROM public.players p
  WHERE p.room_id = p_room
    AND p.id <> p_current
  LIMIT 1;

  RETURN next_id;
END;
$$;


-- ===============================================================
-- Build deck for a room
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_build_deck(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.room_cards (room_id, card_id, location)
  SELECT p_room, c.id, 'deck'
  FROM public.cards c;

  -- Shuffle order_index
  UPDATE public.room_cards
  SET order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room AND location = 'deck';
END;
$$;


-- ===============================================================
-- Draw cards
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_draw(p_room uuid, p_player uuid, p_n int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drawn RECORD;
BEGIN
  FOR drawn IN
    SELECT rc.id
    FROM public.room_cards rc
    WHERE rc.room_id = p_room
      AND rc.location = 'deck'
    ORDER BY rc.order_index ASC
    LIMIT p_n
  LOOP
    UPDATE public.room_cards
    SET location = 'hand',
        owner_id = p_player
    WHERE id = drawn.id;
  END LOOP;
END;
$$;


-- ===============================================================
-- Player draw wrapper
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_player_draw(p_room uuid, p_player uuid, p_n int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_draw(p_room, p_player, p_n);
END;
$$;


-- ===============================================================
-- Play a card
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_play_card(p_room uuid, p_player uuid, p_card uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_playable(p_room, p_card) THEN
    RAISE EXCEPTION 'Card % is not playable', p_card;
  END IF;

  UPDATE public.room_cards
  SET location = 'discard',
      owner_id = NULL,
      order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room
    AND card_id = p_card
    AND owner_id = p_player;

  -- Update turn
  UPDATE public.rooms
  SET turn_player_id = public.fn_next_player(p_room, p_player)
  WHERE id = p_room;
END;
$$;


-- ===============================================================
-- Start a game
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_start_game(p_room uuid, p_cards_per int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  PERFORM public.fn_build_deck(p_room);

  FOR p IN SELECT id FROM public.players WHERE room_id = p_room
  LOOP
    PERFORM public.fn_draw(p_room, p.id, p_cards_per);
  END LOOP;

  UPDATE public.rooms
  SET started = true,
      turn_player_id = (
        SELECT id FROM public.players WHERE room_id = p_room LIMIT 1
      )
  WHERE id = p_room;
END;
$$;
