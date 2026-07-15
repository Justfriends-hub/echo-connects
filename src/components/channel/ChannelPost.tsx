import React, { useMemo } from 'react';
import { Eye, Share2, MessageSquare, Megaphone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmojiReactionBar } from './EmojiReactionBar';
import { ImageCarousel } from '@/components/chat/ImageCarousel';
import type { Message, Reaction } from '@/types/chat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChannelPostProps {
  message: Message;
  channelName: string;
  channelAvatar?: string;
  allowedReactions: string[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  commentsEnabled: boolean;
  onOpenComments?: (messageId: string) => void;
  subscriberCount: number;
}

export function ChannelPost({
  message,
  channelName,
  channelAvatar,
  allowedReactions,
  currentUserId,
  onReact,
  commentsEnabled,
  onOpenComments,
  subscriberCount,
}: ChannelPostProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleShare = () => {
    const text = message.content.slice(0, 100);
    if (navigator.share) {
      navigator.share({ text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(message.content).then(() => toast.success('Copied!'));
    }
  };

  // Stable approximate view count seeded by message ID to avoid re-randomising on re-render
  const formattedViews = useMemo(() => {
    // Simple hash from message id to get a stable multiplier between 0.65–0.95
    let hash = 0;
    for (let i = 0; i < message.id.length; i++) {
      hash = ((hash << 5) - hash + message.id.charCodeAt(i)) | 0;
    }
    const factor = 0.65 + (Math.abs(hash) % 30) / 100; // 0.65 to 0.95
    const baseViewCount = Math.max(1, Math.floor(subscriberCount * factor));
    const boostedViews = message.boostedViews || 0;
    const totalViews = baseViewCount + boostedViews;
    return totalViews >= 1000
      ? `${(totalViews / 1000).toFixed(1)}K`
      : totalViews.toString();
  }, [message.id, subscriberCount, message.boostedViews]);

  const hasReactions =
    (message.reactions?.length ?? 0) > 0 ||
    Object.keys(message.boostedReactionCounts || {}).length > 0;

  return (
    <article className="channel-post animate-fade-in">
      {/* ── Post Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-3">
        <Avatar className="w-9 h-9 ring-1 ring-primary/20">
          <AvatarImage src={channelAvatar} />
          <AvatarFallback className="bg-primary/15 text-primary text-xs">
            <Megaphone className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{channelName}</p>
        </div>
      </div>

      {/* ── Post Content ────────────────────────────────────────────────── */}
      <div className="mb-3">
        {message.type === 'image' ? (
          <ImageCarousel images={message.content.split(',').map(s => s.trim())} />
        ) : (
          <p className="text-[14.5px] text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}
      </div>

      {/* ── Reactions ───────────────────────────────────────────────────── */}
      {(hasReactions || allowedReactions.length > 0) && (
        <div className="mb-2">
          <EmojiReactionBar
            messageId={message.id}
            allowedEmojis={allowedReactions}
            reactions={message.reactions || []}
            currentUserId={currentUserId}
            onReact={onReact}
            extraReactionCounts={message.boostedReactionCounts}
          />
        </div>
      )}

      {/* ── Post Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[11px]">{formattedViews}</span>
          </div>
          <span className="text-[11px]">{time}</span>
        </div>

        <div className="flex items-center gap-0.5">
          {commentsEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => onOpenComments?.(message.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comment
                </Button>
              </TooltipTrigger>
              <TooltipContent>View comments</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                onClick={handleShare}
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share post</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}
