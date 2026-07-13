import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Smile, Mic, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

interface ChatInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
}

export function ChatInput({ onSend, onTyping, disabled, placeholder = 'Message', onHeightChange }: ChatInputProps) {
  const [text, setText] = useState('')
  const [nativeEmojiMode, setNativeEmojiMode] = useState(false)
  const [keyboardBottom, setKeyboardBottom] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isTouch = isTouchDevice()

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return
    const height = wrapperRef.current.getBoundingClientRect().height
    onHeightChange?.(height)
  }, [onHeightChange])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    reportLayout()
  }, [text, reportLayout])

  // Track visual viewport to determine keyboard inset. Do NOT modify documentRoot styles—only move the chat input.
  useEffect(() => {
    const vv = window.visualViewport
    if (vv) {
      let ticking = false
      const update = () => {
        if (ticking) return
        ticking = true
        window.requestAnimationFrame(() => {
          const bottom = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
          setKeyboardBottom(bottom)
          // notify listeners without touching root CSS vars
          try { window.dispatchEvent(new CustomEvent('chat-visual-viewport', { detail: { bottom } })) } catch {}
          ticking = false
        })
      }
      update()
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
      return () => {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
    }

    // fallback
    let ticking = false
    const updateFallback = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const bottom = Math.max(0, window.innerHeight - document.documentElement.clientHeight)
        setKeyboardBottom(bottom)
        try { window.dispatchEvent(new CustomEvent('chat-visual-viewport', { detail: { bottom } })) } catch {}
        ticking = false
      })
    }
    window.addEventListener('resize', updateFallback)
    updateFallback()
    return () => window.removeEventListener('resize', updateFallback)
  }, [])

  const handleNativeEmojiToggle = () => {
    const ta = textareaRef.current
    if (!ta) return
    if (isTouch) {
      setNativeEmojiMode((p) => !p)
      ta.blur()
      setTimeout(() => ta.focus(), 60)
    } else {
      setNativeEmojiMode((p) => !p)
      ta.focus()
    }
  }

  const handleFocus = () => {
    if (nativeEmojiMode && !isTouch) setNativeEmojiMode(false)
  }

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    onTyping?.()
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full flex items-end gap-2 px-3 py-3 bg-background/90 border-t border-border/30 select-none backdrop-blur-xl transition-all duration-300 ease-out"
      // keep the input pinned to the viewport; move it up by keyboard inset only
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, transform: `translate3d(0, -${keyboardBottom}px, 0)`, willChange: 'transform' }}
    >
      <div className="flex-1 flex items-end bg-muted/50 focus-within:bg-muted/80 border border-border/30 rounded-[22px] px-2 py-1 transition-all duration-200 ease-in-out shadow-sm focus-within:shadow-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground/80 hover:text-foreground h-9 w-9 rounded-full"
              onClick={handleNativeEmojiToggle}
              aria-label="Toggle native input type"
            >
              {nativeEmojiMode ? <Keyboard className="w-[21px] h-[21px] text-primary" /> : <Smile className="w-[21px] h-[21px]" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium">Emoji Keyboard</TooltipContent>
        </Tooltip>

        <textarea
          ref={textareaRef}
          value={text}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          inputMode={nativeEmojiMode ? 'search' : 'text'}
          className={cn('flex-1 resize-none bg-transparent rounded-xl px-2 py-2 text-[15px] leading-relaxed text-foreground max-h-[140px]', 'placeholder:text-muted-foreground/60 focus:outline-none min-h-[36px] transition-all scrollbar-none')}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground/80 hover:text-foreground h-9 w-9 rounded-full">
              <Paperclip className="w-[19px] h-[19px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-medium">Attach</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-shrink-0 pb-[1px]">
        {text.trim() ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSend} size="icon" className="bg-primary text-primary-foreground rounded-full w-[40px] h-[40px]" disabled={disabled} id="send-message-btn">
                <Send className="w-[17px] h-[17px] ml-[2px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium">Send</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="bg-muted/40 w-[40px] h-[40px] rounded-full">
                <Mic className="w-[19px] h-[19px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs font-medium">Voice note</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default ChatInput
