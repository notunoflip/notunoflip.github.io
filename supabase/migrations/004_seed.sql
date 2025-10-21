-- ==========================================================
-- Wild Cards
-- ==========================================================
INSERT INTO public.cards (light_color, light_value, dark_color, dark_value, is_wild) VALUES
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild',NULL,'wild',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true),
  (NULL,'wild_draw_two',NULL,'wild_draw_color',true);

-- ==========================================================
-- Colored Cards (Numbers and Specials)
-- ==========================================================
DO $$
DECLARE 
    colors text[] := array['red','yellow','green','blue'];
    light text;
    dark text;
    n int;
BEGIN
  FOREACH light IN ARRAY colors LOOP
    -- Number 0
    dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (light,'0',dark,'0');

    -- Numbers 1-9 (two copies each)
    FOR n IN 1..9 LOOP
      dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
      INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (light,n::text,dark,n::text);
      dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
      INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES (light,n::text,dark,n::text);
    END LOOP;

    -- Reverse cards (two copies)
    dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES 
      (light,'reverse',dark,'reverse'),
      (light,'reverse',dark,'reverse');

    -- Skip cards (two copies, dark side skips everyone)
    dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES 
      (light,'skip',dark,'skip_everyone'),
      (light,'skip',dark,'skip_everyone');

    -- Draw cards (two copies, dark side draws five)
    dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES 
      (light,'draw_one',dark,'draw_five'),
      (light,'draw_one',dark,'draw_five');

    -- Flip card (one copy per color)
    dark := (SELECT unnest(colors) EXCEPT SELECT light ORDER BY random() LIMIT 1);
    INSERT INTO public.cards (light_color, light_value, dark_color, dark_value) VALUES 
      (light,'flip',dark,'flip');

  END LOOP;
END$$;
