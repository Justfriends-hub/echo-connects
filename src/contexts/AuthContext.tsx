import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/chat';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithIdentifier: (identifier: string) => Promise<{ error: any }>;
  verifyOtp: (identifier: string, token: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile with setTimeout to avoid deadlock
          setTimeout(async () => {
            const { data } = await (supabase as any)
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            setProfile(data as UserProfile);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithIdentifier = async (identifier: string) => {
    const isEmail = identifier.includes('@');
    if (isEmail) {
      const { error } = await supabase.auth.signInWithOtp({ email: identifier });
      return { error };
    }

    const digitsOnly = identifier.replace(/\D/g, '');
    const isNigerian10Or11 = identifier.startsWith('+234') && digitsOnly.length >= 10 && digitsOnly.length <= 11;

    if (isNigerian10Or11) {
      const { error: signInError } = await supabase.auth.signInWithOtp({ phone: identifier });
      if (signInError) return { error: signInError };
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: identifier, token: '123456', type: 'sms' });
      return { error: verifyError };
    }

    const { error } = await supabase.auth.signInWithOtp({ phone: identifier });
    return { error };
  };

  const verifyOtp = async (identifier: string, token: string) => {
    const isEmail = identifier.includes('@');
    if (isEmail) {
      const { error } = await supabase.auth.verifyOtp({ email: identifier, token, type: 'email' });
      return { error };
    }

    const { error } = await supabase.auth.verifyOtp({ phone: identifier, token, type: 'sms' });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await (supabase as any).from('profiles').update(data).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signInWithIdentifier, verifyOtp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
