import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { EmptyState } from './EmptyState';
import { NewChatDialog } from './NewChatDialog';
import { ChatInfoSheet } from './ChatInfoSheet';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { StatusComposer } from '../status/StatusComposer';
import { ChannelView } from '@/components/channel/ChannelView';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChats';
import { useStatuses } from '@/hooks/useStatuses';
import { useMessages } from '@/hooks/useMessages';
import { useTypingPresence } from '@/hooks/useTypingPresence';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ChatLayout() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { chats, loading: chatsLoading, isError: chatsError, reload: reloadChats } = useChats();
  const { hasUnseenStatuses } = useStatuses();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const { messages, loadOlder, hasMore, loadingOlder, sendMessage } = useMessages(activeChat);
  const currentChat = chats.find(c => c.id === activeChat);
  const { typingUsers, notifyTyping } = useTypingPresence(
    activeChat,
    profile?.display_name || user?.user_metadata?.display_name || user?.email || 'Someone'
  );
  const latestMessageAt = messages[messages.length - 1]?.created_at;
  const { othersLastReadAt } = useReadReceipts(activeChat, user?.id, latestMessageAt);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showStatusComposer, setShowStatusComposer] = useState(false);
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group' | 'channel'>('direct');
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isMobile = useIsMobile();

  // Redirect to auth if signed out
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  // Listen for command palette events
  useEffect(() => {
    const handler = (e: Event) => {
      setShowNewChat(true);
    };
    window.addEventListener('open-new-chat', handler);
    return () => window.removeEventListener('open-new-chat', handler);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeChat || !user) return;
    await sendMessage(content, user.id);
  }, [activeChat, user, sendMessage]);

  const handleChatCreated = useCallback((chatId: string) => {
    setShowNewChat(false);
    setActiveChat(chatId);
    reloadChats();
  }, [reloadChats]);

  const handleDeleteChat = async () => {
    if (!deleteTarget) return;
    // Remove membership (soft delete for user)
    const { error } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', deleteTarget)
      .eq('user_id', user?.id || '');
    if (error) {
      toast.error('Failed to leave chat');
    } else {
      toast.success('Chat removed');
      if (activeChat === deleteTarget) setActiveChat(null);
      reloadChats();
    }
    setDeleteTarget(null);
  };

  const showSidebar = !isMobile || !activeChat;
  const showChat = !isMobile || !!activeChat;

  const chatContent = currentChat ? (
    currentChat.type === 'channel' ? (
      <ChannelView
        chat={currentChat}
        messages={messages}
        currentUserId={user?.id || ''}
        onSendMessage={handleSendMessage}
        onBack={() => setActiveChat(null)}
      />
    ) : (
      <ChatArea
        chat={currentChat}
        messages={messages}
        currentUserId={user?.id || ''}
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
      {isMobile ? (
        // Mobile: stacked views (no resizable)
        <div className="flex h-screen w-full overflow-hidden">
          {showSidebar && (
            <div className="w-full h-full relative">
              <ChatSidebar
                chats={chats}
                activeChat={activeChat}
                onSelectChat={setActiveChat}
                onNewChat={() => {
                  setNewChatMode('direct');
                  setShowNewChat(true);
                }}
                onNewGroup={() => {
                  setNewChatMode('group');
                  setShowNewChat(true);
                }}
                onNewChannel={() => {
                  setNewChatMode('channel');
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
          )}
          {showChat && (
            <div className="w-full h-full">
              <SectionErrorBoundary onRetry={reloadChats}>
                {chatContent}
              </SectionErrorBoundary>
            </div>
          )}
        </div>
      ) : (
        // Desktop: resizable panels
        <ResizablePanelGroup direction="horizontal" className="h-screen w-full">
          <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
            <div className="h-full relative">
              <ChatSidebar
                chats={chats}
                activeChat={activeChat}
                onSelectChat={setActiveChat}
                onNewChat={() => {
                  setNewChatMode('direct');
                  setShowNewChat(true);
                }}
                onNewGroup={() => {
                  setNewChatMode('group');
                  setShowNewChat(true);
                }}
                onNewChannel={() => {
                  setNewChatMode('channel');
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
          <ResizableHandle withHandle className="bg-border hover:bg-primary/30 transition-colors" />
          <ResizablePanel defaultSize={72}>
            <SectionErrorBoundary onRetry={reloadChats}>
              {chatContent}
            </SectionErrorBoundary>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <NewChatDialog
        open={showNewChat}
        mode={newChatMode}
        onClose={() => setShowNewChat(false)}
        onChatCreated={handleChatCreated}
      />

      {currentChat && (
        <ChatInfoSheet open={showChatInfo} onClose={() => setShowChatInfo(false)} chat={currentChat} />
      )}

      <ProfileDrawer open={showProfileDrawer} onClose={() => setShowProfileDrawer(false)} />
      <StatusComposer open={showStatusComposer} onClose={() => setShowStatusComposer(false)} />

      {!isOnline && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-full bg-destructive/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-sm sm:bottom-20">
          No internet connection. Your message will appear with a clock and send when the network returns.
        </div>
      )}

      {/* Delete Chat Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from this chat. You can rejoin later if invited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteChat}>
              Leave Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
