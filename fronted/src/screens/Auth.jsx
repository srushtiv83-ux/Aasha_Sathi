import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { LOGO_MAIN } from '../components/Logo.jsx';
import { callFunction, supabase } from '../lib/supabase.js';
import { useSession } from '../lib/session.jsx';
import { useTranslation } from '../lib/i18n.js';
import { navigate } from '../App.jsx';

const INPUT =
  'w-full min-h-12 px-gutter-md rounded-sm bg-light-surface-container-lowest border border-light-outline text-light-on-surface font-body text-body-lg focus:border-light-primary focus:ring-1 focus:ring-light-primary';
const INPUT_FLEX =
  'min-w-0 flex-1 min-h-12 px-gutter-md rounded-sm bg-light-surface-container-lowest border border-light-outline text-light-on-surface font-body text-body-lg focus:border-light-primary focus:ring-1 focus:ring-light-primary';
const INPUT_MONO =
  'w-full min-h-12 px-gutter-md rounded-sm bg-light-surface-container-lowest border border-light-outline text-light-on-surface font-mono text-mono-md focus:border-light-primary focus:ring-1 focus:ring-light-primary';
const LABEL = 'font-label text-label-lg text-light-on-surface';
const OTP_BTN =
  'min-h-12 px-gutter-md rounded-sm bg-light-secondary-container text-light-on-secondary-container font-label text-label-sm shrink-0';
const PRIMARY =
  'w-full min-h-14 px-gutter-lg rounded-full bg-light-primary text-light-on-primary font-label text-label-lg inline-flex items-center justify-center gap-gutter-sm transition-colors duration-state-change ease-state-change hover:bg-light-primary-container';
const LINK =
  'min-h-11 px-gutter-sm font-label text-label-lg text-light-primary underline underline-offset-4';
const TAB_ON =
  'min-h-12 px-gutter-md rounded-full bg-light-primary text-light-on-primary font-label text-label-lg transition-colors duration-state-change ease-state-change';
const TAB_OFF =
  'min-h-12 px-gutter-md rounded-full bg-light-surface-container-low text-light-on-surface-variant font-label text-label-lg transition-colors duration-state-change ease-state-change';

function isValidPhone(value) {
  const normalized = value.replace(/[\s()-]/g, '');
  return /^(?:\+?91)?[6-9]\d{9}$/.test(normalized);
}

