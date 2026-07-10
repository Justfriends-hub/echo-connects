import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStatusComposer } from '@/hooks/useStatusComposer';
import type { StatusMediaType } from '@/types/chat';

interface MediaStatusComposerProps {
  file: File;
  mediaType: StatusMediaType;
  onClose: () => void;
}

export function MediaStatusComposer({ file, mediaType, onClose }: MediaStatusComposerProps) {
  const { postMediaStatus } = useStatusComposer();
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => { URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const handleSend = async () => {
    setUploading(true);
    await postMediaStatus(file, caption, mediaType);
    setUploading(false);
    onClose();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="text-sm font-semibold">Preview status</p>
        <Button size="sm" onClick={handleSend} disabled={uploading}>
          Send
        </Button>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-4">
        {mediaType === 'video' ? (
          <video src={fileUrl} controls className="mx-auto h-full w-full max-w-full rounded-3xl object-contain" />
        ) : (
          <img src={fileUrl} alt="preview" className="mx-auto h-full w-full max-w-full rounded-3xl object-contain" />
        )}
      </div>
      <div className="px-4 pb-6">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption"
          className="bg-white/10 text-white placeholder:text-white/60"
        />
      </div>
    </div>
  );
}
