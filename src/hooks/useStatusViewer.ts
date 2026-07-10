import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ContactStatusGroup, Status } from '@/types/chat';

const AUTO_ADVANCE_MS = 5000;

function getStatusAt(groups: ContactStatusGroup[], groupIndex: number, statusIndex: number) {
  const group = groups[groupIndex];
  return group?.statuses[statusIndex] || null;
}

export function useStatusViewer(groups: ContactStatusGroup[]) {
  const { user } = useAuth();
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [seenByList, setSeenByList] = useState<string[]>([]);

  const currentGroup = groups[currentGroupIndex] || null;
  const currentStatus = useMemo(() => getStatusAt(groups, currentGroupIndex, currentStatusIndex), [groups, currentGroupIndex, currentStatusIndex]);
  const isVideoStatus = currentStatus?.media_type === 'video';

  const resetProgress = useCallback(() => setProgress(0), []);

  useEffect(() => {
    resetProgress();
    setIsPaused(false);
  }, [currentGroupIndex, currentStatusIndex, resetProgress]);

  useEffect(() => {
    if (!currentStatus || isPaused || isVideoStatus) return;

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.04;
        if (next >= 1) {
          return 1;
        }
        return next;
      });
    }, AUTO_ADVANCE_MS / 25);

    return () => window.clearInterval(interval);
  }, [currentStatus, isPaused, isVideoStatus]);

  useEffect(() => {
    if (progress < 1 || !currentStatus) return;
    const timer = window.setTimeout(() => {
      setProgress(0);
      if (currentGroup && currentStatusIndex < currentGroup.statuses.length - 1) {
        setCurrentStatusIndex((idx) => idx + 1);
      } else {
        setCurrentGroupIndex((idx) => Math.min(idx + 1, groups.length - 1));
        setCurrentStatusIndex(0);
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [progress, currentGroup, currentStatusIndex, groups.length]);

  useEffect(() => {
    if (!currentStatus || !user) return;
    if (currentStatus.user_id === user.id) return;

    const recordView = async () => {
      await supabase.from('status_views').upsert({
        status_id: currentStatus.id,
        viewer_id: user.id,
        viewed_at: new Date().toISOString(),
      });
    };

    recordView().catch(() => {
      // ignore recording errors for playback
    });
  }, [currentStatus, user]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (currentStatusIndex < currentGroup.statuses.length - 1) {
      setCurrentStatusIndex((idx) => idx + 1);
      return;
    }
    setCurrentGroupIndex((idx) => Math.min(idx + 1, groups.length - 1));
    setCurrentStatusIndex(0);
  }, [currentGroup, currentStatusIndex, groups.length]);

  const goPrev = useCallback(() => {
    if (currentStatusIndex > 0) {
      setCurrentStatusIndex((idx) => idx - 1);
      return;
    }
    if (currentGroupIndex > 0) {
      const previousGroup = groups[currentGroupIndex - 1];
      setCurrentGroupIndex((idx) => idx - 1);
      setCurrentStatusIndex(previousGroup.statuses.length - 1);
    }
  }, [currentGroupIndex, currentStatusIndex, groups]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const close = useCallback(() => {
    setCurrentGroupIndex(0);
    setCurrentStatusIndex(0);
    setProgress(0);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (!groups.length) {
      setCurrentGroupIndex(0);
      setCurrentStatusIndex(0);
    } else if (currentGroupIndex >= groups.length) {
      setCurrentGroupIndex(Math.max(0, groups.length - 1));
      setCurrentStatusIndex(0);
    }
  }, [groups, currentGroupIndex]);

  const setStatusProgress = useCallback((value: number) => {
    setProgress(value);
  }, []);

  return {
    currentStatus,
    currentGroup,
    currentIndex: currentStatusIndex,
    progress,
    isPaused,
    goNext,
    goPrev,
    pause,
    resume,
    close,
    setStatusProgress,
    seenByList,
  };
}
