import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { Send, Mic } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastHeightRef = useRef<number>(0);

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return;
    const height = Math.round(
      wrapperRef.current.getBoundingClientRect().height,
    );
    if (height !== lastHeightRef.current) {
      lastHeightRef.current = height;
      onHeightChange?.(height);
    }
  }, [onHeightChange]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    }
    reportLayout();
  }, [text, reportLayout]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "chat-input-portal";
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    setPortalEl(el);
  }, []);

  useEffect(() => {
    if (!wrapperRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reportLayout);
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [reportLayout]);

  const updateKeyboardHeight = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const bottom = vv
        ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
        : Math.max(
            0,
            window.innerHeight - document.documentElement.clientHeight,
          );
      setKeyboardHeight(bottom);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    updateKeyboardHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateKeyboardHeight);
      vv.addEventListener("scroll", updateKeyboardHeight);
    } else {
      window.addEventListener("resize", updateKeyboardHeight);
    }

    const handleFocusIn = () => setTimeout(updateKeyboardHeight, 50);
    const handleFocusOut = () => setKeyboardHeight(0);

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateKeyboardHeight);
        vv.removeEventListener("scroll", updateKeyboardHeight);
      } else {
        window.removeEventListener("resize", updateKeyboardHeight);
      }
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [updateKeyboardHeight]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [disabled, onSend, text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  // Only values that depend on JS state (keyboardHeight) stay inline —
  // everything cosmetic/static now uses the same bg-card / border-border /
  // bg-primary tokens as ChatHeader, ChatArea, and ChatInfoSheet, so this
  // bar finally matches the rest of the chain in both light and dark mode.
  const wrapperStyles: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    transform: `translate3d(0, -${keyboardHeight}px, 0)`,
    willChange: "transform",
    boxSizing: "border-box",
    minWidth: 0,
    paddingTop: "0.75rem",
    paddingLeft: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
    paddingRight: "calc(env(safe-area-inset-right, 0px) + 0.75rem)",
    paddingBottom:
      keyboardHeight === 0
        ? "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
        : "0.75rem",
  };

  const buttonBase =
    "inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full transition-colors duration-200 motion-safe:active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50";

  const chatInput = (
    <div
      ref={wrapperRef}
      style={wrapperStyles}
      className="flex items-end gap-3 bg-card/95 backdrop-blur-md border-t border-border/60 shadow-[0_-1px_8px_rgba(15,23,42,0.06)] transition-transform duration-[180ms] ease-out"
    >
      <div className="flex-1 flex items-end min-w-0 bg-muted/40 border border-border/50 rounded-[22px] px-2 py-1 shadow-sm transition-colors duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          aria-label={placeholder}
          className="flex-1 min-w-0 resize-none bg-transparent border-0 rounded-2xl px-2 py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none box-border overflow-hidden min-h-9 max-h-[140px] disabled:opacity-60"
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
          inputMode="text"
          enterKeyHint="send"
        />
      </div>

      {text.trim() ? (
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
          aria-label="Send message"
          className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground`}
        >
          <Send className="w-[17px] h-[17px]" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-label="Record voice message"
          className={`${buttonBase} bg-muted/70 text-foreground/70 hover:bg-muted hover:text-foreground`}
        >
          <Mic className="w-[19px] h-[19px]" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  if (!portalEl) {
    return chatInput;
  }

  return createPortal(chatInput, portalEl);
}

export default ChatInput;
