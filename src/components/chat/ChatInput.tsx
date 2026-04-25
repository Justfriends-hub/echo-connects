import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onTyping, disabled, placeholder = "Message" }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

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
    <div className="flex items-end gap-2 p-3 bg-chat-input-bg border-t border-border">
      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground flex-shrink-0 mb-0.5">
        <Paperclip className="w-5 h-5" />
      </Button>
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={() => onTyping?.()}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className={cn(
            "w-full resize-none bg-secondary rounded-2xl px-4 py-2.5 text-sm text-foreground",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
            "max-h-[120px] transition-colors"
          )}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 bottom-0.5 text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </div>
      {text.trim() ? (
        <Button
          onClick={handleSend}
          size="icon"
          className="bg-primary hover:bg-primary/90 rounded-full flex-shrink-0 mb-0.5 w-10 h-10"
          disabled={disabled}
        >
          <Send className="w-4 h-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground flex-shrink-0 mb-0.5">
          <Mic className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
