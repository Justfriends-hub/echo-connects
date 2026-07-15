
-- App role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'platform_admin', 'user');
CREATE TYPE public.chat_type AS ENUM ('direct', 'group', 'channel');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'file', 'voice', 'system');
CREATE TYPE public.message_status AS ENUM ('sending', 'sent', 'delivered', 'seen');
CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.boost_mode AS ENUM ('instant', 'gradual');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  hide_phone BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Chats table (unified: direct, group, channel)
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type chat_type NOT NULL,
  name TEXT,
  avatar_url TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat members
CREATE TABLE public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  type message_type NOT NULL DEFAULT 'text',
  reply_to_id UUID REFERENCES public.messages(id),
  status message_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reactions
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Comments (with hidden approval)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status comment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channel settings (includes boost config)
CREATE TABLE public.channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL UNIQUE REFERENCES public.chats(id) ON DELETE CASCADE,
  comments_enabled BOOLEAN NOT NULL DEFAULT false,
  allowed_reactions TEXT[] DEFAULT ARRAY['👍','❤️','🔥','😂','😮','😢','🎉'],
  boost_count INTEGER NOT NULL DEFAULT 0,
  boost_target INTEGER,
  boost_mode boost_mode NOT NULL DEFAULT 'instant',
  boost_start_time TIMESTAMPTZ,
  boost_end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocked users
CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Ad watches (for comment gating)
CREATE TABLE public.ad_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  watch_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check chat membership
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id UUID, _chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE user_id = _user_id AND chat_id = _chat_id
  )
$$;

-- Helper: get current boost count (handles gradual)
CREATE OR REPLACE FUNCTION public.get_visible_boost(_chat_id UUID)
RETURNS INTEGER
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

  -- Natural growth curve: ease-out (fast start, slow end)
  progress := 1.0 - POWER(1.0 - (elapsed / total_duration), 3);
  RETURN settings.boost_count + FLOOR((settings.boost_target - settings.boost_count) * progress);
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_channel_settings_updated_at BEFORE UPDATE ON public.channel_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    COALESCE(NEW.phone, '')
  );
  -- Default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_watches ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: viewable by all authenticated, editable by owner
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: only super admin can manage, users see own
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Chats: visible to members
CREATE POLICY "Members see their chats" ON public.chats FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), id));
CREATE POLICY "Authenticated create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Super admin sees all chats" ON public.chats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Chat members: members can see co-members
CREATE POLICY "Members see co-members" ON public.chat_members FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), chat_id));
CREATE POLICY "Add members" ON public.chat_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Remove self" ON public.chat_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages: visible to chat members
CREATE POLICY "Members see messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), chat_id));
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
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
CREATE POLICY "Sender updates own message" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

-- Reactions: members can react
CREATE POLICY "Members see reactions" ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remove own reaction" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments: users see only approved, submit their own
CREATE POLICY "See approved comments" ON public.comments FOR SELECT TO authenticated
  USING (status = 'approved' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Submit comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manage comments" ON public.comments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'platform_admin'));

-- Channel settings: members see (without boost details), super admin full
CREATE POLICY "Members see channel settings" ON public.channel_settings FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), chat_id));
CREATE POLICY "Super admin manage settings" ON public.channel_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Blocked users
CREATE POLICY "See own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Block users" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Unblock users" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Ad watches
CREATE POLICY "See own ad watches" ON public.ad_watches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Track ad watches" ON public.ad_watches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update ad watches" ON public.ad_watches FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id, created_at DESC);
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON public.chat_members(chat_id);
CREATE INDEX idx_reactions_message ON public.reactions(message_id);
CREATE INDEX idx_comments_message ON public.comments(message_id, status);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_blocked_users_pair ON public.blocked_users(blocker_id, blocked_id);

-- Enable Realtime for messages and chat_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
