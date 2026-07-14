import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Send, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
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

  const wrapperStyles: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    transform: `translate3d(0, -${keyboardHeight}px, 0)`,
    transition: 'transform 180ms ease-out',
    willChange: 'transform',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    padding: '0.75rem 0.75rem 0.75rem 0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTop: '1px solid rgba(148, 163, 184, 0.3)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    paddingBottom: keyboardHeight === 0 ? 'env(safe-area-inset-bottom)' : undefined,
    boxSizing: 'border-box',
    minWidth: 0,
  }

  const inputShellStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(248, 250, 252, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: '22px',
    padding: '0.25rem 0.5rem',
    transition: 'background-color 200ms ease',
    boxShadow: '0 1px 8px rgba(15, 23, 42, 0.06)',
  }

  const textareaStyles: React.CSSProperties = {
    flex: 1,
    resize: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '16px',
    padding: '0.5rem 0.5rem',
    fontSize: '15px',
    lineHeight: 1.5,
    color: 'inherit',
    minHeight: '36px',
    maxHeight: '140px',
    outline: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }

  const iconWrapperStyles: React.CSSProperties = {
    flexShrink: 0,
    paddingBottom: '1px',
  }

  const chatInput = (
    <div ref={wrapperRef} style={wrapperStyles}>
      <div style={inputShellStyles}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          style={textareaStyles}
        />
      </div>

      <div style={iconWrapperStyles}>
        {text.trim() ? (
          <Button
            onClick={handleSend}
            size="icon"
            className="rounded-full"
            disabled={disabled}
            id="send-message-btn"
            style={{
              width: '40px',
              height: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#2563EB',
              color: '#fff',
              borderRadius: '999px',
            }}
          >
            <Send style={{ width: '17px', height: '17px', marginLeft: '2px' }} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            disabled={disabled}
            style={{
              width: '40px',
              height: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(148, 163, 184, 0.16)',
              color: '#374151',
              borderRadius: '999px',
            }}
          >
            <Mic style={{ width: '19px', height: '19px' }} />
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
