import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { StatusPrivacyType } from '@/types/chat';

interface StatusPrivacySettingsProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'chirp.statusPrivacy';

export function StatusPrivacySettings({ open, onClose }: StatusPrivacySettingsProps) {
  const [mode, setMode] = useState<StatusPrivacyType>('contacts');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as StatusPrivacyType | null;
    if (stored) {
      setMode(stored);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, mode);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4">
      <div className="mx-auto max-w-md rounded-3xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Status privacy</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground">Close</button>
        </div>
        <RadioGroup value={mode} onValueChange={(value) => setMode(value as StatusPrivacyType)} className="space-y-3">
          <label className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <RadioGroupItem value="contacts" />
            <div>
              <div className="font-medium">My contacts</div>
              <div className="text-sm text-muted-foreground">Visible to all contacts.</div>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <RadioGroupItem value="contacts_except" />
            <div>
              <div className="font-medium">My contacts except...</div>
              <div className="text-sm text-muted-foreground">Exclude selected contacts.</div>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <RadioGroupItem value="only_share_with" />
            <div>
              <div className="font-medium">Only share with...</div>
              <div className="text-sm text-muted-foreground">Visible only to selected contacts.</div>
            </div>
          </label>
        </RadioGroup>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}
