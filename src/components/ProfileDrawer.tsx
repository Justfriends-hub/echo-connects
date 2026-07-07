import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings, LogOut, Moon, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name?: string) =>
    (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate('/auth');
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="bg-card border-border">
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
              <AspectRatio ratio={1}>
                <Avatar className="w-full h-full">
                  <AvatarImage src={profile?.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl w-full h-full">
                    {getInitials(profile?.display_name)}
                  </AvatarFallback>
                </Avatar>
              </AspectRatio>
            </div>
            <div className="min-w-0">
              <DrawerTitle className="text-foreground text-lg truncate">
                {profile?.display_name || 'User'}
              </DrawerTitle>
              <DrawerDescription className="text-sm truncate">
                @{profile?.username || 'username'}
              </DrawerDescription>
              {profile?.bio && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>
              )}
            </div>
          </div>
        </DrawerHeader>

        <Separator className="mx-4" />

        <div className="p-4 space-y-1">
          <button
            onClick={() => handleNav('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-accent transition-colors">
            <Moon className="w-4 h-4 text-muted-foreground" />
            Dark Mode
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-accent transition-colors">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            Help & FAQ
          </button>

          <Separator className="my-2" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="border-border">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
