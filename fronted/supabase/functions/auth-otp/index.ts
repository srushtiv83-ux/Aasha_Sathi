// Phone / ASHA-ID OTP login and registration.
//
// POST { action: 'send',   mode: 'login' | 'register', identifier }
// POST { action: 'verify', mode: 'login' | 'register', identifier, otp }
//
// The client never learns the phone number behind an ASHA ID. `verify` returns
// session tokens that the client passes to supabase.auth.setSession().
import {
  adminClient,
  anonClient,
  ASHA_ID_PATTERN,
  fail,
  json,
  maskPhone,
  normalizeIndianPhone,
  preflight,
} from '../_shared/http.ts';

type Body = {
  action?: string;
  mode?: string;
  identifier?: string;
  otp?: string;
};

// Resolves the identifier to an E.164 phone. For ASHA IDs this needs a profile.
async function resolvePhone(identifier: string, mode: 'login' | 'register') {
  const trimmed = identifier.trim();

  if (ASHA_ID_PATTERN.test(trimmed)) {
    if (mode === 'register') return { error: 'Register with your phone number.' };
    const { data, error } = await adminClient()
      .from('profiles')
      .select('phone')
      .eq('asha_id', trimmed.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return { error: 'No account found for that ASHA ID.' };
    return { phone: `+${data.phone}` };
  }

  const phone = normalizeIndianPhone(trimmed);
  if (!phone) return { error: 'Enter a valid 10-digit Indian phone number or ASHA ID.' };
  return { phone };
}

async function hasProfile(phone: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('phone', phone.replace(/^\+/, ''))
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'bad_json', 'Request body must be JSON.');
  }

  const { action, mode, identifier, otp } = body;
  if (action !== 'send' && action !== 'verify') return fail(400, 'bad_action', 'Unknown action.');
  if (mode !== 'login' && mode !== 'register') return fail(400, 'bad_mode', 'Unknown mode.');
  if (typeof identifier !== 'string' || identifier.length === 0 || identifier.length > 40) {
    return fail(400, 'bad_identifier', 'Enter a valid phone number or ASHA ID.');
  }

  try {
    const resolved = await resolvePhone(identifier, mode);
    if ('error' in resolved) return fail(400, 'bad_identifier', resolved.error!);
    const phone = resolved.phone!;
    const registered = await hasProfile(phone);

    if (mode === 'login' && !registered) {
      return fail(404, 'not_registered', 'No account found. Please register first.');
    }
    if (mode === 'register' && registered) {
      return fail(409, 'already_registered', 'This number is already registered. Please log in.');
    }

    const auth = anonClient().auth;

    if (action === 'send') {
      const { error } = await auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: mode === 'register' },
      });
      if (error) {
        const limited = error.status === 429 || /rate|too many|seconds/i.test(error.message);
        return limited
          ? fail(429, 'rate_limited', 'Please wait a minute before requesting another OTP.')
          : fail(502, 'otp_send_failed', 'Could not send the OTP. Please try again.');
      }
      return json({ ok: true, maskedPhone: maskPhone(phone) });
    }

    // action === 'verify'
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return fail(400, 'bad_otp', 'Enter the 6-digit OTP.');
    }
    const { data, error } = await auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error || !data.session) {
      return fail(401, 'invalid_otp', 'That OTP is incorrect or has expired.');
    }
    return json({
      ok: true,
      registered,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (err) {
    console.error('auth-otp failure', err instanceof Error ? err.message : err);
    return fail(500, 'server_error', 'Something went wrong. Please try again.');
  }
});
