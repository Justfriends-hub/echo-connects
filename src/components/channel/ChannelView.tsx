import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Megaphone, Users, MoreVertical,
  Lock, Bell, BellOff, Share2,
  Shield, ChevronDown, Search, Pin, Info, ArrowUpRight,
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
// ChatInput removed — input and keyboard disabled
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
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  // inputHeight not used since input removed

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
        .select('invite_code, allowed_reactions, comments_enabled')
        .eq('chat_id', chat.id)
        .maybeSingle();
      if (data) {
        setInviteCode(data.invite_code || null);
        setAllowedReactions(data.allowed_reactions || ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉']);
        setCommentsEnabled(data.comments_enabled);
      }
    };

    const fetchCount = async () => {
      const { count: realCount } = await supabase
        .from('chat_members')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id);

      const { data: boostData, error: boostError } = await supabase
        .rpc('get_visible_boost', { _chat_id: chat.id, _kind: 'subscribers' });

      if (boostError) {
        console.warn('[ChannelView] get_visible_boost failed', boostError);
      }

      const boostCount = boostError ? 0 : ((boostData as number) || 0);
      setSubscriberCount((realCount || 0) + boostCount);
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

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const handleShare = () => {
    const shareUrl = inviteLink ?? window.location.href;
    navigator.clipboard?.writeText(shareUrl).then(() => toast.success('Link copied!'));
  };

  const handleInviteMembers = () => {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink).then(() => toast.success('Invite link copied!'));
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
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      {/* ── Channel Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur-md border-b border-border/70 shadow-sm shadow-black/5 flex-shrink-0 pwa-no-select">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-foreground hover:bg-muted/60 active:scale-95 transition-transform rounded-full w-9 h-9 -ml-1"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="relative flex-shrink-0">
          <div className="p-[2px] rounded-full bg-gradient-to-br from-primary/60 to-primary/10 shadow-sm">
            <Avatar className="w-10 h-10 ring-2 ring-card">
              <AvatarImage src={chat.avatar_url} className="object-cover" />
              <AvatarFallback className="bg-primary/15 text-primary text-sm">
                <Megaphone className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-[15px] text-foreground tracking-tight truncate leading-tight">
              {chat.name}
            </h2>
            {isAdmin && (
              <Badge
                variant="outline"
                className="text-[9px] font-medium px-1.5 py-0 h-4 rounded-full border-primary/40 bg-primary/5 text-primary hidden sm:flex items-center gap-0.5 flex-shrink-0"
              >
                <Shield className="w-2.5 h-2.5" />
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground/90 font-medium tracking-wide mt-0.5">
            {loading ? (
              <Skeleton className="h-3 w-20 inline-block rounded-full" />
            ) : (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3 opacity-70" />
                {formattedCount} subscribers
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors"
                onClick={handleMuteToggle}
              >
                {muted ? <BellOff className="w-[18px] h-[18px]" /> : <Bell className="w-[18px] h-[18px]" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-md">
              {muted ? 'Unmute' : 'Mute'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors"
                onClick={handleShare}
              >
                <Share2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-md">
              Share channel
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card/95 backdrop-blur-md border-border/70 rounded-xl shadow-xl p-1" align="end">
              <DropdownMenuItem className="text-sm gap-2.5 rounded-lg py-2 focus:bg-muted/60">
                <Users className="w-4 h-4 text-muted-foreground" /> View subscribers
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm gap-2.5 rounded-lg py-2 focus:bg-muted/60">
                <Search className="w-4 h-4 text-muted-foreground" /> Search in channel
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm gap-2.5 rounded-lg py-2 focus:bg-muted/60">
                <Pin className="w-4 h-4 text-muted-foreground" /> Pinned messages
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator className="opacity-60" />
                  <DropdownMenuItem className="text-sm gap-2.5 rounded-lg py-2 text-primary focus:bg-primary/10 focus:text-primary">
                    <Shield className="w-4 h-4" /> Manage channel
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="opacity-60" />
              <DropdownMenuItem className="text-sm gap-2.5 rounded-lg py-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                <ChevronDown className="w-4 h-4" /> Leave channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Channel Info Banner (description) ───────────────────────────────── */}
      {chat.description && (
        <div className="mx-4 mt-3 flex-shrink-0">
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/25 border border-border/30 px-3.5 py-2.5">
            <Info className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{chat.description}</p>
          </div>
        </div>
      )}

      <div className="mx-4 mt-3 mb-3 flex-shrink-0">
        <button
          onClick={handleInviteMembers}
          disabled={!inviteLink}
          className="w-full flex items-center gap-3 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all duration-200 p-3.5 text-left disabled:opacity-50 disabled:pointer-events-none group"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Invite channel members</p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              Copies the invite link that lets others join instantly
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </button>
      </div>

      {!loading && !isAdmin && (
        <div className="mx-4 mb-3 flex-shrink-0">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3">
            <Lock className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Only the channel creator can publish posts here. Everyone in this
              channel can react to updates and receive new message alerts.
            </p>
          </div>
        </div>
      )}

      {/* ── Channel Posts ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto chat-messages-scroll px-3 py-4"
        style={{ paddingBottom: 60 }}
      >
        <div className="max-w-2xl mx-auto">
          {loading && messages.length === 0 ? (
            <div className="space-y-4 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3.5 w-28 rounded-full" />
                      <Skeleton className="h-2.5 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-3/4' : 'w-full'} rounded-xl`} />
                  <div className="flex justify-between items-center pt-2 border-t border-border/20">
                    <Skeleton className="h-2.5 w-12 rounded-full" />
                    <Skeleton className="h-2.5 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center animate-in fade-in-50 duration-500">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-125" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <Megaphone className="w-7 h-7 text-primary" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground tracking-tight mt-1">{chat.name}</p>
              <p className="text-xs text-muted-foreground/80 max-w-[220px] leading-relaxed">
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
                <div
                  key={item.key}
                  className="animate-in fade-in-40 slide-in-from-bottom-1 duration-200 ease-out"
                >
                  <ChannelPost
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
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Posting UI removed — channel is read-only in this build */}

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