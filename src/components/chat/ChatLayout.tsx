import React, { useState, useCallback } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { EmptyState } from './EmptyState';
import { NewChatDialog } from './NewChatDialog';
import { ChannelView } from '@/components/channel/ChannelView';
import type { Chat, Message } from '@/types/chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Demo data for initial UI
const DEMO_CHATS: Chat[] = [
  {
    id: '1', type: 'direct', name: 'John Doe', created_by: 'demo', created_at: new Date().toISOString(),
    is_online: true, unread_count: 3,
    last_message: { id: 'm1', chat_id: '1', sender_id: 'other', content: 'Hey, how are you doing?', type: 'text', status: 'delivered', created_at: new Date(Date.now() - 60000).toISOString() },
  },
  {
    id: '2', type: 'group', name: 'Project Team', created_by: 'demo', created_at: new Date().toISOString(),
    member_count: 12, unread_count: 0,
    last_message: { id: 'm2', chat_id: '2', sender_id: 'other2', content: 'Meeting at 3pm tomorrow', type: 'text', status: 'seen', created_at: new Date(Date.now() - 3600000).toISOString() },
  },
  {
    id: '3', type: 'channel', name: 'Tech News', created_by: 'demo', created_at: new Date().toISOString(),
    member_count: 4523, unread_count: 5,
    last_message: { id: 'm3', chat_id: '3', sender_id: 'admin', content: '🚀 New React 19 features announced!', type: 'text', status: 'sent', created_at: new Date(Date.now() - 7200000).toISOString() },
  },
  {
    id: '4', type: 'direct', name: 'Alice Smith', created_by: 'demo', created_at: new Date().toISOString(),
    is_online: false,
    last_message: { id: 'm4', chat_id: '4', sender_id: 'me', content: 'See you tomorrow!', type: 'text', status: 'seen', created_at: new Date(Date.now() - 86400000).toISOString() },
  },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'd1', chat_id: '1', sender_id: 'other', content: 'Hey there! 👋', type: 'text', status: 'seen', created_at: new Date(Date.now() - 300000).toISOString() },
    { id: 'd2', chat_id: '1', sender_id: 'me', content: 'Hi John! How are you?', type: 'text', status: 'seen', created_at: new Date(Date.now() - 240000).toISOString() },
    { id: 'd3', chat_id: '1', sender_id: 'other', content: "I'm good! Just checking in about the project. Did you get a chance to look at the designs?", type: 'text', status: 'seen', created_at: new Date(Date.now() - 180000).toISOString() },
    { id: 'd4', chat_id: '1', sender_id: 'me', content: 'Yes! They look great. I especially liked the dark mode design.', type: 'text', status: 'delivered', created_at: new Date(Date.now() - 120000).toISOString() },
    { id: 'd5', chat_id: '1', sender_id: 'other', content: 'Hey, how are you doing?', type: 'text', status: 'delivered', created_at: new Date(Date.now() - 60000).toISOString() },
  ],
  '2': [
    { id: 'g1', chat_id: '2', sender_id: 'system', content: 'Group created', type: 'system', status: 'sent', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'g2', chat_id: '2', sender_id: 'other3', content: "Let's schedule the standup for Monday", type: 'text', status: 'seen', created_at: new Date(Date.now() - 7200000).toISOString(), sender: { id: 'other3', username: 'bob', display_name: 'Bob Wilson', phone: '', hide_phone: false, is_online: true, last_seen: '', created_at: '' } },
    { id: 'g3', chat_id: '2', sender_id: 'other2', content: 'Meeting at 3pm tomorrow', type: 'text', status: 'seen', created_at: new Date(Date.now() - 3600000).toISOString(), sender: { id: 'other2', username: 'carol', display_name: 'Carol Chen', phone: '', hide_phone: false, is_online: false, last_seen: '', created_at: '' } },
  ],
  '3': [
    { id: 'c1', chat_id: '3', sender_id: 'admin', content: '🚀 New React 19 features announced!\n\nReact 19 brings exciting new features including server components, improved suspense, and much more. Check out the full blog post for details.', type: 'text', status: 'sent', created_at: new Date(Date.now() - 7200000).toISOString(), sender: { id: 'admin', username: 'technews', display_name: 'Tech News', phone: '', hide_phone: false, is_online: true, last_seen: '', created_at: '' } },
    { id: 'c2', chat_id: '3', sender_id: 'admin', content: '📱 iOS 19 leak reveals major design overhaul\n\nApple is reportedly planning a complete redesign of iOS with AI-first interactions.', type: 'text', status: 'sent', created_at: new Date(Date.now() - 3600000).toISOString(), sender: { id: 'admin', username: 'technews', display_name: 'Tech News', phone: '', hide_phone: false, is_online: true, last_seen: '', created_at: '' },
      reactions: [
        { id: 'r1', message_id: 'c2', user_id: 'u1', emoji: '🔥' },
        { id: 'r2', message_id: 'c2', user_id: 'u2', emoji: '🔥' },
        { id: 'r3', message_id: 'c2', user_id: 'u3', emoji: '👍' },
        { id: 'r4', message_id: 'c2', user_id: 'u4', emoji: '😮' },
      ],
    },
  ],
};

export function ChatLayout() {
  const [chats] = useState<Chat[]>(DEMO_CHATS);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>(DEMO_MESSAGES);
  const [showNewChat, setShowNewChat] = useState(false);
  const isMobile = useIsMobile();

  const currentChat = chats.find(c => c.id === activeChat);
  const currentMessages = activeChat ? (messages[activeChat] || []) : [];

  const handleSendMessage = useCallback((content: string) => {
    if (!activeChat) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chat_id: activeChat,
      sender_id: 'me',
      content,
      type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMsg],
    }));
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [activeChat]: prev[activeChat]?.map(m => m.id === newMsg.id ? { ...m, status: 'delivered' as const } : m) || [],
      }));
    }, 1000);
  }, [activeChat]);

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
                messages={currentMessages}
                currentUserId="me"
                onSendMessage={handleSendMessage}
                onBack={() => setActiveChat(null)}
              />
            ) : (
              <ChatArea
                chat={currentChat}
                messages={currentMessages}
                currentUserId="me"
                onSendMessage={handleSendMessage}
                onBack={() => setActiveChat(null)}
              />
            )
          ) : (
            <EmptyState />
          )}
        </div>
      )}
      <NewChatDialog open={showNewChat} onClose={() => setShowNewChat(false)} />
    </div>
  );
}
