-- Add a storage object path to statuses so media files can be cleaned up later.
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS media_path text;

CREATE INDEX IF NOT EXISTS idx_statuses_media_path ON public.statuses (media_path);

-- Cleanup helper for expired statuses.
-- This only deletes rows from the table; storage object cleanup should use media_path
-- and either a Supabase bucket retention policy or a scheduled server-side cleanup job.
CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.statuses
  WHERE expires_at <= now();
END;
$$;
