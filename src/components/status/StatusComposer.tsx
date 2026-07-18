import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Camera, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextStatusComposer } from "./TextStatusComposer";
import { MediaStatusComposer } from "./MediaStatusComposer";
import type { StatusMediaType } from "@/types/chat";

interface StatusComposerProps {
  open: boolean;
  onClose: () => void;
}

export function StatusComposer({ open, onClose }: StatusComposerProps) {
  const [mode, setMode] = useState<"entry" | "text" | "media">("entry");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<StatusMediaType>("image");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanly teardown and reset state values when closed
  useEffect(() => {
    if (!open) {
      setMode("entry");
      setSelectedFile(null);
    }
  }, [open]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setMediaType(file.type.startsWith("video") ? "video" : "image");
    setMode("media");
  };

  const chooseMedia = () => {
    fileInputRef.current?.click();
  };

  const reset = () => {
    setMode("entry");
    setSelectedFile(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none animate-in fade-in duration-200">
      {/* Shared WhatsApp Header Layout (Only rendered during entry state) */}
      {mode === "entry" && (
        <div
          className="flex items-center gap-4 px-4 py-4 bg-zinc-900/40 border-b border-white/5 backdrop-blur-md animate-in slide-in-from-top-4 duration-300"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={mode === "entry" ? onClose : reset}
            className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-zinc-100">
              Create status
            </h2>
            <p className="text-xs text-zinc-400">
              Choose media or write a text update
            </p>
          </div>
        </div>
      )}

      {/* Main Container Content Canvas */}
      <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-zinc-900/20 via-zinc-950 to-zinc-950">
        {mode === "entry" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            {/* Visual Action Button: Text Variant */}
            <button
              onClick={() => setMode("text")}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                <Type className="h-6 w-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-zinc-100">
                  Text status
                </span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Share what is on your mind with clean colors
                </span>
              </div>
            </button>

            {/* Visual Action Button: Camera / Video Variant */}
            <button
              onClick={chooseMedia}
              className="group w-full flex items-center gap-5 p-5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <Camera className="h-6 w-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-zinc-100">
                  Photo / Video status
                </span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Upload rich images or capture real moments
                </span>
              </div>
            </button>

            {/* Native Hidden File Input Controller */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : mode === "text" ? (
          <div className="flex flex-1 flex-col h-full animate-in fade-in duration-300">
            <TextStatusComposer onClose={onClose} />
          </div>
        ) : (
          selectedFile && (
            <div className="flex flex-1 flex-col h-full animate-in fade-in duration-300">
              <MediaStatusComposer
                file={selectedFile}
                mediaType={mediaType}
                onClose={onClose}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
