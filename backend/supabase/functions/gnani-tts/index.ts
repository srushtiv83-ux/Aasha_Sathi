// Text-to-speech through Gnani Vachana (Timbre). Keeps GNANI_API_KEY server-side.
//
// POST { text: string, language: 'en-IN' | 'hi-IN' | 'kn-IN' }  ->  audio/wav
// Requires a signed-in user.
import { corsHeaders, fail, preflight, requireUser } from '../_shared/http.ts';

const GNANI_TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference';
const MAX_CHARS = 1000;

// Timbre v2.5 voices are tied to one language each (voices do not carry across models).
const VOICES: Record<string, string> = {
  'en-IN': 'Kaveri',
  'hi-IN': 'Nalini',
  'kn-IN': 'Saanvi',
};

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

  let body: { text?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'bad_json', 'Request body must be JSON.');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const language = typeof body.language === 'string' ? body.language : 'en-IN';
  if (!text) return fail(400, 'empty_text', 'Nothing to speak.');
  if (text.length > MAX_CHARS) return fail(400, 'text_too_long', `Keep text under ${MAX_CHARS} characters.`);
  const voice = VOICES[language];
  if (!voice) return fail(400, 'bad_language', 'Unsupported language.');

  let res: Response;
  try {
    res = await fetch(GNANI_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': apiKey },
      body: JSON.stringify({
        text,
        voice,
        model: 'timbre-v2.5',
        language,
        speed: 1.0,
        audio_config: {
          sample_rate: 24000,
          num_channels: 1,
          sample_width: 2,
          encoding: 'linear_pcm',
          container: 'wav',
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    console.error('gnani-tts network error', err instanceof Error ? err.message : err);
    return fail(504, 'upstream_unreachable', 'Voice service did not respond. Please try again.');
  }

  if (!res.ok) {
    console.error('gnani-tts upstream error', res.status);
    if (res.status === 429) return fail(429, 'rate_limited', 'Too many requests. Please wait a moment.');
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      return fail(502, 'upstream_account', 'Voice service is unavailable. Please contact support.');
    }
    return fail(502, 'upstream_failed', 'Could not generate speech. Please try again.');
  }

  return new Response(res.body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': res.headers.get('Content-Type') ?? 'audio/wav' },
  });
});
