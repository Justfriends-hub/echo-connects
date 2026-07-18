import React, { useState } from "react";
import {
  Search,
  Menu,
  Edit,
  Users,
  Megaphone,
  Settings,
  Shield,
  ChevronDown,
  Camera,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SidebarTabSwitcher } from "./SidebarTabSwitcher";
import { StatusListView } from "@/components/status/StatusListView";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { SectionErrorIndicator } from "@/components/SectionErrorIndicator";
import { useSwipeableTabs } from "@/hooks/useSwipeableTabs";
import type { Chat } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
  onNewStatus?: () => void;
  hasUnseenStatuses?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  loading?: boolean;
  onOpenProfile?: () => void;
}

function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <Skeleton className="h-3.5 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSidebar({
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onNewGroup,
  onNewChannel,
  onNewStatus = () => {},
  hasUnseenStatuses,
  loading,
  isError,
  onRetry,
  onOpenProfile,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [directsOpen, setDirectsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"chats" | "status">("chats");
  const navigate = useNavigate();
  const { containerRef, trackRef } = useSwipeableTabs({ activeTab, onChange: setActiveTab });

  const filtered = chats.filter((c) =>
    (c.name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const channels = filtered.filter((c) => c.type === "channel");
  const groups = filtered.filter((c) => c.type === "group");
  const directs = filtered.filter((c) => c.type === "direct");

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getChatIcon = (type: Chat["type"]) => {
    if (type === "group")
      return <Users className="w-3.5 h-3.5 text-muted-foreground/80" />;
    if (type === "channel")
      return <Megaphone className="w-3.5 h-3.5 text-muted-foreground/80" />;
    return null;
  };

  const renderChatItem = (chat: Chat) => {
    const showOnlineRing = chat.type === "direct" && chat.is_online;

    return (
      <button
        key={chat.id}
        onClick={() => onSelectChat(chat.id)}
        className={cn(
          "w-[calc(100%-16px)] flex items-center gap-3.5 px-3 py-3 mx-2 my-0.5 text-left rounded-xl transition-all duration-200 ease-out",
          "transform active:scale-[0.98] focus:outline-none select-none",
          activeChat === chat.id
            ? "bg-sidebar-accent shadow-sm"
            : "hover:bg-sidebar-accent/40 active:bg-sidebar-accent/70",
        )}
      >
        {/* Status Ring Well Enclosure */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "p-[2px] rounded-full transition-all duration-300",
              showOnlineRing
                ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-sidebar"
                : "ring-0",
            )}
          >
            <Avatar className="w-11 h-11 shadow-sm">
              <AvatarImage src={chat.avatar_url} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {getInitials(chat.name || "U")}
              </AvatarFallback>
            </Avatar>
          </div>
          {showOnlineRing && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-sidebar animate-pulse" />
          )}
        </div>

        {/* Info Wrapper Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {getChatIcon(chat.type)}
              <span className="font-semibold text-[14px] text-sidebar-foreground truncate tracking-tight">
                {chat.name || "Unknown"}
              </span>
            </div>
            <span
              className={cn(
                "text-[11px] font-medium transition-colors flex-shrink-0",
                (chat.unread_count ?? 0) > 0
                  ? "text-emerald-500"
                  : "text-muted-foreground/70",
              )}
            >
              {chat.last_message
                ? formatTime(chat.last_message.created_at)
                : ""}
            </span>
          </div>

          <div className="flex items-center justify-between mt-0.5 gap-2">
            <p className="text-xs text-muted-foreground/80 truncate pr-1 tracking-normal leading-tight flex-1">
              {chat.last_message?.content || "No messages yet"}
            </p>
            {(chat.unread_count ?? 0) > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white px-1.5 shadow-sm scale-in-70 animate-in duration-200">
                {chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border/60 relative overflow-hidden">
      {/* Header Utilities */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-sidebar-border/40 bg-sidebar/95 backdrop-blur-md z-10 flex-shrink-0">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent/60 active:scale-95 transition-all duration-200 rounded-full w-9 h-9"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-54 bg-popover/95 backdrop-blur-md border-border/60 p-1.5 shadow-xl rounded-2xl animate-in fade-in-50 slide-in-from-top-2 duration-200"
            align="start"
          >
            <DropdownMenuItem
              onClick={onNewGroup}
              className="gap-3 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <Users className="w-4 h-4 text-muted-foreground" /> New Group
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onNewChannel}
              className="gap-3 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <Megaphone className="w-4 h-4 text-muted-foreground" /> New
              Channel
            </DropdownMenuItem>
            <DropdownMenuSeparator className="opacity-50" />
            <DropdownMenuItem
              onClick={() => navigate("/settings")}
              className="gap-3 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <Settings className="w-4 h-4 text-muted-foreground" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/admin")}
              className="gap-3 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <Shield className="w-4 h-4 text-emerald-500" /> Admin Panel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9.5 h-9 bg-sidebar-accent/60 border-0 text-sidebar-foreground placeholder:text-muted-foreground/70 rounded-full text-xs font-medium focus-visible:ring-1 focus-visible:ring-border/60 focus-visible:bg-sidebar-accent transition-all duration-200"
          />
        </div>
      </div>

      <SidebarTabSwitcher
        activeTab={activeTab}
        onChange={setActiveTab}
        hasUnseenStatuses={hasUnseenStatuses ?? false}
      />

      {/* Swipeable container with both tabs mounted side-by-side */}
      <div ref={containerRef} className="flex-1 relative h-full overflow-hidden">
        <div ref={trackRef} className="flex h-full w-[200%]">
          {/* Chats Panel */}
          <div className="w-full flex-shrink-0">
            <ScrollArea className="h-full bg-sidebar/30 relative">
              <SectionErrorBoundary onRetry={onRetry}>
                {loading ? (
                  <ChatListSkeleton />
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-muted-foreground/80 animate-in fade-in duration-300">
                    <p className="text-sm font-medium tracking-tight">
                      No conversations yet
                    </p>
                    <p className="text-xs mt-1 opacity-80">
                      Start a new chat to begin broadcasting messages
                    </p>
                  </div>
                ) : (
                  <div className="py-2 pb-24 space-y-0.5">
                    {isError && onRetry && (
                      <div className="px-3 py-1">
                        <SectionErrorIndicator
                          isError={isError}
                          onRetry={onRetry}
                          label="Unable to load chats"
                        />
                      </div>
                    )}

                    {channels.length > 0 && (
                      <div className="mb-2">
                        <Collapsible
                          open={channelsOpen}
                          onOpenChange={setChannelsOpen}
                        >
                          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest hover:text-foreground transition-colors">
                            <span>Channels</span>
                            <ChevronDown
                              className={cn(
                                "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200",
                                channelsOpen && "rotate-180",
                              )}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                            {channels.map(renderChatItem)}
                          </CollapsibleContent>
                        </Collapsible>
                        <Separator className="mt-2 mb-1 mx-4 opacity-40" />
                      </div>
                    )}

                    {groups.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
                          Groups
                        </div>
                        {groups.map(renderChatItem)}
                        <Separator className="mt-2 mb-1 mx-4 opacity-40" />
                      </div>
                    )}

                    <Collapsible open={directsOpen} onOpenChange={setDirectsOpen}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest hover:text-foreground transition-colors">
                        <span>Direct Messages</span>
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200",
                            directsOpen && "rotate-180",
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                        {directs.map(renderChatItem)}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </SectionErrorBoundary>
            </ScrollArea>
          </div>

          {/* Status Panel */}
          <div className="w-full flex-shrink-0">
            <SectionErrorBoundary>
              <StatusListView onOpenComposer={onNewStatus} />
            </SectionErrorBoundary>
          </div>
        </div>
      </div>

      {/* Modern High-Fidelity Floating Action Action Module Header Trigger Button */}
      <div className="absolute bottom-5 right-5 z-30 pointer-events-none">
        <Button
          onClick={activeTab === "status" ? onNewStatus : onNewChat}
          size="icon"
          className="w-13 h-13 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.25)] pointer-events-auto transform active:scale-90 hover:scale-105 transition-all duration-200 flex items-center justify-center"
        >
          {activeTab === "status" ? (
            <Camera className="w-[21px] h-[21px] animate-in fade-in zoom-in-75 duration-200" />
          ) : (
            <Edit className="w-[21px] h-[21px] animate-in fade-in zoom-in-75 duration-200" />
          )}
        </Button>
      </div>
    </div>
  );
}
