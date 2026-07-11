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
      // Toggle native device input types dynamically to access native keyboard layers
      setNativeEmojiMode((prev) => !prev);
      ta.blur();
      setTimeout(() => {
        ta.focus();
      }, 60);
    } else {
      // Fallback fallback interaction
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
      className="chat-input-fixed w-full flex items-end gap-2 px-3 py-2.5 bg-background border-t border-border/40 select-none backdrop-blur-lg"
      style={{ transform: "translateZ(0)" }}
    >
      {/* WhatsApp Integrated Bubble Wrapper */}
      <div className="flex-1 flex items-end bg-muted/60 hover:bg-muted/80 border border-border/40 rounded-[24px] px-2 py-1 transition-all duration-200 shadow-sm">
        {/* Toggle between keyboard and native emoji layers via platform interfaces */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-full transition-transform active:scale-95 flex-shrink-0"
              onClick={handleNativeEmojiToggle}
              aria-label="Toggle native input type"
            >
              {nativeEmojiMode ? (
                <Keyboard className="w-[22px] h-[22px] text-primary" />
              ) : (
                <Smile className="w-[22px] h-[22px]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium">
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
            "flex-1 resize-none bg-transparent rounded-xl px-2 py-2 text-[15px] leading-tight text-foreground max-h-[140px]",
            "placeholder:text-muted-foreground/80 focus:outline-none min-h-[36px] transition-all scrollbar-none",
          )}
        />

        {/* Attachment Controller */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-full transition-transform active:scale-95 flex-shrink-0"
            >
              <Paperclip className="w-[20px] h-[20px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium">
            Attach
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Action Element Floating Button Well */}
      <div className="flex-shrink-0 pb-[2px]">
        {text.trim() ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSend}
                size="icon"
                className="bg-primary hover:bg-primary/95 text-primary-foreground rounded-full w-10 h-10 shadow-md flex items-center justify-center transition-all duration-200 active:scale-90"
                disabled={disabled}
                id="send-message-btn"
              >
                <Send className="w-[18px] h-[18px] ml-[2px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium">
              Send
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-muted/60 border border-border/30 hover:bg-muted/80 text-muted-foreground hover:text-foreground w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-all duration-200 active:scale-90"
              >
                <Mic className="w-[20px] h-[20px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium">
              Voice note
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
