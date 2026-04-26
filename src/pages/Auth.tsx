import React, { useState } from 'react';
import { MessageCircle, ArrowRight, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [step, setStep] = useState<'phone' | 'otp' | 'username'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithPhone, verifyOtp, updateProfile } = useAuth();
  const navigate = useNavigate();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 11);
  };

  const handleSendOtp = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setError('Enter a valid Nigerian phone number (10-11 digits)');
      return;
    }
    setLoading(true);
    const fullPhone = `+234${digits}`;
    const { error } = await signInWithPhone(fullPhone);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      // For 10 or 11 digit numbers, auto-verified, skip OTP
      if (digits.length === 10 || digits.length === 11) {
        setStep('username');
      } else {
        setStep('otp');
      }
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length < 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    const fullPhone = `+234${phone.replace(/\D/g, '')}`;
    const { error } = await verifyOtp(fullPhone, otp);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep('username');
    }
  };

  const handleSetUsername = async () => {
    setError('');
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        display_name: displayName.trim(),
        phone: `+234${phone.replace(/\D/g, '')}`,
      });
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Failed to set profile');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Chirp</h1>
          <p className="text-muted-foreground text-sm mt-1">Fast & secure messaging</p>
        </div>

        {/* Phone Step */}
        {step === 'phone' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-sm text-foreground mb-3">Enter your phone number to get started</p>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 px-3 bg-secondary rounded-lg text-sm text-foreground border border-input">
                  <span>🇳🇬</span>
                  <span>+234</span>
                </div>
                <Input
                  type="tel"
                  placeholder="8012345678"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  className="flex-1 bg-secondary border-0"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-sm text-foreground mb-1">We sent a code to</p>
              <p className="text-sm text-primary font-medium">+234 {phone}</p>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-lg tracking-widest bg-secondary border-0"
              autoFocus
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleVerifyOtp} className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
            <button onClick={() => setStep('phone')} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
              Change number
            </button>
          </div>
        )}

        {/* Username Step */}
        {step === 'username' && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-foreground">Set up your profile</p>
            <div className="space-y-3">
              <Input
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-secondary border-0"
                autoFocus
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  placeholder="username"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="pl-8 bg-secondary border-0"
                />
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleSetUsername} className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Start Chatting'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
