import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Message, Reaction, UserProfile } from '@/types/chat';

const PAGE_SIZE = 30;

/**
 * Loads messages for a chat with sender profile + reactions, subscribes to realtime.
 * Supports paginated loading of older messages via `loadOlder()`.
 */
export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const hydrate = useCallback(async (rows: Message[]): Promise<Message[]> => {
    if (rows.length === 0) return [];
    const senderIds = Array.from(new Set(rows.map(m => m.sender_id)));
    const msgIds = rows.map(m => m.id);
    const [{ data: profiles }, { data: reactions }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', senderIds),
      supabase.from('reactions').select('*').in('message_id', msgIds),
    ]);
    const profMap = new Map((profiles || []).map((p: any) => [p.id, p as UserProfile]));
    const reactionMap = new Map<string, Reaction[]>();
    (reactions || []).forEach((r: any) => {
      const arr = reactionMap.get(r.message_id) || [];
      arr.push(r as Reaction);
      reactionMap.set(r.message_id, arr);
    });
    return rows.map(m => ({
      ...m,
      sender: profMap.get(m.sender_id),
      reactions: reactionMap.get(m.id) || [],
    }));
  }, []);

  const load = useCallback(async () => {
    if (!chatId) { setMessages([]); setHasMore(true); return; }
    setLoading(true);
    // Fetch the most recent PAGE_SIZE messages (descending), then reverse for display order.
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    const desc = (msgs || []) as Message[];
    setHasMore(desc.length === PAGE_SIZE);
    const list = desc.slice().reverse();
    setMessages(await hydrate(list));
    setLoading(false);
  }, [chatId, hydrate]);

  const loadOlder = useCallback(async () => {
    if (!chatId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    const desc = (msgs || []) as Message[];
    setHasMore(desc.length === PAGE_SIZE);
    const older = await hydrate(desc.slice().reverse());
    setMessages(prev => [...older, ...prev]);
    setLoadingOlder(false);
  }, [chatId, loadingOlder, hasMore, messages, hydrate]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for messages + reactions in this chat
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const m = payload.new as Message;
        // Fetch sender profile
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', m.sender_id).maybeSingle();
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, { ...m, sender: prof as UserProfile, reactions: [] }]);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x));
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'reactions',
      }, (payload) => {
        const r: any = payload.new || payload.old;
        if (!r) return;
        setMessages(prev => prev.map(msg => {
          if (msg.id !== r.message_id) return msg;
          let next = msg.reactions || [];
          if (payload.eventType === 'DELETE') {
            next = next.filter(x => x.id !== r.id);
          } else if (payload.eventType === 'INSERT') {
            if (!next.some(x => x.id === r.id)) next = [...next, r as Reaction];
          }
          return { ...msg, reactions: next };
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, reload: load };
}
