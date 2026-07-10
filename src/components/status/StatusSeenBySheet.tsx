import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/types/chat';

interface StatusSeenBySheetProps {
  statusId: string;
  open: boolean;
  onClose: () => void;
}

export function StatusSeenBySheet({ statusId, open, onClose }: StatusSeenBySheetProps) {
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetchViews = async () => {
      const { data, error } = await supabase
        .from('status_views')
        .select('viewer_id, viewer:viewer_id (id, username, display_name, avatar_url)')
        .eq('status_id', statusId);
      if (error) {
        console.warn('[StatusSeenBySheet] fetch failed', error);
        setLoading(false);
        return;
      }
      setViewers((data || []).map((item: any) => item.viewer));
      setLoading(false);
    };

    fetchViews();
  }, [open, statusId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Seen by</p>
            <p className="text-sm text-muted-foreground">People who viewed this status</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 bg-muted-foreground/10 hover:bg-muted-foreground/20">
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : viewers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No viewers yet</p>
        ) : (
          <div className="space-y-3">
            {viewers.map((viewer) => (
              <div key={viewer.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={viewer.avatar_url} />
                  <AvatarFallback>{viewer.display_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{viewer.display_name}</p>
                  <p className="text-sm text-muted-foreground">{viewer.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
