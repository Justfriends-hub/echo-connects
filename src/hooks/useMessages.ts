import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Message, Reaction, UserProfile } from '@/types/chat';

const PAGE_SIZE = 30;
const CACHE_KEY_PREFIX = 'echo-connects.messages-cache';

function getCachedMessages(chatId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}.${chatId}`);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

function saveCachedMessages(chatId: string, messages: Message[]) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}.${chatId}`, JSON.stringify(messages));
  } catch {
    // ignore write errors
  }
}

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

    const cached = getCachedMessages(chatId);
    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      setLoading(true);
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const desc = (msgs || []) as Message[];
      setHasMore(desc.length === PAGE_SIZE);
      const list = desc.slice().reverse();
      const hydrated = await hydrate(list);
      setMessages(hydrated);
      saveCachedMessages(chatId, hydrated);
      setLoading(false);
    } catch (error) {
      console.warn('[useMessages] load failed, using cached messages if available:', error);
      if (!cached.length) {
        setMessages([]);
        setHasMore(true);
        setLoading(false);
      }
    }
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
        // Only process reactions for messages in this chat
        setMessages(prev => {
          const belongsToChat = prev.some(msg => msg.id === r.message_id);
          if (!belongsToChat) return prev;
          return prev.map(msg => {
            if (msg.id !== r.message_id) return msg;
            let next = msg.reactions || [];
            if (payload.eventType === 'DELETE') {
              next = next.filter(x => x.id !== r.id);
            } else if (payload.eventType === 'INSERT') {
              if (!next.some(x => x.id === r.id)) next = [...next, r as Reaction];
            }
            return { ...msg, reactions: next };
          });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    saveCachedMessages(chatId, messages);
  }, [chatId, messages]);

  const sendMessage = useCallback(async (content: string, senderId: string) => {
    if (!chatId || !senderId || !content.trim()) return;

    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: senderId,
      content: content.trim(),
      type: 'text',
      status: 'sending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reactions: [],
    } as Message;

    setMessages(prev => {
      const next = [...prev, tempMessage];
      saveCachedMessages(chatId, next);
      return next;
    });

    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim(), type: 'text', status: 'sent' })
      .select('*')
      .single();

    if (error) {
      console.error('[useMessages] sendMessage failed', error);
      toast.error('Message failed to send. It will remain in draft mode until the next sync.');
      return;
    }

    setMessages(prev => {
      const next = prev.map(msg => msg.id === tempId ? { ...(data as Message), reactions: [], sender: prev.find(m => m.id === tempId)?.sender } : msg);
      saveCachedMessages(chatId, next);
      return next;
    });
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const interval = window.setInterval(() => {
      load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [chatId, load]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, reload: load, sendMessage };
}
