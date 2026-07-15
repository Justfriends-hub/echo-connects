import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Message, Reaction, UserProfile } from '@/types/chat';

const PAGE_SIZE = 30;
const CACHE_KEY_PREFIX = 'echo-connects.messages-cache';
const PENDING_CACHE_PREFIX = 'echo-connects.pending-messages';

type PendingMessageData = {
  tempId: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: Message['type'];
  created_at: string;
};

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

function getPendingMessages(chatId: string): PendingMessageData[] {
  try {
    const raw = localStorage.getItem(`${PENDING_CACHE_PREFIX}.${chatId}`);
    return raw ? (JSON.parse(raw) as PendingMessageData[]) : [];
  } catch {
    return [];
  }
}

function savePendingMessages(chatId: string, pending: PendingMessageData[]) {
  try {
    localStorage.setItem(`${PENDING_CACHE_PREFIX}.${chatId}`, JSON.stringify(pending));
  } catch {
    // ignore local storage failures
  }
}

function pendingToMessage(pending: PendingMessageData): Message {
  return {
    id: pending.tempId,
    chat_id: pending.chat_id,
    sender_id: pending.sender_id,
    content: pending.content,
    type: pending.type,
    status: 'sending',
    created_at: pending.created_at,
    updated_at: pending.created_at,
    reactions: [],
  } as Message;
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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

  const parseBoostReactions = (reactionInput?: string) => {
    if (!reactionInput) return [];
    return reactionInput
      .split(/[\s,]+/)
      .map(r => r.trim())
      .filter(Boolean);
  };

  const getBoostValue = (boost: any) => {
    if (boost.boost_target == null) return 0;
    if (boost.boost_mode === 'instant') return boost.boost_target;
    if (!boost.boost_start_time || !boost.boost_end_time) return 0;
    const elapsed = (Date.now() - new Date(boost.boost_start_time).getTime()) / 1000;
    const totalDuration = (new Date(boost.boost_end_time).getTime() - new Date(boost.boost_start_time).getTime()) / 1000;
    if (elapsed <= 0) return 0;
    if (elapsed >= totalDuration) return boost.boost_target;
    return Math.floor(boost.boost_target * (1.0 - Math.pow(1.0 - elapsed / totalDuration, 3)));
  };

  const applyPostBoosts = (rows: Message[], boosts: any[]) => {
    if (!boosts || boosts.length === 0) return rows;
    return rows.map((msg) => {
      const messageBoosts = boosts.filter((boost) => boost.message_id === msg.id);
      if (messageBoosts.length === 0) return msg;

      const boostedReactionCounts: Record<string, number> = {};
      let boostedViews = 0;

      messageBoosts.forEach((boost) => {
        const boostValue = getBoostValue(boost);
        if (boostValue <= 0) return;

        if (boost.boost_kind === 'likes') {
          const items = parseBoostReactions(boost.reaction);
          const selected = items.length > 0 ? items : ['👍'];
          const reactionWeights = selected.map((emoji) => {
            return {
              emoji,
              weight: msg.reactions?.filter((r) => r.emoji === emoji).length || 0,
            };
          });
          const totalWeight = reactionWeights.reduce((sum, item) => sum + (item.weight || 1), 0);
          const weights = reactionWeights.map((item) => ({
            emoji: item.emoji,
            weight: item.weight > 0 ? item.weight : 1,
          }));
          let remaining = boostValue;
          const assigned: Record<string, number> = {};
          weights.forEach((item, index) => {
            const amount = Math.floor((boostValue * item.weight) / totalWeight);
            assigned[item.emoji] = amount;
            remaining -= amount;
          });
          weights.sort((a, b) => b.weight - a.weight);
          for (const item of weights) {
            if (remaining <= 0) break;
            assigned[item.emoji] = (assigned[item.emoji] || 0) + 1;
            remaining -= 1;
          }
          Object.entries(assigned).forEach(([emoji, amount]) => {
            boostedReactionCounts[emoji] = (boostedReactionCounts[emoji] || 0) + amount;
          });
        }

        if (boost.boost_kind === 'views') {
          boostedViews += boostValue;
        }
      });

      return {
        ...msg,
        boostedReactionCounts: Object.keys(boostedReactionCounts).length ? boostedReactionCounts : undefined,
        boostedViews: boostedViews || undefined,
      } as Message;
    });
  };

  const fetchPostBoosts = async (chatId: string) => {
    const { data, error } = await supabase.from('post_boosts').select('*').eq('chat_id', chatId);
    if (error) {
      console.warn('[useMessages] fetchPostBoosts failed', error);
      return [];
    }
    return data || [];
  };

  const load = useCallback(async () => {
    if (!chatId) { setMessages([]); setHasMore(true); return; }

    const cached = getCachedMessages(chatId);
    if (cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (!isOnline) {
      setLoading(false);
      return;
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
      const boosts = await fetchPostBoosts(chatId);
      const boostedMessages = applyPostBoosts(hydrated, boosts);

      const pending = getPendingMessages(chatId).map(pendingToMessage);
      const merged = [...boostedMessages, ...pending].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(merged);
      saveCachedMessages(chatId, merged);
      setLoading(false);
    } catch (error) {
      console.warn('[useMessages] load failed, using cached messages if available:', error);
      if (!cached.length) {
        setMessages([]);
        setHasMore(true);
        setLoading(false);
      }
    }
  }, [chatId, hydrate, isOnline]);

  const loadOlder = useCallback(async () => {
    if (!chatId || loadingOlder || !hasMore || messages.length === 0) return;
    if (!isOnline) {
      setLoadingOlder(false);
      return;
    }
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
    const boosts = await fetchPostBoosts(chatId);
    const boostedOlder = applyPostBoosts(older, boosts);
    setMessages(prev => [...boostedOlder, ...prev]);
    setLoadingOlder(false);
  }, [chatId, loadingOlder, hasMore, messages, hydrate, isOnline]);

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

    const pendingItem: PendingMessageData = {
      tempId,
      chat_id: chatId,
      sender_id: senderId,
      content: content.trim(),
      type: 'text',
      created_at: tempMessage.created_at,
    };

    const queuePending = async () => {
      const currentPending = getPendingMessages(chatId);
      savePendingMessages(chatId, [...currentPending, pendingItem]);
      toast.error('No internet connection. Message will send when you reconnect.');
    };

    if (!isOnline) {
      await queuePending();
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim(), type: 'text', status: 'sent' })
      .select('*')
      .single();

    if (error) {
      console.error('[useMessages] sendMessage failed', error);
      await queuePending();
      return;
    }

    setMessages(prev => {
      const next = prev.map(msg => msg.id === tempId ? { ...(data as Message), reactions: [], sender: prev.find(m => m.id === tempId)?.sender } : msg);
      saveCachedMessages(chatId, next);
      return next;
    });
  }, [chatId, isOnline]);

  const flushPendingMessages = useCallback(async () => {
    if (!chatId || !isOnline) return;

    const pending = getPendingMessages(chatId);
    if (pending.length === 0) return;

    let remaining = [...pending];
    for (const item of pending) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({ chat_id: item.chat_id, sender_id: item.sender_id, content: item.content, type: item.type, status: 'sent' })
          .select('*')
          .single();

        if (error || !data) {
          console.warn('[useMessages] flushPendingMessages error', error);
          continue;
        }

        setMessages(prev => {
          const next = prev.map(msg => msg.id === item.tempId ? { ...(data as Message), reactions: [], sender: prev.find(m => m.id === item.tempId)?.sender } : msg);
          saveCachedMessages(chatId, next);
          return next;
        });
        remaining = remaining.filter(p => p.tempId !== item.tempId);
      } catch (err) {
        console.warn('[useMessages] flushPendingMessages exception', err);
      }
    }

    if (remaining.length !== pending.length) {
      savePendingMessages(chatId, remaining);
    }
  }, [chatId, isOnline]);

  useEffect(() => {
    if (!chatId) return;
    flushPendingMessages();
  }, [chatId, isOnline, flushPendingMessages]);

  useEffect(() => {
    if (!chatId) return;
    const interval = window.setInterval(() => {
      load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [chatId, load]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, reload: load, sendMessage };
}
