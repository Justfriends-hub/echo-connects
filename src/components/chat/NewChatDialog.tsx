import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { UserProfile } from '@/types/chat';

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onChatCreated?: (chatId: string) => void;
}

export function NewChatDialog({ open, onClose, onChatCreated }: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setSearch(''); setResults([]); return; }
    const t = setTimeout(async () => {
      const term = search.trim();
      let query = supabase.from('profiles').select('*').neq('id', user?.id || '').limit(20);
      if (term) {
        query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      const { data } = await query;
      setResults((data || []) as UserProfile[]);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open, user]);

  const startChat = async (otherId: string) => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)('get_or_create_direct_chat', { _other_user: otherId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onChatCreated?.(data as string);
  };

  const initials = (n: string) => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username, name or phone"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto -mx-6 px-2">
          {results.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <UserPlus className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                onClick={() => startChat(p.id)}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent rounded-lg text-left transition-colors"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={p.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials(p.display_name || 'U')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
