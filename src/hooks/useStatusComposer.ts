import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    const { error } = await supabase.from('statuses').insert([{ 
      user_id: user.id,
      text_content: text,
      background_color: backgroundColor,
      media_type: 'text',
      privacy_mode,
    }]);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['statuses', user.id] });
  }, [getPrivacyPreference, queryClient, user]);

  const postMediaStatus = useCallback(async (file: File, caption: string, mediaType: 'image' | 'video') => {
    if (!user) throw new Error('Not authenticated');
    const privacy_mode = getPrivacyPreference();
    const filename = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('status-media')
      .upload(`${user.id}/${filename}`, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('status-media').getPublicUrl(`${user.id}/${filename}`);
    const url = data.publicUrl;
    const { error } = await supabase.from('statuses').insert([{ 
      user_id: user.id,
      media_url: url,
      media_type: mediaType,
      caption,
      privacy_mode,
    }]);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['statuses', user.id] });
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
