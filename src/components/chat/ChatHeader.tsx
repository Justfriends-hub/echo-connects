import React from "react";
import { ArrowLeft, Users, Info, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2 bg-card shadow-sm shadow-black/5 border-b border-border/70 transition-all duration-200 h-14">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-foreground hover:bg-muted/60 active:scale-95 transition-transform rounded-full w-9 h-9"
        onClick={onBack}
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="relative flex-shrink-0">
        <div
          className={`p-[2px] rounded-full transition-all duration-300 ${
            showOnlineRing
              ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card animate-pulse"
              : "ring-1 ring-border"
          }`}
        >
          <Avatar className="w-9 h-9">
            <AvatarImage src={chat.avatar_url} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
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
        <p className="text-xs text-muted-foreground/90 font-medium tracking-wide mt-0.5 transition-all duration-300">
          {typingUsers.length > 0 ? (
            <span className="text-emerald-500 font-medium transition-all duration-200">
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

      <div className="flex items-center gap-0.5">
        {isGroup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
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
                className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
                onClick={onOpenInfo}
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
              className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
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
