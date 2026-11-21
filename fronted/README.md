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
Supabase (Postgres, phone-OTP auth, Edge Functions) and the Gnani speech API. See `SETUP.md`.

- `supabase/migrations/` database schema with Row Level Security
- `supabase/functions/auth-otp` phone / ASHA-ID OTP login and registration
- `supabase/functions/gnani-stt`, `gnani-tts` speech-to-text and text-to-speech (Gnani key stays server-side)
- `src/lib/` Supabase client, session handling, voice recording and playback

## Current limitations
- The dashboard records up to 28 seconds and sends speech to the `gnani-stt` Edge Function. The transcript is editable and saved with the visit; it does not automatically fill clinical fields.
- Patient details, measurements, symptoms, care, and danger-sign assessment must be entered and verified by the worker before saving. No diagnosis or danger-sign detection is performed.
- Gnani speech services require the Edge Functions to be deployed and `GNANI_API_KEY` to be configured as a Supabase secret.
- The PHC call action shows a notice because no phone number is configured.

## Validation
Run `npm run build` to validate the production bundle. There is no automated test script configured in this frontend.
