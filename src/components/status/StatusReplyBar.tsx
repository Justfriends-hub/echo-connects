import { useState, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StatusReplyBarProps {
  onSend: (message: string) => Promise<void>;
}

export function StatusReplyBar({ onSend }: StatusReplyBarProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
    } catch (error) {
      console.error("Failed to dispatch status reply message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = message.trim().length > 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-8 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center">
      <div className="w-full max-w-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ease-out">
        {/* Sleek Rounded Input Capsule Tray */}
        <div className="flex-1 flex items-center bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-full pl-5 pr-2 py-1.5 shadow-xl focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all duration-200">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply to status..."
            disabled={sending}
            className="flex-1 bg-transparent border-0 p-0 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-[15px]"
          />
        </div>

        {/* Dynamic Scale Action Pill */}
        <div
          className={`transition-all duration-200 origin-center ${
            hasContent || sending
              ? "scale-100 opacity-100"
              : "scale-75 opacity-0 pointer-events-none"
          }`}
        >
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !hasContent}
            className="h-11 w-11 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 text-white shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <Send className="h-4 w-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
