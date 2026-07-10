#!/bin/bash
# Complete status-media bucket setup with RLS policies
# Usage: bash create_status_bucket.sh <PROJECT_URL> <SERVICE_ROLE_KEY>

PROJECT_URL="${1:-https://your-project.supabase.co}"
SERVICE_ROLE_KEY="${2}"

if [ -z "$SERVICE_ROLE_KEY" ] || [ "$PROJECT_URL" = "https://your-project.supabase.co" ]; then
  echo "Usage: $0 <PROJECT_URL> <SERVICE_ROLE_KEY>"
  echo "Example: $0 https://abc123xyz.supabase.co sk-xxxxx..."
  exit 1
fi

echo "================================"
echo "Setting up status-media bucket..."
echo "================================"

# 1. Create bucket
echo ""
echo "[1/2] Creating status-media bucket..."
BUCKET_RESPONSE=$(curl -s -X POST \
  "${PROJECT_URL}/storage/v1/b" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "status-media",
    "name": "status-media",
    "public": false,
    "file_size_limit": 52428800,
    "allowed_mime_types": ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime"]
  }')

echo "$BUCKET_RESPONSE"

# 2. Apply RLS policies via SQL
echo ""
echo "[2/2] Applying RLS policies..."

SQL_POLICIES=$(cat <<'EOF'
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload status media to own folder" ON storage.objects;
CREATE POLICY "Users can upload status media to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'status-media'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Authenticated users can read status media
DROP POLICY IF EXISTS "Authenticated users can read status media" ON storage.objects;
CREATE POLICY "Authenticated users can read status media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'status-media');

-- Public can read status media
DROP POLICY IF EXISTS "Public can read status media" ON storage.objects;
CREATE POLICY "Public can read status media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'status-media');

-- Users can delete their own status media
DROP POLICY IF EXISTS "Users can delete own status media" ON storage.objects;
CREATE POLICY "Users can delete own status media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'status-media'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Add media_path column if missing
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS media_path text;

CREATE INDEX IF NOT EXISTS idx_statuses_media_path ON public.statuses (media_path);

-- Cleanup function for expired statuses
DROP FUNCTION IF EXISTS public.delete_expired_status_media();
CREATE OR REPLACE FUNCTION public.delete_expired_status_media()
RETURNS TABLE(deleted_count bigint, deleted_files text[]) LANGUAGE plpgsql AS $$
DECLARE
  v_deleted_count bigint := 0;
  v_deleted_files text[] := ARRAY[]::text[];
  v_file_path text;
BEGIN
  FOR v_file_path IN
    SELECT media_path
    FROM public.statuses
    WHERE expires_at <= now()
      AND media_path IS NOT NULL
      AND media_type IN ('image', 'video')
  LOOP
    v_deleted_files := array_append(v_deleted_files, v_file_path);
    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  DELETE FROM public.status_views
  WHERE status_id IN (
    SELECT id FROM public.statuses WHERE expires_at <= now()
  );

  DELETE FROM public.statuses
  WHERE expires_at <= now();

  RETURN QUERY SELECT v_deleted_count, v_deleted_files;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_expired_status_media() TO authenticated;

-- Add to realtime publication
DO $$
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE storage.objects;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
EOF
)

# Execute SQL via API
SQL_RESPONSE=$(curl -s -X POST \
  "${PROJECT_URL}/rest/v1/rpc/sql" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_POLICIES" | jq -Rs .)}" 2>/dev/null || echo "")

if [ -z "$SQL_RESPONSE" ] || echo "$SQL_RESPONSE" | grep -q "error"; then
  echo "⚠ SQL execution via API failed or not supported. Run this SQL manually in Supabase SQL Editor:"
  echo ""
  echo "$SQL_POLICIES"
  echo ""
else
  echo "$SQL_RESPONSE"
fi

echo ""
echo "================================"
echo "✓ Setup complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Verify bucket 'status-media' exists in Storage"
echo "2. Run the SQL policies in Supabase SQL Editor if not applied automatically"
echo "3. Status media uploads will now:"
echo "   - Store privately in status-media bucket"
echo "   - Expire and auto-delete after 24 hours"
echo "   - Be tracked via media_path for cleanup"