export default function Auth({ initialMode = 'login' }) {
  const { session, reloadProfile, appLanguage } = useSession();
  const [mode, setMode] = useState(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [place, setPlace] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  // Phone already verified but the profile was never created (e.g. the connection dropped).
  const [verified, setVerified] = useState(false);
  const phoneVerified = verified || (!isLogin && Boolean(session));

  const t = useTranslation();

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setOtp('');
    setOtpSent(false);
    setError('');
    setStatus('');
  };

  const changeIdentifier = (value) => {
    setIdentifier(value);
    setOtp('');
    setOtpSent(false);
    setError('');
    setStatus('');
  };

  const validIdentifier = () => {
    const validLoginId = /^ASHA-[A-Z0-9-]+$/i.test(identifier.trim());
    return isLogin ? validLoginId || isValidPhone(identifier) : isValidPhone(identifier);
  };

  const sendOtp = async () => {
    if (busy) return;
    if (!validIdentifier()) {
      setError(isLogin ? t('errValidPhoneOrId') : t('errValidPhone'));
      setStatus('');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('');
    try {
      const res = await callFunction('auth-otp', {
        json: { action: 'send', mode, identifier: identifier.trim() },
      });
      const payload = await res.json();
      setOtp('');
      setOtpSent(true);
      setStatus(t('statusOtpSent', { phone: payload.maskedPhone }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createProfile = async () => {
    // Language selected at the starting page is used for profile creation
    const { error: rpcError } = await supabase.rpc('create_profile', {
      p_full_name: fullName,
      p_date_of_birth: dateOfBirth,
      p_place: place,
      p_languages: [appLanguage || 'English'],
    });
    // "Profile already exists" means an earlier attempt succeeded; carry on.
    if (rpcError && rpcError.code !== '23505') throw new Error(t('errProfileFailed'));
    await reloadProfile(); // the router then moves to the dashboard
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      if (!phoneVerified) {
        if (!validIdentifier()) {
          setError(isLogin ? t('errValidPhoneOrIdSubmit') : t('errValidPhoneSubmit'));
          return;
        }
        if (!otpSent) {
          setError(t('errRequestOtp'));
          return;
        }
        if (!/^\d{6}$/.test(otp)) {
          setError(t('errEnterOtp'));
          return;
        }

        const res = await callFunction('auth-otp', {
          json: { action: 'verify', mode, identifier: identifier.trim(), otp },
        });
        const payload = await res.json();
        const { error: sessionError } = await supabase.auth.setSession(payload.session);
        if (sessionError) throw new Error(t('errSessionFailed'));
        setVerified(true);
      }

      if (!isLogin) await createProfile();
      // Login: the router moves to the dashboard once the profile loads.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto px-page-margin py-gutter-xl flex flex-col justify-center gap-gutter-lg bg-light-surface">
      {/* Top bar with back to starting page */}
      <div>
        <button
          type="button"
          onClick={() => navigate('splash')}
          className="inline-flex items-center gap-1 text-light-primary font-label text-label-sm hover:underline"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          <span>ASHA Sathi</span>
        </button>
      </div>

      <header className="flex flex-col items-center text-center gap-gutter-sm">
        <img src={LOGO_MAIN} alt="ASHA Sathi logo" className="w-24 h-24 rounded-full object-cover border border-light-outline-variant bg-light-surface-container-lowest" />
        <div className="flex flex-col gap-gutter-xs">
          <h1 className="font-display text-display-lg-mobile text-light-on-surface">ASHA Sathi</h1>
          <p className="font-body text-body-md text-light-on-surface-variant text-pretty">{t('appTagline')}</p>
        </div>
      </header>

      <main className="bg-light-surface-container-lowest border border-light-outline-variant rounded-md p-gutter-lg flex flex-col gap-gutter-lg">
        <div role="tablist" aria-label="Account view" className="grid grid-cols-2 gap-gutter-xs p-gutter-xs rounded-full bg-light-surface-container-low">
          <button id="tab-login" role="tab" aria-selected={isLogin} aria-controls="panel-login" type="button" onClick={() => changeMode('login')} className={isLogin ? TAB_ON : TAB_OFF}>
            <span>{t('tabLogin')}</span>
          </button>
          <button id="tab-register" role="tab" aria-selected={!isLogin} aria-controls="panel-register" type="button" onClick={() => changeMode('register')} className={!isLogin ? TAB_ON : TAB_OFF}>
            <span>{t('tabRegister')}</span>
          </button>
        </div>

        {error && <p role="alert" className="font-body text-body-md text-light-error">{error}</p>}
        {status && <p role="status" aria-live="polite" className="font-body text-body-md text-light-primary">{status}</p>}

        {/* ── LOGIN PANEL ── */}
        <section id="panel-login" role="tabpanel" aria-labelledby="tab-login" hidden={!isLogin}>
          <form onSubmit={submit} className="flex flex-col gap-gutter-md">
            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="login-phone" className={LABEL}>{t('labelPhoneOrId')}</label>
              <div className="flex items-center gap-gutter-sm">
                <input
                  id="login-phone"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  placeholder={t('placeholderPhoneOrId')}
                  value={identifier}
                  onChange={(event) => changeIdentifier(event.target.value)}
                  className={INPUT_FLEX}
                />
                <button type="button" onClick={sendOtp} disabled={busy} className={`${OTP_BTN} disabled:opacity-60`}>
                  <span>{otpSent ? t('btnResendOtp') : t('btnSendOtp')}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="login-otp" className={LABEL}>{t('labelOtp')}</label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required={!phoneVerified}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('placeholderOtp')}
                className={INPUT_MONO}
              />
            </div>

            <button type="submit" disabled={busy} className={`${PRIMARY} disabled:opacity-60`}>
              <Icon name="login" className="text-[22px]" />
              <span>{busy ? t('btnBusy') : t('btnLogin')}</span>
            </button>

            <div className="text-center">
              <button type="button" onClick={() => changeMode('register')} className={LINK}>
                <span>{t('linkNewWorker')}</span>
              </button>
            </div>
          </form>
        </section>

        {/* ── REGISTER PANEL ── */}
        <section id="panel-register" role="tabpanel" aria-labelledby="tab-register" hidden={isLogin}>
          <form onSubmit={submit} className="flex flex-col gap-gutter-md">
            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-name" className={LABEL}>{t('labelFullName')}</label>
              <input id="reg-name" type="text" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t('placeholderFullName')} className={INPUT} />
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-phone" className={LABEL}>{t('labelPhone')}</label>
              <div className="flex items-center gap-gutter-sm">
                <input
                  id="reg-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={identifier}
                  onChange={(event) => changeIdentifier(event.target.value)}
                  placeholder={t('placeholderPhone')}
                  className={INPUT_FLEX}
                />
                <button type="button" onClick={sendOtp} disabled={busy} className={`${OTP_BTN} disabled:opacity-60`}>
                  <span>{otpSent ? t('btnResendOtp') : t('btnSendOtp')}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-otp" className={LABEL}>{t('labelOtp')}</label>
              <input
                id="reg-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required={!phoneVerified}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('placeholderOtp')}
                className={INPUT_MONO}
              />
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-dob" className={LABEL}>{t('labelDob')}</label>
              <input id="reg-dob" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={INPUT} />
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-place" className={LABEL}>{t('labelPlace')}</label>
              <input id="reg-place" type="text" required value={place} onChange={(event) => setPlace(event.target.value)} placeholder={t('placeholderPlace')} className={INPUT} />
            </div>

            <div className="flex flex-col gap-gutter-xs">
              <label htmlFor="reg-emp-no" className={LABEL}>{t('labelEmpNo')}</label>
              <input id="reg-emp-no" type="text" readOnly value={t('placeholderEmpNo')} className="w-full min-h-12 px-gutter-md rounded-sm bg-light-surface-container-low border border-light-outline-variant text-light-on-surface-variant font-body text-body-md" />
            </div>

            <button type="submit" disabled={busy} className={`${PRIMARY} disabled:opacity-60`}>
              <Icon name="person_add" className="text-[22px]" />
              <span>{busy ? t('btnBusy') : t('btnRegister')}</span>
            </button>

            <div className="text-center">
              <button type="button" onClick={() => changeMode('login')} className={LINK}>
                <span>{t('linkAlreadyRegistered')}</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
