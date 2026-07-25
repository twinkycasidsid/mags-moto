import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { usernameToAuthEmail } from '../lib/username';
import type { AuthProfile } from '../types';

interface AuthContextValue {
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  loggingIn: boolean;
  login: (username: string, password: string) => Promise<AuthProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, role, active')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data as AuthProfile;
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await fetchProfile(nextSession.user.id);
        if (!nextProfile.active) {
          await supabase.auth.signOut();
          throw new Error('This user account is deactivated.');
        }

        if (mounted) {
          setProfile(nextProfile);
        }
      } catch (error) {
        if (mounted) {
          setProfile(null);
        }
        throw error;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => syncSession(data.session))
      .catch(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string) => {
    setLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(username),
        password,
      });

      if (error || !data.user) {
        throw new Error('Invalid username or password.');
      }

      const nextProfile = await fetchProfile(data.user.id);
      if (!nextProfile.active) {
        await supabase.auth.signOut();
        throw new Error('This user account is deactivated.');
      }

      setProfile(nextProfile);
      return nextProfile;
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      loggingIn,
      login,
      logout,
    }),
    [session, profile, loading, loggingIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
};
