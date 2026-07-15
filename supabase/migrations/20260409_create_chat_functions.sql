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

  -- Initialize channel settings
  INSERT INTO public.channel_settings (chat_id) 
  VALUES (_chat_id);

  RETURN _chat_id;
END; $$;
