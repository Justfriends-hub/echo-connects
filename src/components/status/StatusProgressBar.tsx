interface StatusProgressBarProps {
  totalSegments: number;
  currentIndex: number;
  progress: number; // Expects float percentage value from 0 to 1
}

export function StatusProgressBar({
  totalSegments,
  currentIndex,
  progress,
}: StatusProgressBarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-1.5 px-4 pt-3 pb-5 bg-gradient-to-b from-black/80 to-transparent pointer-events-none select-none">
      {Array.from({ length: totalSegments }).map((_, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        // Calculate safe percentage values
        const currentProgressWidth = isActive
          ? Math.min(100, Math.max(0, progress * 100))
          : 0;

        return (
          <div
            key={index}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm shadow-sm"
          >
            <div
              className={`h-full rounded-full ${
                isCompleted
                  ? "bg-zinc-100 w-full transition-all duration-200 ease-out"
                  : isActive
                    ? "bg-white"
                    : "w-0 bg-transparent"
              }`}
              style={{
                // IMPORTANT: active items must bypass general CSS transitions
                // so tick-by-tick state updates stream smoothly with no layout stutter.
                width: isCompleted
                  ? "100%"
                  : isActive
                    ? `${currentProgressWidth}%`
                    : "0%",
                transition: isActive ? "none" : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
