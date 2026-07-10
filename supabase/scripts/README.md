# Status Media Storage Setup

This directory contains scripts and migrations to set up the `status-media` bucket in Supabase for storing user status images and videos.

## Quick Setup

### 1. Get your Supabase credentials

From your Supabase dashboard:
- Project URL: `https://<project-id>.supabase.co`
- Service Role Key: Settings → API → Service Role (secret)

### 2. Create the bucket and RLS policies

**Option A: Using the bash script (recommended)**

```bash
# From your shell, in the project root:
bash supabase/scripts/create_status_bucket.sh \
  "https://your-project-id.supabase.co" \
  "your-service-role-key"
```

**Option B: Manual steps**

1. Go to your Supabase dashboard → Storage
2. Click "New bucket"
   - Name: `status-media`
   - Make it private (uncheck "Public bucket")
3. Go to SQL Editor in your dashboard
4. Run the migrations:
   - `supabase/migrations/20260710_add_status_media_path.sql`
   - `supabase/migrations/20260710_status_media_rls.sql`

### 3. Verify in your app

- Users can now upload status images/videos
- Media will be stored in the private `status-media` bucket
- Files are automatically cleaned up 24 hours after creation via `expires_at`
- The `media_path` column tracks storage paths for cleanup

## File Limits & Allowed Types

- Max file size: **50 MB**
- Allowed types:
  - Images: JPEG, PNG, GIF, WebP
  - Video: MP4, MOV (QuickTime)

## Storage Paths

Files are organized by user:
```
status-media/
  └─ {user_id}/
      ├─ 1720569342541_photo.jpg
      └─ 1720569412345_video.mp4
```

## Cleanup & Expiry

- Status rows expire after **24 hours** (set via `expires_at`)
- Expired rows are removed automatically (via RLS policy + background cleanup)
- Storage files are cleaned up via the `delete_expired_status_media()` function
- To enable automatic cleanup:
  - Set up a Supabase scheduled job (PostgreSQL cron extension)
  - Or use a Vercel/Netlify cron function to call the cleanup endpoint

## Privacy & Access

- **Private bucket**: Only authenticated users can see their role
- **RLS policies enforce**:
  - Users can only upload to their own folder (`{user_id}/...`)
  - Users can read all status media (contact-based restrictions can be added via stored procedures)
  - Users can only delete their own uploads

## Optional: Add Contact-based Privacy

To restrict who sees status media based on privacy settings, enhance the RLS policy:

```sql
CREATE OR REPLACE POLICY "Respect status privacy when reading media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'status-media'
  AND (
    -- User can always see their own media
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR
    -- Otherwise check privacy settings in statuses table
    (SELECT privacy_mode FROM public.statuses 
     WHERE media_path = name AND expires_at > now()) IN ('contacts', 'everyone')
  )
);
```

## Troubleshooting

**"Failed to upload media"**
- Check file size (< 50 MB)
- Check file type (only JPEG, PNG, GIF, WebP, MP4, MOV allowed)
- Verify user is authenticated

**"Access denied"**
- Ensure you've run the RLS policy migrations
- Check that `status-media` bucket exists
- Verify the bucket is private (not public)

**Files not deleting after 24 hours**
- The database rows expire automatically
- Storage files can be deleted manually or via a scheduled cleanup job
