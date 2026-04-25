import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { EmptyState } from './EmptyState';
import { NewChatDialog } from './NewChatDialog';
import { ChannelView } from '@/components/channel/ChannelView';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChats';
import { useMessages } from '@/hooks/useMessages';
import { useTypingPresence } from '@/hooks/useTypingPresence';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ChatLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { chats, reload: reloadChats } = useChats();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const { messages, loadOlder, hasMore, loadingOlder } = useMessages(activeChat);
  const currentChat = chats.find(c => c.id === activeChat);
  const { typingUsers, notifyTyping } = useTypingPresence(activeChat, user?.user_metadata?.display_name || user?.email || 'Someone');
  const latestMessageAt = messages[messages.length - 1]?.created_at;
  const { othersLastReadAt } = useReadReceipts(activeChat, user?.id, latestMessageAt);
  const [showNewChat, setShowNewChat] = useState(false);
  const isMobile = useIsMobile();

  // Redirect to auth if signed out
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!activeChat || !user) return;
    const { error } = await supabase.from('messages').insert({
      chat_id: activeChat,
      sender_id: user.id,
      content,
      type: 'text',
      status: 'sent',
    });
    if (error) toast.error(error.message);
  }, [activeChat, user]);

  const handleChatCreated = useCallback((chatId: string) => {
    setShowNewChat(false);
    setActiveChat(chatId);
    reloadChats();
  }, [reloadChats]);

  const showSidebar = !isMobile || !activeChat;
  const showChat = !isMobile || !!activeChat;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {showSidebar && (
        <div className={cn("h-full flex-shrink-0 relative", isMobile ? "w-full" : "w-[320px] lg:w-[380px]")}>
          <ChatSidebar
            chats={chats}
            activeChat={activeChat}
            onSelectChat={setActiveChat}
            onNewChat={() => setShowNewChat(true)}
            onNewGroup={() => {}}
            onNewChannel={() => {}}
          />
        </div>
      )}
      {showChat && (
        <div className="flex-1 h-full">
          {currentChat ? (
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
              />
            )
          ) : (
            <EmptyState />
          )}
        </div>
      )}
      <NewChatDialog open={showNewChat} onClose={() => setShowNewChat(false)} onChatCreated={handleChatCreated} />
    </div>
  );
}
