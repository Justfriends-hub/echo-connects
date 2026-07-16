-- Add forwarded metadata to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;

-- Update REPLICA IDENTITY if needed
ALTER TABLE public.messages REPLICA IDENTITY FULL;
