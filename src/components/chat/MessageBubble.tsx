import React from 'react';
import { Check, CheckCheck, Copy, Reply, Forward, Trash2, SmilePlus, MoreHorizontal } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied to clipboard');
  };

  const handleReply = () => {
    toast.info('Reply feature coming soon');
  };

  const handleForward = () => {
    toast.info('Forward feature coming soon');
  };

  const handleDelete = () => {
    toast.info('Delete feature coming soon');
  };

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

  const messageContent = (
    <div
      className={cn(
        "max-w-[75%] px-3 py-2 rounded-2xl relative group",
        isOwn
          ? "chat-bubble-own rounded-br-md"
          : "chat-bubble-other rounded-bl-md"
      )}
    >
      {/* Hover actions menu */}
      <div className={cn(
        "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10",
        isOwn ? "-left-8" : "-right-8"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground bg-card/80 rounded-full shadow-sm">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-card border-border" align={isOwn ? "end" : "start"}>
            <DropdownMenuItem onClick={handleReply} className="gap-2 text-xs">
              <Reply className="w-3.5 h-3.5" /> Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" /> Copy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleForward} className="gap-2 text-xs">
              <Forward className="w-3.5 h-3.5" /> Forward
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isOwn && (
              <DropdownMenuItem onClick={handleDelete} className="gap-2 text-xs text-destructive focus:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn("flex mb-1 animate-slide-up", isOwn ? "justify-end" : "justify-start")}>
          {messageContent}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card border-border w-48">
        <ContextMenuItem onClick={handleReply} className="gap-2 text-xs">
          <Reply className="w-3.5 h-3.5" /> Reply
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy} className="gap-2 text-xs">
          <Copy className="w-3.5 h-3.5" /> Copy Text
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForward} className="gap-2 text-xs">
          <Forward className="w-3.5 h-3.5" /> Forward
        </ContextMenuItem>
        <ContextMenuItem className="gap-2 text-xs">
          <SmilePlus className="w-3.5 h-3.5" /> React
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isOwn && (
          <ContextMenuItem onClick={handleDelete} className="gap-2 text-xs text-destructive focus:text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Delete Message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
