interface StatusProgressBarProps {
  totalSegments: number;
  currentIndex: number;
  progress: number;
}

export function StatusProgressBar({ totalSegments, currentIndex, progress }: StatusProgressBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {Array.from({ length: totalSegments }).map((_, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        return (
          <div key={index} className="flex-1 overflow-hidden rounded-full bg-white/20 h-1">
            <div
              className={`h-1 transition-all duration-150 ${isCompleted ? 'bg-white' : isActive ? 'bg-white' : 'bg-white/30'}`}
              style={{ width: isCompleted ? '100%' : isActive ? `${Math.round(progress * 100)}%` : '100%' }}
            />
          </div>
        );
      })}
    </div>
  );
}
