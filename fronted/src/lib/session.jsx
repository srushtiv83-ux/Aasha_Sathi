import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isConfigured, supabase } from './supabase.js';

const SessionContext = createContext(null);

export const LANGUAGE_CODES = { English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN' };

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(!isConfigured);
  const [profile, setProfile] = useState(null);
  // Which user the loaded `profile` belongs to (null = nothing loaded yet).
  const [profileUserId, setProfileUserId] = useState(null);

  // 1. Track the Supabase auth session.
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionReady(true);
    });

    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const loadProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      setProfileUserId(null);
      return null;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, asha_id, full_name, phone, place, languages')
      .eq('id', userId)
      .maybeSingle();
    const row = error ? null : data;
    setProfile(row);
    setProfileUserId(userId);
    return row;
  }, [userId]);

  // 2. Load the worker profile whenever the signed-in user changes.
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      configured: isConfigured,
      session,
      profile: userId && profileUserId === userId ? profile : null,
      // `loading`: still checking whether anyone is signed in.
      loading: !sessionReady,
      // `profileLoading`: signed in, but the worker's profile has not arrived yet.
      profileLoading: Boolean(userId) && profileUserId !== userId,
      voiceLanguage: LANGUAGE_CODES[profile?.languages?.[0]] ?? 'en-IN',
      reloadProfile: loadProfile,
      signOut,
    }),
    [session, profile, profileUserId, sessionReady, userId, loadProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
