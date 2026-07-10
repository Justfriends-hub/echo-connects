import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STATUS_PRIVACY_KEY = 'chirp.statusPrivacy';

export function useStatusComposer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const getPrivacyPreference = useCallback(() => {
    if (typeof window === 'undefined') return 'contacts';
    return (localStorage.getItem(STATUS_PRIVACY_KEY) as 'contacts' | 'contacts_except' | 'only_share_with') || 'contacts';
  }, []);

  const setPrivacyPreference = useCallback((mode: 'contacts' | 'contacts_except' | 'only_share_with') => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STATUS_PRIVACY_KEY, mode);
  }, []);

  const postTextStatus = useCallback(async (text: string, backgroundColor: string) => {
    if (!user) throw new Error('Not authenticated');
    const privacy_mode = getPrivacyPreference();
    // Optimistic local status so UI shows uploading state immediately
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempStatus = {
      id: tempId,
      user_id: user.id,
      media_url: null,
      media_type: 'text',
      text_content: text,
      background_color: backgroundColor,
      caption: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      privacy_mode,
      user: {
        id: user.id,
        username: (user.user_metadata && (user.user_metadata as any).username) || '',
        display_name: (user.user_metadata && (user.user_metadata as any).display_name) || user.email || 'Me',
        avatar_url: (user.user_metadata && (user.user_metadata as any).avatar_url) || null,
      },
    } as any;

    queryClient.setQueryData(['statuses', user.id], (old: any) => {
      if (!old) {
        return { myStatuses: [tempStatus], recentUpdates: [], viewedUpdates: [], hasUnseenStatuses: false };
      }
      return { ...old, myStatuses: [tempStatus, ...(old.myStatuses || [])] };
    });

    const { error } = await supabase.from('statuses').insert([{ 
      user_id: user.id,
      text_content: text,
      background_color: backgroundColor,
      media_type: 'text',
      privacy_mode,
    }]);
    if (error) {
      // remove temp status and notify
      queryClient.setQueryData(['statuses', user.id], (old: any) => ({ ...old, myStatuses: (old?.myStatuses || []).filter((s: any) => s.id !== tempId) }));
      toast.error('Failed to upload status');
      throw error;
    }

    // Refresh real data and notify user
    await queryClient.invalidateQueries({ queryKey: ['statuses', user.id] });
    toast.success('Status uploaded');
  }, [getPrivacyPreference, queryClient, user]);

  const postMediaStatus = useCallback(async (file: File, caption: string, mediaType: 'image' | 'video') => {
    if (!user) throw new Error('Not authenticated');
    const privacy_mode = getPrivacyPreference();
    // Optimistic local status so UI shows uploading state immediately
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempStatus = {
      id: tempId,
      user_id: user.id,
      media_url: URL.createObjectURL(file),
      media_type: mediaType,
      text_content: null,
      background_color: null,
      caption,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      privacy_mode,
      user: {
        id: user.id,
        username: (user.user_metadata && (user.user_metadata as any).username) || '',
        display_name: (user.user_metadata && (user.user_metadata as any).display_name) || user.email || 'Me',
        avatar_url: (user.user_metadata && (user.user_metadata as any).avatar_url) || null,
      },
    } as any;

    queryClient.setQueryData(['statuses', user.id], (old: any) => {
      if (!old) {
        return { myStatuses: [tempStatus], recentUpdates: [], viewedUpdates: [], hasUnseenStatuses: false };
      }
      return { ...old, myStatuses: [tempStatus, ...(old.myStatuses || [])] };
    });

    const filename = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('status-media')
      .upload(`${user.id}/${filename}`, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      queryClient.setQueryData(['statuses', user.id], (old: any) => ({ ...old, myStatuses: (old?.myStatuses || []).filter((s: any) => s.id !== tempId) }));
      toast.error('Failed to upload media');
      throw uploadError;
    }

    const { data } = supabase.storage.from('status-media').getPublicUrl(`${user.id}/${filename}`);
    const url = data.publicUrl;
    const { error } = await supabase.from('statuses').insert([{ 
      user_id: user.id,
      media_url: url,
      media_type: mediaType,
      caption,
      privacy_mode,
    }]);
    if (error) {
      queryClient.setQueryData(['statuses', user.id], (old: any) => ({ ...old, myStatuses: (old?.myStatuses || []).filter((s: any) => s.id !== tempId) }));
      toast.error('Failed to save status');
      throw error;
    }

    await queryClient.invalidateQueries({ queryKey: ['statuses', user.id] });
    toast.success('Status uploaded');
  }, [getPrivacyPreference, queryClient, user]);

  const deleteMyStatus = useCallback(async (statusId: string) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase.from('statuses').delete().eq('id', statusId).eq('user_id', user.id);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['statuses', user.id] });
  }, [queryClient, user]);

  return {
    getPrivacyPreference,
    setPrivacyPreference,
    postTextStatus,
    postMediaStatus,
    deleteMyStatus,
  };
}
