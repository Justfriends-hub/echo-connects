import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StatusReplyBarProps {
  onSend: (message: string) => Promise<void>;
}

export function StatusReplyBar({ onSend }: StatusReplyBarProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    await onSend(message.trim());
    setMessage('');
    setSending(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-black/70 backdrop-blur-sm">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Send a reply"
        className="bg-white/10 text-white placeholder:text-white/70"
      />
      <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()}>
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
