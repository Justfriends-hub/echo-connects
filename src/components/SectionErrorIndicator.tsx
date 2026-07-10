import { AlertTriangle } from 'lucide-react';

interface SectionErrorIndicatorProps {
  isError: boolean;
  onRetry: () => void;
  label?: string;
}

export function SectionErrorIndicator({ isError, onRetry, label = 'Connection lost' }: SectionErrorIndicatorProps) {
  if (!isError) return null;

  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive transition hover:bg-destructive/20"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
