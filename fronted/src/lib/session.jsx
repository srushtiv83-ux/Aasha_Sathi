import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isConfigured, supabase } from './supabase.js';

const SessionContext = createContext(null);

export const LANGUAGE_CODES = { English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN' };

function getStoredLanguage() {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved && (saved === 'English' || saved === 'Hindi' || saved === 'Kannada')) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable in some restricted contexts
  }
  return 'English';
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(!isConfigured);
  const [profile, setProfile] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  // Stored language is the authoritative choice selected on the main screen
  const [appLanguage, setAppLanguageState] = useState(getStoredLanguage);

  const userId = session?.user?.id ?? null;

  const setAppLanguage = useCallback((lang) => {
    if (!lang) return;
    setAppLanguageState(lang);
    try {
      localStorage.setItem('app_language', lang);
    } catch {
      // ignore
    }
    // Also update Supabase database profile if logged in
    if (supabase && userId) {
      supabase.from('profiles').update({ languages: [lang] }).eq('id', userId).then(() => {});
    }
  }, [userId]);

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

    // CRITICAL: The language chosen on this device takes priority!
    const storedLang = getStoredLanguage();
    if (storedLang) {
      setAppLanguageState(storedLang);
      // Sync the user's database profile to match the selected language
      if (row && row.languages?.[0] !== storedLang) {
        supabase.from('profiles').update({ languages: [storedLang] }).eq('id', userId).then(() => {});
      }
    } else if (row?.languages?.[0]) {
      setAppLanguage(row.languages[0]);
    }
    return row;
  }, [userId, setAppLanguage]);

  // 2. Load the worker profile whenever the signed-in user changes.
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  // Authoritative language is appLanguage
  const effectiveLang = appLanguage || getStoredLanguage() || 'English';

  const value = useMemo(
    () => ({
      configured: isConfigured,
      session,
      profile: userId && profileUserId === userId ? profile : null,
      loading: !sessionReady,
      profileLoading: Boolean(userId) && profileUserId !== userId,
      voiceLanguage: LANGUAGE_CODES[effectiveLang] ?? 'en-IN',
      appLanguage: effectiveLang,
      setAppLanguage,
      reloadProfile: loadProfile,
      signOut,
    }),
    [session, profile, profileUserId, sessionReady, userId, effectiveLang, setAppLanguage, loadProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
