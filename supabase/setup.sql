-- =====================================================================
-- Echo Connect — Complete Supabase Setup
-- =====================================================================
-- Run this once on a fresh Supabase project (SQL Editor) to recreate the
-- entire schema, RLS policies, functions, triggers, and realtime config.
-- Idempotent: safe to re-run.
-- =====================================================================

-- ----------------------------- ENUMS ---------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'platform_admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_type AS ENUM ('direct', 'group', 'channel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'file', 'voice', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_status AS ENUM ('sending', 'sent', 'delivered', 'seen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.boost_mode AS ENUM ('instant', 'gradual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.boost_kind AS ENUM ('subscribers', 'posts', 'likes', 'views');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------- TABLES --------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  email text,
  phone text,
  avatar_url text,
  bio text,
  is_bot boolean NOT NULL DEFAULT false,
  hide_phone boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

UPDATE public.profiles SET is_bot = false WHERE is_bot IS NULL;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN is_bot SET NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- Index for faster searches
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_is_bot ON public.profiles(is_bot);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_type NOT NULL,
  name text,
  description text,
  avatar_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  type public.message_type NOT NULL DEFAULT 'text',
  reply_to_id uuid,
  status public.message_status NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages (chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.channel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE,
  invite_code text NOT NULL UNIQUE DEFAULT substring(md5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 12),
  comments_enabled boolean NOT NULL DEFAULT false,
  allowed_reactions text[] DEFAULT ARRAY['👍','❤️','🔥','😂','😮','😢','🎉'],
  boost_count integer NOT NULL DEFAULT 0,
  boost_target integer,
  boost_kind public.boost_kind NOT NULL DEFAULT 'subscribers',
  boost_start_time timestamptz,
  boost_end_time timestamptz,
  boost_mode public.boost_mode NOT NULL DEFAULT 'instant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  status public.comment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  watch_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- --------------------------- FUNCTIONS -------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id uuid, _chat_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE user_id=_user_id AND chat_id=_chat_id);
$$;

CREATE OR REPLACE FUNCTION public.get_visible_boost(_chat_id uuid, _kind text DEFAULT 'subscribers')
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE settings RECORD; elapsed FLOAT; total_duration FLOAT; progress FLOAT;
BEGIN
  SELECT * INTO settings FROM public.channel_settings WHERE chat_id=_chat_id;
  IF NOT FOUND OR settings.boost_target IS NULL THEN RETURN COALESCE(settings.boost_count,0); END IF;
  -- If caller requests a specific kind and it doesn't match the setting, return baseline
  IF _kind IS NOT NULL AND _kind <> 'any' AND settings.boost_kind IS NOT NULL AND settings.boost_kind <> _kind THEN
    RETURN COALESCE(settings.boost_count, 0);
  END IF;
  IF settings.boost_mode='instant' THEN RETURN settings.boost_target; END IF;
  IF settings.boost_start_time IS NULL OR settings.boost_end_time IS NULL THEN RETURN settings.boost_count; END IF;
  elapsed := EXTRACT(EPOCH FROM (now() - settings.boost_start_time));
  total_duration := EXTRACT(EPOCH FROM (settings.boost_end_time - settings.boost_start_time));
  IF elapsed >= total_duration THEN RETURN settings.boost_target; END IF;
  progress := 1.0 - POWER(1.0 - (elapsed / total_duration), 3);
  RETURN settings.boost_count + FLOOR((settings.boost_target - settings.boost_count) * progress);
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
RETURNS TABLE(
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    email,
    phone,
    is_bot
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    NEW.email,
    COALESCE(NEW.phone, ''),
    COALESCE((NEW.raw_user_meta_data->>'is_bot')::boolean, false)
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _me uuid := auth.uid(); _chat_id uuid; _other_is_bot boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other_user THEN RAISE EXCEPTION 'Cannot chat with yourself'; END IF;
  
  -- Check if the other user is a bot
  SELECT is_bot INTO _other_is_bot FROM public.profiles WHERE id = _other_user;
  IF _other_is_bot THEN RAISE EXCEPTION 'Cannot chat with bots'; END IF;

  SELECT c.id INTO _chat_id FROM public.chats c
    WHERE c.type='direct'
      AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id=c.id AND m.user_id=_me)
      AND EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id=c.id AND m.user_id=_other_user)
    LIMIT 1;
  IF _chat_id IS NOT NULL THEN RETURN _chat_id; END IF;
  INSERT INTO public.chats (type, created_by) VALUES ('direct', _me) RETURNING id INTO _chat_id;
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _me, 'owner');
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _other_user, 'member');
  RETURN _chat_id;
