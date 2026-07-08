import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { UserProfile } from '@/types/chat';

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onChatCreated?: (chatId: string) => void;
  mode?: 'direct' | 'group' | 'channel';
}

export function NewChatDialog({ open, onClose, onChatCreated, mode }: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogMode, setDialogMode] = useState<'direct' | 'group' | 'channel'>(mode ?? 'direct');
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
      setDialogMode(mode ?? 'direct');
      setSelectedUsers([]);
      setGroupName('');
      return;
    }

    setDialogMode(mode ?? 'direct');
    setLoading(true);
    const t = setTimeout(async () => {
      const term = search.trim().replace(/[%_,.()\"]/g, '');
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id || '')
        .eq('is_bot', false)
        .limit(20);
      if (term) {
        query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
      }
      const { data } = await query;
      setResults((data || []) as UserProfile[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open, user, mode]);

  const startDirectChat = async (otherId: string) => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('get_or_create_direct_chat', { _other_user: otherId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onChatCreated?.(data as string);
  };

  const toggleUserSelection = (profile: UserProfile) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === profile.id);
      if (exists) return prev.filter(u => u.id !== profile.id);
      return [...prev, profile];
    });
  };

  const createChat = async (type: 'group' | 'channel') => {
    if (!groupName.trim()) {
      toast.error(type === 'channel' ? 'Enter a channel name' : 'Enter a group name');
      return;
    }
    if (type === 'group' && selectedUsers.length < 1) {
      toast.error('Select at least 1 member');
      return;
    }

    setBusy(true);

    if (!user) {
      console.debug('[NewChatDialog] createChat: no authenticated user', await supabase.auth.getSession().catch(() => null));
      toast.error('You must be signed in to create this chat');
      setBusy(false);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user?.id) {
      console.error('[NewChatDialog] createChat: missing auth session', sessionError, sessionData);
      toast.error('Unable to verify your session. Please sign in again.');
      setBusy(false);
      return;
    }

    const currentUserId = sessionData.session.user.id;
    console.debug('[NewChatDialog] auth session verified', {
      currentUserId,
      hasToken: !!sessionData.session.access_token,
      expiresAt: sessionData.session.expires_at,
      refreshTokenPresent: !!sessionData.session.refresh_token,
    });
    if (user.id !== currentUserId) {
      console.warn('[NewChatDialog] auth mismatch', { contextUserId: user.id, sessionUserId: currentUserId });
    }

    const authAny = supabase.auth as any;
    if (typeof authAny.setSession === 'function' && sessionData.session.access_token) {
      const { error: setSessionError } = await authAny.setSession({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      });
      if (setSessionError) {
        console.warn('[NewChatDialog] failed to reapply session', setSessionError);
      }
    }

    let chat: any = null;
    try {
      const resp = await supabase
        .from('chats')
        .insert({ type, name: groupName.trim(), created_by: currentUserId })
        .select('id')
        .single();
      if (resp.error) {
        console.error('[NewChatDialog] createChat error', resp.error, { currentUserId, type });
        const isRlsError = resp.error.code === '42501' || /row-level security/i.test(resp.error.message || '');
        toast.error(
          isRlsError
            ? 'Permission denied. Supabase row-level security is blocking chat creation. Allow authenticated insert into chats.'
            : resp.error.message || 'Failed to create chat'
        );
        setBusy(false);
        return null;
      }
      chat = resp.data;
    } catch (err) {
      console.error('[NewChatDialog] createChat exception', err);
      try {
        const sess = await supabase.auth.getSession();
        console.debug('[NewChatDialog] session', sess);
      } catch (_) {}
      toast.error('Failed to create chat (check console for details)');
      setBusy(false);
      return null;
    }

    const members = [
      { chat_id: chat.id, user_id: currentUserId, role: 'owner' },
      ...(type === 'group'
        ? selectedUsers.map(u => ({ chat_id: chat.id, user_id: u.id, role: 'member' }))
        : []),
    ];

    const { error: membersError } = await supabase.from('chat_members').insert(members);
    if (membersError) {
      console.error('[NewChatDialog] createChat members insert error', membersError, { chatId: chat.id });
      toast.error('Chat created, but failed to add members.');
      setBusy(false);
      return chat.id;
    }

    setBusy(false);
    return chat.id;
  };

  const createGroup = async () => {
    const chatId = await createChat('group');
    if (chatId) onChatCreated?.(chatId);
  };

  const createChannel = async () => {
    const chatId = await createChat('channel');
    if (chatId) onChatCreated?.(chatId);
  };

  const initials = (n: string) => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center justify-between">
            <span>
              {dialogMode === 'group'
                ? 'New Group'
                : dialogMode === 'channel'
                  ? 'New Channel'
                  : 'New Chat'}
            </span>
            {dialogMode !== 'channel' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={() => setDialogMode(prev => (prev === 'group' ? 'direct' : 'group'))}
              >
                <Users className="w-3.5 h-3.5 mr-1" />
                {dialogMode === 'group' ? 'Direct chat' : 'Create group'}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === 'channel'
              ? 'Create a broadcast channel and become its owner.'
              : 'Search users and start a direct chat or create a new group with selected members.'}
          </DialogDescription>
        </DialogHeader>

        {/* Chat name input for groups and channels */}
        {dialogMode !== 'direct' && (
          <>
            <Input
              placeholder={dialogMode === 'channel' ? 'Channel name' : 'Group name'}
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="bg-secondary border-0"
            />
            {dialogMode === 'group' && selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map(u => (
                  <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                    {u.display_name}
                    <button onClick={() => toggleUserSelection(u)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Separator />
          </>
        )}

        {dialogMode !== 'channel' ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, name, phone or email"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-0"
              />
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto -mx-6 px-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <UserPlus className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                results.map(p => {
                  const isSelected = selectedUsers.some(u => u.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => dialogMode === 'group' ? toggleUserSelection(p) : startDirectChat(p.id)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent rounded-lg text-left transition-colors"
                    >
                      {dialogMode === 'group' && (
                        <Checkbox checked={isSelected} className="flex-shrink-0" />
                      )}
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={p.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials(p.display_name || 'U')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="py-6 px-4 text-sm text-muted-foreground">
            Channels are broadcast spaces. Create a channel name below and then invite or share it after creation.
          </div>
        )}

        {dialogMode === 'group' && selectedUsers.length > 0 && (
          <Button onClick={createGroup} disabled={busy} className="w-full gap-2">
            <Users className="w-4 h-4" />
            Create Group ({selectedUsers.length} members)
          </Button>
        )}
        {dialogMode === 'channel' && (
          <Button onClick={createChannel} disabled={busy} className="w-full gap-2">
            <Users className="w-4 h-4" />
            Create Channel
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
