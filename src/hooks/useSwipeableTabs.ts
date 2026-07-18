import { useEffect, useRef } from "react";

interface UseSwipeableTabsParams {
  activeTab: "chats" | "status";
  onChange: (tab: "chats" | "status") => void;
}

const HORIZONTAL_LOCK_RATIO = 2.5; // Must move 2.5x more horizontally than vertically to lock as horizontal
const VERTICAL_LOCK_RATIO = 1.5;   // If vertical movement exceeds this ratio, pass through as scroll
const COMPLETION_THRESHOLD = 0.35; // 35–40% of screen width to trigger completion
const VELOCITY_THRESHOLD = 0.35;   // pixels/ms
const TRANSITION_DURATION = 220;   // ms for ease-out snap/completion

export function useSwipeableTabs({
  activeTab,
  onChange,
}: UseSwipeableTabsParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    startTime: 0,
    touchId: -1,
    isTracking: false,
    isHorizontalLocked: false,
  });

  const widthRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const activeTabRef = useRef(activeTab);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const getBaseOffset = () =>
    activeTabRef.current === "chats" ? 0 : -widthRef.current;

  const setTransform = (x: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${TRANSITION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : "none";
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const clampTranslate = (x: number) =>
    Math.max(-widthRef.current, Math.min(0, x));

  const updateDragTransform = () => {
    const state = stateRef.current;
    if (!state.isTracking || !state.isHorizontalLocked) {
      rafRef.current = null;
      return;
    }
    const base = getBaseOffset();
    const dx = state.currentX - state.startX;
    const newX = clampTranslate(base + dx);
    setTransform(newX, false);
    rafRef.current = null;
  };

  const scheduleUpdate = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(updateDragTransform);
  };

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    widthRef.current = Math.max(
      containerRef.current?.getBoundingClientRect().width ?? 0,
      window.innerWidth,
    );

    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      startTime: performance.now(),
      touchId: touch.identifier,
      isTracking: true,
      isHorizontalLocked: false,
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    const state = stateRef.current;
    if (!state.isTracking) return;

    const touch = Array.from(e.touches).find((t) => t.identifier === state.touchId);
    if (!touch) return;

    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!state.isHorizontalLocked) {
      // Hysteresis: wait for at least 8px of movement before deciding
      if (absX < 8 && absY < 8) {
        state.currentX = touch.clientX;
        return;
      }

      // Check if this is primarily horizontal
      if (absX > absY * HORIZONTAL_LOCK_RATIO) {
        // Directional check: only allow swipes in valid directions
        const canSwipeLeft = activeTabRef.current === "chats";
        const canSwipeRight = activeTabRef.current === "status";
        const isDraggingLeft = dx < 0;
        const isDraggingRight = dx > 0;

        if ((canSwipeLeft && isDraggingLeft) || (canSwipeRight && isDraggingRight)) {
          state.isHorizontalLocked = true;
          // Downgrade to non-passive to allow preventDefault
          // we always use passive=false to allow horizontal swipe prevention
        } else {
          // Wrong direction or not allowed, abandon tracking
          state.isTracking = false;
          return;
        }
      } else if (absY > absX * VERTICAL_LOCK_RATIO) {
        // Primarily vertical: let it be a normal scroll
        state.isTracking = false;
        return;
      } else {
        // Ambiguous, wait for more data
        state.currentX = touch.clientX;
        return;
      }
    }

    // Horizontal lock is engaged: update drag position and schedule RAF update
    state.currentX = touch.clientX;
    scheduleUpdate();

    // Prevent default only if we're locked in horizontal mode
    if (state.isHorizontalLocked && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const state = stateRef.current;
    if (!state.isTracking) return;

    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === state.touchId,
    );
    if (!touch) {
      state.isTracking = false;
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!state.isHorizontalLocked) {
      state.isTracking = false;
      return;
    }

    // Calculate velocity and distance to decide completion
    const dx = touch.clientX - state.startX;
    const dt = Math.max(performance.now() - state.startTime, 1);
    const velocity = dx / dt;
    const threshold = widthRef.current * COMPLETION_THRESHOLD;

    const shouldComplete =
      activeTabRef.current === "chats"
        ? dx <= -threshold || velocity <= -VELOCITY_THRESHOLD
        : dx >= threshold || velocity >= VELOCITY_THRESHOLD;

    const oldTab = activeTabRef.current;
    const nextTab = oldTab === "chats" ? "status" : "chats";

    if (shouldComplete) {
      // Complete the transition
      const finalTranslate =
        oldTab === "chats" ? -widthRef.current : 0;
      setTransform(finalTranslate, true);

      // After transition completes, update state and reset transform for next interaction
      setTimeout(() => {
        if (onChangeRef.current) {
          activeTabRef.current = nextTab;
          onChangeRef.current(nextTab);
        }
        // Now reset transform to base offset for the new active tab
        const newBase = nextTab === "chats" ? 0 : -widthRef.current;
        setTransform(newBase, false);
      }, TRANSITION_DURATION);
    } else {
      // Snap back to original tab
      setTransform(getBaseOffset(), true);
      setTimeout(() => {
        setTransform(getBaseOffset(), false);
      }, TRANSITION_DURATION);
    }

    state.isTracking = false;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.touchAction = "pan-y";
    container.style.userSelect = "none";
    container.style.willChange = "transform";

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    const handleResize = () => {
        widthRef.current = Math.max(container.getBoundingClientRect().width, window.innerWidth);
        // Ensure the track and child panels use fixed pixel widths (avoid percent-based recalculation/stretching)
        const track = trackRef.current;
        if (track) {
          track.style.width = `${widthRef.current * 2}px`;
          for (const child of Array.from(track.children) as HTMLElement[]) {
            child.style.width = `${widthRef.current}px`;
            child.style.minWidth = `${widthRef.current}px`;
          }
        }

        // Reset position if not actively tracking
        if (!stateRef.current.isTracking) {
          setTransform(getBaseOffset(), false);
        }
    };

    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);
    handleResize();

    return () => {
      resizeObs.disconnect();
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove, {
        passive: false,
      } as AddEventListenerOptions);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // When activeTab changes externally (via tap), update transform without animation
  useEffect(() => {
    if (!stateRef.current.isTracking) {
      widthRef.current = Math.max(
        containerRef.current?.getBoundingClientRect().width ?? 0,
        window.innerWidth,
      );
      setTransform(getBaseOffset(), false);
    }
  }, [activeTab]);

  return { containerRef, trackRef };
}