END; $$;

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

  -- Initialize channel settings with generated invite code
  INSERT INTO public.channel_settings (chat_id, invite_code) 
  VALUES (_chat_id, public.generate_invite_code());

  RETURN _chat_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_channel(_chat_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _me uuid := auth.uid();
  _user_role public.member_role;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Check if user is owner or admin
  SELECT role INTO _user_role FROM public.chat_members 
    WHERE chat_id = _chat_id AND user_id = _me;
  
  IF _user_role IS NULL THEN 
    RAISE EXCEPTION 'Not a member of this channel'; 
  END IF;
  
  IF _user_role NOT IN ('owner', 'admin') THEN 
    RAISE EXCEPTION 'Only owners and admins can delete channels'; 
  END IF;

  -- Delete in order of foreign key dependencies
  DELETE FROM public.reactions 
    WHERE message_id IN (SELECT id FROM public.messages WHERE chat_id = _chat_id);
  
  DELETE FROM public.comments 
    WHERE message_id IN (SELECT id FROM public.messages WHERE chat_id = _chat_id);
  
  DELETE FROM public.messages WHERE chat_id = _chat_id;
  
  DELETE FROM public.channel_settings WHERE chat_id = _chat_id;
  
  DELETE FROM public.chat_members WHERE chat_id = _chat_id;
  
  DELETE FROM public.chats WHERE id = _chat_id;

  RETURN true;
END; $$;

-- --------------------------- TRIGGERS --------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS chats_updated ON public.chats;
CREATE TRIGGER chats_updated BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS messages_updated ON public.messages;
CREATE TRIGGER messages_updated BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS channel_settings_updated ON public.channel_settings;
CREATE TRIGGER channel_settings_updated BEFORE UPDATE ON public.channel_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------- RLS -----------------------------------
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_watches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users    ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- chats
DROP POLICY IF EXISTS "Members see their chats" ON public.chats;
CREATE POLICY "Members see their chats" ON public.chats FOR SELECT TO authenticated USING (public.is_chat_member(auth.uid(), id));
DROP POLICY IF EXISTS "Super admin sees all chats" ON public.chats;
CREATE POLICY "Super admin sees all chats" ON public.chats FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Authenticated create chats" ON public.chats;
CREATE POLICY "Authenticated create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- chat_members
DROP POLICY IF EXISTS "Members see co-members" ON public.chat_members;
CREATE POLICY "Members see co-members" ON public.chat_members FOR SELECT TO authenticated USING (public.is_chat_member(auth.uid(), chat_id));
DROP POLICY IF EXISTS "Add members" ON public.chat_members;
CREATE POLICY "Add members" ON public.chat_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR EXISTS (
    SELECT 1 FROM public.chat_members cm WHERE cm.chat_id=chat_members.chat_id AND cm.user_id=auth.uid() AND cm.role IN ('owner','admin')
  )
);
DROP POLICY IF EXISTS "Remove self" ON public.chat_members;
CREATE POLICY "Remove self" ON public.chat_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Members update own membership" ON public.chat_members;
CREATE POLICY "Members update own membership" ON public.chat_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- messages
DROP POLICY IF EXISTS "Members see messages" ON public.messages;
CREATE POLICY "Members see messages" ON public.messages FOR SELECT TO authenticated USING (public.is_chat_member(auth.uid(), chat_id));
DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
  AND public.is_chat_member(auth.uid(), chat_id)
  AND (
    (SELECT type FROM public.chats WHERE id = chat_id) <> 'channel'
    OR EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_id = chat_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  )
);
DROP POLICY IF EXISTS "Sender updates own message" ON public.messages;
CREATE POLICY "Sender updates own message" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);

-- reactions
DROP POLICY IF EXISTS "Members see reactions" ON public.reactions;
CREATE POLICY "Members see reactions" ON public.reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members add reactions" ON public.reactions;
CREATE POLICY "Members add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Remove own reaction" ON public.reactions;
CREATE POLICY "Remove own reaction" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- channel_settings
DROP POLICY IF EXISTS "Members see channel settings" ON public.channel_settings;
CREATE POLICY "Members see channel settings" ON public.channel_settings FOR SELECT TO authenticated USING (
  public.is_chat_member(auth.uid(), chat_id)
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);
DROP POLICY IF EXISTS "Channel members manage channel settings" ON public.channel_settings;
CREATE POLICY "Channel members manage channel settings" ON public.channel_settings FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'platform_admin') OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.channel_settings.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);
DROP POLICY IF EXISTS "Channel members manage channel settings (update)" ON public.channel_settings;
CREATE POLICY "Channel members manage channel settings (update)" ON public.channel_settings FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'platform_admin') OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.channel_settings.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);
DROP POLICY IF EXISTS "Channel members manage channel settings (delete)" ON public.channel_settings;
CREATE POLICY "Channel members manage channel settings (delete)" ON public.channel_settings FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'platform_admin') OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.channel_settings.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

-- comments
DROP POLICY IF EXISTS "See approved comments" ON public.comments;
CREATE POLICY "See approved comments" ON public.comments FOR SELECT TO authenticated USING (
  status='approved' OR auth.uid()=user_id OR public.has_role(auth.uid(),'super_admin')
);
DROP POLICY IF EXISTS "Submit comments" ON public.comments;
CREATE POLICY "Submit comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin manage comments" ON public.comments;
CREATE POLICY "Admin manage comments" ON public.comments FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'platform_admin')
);

-- ad_watches
DROP POLICY IF EXISTS "See own ad watches" ON public.ad_watches;
CREATE POLICY "See own ad watches" ON public.ad_watches FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Track ad watches" ON public.ad_watches;
CREATE POLICY "Track ad watches" ON public.ad_watches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Update ad watches" ON public.ad_watches;
CREATE POLICY "Update ad watches" ON public.ad_watches FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- blocked_users
DROP POLICY IF EXISTS "See own blocks" ON public.blocked_users;
CREATE POLICY "See own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Block users" ON public.blocked_users;
CREATE POLICY "Block users" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Unblock users" ON public.blocked_users;
CREATE POLICY "Unblock users" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- --------------------------- REALTIME --------------------------------
ALTER TABLE public.messages         REPLICA IDENTITY FULL;
ALTER TABLE public.reactions        REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members     REPLICA IDENTITY FULL;
ALTER TABLE public.channel_settings REPLICA IDENTITY FULL;
ALTER TABLE public.comments         REPLICA IDENTITY FULL;
ALTER TABLE public.profiles         REPLICA IDENTITY FULL;
ALTER TABLE public.chats            REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;         EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;     EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;         EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;         EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;            EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Done. Bootstrap a super admin manually:
--   INSERT INTO public.user_roles (user_id, role) VALUES ('<auth-user-uuid>', 'super_admin');