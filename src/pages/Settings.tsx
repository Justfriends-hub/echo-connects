import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await supabase.auth.updateUser({ data: { display_name: displayName } });
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
        <div className="max-w-md mx-auto space-y-6">
          {/* Profile Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Display Name</label>
              <Input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-secondary border-0"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Email: {user?.email || 'Not set'}</p>
              <p>Phone: {profile?.phone || 'Not set'}</p>
            </div>
            <Button onClick={handleUpdateProfile} disabled={loading} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Save Profile
            </Button>
          </div>

          {/* Password Section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h2 className="text-sm font-semibold text-foreground">Password</h2>
            <p className="text-xs text-muted-foreground">Set a password to login on another device</p>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">New Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="bg-secondary border-0 pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Confirm Password</label>
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
          </div>
        </div>
      </div>
    </div>
  );
}
