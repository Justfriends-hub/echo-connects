import { useState } from "react";
import { Palette, X, Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStatusComposer } from "@/hooks/useStatusComposer";
import { StatusPrivacySettings } from "./StatusPrivacySettings";

const COLORS = [
  "#1B5E20",
  "#0D47A1",
  "#4A148C",
  "#BF360C",
  "#1A237E",
  "#263238",
];

interface TextStatusComposerProps {
  onClose: () => void;
}

export function TextStatusComposer({ onClose }: TextStatusComposerProps) {
  const { postTextStatus, getPrivacyPreference, setPrivacyPreference } =
    useStatusComposer();
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [sending, setSending] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);

  const privacyMode = getPrivacyPreference();

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    await postTextStatus(text.trim(), bgColor);
    setSending(false);
    onClose();
  };

  const cycleColor = () => {
    const currentIndex = COLORS.indexOf(bgColor);
    const nextIndex = (currentIndex + 1) % COLORS.length;
    setBgColor(COLORS[nextIndex]);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col transition-colors duration-500 ease-out text-white select-none font-sans"
        style={{ backgroundColor: bgColor }}
      >
        {/* Floating Smooth Action Bar */}
        <div
          className="w-full max-w-xl mx-auto flex items-center justify-between px-4 py-4 z-10"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2.5 bg-black/10 backdrop-blur-md transition-all active:scale-95 hover:bg-black/20"
            aria-label="Close composer"
          >
            <X className="w-5 h-5 text-white/90" />
          </button>

          <div className="flex items-center gap-2">
            {/* WhatsApp Color Cycle Button */}
            <button
              type="button"
              onClick={cycleColor}
              className="rounded-full p-2.5 bg-black/10 backdrop-blur-md transition-all active:scale-95 hover:bg-black/20"
              aria-label="Change color"
            >
              <Palette className="w-5 h-5 text-white/90" />
            </button>

            <button
              type="button"
              onClick={() => setShowPrivacySettings(true)}
              className="rounded-full p-2.5 bg-black/10 backdrop-blur-md transition-all active:scale-95 hover:bg-black/20"
              aria-label="Privacy settings"
            >
              <Shield className="w-5 h-5 text-white/90" />
            </button>
          </div>
        </div>

        {/* Immersive Central Input Workspace */}
        <div className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-center px-6 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a status..."
            rows={4}
            maxLength={700}
            className="w-full bg-transparent text-center text-2xl md:text-3xl font-medium placeholder:text-white/40 focus:outline-none resize-none overflow-y-auto whitespace-pre-wrap leading-relaxed tracking-wide transition-all caret-white drop-shadow-sm select-text px-2"
            autoFocus
          />

          {text.trim().length > 0 && (
            <span className="absolute bottom-4 text-xs font-medium tracking-wider text-white/40 bg-black/5 px-2.5 py-1 rounded-full backdrop-blur-sm animate-in fade-in duration-200">
              {text.length} / 700
            </span>
          )}
        </div>

        {/* Sleek Floating Bottom Control Cluster */}
        <div className="w-full max-w-xl mx-auto px-4 pb-8 pt-4 flex flex-col items-center gap-4 z-10">
          {/* Subtle Privacy Status Strip */}
          <div
            onClick={() => setShowPrivacySettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/15 hover:bg-black/25 backdrop-blur-md border border-white/5 text-[11px] font-medium tracking-wide text-white/80 transition-all cursor-pointer active:scale-98"
          >
            <span>Status visible to:</span>
            <span className="capitalize font-semibold text-emerald-400">
              {privacyMode.replace("_", " ")}
            </span>
          </div>

          {/* Floating Action Send Trigger */}
          <div className="w-full flex justify-end">
            <Button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10 text-white disabled:text-white/40 shadow-xl shadow-black/10 flex items-center justify-center p-0 transition-all duration-300 active:scale-90 hover:scale-105"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      <StatusPrivacySettings
        open={showPrivacySettings}
        onClose={() => setShowPrivacySettings(false)}
      />
    </>
  );
}
