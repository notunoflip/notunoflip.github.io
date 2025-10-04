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