import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/chat';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (identifier: string, username: string, displayName: string, phone: string) => Promise<{ data: any; error: any }>;
  signIn: (identifier: string, password: string) => Promise<{ data: any; error: any }>;
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
        if (import.meta.env.DEV) {
          console.debug('[Auth Debug] onAuthStateChange', _event, session);
        }
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
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

  const signUp = async (identifier: string, username: string, displayName: string, phone: string) => {
    const isEmail = identifier.includes('@');
    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const formattedPhone = identifier.startsWith('+') ? identifier : `+234${identifier.replace(/\D/g, '')}`;
    const payload = isEmail
      ? {
          email: identifier,
          password: randomPassword,
          options: {
            data: {
              username: username.toLowerCase(),
              display_name: displayName,
              phone,
            },
          },
        }
      : {
          phone: formattedPhone,
          password: randomPassword,
          options: {
            data: {
              username: username.toLowerCase(),
              display_name: displayName,
              phone: formattedPhone,
            },
          },
        };

    if (import.meta.env.DEV) {
      console.debug('[Auth Debug] signUp payload', payload);
    }

    const { data, error } = await supabase.auth.signUp(payload as any);

    if (import.meta.env.DEV) {
      console.debug('[Auth Debug] signUp response', { data, error });
    }

    return { data, error };
  };

  const signIn = async (identifier: string, password: string) => {
    const isEmail = identifier.includes('@');
    const digits = identifier.replace(/\D/g, '');
    const formattedPhone = identifier.startsWith('+') ? identifier : `+234${digits}`;
    const payload = isEmail
      ? { email: identifier, password }
      : { phone: formattedPhone, password };

    if (import.meta.env.DEV) {
      console.debug('[Auth Debug] signIn payload', payload);
    }

    // Retry logic for network failures
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword(payload as any);

        if (import.meta.env.DEV) {
          console.debug('[Auth Debug] signIn response', { data, error });
        }

        // If we got a response (success or auth error), return it
        return { data, error };
      } catch (err: any) {
        lastError = err;
        // Retry on network errors, but not auth errors
        if (attempt < 2 && (err.message?.includes('Failed to fetch') || err.message?.includes('timeout'))) {
          console.warn(`[Auth] signIn network error attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        // Non-network error or last attempt, return the error
        return { data: null, error: err };
      }
    }

    return { data: null, error: lastError };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;

    const metadata: Record<string, any> = {};
    if (data.display_name !== undefined) metadata.display_name = data.display_name;
    if (data.username !== undefined) metadata.username = data.username;
    if (data.phone !== undefined) metadata.phone = data.phone;

    if (Object.keys(metadata).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({ data: metadata });
      if (authError) {
        throw authError;
      }
    }

    const { error } = await (supabase as any).from('profiles').update(data).eq('id', user.id);
    if (error) {
      throw error;
    }

    setProfile(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
