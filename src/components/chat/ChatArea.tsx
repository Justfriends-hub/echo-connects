import React, { useRef, useEffect, useState, useCallback } from "react";
import { ArrowLeft, MoreVertical, Users, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Chat, Message } from "@/types/chat";

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
    <div className="space-y-4 p-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} gap-3`}
        >
          {i % 2 === 0 && (
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          )}
          <div
            className={`space-y-1.5 ${i % 2 === 0 ? "" : "items-end flex flex-col"}`}
          >
            <Skeleton
              className={`h-9 ${i % 3 === 0 ? "w-48" : i % 3 === 1 ? "w-64" : "w-36"} rounded-2xl`}
            />
            <Skeleton className="h-3 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SenderHoverCard({
  name,
  userId,
  children,
}: {
  name: string;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className="w-64 bg-card/95 backdrop-blur-md border-border/80 shadow-xl rounded-2xl p-3 animate-in fade-in-50 slide-in-from-top-2 duration-200"
        side="right"
        align="start"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-border/40">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground tracking-wide">
              {name}
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Tap to view profile
            </p>
          </div>
        </div>
        <Separator className="my-2.5 opacity-60" />
        <p className="text-[11px] font-medium text-muted-foreground/70">
          Member of this chat
        </p>
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
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [inputHeight, setInputHeight] = useState(68);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;
    setIsNearBottom(atBottom);
  }, []);

  // Auto-scroll to bottom dynamically & seamlessly
  useEffect(() => {
    const first = messages[0]?.id || null;
    if (prevFirstIdRef.current && first !== prevFirstIdRef.current) {
      // Older messages prepended — keep viewport steady
    } else if (isNearBottom) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
    prevFirstIdRef.current = first;
  }, [messages, isNearBottom]);

  // Handle precise VisualViewport changes to keep latest messages visible
  // IMPORTANT: This effect only adjusts the scroll position of the messages container.
  // It must NEVER touch the wallpaper element in any way.
  useEffect(() => {
    const onVV = () => {
      const container = scrollRef.current;
      const bottomAnchor = bottomRef.current;
      if (!container || !bottomAnchor) return;

      const nearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        160;
      if (!nearBottom) return;

      const vv = window.visualViewport;
      const viewportBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const inputTop = viewportBottom - inputHeight;
      const bottomRect = bottomAnchor.getBoundingClientRect();

      if (bottomRect.bottom > inputTop) {
        bottomAnchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
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

    window.addEventListener(
      "chat-visual-viewport",
      updateFallback as EventListener,
    );
    window.addEventListener("resize", updateFallback);
    return () => {
      window.removeEventListener(
        "chat-visual-viewport",
        updateFallback as EventListener,
      );
      window.removeEventListener("resize", updateFallback);
    };
  }, [inputHeight]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const isGroup = chat.type === "group" || chat.type === "channel";
  const showOnlineRing = !isGroup && chat.is_online;

  /*
   * ══════════════════════════════════════════════════════════════════════════
   * THREE-LAYER ARCHITECTURE — wallpaper is completely decoupled
   *
   * Layer 0 (z-0):  WALLPAPER  — position:absolute, inset:0, covers full
   *                               parent. Rendered once, no JS ever touches
   *                               it after mount. No transforms, no resizes,
   *                               no viewport listeners. Pure CSS, immovable.
   *
   * Layer 1 (z-10): HEADER     — position:relative, flex-shrink-0, sits at
   *                               the top. Opaque background so wallpaper
   *                               doesn't bleed through.
   *
   * Layer 2 (z-[1]): MESSAGES  — position:relative, flex-1, overflow-y:auto.
   *                               Transparent background so wallpaper shows
   *                               through. padding-bottom tracks input height
   *                               so messages are always visible above it.
   *
   * Layer 3 (z-60): INPUT BAR  — position:fixed (in ChatInput component),
   *                               tracks keyboard via visualViewport. Sits
   *                               above everything. Only this element and the
   *                               message scroll offset react to keyboard.
   *
   * The wallpaper (Layer 0) is ABSOLUTE within the parent container, NOT
   * fixed. Why? On iOS Safari, position:fixed elements inside a transformed
   * parent (the slide-in panel in ChatLayout) get scoped to that transform
   * container rather than the viewport. Using absolute inside the already-
   * viewport-filling parent achieves the same visual result without the iOS
   * transform-scoping bug. The parent container in ChatLayout is already
   * `absolute inset-0 w-full h-full`, so absolute here = full screen.
   *
   * CRITICAL: No JS effect, callback, or event listener in this component
   * may reference, modify, or reposition the wallpaper element. It is
   * render-once, CSS-only, immutable after mount.
   * ══════════════════════════════════════════════════════════════════════════
   */

  return (
    // Outer container: position:relative to anchor the absolute wallpaper.
    // h-full fills the parent (which is already viewport-sized).
    // overflow:hidden prevents any bleed. No flex here — we use the
    // wallpaper as an absolute layer and everything else flows normally
    // within a separate flex column.
    <div
      className="relative h-full w-full overflow-hidden select-none md:select-text"
      style={{ isolation: 'isolate' }}
    >
      {/* Wallpaper moved to ChatLayout so it can be rendered as a
          viewport-fixed layer outside any transform-scoped ancestors. */}

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT LAYERS (1-3): Header + Messages + Input
          This flex column sits above the wallpaper. It fills the parent
          and handles all layout/scroll. The wallpaper is NOT part of this
          flex flow — it's a sibling absolute-positioned behind it.
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="relative flex flex-col h-full w-full"
        style={{ zIndex: 1 }}
      >
        {/* ─── LAYER 1: HEADER BAR ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 bg-card/90 backdrop-blur-md border-b border-border/60 flex-shrink-0 z-10 shadow-sm transition-all duration-200">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-foreground hover:bg-muted/60 active:scale-95 transition-transform rounded-full w-9 h-9"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Status Ring Well Integration */}
          <div className="relative flex-shrink-0">
            <div
              className={`p-[2px] rounded-full transition-all duration-300 ${showOnlineRing ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card animate-pulse" : "ring-1 ring-border"}`}
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

        {/* ─── LAYER 2: MESSAGES SCROLL AREA ───────────────────────────── */}
        {/* Transparent background so the wallpaper (Layer 0) shows through.
            padding-bottom tracks the input bar height so messages don't get
            hidden behind it. This is the ONLY element that adjusts when the
            keyboard opens (via scroll position, not layout changes). */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 overscroll-contain"
          style={{
            paddingBottom: inputHeight + 20,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            backgroundColor: 'transparent',
          }}
        >
          <div className="max-w-3xl mx-auto space-y-1">
            {hasMore && (
              <div className="flex justify-center py-3">
                <span className="text-[11px] font-medium bg-muted/50 backdrop-blur-sm border border-border/40 text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                  {loadingOlder ? "Loading…" : "Scroll up for older messages"}
                </span>
              </div>
            )}

            {messages.length === 0 ? (
              <MessageSkeleton />
            ) : (
              messages.map((msg, i) => {
                const prevMsg = messages[i - 1];
                const showName =
                  isGroup &&
                  msg.sender_id !== currentUserId &&
                  (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                const isOwn = msg.sender_id === currentUserId;
                const seen =
                  isOwn && othersLastReadAt
                    ? new Date(msg.created_at) <= new Date(othersLastReadAt)
                    : false;

                const bubble = (
                  <div
                    key={msg.id}
                    className="transform translate-z-0 transition-all duration-200 ease-out animate-in fade-in-40 slide-in-from-bottom-1"
                  >
                    <MessageBubble
                      message={msg}
                      isOwn={isOwn}
                      senderName={showName ? msg.sender?.display_name : undefined}
                      seen={seen}
                    />
                  </div>
                );

                if (showName && msg.sender?.display_name) {
                  return (
                    <SenderHoverCard
                      key={msg.id}
                      name={msg.sender.display_name}
                      userId={msg.sender_id}
                    >
                      <div className="focus:outline-none">{bubble}</div>
                    </SenderHoverCard>
                  );
                }

                return bubble;
              })
            )}

            {/* WhatsApp-Style Micro-Animated Typing Bubble */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 max-w-[160px] bg-muted/70 backdrop-blur-sm text-xs text-muted-foreground font-medium rounded-2xl shadow-sm border border-border/30 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                <span className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms", animationDuration: "0.8s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce"
                    style={{ animationDelay: "200ms", animationDuration: "0.8s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce"
                    style={{ animationDelay: "400ms", animationDuration: "0.8s" }}
                  />
                </span>
                <span className="truncate tracking-wide text-[11px] text-muted-foreground/90">
                  typing…
                </span>
              </div>
            )}
            <div ref={bottomRef} className="h-px w-full" />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 3: INPUT BAR (ChatInput component)
          This renders with position:fixed inside ChatInput itself —
          it tracks keyboard height via visualViewport and floats above
          everything. It is NOT part of the flex column above, so it
          cannot cause layout shifts to the wallpaper or the scroll area.
          The gradient wrapper is purely cosmetic — it fades into the
          wallpaper color at the bottom of the screen.
          ═══════════════════════════════════════════════════════════════════ */}
      <ChatInput
        onSend={onSendMessage}
        onTyping={onTyping}
        onHeightChange={setInputHeight}
      />
    </div>
  );
}
