'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import type { User, AuthError } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  userName: string;
  isGuest: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ data: any; error: AuthError | null }>;
  signOut: () => Promise<void>;
  continueAsGuest: (guestName?: string) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userName: 'User',
  isGuest: false,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ data: null, error: null }),
  signOut: async () => {},
  continueAsGuest: () => {},
});

export const useAuth = () => useContext(AuthContext);

const GUEST_KEY = 'scangenie_guest_mode';
const GUEST_NAME_KEY = 'scangenie_guest_name';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestNameState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check for Supabase session
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          localStorage.removeItem(GUEST_KEY);
        } else if (localStorage.getItem(GUEST_KEY) === 'true') {
          // Restore guest mode
          setIsGuest(true);
          setGuestNameState(localStorage.getItem(GUEST_NAME_KEY) || 'Guest');
        }
      } catch {
        // If Supabase client isn't configured, check guest mode
        if (localStorage.getItem(GUEST_KEY) === 'true') {
          setIsGuest(true);
          setGuestNameState(localStorage.getItem(GUEST_NAME_KEY) || 'Guest');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Listen for auth state changes
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          localStorage.removeItem(GUEST_KEY);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: name?.trim() ? { name: name.trim() } : {},
      },
    });
    if (data?.session?.user) {
      setUser(data.session.user);
      setIsGuest(false);
      localStorage.removeItem(GUEST_KEY);
    }
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(GUEST_NAME_KEY);
  }, []);

  const continueAsGuest = useCallback((nameInput?: string) => {
    setIsGuest(true);
    localStorage.setItem(GUEST_KEY, 'true');
    const finalName = nameInput?.trim() || 'Guest';
    setGuestNameState(finalName);
    localStorage.setItem(GUEST_NAME_KEY, finalName);
  }, []);

  // Compute clean display userName
  const rawName = user?.user_metadata?.name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : null) || (isGuest ? (guestName || 'Guest') : 'User');
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <AuthContext.Provider value={{ user, userName, isGuest, isLoading, signIn, signUp, signOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}
