-- Create chat RPC functions with SECURITY DEFINER
-- These bypass RLS and handle chat creation safely within the function

CREATE OR REPLACE FUNCTION public.create_group_chat(
  _name text,
  _member_ids uuid[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _me uuid := auth.uid();
  _chat_id uuid;
  _member_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR _name = '' THEN RAISE EXCEPTION 'Group name is required'; END IF;
  IF array_length(_member_ids, 1) IS NULL OR array_length(_member_ids, 1) = 0 THEN 
    RAISE EXCEPTION 'At least one member is required'; 
  END IF;

  -- Create the group chat
  INSERT INTO public.chats (type, name, created_by) 
  VALUES ('group', _name, _me) 
  RETURNING id INTO _chat_id;

  -- Add creator as owner
  INSERT INTO public.chat_members (chat_id, user_id, role) 
  VALUES (_chat_id, _me, 'owner');

  -- Add other members
  FOREACH _member_id IN ARRAY _member_ids
  LOOP
    IF _member_id != _me THEN
      INSERT INTO public.chat_members (chat_id, user_id, role) 
      VALUES (_chat_id, _member_id, 'member')
      ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN _chat_id;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _code text;
BEGIN
  LOOP
    _code := substring(md5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 12);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.channel_settings WHERE invite_code = _code);
  END LOOP;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.regenerate_channel_invite_code(_chat_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _new_code text;
BEGIN
  _new_code := public.generate_invite_code();
  UPDATE public.channel_settings SET invite_code = _new_code WHERE chat_id = _chat_id;
  RETURN _new_code;
END; $$;

CREATE OR REPLACE FUNCTION public.get_channel_preview_by_invite(_invite_code text)
RETURNS TABLE (
  chat_id uuid,
  name text,
  avatar_url text,
  description text,
  member_count integer
) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT
    c.id,
    c.name,
    c.avatar_url,
    c.description,
    (SELECT COUNT(*) FROM public.chat_members cm WHERE cm.chat_id = c.id)
  FROM public.chats c
  JOIN public.channel_settings s ON s.chat_id = c.id
  WHERE s.invite_code = _invite_code
    AND c.type = 'channel'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_channel(
  _name text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _me uuid := auth.uid();
  _chat_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR _name = '' THEN RAISE EXCEPTION 'Channel name is required'; END IF;

  -- Create the channel
  INSERT INTO public.chats (type, name, created_by) 
  VALUES ('channel', _name, _me) 
  RETURNING id INTO _chat_id;

  -- Add creator as owner
  INSERT INTO public.chat_members (chat_id, user_id, role) 
  VALUES (_chat_id, _me, 'owner');

  -- Initialize channel settings with generated invite code
  INSERT INTO public.channel_settings (chat_id, invite_code) 
  VALUES (_chat_id, public.generate_invite_code());

  RETURN _chat_id;
END; $$;
