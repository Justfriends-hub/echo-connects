import React from "react";
import {
  Check,
  CheckCheck,
  Clock,
  Copy,
  Reply,
  Forward,
  Trash2,
  SmilePlus,
  MoreHorizontal,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import EmojiPicker from "@/components/ui/EmojiPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import type { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  senderName?: string;
  seen?: boolean;
  onDeleteMessage?: (id: string) => void;
  onOpenForward?: (message: Message) => void;
  onReply?: (message: Message) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  senderName,
  seen,
  onDeleteMessage,
  onOpenForward,
  onReply,
}: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Copied to clipboard");
  };

  const { user } = useAuth();
  const handleReply = () => {
    if (onReply) return onReply(message);
    toast.info("Reply feature coming soon");
  };

  const handleForward = () => {
    if (onOpenForward) return onOpenForward(message);
    toast.info("Forward feature coming soon");
  };

  const handleDelete = () => {
    if (onDeleteMessage) return onDeleteMessage(message.id);
    toast.info("Delete feature coming soon");
  };

  // Toggle reaction for current user
  const handleReactToggle = async (emoji: string) => {
    try {
      if (!user) return toast.error('Not signed in');
      // check existing reaction by this user
      const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('message_id', message.id)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if ((existing as any)?.id) {
        await supabase.from('reactions').delete().eq('id', (existing as any).id);
      } else {
        await supabase.from('reactions').insert({ message_id: message.id, user_id: user.id, emoji });
      }
    } catch (err) {
      console.warn('[MessageBubble] react toggle failed', err);
      toast.error('Failed to update reaction');
    }
  };

  const statusIcon = () => {
    if (!isOwn) return null;
    if (seen)
      return (
        <CheckCheck className="w-3.5 h-3.5 text-emerald-500 transition-colors duration-200" />
      );
    switch (message.status) {
      case "sending":
        return (
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60 animate-pulse" />
        );
      case "sent":
        return <Check className="w-3.5 h-3.5 text-muted-foreground/60" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/70" />;
      case "seen":
        return <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Check className="w-3.5 h-3.5 text-muted-foreground/60" />;
    }
  };

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-3 animate-in fade-in zoom-in-95 duration-300 select-none">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground bg-muted/40 border border-border/20 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
          {message.content}
        </span>
      </div>
    );
  }

  const messageContent = (
    <div
      className={cn(
        "max-w-[82%] sm:max-w-[70%] px-3 py-1.5 rounded-2xl relative group select-none md:select-text shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-200",
        isOwn
          ? "bg-primary text-primary-foreground rounded-tr-none border border-primary/20"
          : "bg-card text-card-foreground rounded-tl-none border border-border/30",
        message.reactions && message.reactions.length > 0 ? "mb-2.5" : "mb-0",
      )}
    >
      {/* Sleek Minimal Hover Floating Option Trigger Menu */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none group-hover:pointer-events-auto hidden sm:block",
          isOwn ? "-left-10" : "-right-10",
        )}
      >
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 bg-background/95 backdrop-blur-sm rounded-full shadow-md border border-border/30 transform active:scale-90 transition-transform"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover/95 backdrop-blur-md border-border/60 p-1 rounded-xl shadow-xl min-w-[120px] animate-in fade-in-50 slide-in-from-top-2 duration-150"
            align={isOwn ? "end" : "start"}
          >
            <DropdownMenuItem
              onClick={handleReply}
              className="gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5 text-muted-foreground" /> Reply
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCopy}
              className="gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copy
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleForward}
              className="gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
            >
              <Forward className="w-3.5 h-3.5 text-muted-foreground" /> Forward
            </DropdownMenuItem>
            {isOwn && (
              <>
                <DropdownMenuSeparator className="opacity-40" />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sender Title Stack (Group context) */}
      {!isOwn && senderName && (
        <p className="text-[11px] font-bold text-primary tracking-tight mb-0.5 leading-none">
          {senderName}
        </p>
      )}

      {message.repliedTo && (
        <div className="mb-2 rounded-xl border-l-2 border-primary/60 bg-muted/70 p-2">
          <p className="text-[11px] font-semibold text-primary mb-1">
            Replying to {message.repliedTo.sender?.display_name || 'Unknown'}
          </p>
          <p className="text-[12px] text-muted-foreground line-clamp-2">
            {message.repliedTo.content}
          </p>
        </div>
      )}

      {/* Forwarded metadata */}
      {message.forwarded_from_profile && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-muted-foreground/80">Forwarded from</span>
          <span className="text-[11px] font-semibold text-foreground">{message.forwarded_from_profile.display_name || message.forwarded_from_profile.username}</span>
        </div>
      )}

      {/* Main Structural Stream View Blocks */}
      {message.type === "image" ? (
        <div className="my-0.5 rounded-xl overflow-hidden">
          <ImageCarousel
            images={message.content.split(",").map((s) => s.trim())}
          />
        </div>
      ) : (
        /* Layout fix: Render text and meta items inside a fluid structural inline container */
        <div className="relative inline-block w-full text-sm leading-relaxed whitespace-pre-wrap break-words tracking-normal">
          <span className="text-[14px]">{message.content}</span>

          {/* Invisible padding block enforces standard layout sizing, preventing layout overlap splits */}
          <span className="inline-block w-[52px] h-3" />
        </div>
      )}

      {/* Integrated Meta Wrap Base Block */}
      <div
        className={cn(
          "absolute bottom-1 right-1.5 flex items-center gap-1 select-none pointer-events-none z-10",
          message.type === "image" &&
            "bg-black/30 backdrop-blur-[2px] px-1.5 py-0.5 rounded-full",
        )}
      >
        <span
          className={cn(
            "text-[9px] font-semibold tracking-wide",
            isOwn
              ? message.type === "image"
                ? "text-white"
                : "text-primary-foreground/75"
              : message.type === "image"
                ? "text-white"
                : "text-muted-foreground/80",
          )}
        >
          {time}
        </span>
        {statusIcon()}
      </div>

      {/* Absolute Layer Reaction Badges Container */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          className={cn(
            "absolute -bottom-3 flex gap-0.5 items-center z-20 pointer-events-none animate-in zoom-in-95 duration-200",
            isOwn ? "right-2" : "left-2",
          )}
        >
          {Object.entries(
            message.reactions.reduce(
              (acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          ).map(([emoji, count]) => (
            <span
              key={emoji}
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm pointer-events-auto transform active:scale-90 transition-transform",
                isOwn
                  ? "bg-card text-foreground border-border/60"
                  : "bg-muted text-muted-foreground border-border/40",
              )}
            >
              <span>{emoji}</span>
              {count > 1 && (
                <span className="text-[9px] opacity-90">{count}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex w-full mb-1 px-4 transform translate-z-0 transition-transform will-change-transform animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out",
            isOwn ? "justify-end pl-12" : "justify-start pr-12",
          )}
        >
          {messageContent}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-popover/95 backdrop-blur-md border-border/60 w-44 p-1 rounded-xl shadow-2xl animate-in zoom-in-95 duration-150">
        <ContextMenuItem
          onClick={handleReply}
          className="gap-2.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer"
        >
          <Reply className="w-4 h-4 text-muted-foreground" /> Reply
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCopy}
          className="gap-2.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer"
        >
          <Copy className="w-4 h-4 text-muted-foreground" /> Copy Text
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleForward}
          className="gap-2.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer"
        >
          <Forward className="w-4 h-4 text-muted-foreground" /> Forward
        </ContextMenuItem>
        <div className="px-2 py-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2 py-1 text-xs w-full justify-start">
                <SmilePlus className="w-4 h-4 text-muted-foreground" /> React
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <EmojiPicker onSelect={(emoji) => handleReactToggle(emoji)} />
            </PopoverContent>
          </Popover>
        </div>
        {isOwn && (
          <>
            <ContextMenuSeparator className="opacity-40" />
            <ContextMenuItem
              onClick={handleDelete}
              className="gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete Message
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
