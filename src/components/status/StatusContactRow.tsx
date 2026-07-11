import type { ContactStatusGroup } from "@/types/chat";
import { SegmentedStatusRing } from "./SegmentedStatusRing";

interface StatusContactRowProps {
  group: ContactStatusGroup;
  onOpen: () => void;
}

export function StatusContactRow({ group, onOpen }: StatusContactRowProps) {
  // Grab the latest status node to display its timestamp and thumbnail
  const latest = group.statuses[0];

  // Derive the preview image url: fallback to media url if it's an image status,
  // or user avatar if text-only, so something sleek always fills the ring well.
  const previewUrl = latest?.media_url || group.user.avatar_url || undefined;

  // Format timestamp safely to match modern chat applications (e.g., "11:42 AM")
  const formattedTime = latest?.created_at
    ? new Date(latest.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] border-b border-zinc-900/40 transition-all duration-200 ease-out outline-none select-none group"
    >
      {/* 
        Sleek Status Ring Wrap Container 
        The component itself internalizes image rendering to prevent layout misalignment.
      */}
      <div className="shrink-0 relative transform transition-transform duration-200 group-hover:scale-102">
        <SegmentedStatusRing
          totalSegments={group.statuses.length}
          viewedSegments={group.viewedCount}
          size={54}
          isOwn={false}
          imageUrl={previewUrl}
        />
      </div>

      {/* Primary Metadata Column Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-medium text-zinc-100 truncate group-hover:text-white transition-colors duration-150">
            {group.user.display_name || "Unknown User"}
          </p>

          <span className="text-xs text-zinc-500 whitespace-nowrap font-normal tracking-wide transition-colors duration-150 group-hover:text-zinc-400">
            {formattedTime}
          </span>
        </div>

        {/* Helper subtext detailing segment counts similar to WhatsApp context layout */}
        <p className="text-xs text-zinc-400 font-normal truncate tracking-normal">
          {group.statuses.length - group.viewedCount > 0
            ? `${group.statuses.length - group.viewedCount} new updates`
            : "Recent updates"}
        </p>
      </div>
    </button>
  );
}
