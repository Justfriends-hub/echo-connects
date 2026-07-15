import React, { useState } from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Auth() {
  const [step, setStep] = useState<'identifier' | 'username'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const invite = new URLSearchParams(location.search).get('invite');

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    if (!domain.includes('.')) return false;
    return true;
  };

  const handleContinue = async () => {
    setError('');
    const isEmail = identifier.includes('@');
    const digits = identifier.replace(/\D/g, '');

    if (isEmail) {
      if (!validateEmail(identifier)) {
        setError('Enter a valid email address');
        return;
      }
    } else {
      if (digits.length < 10 || digits.length > 11) {
        setError('Enter a valid phone number (10-11 digits)');
        return;
      }
    }

    setStep('username');
  };

  const handleSignUp = async () => {
    setError('');
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    const isEmail = identifier.includes('@');
    const digits = identifier.replace(/\D/g, '');
    const fullPhone = isEmail ? phone : `+234${digits}`;

    if (!isEmail && (!phone || phone.replace(/\D/g, '').length < 10)) {
      setError('Enter a valid phone number');
      return;
    }

    setLoading(true);
    const result = await signUp(
      identifier,
      username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      displayName.trim(),
      fullPhone
    );
    setLoading(false);

    if (result.error) {
      console.error('[Auth Debug] signup failed', result.error, result.data);
      setError(result.error?.message || 'Sign up failed');
    } else {
      console.debug('[Auth Debug] signup success', result.data);
      navigate(invite ? `/join/${invite}` : '/');
    }
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

        {/* Identifier Step */}
        {step === 'identifier' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-sm text-foreground mb-3">Enter your email or phone number to get started</p>
              <Input
                type="text"
                placeholder="email@example.com or 8012345678"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full bg-secondary border-0"
                autoFocus
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleContinue} className="w-full" disabled={loading}>
              {loading ? 'Continuing...' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Username Step */}
        {step === 'username' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-sm text-foreground mb-2">Almost there! Set up your profile</p>
              <p className="text-xs text-muted-foreground">
                {identifier.includes('@') ? identifier : `+234${identifier.replace(/\D/g, '')}`}
              </p>
            </div>
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
              {!identifier.includes('@') && (
                <Input
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-secondary border-0"
                />
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleSignUp} className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Start Chatting'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <button onClick={() => setStep('identifier')} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
              Use different email/phone
            </button>
            <Button onClick={() => navigate(invite ? `/login?invite=${invite}` : '/login')} variant="outline" className="w-full mt-2">
              Already have an account? Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

