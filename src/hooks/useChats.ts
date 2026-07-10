import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Chat, Message } from '@/types/chat';

const CACHE_KEY_PREFIX = 'echo-connects.chat-cache';

function getCachedChats(userId: string): Chat[] {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}.${userId}`);
    return raw ? (JSON.parse(raw) as Chat[]) : [];
  } catch {
    return [];
  }
}

function saveCachedChats(userId: string, chats: Chat[]) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}.${userId}`, JSON.stringify(chats));
  } catch {
    // ignore local storage write failures
  }
}

async function loadChats(userId: string) {
  const cachedChats = getCachedChats(userId);

  // 1. Fetch chat ids the user belongs to
  const { data: memberships, error: membershipsError } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', userId);
  if (membershipsError) throw membershipsError;

  const ids = (memberships || []).map((m: any) => m.chat_id);
  if (ids.length === 0) {
    saveCachedChats(userId, []);
    return [];
  }

  const { data: chatRows, error: chatRowsError } = await supabase
    .from('chats')
    .select('*')
    .in('id', ids);
  if (chatRowsError) throw chatRowsError;
  if (!chatRows || chatRows.length === 0) {
    saveCachedChats(userId, []);
    return [];
  }

  const { data: allMembers, error: allMembersError } = await supabase
    .from('chat_members')
    .select('chat_id, user_id')
    .in('chat_id', ids);
  if (allMembersError) throw allMembersError;

  const { data: recentMessages, error: recentMessagesError } = await supabase
    .from('messages')
    .select('*')
    .in('chat_id', ids)
    .order('created_at', { ascending: false })
    .limit(ids.length * 2);
  if (recentMessagesError) throw recentMessagesError;

  const lastMsgMap = new Map<string, Message>();
  (recentMessages || []).forEach((m: any) => {
    if (!lastMsgMap.has(m.chat_id)) {
      lastMsgMap.set(m.chat_id, m as Message);
    }
  });

  const membersMap = new Map<string, string[]>();
  (allMembers || []).forEach((m: any) => {
    const arr = membersMap.get(m.chat_id) || [];
    arr.push(m.user_id);
    membersMap.set(m.chat_id, arr);
  });

  const otherUserIds = new Set<string>();
  chatRows.forEach((c: any) => {
    if (c.type === 'direct') {
      const members = membersMap.get(c.id) || [];
      const otherId = members.find((id: string) => id !== userId);
      if (otherId) otherUserIds.add(otherId);
    }
  });

  let profileMap = new Map<string, { display_name: string; avatar_url: string | null; is_online: boolean }>();
  if (otherUserIds.size > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_online')
      .in('id', Array.from(otherUserIds));
    if (profilesError) throw profilesError;
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url, is_online: p.is_online });
    });
  }

  const enriched: Chat[] = (chatRows || []).map((c: any) => {
    const members = membersMap.get(c.id) || [];
    let displayName = c.name;
    let avatar = c.avatar_url;
    let isOnline = false;

    if (c.type === 'direct') {
      const otherId = members.find((id: string) => id !== userId);
      if (otherId) {
        const prof = profileMap.get(otherId);
        if (prof) {
          displayName = prof.display_name;
          avatar = prof.avatar_url;
          isOnline = prof.is_online;
        }
      }
    }

    return {
      ...c,
      name: displayName,
      avatar_url: avatar,
      is_online: isOnline,
      member_count: members.length,
      last_message: lastMsgMap.get(c.id),
    } as Chat;
  });

  enriched.sort((a, b) => {
    const at = a.last_message?.created_at || a.created_at;
    const bt = b.last_message?.created_at || b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  saveCachedChats(userId, enriched);
  return enriched;
}

export function useChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery(['chats', user?.id], async () => {
    if (!user) return [];
    return loadChats(user.id);
  }, {
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: user ? getCachedChats(user.id) : [],
  });

  const reload = useCallback(() => {
    if (!user) return;
    return queryClient.invalidateQueries(['chats', user.id]);
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      queryClient.invalidateQueries(['chats', user.id]);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chats-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        queryClient.setQueryData<Chat[]>(['chats', user.id], (old) => {
          if (!old) return old;
          const idx = old.findIndex((c) => c.id === msg.chat_id);
          if (idx === -1) {
            queryClient.invalidateQueries(['chats', user.id]);
            return old;
          }
          const updated = [...old];
          updated[idx] = { ...updated[idx], last_message: msg };
          updated.sort((a, b) => {
            const at = a.last_message?.created_at || a.created_at;
            const bt = b.last_message?.created_at || b.created_at;
            return new Date(bt).getTime() - new Date(at).getTime();
          });
          return updated;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${user.id}` }, () => queryClient.invalidateQueries(['chats', user.id]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user]);

  return {
    chats: query.data || [],
    loading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    reload,
  };
}
