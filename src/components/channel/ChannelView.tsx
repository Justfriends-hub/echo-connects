import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Megaphone, Users, MoreVertical,
  Lock, Bell, BellOff, Share2,
  Shield, ChevronDown, Search, Pin,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChannelPost } from './ChannelPost';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChannelComments } from './ChannelComments';
import type { Chat, Message } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ChannelViewProps {
  chat: Chat;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onBack: () => void;
}

/** Group messages by date string for date dividers */
function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - msgDay.getTime();
  const oneDay = 86400000;
  if (diff < oneDay) return 'Today';
  if (diff < 2 * oneDay) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function ChannelView({ chat, messages, currentUserId, onSendMessage, onBack }: ChannelViewProps) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [memberRole, setMemberRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [subscriberCount, setSubscriberCount] = useState(chat.member_count || 0);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [allowedReactions, setAllowedReactions] = useState<string[]>(['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉']);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inputHeight, setInputHeight] = useState(68);

  const isAdmin = memberRole === 'owner' || memberRole === 'admin';

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep messages anchored above keyboard / visual viewport changes
  useEffect(() => {
    const onVV = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onVV);
      vv.addEventListener('scroll', onVV);
      return () => {
        vv.removeEventListener('resize', onVV);
        vv.removeEventListener('scroll', onVV);
      };
    }
    window.addEventListener('chat-visual-viewport', onVV as EventListener);
    window.addEventListener('resize', onVV);
    return () => {
      window.removeEventListener('chat-visual-viewport', onVV as EventListener);
      window.removeEventListener('resize', onVV);
    };
  }, []);

  useEffect(() => {
    if (!user || !chat.id) return;
    setLoading(true);

    const fetchRole = async () => {
      const { data } = await supabase
        .from('chat_members')
        .select('role')
        .eq('chat_id', chat.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setMemberRole(data.role as 'owner' | 'admin' | 'member');
    };

    const fetchSettings = async () => {
      const { data } = await supabase
        .from('channel_settings')
        .select('*')
        .eq('chat_id', chat.id)
        .maybeSingle();
      if (data) {
        setAllowedReactions(data.allowed_reactions || ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉']);
        setCommentsEnabled(data.comments_enabled);
      }
    };

    const fetchCount = async () => {
      const { count: realCount } = await supabase
        .from('chat_members')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id);

      const { data: boostData } = await supabase
        .rpc('get_visible_boost', { _chat_id: chat.id });

      setSubscriberCount((realCount || 0) + ((boostData as number) || 0));
    };

    Promise.all([fetchRole(), fetchSettings(), fetchCount()]).finally(() => setLoading(false));
  }, [user, chat.id]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }
  }, [user]);

  const handleMuteToggle = () => {
    setMuted(m => !m);
    toast.success(muted ? 'Channel unmuted' : 'Channel muted');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => toast.success('Link copied!'));
  };

  const formattedCount = subscriberCount >= 1000
    ? `${(subscriberCount / 1000).toFixed(1)}K`
    : subscriberCount.toString();

  // Build messages with date dividers
  const messagesWithDividers = useMemo(() => {
    const items: { type: 'divider'; label: string; key: string }[] | { type: 'message'; msg: Message; key: string }[] = [];
    let lastDate = '';
    for (const msg of messages) {
      const dateLabel = getDateLabel(msg.created_at);
      if (dateLabel !== lastDate) {
        (items as any[]).push({ type: 'divider', label: dateLabel, key: `div-${msg.id}` });
        lastDate = dateLabel;
      }
      (items as any[]).push({ type: 'message', msg, key: msg.id });
    }
    return items as ({ type: 'divider'; label: string; key: string } | { type: 'message'; msg: Message; key: string })[];
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 chat-bg">
      {/* ── Channel Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border flex-shrink-0 pwa-no-select">
        <Button variant="ghost" size="icon" className="md:hidden text-foreground" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Avatar className="w-10 h-10 ring-2 ring-primary/30">
          <AvatarImage src={chat.avatar_url} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm">
            <Megaphone className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm text-foreground truncate">{chat.name}</h2>
            {isAdmin && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary hidden sm:flex">
                <Shield className="w-2.5 h-2.5 mr-0.5" />
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (
              <>{formattedCount} subscribers</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={handleMuteToggle}>
                {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{muted ? 'Unmute' : 'Mute'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share channel</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border-border" align="end">
              <DropdownMenuItem className="text-sm gap-2">
                <Users className="w-4 h-4" /> View subscribers
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm gap-2">
                <Search className="w-4 h-4" /> Search in channel
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm gap-2">
                <Pin className="w-4 h-4" /> Pinned messages
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-sm gap-2 text-primary">
                    <Shield className="w-4 h-4" /> Manage channel
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm gap-2 text-destructive">
                <ChevronDown className="w-4 h-4" /> Leave channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Channel Info Banner (description) ───────────────────────────────── */}
      {chat.description && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border/50 flex-shrink-0">
          <p className="text-xs text-muted-foreground line-clamp-2">{chat.description}</p>
        </div>
      )}

      {/* ── Channel Posts ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto chat-messages-scroll px-3 py-4"
        style={{ paddingBottom: isAdmin ? inputHeight + 8 : 60 }}
      >
        <div className="max-w-2xl mx-auto">
          {loading && messages.length === 0 ? (
            <div className="space-y-4 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                  <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-3/4' : 'w-full'} rounded-xl`} />
                  <div className="flex justify-between items-center pt-2 border-t border-border/30">
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">{chat.name}</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {isAdmin ? 'Start broadcasting to your subscribers.' : 'No posts yet. Check back later.'}
              </p>
            </div>
          ) : (
            messagesWithDividers.map((item) => {
              if (item.type === 'divider') {
                return (
                  <div key={item.key} className="channel-date-divider">
                    <span>{item.label}</span>
                  </div>
                );
              }
              return (
                <ChannelPost
                  key={item.key}
                  message={item.msg}
                  channelName={chat.name || 'Channel'}
                  channelAvatar={chat.avatar_url}
                  allowedReactions={allowedReactions}
                  currentUserId={currentUserId}
                  onReact={handleReaction}
                  commentsEnabled={commentsEnabled}
                  onOpenComments={(msgId) => {
                    setSelectedMessage(msgId);
                    setShowComments(true);
                  }}
                  subscriberCount={subscriberCount}
                />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Admin Post Bar / Member Lock Bar ─────────────────────────────────── */}
      {isAdmin ? (
        <ChatInput
          onSend={onSendMessage}
          placeholder="Broadcast to channel…"
          onHeightChange={setInputHeight}
        />
      ) : (
        <div className="chat-input-fixed flex items-center justify-center gap-2 p-3 bg-card border-t border-border text-muted-foreground text-sm">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">Only admins can post in this channel</span>
        </div>
      )}

      {/* ── Comments Side Panel ──────────────────────────────────────────────── */}
      {showComments && selectedMessage && (
        <ChannelComments
          messageId={selectedMessage}
          chatId={chat.id}
          onClose={() => { setShowComments(false); setSelectedMessage(null); }}
        />
      )}
    </div>
  );
}
