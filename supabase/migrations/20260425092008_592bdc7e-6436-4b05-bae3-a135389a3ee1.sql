-- Ensure full row data is sent on updates for realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;
ALTER TABLE public.channel_settings REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (idempotent guard)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chats; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Ensure the new-user trigger exists (so signups create profile + role automatically)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: create or fetch a 1:1 direct chat between two users
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _chat_id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _me = _other_user THEN
    RAISE EXCEPTION 'Cannot chat with yourself';
  END IF;

  SELECT c.id INTO _chat_id
  FROM public.chats c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = _other_user)
  LIMIT 1;

  IF _chat_id IS NOT NULL THEN
    RETURN _chat_id;
  END IF;

  INSERT INTO public.chats (type, created_by) VALUES ('direct', _me) RETURNING id INTO _chat_id;
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _me, 'owner');
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _other_user, 'member');
  RETURN _chat_id;
END;
$$;