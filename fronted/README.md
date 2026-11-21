# ASHA Sathi – React Frontend

Vite + React 18 + Tailwind CSS 3 (same design tokens as the original HTML).

## Run
    npm install
    npm run dev        # http://localhost:5173
    npm run build

## Screens (hash routes)
| Route | Screen |
|---|---|
| `#/splash` (default) | Splash |
| `#/login` / `#/register` | Login & Register |
| `#/dashboard` | ASHA Worker Dashboard |
| `#/visit-saved/<id>` | Visit Saved & Follow-Ups |
| `#/danger` | Danger-Sign Alert |

## Backend
Supabase (Postgres, phone-OTP auth, Edge Functions), Gnani speech services, and the FastAPI/Gemini extraction service in `../ai_logic`. See `SETUP.md`.

- `supabase/migrations/` database schema with Row Level Security
- `supabase/functions/auth-otp` phone / ASHA-ID OTP login and registration
- `supabase/functions/gnani-stt`, `gnani-tts` speech-to-text and text-to-speech (Gnani key stays server-side)
- `../ai_logic` summarizes the transcript and extracts explicitly stated visit details; its Gemini key stays in the local AI service environment
- `src/lib/` Supabase client, session handling, voice recording and playback

## Current limitations
- Recording requires browser microphone permission. The dashboard captures up to 28 seconds as 16 kHz mono WAV and sends it to the `gnani-stt` Edge Function. The transcript is retained alongside the AI-generated summary.
- AI-prefilled fields and risk/safety notes are unverified suggestions. The worker must review every value; danger-sign assessment is never auto-confirmed, and the AI does not provide a diagnosis.
- Gnani speech services require the Edge Functions to be deployed and `GNANI_API_KEY` to be configured as a Supabase secret.
- Visit extraction requires the local FastAPI service to be running with `GEMINI_API_KEY` in `ai_logic/.env`. Transcript text is sent to Google Gemini through that service; do not put this key in the frontend.
- The PHC call action shows a notice because no phone number is configured.

## Validation
`npm run build` runs the TypeScript check and builds the production bundle. Use `npm run typecheck` for the focused TypeScript check. The voice control uses CSS animation and respects the operating system's reduced-motion preference. There is no automated test script configured in this frontend.
