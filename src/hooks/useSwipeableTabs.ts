import { useEffect, useRef } from "react";

type TabName = "chats" | "status";

interface UseSwipeableTabsParams {
  activeTab: TabName;
  onChange: (tab: TabName) => void;
}

const HORIZONTAL_LOCK_RATIO = 2.5;
const VERTICAL_LOCK_RATIO = 1.5;
const DRAG_THRESHOLD_RATIO = 0.35;
const VELOCITY_THRESHOLD = 0.35; // px / ms
const TRANSITION_DURATION = 220;

function isInteractiveElement(target: HTMLElement | null) {
  if (!target) return false;
  return Boolean(
    target.closest(
      "button, [role=button], a, input, textarea, select, [contenteditable=true], [contenteditable='true']",
    ),
  );
}

export function useSwipeableTabs({ activeTab, onChange }: UseSwipeableTabsParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<TabName>(activeTab);
  const onChangeRef = useRef(onChange);
  const widthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const touchMovePassiveRef = useRef(true);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    touchId: -1,
    isTracking: false,
    isSwiping: false,
    currentX: 0,
  });

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const currentBaseOffset = () =>
    activeTabRef.current === "chats" ? 0 : -widthRef.current;

  const setTransform = (translateX: number, animate = false) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${TRANSITION_DURATION}ms cubic-bezier(.22,.61,.36,1)`
      : "none";
    track.style.transform = `translate3d(${translateX}px, 0, 0)`;
  };

  const clampTranslate = (translateX: number) =>
    Math.min(0, Math.max(translateX, -widthRef.current));

  const updateWrapperTransform = () => {
    const gesture = gestureRef.current;
    if (!gesture.isSwiping) return;
    const base = currentBaseOffset();
    setTransform(clampTranslate(base + (gesture.currentX - gesture.startX)), false);
    rafRef.current = null;
  };

  const scheduleUpdate = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(updateWrapperTransform);
  };

  const resetTouchMoveListener = (passive: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    container.removeEventListener("touchmove", handleTouchMove, { passive: true } as AddEventListenerOptions);
    container.removeEventListener("touchmove", handleTouchMove, { passive: false } as AddEventListenerOptions);
    container.addEventListener("touchmove", handleTouchMove, { passive });
    touchMovePassiveRef.current = passive;
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const target = event.target as HTMLElement | null;
    if (isInteractiveElement(target)) return;

    widthRef.current = containerRef.current?.clientWidth ?? window.innerWidth;
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: performance.now(),
      touchId: touch.identifier,
      isTracking: true,
      isSwiping: false,
      currentX: touch.clientX,
    };
  };

  const handleTouchMove = (event: TouchEvent) => {
    const gesture = gestureRef.current;
    if (!gesture.isTracking) return;
    const touch = Array.from(event.touches).find(
      (current) => current.identifier === gesture.touchId,
    );
    if (!touch) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!gesture.isSwiping) {
      if (absX < 6 && absY < 6) {
        gesture.currentX = touch.clientX;
        return;
      }

      if (absX > absY * HORIZONTAL_LOCK_RATIO) {
        const allowedDirection =
          activeTabRef.current === "chats" ? dx < 0 : dx > 0;
        if (!allowedDirection) {
          gesture.isTracking = false;
          return;
        }

        gesture.isSwiping = true;
        gesture.currentX = touch.clientX;
        if (touchMovePassiveRef.current) {
          resetTouchMoveListener(false);
        }
      } else if (absY > absX * VERTICAL_LOCK_RATIO) {
        gesture.isTracking = false;
        return;
      } else {
        gesture.currentX = touch.clientX;
        return;
      }
    }

    if (gesture.isSwiping) {
      gesture.currentX = touch.clientX;
      scheduleUpdate();
      if (!touchMovePassiveRef.current && event.cancelable) {
        event.preventDefault();
      }
    }
  };

  const finishGesture = (willComplete: boolean) => {
    const oldTab = activeTabRef.current;
    const nextTab = oldTab === "chats" ? "status" : "chats";
    const finalTranslate = willComplete
      ? oldTab === "chats"
        ? -widthRef.current
        : 0
      : currentBaseOffset();

    setTransform(finalTranslate, true);

    if (willComplete) {
      window.setTimeout(() => {
        if (onChangeRef.current) {
          onChangeRef.current(nextTab);
        }
        activeTabRef.current = nextTab;
        const track = trackRef.current;
        if (track) {
          track.style.transition = "none";
          track.style.transform = `translate3d(${currentBaseOffset()}px, 0, 0)`;
        }
      }, TRANSITION_DURATION);
    } else {
      const track = trackRef.current;
      if (track) {
        window.setTimeout(() => {
          track.style.transition = "none";
        }, TRANSITION_DURATION);
      }
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const gesture = gestureRef.current;
    if (!gesture.isTracking) return;
    const touch = Array.from(event.changedTouches).find(
      (current) => current.identifier === gesture.touchId,
    );
    if (!touch) {
      gesture.isTracking = false;
      gesture.isSwiping = false;
      return;
    }

    if (!gesture.isSwiping) {
      gesture.isTracking = false;
      return;
    }

    const dx = touch.clientX - gesture.startX;
    const dt = Math.max(performance.now() - gesture.startTime, 1);
    const velocity = dx / dt;
    const threshold = widthRef.current * DRAG_THRESHOLD_RATIO;
    const shouldComplete =
      activeTabRef.current === "chats"
        ? dx <= -threshold || velocity <= -VELOCITY_THRESHOLD
        : dx >= threshold || velocity >= VELOCITY_THRESHOLD;

    gesture.isTracking = false;
    gesture.isSwiping = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    finishGesture(shouldComplete);
    if (!touchMovePassiveRef.current) {
      resetTouchMoveListener(true);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.touchAction = "pan-y";
    container.style.willChange = "transform";
    container.style.overflow = "hidden";

    const handleResize = () => {
      widthRef.current = container.clientWidth;
      if (!gestureRef.current.isSwiping) {
        setTransform(currentBaseOffset(), false);
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    window.addEventListener("resize", handleResize);

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    resetTouchMoveListener(true);
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    handleResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove, {
        passive: true,
      } as AddEventListenerOptions);
      container.removeEventListener("touchmove", handleTouchMove, {
        passive: false,
      } as AddEventListenerOptions);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gestureRef.current.isSwiping) {
      setTransform(currentBaseOffset(), false);
    }
  }, [activeTab]);

  return {
    containerRef,
    trackRef,
  };
}
