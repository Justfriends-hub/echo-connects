import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Realtime typing indicators via Supabase Presence.
 * Each chat has its own presence channel; users broadcast their typing state.
 * Returns { typingUsers, notifyTyping } — call notifyTyping() on each keystroke.
 */
export function useTypingPresence(chatId: string | null, displayName?: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase.channel(`typing:${chatId}`, {
      config: { presence: { key: user.id } },
    });

    const updateTyping = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id: string; name: string; typing: boolean; at: number }>>;
      const now = Date.now();
      const names: string[] = [];
      Object.entries(state).forEach(([key, metas]) => {
        if (key === user.id) return;
        const meta = metas[0];
        if (meta?.typing && now - (meta.at || 0) < 6000) names.push(meta.name || 'Someone');
      });
      setTypingUsers(names);
    };

    channel
      .on('presence', { event: 'sync' }, updateTyping)
      .on('presence', { event: 'join' }, updateTyping)
      .on('presence', { event: 'leave' }, updateTyping)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, name: displayName || 'Someone', typing: false, at: Date.now() });
        }
      });

    channelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setTypingUsers([]);
    };
  }, [chatId, user, displayName]);

  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !user) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      channel.track({ user_id: user.id, name: displayName || 'Someone', typing: true, at: Date.now() });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      channel.track({ user_id: user.id, name: displayName || 'Someone', typing: false, at: Date.now() });
    }, 3000);
  }, [user, displayName]);

  return { typingUsers, notifyTyping };
}