import { useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { useStatuses } from '@/hooks/useStatuses';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusContactRow } from './StatusContactRow';
import { StatusViewer } from './StatusViewer';
import type { ContactStatusGroup } from '@/types/chat';

interface StatusListViewProps {
  onOpenComposer: () => void;
}

export function StatusListView({ onOpenComposer }: StatusListViewProps) {
  const { myStatuses, recentUpdates, viewedUpdates, hasUnseenStatuses, isLoading, isError, refetch } = useStatuses();
  const [activeGroup, setActiveGroup] = useState<ContactStatusGroup | null>(null);

  const latestStatus = myStatuses[0];
  const hasOwnStatuses = myStatuses.length > 0;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div>
          <p className="text-sm font-semibold">Status</p>
          <p className="text-xs text-muted-foreground">Updates from your contacts</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-14 h-14">
              <AvatarImage src={latestStatus?.media_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                {latestStatus ? 'Me' : 'Me'}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={onOpenComposer}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">My Status</p>
            <p className="text-xs text-muted-foreground truncate">
              {hasOwnStatuses ? 'Tap to view your updates' : 'No status yet. Add one.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-16 rounded-xl bg-sidebar-accent" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">Unable to load statuses.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recent updates
            </div>
            {recentUpdates.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">No recent updates</div>
            ) : (
              <div className="space-y-2">
                {recentUpdates.map((group) => (
                  <StatusContactRow key={group.user.id} group={group} onOpen={() => setActiveGroup(group)} />
                ))}
              </div>
            )}

            <Separator className="my-3" />
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Viewed updates
            </div>
            {viewedUpdates.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">No viewed updates</div>
            ) : (
              <div className="space-y-2">
                {viewedUpdates.map((group) => (
                  <StatusContactRow key={group.user.id} group={group} onOpen={() => setActiveGroup(group)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {activeGroup && (
        <StatusViewer group={activeGroup} onClose={() => setActiveGroup(null)} />
      )}
    </div>
  );
}
