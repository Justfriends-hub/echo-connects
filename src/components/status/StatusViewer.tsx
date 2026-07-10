import { X } from 'lucide-react';
import { useStatusViewer } from '@/hooks/useStatusViewer';
import { StatusProgressBar } from './StatusProgressBar';
import { StatusReplyBar } from './StatusReplyBar';
import type { ContactStatusGroup } from '@/types/chat';

interface StatusViewerProps {
  group: ContactStatusGroup;
  onClose: () => void;
}

export function StatusViewer({ group, onClose }: StatusViewerProps) {
  const {
    currentStatus,
    currentGroup,
    currentIndex,
    progress,
    isPaused,
    goNext,
    goPrev,
    pause,
    resume,
  } = useStatusViewer([group]);

  if (!currentStatus || !currentGroup) return null;

  const isOwnStatus = currentStatus.user_id === group.user.id;

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
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 bg-white/10 hover:bg-white/20">
          <X className="w-5 h-5" />
        </button>
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
          <img src={currentStatus.media_url || ''} alt="status" className="mx-auto max-h-full w-full max-w-full rounded-3xl object-contain" />
        ) : (
          <video src={currentStatus.media_url || ''} controls className="mx-auto max-h-full w-full rounded-3xl object-contain" />
        )}
      </div>

      {!isOwnStatus ? (
        <StatusReplyBar onSend={async () => {}} />
      ) : (
        <div className="px-4 pb-4 text-xs text-white/70">Swipe up to see who viewed your status.</div>
      )}
    </div>
  );
}
