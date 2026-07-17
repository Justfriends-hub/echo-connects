import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
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
  const { messages, loadOlder, hasMore, loadingOlder, sendMessage, deleteMessage, forwardMessage } =
    useMessages(activeChat);
  const currentChat = chats.find((c) => c.id === activeChat);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedChat = params.get('activeChat');
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
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<string | null>(null);
  const [forwardDialogMessage, setForwardDialogMessage] = useState<import('@/types/chat').Message | null>(null);
  const [forwardSelectedChats, setForwardSelectedChats] = useState<string[]>([]);
  const [forwardComment, setForwardComment] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [canPostInChannel, setCanPostInChannel] = useState(false);
  const isMobile = useIsMobile();
  const [headerPortalEl, setHeaderPortalEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('chat-header-portal') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'chat-header-portal';
      document.body.appendChild(el);
    }
    setHeaderPortalEl(el);
    return () => {
      // keep portal alive for app lifecycle
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const width = vv ? vv.width : window.innerWidth;
    setViewportHeight(height);
    setViewportWidth(width);
  }, []);


  // Wallpaper transition state
  const [prevWallpaper, setPrevWallpaper] = useState<string | null>(null);
  const [localWallpaper, setLocalWallpaper] = useState<string | null>(
    typeof window !== 'undefined' ? window.localStorage.getItem('echo.local_wallpaper') : null,
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'echo.local_wallpaper') {
        setLocalWallpaper(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [curWallpaper, setCurWallpaper] = useState<string | null>(
    currentChat?.wallpaper_url ?? profile?.default_wallpaper_url ?? localWallpaper ?? null,
  );
  const [curVisible, setCurVisible] = useState(true);
  // Update wallpaper content whenever the active chat changes.
  useEffect(() => {
    const next = currentChat?.wallpaper_url ?? profile?.default_wallpaper_url ?? localWallpaper ?? null;
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
  }, [currentChat?.wallpaper_url, profile?.default_wallpaper_url, curWallpaper]);

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
    return () => window.removeEventListener("channel-new-post", handler as EventListener);
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
    async (content: string) => {
      if (!activeChat || !user) return;
      await sendMessage(content, user.id);
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
      onOpenForward={(msg) => { setForwardDialogMessage(msg); setForwardSelectedChats([]); setForwardComment(''); }}
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
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
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
              transform: curVisible ? "translateY(-10px) scale(0.98)" : "translateY(0) scale(1)",
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
              transform: curVisible ? "translateY(0) scale(1)" : "translateY(10px) scale(1.02)",
            }}
          />
        ) : (
          <div className="chat-bg" style={{ position: "absolute", inset: 0 }} />
        )}
      </div>

      {/* Main app container */}
      {/* Chat header (fixed, rendered into document.body via portal so it's outside any transformed ancestor) */}
      {/* Skip header portal for channels — they have their own built-in header with logo */}
      {currentChat && currentChat.type !== 'channel' && headerPortalEl && createPortal(
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
          position: 'fixed',
          inset: 0,
          height: viewportHeight ? `${viewportHeight}px` : '100dvh',
          width: viewportWidth ? `${viewportWidth}px` : '100vw',
          maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh',
          maxWidth: viewportWidth ? `${viewportWidth}px` : '100vw',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          paddingTop: !currentChat || (currentChat && currentChat.type === 'channel')
            ? 'calc(env(safe-area-inset-top) + 0.5rem)'
            : 'calc(env(safe-area-inset-top) + 3.5rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          boxSizing: 'border-box',
        }}
      >
        {isMobile ? (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
          >
            {/* Sidebar Slide Control */}
            <div
              className={cn(
                "absolute inset-0 w-full h-full z-10 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
                activeChat ? "-translate-x-full" : "translate-x-0",
              )}
            >
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

            {/* Chat Frame Slide Layer */}
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

            <ResizablePanel defaultSize={70} className="bg-transparent relative">
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
      <AlertDialog open={!!deleteMessageTarget} onOpenChange={() => setDeleteMessageTarget(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-md border border-border/60 max-w-[340px] rounded-2xl p-5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold tracking-tight text-foreground">
              Delete message?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground/90 leading-relaxed mt-1">
              This will permanently remove the message for everyone if permitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="border-border/60 rounded-xl text-xs font-medium h-9 hover:bg-muted/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-medium h-9"
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
      <Dialog open={!!forwardDialogMessage} onOpenChange={() => setForwardDialogMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward message</DialogTitle>
            <DialogDescription>Select one or more chats to forward into and add an optional comment.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">Choose chats</div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              {chats.map((c) => (
                <label key={c.id} className="flex items-center gap-2 p-1">
                  <input
                    type="checkbox"
                    checked={forwardSelectedChats.includes(c.id)}
                    onChange={(e) => {
                      setForwardSelectedChats((prev) => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id));
                    }}
                  />
                  <span className="text-sm">{c.name || c.id}</span>
                </label>
              ))}
            </div>

            <div>
              <textarea
                value={forwardComment}
                onChange={(e) => setForwardComment(e.target.value)}
                placeholder="Add a comment (optional)"
                className="w-full rounded-md border p-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <button className="border-border/60 rounded-xl text-xs font-medium h-9 px-3 mr-2" onClick={() => setForwardDialogMessage(null)}>Cancel</button>
            <button
              className="bg-primary text-white rounded-xl text-xs font-medium h-9 px-3"
              onClick={async () => {
                if (!forwardDialogMessage || !user) return;
                const targets = forwardSelectedChats.length ? forwardSelectedChats : [];
                for (const tid of targets) {
                  await forwardMessage?.(tid, forwardDialogMessage, forwardComment, user.id);
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
          onSend={handleSendMessage}
          onTyping={currentChat.type !== 'channel' || canPostInChannel ? notifyTyping : undefined}
          disabled={currentChat.type === 'channel' ? !canPostInChannel : false}
          placeholder={
            currentChat.type === 'channel'
              ? canPostInChannel
                ? 'Post update to channel'
                : 'Only channel creator can post here'
              : 'Message'
          }
          onHeightChange={setInputHeight}
          onKeyboardHeightChange={setKeyboardHeight}
        />
      )}

      {/* Floating Network Notification pill banner matching native UI design aesthetics */}
      {!isOnline && (
        <div className="fixed left-1/2 -translate-x-1/2 top-4 z-50 rounded-full bg-destructive/95 border border-white/10 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md animate-in fade-in-50 slide-in-from-top-3 duration-300">
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
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-medium h-9"
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
