// Shared helpers for ASHA Sathi Edge Functions.
import { createClient, type User } from 'npm:@supabase/supabase-js@2';

// Set ALLOWED_ORIGIN (e.g. https://your-app.vercel.app) once the app is deployed.
// Requests use bearer tokens, not cookies, so '*' is safe for local development.
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function fail(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

export function supabaseEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase environment is not configured');
  return { url, anonKey, serviceKey };
}

export function adminClient() {
  const { url, serviceKey } = supabaseEnv();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// verify_jwt also accepts the public anon key, so confirm a real signed-in user.
export async function requireUser(req: Request): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ---- phone helpers -------------------------------------------------------

// Accepts "98765 43210", "+91 98765-43210", "919876543210". Returns "+919876543210" or null.
export function normalizeIndianPhone(value: string): string | null {
  const digits = value.replace(/[\s()+-]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)}******${e164.slice(-3)}`;
}

export const ASHA_ID_PATTERN = /^ASHA-[A-Z0-9-]+$/i;
