import { useEffect, useState, type SyntheticEvent } from "react";
import {
  X,
  Eye,
  MoreHorizontal,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStatusViewer } from "@/hooks/useStatusViewer";
import { StatusProgressBar } from "./StatusProgressBar";
import { StatusReplyBar } from "./StatusReplyBar";
import { StatusSeenBySheet } from "./StatusSeenBySheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ContactStatusGroup } from "@/types/chat";

interface StatusViewerProps {
  group: ContactStatusGroup;
  onClose: () => void;
}

export function StatusViewer({ group, onClose }: StatusViewerProps) {
  const { user } = useAuth();
  const [showSeenBy, setShowSeenBy] = useState(false);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    currentStatus,
    currentGroup,
    currentIndex,
    progress,
    isPaused,
    goNext,
    goPrev, // Added fallback logic or capability for backward taps if supported by hook
    pause,
    resume,
    setStatusProgress,
  } = useStatusViewer([group]);

  useEffect(() => {
    if (!currentStatus || currentStatus.media_type === "text") {
      setMediaSrc(null);
      return;
    }

    if (!currentStatus.media_path) {
      setMediaSrc(null);
      return;
    }

    let cancelled = false;

    const loadMedia = async () => {
      const { data, error } = await supabase.storage
        .from("status-media")
        .createSignedUrl(currentStatus.media_path, 3600);

      if (cancelled) return;

      if (error) {
        console.error("[StatusViewer] createSignedUrl failed", error);
        setMediaSrc(currentStatus.signed_url || null);
        return;
      }

      const signedUrl =
        (data as any)?.signedUrl ?? (data as any)?.signed_url ?? null;
      setMediaSrc(signedUrl || currentStatus.signed_url || null);
    };

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [
    currentStatus?.id,
    currentStatus?.media_path,
    currentStatus?.media_type,
    currentStatus?.signed_url,
  ]);

  if (!currentStatus || !currentGroup) return null;

  const isOwnStatus = currentStatus.user_id === group.user.id;
  const mediaSource = mediaSrc || currentStatus.signed_url || "";
  const canDownload = Boolean(
    mediaSource && currentStatus.media_type !== "text",
  );

  const handleDownload = async () => {
    if (!canDownload || !currentStatus.media_path) {
      toast.error("No downloadable media available");
      return;
    }

    try {
      const filename =
        currentStatus.media_path.split("/").pop() || "status-media";
      const response = await fetch(mediaSource);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      console.error("[StatusViewer] download failed", error);
      toast.error("Failed to download status");
    }
  };

  const handleDeleteStatus = async () => {
    if (!isOwnStatus || !user) {
      toast.error("Only the owner can delete this status");
      return;
    }

    const { error } = await supabase
      .from("statuses")
      .delete()
      .eq("id", currentStatus.id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[StatusViewer] delete status failed", error);
      toast.error("Failed to delete status");
      return;
    }

    toast.success("Status deleted");
    setIsDeleteDialogOpen(false);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const handleVideoTimeUpdate = (
    event: React.SyntheticEvent<HTMLVideoElement, Event>,
  ) => {
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) return;
    setStatusProgress(video.currentTime / video.duration);
  };

  const handleVideoEnded = () => {
    setStatusProgress(1);
    goNext();
  };

  const handleVideoLoadedMetadata = (
    event: React.SyntheticEvent<HTMLVideoElement, Event>,
  ) => {
    const duration = event.currentTarget.duration;
    if (!Number.isNaN(duration) && duration > 0) {
      setVideoDuration(duration);
    }
  };

  const handleSendReply = async (message: string) => {
    if (!user) {
      toast.error("Please sign in to reply.");
      return;
    }
    try {
      const { data: chatId, error: chatError } = await supabase.rpc(
        "get_or_create_direct_chat",
        { _other_user: group.user.id },
      );
      if (chatError || !chatId) {
        throw chatError || new Error("Unable to create chat");
      }

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId as string,
          sender_id: user.id,
          content: message,
          type: "text",
          status: "sent",
        });

      if (messageError) {
        throw messageError;
      }

      toast.success("Reply sent");
      onClose();
    } catch (error) {
      console.error("[StatusViewer] send reply failed", error);
      toast.error("Failed to send reply");
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-neutral-950/98 text-white backdrop-blur-md font-sans select-none animate-in fade-in duration-200">
      {/* Top Header Controls Overlay */}
      <div className="relative z-20 w-full max-w-xl mx-auto pt-3 px-4 flex flex-col gap-2.5">
        <StatusProgressBar
          totalSegments={currentGroup.statuses.length}
          currentIndex={currentIndex}
          progress={progress}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Smooth Avatar Wrapper */}
            <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/10">
              <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-950 flex items-center justify-center text-sm font-bold tracking-wider text-emerald-400">
                {group.user.display_name?.slice(0, 2).toUpperCase() || "??"}
              </div>
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-semibold tracking-wide text-neutral-100">
                {group.user.display_name || "Unknown"}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
                <span>
                  {new Date(currentStatus.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {currentStatus.media_type === "video" &&
                  videoDuration !== null && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-neutral-600" />
                      <span>{formatDuration(videoDuration)}</span>
                    </>
                  )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isOwnStatus && (
              <button
                type="button"
                onClick={() => setShowSeenBy(true)}
                className="rounded-full p-2.5 text-neutral-300 transition-all duration-200 hover:bg-white/10 active:scale-95"
                aria-label="Show viewers"
              >
                <Eye className="w-[22px] h-[22px]" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-2.5 text-neutral-300 transition-all duration-200 hover:bg-white/10 active:scale-95"
                  aria-label="Status actions"
                >
                  <MoreHorizontal className="w-[22px] h-[22px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-neutral-900/95 backdrop-blur-md border-neutral-800 text-neutral-200 rounded-xl shadow-xl min-w-[140px]"
              >
                <DropdownMenuItem
                  className="text-sm gap-2.5 py-2.5 focus:bg-white/10 cursor-pointer"
                  onSelect={handleDownload}
                >
                  <Download className="h-4 w-4 text-neutral-400" />
                  <span>Download</span>
                </DropdownMenuItem>
                {isOwnStatus && (
                  <DropdownMenuItem
                    className="text-sm gap-2.5 py-2.5 focus:bg-destructive/20 text-red-400 focus:text-red-400 cursor-pointer"
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2.5 text-neutral-300 transition-all duration-200 hover:bg-white/10 active:scale-95"
              aria-label="Close status viewer"
            >
              <X className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Immersive Display Panel */}
      <div className="relative flex-1 w-full max-w-xl mx-auto flex items-center justify-center px-2 py-4">
        {/* Invisible Interactive Side-Tap Zones for Navigation */}
        <div
          className="absolute inset-y-0 left-0 w-1/4 z-30 cursor-w-resize"
          onClick={(e) => {
            e.stopPropagation();
            goPrev ? goPrev() : null;
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/4 z-30 cursor-e-resize"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        />

        <div
          className="relative w-full h-full max-h-[82vh] flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-900/40 shadow-2xl border border-white/5 transition-all duration-300"
          onTouchStart={pause}
          onTouchEnd={resume}
          onClick={goNext}
        >
          {currentStatus.media_type === "text" ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-xl md:text-2xl font-medium leading-relaxed tracking-wide select-text">
              <p className="max-w-md drop-shadow-md whitespace-pre-wrap">
                {currentStatus.text_content}
              </p>
            </div>
          ) : currentStatus.media_type === "image" ? (
            mediaSource ? (
              <img
                src={mediaSource}
                alt="status content"
                className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400 gap-2">
                <p className="text-sm font-medium">Unable to load image</p>
              </div>
            )
          ) : mediaSource ? (
            <video
              src={mediaSource}
              controls={false}
              autoPlay
              playsInline
              className="w-full h-full object-contain pointer-events-none"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onLoadedMetadata={handleVideoLoadedMetadata}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-400 gap-2">
              <p className="text-sm font-medium">Unable to load video</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Reply / Metadata Segment */}
      <div className="relative z-20 w-full max-w-xl mx-auto pb-6 px-4 flex flex-col items-center justify-end">
        {!isOwnStatus ? (
          <div className="w-full animate-in slide-in-from-bottom-4 duration-300">
            <StatusReplyBar onSend={handleSendReply} />
          </div>
        ) : (
          <div
            onClick={() => setShowSeenBy(true)}
            className="flex flex-col items-center gap-1 py-2 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200 cursor-pointer active:scale-98"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-400 rotate-90 animate-pulse" />
            <span className="text-[11px] font-medium tracking-wider text-neutral-300 uppercase">
              Swipe up or tap to see viewers
            </span>
          </div>
        )}
      </div>

      {/* Sheets & Floating Overlays */}
      {showSeenBy && (
        <StatusSeenBySheet
          statusId={currentStatus.id}
          open={showSeenBy}
          onClose={() => setShowSeenBy(false)}
        />
      )}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-sm rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold tracking-wide">
              Delete status?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400 text-sm leading-normal">
              This will remove the status permanently and delete the associated
              media file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2.5 pt-4">
            <AlertDialogCancel className="border border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-800 hover:text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              onClick={handleDeleteStatus}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
