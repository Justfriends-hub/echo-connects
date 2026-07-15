-- ================================================================
-- CHANNEL MANAGEMENT — Consolidated SQL Updates
-- ================================================================
-- Copy and paste this entire block into your Supabase SQL Editor
-- This includes:
-- 1. Backfill invite codes for existing channels
-- 2. Delete channel function
-- ================================================================

-- ==================== BACKFILL INVITE CODES ====================
-- Generate invite codes for any channels that don't have one yet
UPDATE public.channel_settings 
SET invite_code = public.generate_invite_code()
WHERE invite_code IS NULL;

-- Verify all channels now have codes
SELECT chat_id, invite_code 
FROM public.channel_settings 
WHERE invite_code IS NULL;
-- This should return 0 rows if backfill worked

-- ==================== DELETE CHANNEL FUNCTION ====================
-- Delete a channel (owners/admins only) with cascade to all related data
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

-- ================================================================
-- DONE — Run these updates, then:
-- 1. Refresh your app
-- 2. Create a NEW channel and test the invite link
-- 3. The "Delete Channel" button will appear in channel info (i button) for admins
-- ================================================================
