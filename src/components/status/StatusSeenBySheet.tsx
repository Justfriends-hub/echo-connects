import { useEffect, useState } from "react";
import { X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserProfile } from "@/types/chat";

interface StatusSeenBySheetProps {
  statusId: string;
  open: boolean;
  onClose: () => void;
}

export function StatusSeenBySheet({
  statusId,
  open,
  onClose,
}: StatusSeenBySheetProps) {
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetchViews = async () => {
      const { data, error } = await supabase
        .from("status_views")
        .select(
          "viewer_id, viewer:viewer_id (id, username, display_name, avatar_url)",
        )
        .eq("status_id", statusId);
      if (error) {
        console.warn("[StatusSeenBySheet] fetch failed", error);
        setLoading(false);
        return;
      }
      setViewers((data || []).map((item: any) => item.viewer));
      setLoading(false);
    };

    fetchViews();
  }, [open, statusId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* 
        Slide-Up Bottom Sheet Card Panel
        Stops event propagation to prevent premature window dismissals on content clicks.
      */}
      <div
        className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-zinc-900 border-t sm:border border-white/5 shadow-2xl shadow-black/90 p-5 pb-8 sm:pb-6 flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-full duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tactile Interaction Handle Indicator (WhatsApp / Mobile Sheet Design) */}
        <div className="mx-auto w-12 h-1 rounded-full bg-zinc-700/60 mb-4 shrink-0" />

        {/* Dynamic Header Information Section */}
        <div className="mb-5 flex items-start justify-between shrink-0">
          <div className="flex gap-3 items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-100">Viewed by</p>
              <p className="text-xs text-zinc-400">
                {viewers.length} {viewers.length === 1 ? "person" : "people"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Presentation Canvas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
              <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-xs text-zinc-500">Loading viewers...</p>
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 gap-2">
              <p className="text-sm font-medium text-zinc-400">No views yet</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                When contacts view this status update, they will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {viewers.map((viewer) => {
                if (!viewer) return null;
                return (
                  <div
                    key={viewer.id}
                    className="flex items-center gap-4 px-3 py-3 rounded-2xl bg-transparent hover:bg-white/[0.02] active:bg-white/[0.04] border-b border-zinc-800/20 last:border-0 transition-colors duration-150 group"
                  >
                    <Avatar className="w-10 h-10 border border-white/5 shrink-0 transition-transform duration-200 group-hover:scale-102">
                      <AvatarImage
                        src={viewer.avatar_url || undefined}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                        {viewer.display_name?.slice(0, 2).toUpperCase() || "UN"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 flex flex-col">
                      <p className="text-[14px] font-medium text-zinc-200 group-hover:text-white truncate transition-colors">
                        {viewer.display_name || "Unknown User"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5 font-normal">
                        @{viewer.username || "username"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
