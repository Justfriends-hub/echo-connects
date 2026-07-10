import { useState } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStatusComposer } from '@/hooks/useStatusComposer';
import { StatusPrivacySettings } from './StatusPrivacySettings';

const COLORS = ['#1B5E20', '#0D47A1', '#4A148C', '#BF360C', '#1A237E', '#263238'];

interface TextStatusComposerProps {
  onClose: () => void;
}

export function TextStatusComposer({ onClose }: TextStatusComposerProps) {
  const { postTextStatus, getPrivacyPreference, setPrivacyPreference } = useStatusComposer();
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [sending, setSending] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);

  const privacyMode = getPrivacyPreference();

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    await postTextStatus(text.trim(), bgColor);
    setSending(false);
    onClose();
  };

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Text status</p>
            <Button variant="ghost" size="icon" onClick={() => setShowPrivacySettings(true)}>
              <Palette className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
            Send
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          <div className="mb-4 text-sm text-white/80">Tap a color to change your status background</div>
          <div className="grid grid-cols-3 gap-3 w-full max-w-md">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="h-16 rounded-2xl border-2 transition-all"
                style={{ backgroundColor: color, borderColor: bgColor === color ? '#fff' : 'transparent' }}
                onClick={() => setBgColor(color)}
              />
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a status..."
            className="mt-6 min-h-[160px] max-w-md bg-white/10 text-white placeholder:text-white/60"
          />
          <div className="mt-6 flex items-center justify-between w-full max-w-md text-xs text-white/70">
            <span>Privacy: {privacyMode.replace('_', ' ')}</span>
            <button type="button" onClick={() => setPrivacyPreference('contacts')} className="underline">
              My contacts
            </button>
          </div>
        </div>
      </div>
      <StatusPrivacySettings open={showPrivacySettings} onClose={() => setShowPrivacySettings(false)} />
    </>
  );
}
