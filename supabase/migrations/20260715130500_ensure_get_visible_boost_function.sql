-- Ensure get_visible_boost is available for channel boost calculations
CREATE OR REPLACE FUNCTION public.get_visible_boost(_chat_id uuid, _kind text DEFAULT 'subscribers')
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings RECORD;
  elapsed FLOAT;
  total_duration FLOAT;
  progress FLOAT;
BEGIN
  SELECT * INTO settings FROM public.channel_settings WHERE chat_id = _chat_id;
  IF NOT FOUND OR settings.boost_target IS NULL THEN
    RETURN COALESCE(settings.boost_count, 0);
  END IF;

  IF _kind IS NOT NULL AND _kind <> 'any' AND settings.boost_kind IS NOT NULL AND settings.boost_kind::text <> _kind THEN
    RETURN COALESCE(settings.boost_count, 0);
  END IF;

  IF settings.boost_mode = 'instant' THEN
    RETURN settings.boost_target;
  END IF;

  IF settings.boost_start_time IS NULL OR settings.boost_end_time IS NULL THEN
    RETURN settings.boost_count;
  END IF;

  elapsed := EXTRACT(EPOCH FROM (now() - settings.boost_start_time));
  total_duration := EXTRACT(EPOCH FROM (settings.boost_end_time - settings.boost_start_time));

  IF elapsed >= total_duration THEN
    RETURN settings.boost_target;
  END IF;

  progress := 1.0 - POWER(1.0 - (elapsed / total_duration), 3);
  RETURN settings.boost_count + FLOOR((settings.boost_target - settings.boost_count) * progress);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_boost(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_boost(uuid, text) TO anon;
