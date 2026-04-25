import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/types/chat';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  senderName?: string;
  seen?: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar, senderName, seen }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusIcon = () => {
    if (!isOwn) return null;
    if (seen) return <CheckCheck className="w-3.5 h-3.5 text-primary" />;
    switch (message.status) {
      case 'sending': return <span className="w-3 h-3 rounded-full border border-muted-foreground animate-pulse-soft" />;
      case 'sent': return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'seen': return <CheckCheck className="w-3.5 h-3.5 text-primary" />;
      default: return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2 animate-fade-in">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex mb-1 animate-slide-up", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] px-3 py-2 rounded-2xl relative group",
          isOwn
            ? "chat-bubble-own rounded-br-md"
            : "chat-bubble-other rounded-bl-md"
        )}
      >
        {!isOwn && senderName && (
          <p className="text-xs font-medium text-primary mb-0.5">{senderName}</p>
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <div className={cn("flex items-center gap-1 mt-0.5", isOwn ? "justify-end" : "justify-end")}>
          <span className="text-[10px] text-muted-foreground/70">{time}</span>
          {statusIcon()}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(
              message.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => (
              <span key={emoji} className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-full">
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
