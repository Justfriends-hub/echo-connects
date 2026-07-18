import React from "react";
import { ArrowLeft, Users, Info, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatHeaderProps {
  chat: any;
  typingUsers?: string[];
  isGroup?: boolean;
  showOnlineRing?: boolean;
  onBack?: () => void;
  onOpenInfo?: () => void;
}

export default function ChatHeader({
  chat,
  typingUsers = [],
  isGroup,
  showOnlineRing,
  onBack,
  onOpenInfo,
}: ChatHeaderProps) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    // NOTE: position is `relative` + `flex-shrink-0`, NOT `fixed`.
    // This header is meant to be the first child of ChatArea's content
    // flex column (Layer 1 in that file's architecture comments), sitting
    // in normal document flow above the scrollable message list. Using
    // `fixed` here breaks the moment this component is rendered inside
    // any transformed ancestor (e.g. a slide-in panel's CSS transform in
    // ChatLayout) — a transform creates a new containing block for fixed
    // descendants, so the header ends up anchored to that panel instead
    // of the real viewport. That's what causes it to visibly shift/jump
    // when the on-screen keyboard opens and the viewport resizes. Being
    // in-flow and non-fixed makes the header immune to that entirely: it
    // just sits at the top of a column whose height never changes when
    // the keyboard opens (only the message padding and input bar react).
    <div
      className="chat-header relative z-10 flex-shrink-0 flex items-center gap-3 px-4 bg-card shadow-sm shadow-black/5 border-b border-border/70"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
        paddingBottom: "0.5rem",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 1rem)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))",
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden -ml-1.5 text-foreground hover:bg-muted/60 active:scale-95 transition-transform rounded-full w-11 h-11 shrink-0"
        onClick={onBack}
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="relative flex-shrink-0">
        <div
          className={`p-[2px] rounded-full transition-colors duration-300 ${
            showOnlineRing ? "ring-2 ring-emerald-500/70" : "ring-1 ring-border"
          }`}
        >
          <Avatar className="w-9 h-9">
            <AvatarImage src={chat.avatar_url} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-medium text-sm">
              {getInitials(chat.name || "U")}
            </AvatarFallback>
          </Avatar>
        </div>
        {showOnlineRing && (
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-[15px] text-foreground tracking-tight truncate leading-tight">
          {chat.name}
        </h2>
        <p className="text-xs text-muted-foreground/90 font-medium tracking-wide mt-0.5 truncate transition-colors duration-300">
          {typingUsers.length > 0 ? (
            <span className="text-emerald-500 font-medium transition-colors duration-200">
              {typingUsers.join(", ")} typing...
            </span>
          ) : isGroup ? (
            `${chat.member_count || 0} members`
          ) : chat.is_online ? (
            <span className="text-emerald-500 font-medium">online</span>
          ) : (
            "last seen recently"
          )}
        </p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {isGroup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-11 h-11 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
                aria-label="Members"
              >
                <Users className="w-[19px] h-[19px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-md">
              Members
            </TooltipContent>
          </Tooltip>
        )}
        {onOpenInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-11 h-11 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
                onClick={onOpenInfo}
                aria-label="Chat info"
              >
                <Info className="w-[19px] h-[19px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-md">
              Chat Info
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-11 h-11 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
              aria-label="More options"
            >
              <MoreVertical className="w-[19px] h-[19px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-md">
            More
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
