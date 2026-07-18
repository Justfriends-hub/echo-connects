import { useEffect, useRef } from "react";

interface UseSwipeableTabsParams {
  activeTab: "chats" | "status";
  onChange: (tab: "chats" | "status") => void;
}

const HORIZONTAL_THRESHOLD = 2.5;
const VERTICAL_THRESHOLD = 1.5;
const COMPLETE_THRESHOLD = 0.35;
const VELOCITY_THRESHOLD = 0.35;
const TRANSITION_MS = 220;

function isButton(el: HTMLElement | null): boolean {
  if (!el) return false;
  return Boolean(
    el.closest(
      "button, [role=button], a, input, textarea, select, [data-interactive=true]",
    ),
  );
}

export function useSwipeableTabs({ activeTab, onChange }: UseSwipeableTabsParams) {
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

  const getOffset = () => (activeTab === "chats" ? 0 : -widthRef.current);

  const setTransform = (x: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : "none";
    track.style.transform = `translateX(${x}px)`;
  };

  const updateDrag = () => {
    const state = stateRef.current;
    if (!state.isTracking || !state.isHorizontalLocked) return;
    const base = getOffset();
    const dx = state.currentX - state.startX;
    const newX = Math.max(-widthRef.current, Math.min(0, base + dx));
    setTransform(newX, false);
    rafRef.current = null;
  };

  const scheduleUpdate = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(updateDrag);
  };

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    const target = e.target as HTMLElement;
    if (isButton(target)) return;

    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      startTime: Date.now(),
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
      if (absX < 8 && absY < 8) {
        state.currentX = touch.clientX;
        return;
      }

      if (absX > absY * HORIZONTAL_THRESHOLD) {
        const canSwipeLeft = activeTab === "chats";
        const canSwipeRight = activeTab === "status";
        const isSwipingLeft = dx < 0;
        const isSwipingRight = dx > 0;

        if (
          (canSwipeLeft && isSwipingLeft) ||
          (canSwipeRight && isSwipingRight)
        ) {
          state.isHorizontalLocked = true;
          state.currentX = touch.clientX;
          e.preventDefault?.();
        } else {
          state.isTracking = false;
          return;
        }
      } else if (absY > absX * VERTICAL_THRESHOLD) {
        state.isTracking = false;
        return;
      } else {
        state.currentX = touch.clientX;
        return;
      }
    }

    state.currentX = touch.clientX;
    scheduleUpdate();
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

    const dx = touch.clientX - state.startX;
    const dt = Math.max(Date.now() - state.startTime, 1);
    const velocity = dx / dt;
    const threshold = widthRef.current * COMPLETE_THRESHOLD;

    const shouldComplete =
      activeTab === "chats"
        ? dx <= -threshold || velocity <= -VELOCITY_THRESHOLD
        : dx >= threshold || velocity >= VELOCITY_THRESHOLD;

    const nextTab = activeTab === "chats" ? "status" : "chats";

    if (shouldComplete) {
      setTransform(activeTab === "chats" ? -widthRef.current : 0, true);
      setTimeout(() => {
        onChange(nextTab);
        const offset = nextTab === "chats" ? 0 : -widthRef.current;
        setTransform(offset, false);
      }, TRANSITION_MS);
    } else {
      setTransform(getOffset(), true);
      setTimeout(() => {
        setTransform(getOffset(), false);
      }, TRANSITION_MS);
    }

    state.isTracking = false;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.touchAction = "pan-y";
    container.style.userSelect = "none";
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    const updateWidth = () => {
      widthRef.current = container.clientWidth;
      if (!stateRef.current.isTracking) {
        setTransform(getOffset(), false);
      }
    };

    const obs = new ResizeObserver(updateWidth);
    obs.observe(container);
    updateWidth();

    return () => {
      obs.disconnect();
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!stateRef.current.isTracking) {
      setTransform(getOffset(), false);
    }
  }, [activeTab]);

  return { containerRef, trackRef };
}
