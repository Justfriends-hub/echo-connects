import { useEffect, useState, type SyntheticEvent } from 'react';
import { X, Eye, MoreHorizontal, Download, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStatusViewer } from '@/hooks/useStatusViewer';
import { StatusProgressBar } from './StatusProgressBar';
import { StatusReplyBar } from './StatusReplyBar';
import { StatusSeenBySheet } from './StatusSeenBySheet';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ContactStatusGroup } from '@/types/chat';

interface StatusViewerProps {
  group: ContactStatusGroup;
  onClose: () => void;
}

export function StatusViewer({ group, onClose }: StatusViewerProps) {
  const { user } = useAuth();
  const [showSeenBy, setShowSeenBy] = useState(false);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    currentStatus,
    currentGroup,
    currentIndex,
    progress,
    isPaused,
    goNext,
    pause,
    resume,
    setStatusProgress,
  } = useStatusViewer([group]);

  useEffect(() => {
    if (!currentStatus || currentStatus.media_type === 'text') {
      setMediaSrc(null);
      return;
    }

    if (!currentStatus.media_path) {
      setMediaSrc(null);
      return;
    }

    let cancelled = false;

    const loadMedia = async () => {
      const { data, error } = await supabase
        .storage
        .from('status-media')
        .createSignedUrl(currentStatus.media_path, 3600);

      if (cancelled) return;

      if (error) {
        console.error('[StatusViewer] createSignedUrl failed', error);
        setMediaSrc(currentStatus.signed_url || null);
        return;
      }

      const signedUrl = (data as any)?.signedUrl ?? (data as any)?.signed_url ?? null;
      setMediaSrc(signedUrl || currentStatus.signed_url || null);
    };

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [currentStatus?.id, currentStatus?.media_path, currentStatus?.media_type, currentStatus?.signed_url]);

  if (!currentStatus || !currentGroup) return null;

  const isOwnStatus = currentStatus.user_id === group.user.id;
  const mediaSource = mediaSrc || currentStatus.signed_url || '';
  const canDownload = Boolean(mediaSource && currentStatus.media_type !== 'text');

  const handleDownload = async () => {
    if (!canDownload || !currentStatus.media_path) {
      toast.error('No downloadable media available');
      return;
    }

    try {
      const filename = currentStatus.media_path.split('/').pop() || 'status-media';
      const response = await fetch(mediaSource);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('[StatusViewer] download failed', error);
      toast.error('Failed to download status');
    }
  };

  const handleDeleteStatus = async () => {
    if (!isOwnStatus || !user) {
      toast.error('Only the owner can delete this status');
      return;
    }

    const { error } = await supabase.from('statuses').delete().eq('id', currentStatus.id).eq('user_id', user.id);
    if (error) {
      console.error('[StatusViewer] delete status failed', error);
      toast.error('Failed to delete status');
      return;
    }

    toast.success('Status deleted');
    setIsDeleteDialogOpen(false);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) return;
    setStatusProgress(video.currentTime / video.duration);
  };

  const handleVideoEnded = () => {
    setStatusProgress(1);
    goNext();
  };

  const handleVideoLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const duration = event.currentTarget.duration;
    if (!Number.isNaN(duration) && duration > 0) {
      setVideoDuration(duration);
    }
  };

  const handleSendReply = async (message: string) => {
    if (!user) {
      toast.error('Please sign in to reply.');
      return;
    }
    try {
      const { data: chatId, error: chatError } = await supabase.rpc('get_or_create_direct_chat', { _other_user: group.user.id });
      if (chatError || !chatId) {
        throw chatError || new Error('Unable to create chat');
      }

      const { error: messageError } = await supabase
        .from('messages')
        .insert({ chat_id: chatId as string, sender_id: user.id, content: message, type: 'text', status: 'sent' });

      if (messageError) {
        throw messageError;
      }

      toast.success('Reply sent');
      onClose();
    } catch (error) {
      console.error('[StatusViewer] send reply failed', error);
      toast.error('Failed to send reply');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm">
            {group.user.display_name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{group.user.display_name || 'Unknown'}</p>
            <p className="text-xs text-white/70">{new Date(currentStatus.created_at).toLocaleString()}</p>
            {currentStatus.media_type === 'video' && videoDuration !== null && (
              <p className="text-xs text-white/70">Duration: {formatDuration(videoDuration)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnStatus && (
            <button
              type="button"
              onClick={() => setShowSeenBy(true)}
              className="rounded-full p-2 bg-white/10 hover:bg-white/20"
              aria-label="Show viewers"
            >
              <Eye className="w-5 h-5" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full p-2 bg-white/10 hover:bg-white/20"
                aria-label="Status actions"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem className="text-sm gap-2" onSelect={handleDownload}>
                <Download className="h-4 w-4" />
                Download
              </DropdownMenuItem>
              {isOwnStatus && (
                <DropdownMenuItem className="text-sm gap-2 text-destructive" onSelect={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={onClose} className="rounded-full p-2 bg-white/10 hover:bg-white/20" aria-label="Close status viewer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <StatusProgressBar totalSegments={currentGroup.statuses.length} currentIndex={currentIndex} progress={progress} />

      <div
        className="flex-1 px-4 py-4"
        onTouchStart={pause}
        onTouchEnd={resume}
        onClick={goNext}
      >
        {currentStatus.media_type === 'text' ? (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-lg leading-relaxed text-white">
            <p>{currentStatus.text_content}</p>
          </div>
        ) : currentStatus.media_type === 'image' ? (
          mediaSource ? (
            <img src={mediaSource} alt="status" className="mx-auto w-full max-w-full rounded-3xl object-contain max-h-[calc(80vh_-_20px)]" />
          ) : (
            <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-lg leading-relaxed text-white">
              <p>Unable to load image.</p>
            </div>
          )
        ) : mediaSource ? (
          <video
            src={mediaSource}
            controls
            className="mx-auto w-full rounded-3xl object-contain max-h-[calc(80vh_-_20px)]"
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            onLoadedMetadata={handleVideoLoadedMetadata}
          />
        ) : (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-lg leading-relaxed text-white">
            <p>Unable to load video.</p>
          </div>
        )}
      </div>

      {!isOwnStatus ? (
        <StatusReplyBar onSend={handleSendReply} />
      ) : (
        <div className="px-4 pb-4 text-xs text-white/70">Tap the eye icon to see who viewed this status.</div>
      )}

      {showSeenBy && (
        <StatusSeenBySheet statusId={currentStatus.id} open={showSeenBy} onClose={() => setShowSeenBy(false)} />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete status?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the status permanently and delete the associated media.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel className="border border-border px-4 py-2 rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white px-4 py-2 rounded-md" onClick={handleDeleteStatus}>
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
