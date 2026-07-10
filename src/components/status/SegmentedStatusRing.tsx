interface SegmentedStatusRingProps {
  totalSegments: number;
  viewedSegments: number;
  size: number;
  isOwn?: boolean;
}

export function SegmentedStatusRing({ totalSegments, viewedSegments, size, isOwn = false }: SegmentedStatusRingProps) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const gap = totalSegments > 1 ? 4 : 0;
  const segmentLength = (circumference - gap * totalSegments) / totalSegments;

  return (
    <svg width={size} height={size} className="block">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isOwn ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
        strokeWidth="4"
        opacity="0.2"
      />
      {Array.from({ length: totalSegments }).map((_, index) => {
        const isViewed = index < viewedSegments;
        const strokeColor = isOwn
          ? 'hsl(var(--primary))'
          : isViewed
            ? 'hsl(var(--muted))'
            : 'hsl(var(--online-green))';
        const dashArray = `${segmentLength} ${gap}`;
        const offset = -(index * (segmentLength + gap));

        return (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeDasharray={dashArray}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}
