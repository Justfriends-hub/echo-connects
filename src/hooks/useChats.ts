import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Chat, Message, UserProfile } from '@/types/chat';

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

/**
 * Loads all chats the current user is a member of, plus realtime updates.
 * Computes display name for direct chats using the other member's profile.
 *
 * Optimised: fetches all enrichment data in batched queries instead of per-chat N+1.
 */
export function useChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setChats([]); setLoading(false); return; }

    const cachedChats = getCachedChats(user.id);
    if (cachedChats.length > 0) {
      setChats(cachedChats);
      setLoading(false);
    }

    try {
      setLoading(true);

      // 1. Fetch chat ids the user belongs to
      const { data: memberships, error: membershipsError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id);
      if (membershipsError) throw membershipsError;

      const ids = (memberships || []).map((m: any) => m.chat_id);
      if (ids.length === 0) {
        setChats([]);
        saveCachedChats(user.id, []);
        setLoading(false);
        return;
      }

      // 2. Fetch all chat rows in one query
      const { data: chatRows, error: chatRowsError } = await supabase
        .from('chats')
        .select('*')
        .in('id', ids);
      if (chatRowsError) throw chatRowsError;
      if (!chatRows || chatRows.length === 0) {
        setChats([]);
        saveCachedChats(user.id, []);
        setLoading(false);
        return;
      }

      // 3. Batch: fetch all members for these chats in one query
      const { data: allMembers, error: allMembersError } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', ids);
      if (allMembersError) throw allMembersError;

      // 4. Batch: fetch latest message per chat using a single ordered query
      //    We fetch more than needed and pick the latest per chat client-side
      const { data: recentMessages, error: recentMessagesError } = await supabase
        .from('messages')
        .select('*')
        .in('chat_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * 2);
      if (recentMessagesError) throw recentMessagesError;

      // Build a map of chat_id -> latest message
      const lastMsgMap = new Map<string, Message>();
      (recentMessages || []).forEach((m: any) => {
        if (!lastMsgMap.has(m.chat_id)) {
          lastMsgMap.set(m.chat_id, m as Message);
        }
      });

      // Build a map of chat_id -> member user_ids
      const membersMap = new Map<string, string[]>();
      (allMembers || []).forEach((m: any) => {
        const arr = membersMap.get(m.chat_id) || [];
        arr.push(m.user_id);
        membersMap.set(m.chat_id, arr);
      });

      // 5. For direct chats, collect the "other" user ids and batch-fetch their profiles
      const otherUserIds = new Set<string>();
      chatRows.forEach((c: any) => {
        if (c.type === 'direct') {
          const members = membersMap.get(c.id) || [];
          const otherId = members.find((id: string) => id !== user.id);
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

      // 6. Enrich each chat
      const enriched: Chat[] = chatRows.map((c: any) => {
        const members = membersMap.get(c.id) || [];
        let displayName = c.name;
        let avatar = c.avatar_url;
        let isOnline = false;

        if (c.type === 'direct') {
          const otherId = members.find((id: string) => id !== user.id);
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

      // Sort by last message time desc
      enriched.sort((a, b) => {
        const at = a.last_message?.created_at || a.created_at;
        const bt = b.last_message?.created_at || b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });

      setChats(enriched);
      saveCachedChats(user.id, enriched);
      setLoading(false);
    } catch (error) {
      console.warn('[useChats] load failed, using cached chats if available:', error);
      if (!cachedChats.length) {
        setChats([]);
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [user, load]);

  // Realtime: update chat list on new messages or membership changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chats-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        setChats(prev => {
          const idx = prev.findIndex(c => c.id === msg.chat_id);
          if (idx === -1) {
            load();
            return prev;
          }
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: msg };
          updated.sort((a, b) => {
            const at = a.last_message?.created_at || a.created_at;
            const bt = b.last_message?.created_at || b.created_at;
            return new Date(bt).getTime() - new Date(at).getTime();
          });
          return updated;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  return { chats, loading, reload: load };
}
