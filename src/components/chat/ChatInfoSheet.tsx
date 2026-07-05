import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Phone, Calendar, MessageCircle } from 'lucide-react';
import type { Chat } from '@/types/chat';
import { format } from 'date-fns';

interface ChatInfoSheetProps {
  open: boolean;
  onClose: () => void;
  chat: Chat;
}

export function ChatInfoSheet({ open, onClose, chat }: ChatInfoSheetProps) {
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const typeLabel = chat.type === 'direct' ? 'Direct Message' : chat.type === 'group' ? 'Group Chat' : 'Channel';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-card border-border w-80 sm:w-96 overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-foreground">Chat Info</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden">
              <AspectRatio ratio={1}>
                <Avatar className="w-full h-full">
                  <AvatarImage src={chat.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl w-full h-full">
                    {getInitials(chat.name || 'U')}
                  </AvatarFallback>
                </Avatar>
              </AspectRatio>
            </div>
            <h3 className="text-lg font-semibold text-foreground mt-3">{chat.name || 'Unknown'}</h3>
            <Badge variant="secondary" className="mt-1 text-xs">{typeLabel}</Badge>
            {chat.is_online && (
              <span className="text-xs text-online mt-1">● Online</span>
            )}
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-3">
            {chat.description && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">About</p>
                <p className="text-sm text-foreground">{chat.description}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{typeLabel}</span>
            </div>

            {(chat.type === 'group' || chat.type === 'channel') && (
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{chat.member_count || 0} members</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">
                Created {format(new Date(chat.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <Separator />

          {/* Shared Media Placeholder */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Shared Media</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-square rounded-lg bg-secondary flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">No media</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
