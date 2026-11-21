// Voice helpers: record audio as 16 kHz mono WAV for Gnani speech-to-text, and
// play Gnani text-to-speech with a fallback to the browser's built-in voices.
import { callFunction } from './supabase.js';

const MAX_RECORD_MS = 28_000; // Gnani accepts at most 30 s per request.
const TARGET_RATE = 16_000;

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window !== 'undefined' &&
  Boolean(window.AudioContext || window.webkitAudioContext);

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

function resample(samples, sourceRate) {
  if (sourceRate === TARGET_RATE) return samples;

  const ratio = sourceRate / TARGET_RATE;
  const output = new Float32Array(Math.floor(samples.length / ratio));
  if (sourceRate > TARGET_RATE) {
    for (let i = 0; i < output.length; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
      let total = 0;
      for (let j = start; j < end; j += 1) total += samples[j];
      output[i] = total / Math.max(1, end - start);
    }
    return output;
  }

  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, samples.length - 1);
    const fraction = position - lower;
    output[i] = samples[lower] * (1 - fraction) + samples[upper] * fraction;
  }
  return output;
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

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let context;
  let source;
  let processor;
  try {
    context = new AudioCtx();
    await context.resume();
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
    processor.connect(context.destination);
  } catch (err) {
    stream.getTracks().forEach((track) => track.stop());
    await context?.close();
    throw new Error(`Could not initialize microphone recording: ${err.message}`);
  }

  const blocks = [];
  let sampleCount = 0;
  const sourceRate = context.sampleRate;
  let stopped = false;
  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const block = new Float32Array(event.inputBuffer.getChannelData(0));
    blocks.push(block);
    sampleCount += block.length;
    for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel += 1) {
      event.outputBuffer.getChannelData(channel).fill(0);
    }
  };

  let timer;
  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    void (async () => {
      try {
        processor.onaudioprocess = null;
        let disconnectError;
        try { source.disconnect(); } catch (err) { disconnectError = err; }
        try {
          processor.disconnect();
        } catch (err) {
          if (!disconnectError) disconnectError = err;
        }
        stream.getTracks().forEach((track) => track.stop());
        try {
          await context.close();
        } catch (err) {
          if (!disconnectError) disconnectError = err;
        }
        if (disconnectError) {
          console.warn('Microphone audio cleanup failed:', disconnectError.message);
        }
        if (sampleCount === 0) throw new Error('No audio was captured.');
        const samples = new Float32Array(sampleCount);
        let offset = 0;
        for (const block of blocks) {
          samples.set(block, offset);
          offset += block.length;
        }
        const mono = resample(samples, sourceRate);
        resolveResult({ wav: encodeWav(mono, TARGET_RATE), seconds: sampleCount / sourceRate });
      } catch (err) {
        rejectResult(err instanceof Error ? err : new Error('Could not process the recording.'));
      }
    })();
  }

  let resolveResult;
  let rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  timer = window.setTimeout(stop, MAX_RECORD_MS);
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
