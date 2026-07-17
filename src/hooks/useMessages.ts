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
  reply_to_id?: string;
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
    reply_to_id: pending.reply_to_id,
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

    const replyIds = Array.from(new Set(rows.map(m => m.reply_to_id).filter(Boolean) as string[]));
    const senderIds = Array.from(new Set(rows.map(m => m.sender_id)));
    const forwardedFromIds = Array.from(new Set(rows.map(m => m.forwarded_from).filter(Boolean) as string[]));
    const referencedRows: Message[] = replyIds.length > 0
      ? (await supabase.from('messages').select('*').in('id', replyIds)).data || []
      : [];

    const allMessages = [...rows, ...referencedRows];
    const allSenderIds = Array.from(new Set([...senderIds, ...forwardedFromIds, ...referencedRows.map(m => m.sender_id)]));
    const profileIds = allSenderIds;
    const msgIds = rows.map(m => m.id);

    const [{ data: profiles }, { data: reactions }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', profileIds),
      supabase.from('reactions').select('*').in('message_id', msgIds),
    ]);

    const profMap = new Map((profiles || []).map((p: any) => [p.id, p as UserProfile]));
    const reactionMap = new Map<string, Reaction[]>();
    (reactions || []).forEach((r: any) => {
      const arr = reactionMap.get(r.message_id) || [];
      arr.push(r as Reaction);
      reactionMap.set(r.message_id, arr);
    });

    const messageMap = new Map<string, Message>(allMessages.map(m => [m.id, m]));

    return rows.map(m => ({
      ...m,
      sender: profMap.get(m.sender_id),
      forwarded_from_profile: m.forwarded_from ? profMap.get(m.forwarded_from as string) || null : null,
      reactions: reactionMap.get(m.id) || [],
      repliedTo: m.reply_to_id ? messageMap.get(m.reply_to_id as string) : undefined,
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

      const pending = getPendingMessages(chatId).map(pendingToMessage);
      const merged = [...hydrated, ...pending].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
    setMessages(prev => [...older, ...prev]);
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

  const sendMessage = useCallback(async (content: string, senderId: string, replyToId?: string) => {
    if (!chatId || !senderId || !content.trim()) return;

    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: senderId,
      content: content.trim(),
      type: 'text',
      reply_to_id: replyToId,
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
      reply_to_id: replyToId,
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
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim(), type: 'text', status: 'sent', reply_to_id: replyToId })
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
          .insert({ chat_id: item.chat_id, sender_id: item.sender_id, content: item.content, type: item.type, status: 'sent', reply_to_id: item.reply_to_id })
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

  // Delete a message with optimistic UI
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId) return false;
    let previous: Message[] = [];
    setMessages(prev => {
      previous = prev;
      const next = prev.filter(m => m.id !== messageId);
      try { saveCachedMessages(chatId, next); } catch {}
      return next;
    });

    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      // revert
      setMessages(previous);
      try { saveCachedMessages(chatId, previous); } catch {}
      toast.error('Failed to delete message');
      return false;
    }
    toast.success('Message deleted');
    return true;
  }, [chatId]);

  const forwardMessage = useCallback(async (targetChatId: string, message: Message, comment?: string, senderId?: string) => {
    if (!targetChatId || !message || !senderId) return null;
    const content = comment ? `${comment}\n\n${message.content}` : message.content;
    const payload: any = {
      chat_id: targetChatId,
      sender_id: senderId,
      content,
      type: message.type,
      status: 'sent',
      forwarded_from: message.sender_id,
      forwarded_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('messages').insert(payload).select('*').single();
      if (error || !data) {
        toast.error('Failed to forward message');
        return null;
      }
      toast.success('Message forwarded');
      return data as Message;
    } catch (err) {
      console.warn('[useMessages] forwardMessage exception', err);
      toast.error('Failed to forward message');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const interval = window.setInterval(() => {
      load();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [chatId, load]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, reload: load, sendMessage, deleteMessage, forwardMessage };
}
