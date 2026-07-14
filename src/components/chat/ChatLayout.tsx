import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "./ChatSidebar";
import { ChatArea } from "./ChatArea";
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
  const {
    chats,
    loading: chatsLoading,
    isError: chatsError,
    reload: reloadChats,
  } = useChats();
  const { hasUnseenStatuses } = useStatuses();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const { messages, loadOlder, hasMore, loadingOlder, sendMessage } =
    useMessages(activeChat);
  const currentChat = chats.find((c) => c.id === activeChat);
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
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
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


  // Wallpaper transition state
  const [prevWallpaper, setPrevWallpaper] = useState<string | null>(null);
  const [curWallpaper, setCurWallpaper] = useState<string | null>(
    currentChat?.wallpaper_url ?? profile?.default_wallpaper_url ?? null,
  );
  const [curVisible, setCurVisible] = useState(true);
  // Update wallpaper content whenever the active chat changes.
  useEffect(() => {
    const next = currentChat?.wallpaper_url ?? profile?.default_wallpaper_url ?? null;
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
      reloadChats();
    },
    [reloadChats],
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
        onLoadOlder={loadOlder}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        othersLastReadAt={othersLastReadAt}
        onOpenInfo={() => setShowChatInfo(true)}
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
      {currentChat && headerPortalEl && createPortal(
        <ChatHeader
          chat={currentChat}
          typingUsers={typingUsers}
          isGroup={currentChat.type === "group" || currentChat.type === "channel"}
          showOnlineRing={!((currentChat.type === "group" || currentChat.type === "channel")) && !!currentChat.is_online}
          onBack={() => setActiveChat(null)}
          onOpenInfo={() => setShowChatInfo(true)}
        />,
        headerPortalEl,
      )}
      <div className="fixed inset-0 h-full w-full w-screen overflow-hidden bg-transparent pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {isMobile ? (
          /* Mobile Viewport: Absolute slider deck layer to mimic a native application frame wrapper */
          <div className="relative flex h-full w-full overflow-hidden bg-transparent">
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

            <ResizablePanel defaultSize={70} className="bg-transparent">
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
