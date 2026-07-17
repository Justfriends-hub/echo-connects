-- Ensure forwarded_from and forwarded_at fields exist on messages table
-- This is idempotent and safe to run multiple times

DO $$
BEGIN
  -- Add forwarded_from if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='forwarded_from'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN forwarded_from UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add forwarded_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='forwarded_at'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN forwarded_at TIMESTAMPTZ;
  END IF;

  -- Ensure reply_to_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='reply_to_id'
  ) THEN
    ALTER TABLE public.messages 
      ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure REPLICA IDENTITY is set for realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
