import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Message, Reaction, UserProfile } from '@/types/chat';

/**
 * Loads messages for a chat with sender profile + reactions, subscribes to realtime.
 */
export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!chatId) { setMessages([]); return; }
    setLoading(true);
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200);

    const list = (msgs || []) as Message[];
    if (list.length === 0) { setMessages([]); setLoading(false); return; }

    // Fetch sender profiles + reactions in batch
    const senderIds = Array.from(new Set(list.map(m => m.sender_id)));
    const msgIds = list.map(m => m.id);

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

    setMessages(list.map(m => ({
      ...m,
      sender: profMap.get(m.sender_id),
      reactions: reactionMap.get(m.id) || [],
    })));
    setLoading(false);
  }, [chatId]);

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

  return { messages, loading, reload: load };
}
