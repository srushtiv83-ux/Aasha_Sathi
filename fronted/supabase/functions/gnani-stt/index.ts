// Speech-to-text through Gnani Vachana (Prisma). Keeps GNANI_API_KEY server-side.
//
// POST multipart/form-data
//   audio_file     WAV/MP3/OGG/FLAC/AAC/M4A, max 30 s (the app sends 16 kHz mono WAV)
//   language_code  en-IN | hi-IN | kn-IN
// Requires a signed-in user.
import { fail, json, preflight, requireUser } from '../_shared/http.ts';

const GNANI_STT_URL = 'https://api.vachana.ai/stt/v3';
const LANGUAGES = new Set(['en-IN', 'hi-IN', 'kn-IN']);
const MAX_BYTES = 3 * 1024 * 1024; // 30 s of 16 kHz mono PCM16 is ~0.96 MB

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const user = await requireUser(req);
  if (!user) return fail(401, 'unauthorized', 'Please log in again.');

  const apiKey = Deno.env.get('GNANI_API_KEY');
  if (!apiKey) {
    console.error('GNANI_API_KEY is not set');
    return fail(500, 'not_configured', 'Voice service is not configured.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'bad_form', 'Send the recording as multipart form data.');
  }

  const audio = form.get('audio_file');
  const language = String(form.get('language_code') ?? 'en-IN');
  if (!(audio instanceof File) || audio.size === 0) {
    return fail(400, 'empty_audio', 'No audio was received.');
  }
  if (audio.size > MAX_BYTES) {
    return fail(413, 'audio_too_large', 'Recording is too long. Keep it under 30 seconds.');
  }
  if (!LANGUAGES.has(language)) {
    return fail(400, 'bad_language', 'Unsupported language.');
  }

  const upstream = new FormData();
  upstream.append('audio_file', audio, audio.name || 'recording.wav');
  upstream.append('language_code', language);
  upstream.append('format', 'transcribe');

  let res: Response;
  try {
    res = await fetch(GNANI_STT_URL, {
      method: 'POST',
      headers: { 'X-API-Key-ID': apiKey },
      body: upstream,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    console.error('gnani-stt network error', err instanceof Error ? err.message : err);
    return fail(504, 'upstream_unreachable', 'Voice service did not respond. Please try again.');
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    const type = payload?.error?.type ?? payload?.detail?.error_code ?? `HTTP_${res.status}`;
    console.error('gnani-stt upstream error', res.status, type);
    if (type === 'MAX_AUDIO_DURATION_EXCEEDED') {
      return fail(400, 'audio_too_long', 'Recording is too long. Keep it under 30 seconds.');
    }
    if (type === 'EMPTY_AUDIO') return fail(400, 'empty_audio', 'No speech was heard.');
    if (res.status === 429 || type === 'RATE_LIMITED') {
      return fail(429, 'rate_limited', 'Too many requests. Please wait a moment.');
    }
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      // Key / credit problem: the user cannot fix it, so keep details out of the response.
      return fail(502, 'upstream_account', 'Voice service is unavailable. Please contact support.');
    }
    return fail(502, 'upstream_failed', 'Could not transcribe that recording. Please try again.');
  }

  return json({
    ok: true,
    transcript: String(payload.transcript ?? '').trim(),
    language: payload.detected_language_code ?? language,
  });
});
