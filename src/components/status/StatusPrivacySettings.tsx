import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StatusPrivacyType } from "@/types/chat";
import { X, ShieldCheck } from "lucide-react";

interface StatusPrivacySettingsProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "chirp.statusPrivacy";

export function StatusPrivacySettings({
  open,
  onClose,
}: StatusPrivacySettingsProps) {
  const [mode, setMode] = useState<StatusPrivacyType>("contacts");

  useEffect(() => {
    const stored = localStorage.getItem(
      STORAGE_KEY,
    ) as StatusPrivacyType | null;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Immersive Privacy Panel Sheet */}
      <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-white/5 shadow-2xl shadow-black/80 p-6 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Section */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex gap-3 items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Status privacy
              </h2>
              <p className="text-xs text-zinc-400">
                Who can see your status updates
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Custom Interactive Selection Controls */}
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as StatusPrivacyType)}
          className="space-y-3"
        >
          {/* Row Item: My Contacts */}
          <label
            className={`flex items-start gap-4 rounded-2xl border p-4 cursor-pointer select-none transition-all duration-200 ${
              mode === "contacts"
                ? "bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/20"
                : "bg-zinc-950/40 border-white/5 hover:bg-zinc-950/80 hover:border-white/10"
            }`}
          >
            <RadioGroupItem
              value="contacts"
              className="mt-0.5 border-zinc-600 text-emerald-500 focus-visible:ring-emerald-500/30"
            />
            <div className="flex flex-col gap-0.5">
              <span
                className={`text-sm font-medium transition-colors ${mode === "contacts" ? "text-emerald-400" : "text-zinc-200"}`}
              >
                My contacts
              </span>
              <span className="text-xs text-zinc-400 leading-relaxed">
                Share with all contacts who have your number saved.
              </span>
            </div>
          </label>

          {/* Row Item: Contacts Except */}
          <label
            className={`flex items-start gap-4 rounded-2xl border p-4 cursor-pointer select-none transition-all duration-200 ${
              mode === "contacts_except"
                ? "bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/20"
                : "bg-zinc-950/40 border-white/5 hover:bg-zinc-950/80 hover:border-white/10"
            }`}
          >
            <RadioGroupItem
              value="contacts_except"
              className="mt-0.5 border-zinc-600 text-emerald-500 focus-visible:ring-emerald-500/30"
            />
            <div className="flex flex-col gap-0.5">
              <span
                className={`text-sm font-medium transition-colors ${mode === "contacts_except" ? "text-emerald-400" : "text-zinc-200"}`}
              >
                My contacts except...
              </span>
              <span className="text-xs text-zinc-400 leading-relaxed">
                Exclude specific contacts from viewing your changes.
              </span>
            </div>
          </label>

          {/* Row Item: Only Share With */}
          <label
            className={`flex items-start gap-4 rounded-2xl border p-4 cursor-pointer select-none transition-all duration-200 ${
              mode === "only_share_with"
                ? "bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/20"
                : "bg-zinc-950/40 border-white/5 hover:bg-zinc-950/80 hover:border-white/10"
            }`}
          >
            <RadioGroupItem
              value="only_share_with"
              className="mt-0.5 border-zinc-600 text-emerald-500 focus-visible:ring-emerald-500/30"
            />
            <div className="flex flex-col gap-0.5">
              <span
                className={`text-sm font-medium transition-colors ${mode === "only_share_with" ? "text-emerald-400" : "text-zinc-200"}`}
              >
                Only share with...
              </span>
              <span className="text-xs text-zinc-400 leading-relaxed">
                Restrict visibility exclusively to chosen friends.
              </span>
            </div>
          </label>
        </RadioGroup>

        {/* Action Button Row */}
        <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-full text-zinc-400 hover:text-white hover:bg-white/5 text-sm font-medium px-5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md font-medium px-6 hover:scale-102 active:scale-98 transition-all"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
