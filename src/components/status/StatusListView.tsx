import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { useStatuses } from "@/hooks/useStatuses";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusContactRow } from "./StatusContactRow";
import { StatusViewer } from "./StatusViewer";
import { SegmentedStatusRing } from "./SegmentedStatusRing";
import type { ContactStatusGroup } from "@/types/chat";

interface StatusListViewProps {
  onOpenComposer?: () => void;
}

export function StatusListView({ onOpenComposer }: StatusListViewProps) {
  const {
    myStatuses,
    recentUpdates,
    viewedUpdates,
    hasUnseenStatuses,
    isLoading,
    isError,
    refetch,
  } = useStatuses();
  const [activeGroup, setActiveGroup] = useState<ContactStatusGroup | null>(
    null,
  );
  const [showUploadedBadge, setShowUploadedBadge] = useState(false);
  const prevMyIdsRef = useRef<string[]>([]);

  const latestStatus = myStatuses[0];
  const hasOwnStatuses = myStatuses.length > 0;

  // Derive the preview URL exactly like StatusContactRow to match your system aesthetics
  const myPreviewUrl =
    latestStatus?.signed_url || latestStatus?.user?.avatar_url || undefined;

  // Detect optimistic -> real upload transition to show a quick "Uploaded" badge
  useEffect(() => {
    const prev = prevMyIdsRef.current || [];
    const current = myStatuses.map((s) => s.id);
    const hadTempBefore = prev.some(
      (id) =>
        id && (id as string).startsWith && (id as string).startsWith("local-"),
    );
    const hasTempNow = current.some(
      (id) =>
        id && (id as string).startsWith && (id as string).startsWith("local-"),
    );
    if (hadTempBefore && !hasTempNow) {
      setShowUploadedBadge(true);
      const t = setTimeout(() => setShowUploadedBadge(false), 1800);
      return () => clearTimeout(t);
    }
    prevMyIdsRef.current = current as string[];
    return undefined;
  }, [myStatuses]);

  const handleMyStatusClick = () => {
    if (hasOwnStatuses) {
      setActiveGroup({
        user: myStatuses[0].user,
        statuses: myStatuses,
        latestAt: myStatuses[0]?.created_at || "",
        totalCount: myStatuses.length,
        viewedCount: 0,
        allViewed: false,
      } as any);
    } else if (onOpenComposer) {
      onOpenComposer();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 select-none animate-in fade-in duration-200">
      {/* Top Header Layout */}
      <div className="flex items-center justify-between px-4 py-4 bg-zinc-900/40 border-b border-white/5 backdrop-blur-md">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Status</h2>
          <p className="text-xs text-zinc-400">Updates from your contacts</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCcw className="w-4 h-4 transition-transform active:rotate-180 duration-300" />
        </Button>
      </div>

      {/* Main Updates Stream Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* "My Status" Header Row Container */}
        <div className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors duration-200">
          <div className="relative shrink-0">
            <div
              role="button"
              tabIndex={0}
              onClick={handleMyStatusClick}
              className={`outline-none transition-transform duration-200 active:scale-95 ${
                myStatuses.some((s) => String(s.id).startsWith("local-"))
                  ? "animate-pulse"
                  : ""
              }`}
              aria-label="Open my status"
            >
              {/* Integrated Segmented Status Ring for absolute design harmony */}
              <SegmentedStatusRing
                totalSegments={hasOwnStatuses ? myStatuses.length : 1}
                viewedSegments={hasOwnStatuses ? 0 : 1} // Unviewed color highlights if self-statuses exist
                size={54}
                isOwn={hasOwnStatuses}
                imageUrl={myPreviewUrl}
              />
            </div>

            {/* Smooth Floating Add Plus Overlay Trigger */}
            <button
              type="button"
              onClick={onOpenComposer}
              aria-label="Add status"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md hover:bg-emerald-600 active:scale-90 transition-all border-2 border-zinc-950"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>

            {/* Micro Floating Upload Transition Badge */}
            {showUploadedBadge && (
              <div className="absolute -top-2 -left-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-in zoom-in-50 duration-200">
                Uploaded
              </div>
            )}
          </div>

          <div
            className="flex-1 min-w-0 flex flex-col gap-0.5 cursor-pointer"
            onClick={handleMyStatusClick}
          >
            <p className="font-medium text-[15px] text-zinc-100">My status</p>
            <p className="text-xs text-zinc-400 truncate">
              {hasOwnStatuses
                ? "Tap to view your updates"
                : "No status yet. Add one."}
            </p>
          </div>
        </div>

        {/* Status Lists Content Wrapper */}
        <div className="py-2">
          {isLoading ? (
            <div className="px-4 space-y-4 animate-pulse">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-900" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 bg-zinc-900 rounded" />
                    <div className="h-2 w-1/2 bg-zinc-900 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-zinc-400 gap-3">
              <p className="text-sm">Unable to load status updates.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-300"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Recent Active Updates List */}
              <div className="mt-2">
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                  Recent updates
                </div>
                {recentUpdates.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-zinc-500">
                    No recent updates available
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-900/10">
                    {recentUpdates.map((group) => (
                      <StatusContactRow
                        key={group.user.id}
                        group={group}
                        onOpen={() => setActiveGroup(group)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-4 bg-zinc-900/60" />

              {/* Viewed / Read Updates List */}
              <div>
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  Viewed updates
                </div>
                {viewedUpdates.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-zinc-500">
                    No viewed updates available
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-900/10">
                    {viewedUpdates.map((group) => (
                      <StatusContactRow
                        key={group.user.id}
                        group={group}
                        onOpen={() => setActiveGroup(group)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full Screen Immersive Status Presentation Viewer */}
      {activeGroup && (
        <StatusViewer
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
        />
      )}
    </div>
  );
}
