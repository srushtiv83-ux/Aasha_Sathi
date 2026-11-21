import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The anon key is public by design: Row Level Security in the database is what
// protects the data. Never put the service-role key or GNANI_API_KEY here.
export const isConfigured = Boolean(url && anonKey);

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

// Calls an Edge Function and returns the raw Response (so audio can be read as a blob).
// Throws an Error with a user-readable message when the function reports a failure.
export async function callFunction(name, { json, formData, signal } = {}) {
  if (!supabase) throw new Error('The app is not connected to Supabase yet.');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;

  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  let body;
  if (formData) {
    body = formData; // the browser sets the multipart boundary itself
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers, body, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('Could not reach the server. Check your internet connection.');
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const error = new Error(payload?.error?.message ?? 'Something went wrong. Please try again.');
    error.code = payload?.error?.code ?? `http_${res.status}`;
    error.status = res.status;
    throw error;
  }
  return res;
}
