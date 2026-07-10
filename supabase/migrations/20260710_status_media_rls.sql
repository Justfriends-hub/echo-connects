-- Storage RLS policies for status-media bucket
-- These policies keep status media in a private bucket and allow only proper authenticated access.

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Users can upload to their own user_id folder only
DROP POLICY IF EXISTS "Users can upload status media to own folder" ON storage.objects;
CREATE POLICY "Users can upload status media to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'status-media'
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Authenticated users can read status media
DROP POLICY IF EXISTS "Authenticated users can read status media" ON storage.objects;
CREATE POLICY "Authenticated users can read status media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'status-media');

-- Remove public read access; keep bucket access authenticated-only
DROP POLICY IF EXISTS "Public can read status media" ON storage.objects;

-- Users can delete only their own status media
DROP POLICY IF EXISTS "Users can delete own status media" ON storage.objects;
CREATE POLICY "Users can delete own status media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'status-media'
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Ensure the media_path column exists for storage cleanup.
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS media_path text;

CREATE INDEX IF NOT EXISTS idx_statuses_media_path ON public.statuses (media_path);

-- Create pg_net and pg_cron extensions if available.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Trigger helper: call the Edge Function when a status row with media is deleted.
-- Replace <YOUR_PROJECT_REF> with your Supabase project ref or full Edge Function URL.
-- Set a secure DB setting named status_media.cleanup_key with the same secret used by the Edge Function.
CREATE OR REPLACE FUNCTION public.notify_status_media_deletion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  request_body text;
BEGIN
  IF OLD.media_path IS NULL OR trim(OLD.media_path) = '' THEN
    RETURN NULL;
  END IF;

  request_body := jsonb_build_object('media_path', OLD.media_path)::text;

  PERFORM
    (SELECT content FROM pg_net.http_post(
      'https://<YOUR_PROJECT_REF>.functions.supabase.co/delete-status-media',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(current_setting('status_media.cleanup_key', true), '')
      ),
      request_body
    ));

  RETURN NULL;
EXCEPTION WHEN others THEN
  -- Keep deletions from succeeding, but log failures in notify output.
  RAISE NOTICE 'notify_status_media_deletion failed for media_path=%: %', OLD.media_path, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_status_media_deletion() FROM public;

DROP TRIGGER IF EXISTS status_media_deletion_trigger ON public.statuses;
CREATE TRIGGER status_media_deletion_trigger
AFTER DELETE ON public.statuses
FOR EACH ROW
WHEN (OLD.media_path IS NOT NULL)
EXECUTE FUNCTION public.notify_status_media_deletion();

-- Expiry cleanup function called by pg_cron. Not exposed to authenticated client users.
CREATE OR REPLACE FUNCTION public.expire_statuses()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.status_views
  WHERE status_id IN (
    SELECT id FROM public.statuses WHERE expires_at <= now()
  );

  DELETE FROM public.statuses
  WHERE expires_at <= now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_statuses() FROM public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-statuses-cleanup'
  ) THEN
    PERFORM cron.schedule(
      'expire-statuses-cleanup',
      '*/15 * * * *',
      $$ SELECT public.expire_statuses(); $$
    );
  END IF;
END $$;
