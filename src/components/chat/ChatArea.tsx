import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, MoreVertical, Users, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
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
  othersLastReadAt?: string | null;
  onOpenInfo?: () => void;
}

function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} gap-2`}>
          {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
          <div className={`space-y-1 ${i % 2 === 0 ? '' : 'items-end'}`}>
            <Skeleton className={`h-4 ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-36'} rounded-xl`} />
            <Skeleton className="h-3 w-16 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SenderHoverCard({ name, userId, children }: { name: string; userId: string; children: React.ReactNode }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-64 bg-card border-border" side="right" align="start">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">Tap to view profile</p>
          </div>
        </div>
        <Separator className="my-2" />
        <p className="text-xs text-muted-foreground">Member of this chat</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ChatArea({
  chat,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
  typingUsers = [],
  onTyping,
  onLoadOlder,
  hasMore,
  loadingOlder,
  othersLastReadAt,
  onOpenInfo,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  /**
   * Height of the fixed input bar reported by ChatInput.
   * The input bar floats above the keyboard, so the scroll area only needs
   * a constant bottom padding equal to the bar height.
   */
  const [inputHeight, setInputHeight] = useState(68);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const first = messages[0]?.id || null;
    if (prevFirstIdRef.current && first !== prevFirstIdRef.current) {
      // Older messages prepended — keep position, don't scroll
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevFirstIdRef.current = first;
  }, [messages]);

  // Keep messages anchored above keyboard: when visual viewport changes (keyboard open/close)
  useEffect(() => {
    const onVV = () => {
      const container = scrollRef.current;
        const bottomAnchor = bottomRef.current;
        if (!container || !bottomAnchor) return;

        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (!nearBottom) return;

        const vv = window.visualViewport;
        const viewportBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        const inputTop = viewportBottom - inputHeight;
        const bottomRect = bottomAnchor.getBoundingClientRect();

        if (bottomRect.bottom > inputTop) {
          bottomAnchor.scrollIntoView({ behavior: 'smooth' });
        }
      };

      const vv = window.visualViewport;
      if (vv) {
        let ticking = false;
        const update = () => {
          if (ticking) return;
          ticking = true;
          window.requestAnimationFrame(() => {
            onVV();
            ticking = false;
          });
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
          vv.removeEventListener('resize', update);
          vv.removeEventListener('scroll', update);
        };
      }

      let ticking = false;
      const updateFallback = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          onVV();
          ticking = false;
        });
      };

      window.addEventListener('chat-visual-viewport', updateFallback as EventListener);
      window.addEventListener('resize', updateFallback);
      return () => {
        window.removeEventListener('chat-visual-viewport', updateFallback as EventListener);
        window.removeEventListener('resize', updateFallback);
      };
    }, [inputHeight]);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isGroup = chat.type === 'group' || chat.type === 'channel';

  return (
    /*
     * The container fills the screen. The input bar is position:fixed so it
     * floats independently above the keyboard. The messages scroll area fills
     * the remaining space (below header, above the fixed bar gap).
     */
    <div className="flex flex-col h-full min-h-0 chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border flex-shrink-0 pwa-no-select">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Users className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Members</TooltipContent>
            </Tooltip>
          )}
          {onOpenInfo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={onOpenInfo}>
                  <Info className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat Info</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>More</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/*
        Messages scroll area.
        - flex-1 so it fills from header to bottom
        - paddingBottom keeps last message visible above the fixed input bar
          (we also use a ref div at the bottom for scrollIntoView)
      */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto chat-messages-scroll px-3 py-2"
        style={{ paddingBottom: inputHeight + 8 }}
      >
        <div className="max-w-3xl mx-auto space-y-0.5">
          {hasMore && (
            <div className="flex justify-center py-2">
              <span className="text-xs text-muted-foreground">
                {loadingOlder ? 'Loading…' : 'Scroll up for older messages'}
              </span>
            </div>
          )}
          {messages.length === 0 ? (
            <MessageSkeleton />
          ) : (
            messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showName = isGroup && msg.sender_id !== currentUserId &&
                (!prevMsg || prevMsg.sender_id !== msg.sender_id);
              const isOwn = msg.sender_id === currentUserId;
              const seen = isOwn && othersLastReadAt
                ? new Date(msg.created_at) <= new Date(othersLastReadAt)
                : false;

              const bubble = (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={isOwn}
                  senderName={showName ? msg.sender?.display_name : undefined}
                  seen={seen}
                />
              );

              if (showName && msg.sender?.display_name) {
                return (
                  <SenderHoverCard key={msg.id} name={msg.sender.display_name} userId={msg.sender_id}>
                    <div>{bubble}</div>
                  </SenderHoverCard>
                );
              }

              return bubble;
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

      {/*
        ChatInput is position:fixed (via .chat-input-fixed class).
        It sits above the keyboard by updating --vv-bottom on <html> via visualViewport.
        We pass onHeightChange so the scroll area paddingBottom matches the bar height.
      */}
      <ChatInput
        onSend={onSendMessage}
        onTyping={onTyping}
        onHeightChange={setInputHeight}
      />
    </div>
  );
}
