import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarTabSwitcherProps {
  activeTab: 'chats' | 'status';
  onChange: (tab: 'chats' | 'status') => void;
  hasUnseenStatuses: boolean;
}

export function SidebarTabSwitcher({ activeTab, onChange, hasUnseenStatuses }: SidebarTabSwitcherProps) {
  return (
    <div className="flex items-center justify-between bg-sidebar border-b border-sidebar-border px-3 py-2">
      <button
        type="button"
        onClick={() => onChange('chats')}
        className={cn(
          'flex-1 px-3 py-2 rounded-full transition-colors duration-200',
          activeTab === 'chats'
            ? 'bg-primary/10 text-primary font-semibold shadow-inner'
            : 'text-muted-foreground hover:bg-sidebar-accent/70'
        )}
      >
        Chats
      </button>
      <button
        type="button"
        onClick={() => onChange('status')}
        className={cn(
          'relative flex-1 px-3 py-2 rounded-full transition-colors duration-200 ml-2',
          activeTab === 'status'
            ? 'bg-primary/10 text-primary font-semibold shadow-inner'
            : 'text-muted-foreground hover:bg-sidebar-accent/70'
        )}
      >
        Status
        {hasUnseenStatuses && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-unread-badge ring-1 ring-sidebar" />
        )}
      </button>
    </div>
  );
}
