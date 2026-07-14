import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send, Mic } from 'lucide-react'

interface TextBarProps {
  onSend: (content: string) => void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  onHeightChange?: (height: number) => void
  onKeyboardHeightChange?: (height: number) => void
}

export default function TextBar({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Message',
  onHeightChange,
  onKeyboardHeightChange,
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
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }, [disabled, onSend, text])

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
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: `${keyboardHeight}px`,
        zIndex: 999,
        display: 'flex',
        gap: 12,
        padding: '10px',
        alignItems: 'flex-end',
        background: 'rgba(255,255,255,0.94)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        boxSizing: 'border-box',
        paddingBottom: keyboardHeight === 0 ? 'env(safe-area-inset-bottom)' : '0px',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            background: 'rgba(248,250,252,0.95)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 20,
            padding: '6px 8px',
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
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
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
