import React, { useState, useEffect } from 'react';
import { Check, X, Clock, MessageSquare, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingComment {
  id: string;
  content: string;
  user_id: string;
  message_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  username?: string;
  display_name?: string;
}

export function CommentApprovalQueue() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [filter]);

  const fetchComments = async () => {
    setLoading(true);
    let query = supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50);
    
    if (filter === 'pending') {
      query = query.eq('status', 'pending');
    }

    const { data } = await query;
    setComments((data as PendingComment[]) || []);
    setLoading(false);
  };

  const handleAction = async (commentId: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('comments')
      .update({ status: action })
      .eq('id', commentId);

    if (error) {
      toast.error('Failed to update comment');
      return;
    }

    setComments(prev => prev.map(c => c.id === commentId ? { ...c, status: action } : c));
    toast.success(action === 'approved' ? 'Comment approved' : 'Comment rejected');
  };

  // Demo data
  const demoComments: PendingComment[] = comments.length > 0 ? comments : [
    {
      id: 'dc1', content: 'This is amazing! 🔥 When is the next update dropping?', user_id: 'u1',
      message_id: 'm1', created_at: new Date(Date.now() - 300000).toISOString(), status: 'pending',
      display_name: 'Sarah K.', username: 'sarah_k',
    },
    {
      id: 'dc2', content: 'Can you do a tutorial on this topic?', user_id: 'u2',
      message_id: 'm1', created_at: new Date(Date.now() - 600000).toISOString(), status: 'pending',
      display_name: 'Mike O.', username: 'mike_o',
    },
    {
      id: 'dc3', content: 'First! Great content as always 👏', user_id: 'u3',
      message_id: 'm2', created_at: new Date(Date.now() - 1800000).toISOString(), status: 'pending',
      display_name: 'Tunde A.', username: 'tunde_a',
    },
  ];

  const pendingCount = demoComments.filter(c => c.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Hidden Queue Banner */}
      <Card className="bg-destructive/5 border-destructive/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Eye className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Hidden Approval Queue</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Users see their comments as "posted" but they remain invisible to others until approved. 
              This queue is invisible to regular users and channel admins.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter & Count */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? '' : 'border-border text-muted-foreground'}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                {pendingCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? '' : 'border-border text-muted-foreground'}
          >
            All
          </Button>
        </div>
      </div>

      {/* Comment List */}
      <div className="space-y-2">
        {demoComments.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending comments</p>
            </CardContent>
          </Card>
        ) : (
          demoComments.map(comment => (
            <Card key={comment.id} className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {(comment.display_name || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {comment.display_name || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        @{comment.username || 'user'}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ml-auto ${
                          comment.status === 'pending' ? 'border-yellow-500/50 text-yellow-500' :
                          comment.status === 'approved' ? 'border-online text-online' :
                          'border-destructive text-destructive'
                        }`}
                      >
                        {comment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1">{comment.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                      {comment.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-online hover:text-online hover:bg-online/10"
                            onClick={() => handleAction(comment.id, 'approved')}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleAction(comment.id, 'rejected')}
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
