import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  MoreVertical,
  Users,
  Info,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
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
  inputHeight?: number;
  keyboardHeight?: number;
  onOpenInfo?: () => void;
  onDeleteMessage?: (id: string) => void;
  onOpenForward?: (message: import("@/types/chat").Message) => void;
  onReply?: (message: Message) => void;
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4 motion-safe:animate-pulse" aria-hidden="true">
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
        className="w-64 bg-card/95 backdrop-blur-md border-border/80 shadow-xl rounded-2xl p-3 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-2 duration-200"
        side="right"
        align="start"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-background ring-1 ring-border/60 shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-xs font-semibold">
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground tracking-wide truncate">
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
  inputHeight,
  keyboardHeight,
  onOpenInfo,
  onDeleteMessage,
  onOpenForward,
  onReply,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  // Message list only scrolls to stay visible above the fixed input bar.

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
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

  useEffect(() => {
    if (!isNearBottom || !bottomRef.current || !scrollRef.current) return;

    let frameId = 0;
    const updateVisibility = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        if (!bottomRef.current) {
          frameId = 0;
          return;
        }

        const rect = bottomRef.current.getBoundingClientRect();
        const visibleBottom = window.visualViewport
          ? window.visualViewport.offsetTop + window.visualViewport.height
          : window.innerHeight;
        const obstruction = (inputHeight ?? 0) + (keyboardHeight ?? 0);
        const threshold = visibleBottom - obstruction - 8;

        if (rect.bottom > threshold) {
          bottomRef.current.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
        frameId = 0;
      });
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateVisibility);
      vv.addEventListener("scroll", updateVisibility);
    }
    window.addEventListener("resize", updateVisibility);
    updateVisibility();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateVisibility);
        vv.removeEventListener("scroll", updateVisibility);
      }
      window.removeEventListener("resize", updateVisibility);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [inputHeight, keyboardHeight, isNearBottom, messages]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const isGroup = chat.type === "group" || chat.type === "channel";
  const showOnlineRing = !isGroup && chat.is_online;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  /*
   * ══════════════════════════════════════════════════════════════════════════
   * THREE-LAYER ARCHITECTURE — wallpaper is completely decoupled
   *
   * Layer 0 (z-0):  WALLPAPER  — position:absolute, inset:0, covers full
   *                               parent. Rendered once, no JS ever touches
   *                               it after mount. No transforms, no resizes,
   *                               no viewport listeners. Pure CSS, immovable.
   *
   * Layer 1: HEADER — NOT part of this component at all. ChatHeader is
   *                    rendered via createPortal directly into
   *                    document.body (chat-header-portal), fixed to the
   *                    top of the real viewport. It lives completely
   *                    outside this component's DOM tree, so nothing that
   *                    happens in here (padding, scroll, keyboard) can
   *                    ever affect it.
   *
   * Layer 2 (z-[1]): MESSAGES  — position:relative, flex-1, overflow-y:auto.
   *                               Transparent background so wallpaper shows
   *                               through. padding-bottom tracks input height
   *                               so messages are always visible above it.
   *                               `contain: layout paint` on the root below
   *                               keeps any height/padding change in this
   *                               subtree from ever triggering a reflow of
   *                               siblings — belt-and-suspenders on top of
   *                               the portal isolation above.
   *
   * Layer 3: INPUT BAR — NOT part of this component either. TextBar is
   *                       also independently portaled to document.body
   *                       (chat-textbar-portal), fixed to the bottom,
   *                       and tracks the keyboard via visualViewport +
   *                       a compositor-only translate3d. It sits above
   *                       everything and cannot cause layout shifts here
   *                       or in the header, for the same portal reason.
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

  const rootStyles: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    userSelect: "none",
    WebkitUserSelect: "none",
    isolation: "isolate",
    contain: "layout paint",
    minHeight: 0,
    minWidth: 0,
  };

  const contentStyles: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    zIndex: 1,
    minHeight: 0,
    minWidth: 0,
  };

  const scrollContainerStyles: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "0.75rem 1rem 0 1rem",
    display: "block",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    backgroundColor: "transparent",
    boxSizing: "border-box",
    paddingBottom: (inputHeight ?? 0) + (keyboardHeight ?? 0) + 8,
    transitionProperty: "padding-bottom",
    transitionDuration: "180ms",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    maskImage: "linear-gradient(to bottom, transparent 0, black 14px)",
    WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 14px)",
  };

  return (
    // Outer container: position:relative to anchor the absolute wallpaper.
    // Uses inline style to minimize CSS dependency for viewport behaviour.
    <div style={rootStyles}>
      {/* Wallpaper moved to ChatLayout so it can be rendered as a
          viewport-fixed layer outside any transform-scoped ancestors. */}

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT LAYER: Messages
          This flex column sits above the wallpaper. It fills the parent
          and handles all layout/scroll. The wallpaper is NOT part of this
          flex flow — it's a sibling absolute-positioned behind it. Header
          and input bar are independently portaled elsewhere (see above).
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={contentStyles}>
        {/* ─── MESSAGES SCROLL AREA ─────────────────────────────────────── */}
        {/* Transparent background so the wallpaper (Layer 0) shows through.
            padding-bottom tracks the input bar height at rest so the final
            message remains visible above the fixed input bar. This container
            does not resize with the keyboard; only the scroll position (and
            a smoothly-transitioned padding-bottom) can move. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={scrollContainerStyles}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={`Messages with ${chat?.name ?? "conversation"}`}
        >
          <div className="max-w-3xl mx-auto space-y-1 motion-reduce:!transition-none">
            {hasMore && (
              <div className="flex justify-center py-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-muted/60 backdrop-blur-sm border border-border/40 text-muted-foreground px-3 py-1.5 rounded-full shadow-sm">
                  {loadingOlder ? (
                    <>
                      <Loader2
                        className="w-3 h-3 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3 h-3" aria-hidden="true" />
                      Scroll up for older messages
                    </>
                  )}
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
                    className="transform-gpu transition-all duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-40 motion-safe:slide-in-from-bottom-1"
                  >
                    <MessageBubble
                      message={msg}
                      isOwn={isOwn}
                      senderName={
                        showName ? msg.sender?.display_name : undefined
                      }
                      seen={seen}
                      onDeleteMessage={onDeleteMessage}
                      onOpenForward={onOpenForward}
                      onReply={onReply}
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
                      <div
                        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
                        tabIndex={0}
                        role="button"
                        aria-label={`Message from ${msg.sender.display_name}`}
                      >
                        {bubble}
                      </div>
                    </SenderHoverCard>
                  );
                }

                return bubble;
              })
            )}

            {/* WhatsApp-Style Micro-Animated Typing Bubble */}
            {typingUsers.length > 0 && (
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 max-w-[160px] bg-muted/70 backdrop-blur-sm text-xs text-muted-foreground font-medium rounded-2xl shadow-sm border border-border/30 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-2 duration-300"
                role="status"
                aria-live="polite"
                aria-label="Someone is typing"
              >
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full motion-safe:animate-bounce"
                    style={{ animationDelay: "0ms", animationDuration: "0.8s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full motion-safe:animate-bounce"
                    style={{
                      animationDelay: "200ms",
                      animationDuration: "0.8s",
                    }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary/70 rounded-full motion-safe:animate-bounce"
                    style={{
                      animationDelay: "400ms",
                      animationDuration: "0.8s",
                    }}
                  />
                </span>
                <span className="truncate tracking-wide text-xs text-muted-foreground/90">
                  typing…
                </span>
              </div>
            )}
            <div ref={bottomRef} className="h-px w-full" />
          </div>
        </div>

        {/* Floating scroll-to-bottom affordance — only shown once the user
            has scrolled away from the latest message. Reuses the existing
            isNearBottom state and bottomRef; no new state/effects added. */}
        {!isNearBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute right-4 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-card/95 backdrop-blur-md border border-border/60 shadow-lg text-foreground/80 hover:text-foreground hover:bg-card active:scale-95 transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            style={{ bottom: (inputHeight ?? 0) + (keyboardHeight ?? 0) + 16 }}
          >
            <ChevronDown className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
