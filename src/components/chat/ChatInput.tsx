import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Smile, Mic, Keyboard, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
}

const STORAGE_KEY = 'chat:input:pos'

export function ChatInput({ onSend, onTyping, disabled, placeholder = 'Message', onHeightChange }: ChatInputProps) {
  // Editable text
  const [text, setText] = useState('')

  // Floating / detachable state
  const [detached, setDetached] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Keyboard / viewport tracking for smooth movement when attached
  const [vvBottom, setVvBottom] = useState(0)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  // report height
  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return
    const h = wrapperRef.current.getBoundingClientRect().height
    onHeightChange?.(h)
  }, [onHeightChange])

  // auto-resize textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    reportLayout()
  }, [text, reportLayout])

  // visualViewport tracking
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      const onResize = () => setVvBottom(Math.max(0, window.innerHeight - document.documentElement.clientHeight))
      window.addEventListener('resize', onResize)
      onResize()
      return () => window.removeEventListener('resize', onResize)
    }

    const update = () => {
      const bottom = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
      setVvBottom(bottom)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Drag handlers for detached mode
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.dragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const nx = dragRef.current.originX + dx
      const ny = dragRef.current.originY + dy
      const clampedX = Math.max(8, Math.min(window.innerWidth - 8, nx))
      const clampedY = Math.max(8, Math.min(window.innerHeight - 8, ny))
      setPos({ x: clampedX, y: clampedY })
    }
    const onPointerUp = () => {
      if (!dragRef.current.dragging) return
      dragRef.current.dragging = false
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos || { x: 24, y: window.innerHeight - 120 }))
      } catch {}
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [pos])

  // pointer down to start drag
  const onDragPointerDown = (e: React.PointerEvent) => {
    if (!detached) return
    dragRef.current.dragging = true
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    dragRef.current.originX = pos?.x ?? 24
    dragRef.current.originY = pos?.y ?? window.innerHeight - 120
  }

  const toggleDetached = () => setDetached((d) => {
    const next = !d
    // when switching to attached, clear pos to default
    if (!next) {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      setPos(null)
    }
    return next
  })

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    onTyping?.()
  }

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }, [text, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // shell position styles
  const attachedStyle: React.CSSProperties = { transform: `translateY(-${vvBottom}px)` }
  const detachedStyle: React.CSSProperties = pos ? { position: 'fixed', left: pos.x - 16, top: pos.y - 16, zIndex: 60 } : { position: 'fixed', right: 16, bottom: 80, zIndex: 60 }

  return (
    <div
      ref={wrapperRef}
      className={cn('shadow-lg rounded-2xl transition-all duration-200', detached ? 'w-[92%] max-w-md' : 'w-full')}
      style={detached ? detachedStyle : { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, ...attachedStyle }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-background/95 border-t border-border/30 rounded-t-2xl">
        <div
          onPointerDown={onDragPointerDown}
          className="p-2 rounded-full cursor-move bg-muted/30"
          title={detached ? 'Drag to reposition' : 'Enable floating mode'}
          onClick={(e) => { e.stopPropagation(); if (!detached) toggleDetached() }}
        >
          <Move className="w-4 h-4" />
        </div>
        <div className="flex-1 flex items-center gap-2 bg-muted/50 border border-border/20 rounded-[18px] px-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Emoji">
                <Smile className="w-[19px] h-[19px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Emoji</TooltipContent>
          </Tooltip>

          <textarea
            ref={taRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none max-h-[160px] scrollbar-none"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Attach">
                <Paperclip className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Attach</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          {text.trim() ? (
            <Button onClick={handleSend} size="icon" className="bg-primary text-primary-foreground rounded-full w-10 h-10">
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="bg-muted/40 rounded-full w-10 h-10">
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatInput
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
