import { ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ContactStatusGroup } from '@/types/chat';
import { SegmentedStatusRing } from './SegmentedStatusRing';

interface StatusContactRowProps {
  group: ContactStatusGroup;
  onOpen: () => void;
}

export function StatusContactRow({ group, onOpen }: StatusContactRowProps) {
  const latest = group.statuses[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-2xl bg-sidebar-accent/70 px-3 py-3 text-left transition-colors hover:bg-sidebar-accent"
    >
      <div className="relative">
        <SegmentedStatusRing
          totalSegments={group.statuses.length}
          viewedSegments={group.viewedCount}
          size={56}
          isOwn={false}
        />
        <Avatar className="absolute inset-2 w-12 h-12">
          <AvatarImage src={group.user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
            {group.user.display_name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{group.user.display_name || 'Unknown'}</p>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground truncate">{latest?.created_at ? new Date(latest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
      </div>
    </button>
  );
}
