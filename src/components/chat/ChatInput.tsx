import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Smile, Mic, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Detect touch-capable devices (phones/tablets with software keyboards) */
function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Called with the current pixel height of the input bar. The scroll area
   * only needs a fixed bottom padding equal to the bar height.
   */
  onHeightChange?: (height: number) => void;
}

export function ChatInput({
  onSend,
  onTyping,
  disabled,
  placeholder = "Message",
  onHeightChange,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [nativeEmojiMode, setNativeEmojiMode] = useState(false);
  const [keyboardBottom, setKeyboardBottom] = useState(0);
  const [inputHeight, setInputHeight] = useState(68);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isTouch = isTouchDevice();

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return;
    const height = wrapperRef.current.getBoundingClientRect().height;
    setInputHeight(height);
    onHeightChange?.(height);
  }, [onHeightChange]);

  // ─── Auto-resize textarea seamlessly ──────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    reportLayout();
  }, [text, reportLayout]);

  // ─── Layout Observer for reactive viewport resizing ───────────────────────────
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(() => reportLayout());
    ro.observe(wrapperRef.current);
    reportLayout();
    return () => ro.disconnect();
  }, [reportLayout]);

  // ─── Track Visual Viewport changes to pin elements beautifully ─────────────────
  useEffect(() => {
    const syncBottom = (bottom: number) => {
      // Smooth dynamic execution on mobile layout adjustments
      document.documentElement.style.setProperty(
        "--vv-bottom",
        `${Math.max(0, bottom)}px`,
      );
      try {
        window.dispatchEvent(
          new CustomEvent("chat-visual-viewport", { detail: { bottom } }),
        );
      } catch (_) {}
    };

    const updateBottom = (bottom: number) => {
      setKeyboardBottom(bottom);
      syncBottom(bottom);
    };

    const vv = window.visualViewport;
    if (vv) {
      let ticking = false;
      const update = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          const bottom = Math.max(
            0,
            window.innerHeight - (vv.offsetTop + vv.height),
          );
          updateBottom(bottom);
          ticking = false;
        });
      };
      update();
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }

    let ticking = false;
    const updateFallback = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const bottom = Math.max(
          0,
          window.innerHeight - document.documentElement.clientHeight,
        );
        updateBottom(bottom);
        ticking = false;
      });
    };
    window.addEventListener("resize", updateFallback);
    updateFallback();
    return () => window.removeEventListener("resize", updateFallback);
  }, []);

  // ─── Handle Toggle for keyboard configuration styles ─────────────────────────
  const handleNativeEmojiToggle = () => {
    const ta = textareaRef.current;
    if (!ta) return;

    if (isTouch) {
      setNativeEmojiMode((prev) => !prev);
      ta.blur();
      setTimeout(() => {
        ta.focus();
      }, 60);
    } else {
      setNativeEmojiMode((prev) => !prev);
      ta.focus();
    }
  };

  const handleFocus = () => {
    if (nativeEmojiMode && !isTouch) {
      setNativeEmojiMode(false);
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  return (
    <div
      ref={wrapperRef}
      className="w-full flex items-end gap-2 px-3 py-3 bg-background/90 border-t border-border/30 select-none backdrop-blur-xl transition-all duration-300 ease-out behavior-contain"
      style={{
        transform: `translate3d(0, -${keyboardBottom}px, 0)`,
        willChange: "transform",
      }}
    >
      {/* WhatsApp + Telegram Hybrid Bubble Wrapper */}
      <div className="flex-1 flex items-end bg-muted/50 focus-within:bg-muted/80 border border-border/30 rounded-[22px] px-2 py-1 transition-all duration-200 ease-in-out shadow-sm focus-within:shadow-md">
        {/* Toggle between keyboard and native emoji layers */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground/80 hover:text-foreground h-9 w-9 rounded-full transition-all duration-200 active:scale-90 hover:bg-background/40 flex-shrink-0"
              onClick={handleNativeEmojiToggle}
              aria-label="Toggle native input type"
            >
              {nativeEmojiMode ? (
                <Keyboard className="w-[21px] h-[21px] text-primary transition-transform duration-200" />
              ) : (
                <Smile className="w-[21px] h-[21px] transition-transform duration-200" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium backdrop-blur-md">
            Emoji Keyboard
          </TooltipContent>
        </Tooltip>

        {/* Core dynamic auto-expanding responsive textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          inputMode={nativeEmojiMode ? "search" : "text"}
          className={cn(
            "flex-1 resize-none bg-transparent rounded-xl px-2 py-2 text-[15px] leading-relaxed text-foreground max-h-[140px]",
            "placeholder:text-muted-foreground/60 focus:outline-none min-h-[36px] transition-all scrollbar-none",
          )}
        />

        {/* Attachment Controller */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/80 hover:text-foreground h-9 w-9 rounded-full transition-all duration-200 active:scale-90 hover:bg-background/40 flex-shrink-0"
            >
              <Paperclip className="w-[19px] h-[19px] transition-transform duration-200 hover:rotate-12" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium backdrop-blur-md">
            Attach
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Floating Action Button (Telegram-Inspired Sleek Micro-interactions) */}
      <div className="flex-shrink-0 pb-[1px]">
        {text.trim() ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSend}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full w-[40px] h-[40px] shadow-sm flex items-center justify-center transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) active:scale-75 hover:scale-105"
                disabled={disabled}
                id="send-message-btn"
              >
                <Send className="w-[17px] h-[17px] ml-[2px] transition-transform duration-200" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium backdrop-blur-md">
              Send
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-muted/40 border border-border/20 hover:bg-muted/70 text-muted-foreground/80 hover:text-foreground w-[40px] h-[40px] rounded-full shadow-sm flex items-center justify-center transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) active:scale-75 hover:scale-105"
              >
                <Mic className="w-[19px] h-[19px] transition-transform duration-200" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium backdrop-blur-md">
              Voice note
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
