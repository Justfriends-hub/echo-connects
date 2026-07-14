import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, Mic } from 'lucide-react'

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
  const rafRef = useRef<number | null>(null)
  const lastHeightRef = useRef<number>(0)

  const reportLayout = useCallback(() => {
    if (!wrapperRef.current) return
    const height = Math.round(wrapperRef.current.getBoundingClientRect().height)
    if (height !== lastHeightRef.current) {
      lastHeightRef.current = height
      onHeightChange?.(height)
    }
  }, [onHeightChange])

  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    }
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

  const updateKeyboardHeight = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      const vv = window.visualViewport
      const bottom = vv
        ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
        : Math.max(0, window.innerHeight - document.documentElement.clientHeight)
      setKeyboardHeight(bottom)
      rafRef.current = null
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    updateKeyboardHeight()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', updateKeyboardHeight)
      vv.addEventListener('scroll', updateKeyboardHeight)
    } else {
      window.addEventListener('resize', updateKeyboardHeight)
    }

    const handleFocusIn = () => setTimeout(updateKeyboardHeight, 50)
    const handleFocusOut = () => setKeyboardHeight(0)

    window.addEventListener('focusin', handleFocusIn)
    window.addEventListener('focusout', handleFocusOut)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateKeyboardHeight)
        vv.removeEventListener('scroll', updateKeyboardHeight)
      } else {
        window.removeEventListener('resize', updateKeyboardHeight)
      }
      window.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('focusout', handleFocusOut)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [updateKeyboardHeight])

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
    zIndex: 999,
    transform: `translate3d(0, -${keyboardHeight}px, 0)`,
    transition: 'transform 180ms ease-out',
    willChange: 'transform',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.75rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderTop: '1px solid rgba(148, 163, 184, 0.35)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    paddingBottom: keyboardHeight === 0 ? 'env(safe-area-inset-bottom)' : '0px',
    boxSizing: 'border-box',
    minWidth: 0,
  }

  const inputShellStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '22px',
    padding: '0.25rem 0.5rem',
    boxShadow: '0 1px 8px rgba(15, 23, 42, 0.08)',
  }

  const textareaStyles: React.CSSProperties = {
    flex: 1,
    resize: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '16px',
    padding: '0.5rem',
    fontSize: '15px',
    lineHeight: 1.5,
    color: 'inherit',
    minHeight: '36px',
    maxHeight: '140px',
    outline: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }

  const buttonBaseStyles: React.CSSProperties = {
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '999px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }

  const sendButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    backgroundColor: disabled ? 'rgba(148, 163, 184, 0.32)' : '#2563EB',
    color: '#ffffff',
  }

  const micButtonStyles: React.CSSProperties = {
    ...buttonBaseStyles,
    backgroundColor: disabled ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.16)',
    color: '#374151',
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
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
          inputMode="text"
          enterKeyHint="send"
        />
      </div>

      {text.trim() ? (
        <button type="button" onClick={handleSend} disabled={disabled} style={sendButtonStyles}>
          <Send style={{ width: '17px', height: '17px' }} />
        </button>
      ) : (
        <button type="button" disabled={disabled} style={micButtonStyles}>
          <Mic style={{ width: '19px', height: '19px' }} />
        </button>
      )}
    </div>
  )

  if (!portalEl) {
    return chatInput
  }

  return createPortal(chatInput, portalEl)
}

export default ChatInput
