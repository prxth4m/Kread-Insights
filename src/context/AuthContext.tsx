import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserSession } from '@/types';

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async (authUserId: string): Promise<UserSession | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', authUserId)
      .single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, email: data.email, role: data.role };
  };

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await loadProfile(session.user.id);
        setUser(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Login failed');
    const profile = await loadProfile(data.user.id);
    if (!profile) throw new Error('User profile not found. Please contact your administrator.');
    setUser(profile);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

// Helper for components that need to attach auth headers to Supabase queries
// (Supabase JS client handles auth automatically via session, so this is mostly
// a compatibility shim for any remaining code that checks for a token)
export async function getSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Keep this export name to avoid breaking imports in other files, but it now
// returns null as Supabase client handles auth automatically
export function getAuthToken(): string | null {
  // This is synchronous and used in many places; return null as a safe fallback
  // All data fetching should use the supabase client directly, which handles auth automatically
  return null;
}
