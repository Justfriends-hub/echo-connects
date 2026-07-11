import { User } from "lucide-react";

interface SegmentedStatusRingProps {
  totalSegments: number;
  viewedSegments: number;
  size: number;
  isOwn?: boolean;
  imageUrl?: string; // Preview of the last status or user profile
}

export function SegmentedStatusRing({
  totalSegments,
  viewedSegments,
  size,
  isOwn = false,
  imageUrl,
}: SegmentedStatusRingProps) {
  const strokeWidth = 3; // Slimmer, sleeker WhatsApp-style stroke
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // High-end spacing calculations
  const gap = totalSegments > 1 ? (totalSegments > 5 ? 3 : 5) : 0;

  // When using strokeLinecap="round", the caps extend by strokeWidth.
  // We subtract it from the path length to prevent overlapping.
  const rawSegmentLength =
    (circumference - gap * totalSegments) / totalSegments;
  const segmentLength =
    totalSegments > 1
      ? Math.max(0.1, rawSegmentLength - strokeWidth)
      : rawSegmentLength;
  const actualGap = totalSegments > 1 ? gap + strokeWidth : gap;

  // Colors mapping directly to WhatsApp's dark mode aesthetic
  // Unviewed = vibrant emerald teal, Viewed = clean muted slate zinc
  const activeColor = isOwn ? "#10b981" : "#059669"; // Emerald-500 / Emerald-600
  const viewedColor = "rgba(255, 255, 255, 0.15)"; // Muted semi-transparent white
  const baseRingColor = "rgba(255, 255, 255, 0.05)";

  return (
    <div
      className="relative flex items-center justify-center select-none group cursor-pointer"
      style={{ width: size, height: size }}
    >
      {/* Immersive Center Content Container */}
      <div
        className="absolute overflow-hidden rounded-full bg-zinc-900 flex items-center justify-center transition-transform duration-300 ease-out group-hover:scale-95"
        style={{
          width: size - (strokeWidth * 2 + 6), // Creates a perfect clean 3px padding gap inside the ring
          height: size - (strokeWidth * 2 + 6),
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Status preview"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
            <User className="w-1/2 h-1/2 min-w-[16px] min-h-[16px]" />
          </div>
        )}
      </div>

      {/* SVG Status Ring Layer */}
      <svg
        width={size}
        height={size}
        className="block -rotate-90 transition-transform duration-500 ease-out group-hover:rotate-0"
      >
        {/* Background track layer for smooth depth */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={baseRingColor}
          strokeWidth={strokeWidth}
        />

        {Array.from({ length: totalSegments }).map((_, index) => {
          // WhatsApp loops segments clockwise.
          // index < viewedSegments marks the oldest statuses as read.
          const isViewed = index < viewedSegments;
          const strokeColor = isViewed ? viewedColor : activeColor;

          const dashArray = `${segmentLength} ${actualGap}`;
          // Dynamic offset positioning each segment precisely around the perimeter
          const offset = -(index * (segmentLength + actualGap));

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={offset}
              strokeLinecap={totalSegments > 1 ? "round" : "butt"}
              className="transition-all duration-300 ease-in-out"
              style={{
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
