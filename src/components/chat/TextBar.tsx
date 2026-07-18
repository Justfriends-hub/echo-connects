import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send, Mic } from 'lucide-react'
import type { Message } from '@/types/chat'

interface TextBarProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
  onKeyboardHeightChange?: (height: number) => void
  replyingTo?: Message | null
  onClearReply?: () => void
}

export default function TextBar({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Message',
  onHeightChange,
  onKeyboardHeightChange,
  replyingTo,
  onClearReply,
}: TextBarProps) {
  const [text, setText] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const reportHeight = useCallback(() => {
    if (!containerRef.current) return
    const h = Math.round(containerRef.current.getBoundingClientRect().height)
    onHeightChange?.(h)
  }, [onHeightChange])

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    reportHeight()
  }, [text, reportHeight])

  useEffect(() => {
    const update = () => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        const vv = window.visualViewport
        const bottom = vv
          ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
          : Math.max(0, window.innerHeight - document.documentElement.clientHeight)
        setKeyboardHeight(bottom)
        onKeyboardHeightChange?.(bottom)
        rafRef.current = null
      })
    }

    update()
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', update)
      vv.addEventListener('scroll', update)
    } else {
      window.addEventListener('resize', update)
    }

    const onFocusIn = () => setTimeout(update, 50)
    const onFocusOut = () => {
      setKeyboardHeight(0)
      onKeyboardHeightChange?.(0)
    }
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      } else {
        window.removeEventListener('resize', update)
      }
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [onKeyboardHeightChange])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    onClearReply?.()
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }, [disabled, onClearReply, onSend, text])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    onTyping?.()
  }

  const bar = (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: `${keyboardHeight}px`,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px',
        background: 'hsl(var(--card))',
        borderTop: '1px solid hsl(var(--border) / 0.5)',
        boxSizing: 'border-box',
        paddingBottom: keyboardHeight === 0 ? 'env(safe-area-inset-bottom, 0px)' : '0px',
      }}
    >
      {replyingTo && (
        <div
          style={{
            borderRadius: 16,
            border: '1px solid hsl(var(--border) / 0.3)',
            background: 'hsl(var(--muted) / 0.45)',
            padding: '8px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--primary))' }}>
              Replying to {replyingTo.sender?.display_name || 'Unknown'}
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyingTo.content.slice(0, 50)}{replyingTo.content.length > 50 ? '…' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            background: 'hsl(var(--muted) / 0.5)',
            border: '1px solid hsl(var(--border) / 0.3)',
            borderRadius: 20,
            padding: '4px 6px',
          }}
        >
          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 15,
              lineHeight: 1.4,
              padding: '6px 4px',
            }}
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
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: disabled ? 'rgba(148,163,184,0.32)' : '#2563EB',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
            }}
          >
            <Send style={{ width: 17, height: 17 }} />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: 'rgba(148,163,184,0.16)',
              color: '#374151',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
            }}
          >
            <Mic style={{ width: 19, height: 19 }} />
          </button>
        )}
      </div>
    </div>
  )

  return bar
}
