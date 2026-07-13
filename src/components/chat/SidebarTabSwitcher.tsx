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
      <div className="relative flex items-center bg-muted/40 p-1 rounded-xl border border-border/20 overflow-hidden">
        {/* Hardware Accelerated Sliding Accent Background Track Slider */}
        <div
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-background rounded-lg shadow-sm border border-border/30",
            "transition-transform duration-300 ease-in-out will-change-transform",
            activeTab === "status" ? "translate-x-full" : "translate-x-0",
          )}
        />

        {/* Chats Selection Trigger Tab */}
        <button
          type="button"
          onClick={() => onChange("chats")}
          className={cn(
            "relative flex-1 py-2 text-xs font-bold uppercase tracking-wider text-center z-10 transition-colors duration-200 focus:outline-none",
            "transform active:scale-[0.98]",
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
          onClick={() => onChange("status")}
          className={cn(
            "relative flex-1 py-2 text-xs font-bold uppercase tracking-wider text-center z-10 transition-colors duration-200 focus:outline-none",
            "transform active:scale-[0.98]",
            activeTab === "status"
              ? "text-primary"
              : "text-muted-foreground/80 hover:text-foreground",
          )}
        >
          <span className="inline-flex items-center justify-center gap-1.5 relative">
            Status
            {hasUnseenStatuses && (
              /* WhatsApp style dynamic emerald ring dot that scales up seamlessly */
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background shadow-sm animate-in zoom-in-50 duration-300" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
