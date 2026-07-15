import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Link2, LogIn, UserPlus } from 'lucide-react';

interface ChannelPreview {
  chatId: string;
  name: string;
  avatar_url?: string | null;
  description?: string | null;
  memberCount: number;
}

export default function JoinChannel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadPreview = async () => {
      if (!inviteCode) {
        if (mounted) {
          setInvalid(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setInvalid(false);
      setPreview(null);

      try {
        const { data: settings, error: settingsError } = await supabase.rpc(
          'get_channel_preview_by_invite',
          { _invite_code: inviteCode },
        );

        if (settingsError || !settings?.chat_id) {
          if (mounted) {
            setInvalid(true);
            setLoading(false);
          }
          return;
        }

        const chatId = settings.chat_id;

        const [{ data: chat, error: chatError }, { count: membersCount, error: membersError }] =
          await Promise.all([
            supabase
              .from('chats')
              .select('id, name, avatar_url, description')
              .eq('id', chatId)
              .maybeSingle(),
            supabase
              .from('chat_members')
              .select('id', { count: 'exact', head: true })
              .eq('chat_id', chatId),
          ]);

        if (chatError || membersError || !chat) {
          if (mounted) {
            setInvalid(true);
            setLoading(false);
          }
          return;
        }

        if (!mounted) return;

        setPreview({
          chatId: chat.id,
          name: chat.name || 'Channel',
          avatar_url: chat.avatar_url,
          description: chat.description || null,
          memberCount: membersCount ?? 0,
        });

        if (user) {
          const { data: membership } = await supabase
            .from('chat_members')
            .select('role')
            .eq('chat_id', chatId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (membership) {
            navigate(`/?activeChat=${chatId}`, { replace: true });
            return;
          }
        }
      } catch (error) {
        console.warn('[JoinChannel] failed to load invite preview', error);
        if (mounted) setInvalid(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPreview();
    return () => {
      mounted = false;
    };
  }, [inviteCode, navigate, user]);

  const handleJoin = async () => {
    if (!preview || !user) return;
    setJoinLoading(true);
    const { error } = await supabase.from('chat_members').insert({
      chat_id: preview.chatId,
      user_id: user.id,
      role: 'member',
    });
    setJoinLoading(false);

    if (error) {
      console.error('[JoinChannel] join failed', error);
      toast.error('Unable to join channel. Please try again.');
      return;
    }

    navigate(`/?activeChat=${preview.chatId}`, { replace: true });
  };

  const handleSignIn = () => {
    navigate(`/login?invite=${inviteCode}`);
  };

  const handleSignUp = () => {
    navigate(`/auth?invite=${inviteCode}`);
  };

  const inviteLink = `${window.location.origin}/join/${inviteCode}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-xl overflow-hidden">
        <div className="px-6 py-6 border-b border-border bg-secondary/60">
          <h1 className="text-2xl font-semibold text-foreground">Channel invite</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join this channel instantly using the secure invite link.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-56" />
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invalid ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <LogIn className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">This invite link is invalid or expired.</h2>
              <p className="text-sm text-muted-foreground mt-2">
                The channel invite code does not match any active channel.
              </p>
            </div>
          ) : preview ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 ring-2 ring-primary/25">
                  {preview.avatar_url ? (
                    <AvatarImage src={preview.avatar_url} />
                  ) : (
                    <AvatarFallback>{preview.name.slice(0, 2)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-foreground truncate">{preview.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {preview.memberCount.toLocaleString()} members
                  </p>
                </div>
              </div>

              {preview.description && (
                <div className="rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                  {preview.description}
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-muted/50 p-4 text-xs text-muted-foreground">
                Sharing this link gives anyone access to the channel preview. Only the invite code can open it.
              </div>

              <Separator className="opacity-60" />

              {user ? (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={handleJoin}
                    loading={joinLoading}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join channel
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => navigator.clipboard.writeText(inviteLink).then(() => toast.success('Invite link copied'))}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Copy invite link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" onClick={handleSignIn}>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign in to join
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={handleSignUp}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Create an account to join
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
