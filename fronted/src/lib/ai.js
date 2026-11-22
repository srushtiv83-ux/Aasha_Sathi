const AI_SERVICE_URL = (
  import.meta.env.VITE_AI_API_URL || 'https://aasha-sathi.onrender.com'
).replace(/\/+$/, '');

export async function extractVisit(transcript, { signal, language = 'english' } = {}) {
  let response;
  try {
    response = await fetch(`${AI_SERVICE_URL}/extract-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, speech_language: language }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('Could not reach the AI service. Start it and try again.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : `AI extraction failed (HTTP ${response.status}).`,
    );
  }
  if (!payload?.success || !payload?.data || typeof payload.data !== 'object') {
    throw new Error('The AI service returned an invalid visit extraction.');
  }
  if (typeof payload.data.visit_summary !== 'string' || !payload.data.visit_summary.trim()) {
    throw new Error('The AI service did not return a visit summary.');
  }

  return payload.data;
}
