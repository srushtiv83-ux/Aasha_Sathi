# ASHA Sathi – System Architecture

## 1. Overview

ASHA Sathi is a voice-first digital visit register for ASHA workers. It captures visit
transcripts, drafts summaries and structured details for worker review, and stores confirmed
visits and follow-ups.

## 2. Components

- **Frontend:** React 18 and Vite application in `fronted/`.
- **Authentication and database:** Supabase phone OTP, Postgres, Row Level Security, and visit
  RPCs in `backend/supabase/`.
- **Speech services:** Supabase Edge Functions relay speech-to-text and text-to-speech requests
  to Gnani. The Gnani API key remains a Supabase secret.
- **AI extraction:** FastAPI service in `ai_logic/` sends the transcript to Google Gemini and
  returns a factual summary plus structured suggestions. The Gemini key is read by this
  service, not by the frontend.

## 3. Visit data flow

1. The worker records a short audio clip in the browser.
2. The frontend sends the audio to the authenticated `gnani-stt` Edge Function and receives
   the transcript.
3. The frontend retains the transcript and sends its text to the configured FastAPI endpoint
   (`VITE_AI_API_URL`, default `http://127.0.0.1:8000`).
4. FastAPI sends the transcript to Google Gemini and validates the extraction response.
5. The frontend displays the summary, explicit-detail suggestions, and AI advisory notes for
   worker review. The worker may edit the fields. Danger-sign status is never confirmed by AI.
6. On worker confirmation, the frontend calls `confirm_visit_with_ai`; the Supabase RPC stores
   the reviewed visit, raw transcript, summary, extraction JSON, and follow-ups.
7. The saved visit screen reads back the summary, transcript, and follow-ups from Supabase.

## 4. Safety and deployment notes

- AI output is unverified decision support, not a diagnosis or automatic referral. Workers must
  follow approved clinical protocols and confirm danger-sign status themselves.
- The transcript is sent to Google Gemini through the configured AI service. Obtain appropriate
  consent and follow applicable health-data retention and privacy requirements.
- The current AI service setup is local development. For a hosted frontend, deploy the API
  behind HTTPS and configure `VITE_AI_API_URL` and allowed CORS origins accordingly.
- Apply all Supabase migrations before using visit save/readback, and keep service-role and
  provider keys out of frontend environment files.
