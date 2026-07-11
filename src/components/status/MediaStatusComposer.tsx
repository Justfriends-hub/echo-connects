import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusComposer } from "@/hooks/useStatusComposer";
import type { StatusMediaType } from "@/types/chat";
import { Loader2, Send, X } from "lucide-react";

interface MediaStatusComposerProps {
  file: File;
  mediaType: StatusMediaType;
  onClose: () => void;
}

export function MediaStatusComposer({
  file,
  mediaType,
  onClose,
}: MediaStatusComposerProps) {
  const { postMediaStatus } = useStatusComposer();
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleSend = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      await postMediaStatus(file, caption, mediaType);
      onClose();
    } catch (error) {
      console.error("Failed to post status:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative flex flex-1 flex-col h-full w-full bg-zinc-950 text-zinc-100 select-none animate-in fade-in duration-200">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between px-4 py-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onClose}
          disabled={uploading}
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-zinc-300">
          Status preview
        </span>
        <div className="w-10" /> {/* Spacer to balance the close button */}
      </div>

      {/* Main Immersive Media Preview Canvas */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6 min-h-0">
        <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl shadow-black/50 bg-zinc-900/40 border border-white/5">
          {mediaType === "video" ? (
            <video
              src={fileUrl}
              controls
              className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 ease-out"
            />
          ) : (
            <img
              src={fileUrl}
              alt="Status preview"
              className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 ease-out"
            />
          )}
        </div>
      </div>

      {/* Bottom Actions Area (WhatsApp Style Floating Caption) */}
      <div className="relative px-4 pb-8 pt-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
        <div className="flex items-center gap-3 max-w-3xl mx-auto bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full pl-5 pr-2 py-1.5 shadow-lg focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all duration-200">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            disabled={uploading}
            className="flex-1 bg-transparent border-0 p-0 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-base"
          />

          <Button
            size="icon"
            onClick={handleSend}
            disabled={uploading}
            className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 text-white shadow-md hover:scale-105 active:scale-95 disabled:scale-100 transition-all shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            ) : (
              <Send className="h-4 w-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
