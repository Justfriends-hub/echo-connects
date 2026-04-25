import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks read receipts for a chat using chat_members.last_read_at.
 * - Marks the current user's last_read_at as now() when chat opens or new messages arrive.
 * - Subscribes to other members' last_read_at updates so the sender's UI reflects "seen".
 * Returns the latest "seen" timestamp among other members (string ISO) or null.
 */
export function useReadReceipts(chatId: string | null, currentUserId: string | undefined, latestMessageAt: string | undefined) {
  const [othersLastReadAt, setOthersLastReadAt] = useState<string | null>(null);
  const lastMarkedRef = useRef<string>('');

  // Load initial last_read_at from other members
  const loadOthers = useCallback(async () => {
    if (!chatId || !currentUserId) return;
    const { data } = await supabase
      .from('chat_members')
      .select('user_id, last_read_at')
      .eq('chat_id', chatId);
    const others = (data || []).filter((m: any) => m.user_id !== currentUserId);
    const max = others.reduce<string | null>((acc, m: any) => {
      if (!m.last_read_at) return acc;
      if (!acc || new Date(m.last_read_at) > new Date(acc)) return m.last_read_at;
      return acc;
    }, null);
    setOthersLastReadAt(max);
  }, [chatId, currentUserId]);

  useEffect(() => { loadOthers(); }, [loadOthers]);

  // Mark current user as having read up to the latest message
  useEffect(() => {
    if (!chatId || !currentUserId || !latestMessageAt) return;
    if (lastMarkedRef.current === latestMessageAt) return;
    lastMarkedRef.current = latestMessageAt;
    supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', currentUserId)
      .then(() => {});
  }, [chatId, currentUserId, latestMessageAt]);

  // Subscribe to chat_members updates for this chat
  useEffect(() => {
    if (!chatId || !currentUserId) return;
    const channel = supabase
      .channel(`receipts-${chatId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_members', filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        const row: any = payload.new;
        if (!row || row.user_id === currentUserId) return;
        setOthersLastReadAt(prev => {
          if (!row.last_read_at) return prev;
          if (!prev || new Date(row.last_read_at) > new Date(prev)) return row.last_read_at;
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, currentUserId]);

  return { othersLastReadAt };
}
