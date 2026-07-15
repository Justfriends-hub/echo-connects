import React, { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Mail,
  Phone,
  Calendar,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import type { Chat } from "@/types/chat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface ChatInfoSheetProps {
  open: boolean;
  onClose: () => void;
  chat: Chat;
}

export function ChatInfoSheet({ open, onClose, chat }: ChatInfoSheetProps) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const typeLabel =
    chat.type === "direct"
      ? "Direct Message"
      : chat.type === "group"
        ? "Group Chat"
        : "Channel";

  useEffect(() => {
    let mounted = true;
    const loadInviteCode = async () => {
      if (!open || chat.type !== 'channel') {
        setInviteCode(null);
        return;
      }
      setLoadingInvite(true);
      const { data, error } = await supabase
        .from('channel_settings')
        .select('invite_code')
        .eq('chat_id', chat.id)
        .maybeSingle();

      if (!mounted) return;
      if (!error && data?.invite_code) {
        setInviteCode(data.invite_code);
      } else {
        setInviteCode(null);
      }
      setLoadingInvite(false);
    };

    loadInviteCode();

    return () => {
      mounted = false;
    };
  }, [chat.id, chat.type, open]);

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  };

  const handleRegenerateInvite = async () => {
    if (chat.type !== 'channel' || !inviteCode) return;

    setRegenerating(true);
    const { data, error } = await supabase.rpc('regenerate_channel_invite_code', { chat_id: chat.id });
    setRegenerating(false);

    if (error || !data) {
      toast.error('Unable to regenerate invite code');
      return;
    }

    setInviteCode(data as string);
    toast.success('Invite link regenerated');
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-card/95 backdrop-blur-md border-l border-border/60 w-80 sm:w-[400px] overflow-y-auto p-0 scrollbar-none select-none">
        {/* Sleek Minimal Header */}
        <SheetHeader className="text-left px-5 pt-5 pb-2">
          <SheetTitle className="text-foreground text-lg font-bold tracking-tight">
            Chat Info
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-6 mt-4">
          {/* Hero Profile Card with Integrated Ring Well */}
          <div className="flex flex-col items-center text-center bg-muted/30 border border-border/40 rounded-2xl p-5 transition-all duration-300 hover:bg-muted/40">
            <div className="relative mb-3 group">
              {/* Status Ring Well Integration */}
              <div
                className={`p-[3px] rounded-full transition-all duration-300 ${chat.is_online ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-card" : "ring-1 ring-border/80"}`}
              >
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-inner">
                  <AspectRatio ratio={1}>
                    <Avatar className="w-full h-full transform transition-transform duration-500 group-hover:scale-105">
                      <AvatarImage
                        src={chat.avatar_url}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold w-full h-full flex items-center justify-center">
                        {getInitials(chat.name || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </AspectRatio>
                </div>
              </div>
              {/* Dynamic Status Pill overlay inside the ring baseline */}
              {chat.is_online && (
                <span className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
              )}
            </div>

            <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1">
              {chat.name || "Unknown"}
            </h3>

            <div className="flex items-center gap-2 mt-1.5">
              <Badge
                variant="secondary"
                className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 bg-secondary/80 border border-border/20"
              >
                {typeLabel}
              </Badge>
              {chat.is_online && (
                <span className="text-[11px] font-medium text-emerald-500">
                  Active now
                </span>
              )}
            </div>
          </div>

          <Separator className="opacity-60" />

          {/* Details / About Sections configured as clean row cards */}
          <div className="space-y-4">
            {chat.description && (
              <div className="space-y-1 bg-muted/20 border border-border/30 rounded-xl p-3.5">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                  About
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                  {chat.description}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-2 px-1">
                Details
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs bg-muted/20 border border-border/30 hover:border-border/60 transition-colors p-3 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground font-medium text-[10px]">
                      Chat Type
                    </span>
                    <span className="text-foreground font-semibold mt-0.5">
                      {typeLabel}
                    </span>
                  </div>
                </div>

                {(chat.type === "group" || chat.type === "channel") && (
                  <div className="flex items-center gap-3 text-xs bg-muted/20 border border-border/30 hover:border-border/60 transition-colors p-3 rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium text-[10px]">
                        Community
                      </span>
                      <span className="text-foreground font-semibold mt-0.5">
                        {chat.member_count || 0} members
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs bg-muted/20 border border-border/30 hover:border-border/60 transition-colors p-3 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground font-medium text-[10px]">
                      Created On
                    </span>
                    <span className="text-foreground font-semibold mt-0.5">
                      {format(new Date(chat.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="opacity-60" />

          {chat.type === 'channel' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                  Invite Link
                </p>
                <span className="text-[10px] font-semibold text-primary/80">Share with your community</span>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 space-y-3">
                <div className="text-xs text-muted-foreground">
                  A secure invite link lets people join this channel directly.
                </div>
                <div className="rounded-2xl bg-background border border-border px-3 py-2 text-sm text-foreground break-all">
                  {loadingInvite ? 'Loading invite...' : inviteUrl || 'No invite available'}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    className="flex-1 min-w-[140px]"
                    onClick={handleCopyInvite}
                    disabled={!inviteUrl || loadingInvite}
                  >
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[140px]"
                    onClick={handleRegenerateInvite}
                    disabled={!inviteUrl || loadingInvite}
                    loading={regenerating}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator className="opacity-60" />

          {/* WhatsApp-style Grid Shared Media Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
                Shared Media
              </p>
              <span className="text-[10px] font-semibold text-primary/80 hover:text-primary cursor-pointer transition-colors">
                See all
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="group relative aspect-square rounded-xl bg-muted/40 border border-border/40 hover:border-border/80 flex flex-col items-center justify-center transition-all duration-300 hover:bg-muted/60 active:scale-95 cursor-pointer overflow-hidden"
                >
                  <div className="p-2 rounded-full bg-background/50 text-muted-foreground/60 transition-transform duration-300 group-hover:scale-110">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground/70 mt-1">
                    Empty
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
