import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Eye, EyeOff, User, Bell, Lock, Palette, Shield, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const profileSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(50),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  bio: z.string().max(160, 'Bio must be 160 characters or less').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut } = useAuth();

  // Settings state
  const [showOnline, setShowOnline] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifVibration, setNotifVibration] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  const [notifVolume, setNotifVolume] = useState([70]);
  const [fontSize, setFontSize] = useState([16]);
  const [bubbleStyle, setBubbleStyle] = useState('rounded');
  const [language, setLanguage] = useState('en');

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
    },
  });

  React.useEffect(() => {
    if (profile) {
      form.reset({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
      });
    }
  }, [profile, form]);

  // Profile completion
  const getProfileCompletion = () => {
    let score = 0;
    if (profile?.display_name) score += 25;
    if (profile?.username) score += 25;
    if (profile?.bio) score += 25;
    if (user?.email) score += 25;
    return score;
  };

  const handleUpdateProfile = async (values: ProfileFormValues) => {
    setLoading(true);
    try {
      await updateProfile({
        username: values.username,
        display_name: values.display_name,
        bio: values.bio,
      });
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
    setLoading(false);
  };

  const handleSetPassword = async () => {
    if (!password || !confirmPassword) {
      toast.error('Please enter and confirm password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.updateUser({ password });
      setPassword('');
      setConfirmPassword('');
      toast.success('Password set successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set password');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const completionPct = getProfileCompletion();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Profile Completion */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profile completion</span>
              <span className="text-sm font-medium text-foreground">{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-2" />
          </div>

          <Separator />

          {/* Accordion Sections */}
          <Accordion type="multiple" defaultValue={['profile']} className="space-y-2">
            {/* Profile Section */}
            <AccordionItem value="profile" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-card/50 [&[data-state=open]]:bg-card">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">Profile</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="display_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Your name" className="bg-secondary border-0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                              <Input {...field} placeholder="username" className="pl-8 bg-secondary border-0"
                                onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                            </div>
                          </FormControl>
                          <FormDescription>Only lowercase letters, numbers, and underscores</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Tell people about yourself..." className="bg-secondary border-0 resize-none" rows={3} />
                          </FormControl>
                          <FormDescription>{(field.value?.length || 0)}/160 characters</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Email: {user?.email || 'Not set'}</p>
                      <p>Phone: {profile?.phone || 'Not set'}</p>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gap-2">
                      <Save className="w-4 h-4" />
                      Save Profile
                    </Button>
                  </form>
                </Form>
              </AccordionContent>
            </AccordionItem>

            {/* Security Section */}
            <AccordionItem value="security" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-card/50 [&[data-state=open]]:bg-card">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="font-medium">Security</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <p className="text-xs text-muted-foreground">Set a password to login on another device</p>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="bg-secondary border-0 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Confirm Password</Label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="bg-secondary border-0"
                  />
                </div>
                <Button onClick={handleSetPassword} disabled={loading} className="w-full gap-2">
                  <Save className="w-4 h-4" />
                  Set Password
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Notifications Section */}
            <AccordionItem value="notifications" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-card/50 [&[data-state=open]]:bg-card">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="font-medium">Notifications</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox id="notif-sounds" checked={notifSounds} onCheckedChange={(v) => setNotifSounds(!!v)} />
                    <Label htmlFor="notif-sounds" className="text-sm">Notification sounds</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="notif-vibration" checked={notifVibration} onCheckedChange={(v) => setNotifVibration(!!v)} />
                    <Label htmlFor="notif-vibration" className="text-sm">Vibration</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="notif-preview" checked={notifPreview} onCheckedChange={(v) => setNotifPreview(!!v)} />
                    <Label htmlFor="notif-preview" className="text-sm">Message preview</Label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Notification Volume</Label>
                  <div className="flex items-center gap-3">
                    <Slider value={notifVolume} onValueChange={setNotifVolume} max={100} step={1} className="flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{notifVolume[0]}%</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Privacy Section */}
            <AccordionItem value="privacy" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-card/50 [&[data-state=open]]:bg-card">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium">Privacy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Show online status</p>
                    <p className="text-xs text-muted-foreground">Let others see when you're active</p>
                  </div>
                  <Switch checked={showOnline} onCheckedChange={setShowOnline} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Read receipts</p>
                    <p className="text-xs text-muted-foreground">Show blue ticks when you read messages</p>
                  </div>
                  <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Typing indicators</p>
                    <p className="text-xs text-muted-foreground">Show when you are typing</p>
                  </div>
                  <Switch checked={typingIndicators} onCheckedChange={setTypingIndicators} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Appearance Section */}
            <AccordionItem value="appearance" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:bg-card/50 [&[data-state=open]]:bg-card">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <span className="font-medium">Appearance</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Font Size</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">A</span>
                    <Slider value={fontSize} onValueChange={setFontSize} min={12} max={22} step={1} className="flex-1" />
                    <span className="text-base text-muted-foreground font-bold">A</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{fontSize[0]}px</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Chat Bubble Style</Label>
                  <RadioGroup value={bubbleStyle} onValueChange={setBubbleStyle} className="flex gap-3">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="rounded" id="rounded" />
                      <Label htmlFor="rounded" className="text-sm">Rounded</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="square" id="square" />
                      <Label htmlFor="square" className="text-sm">Square</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="minimal" id="minimal" />
                      <Label htmlFor="minimal" className="text-sm">Minimal</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-secondary border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="yo">Yorùbá</SelectItem>
                      <SelectItem value="ha">Hausa</SelectItem>
                      <SelectItem value="ig">Igbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator />

          {/* Account Actions */}
          <div className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 text-foreground border-border">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need your email/phone and password to sign back in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All your messages, chats, and data will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => toast.info('Account deletion is not yet implemented')}>
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
