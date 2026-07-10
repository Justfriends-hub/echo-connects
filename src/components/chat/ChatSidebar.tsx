import React, { useState } from 'react';
import { Search, Menu, Edit, Users, Megaphone, Settings, Shield, ChevronDown, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { SidebarTabSwitcher } from './SidebarTabSwitcher';
import { StatusListView } from '@/components/status/StatusListView';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { SectionErrorIndicator } from '@/components/SectionErrorIndicator';
import type { Chat } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
  onNewStatus: () => void;
  hasUnseenStatuses?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  loading?: boolean;
  onOpenProfile?: () => void;
}

function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSidebar({ chats, activeChat, onSelectChat, onNewChat, onNewGroup, onNewChannel, loading, onOpenProfile }: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [directsOpen, setDirectsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'status'>('chats');
  const navigate = useNavigate();

  const filtered = chats.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const channels = filtered.filter(c => c.type === 'channel');
  const groups = filtered.filter(c => c.type === 'group');
  const directs = filtered.filter(c => c.type === 'direct');

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getChatIcon = (type: Chat['type']) => {
    if (type === 'group') return <Users className="w-3 h-3 text-muted-foreground" />;
    if (type === 'channel') return <Megaphone className="w-3 h-3 text-muted-foreground" />;
    return null;
  };

  const renderChatItem = (chat: Chat) => (
    <button
      key={chat.id}
      onClick={() => onSelectChat(chat.id)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left rounded-lg mx-1",
        activeChat === chat.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
      )}
    >
      <div className="relative">
        <Avatar className="w-12 h-12">
          <AvatarImage src={chat.avatar_url} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
            {getInitials(chat.name || 'U')}
          </AvatarFallback>
        </Avatar>
        {chat.type === 'direct' && chat.is_online && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 online-dot rounded-full border-2 border-sidebar" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {getChatIcon(chat.type)}
            <span className="font-medium text-sm text-sidebar-foreground truncate">
              {chat.name || 'Unknown'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {chat.last_message ? formatTime(chat.last_message.created_at) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm text-muted-foreground truncate pr-2">
            {chat.last_message?.content || 'No messages yet'}
          </p>
          {(chat.unread_count ?? 0) > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-unread-badge text-xs font-medium text-primary-foreground px-1.5">
              {chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-sidebar-border pwa-no-select">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 bg-popover border-border" align="start">
            <DropdownMenuItem onClick={onNewGroup} className="gap-3">
              <Users className="w-4 h-4" /> New Group
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewChannel} className="gap-3">
              <Megaphone className="w-4 h-4" /> New Channel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-3">
              <Settings className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-3">
              <Shield className="w-4 h-4 text-primary" /> Admin Panel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-sidebar-accent border-0 text-sidebar-foreground placeholder:text-muted-foreground rounded-full"
          />
        </div>
      </div>

      <SidebarTabSwitcher
        activeTab={activeTab}
        onChange={setActiveTab}
        hasUnseenStatuses={hasUnseenStatuses ?? false}
      />

      {/* Chat List */}
      <ScrollArea className="flex-1">
        {activeTab === 'status' ? (
          <StatusListView onOpenComposer={onNewStatus} />
        ) : (
          <SectionErrorBoundary onRetry={onRetry}>
            {loading ? (
              <ChatListSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="py-1">
                {isError && onRetry && (
                  <div className="px-4 py-2">
                    <SectionErrorIndicator isError={isError} onRetry={onRetry} label="Unable to load chats" />
                  </div>
                )}

                {/* Channels Section */}
                {channels.length > 0 && (
                  <>
                    <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                        <span>Channels</span>
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", channelsOpen && "rotate-180")} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {channels.map(renderChatItem)}
                      </CollapsibleContent>
                    </Collapsible>
                    <Separator className="my-1 mx-3" />
                  </>
                )}

                {/* Groups Section */}
                {groups.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Groups
                    </div>
                    {groups.map(renderChatItem)}
                    <Separator className="my-1 mx-3" />
                  </>
                )}

                {/* Direct Messages Section */}
                <Collapsible open={directsOpen} onOpenChange={setDirectsOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                    <span>Direct Messages</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", directsOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {directs.map(renderChatItem)}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </SectionErrorBoundary>
        )}
      </ScrollArea>

      {/* FAB */}
      <div className="absolute bottom-6 right-6">
        <Button
          onClick={activeTab === 'status' ? onNewStatus : onNewChat}
          size="icon"
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
        >
          {activeTab === 'status' ? <Camera className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
}
