-- =====================================================================
-- SUPABASE SCHEMA FIX - REPLY & FORWARD SUPPORT
-- =====================================================================
-- Copy and paste this entire script into Supabase SQL Editor
-- Safe to run multiple times (idempotent)
-- =====================================================================

-- ----------------------------- STEP 1: ADD MISSING COLUMNS --------
-- Ensure all required fields exist on messages table

DO $$
BEGIN
  -- Add reply_to_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='messages' AND column_name='reply_to_id'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added reply_to_id column';
  END IF;

  -- Add forwarded_from if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='messages' AND column_name='forwarded_from'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN forwarded_from UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added forwarded_from column';
  END IF;

  -- Add forwarded_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='messages' AND column_name='forwarded_at'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN forwarded_at TIMESTAMPTZ;
    RAISE NOTICE 'Added forwarded_at column';
  END IF;

END $$;

-- ----------------------------- STEP 2: SET REPLICA IDENTITY -------
-- Enable full replication for realtime support

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ----------------------------- STEP 3: VERIFY RLS POLICIES --------
-- Ensure correct RLS policies exist for message inserts

DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages" ON public.messages 
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      SELECT 1 FROM public.chat_members 
      WHERE chat_id = messages.chat_id AND user_id = auth.uid()
    ) IS NOT NULL
    AND (
      (SELECT type FROM public.chats WHERE id = messages.chat_id) <> 'channel'
      OR (
        SELECT 1 FROM public.chat_members
        WHERE chat_id = messages.chat_id
          AND user_id = auth.uid()
          AND role = 'owner'
      ) IS NOT NULL
    )
  );

-- ----------------------------- STEP 4: INDEX OPTIMIZATION --------
-- Add indexes for faster reply/forward lookups

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id 
  ON public.messages(reply_to_id) 
  WHERE reply_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from 
  ON public.messages(forwarded_from) 
  WHERE forwarded_from IS NOT NULL;

-- ----------------------------- STEP 5: TRIGGERS ----
-- Ensure updated_at trigger exists

DROP TRIGGER IF EXISTS messages_updated ON public.messages;
CREATE TRIGGER messages_updated 
  BEFORE UPDATE ON public.messages
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- ✓ Schema is now ready for reply and forward features
-- Test by sending a message with reply_to_id or forwarded_from
-- =====================================================================
