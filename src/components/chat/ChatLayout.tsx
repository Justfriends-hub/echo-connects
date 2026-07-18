import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Message } from "@/types/chat";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatArea } from "./ChatArea";
import TextBar from "./TextBar";
import ChatHeader from "./ChatHeader";
import { EmptyState } from "./EmptyState";
import { NewChatDialog } from "./NewChatDialog";
import { ChatInfoSheet } from "./ChatInfoSheet";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { StatusComposer } from "../status/StatusComposer";
import { ChannelView } from "@/components/channel/ChannelView";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/hooks/useChats";
import { useStatuses } from "@/hooks/useStatuses";
import { useMessages } from "@/hooks/useMessages";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ChatLayout() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    chats,
    loading: chatsLoading,
    isError: chatsError,
    reload: reloadChats,
  } = useChats();
  const { hasUnseenStatuses } = useStatuses();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const {
    messages,
    loadOlder,
    hasMore,
    loadingOlder,
    sendMessage,
    deleteMessage,
    forwardMessage,
  } = useMessages(activeChat);
  const currentChat = chats.find((c) => c.id === activeChat);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedChat = params.get("activeChat");
    if (requestedChat && requestedChat !== activeChat) {
      setActiveChat(requestedChat);
    }
  }, [location.search, activeChat]);

  const { typingUsers, notifyTyping } = useTypingPresence(
    activeChat,
    profile?.display_name ||
      user?.user_metadata?.display_name ||
      user?.email ||
      "Someone",
  );
  const latestMessageAt = messages[messages.length - 1]?.created_at;
  const { othersLastReadAt } = useReadReceipts(
    activeChat,
    user?.id,
    latestMessageAt,
  );
  const [showNewChat, setShowNewChat] = useState(false);
  const [showStatusComposer, setShowStatusComposer] = useState(false);
  const [newChatMode, setNewChatMode] = useState<
    "direct" | "group" | "channel"
  >("direct");
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<string | null>(
    null,
  );
  const [forwardDialogMessage, setForwardDialogMessage] = useState<
    import("@/types/chat").Message | null
  >(null);
  const [forwardSelectedChats, setForwardSelectedChats] = useState<string[]>(
    [],
  );
  const [forwardComment, setForwardComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [inputHeight, setInputHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [canPostInChannel, setCanPostInChannel] = useState(false);
  const isMobile = useIsMobile();
  const [headerPortalEl, setHeaderPortalEl] = useState<HTMLDivElement | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(
      "chat-header-portal",
    ) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "chat-header-portal";
      document.body.appendChild(el);
    }
    setHeaderPortalEl(el);
    return () => {
      // keep portal alive for app lifecycle
    };
  }, []);

  // Keeps the fixed app frame's height/width in sync with the *actual*
  // visible viewport at all times — including while the on-screen keyboard
  // is open. Previously this only ran once on mount, so the frame stayed
  // pinned to its pre-keyboard size while ChatHeader (fixed+portaled),
  // ChatArea's padding, and TextBar's translate all correctly tracked the
  // keyboard — a mismatch that reads as things jumping/shifting relative
  // to each other. This uses the same visualViewport resize/scroll pattern
  // already used elsewhere in this app (e.g. the input bar's own keyboard
  // tracking), just applied consistently here too.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;
    const updateViewport = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        setViewportHeight(vv ? vv.height : window.innerHeight);
        setViewportWidth(vv ? vv.width : window.innerWidth);
        frameId = 0;
      });
    };

    updateViewport();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateViewport);
      vv.addEventListener("scroll", updateViewport);
    } else {
      window.addEventListener("resize", updateViewport);
    }

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateViewport);
        vv.removeEventListener("scroll", updateViewport);
      } else {
        window.removeEventListener("resize", updateViewport);
      }
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  // Guards against a well-known iOS Safari bug: focusing a text input
  // inside a fixed-position layout triggers the browser's native
  // "auto-scroll the page to reveal the focused field" behavior. Because
  // the header, message list, and input bar already track the keyboard
  // manually via visualViewport, that native scroll is redundant — and it
  // visibly displaces position:fixed elements (the header appears to
  // jump) while it happens. Locking window scroll back to (0,0) whenever
  // the visual viewport changes neutralizes it without touching any
  // keyboard-height or animation logic elsewhere.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lockScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", lockScroll);
    vv?.addEventListener("scroll", lockScroll);
    window.addEventListener("scroll", lockScroll, { passive: true });
    return () => {
      vv?.removeEventListener("resize", lockScroll);
      vv?.removeEventListener("scroll", lockScroll);
      window.removeEventListener("scroll", lockScroll);
    };
  }, []);

  // Wallpaper transition state
  const [prevWallpaper, setPrevWallpaper] = useState<string | null>(null);
  const [localWallpaper, setLocalWallpaper] = useState<string | null>(
    typeof window !== "undefined"
      ? window.localStorage.getItem("echo.local_wallpaper")
      : null,
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "echo.local_wallpaper") {
        setLocalWallpaper(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [curWallpaper, setCurWallpaper] = useState<string | null>(
    currentChat?.wallpaper_url ??
      profile?.default_wallpaper_url ??
      localWallpaper ??
      null,
  );
  const [curVisible, setCurVisible] = useState(true);
  // Update wallpaper content whenever the active chat changes.
  useEffect(() => {
    const next =
      currentChat?.wallpaper_url ??
      profile?.default_wallpaper_url ??
      localWallpaper ??
      null;
    if (next === curWallpaper) return;

    setPrevWallpaper(curWallpaper);
    setCurVisible(false);
    setCurWallpaper(next);

    const t1 = window.setTimeout(() => setCurVisible(true), 40);
    const t2 = window.setTimeout(() => setPrevWallpaper(null), 360);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    currentChat?.wallpaper_url,
    profile?.default_wallpaper_url,
    curWallpaper,
  ]);

  // Redirect to auth if signed out
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let mounted = true;
    if (!activeChat || !user || currentChat?.type !== "channel") {
      setCanPostInChannel(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("chat_members")
        .select("role")
        .eq("chat_id", activeChat)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setCanPostInChannel(data?.role === "owner");
    };

    fetchRole();
    return () => {
      mounted = false;
    };
  }, [activeChat, currentChat?.type, user]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{
        chatId: string;
        chatName: string;
        message: string;
      }>;
      if (custom.detail.chatId === activeChat) return;
      toast.success(`New post in ${custom.detail.chatName}`, {
        description: custom.detail.message,
      });
    };

    window.addEventListener("channel-new-post", handler as EventListener);
    return () =>
      window.removeEventListener("channel-new-post", handler as EventListener);
  }, [activeChat]);

  // Listen for command palette events
  useEffect(() => {
    const handler = (e: Event) => {
      setShowNewChat(true);
    };
    window.addEventListener("open-new-chat", handler);
    return () => window.removeEventListener("open-new-chat", handler);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!activeChat || !user) return;
      await sendMessage(content, user.id, replyToId);
      setReplyingTo(null);
    },
    [activeChat, user, sendMessage],
  );

  const handleChatCreated = useCallback(
    (chatId: string) => {
      setShowNewChat(false);
      setActiveChat(chatId);
      navigate(`/?activeChat=${chatId}`, { replace: true });
      reloadChats();
    },
    [navigate, reloadChats],
  );

  const handleDeleteChat = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("chat_members")
      .delete()
      .eq("chat_id", deleteTarget)
      .eq("user_id", user?.id || "");
    if (error) {
      toast.error("Failed to leave chat");
    } else {
      toast.success("Chat removed");
      if (activeChat === deleteTarget) setActiveChat(null);
      reloadChats();
    }
    setDeleteTarget(null);
  };

  const chatContent = currentChat ? (
    currentChat.type === "channel" ? (
      <ChannelView
        chat={currentChat}
        messages={messages}
        currentUserId={user?.id || ""}
        onSendMessage={handleSendMessage}
        onBack={() => setActiveChat(null)}
      />
    ) : (
      <ChatArea
        chat={currentChat}
        messages={messages}
        currentUserId={user?.id || ""}
        onSendMessage={handleSendMessage}
        onBack={() => setActiveChat(null)}
        typingUsers={typingUsers}
        onTyping={notifyTyping}
        inputHeight={inputHeight}
        keyboardHeight={keyboardHeight}
        onLoadOlder={loadOlder}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        othersLastReadAt={othersLastReadAt}
        onOpenInfo={() => setShowChatInfo(true)}
        onDeleteMessage={(id) => setDeleteMessageTarget(id)}
        onOpenForward={(msg) => {
          setForwardDialogMessage(msg);
          setForwardSelectedChats([]);
          setForwardComment("");
        }}
        onReply={(msg) => setReplyingTo(msg)}
      />
    )
  ) : (
    <EmptyState />
  );

  return (
    <>
      {/* Wallpaper layer (viewport-fixed sibling to the chat frame) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        {prevWallpaper && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${prevWallpaper})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transition: "opacity 300ms ease-out, transform 300ms ease-out",
              opacity: curVisible ? 0 : 1,
              transform: curVisible
                ? "translateY(-10px) scale(0.98)"
                : "translateY(0) scale(1)",
            }}
          />
        )}

        {curWallpaper ? (
          <div
            key={curWallpaper}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${curWallpaper})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transition: "opacity 300ms ease-out, transform 300ms ease-out",
              opacity: curVisible ? 1 : 0,
              transform: curVisible
                ? "translateY(0) scale(1)"
                : "translateY(10px) scale(1.02)",
            }}
          />
        ) : (
          <div className="chat-bg" style={{ position: "absolute", inset: 0 }} />
        )}
      </div>

      {/* Main app container */}
      {/* Chat header (fixed, rendered into document.body via portal so it's outside any transformed ancestor) */}
      {/* Skip header portal for channels — they have their own built-in header with logo */}
      {currentChat &&
        currentChat.type !== "channel" &&
        headerPortalEl &&
        createPortal(
          <ChatHeader
            chat={currentChat}
            typingUsers={typingUsers}
            isGroup={currentChat.type === "group"}
            showOnlineRing={!!currentChat.is_online}
            onBack={() => setActiveChat(null)}
            onOpenInfo={() => setShowChatInfo(true)}
          />,
          headerPortalEl,
        )}
      <div
        style={{
          position: "fixed",
          inset: 0,
          height: viewportHeight ? `${viewportHeight}px` : "100dvh",
          width: viewportWidth ? `${viewportWidth}px` : "100vw",
          maxHeight: viewportHeight ? `${viewportHeight}px` : "100dvh",
          maxWidth: viewportWidth ? `${viewportWidth}px` : "100vw",
          overflow: "hidden",
          backgroundColor: "transparent",
          paddingTop:
            !currentChat || (currentChat && currentChat.type === "channel")
              ? "calc(env(safe-area-inset-top) + 0.5rem + 90px)"
              : "calc(env(safe-area-inset-top) + 3.5rem + 90px)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          boxSizing: "border-box",
          transitionProperty: "height, max-height",
          transitionDuration: "120ms",
          transitionTimingFunction: "ease-out",
        }}
      >
        {isMobile ? (
          <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "transparent" }}>
            {/* Chat Frame Slide Layer (stays full screen when active) */}
            <div
              className={cn(
                "absolute inset-0 w-full h-full z-20 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform bg-transparent shadow-2xl",
                activeChat ? "translate-x-0" : "translate-x-full",
              )}
            >
              <SectionErrorBoundary onRetry={reloadChats}>
                {chatContent}
              </SectionErrorBoundary>
            </div>

            {/* Bottom sheet container for Chats / Status (mobile) */}
            <div
              aria-hidden={!!activeChat}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: sheetOpen
                  ? viewportHeight
                    ? `${viewportHeight}px`
                    : "100dvh"
                  : 110,
                transition: "height 260ms cubic-bezier(0.22,0.61,0.36,1)",
                zIndex: 10,
                overflow: "hidden",
                display: activeChat ? "none" : "block",
                touchAction: "none",
              }}
            >
              <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
                <button
                  aria-label={sheetOpen ? "Close panel" : "Open panel"}
                  onClick={() => setSheetOpen((s) => !s)}
                  className="w-10 h-6 rounded-full bg-white/10 text-white flex items-center justify-center"
                >
                  <div className="w-6 h-[2px] bg-white/60" />
                </button>
              </div>

              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <div
                  className={cn(
                    "absolute inset-0 w-full h-full z-10 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
                    activeChat ? "-translate-x-full" : "translate-x-0",
                  )}
                >
                  <ChatSidebar
                    chats={chats}
                    activeChat={activeChat}
                    onSelectChat={(id) => {
                      setActiveChat(id);
                      setSheetOpen(false);
                    }}
                    onNewChat={() => {
                      setNewChatMode("direct");
                      setShowNewChat(true);
                    }}
                    onNewGroup={() => {
                      setNewChatMode("group");
                      setShowNewChat(true);
                    }}
                    onNewChannel={() => {
                      setNewChatMode("channel");
                      setShowNewChat(true);
                    }}
                    onNewStatus={() => setShowStatusComposer(true)}
                    hasUnseenStatuses={hasUnseenStatuses}
                    isError={chatsError}
                    loading={chatsLoading}
                    onRetry={reloadChats}
                    onOpenProfile={() => setShowProfileDrawer(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop Frame Layout via Custom Resizable Hardware Layer Blocks */
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full bg-transparent"
          >
            <ResizablePanel
              defaultSize={30}
              minSize={25}
              maxSize={45}
              className="bg-card"
            >
              <div className="h-full relative">
                <ChatSidebar
                  chats={chats}
                  activeChat={activeChat}
                  onSelectChat={setActiveChat}
                  onNewChat={() => {
                    setNewChatMode("direct");
                    setShowNewChat(true);
                  }}
                  onNewGroup={() => {
                    setNewChatMode("group");
                    setShowNewChat(true);
                  }}
                  onNewChannel={() => {
                    setNewChatMode("channel");
                    setShowNewChat(true);
                  }}
                  onNewStatus={() => setShowStatusComposer(true)}
                  hasUnseenStatuses={hasUnseenStatuses}
                  isError={chatsError}
                  loading={chatsLoading}
                  onRetry={reloadChats}
                  onOpenProfile={() => setShowProfileDrawer(true)}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className="w-[1.5px] bg-border/40 hover:bg-primary/20 transition-colors duration-200"
            />

            <ResizablePanel
              defaultSize={70}
              className="bg-transparent relative"
            >
              <SectionErrorBoundary onRetry={reloadChats}>
                {chatContent}
              </SectionErrorBoundary>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <NewChatDialog
        open={showNewChat}
        mode={newChatMode}
        onClose={() => setShowNewChat(false)}
        onChatCreated={handleChatCreated}
      />

      {/* Message delete confirmation dialog */}
      <AlertDialog
        open={!!deleteMessageTarget}
        onOpenChange={() => setDeleteMessageTarget(null)}
      >
        <AlertDialogContent className="bg-card/95 backdrop-blur-md border border-border/60 max-w-[340px] rounded-2xl p-5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold tracking-tight text-foreground">
              Delete message?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground/90 leading-relaxed mt-1">
              This will permanently remove the message for everyone if
              permitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border/60 rounded-xl text-xs font-medium h-9 hover:bg-muted/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl text-xs font-medium h-9"
              onClick={async () => {
                if (!deleteMessageTarget) return;
                await deleteMessage?.(deleteMessageTarget);
                setDeleteMessageTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forward message dialog */}
      <Dialog
        open={!!forwardDialogMessage}
        onOpenChange={() => setForwardDialogMessage(null)}
      >
        <DialogContent className="bg-card/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-foreground">
              Forward message
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/90 leading-relaxed">
              Select one or more chats to forward into and add an optional
              comment.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider px-1">
              Choose chats
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-1.5 space-y-0.5">
              {chats.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50"
                >
                  <input
                    type="checkbox"
                    checked={forwardSelectedChats.includes(c.id)}
                    onChange={(e) => {
                      setForwardSelectedChats((prev) =>
                        e.target.checked
                          ? [...prev, c.id]
                          : prev.filter((x) => x !== c.id),
                      );
                    }}
                    className="w-4 h-4 rounded accent-primary shrink-0"
                  />
                  <span className="text-sm text-foreground truncate">
                    {c.name || c.id}
                  </span>
                </label>
              ))}
            </div>

            <div>
              <textarea
                value={forwardComment}
                onChange={(e) => setForwardComment(e.target.value)}
                placeholder="Add a comment (optional)"
                className="w-full rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/40 transition-colors resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <button
              type="button"
              className="border border-border/60 rounded-xl text-xs font-medium h-9 px-4 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              onClick={() => setForwardDialogMessage(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-medium h-9 px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!forwardSelectedChats.length}
              onClick={async () => {
                if (!forwardDialogMessage || !user) return;
                const targets = forwardSelectedChats.length
                  ? forwardSelectedChats
                  : [];
                for (const tid of targets) {
                  await forwardMessage?.(
                    tid,
                    forwardDialogMessage,
                    forwardComment,
                    user.id,
                  );
                }
                setForwardDialogMessage(null);
              }}
            >
              Forward
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentChat && (
        <ChatInfoSheet
          open={showChatInfo}
          onClose={() => setShowChatInfo(false)}
          chat={currentChat}
        />
      )}

      <ProfileDrawer
        open={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
      />
      <StatusComposer
        open={showStatusComposer}
        onClose={() => setShowStatusComposer(false)}
      />
      {currentChat && (
        <TextBar
          onSend={(content) => handleSendMessage(content, replyingTo?.id)}
          onTyping={
            currentChat.type !== "channel" || canPostInChannel
              ? notifyTyping
              : undefined
          }
          disabled={currentChat.type === "channel" ? !canPostInChannel : false}
          placeholder={
            currentChat.type === "channel"
              ? canPostInChannel
                ? "Post update to channel"
                : "Only channel creator can post here"
              : "Message"
          }
          onHeightChange={setInputHeight}
          onKeyboardHeightChange={setKeyboardHeight}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
        />
      )}

      {/* Floating Network Notification pill banner matching native UI design aesthetics */}
      {!isOnline && (
        <div className="fixed left-1/2 -translate-x-1/2 top-4 z-50 flex items-center gap-2 rounded-full bg-destructive/95 border border-white/10 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-3 duration-300">
          <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
          Waiting for network connection…
        </div>
      )}

      {/* Leave Chat Confirmation Dialog styled to match the chat theme colors */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-card/95 backdrop-blur-md border border-border/60 max-w-[340px] rounded-2xl p-5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold tracking-tight text-foreground">
              Leave this chat?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground/90 leading-relaxed mt-1">
              You will be removed from this conversation stream immediately. You
              will need an invite to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border/60 rounded-xl text-xs font-medium h-9 hover:bg-muted/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl text-xs font-medium h-9"
              onClick={handleDeleteChat}
            >
              Leave Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
