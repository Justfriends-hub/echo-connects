-- =================================================================
-- INVITE LINK SYSTEM — Consolidated SQL
-- =================================================================
-- Copy and paste this entire block into your Supabase SQL Editor
-- This includes all invite link functionality for channels
-- =================================================================

-- ==================== CHANNEL_SETTINGS TABLE ====================
-- Add invite_code column if not exists
DO $$ BEGIN
  ALTER TABLE public.channel_settings ADD COLUMN IF NOT EXISTS invite_code text NOT NULL UNIQUE DEFAULT substring(md5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 12);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ==================== INVITE CODE FUNCTIONS ====================
-- Generate a unique 12-character invite code
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

-- Regenerate invite code for an existing channel
CREATE OR REPLACE FUNCTION public.regenerate_channel_invite_code(_chat_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _new_code text;
BEGIN
  _new_code := public.generate_invite_code();
  UPDATE public.channel_settings SET invite_code = _new_code WHERE chat_id = _chat_id;
  RETURN _new_code;
END; $$;

-- Get channel preview by invite code (for join page)
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

-- ==================== UPDATED CREATE_CHANNEL ====================
-- Create a channel with automatic invite code generation
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

-- ==================== CHANNEL_SETTINGS RLS ====================
-- Members see channel settings
DROP POLICY IF EXISTS "Members see channel settings" ON public.channel_settings;
CREATE POLICY "Members see channel settings" ON public.channel_settings FOR SELECT TO authenticated USING (public.is_chat_member(auth.uid(), chat_id));

-- Channel owners/admins manage channel settings (UPDATE and DELETE)
DROP POLICY IF EXISTS "Channel members manage channel settings" ON public.channel_settings;
CREATE POLICY "Channel members manage channel settings" ON public.channel_settings FOR UPDATE, DELETE TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.channel_settings.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

-- =================================================================
-- DONE — Invite link system is ready
-- =================================================================
-- Usage:
-- 1. Create a channel: SELECT public.create_channel('My Channel');
-- 2. Get invite code: SELECT invite_code FROM channel_settings WHERE chat_id = '<chat-id>';
-- 3. Share: https://yourapp.com/join/<invite_code>
-- 4. Regenerate: SELECT public.regenerate_channel_invite_code('<chat-id>');
-- =================================================================
