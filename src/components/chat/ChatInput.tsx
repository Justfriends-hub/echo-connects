import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Send, Paperclip, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function ChatInput({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Message',
  onHeightChange,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isTouch = isTouchDevice()

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return
    const height = Math.round(wrapperRef.current.getBoundingClientRect().height)
    onHeightChange?.(height)
  }, [onHeightChange])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    reportLayout()
  }, [text, reportLayout])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'chat-input-portal'
    let el = document.getElementById(id) as HTMLDivElement | null
    if (!el) {
      el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    }
    setPortalEl(el)
  }, [])

  useEffect(() => {
    if (!wrapperRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportLayout)
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [reportLayout])

  useEffect(() => {
    const vv = window.visualViewport
    let frameId = 0

    const updateInset = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        const bottom = vv
          ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
          : Math.max(0, window.innerHeight - document.documentElement.clientHeight)
        setKeyboardHeight(bottom)
        frameId = 0
      })
    }

    if (vv) {
      vv.addEventListener('resize', updateInset)
      vv.addEventListener('scroll', updateInset)
      updateInset()
      return () => {
        vv.removeEventListener('resize', updateInset)
        vv.removeEventListener('scroll', updateInset)
        if (frameId) window.cancelAnimationFrame(frameId)
      }
    }

    window.addEventListener('resize', updateInset)
    updateInset()
    return () => {
      window.removeEventListener('resize', updateInset)
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [disabled, onSend, text])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    onTyping?.()
  }

  const chatInput = (
    <div
      ref={wrapperRef}
      className="w-full flex items-end gap-2 px-3 py-3 bg-background/90 border-t border-border/30 select-none backdrop-blur-xl"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        transform: `translate3d(0, -${keyboardHeight}px, 0)`,
        transition: 'transform 180ms ease-out',
        willChange: 'transform',
        paddingBottom: keyboardHeight === 0 ? 'env(safe-area-inset-bottom)' : undefined,
      }}
    >
      <div className="flex-1 flex items-end bg-muted/50 focus-within:bg-muted/80 border border-border/30 rounded-[22px] px-2 py-1 transition-all duration-200 ease-in-out shadow-sm focus-within:shadow-md">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none bg-transparent rounded-xl px-2 py-2 text-[15px] leading-relaxed text-foreground max-h-[140px]',
            'placeholder:text-muted-foreground/60 focus:outline-none min-h-[36px] transition-all scrollbar-none',
          )}
        />
      </div>

      <div className="flex-shrink-0 pb-[1px]">
        {text.trim() ? (
          <Button
            onClick={handleSend}
            size="icon"
            className="bg-primary text-primary-foreground rounded-full w-[40px] h-[40px]"
            disabled={disabled}
            id="send-message-btn"
          >
            <Send className="w-[17px] h-[17px] ml-[2px]" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="bg-muted/40 w-[40px] h-[40px] rounded-full"
            disabled={disabled}
          >
            <Mic className="w-[19px] h-[19px]" />
          </Button>
        )}
      </div>
    </div>
  )

  if (!portalEl) {
    return chatInput
  }

  return createPortal(chatInput, portalEl)
}

export default ChatInput
