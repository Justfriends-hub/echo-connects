import React from "react";
import { cn } from "@/lib/utils";

interface SidebarTabSwitcherProps {
  activeTab: "chats" | "status";
  onChange: (tab: "chats" | "status") => void;
  hasUnseenStatuses: boolean;
}

export function SidebarTabSwitcher({
  activeTab,
  onChange,
  hasUnseenStatuses,
}: SidebarTabSwitcherProps) {
  return (
    /* Integrated a sleek unified navigation track mimicking premium messenger clients */
    <div className="px-4 py-2 bg-sidebar border-b border-sidebar-border/40 flex-shrink-0 select-none">
      <div
        role="tablist"
        aria-label="Sidebar view"
        className="relative flex items-center bg-muted/40 p-1 rounded-xl border border-border/20 overflow-hidden"
      >
        {/* Hardware Accelerated Sliding Accent Background Track Slider.
            Translating by 100% of the pill's own width undershoots the
            right edge here, since the pill's width (calc(50%-4px)) already
            excludes the 1px+1px inset gaps — the two don't cancel out
            across a percentage-based transform. Translating by
            calc(100% + 8px) (own width + both gaps) lands it flush. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-background rounded-lg shadow-sm border border-border/30",
            "transition-transform duration-300 ease-in-out will-change-transform",
            activeTab === "status"
              ? "translate-x-[calc(100%+8px)]"
              : "translate-x-0",
          )}
        />

        {/* Chats Selection Trigger Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "chats"}
          onClick={() => onChange("chats")}
          className={cn(
            "relative flex-1 h-11 text-xs font-bold uppercase tracking-wider text-center z-10 transition-colors duration-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "transform-gpu motion-safe:active:scale-[0.98]",
            activeTab === "chats"
              ? "text-primary"
              : "text-muted-foreground/80 hover:text-foreground",
          )}
        >
          Chats
        </button>

        {/* Status Selection Trigger Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "status"}
          onClick={() => onChange("status")}
          className={cn(
            "relative flex-1 h-11 text-xs font-bold uppercase tracking-wider text-center z-10 transition-colors duration-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "transform-gpu motion-safe:active:scale-[0.98]",
            activeTab === "status"
              ? "text-primary"
              : "text-muted-foreground/80 hover:text-foreground",
          )}
        >
          <span className="inline-flex items-center justify-center gap-1.5 relative">
            Status
            {hasUnseenStatuses && (
              /* WhatsApp style dynamic emerald ring dot */
              <span
                aria-label="Unseen statuses"
                className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background shadow-sm motion-safe:animate-in motion-safe:zoom-in-50 duration-300"
              />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
