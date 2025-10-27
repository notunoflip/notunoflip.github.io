-- ==========================================================
-- Randomized UNO Flip Deck
-- (wilds can appear randomly on either side, doubled cards)
-- ==========================================================

DO $$
DECLARE
  colors text[] := array['red','yellow','green','blue'];
  specials text[] := array['reverse','skip','draw_one','flip'];
  dark_specials text[] := array['draw_until','skip_everyone','draw_five','flip'];
  light text;
  light_color text;
  dark text;
  n int;
  lv text;
  dv text;
  dark_val text;
  copies int := 2; -- double the number of cards
  copy_i int;
BEGIN
  FOR copy_i IN 1..copies LOOP  -- duplicate full deck
    FOREACH light IN ARRAY colors LOOP
      -- Numbers 0–9
      FOR n IN 0..9 LOOP
        dark := (SELECT col FROM unnest(colors) AS t(col) ORDER BY random() LIMIT 1);

        -- Light side: small chance to become wild_draw_two
        IF random() < 0.10 THEN
          lv := 'wild_draw_two';
          light_color := NULL;  -- no color for wilds
        ELSE
          lv := n::text;
          light_color := light; -- keep color
        END IF;

        -- Dark side logic
        IF random() < 0.10 THEN
          dv := 'wild_draw_color';
          dark := NULL;
        ELSIF random() < 0.25 THEN
          dv := (SELECT v FROM unnest(dark_specials) AS t(v) ORDER BY random() LIMIT 1);
          IF dv = 'draw_until' THEN
            dv := 'wild';
            dark := NULL;
          ELSIF dv = 'draw_five' THEN
            dark := (SELECT col FROM unnest(colors) AS t(col) ORDER BY random() LIMIT 1);
            dv := '5';
          END IF;
        ELSE
          LOOP
            dark_val := floor(random() * 10)::int::text;
            EXIT WHEN dark_val <> n::text;
          END LOOP;
          dv := dark_val;
        END IF;

        INSERT INTO public.cards (light_color, light_value, dark_color, dark_value)
        VALUES (light_color, lv, dark, dv);
      END LOOP;

      -- Specials
      FOR i IN 1..array_length(specials,1) LOOP
        FOR j IN 1..2 LOOP
          dark := (SELECT col FROM unnest(colors) AS t(col) ORDER BY random() LIMIT 1);

          -- Light side: small chance to be wild_draw_two
          IF random() < 0.10 THEN
            lv := 'wild_draw_two';
            light_color := NULL;  -- no color for wilds
          ELSE
            lv := specials[i];
            light_color := light; -- keep color for specials
          END IF;

          -- Dark side logic
          IF random() < 0.10 THEN
            dv := 'wild_draw_color';
            dark := NULL;
          ELSE
            dark_val := dark_specials[i];
            IF dark_val = 'draw_until' THEN
              dark := NULL;
              dark_val := 'wild';
            ELSIF dark_val = 'draw_five' THEN
              dark := (SELECT col FROM unnest(colors) AS t(col) ORDER BY random() LIMIT 1);
              dark_val := '5';
            END IF;
            dv := dark_val;
          END IF;

          INSERT INTO public.cards (light_color, light_value, dark_color, dark_value)
          VALUES (light_color, lv, dark, dv);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END$$;
