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

interface ChatInputProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Called whenever the input bar changes height (px) so parent can adjust spacer */
  onHeightChange?: (height: number) => void;
  /** Called when the keyboard opens so parent can scroll to bottom */
  onKeyboardOpen?: () => void;
}

/**
 * Detects whether we're likely on a mobile device where a virtual keyboard appears.
 */
function isMobileDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function ChatInput({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Message',
  onHeightChange,
  onKeyboardOpen,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = isMobileDevice();

  // ─── Resize textarea height as text grows ───────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  // ─── Notify parent of bar height changes ────────────────────────────────────
  useEffect(() => {
    if (!onHeightChange || !wrapperRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height);
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [onHeightChange]);

  // ─── visualViewport: float the input bar above the keyboard ─────────────────
  // The bar sits as a normal flex child, but on mobile we translate it so only
  // IT moves up with the keyboard — the messages area behind it is untouched.
  useEffect(() => {
    const vv = window.visualViewport;
    const wrapper = wrapperRef.current;
    if (!vv || !wrapper) return;

    let lastKeyboardOpen = false;

    const update = () => {
      const vvBottom = vv.offsetTop + vv.height;
      const windowBottom = window.innerHeight;
      const keyboardHeight = windowBottom - vvBottom;
      const isOpen = keyboardHeight > 50;

      // Apply CSS variable so the bar can translate itself
      wrapper.style.transform = isOpen
        ? `translateY(-${keyboardHeight}px)`
        : 'translateY(0)';
      wrapper.style.transition = 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)';

      if (isOpen && !lastKeyboardOpen) {
        // Keyboard just opened — notify parent to scroll to bottom
        requestAnimationFrame(() => onKeyboardOpen?.());
      }
      lastKeyboardOpen = isOpen;
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [onKeyboardOpen]);

  // ─── Send ────────────────────────────────────────────────────────────────────
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

  // ─── Emoji ───────────────────────────────────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      // Restore cursor after emoji
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
   * On mobile: try to open the native emoji keyboard.
   * iOS Safari / Android Chrome both respond to focusing an input and then
   * programmatically triggering selection via the emoji mode trick.
   * We do this by focusing the textarea and dispatching a keydown for the emoji
   * shortcut — but since that's not reliable cross-platform, the safest approach
   * is to focus the textarea (which opens the keyboard) and then let the user
   * tap the emoji key on their keyboard. We also open our fallback picker.
   */
  const handleEmojiButtonClick = () => {
    if (isMobile) {
      // Focus the textarea so the keyboard appears with the emoji key visible
      textareaRef.current?.focus();
      // Also show our emoji picker as a supplement
      setEmojiOpen(prev => !prev);
    } else {
      setEmojiOpen(prev => !prev);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="chat-input-wrapper flex items-end gap-2 p-3 bg-chat-input-bg border-t border-border"
      style={{
        // Ensure the bar has a proper stacking context so the translateY works
        // correctly relative to the scroll container.
        willChange: 'transform',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Attach file */}
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

      {/* Text area + emoji trigger */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          inputMode="text"
          className={cn(
            'w-full resize-none bg-secondary rounded-2xl px-4 py-2.5 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            'max-h-[120px] transition-colors'
          )}
        />

        {/* Emoji button — opens native keyboard emoji panel on mobile, custom picker on desktop */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-0.5 text-muted-foreground hover:text-foreground h-8 w-8"
              onClick={handleEmojiButtonClick}
              aria-label="Open emoji picker"
              id="emoji-picker-trigger"
            >
              <Smile className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 bg-card border-border p-2"
            align="end"
            side="top"
            // Prevent the popover from stealing focus from the textarea on mobile
            onOpenAutoFocus={e => { if (isMobile) e.preventDefault(); }}
          >
            {isMobile && (
              <p className="text-xs text-muted-foreground text-center pb-2 border-b border-border mb-2">
                Tap emoji key 😊 on your keyboard, or pick one below
              </p>
            )}
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent rounded-md transition-colors active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
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
          <TooltipContent>Send message</TooltipContent>
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
