-- ===============================================================
-- Get top card of discard pile (same logic, no auth needed)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_top_discard(p_room uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rc.card_id
  FROM public.room_cards rc
  WHERE rc.room_id = p_room
    AND rc.location = 'discard'
  ORDER BY rc.order_index DESC
  LIMIT 1;
$$;

-- ===============================================================
-- Count cards left in deck (read-only, auth not required)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_deck_count(p_room uuid)
RETURNS int
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*) FROM public.room_cards
  WHERE room_id = p_room AND location = 'deck';
$$;

-- ===============================================================
-- Check if card is playable (pure logic, no direct access)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_is_playable(p_room uuid, p_card uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  top uuid;
  top_card public.cards%ROWTYPE;
  my_card public.cards%ROWTYPE;
BEGIN
  top := public.fn_top_discard(p_room);
  IF top IS NULL THEN
    RETURN true; -- First card can always be played
  END IF;

  SELECT * INTO top_card FROM public.cards WHERE id = top;
  SELECT * INTO my_card FROM public.cards WHERE id = p_card;

  IF my_card.is_wild THEN
    RETURN true;
  END IF;

  IF my_card.light_color = top_card.light_color
     OR my_card.light_value = top_card.light_value THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ===============================================================
-- Get next player (simple lookup)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_next_player(p_room uuid, p_current uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rp.player_id
  FROM public.room_players rp
  WHERE rp.room_id = p_room
    AND rp.is_spectator = false
    AND rp.player_id <> p_current
  ORDER BY rp.joined_at ASC
  LIMIT 1;
$$;

-- ===============================================================
-- Build deck for a room (service-only)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_build_deck(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service role can build a deck
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.room_cards (room_id, card_id, location)
  SELECT p_room, c.id, 'deck'
  FROM public.cards c;

  -- Shuffle
  UPDATE public.room_cards
  SET order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room AND location = 'deck';
END;
$$;

-- ===============================================================
-- Draw cards (authenticated player only)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_draw(p_room uuid, p_n int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  drawn RECORD;
BEGIN
  -- Must be logged in
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Must belong to room and not spectator
  IF NOT EXISTS (
    SELECT 1 FROM public.room_players 
    WHERE player_id = v_uid AND room_id = p_room AND is_spectator = false
  ) THEN
    RAISE EXCEPTION 'You are not a player in this room';
  END IF;

  FOR drawn IN
    SELECT id
    FROM public.room_cards
    WHERE room_id = p_room AND location = 'deck'
    ORDER BY order_index ASC
    LIMIT p_n
  LOOP
    UPDATE public.room_cards
    SET location = 'hand',
        owner_id = v_uid
    WHERE id = drawn.id;
  END LOOP;
END;
$$;

-- ===============================================================
-- Play card (authenticated player only)
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

  -- Must be player in room
  IF NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE player_id = v_uid AND room_id = p_room AND is_spectator = false
  ) THEN
    RAISE EXCEPTION 'You are not a player in this room';
  END IF;

  -- Game must be started
  IF NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room AND started = true
  ) THEN
    RAISE EXCEPTION 'Game not started';
  END IF;

  -- Card must be playable
  IF NOT public.fn_is_playable(p_room, p_card) THEN
    RAISE EXCEPTION 'Card % not playable', p_card;
  END IF;

  -- Transfer card to discard
  UPDATE public.room_cards
  SET location = 'discard',
      owner_id = NULL,
      order_index = floor(random() * 1000000)::int
  WHERE room_id = p_room
    AND card_id = p_card
    AND owner_id = v_uid;

  -- Advance turn
  next_player := public.fn_next_player(p_room, v_uid);
  UPDATE public.rooms
  SET turn_player_id = next_player,
      current_card = p_card
  WHERE id = p_room;
END;
$$;

-- ===============================================================
-- Start game (host-only, uses auth.uid())
-- ===============================================================
CREATE OR REPLACE FUNCTION public.fn_start_game(p_room uuid, p_cards_per int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  p RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify host
  IF NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = p_room AND player_id = v_uid AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Only host can start this game';
  END IF;

  -- Build deck (using service role)
  PERFORM public.fn_build_deck(p_room);

  -- Deal cards to each player
  FOR p IN
    SELECT player_id
    FROM public.room_players
    WHERE room_id = p_room AND is_spectator = false
  LOOP
    PERFORM public.fn_draw(p_room, p_cards_per);
  END LOOP;

  -- Mark game started
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
END;
$$;
