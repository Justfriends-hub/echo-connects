import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Megaphone, Users, MoreVertical, MessageSquare, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChannelComments } from './ChannelComments';
import { EmojiReactionBar } from './EmojiReactionBar';
import type { Chat, Message } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ChannelViewProps {
  chat: Chat;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onBack: () => void;
}

export function ChannelView({ chat, messages, currentUserId, onSendMessage, onBack }: ChannelViewProps) {
  const { user } = useAuth();
  const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [subscriberCount, setSubscriberCount] = useState(chat.member_count || 0);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [allowedReactions, setAllowedReactions] = useState<string[]>(['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉']);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = memberRole === 'owner' || memberRole === 'admin';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user || !chat.id) return;

    // Fetch member role
    const fetchRole = async () => {
      const { data } = await supabase
        .from('chat_members')
        .select('role')
        .eq('chat_id', chat.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setMemberRole(data.role as 'owner' | 'admin' | 'member');
    };

    // Fetch channel settings
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('channel_settings')
        .select('*')
        .eq('chat_id', chat.id)
        .maybeSingle();
      if (data) {
        setAllowedReactions(data.allowed_reactions || ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉']);
        setCommentsEnabled(data.comments_enabled);
      }
    };

    // Fetch visible subscriber count (includes boost)
    const fetchCount = async () => {
      const { count: realCount } = await supabase
        .from('chat_members')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id);

      const { data: boostCount } = await supabase
        .rpc('get_visible_boost', { _chat_id: chat.id });

      setSubscriberCount((realCount || 0) + ((boostCount as number) || 0));
    };

    fetchRole();
    fetchSettings();
    fetchCount();
  }, [user, chat.id]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    
    // Check if already reacted with this emoji
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  }, [user]);

  return (
    <div className="flex flex-col h-full chat-bg">
      {/* Channel Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border">
        <Button variant="ghost" size="icon" className="md:hidden text-foreground" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={chat.avatar_url} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm">
            <Megaphone className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-foreground truncate">{chat.name}</h2>
          <p className="text-xs text-muted-foreground">
            {subscriberCount.toLocaleString()} subscribers
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Users className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="max-w-3xl mx-auto space-y-1">
          {messages.map((msg, i) => (
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === currentUserId}
                senderName={msg.sender?.display_name || 'Channel'}
              />
              {/* Reaction Bar */}
              <div className="flex items-center gap-2 ml-3 mt-0.5 mb-2">
                <EmojiReactionBar
                  messageId={msg.id}
                  allowedEmojis={allowedReactions}
                  reactions={msg.reactions || []}
                  currentUserId={currentUserId}
                  onReact={handleReaction}
                />
                {commentsEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedMessage(msg.id);
                      setShowComments(true);
                    }}
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Comment
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Admin-only posting */}
      {isAdmin ? (
        <ChatInput onSend={onSendMessage} placeholder="Broadcast to channel..." />
      ) : (
        <div className="flex items-center justify-center gap-2 p-3 bg-card border-t border-border text-muted-foreground text-sm">
          <Lock className="w-4 h-4" />
          <span>Only admins can post in this channel</span>
        </div>
      )}

      {/* Comments Side Panel */}
      {showComments && selectedMessage && (
        <ChannelComments
          messageId={selectedMessage}
          chatId={chat.id}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}
