import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  account_type: 'guardian' | 'adult_student' | 'teacher' | 'other';
  plan: 'free' | 'plus' | 'school';
  is_admin: boolean;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue>({
  session: null, profile: null, loading: false, configured: false,
  refreshProfile: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) { setProfile(null); return; }
    const { data } = await supabase
      .from('user_profiles').select('id,display_name,account_type,plan,is_admin').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer DB calls out of the auth callback to avoid supabase-js lock re-entrancy.
      setTimeout(() => { if (active) loadProfile(s); }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthValue>(() => ({
    session,
    profile,
    loading,
    configured: !!supabase,
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [session, profile, loading, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
