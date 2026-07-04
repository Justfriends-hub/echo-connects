import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { MessageCircle, Settings, Shield, LogOut, Search, UserPlus, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  if (!user) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search chats, actions, settings..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAction(() => navigate('/'))}>
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>Go to Chats</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigate('/admin'))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Admin Dashboard</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAction(() => {
            // Dispatch a custom event that ChatLayout listens for
            window.dispatchEvent(new CustomEvent('open-new-chat'));
          })}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Start New Chat</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => {
            window.dispatchEvent(new CustomEvent('open-new-chat', { detail: { type: 'group' } }));
          })}>
            <Hash className="mr-2 h-4 w-4" />
            <span>Create Group Chat</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => runAction(async () => {
            await signOut();
            navigate('/auth');
          })}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
