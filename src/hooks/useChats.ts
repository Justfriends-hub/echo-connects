import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Chat, Message, UserProfile } from '@/types/chat';

/**
 * Loads all chats the current user is a member of, plus realtime updates.
 * Computes display name for direct chats using the other member's profile.
 */
export function useChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setChats([]); setLoading(false); return; }

    // Fetch chat ids the user belongs to
    const { data: memberships } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id);

    const ids = (memberships || []).map((m: any) => m.chat_id);
    if (ids.length === 0) { setChats([]); setLoading(false); return; }

    const { data: chatRows } = await supabase
      .from('chats')
      .select('*')
      .in('id', ids);

    // For each chat, get last message, member count, and (for direct) the other user
    const enriched: Chat[] = await Promise.all(
      (chatRows || []).map(async (c: any) => {
        const [{ data: lastMsg }, { count: memberCount }, { data: members }] = await Promise.all([
          supabase.from('messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('chat_members').select('*', { count: 'exact', head: true }).eq('chat_id', c.id),
          supabase.from('chat_members').select('user_id').eq('chat_id', c.id),
        ]);

        let displayName = c.name;
        let avatar = c.avatar_url;
        let isOnline = false;

        if (c.type === 'direct') {
          const otherId = (members || []).map((m: any) => m.user_id).find((id: string) => id !== user.id);
          if (otherId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('display_name, avatar_url, is_online')
              .eq('id', otherId)
              .maybeSingle();
            if (prof) {
              displayName = (prof as any).display_name;
              avatar = (prof as any).avatar_url;
              isOnline = (prof as any).is_online;
            }
          }
        }

        return {
          ...c,
          name: displayName,
          avatar_url: avatar,
          is_online: isOnline,
          member_count: memberCount || 0,
          last_message: lastMsg as Message | undefined,
        } as Chat;
      })
    );

    // Sort by last message time desc
    enriched.sort((a, b) => {
      const at = a.last_message?.created_at || a.created_at;
      const bt = b.last_message?.created_at || b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    setChats(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh chat list on any new message or membership change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chats-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  return { chats, loading, reload: load };
}
