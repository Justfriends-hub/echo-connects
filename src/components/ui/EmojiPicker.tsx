import React, { useMemo, useState } from 'react';

interface EmojiPickerProps {
  allowed?: string[];
  onSelect: (emoji: string) => void;
  placeholder?: string;
}

const DEFAULT_EMOJIS = ['👍','❤️','🔥','😂','😮','😢','🎉','🙏','👏','😅','🤔','😎','😇','🤩','💯','✨','🤝','🎶','🧡','😴'];

export default function EmojiPicker({ allowed, onSelect, placeholder }: EmojiPickerProps) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => (allowed && allowed.length > 0 ? allowed : DEFAULT_EMOJIS), [allowed]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(e => e.includes(q));
  }, [list, query]);

  return (
    <div className="w-full">
      <div className="mb-2">
        <input
          aria-label={placeholder || 'Search emojis'}
          placeholder={placeholder || 'Search emojis...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border px-2 py-1 text-sm bg-transparent"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="px-2 py-1 rounded-md hover:bg-muted/60 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
