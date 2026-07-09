import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, Mic, Keyboard } from 'lucide-react';
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
   * Called with the current pixel height of the input bar. The scroll area
   * only needs a fixed bottom padding equal to the bar height; keyboard
   * movement is handled independently by the fixed input overlay.
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
  const [keyboardBottom, setKeyboardBottom] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(68);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem('chirp.recentEmojis') || '[]') as string[];
    } catch {
      return [];
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isTouch = isTouchDevice();

  const saveRecentEmoji = (emoji: string) => {
    setRecentEmojis(prev => {
      const next = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 12);
      try {
        window.localStorage.setItem('chirp.recentEmojis', JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return;
    const height = wrapperRef.current.getBoundingClientRect().height;
    setInputHeight(height);
    onHeightChange?.(height);
  }, [onHeightChange]);

  // ─── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    reportLayout();
  }, [text, reportLayout]);

  // ─── Report bar height and bottom offset to parent ───────────────────────────
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(() => reportLayout());
    ro.observe(wrapperRef.current);
    reportLayout();
    return () => ro.disconnect();
  }, [reportLayout]);

  useEffect(() => {
    const syncBottom = (bottom: number) => {
      document.documentElement.style.setProperty('--vv-bottom', `${Math.max(0, bottom)}px`);
      try {
        window.dispatchEvent(new CustomEvent('chat-visual-viewport', { detail: { bottom } }));
      } catch (_) {}
    };

    const updateBottom = (bottom: number) => {
      setKeyboardBottom(bottom);
      if (!emojiOpen) {
        syncBottom(bottom);
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      let ticking = false;
      const update = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          const bottom = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
          updateBottom(bottom);
          ticking = false;
        });
      };
      update();
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }

    let ticking = false;
    const updateFallback = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const bottom = Math.max(0, window.innerHeight - document.documentElement.clientHeight);
        updateBottom(bottom);
        ticking = false;
      });
    };
    window.addEventListener('resize', updateFallback);
    updateFallback();
    return () => window.removeEventListener('resize', updateFallback);
  }, [emojiOpen]);

  useEffect(() => {
    const bottom = emojiOpen ? panelHeight : keyboardBottom;
    document.documentElement.style.setProperty('--vv-bottom', `${Math.max(0, bottom)}px`);
    try {
      window.dispatchEvent(new CustomEvent('chat-visual-viewport', { detail: { bottom } }));
    } catch (_) {}
    reportLayout();
  }, [emojiOpen, panelHeight, keyboardBottom, reportLayout]);

  const handleFocus = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      textareaRef.current?.focus();
    }
  };

  const handleEmojiClick = () => {
    if (!isTouch) {
      setEmojiOpen(prev => !prev);
      return;
    }

    if (emojiOpen) {
      setEmojiOpen(false);
      textareaRef.current?.focus();
      return;
    }

    const desiredHeight = Math.max(280, keyboardBottom || 280);
    setPanelHeight(desiredHeight);
    textareaRef.current?.blur();
    setEmojiOpen(true);
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      saveRecentEmoji(emoji);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    } else {
      setText(prev => prev + emoji);
      saveRecentEmoji(emoji);
    }
    setEmojiOpen(false);
  };

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

  return (
    <>
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
          onFocus={handleFocus}
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
          /* Mobile: emoji panel toggle */
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 bottom-0.5 text-muted-foreground hover:text-foreground h-8 w-8"
            onClick={handleEmojiClick}
            aria-label={emojiOpen ? 'Switch to keyboard' : 'Open emoji picker'}
            id="emoji-picker-btn"
          >
            {emojiOpen ? <Keyboard className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
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

    {isTouch && (
      <div
        className={cn(
          'chat-emoji-panel fixed left-0 right-0 bottom-0 z-40 overflow-hidden border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.18)] transition-transform duration-200 ease-out',
          emojiOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        )}
        style={{ height: panelHeight || 280 }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted-foreground">
          <span className="font-semibold">Emoji</span>
          <button
            type="button"
            onClick={handleEmojiClick}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Switch to keyboard"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 overflow-y-auto h-full">
          {recentEmojis.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Recent</p>
              <div className="grid grid-cols-8 gap-2">
                {recentEmojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="h-9 w-9 rounded-xl text-lg hover:bg-secondary transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Quick</p>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="h-9 w-9 rounded-xl text-lg hover:bg-secondary transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
</>
  );
}
