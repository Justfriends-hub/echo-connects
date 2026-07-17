import React from 'react';
import type { Reaction } from '@/types/chat';
import { cn } from '@/lib/utils';

interface EmojiReactionBarProps {
  messageId: string;
  allowedEmojis: string[];
  reactions: Reaction[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
}

export function EmojiReactionBar({ messageId, allowedEmojis, reactions, currentUserId, onReact }: EmojiReactionBarProps) {
  // Group reactions by emoji
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.user_id === currentUserId) acc[r.emoji].hasOwn = true;
    return acc;
  }, {} as Record<string, { count: number; hasOwn: boolean }>);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Existing reactions */}
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => onReact(messageId, emoji)}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all",
            data.hasOwn
              ? "bg-primary/20 border border-primary/40"
              : "bg-muted/50 border border-transparent hover:bg-muted"
          )}
        >
          <span>{emoji}</span>
          {data.count > 0 && <span className="text-[10px] text-foreground/70">{data.count}</span>}
        </button>
      ))}

      {/* Add reaction picker - show allowed emojis not yet used */}
      {allowedEmojis
        .filter(e => !grouped[e])
        .slice(0, 4)
        .map(emoji => (
          <button
            key={emoji}
            onClick={() => onReact(messageId, emoji)}
            className="px-1 py-0.5 rounded-full text-xs opacity-30 hover:opacity-100 transition-opacity"
          >
            {emoji}
          </button>
        ))}
    </div>
  );
}
