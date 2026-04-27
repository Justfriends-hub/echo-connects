import React, { useState } from 'react';
import { LogIn, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const validateIdentifier = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /\\s/.test(trimmed)) return false;
    if (trimmed.includes('@')) {
      const parts = trimmed.split('@');
      if (parts.length !== 2) return false;
      const [local, domain] = parts;
      if (!local || !domain) return false;
      if (domain.startsWith('.') || domain.endsWith('.')) return false;
      if (!domain.includes('.')) return false;
      return true;
    }
    const digits = trimmed.replace(/\\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  };

  const handleLogin = async () => {
    setError('');

    if (!validateIdentifier(identifier)) {
      setError('Enter a valid email address or phone number');
      return;
    }

    if (!password) {
      setError('Enter your password');
      return;
    }

    setLoading(true);
    const result = await signIn(identifier, password);
    setLoading(false);

    if (result.error) {
      setError(result.error.message || 'Login failed. Please check your credentials.');
      return;
    }

    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="text-muted-foreground text-sm mt-1">Use your email or phone number and password</p>
        </div>

        <div className="space-y-4 animate-fade-in">
          <div>
            <p className="text-sm text-foreground mb-3">Login with email or phone number</p>
            <Input
              type="text"
              placeholder="email@example.com or 8012345678"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="w-full bg-secondary border-0"
              autoFocus
            />
          </div>

          <div>
            <p className="text-sm text-foreground mb-3">Password</p>
            <Input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-secondary border-0"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button onClick={handleLogin} className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/auth" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
            <p className="mt-2">If you haven&apos;t set a password yet, open Settings after signup.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
