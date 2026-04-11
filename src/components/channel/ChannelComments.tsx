import React, { useState, useEffect } from 'react';
import { X, Send, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  status: string;
  display_name?: string;
}

interface ChannelCommentsProps {
  messageId: string;
  chatId: string;
  onClose: () => void;
}

const REQUIRED_AD_WATCHES = 10;

export function ChannelComments({ messageId, chatId, onClose }: ChannelCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [adWatchCount, setAdWatchCount] = useState(0);
  const [canComment, setCanComment] = useState(false);
  const [showAdPrompt, setShowAdPrompt] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
    if (user) checkAdWatchStatus();
  }, [messageId, user]);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) || []);
    setLoading(false);
  };

  const checkAdWatchStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ad_watches')
      .select('watch_count')
      .eq('user_id', user.id)
      .eq('channel_id', chatId)
      .maybeSingle();
    
    const count = data?.watch_count || 0;
    setAdWatchCount(count);
    setCanComment(count >= REQUIRED_AD_WATCHES);
  };

  const simulateAdWatch = async () => {
    if (!user) return;
    setWatchingAd(true);
    
    // Simulate watching an ad (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newCount = adWatchCount + 1;

    const { error } = await supabase.from('ad_watches').upsert({
      user_id: user.id,
      channel_id: chatId,
      watch_count: newCount,
    }, { onConflict: 'user_id,channel_id' } as any);

    setAdWatchCount(newCount);
    setCanComment(newCount >= REQUIRED_AD_WATCHES);
    setWatchingAd(false);
    
    if (newCount >= REQUIRED_AD_WATCHES) {
      toast.success('You can now comment!');
      setShowAdPrompt(false);
    } else {
      toast.info(`${REQUIRED_AD_WATCHES - newCount} more ads to watch`);
    }
  };

  const submitComment = async () => {
    if (!user || !newComment.trim()) return;
    
    if (!canComment) {
      setShowAdPrompt(true);
      return;
    }

    const { error } = await supabase.from('comments').insert({
      message_id: messageId,
      user_id: user.id,
      content: newComment.trim(),
      status: 'pending', // Always pending - hidden from user
    });

    if (error) {
      toast.error('Failed to post comment');
      return;
    }

    // User sees their own comment as if it's posted (but it's actually pending approval)
    setComments(prev => [...prev, {
      id: `temp-${Date.now()}`,
      content: newComment.trim(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      status: 'pending',
      display_name: 'You',
    }]);
    setNewComment('');
    toast.success('Comment posted!'); // Users think it's live, but it's pending
  };

  // Demo comments
  const displayComments = comments.length > 0 ? comments : [
    { id: 'dc1', content: 'Great article! 🔥', user_id: 'u1', created_at: new Date(Date.now() - 3600000).toISOString(), status: 'approved', display_name: 'Chidi N.' },
    { id: 'dc2', content: 'Thanks for sharing this', user_id: 'u2', created_at: new Date(Date.now() - 1800000).toISOString(), status: 'approved', display_name: 'Amaka O.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:relative md:inset-auto md:w-80 md:border-l md:border-border">
      {/* Overlay on mobile */}
      <div className="absolute inset-0 bg-background/80 md:hidden" onClick={onClose} />

      <div className="relative w-80 h-full bg-card flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Comments</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Comments List */}
        <ScrollArea className="flex-1 px-3 py-2">
          {displayComments
            .filter(c => c.status === 'approved' || c.user_id === user?.id)
            .map(comment => (
              <div key={comment.id} className="flex gap-2 mb-3">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {(comment.display_name || 'U')[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{comment.display_name || 'User'}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
        </ScrollArea>

        {/* Ad Gate Prompt */}
        {showAdPrompt && !canComment && (
          <div className="p-3 bg-muted/50 border-t border-border animate-fade-in">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Watch ads to comment</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {REQUIRED_AD_WATCHES - adWatchCount} more ads needed
                </p>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${(adWatchCount / REQUIRED_AD_WATCHES) * 100}%` }}
                  />
                </div>
                <Button
                  size="sm"
                  className="mt-2 h-7 text-xs w-full"
                  onClick={simulateAdWatch}
                  disabled={watchingAd}
                >
                  {watchingAd ? (
                    <span className="animate-pulse-soft">Watching ad...</span>
                  ) : (
                    <>
                      <Play className="w-3 h-3 mr-1" />
                      Watch Ad ({adWatchCount}/{REQUIRED_AD_WATCHES})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Comment Input */}
        <div className="flex items-center gap-2 p-3 border-t border-border">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
            placeholder={canComment ? 'Write a comment...' : 'Watch ads to comment'}
            className="flex-1 bg-secondary rounded-full px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={submitComment}
            disabled={!newComment.trim()}
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
