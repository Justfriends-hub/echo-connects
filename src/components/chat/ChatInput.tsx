import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const EMOJI_LIST = [
  '😀', '😂', '🥰', '😎', '🤔', '😅', '😊', '🙌',
  '👍', '👎', '❤️', '🔥', '🎉', '💯', '😮', '😢',
  '🤣', '😍', '🥳', '😤', '🙏', '💪', '✨', '💀',
  '👀', '🫡', '🤝', '💔', '🎯', '🚀', '⭐', '🌟',
];

/** Detect touch-capable devices (phones/tablets with software keyboards) */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Called with the current pixel height of the input bar whenever it changes.
   * The parent uses this to keep a matching bottom padding on the scroll area
   * so the last message is never hidden behind the floating bar.
   */
  onHeightChange?: (height: number) => void;
}

export function ChatInput({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Message',
  onHeightChange,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isTouch = isTouchDevice();

  // ─── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  // ─── Report bar height to parent (for bottom spacer) ────────────────────────
  useEffect(() => {
    if (!onHeightChange || !wrapperRef.current) return;
    const ro = new ResizeObserver(() => {
      if (wrapperRef.current) {
        onHeightChange(wrapperRef.current.getBoundingClientRect().height);
      }
    });
    ro.observe(wrapperRef.current);
    // Report initial height
    onHeightChange(wrapperRef.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [onHeightChange]);

  // ─── visualViewport: update CSS variable so bar floats above keyboard ────────
  //
  // The bar has `position: fixed` via the `.chat-input-fixed` class.
  // We set `--vv-bottom` on <html> so the CSS rule `bottom: var(--vv-bottom)`
  // keeps the bar flush with the top of the keyboard at all times.
  // The transition in App.css makes this smooth.
  //
  // Why this works and translateY didn't:
  //   - translateY on a non-fixed element still causes the element to visually
  //     move, but the *layout* (flex column) still positions everything below it.
  //   - `position: fixed` with an updated `bottom` value is the canonical approach
  //     used by WhatsApp Web, Telegram Web, and iMessage PWAs.
  useEffect(() => {
    const vv = window.visualViewport;

    const dispatchViewportEvent = (bottom: number) => {
      // Keep CSS var in sync so `.chat-input-fixed` sits above keyboard
      document.documentElement.style.setProperty('--vv-bottom', `${Math.max(0, bottom)}px`);
      // Emit an event other parts of the app can listen to
      try {
        window.dispatchEvent(new CustomEvent('chat-visual-viewport', { detail: { bottom } }));
      } catch (_) {}
    };

    if (vv) {
      const update = () => {
        const vvBottom = window.innerHeight - (vv.offsetTop + vv.height);
        dispatchViewportEvent(Math.max(0, vvBottom));
      };
      update();
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
        document.documentElement.style.removeProperty('--vv-bottom');
      };
    }

    // Fallback for environments without visualViewport (older browsers / webviews)
    let lastInner = window.innerHeight;
    const onResize = () => {
      const diff = lastInner - window.innerHeight;
      lastInner = window.innerHeight;
      // If window.innerHeight dropped, assume keyboard appeared and use diff
      const bottom = diff > 0 ? diff : 0;
      dispatchViewportEvent(bottom);
    };
    window.addEventListener('resize', onResize);
    // initial check
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      document.documentElement.style.removeProperty('--vv-bottom');
    };
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    } else {
      setText(prev => prev + emoji);
    }
    setEmojiOpen(false);
  };

  /**
   * Emoji button handler:
   * - Mobile (touch): Just focus the textarea. The native keyboard already has
   *   an emoji switch key (🌐/😊). This gives users the full OS emoji keyboard
   *   with thousands of emojis, recents, search, etc.
   * - Desktop (no touch): Open the in-app emoji popover for quick access.
   */
  const handleEmojiClick = () => {
    if (isTouch) {
      // On mobile: focus textarea to bring up keyboard.
      // The user taps the emoji key on their native keyboard.
      textareaRef.current?.focus();
      return;
    }
    // On desktop: toggle the emoji popover
    setEmojiOpen(prev => !prev);
  };

  return (
    <div
      ref={wrapperRef}
      className="chat-input-fixed flex items-end gap-2 p-3 bg-chat-input-bg border-t border-border"
    >
      {/* Attach */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground flex-shrink-0 mb-0.5"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Attach file</TooltipContent>
      </Tooltip>

      {/* Textarea + emoji picker */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className={cn(
            'w-full resize-none bg-secondary rounded-2xl px-4 py-2.5 pr-10 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            'max-h-[120px] transition-colors'
          )}
        />

        {/* Desktop-only emoji popover (mobile users use their native keyboard emoji key) */}
        {isTouch ? (
          /* Mobile: simple button that focuses textarea */
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 bottom-0.5 text-muted-foreground hover:text-foreground h-8 w-8"
            onClick={handleEmojiClick}
            aria-label="Open emoji keyboard"
            id="emoji-picker-btn"
          >
            <Smile className="w-5 h-5" />
          </Button>
        ) : (
          /* Desktop: popover with quick emoji grid */
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 bottom-0.5 text-muted-foreground hover:text-foreground h-8 w-8"
                onClick={handleEmojiClick}
                aria-label="Emoji"
                id="emoji-picker-btn"
              >
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 bg-card border-border p-2"
              align="end"
              side="top"
              // Don't steal focus from textarea
              onOpenAutoFocus={e => e.preventDefault()}
            >
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onMouseDown={e => {
                      // Prevent blur on textarea before we insert
                      e.preventDefault();
                      insertEmoji(emoji);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent rounded-md transition-colors active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Send / Mic */}
      {text.trim() ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSend}
              size="icon"
              className="bg-primary hover:bg-primary/90 rounded-full flex-shrink-0 mb-0.5 w-10 h-10 transition-transform active:scale-90"
              disabled={disabled}
              id="send-message-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground flex-shrink-0 mb-0.5"
            >
              <Mic className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voice message</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
