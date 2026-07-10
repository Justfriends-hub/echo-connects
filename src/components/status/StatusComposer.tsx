import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Camera, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextStatusComposer } from './TextStatusComposer';
import { MediaStatusComposer } from './MediaStatusComposer';
import type { StatusMediaType } from '@/types/chat';

interface StatusComposerProps {
  open: boolean;
  onClose: () => void;
}

export function StatusComposer({ open, onClose }: StatusComposerProps) {
  const [mode, setMode] = useState<'entry' | 'text' | 'media'>('entry');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<StatusMediaType>('image');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    setMode('media');
  };

  const chooseMedia = () => {
    fileInputRef.current?.click();
  };

  const reset = () => {
    setMode('entry');
    setSelectedFile(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={mode === 'entry' ? onClose : reset} className="rounded-full p-2 bg-white/10 hover:bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm font-semibold">Create status</p>
            <p className="text-xs text-white/70">Choose media or write a text update</p>
          </div>
        </div>
      </div>

      {mode === 'entry' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Button variant="secondary" size="lg" onClick={() => setMode('text')} className="w-full max-w-sm gap-2">
            <Type className="w-4 h-4" /> Text Status
          </Button>
          <Button variant="secondary" size="lg" onClick={chooseMedia} className="w-full max-w-sm gap-2">
            <Camera className="w-4 h-4" /> Photo / Video
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        </div>
      ) : mode === 'text' ? (
        <TextStatusComposer onClose={onClose} />
      ) : (
        selectedFile ? <MediaStatusComposer file={selectedFile} mediaType={mediaType} onClose={onClose} /> : null
      )}
    </div>
  );
}
