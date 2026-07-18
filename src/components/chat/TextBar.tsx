import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Send, Mic, X } from "lucide-react";
import type { Message } from "@/types/chat";

interface TextBarProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  onHeightChange?: (height: number) => void;
  onKeyboardHeightChange?: (height: number) => void;
  replyingTo?: Message | null;
  onClearReply?: () => void;
}

export default function TextBar({
  onSend,
  onTyping,
  disabled,
  placeholder = "Message",
  onHeightChange,
  onKeyboardHeightChange,
  replyingTo,
  onClearReply,
}: TextBarProps) {
  const [text, setText] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Self-managed portal target, mirroring the exact pattern already used by
  // ChatInput's own 'chat-input-portal' div and ChatLayout's
  // 'chat-header-portal'. Without this, TextBar renders in-place inside
  // whatever JSX tree ChatLayout returns it from — and if any ancestor
  // above ChatLayout uses a CSS transform (route transitions, page-slide
  // wrappers, etc.), this bar's position:fixed silently re-anchors to that
  // transformed ancestor instead of the real viewport. That mismatch is
  // what causes fixed elements to visibly jump/shift when the keyboard
  // opens — the same class of bug ChatHeader was deliberately portaled to
  // document.body to avoid. This file already imported createPortal but
  // never called it; wiring it up finishes that existing pattern rather
  // than introducing a new one.
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "chat-textbar-portal";
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    setPortalEl(el);
  }, []);

  const reportHeight = useCallback(() => {
    if (!containerRef.current) return;
    const h = Math.round(containerRef.current.getBoundingClientRect().height);
    onHeightChange?.(h);
  }, [onHeightChange]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    reportHeight();
  }, [text, reportHeight]);

  useEffect(() => {
    const update = () => {
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
        onKeyboardHeightChange?.(bottom);
        rafRef.current = null;
      });
    };

    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    } else {
      window.addEventListener("resize", update);
    }

    const onFocusIn = () => setTimeout(update, 50);
    const onFocusOut = () => {
      setKeyboardHeight(0);
      onKeyboardHeightChange?.(0);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      } else {
        window.removeEventListener("resize", update);
      }
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [onKeyboardHeightChange]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    onClearReply?.();
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }, [disabled, onClearReply, onSend, text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  const buttonBase =
    "inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full transition-colors duration-200 motion-safe:active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50";

  const bar = (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        // Compositor-only transform instead of animating `bottom` — matches
        // ChatInput's already-correct approach. Animating `bottom` forces a
        // layout recalculation on every keyboard-resize frame; translate3d
        // only triggers compositing, which is smoother and removes a
        // second, smaller source of jank on top of the portal fix above.
        transform: `translate3d(0, -${keyboardHeight}px, 0)`,
        willChange: "transform",
        transition: "transform 180ms ease-out",
        boxSizing: "border-box",
        paddingBottom:
          keyboardHeight === 0
            ? "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)"
            : "0.5rem",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 0.5rem)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 0.5rem)",
        paddingTop: "0.5rem",
      }}
      className="flex flex-col gap-2 bg-card border-t border-border/50 backdrop-blur-md"
    >
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/30 bg-muted/45 px-2.5 py-2 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-2 duration-200">
          <div className="min-w-0 overflow-hidden">
            <div className="text-xs font-semibold text-primary">
              Replying to {replyingTo.sender?.display_name || "Unknown"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {replyingTo.content.slice(0, 50)}
              {replyingTo.content.length > 50 ? "…" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end min-w-0 bg-muted/50 border border-border/40 rounded-[20px] px-2 py-1 transition-colors duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40">
          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            aria-label={placeholder}
            className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none px-1.5 py-2 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground/60 disabled:opacity-60"
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
    </div>
  );

  if (!portalEl) {
    return bar;
  }

  return createPortal(bar, portalEl);
}
