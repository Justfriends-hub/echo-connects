import React, { useRef, useEffect } from 'react';
import { ArrowLeft, Phone, MoreVertical, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import type { Chat, Message } from '@/types/chat';

interface ChatAreaProps {
  chat: Chat;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  typingUsers?: string[];
  onTyping?: () => void;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  loadingOlder?: boolean;
}

export function ChatArea({ chat, messages, currentUserId, onSendMessage, onBack, typingUsers = [], onTyping, onLoadOlder, hasMore, loadingOlder }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevFirstIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If we prepended older messages, keep scroll position; otherwise scroll to bottom on new ones.
    const first = messages[0]?.id || null;
    if (prevFirstIdRef.current && first !== prevFirstIdRef.current) {
      // older messages were prepended — don't auto-scroll
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevFirstIdRef.current = first;
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onLoadOlder || !hasMore || loadingOlder) return;
    if (e.currentTarget.scrollTop < 80) onLoadOlder();
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isGroup = chat.type === 'group' || chat.type === 'channel';

  return (
    <div className="flex flex-col h-full chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border">
        <Button variant="ghost" size="icon" className="md:hidden text-foreground" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={chat.avatar_url} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm">
            {getInitials(chat.name || 'U')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-foreground truncate">{chat.name}</h2>
          <p className="text-xs text-muted-foreground">
            {typingUsers.length > 0
              ? `${typingUsers.join(', ')} typing...`
              : isGroup
                ? `${chat.member_count || 0} members`
                : chat.is_online ? 'online' : 'last seen recently'
            }
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isGroup && (
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Users className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 px-3 py-2 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-0.5">
          {hasMore && (
            <div className="flex justify-center py-2">
              <span className="text-xs text-muted-foreground">{loadingOlder ? 'Loading…' : 'Scroll up for older messages'}</span>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showName = isGroup && msg.sender_id !== currentUserId &&
                (!prevMsg || prevMsg.sender_id !== msg.sender_id);
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === currentUserId}
                  senderName={showName ? msg.sender?.display_name : undefined}
                />
              );
            })
          )}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground animate-fade-in">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              {typingUsers.join(', ')} typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={onSendMessage} onTyping={onTyping} />
    </div>
  );
}
