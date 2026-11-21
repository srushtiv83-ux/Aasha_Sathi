// Voice helpers: record audio as 16 kHz mono WAV for Gnani speech-to-text, and
// play Gnani text-to-speech with a fallback to the browser's built-in voices.
import { callFunction } from './supabase.js';

const MAX_RECORD_MS = 28_000; // Gnani accepts at most 30 s per request.
const TARGET_RATE = 16_000;

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined';

// ---------------------------------------------------------------- recording

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// Browsers record webm/mp4, which Gnani does not accept, so convert to WAV here.
async function toWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const source = await ctx.decodeAudioData(await blob.arrayBuffer());

    const frames = Math.max(1, Math.ceil(source.duration * TARGET_RATE));
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const node = offline.createBufferSource();
    node.buffer = source;
    node.connect(offline.destination);
    node.start();
    const rendered = await offline.startRendering();
    return { wav: encodeWav(rendered.getChannelData(0), TARGET_RATE), seconds: source.duration };
  } finally {
    ctx.close?.();
  }
}

// Starts recording. Returns { stop, result } where `result` resolves to
// { wav, seconds } once stop() is called (or after MAX_RECORD_MS).
export async function startRecording() {
  if (!canRecord()) throw new Error('Recording is not supported in this browser.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
    throw new Error(
      denied
        ? 'Microphone access was denied. Allow microphone access in your browser settings.'
        : 'No microphone was found.',
    );
  }

  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const result = new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Recording failed. Please try again.'));
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      try {
        if (chunks.length === 0) throw new Error('No audio was captured.');
        resolve(await toWav(new Blob(chunks, { type: recorder.mimeType })));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not process the recording.'));
      }
    };
  });

  const timer = window.setTimeout(() => stop(), MAX_RECORD_MS);
  function stop() {
    window.clearTimeout(timer);
    if (recorder.state !== 'inactive') recorder.stop();
  }

  recorder.start();
  return { stop, result };
}

// Sends a WAV recording to the gnani-stt Edge Function. Returns the transcript.
export async function transcribe(wav, languageCode = 'en-IN') {
  const form = new FormData();
  form.append('audio_file', wav, 'recording.wav');
  form.append('language_code', languageCode);
  const res = await callFunction('gnani-stt', { formData: form });
  const payload = await res.json();
  return String(payload.transcript ?? '').trim();
}

// ----------------------------------------------------------------- playback

const browserCanSpeak = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function speakWithBrowser(text, language, signal) {
  return new Promise((resolve, reject) => {
    if (!browserCanSpeak()) {
      reject(new Error('Spoken playback is not supported in this browser.'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') resolve();
      else reject(new Error('Spoken playback is unavailable here.'));
    };
    signal?.addEventListener('abort', () => window.speechSynthesis.cancel(), { once: true });
    window.speechSynthesis.speak(utterance);
  });
}

async function speakWithGnani(text, language, signal) {
  const res = await callFunction('gnani-tts', { json: { text, language }, signal });
  const blob = await res.blob();
  if (signal?.aborted) return;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  try {
    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = () => reject(new Error('The audio could not be played.'));
      signal?.addEventListener(
        'abort',
        () => {
          audio.pause();
          resolve();
        },
        { once: true },
      );
      audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Speaks `text`. Tries Gnani first, then the browser voice. Resolves when finished
// or when `signal` is aborted. Rejects only if neither voice works.
export async function speak(text, { language = 'en-IN', signal } = {}) {
  try {
    await speakWithGnani(text, language, signal);
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return;
    console.warn('Gnani voice unavailable, using the browser voice:', err.message);
    await speakWithBrowser(text, language, signal);
  }
}
