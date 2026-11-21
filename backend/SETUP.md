# Connecting ASHA Sathi to Supabase and Gnani

How the pieces fit:

```
Browser (React)  ──►  Supabase Auth + Postgres      (login, workers, visits, follow-ups)
      │
      └──────────►  Supabase Edge Functions  ──►  Gnani API   (speech-to-text, text-to-speech)
                    (hold the Gnani key)
```

The browser only ever holds the Supabase **URL** and **anon key**. The Gnani key lives in
Supabase secrets and is used only inside Edge Functions.

## 1. Create the Supabase project

1. Sign up at supabase.com and click **New project**. Pick a region close to your users
   (for India, Mumbai `ap-south-1`) and save the database password somewhere safe.
2. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
   Also note the **Project ref** (the part before `.supabase.co`).

## 2. Create the tables

Open a terminal in the `backend` folder and run:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

`db push` runs the initial schema and the AI visit summary migration
(`0002_ai_visit_summary.sql`). If you prefer, paste those migration files into
**SQL Editor → New query** and press Run instead.

What it creates: `profiles`, `patients`, `visits`, `follow_ups`, `alerts`, with Row Level
Security so every worker sees only their own rows, plus two functions the app calls:
`create_profile` (registration, generates the ASHA ID) and `confirm_visit` (saves a visit and
its follow-ups together), and `confirm_visit_with_ai` (saves the reviewed summary and
extraction together with the visit).

Check it worked: **Table Editor** should list the five tables, each marked "RLS enabled".

## 3. Turn on phone login

**Authentication → Sign In / Providers → Phone** → enable it and choose an SMS provider
(Twilio, MessageBird, Vonage or TextLocal) and paste its credentials.

> India note: SMS providers require DLT registration (sender ID and message template) before
> they can deliver OTPs to Indian numbers. Start this early, it can take days.

**To test before SMS is set up**, add a test number under the same Phone settings
(**Test Phone Numbers and OTPs**), for example `919876543210` with OTP `123456`. No SMS is sent,
and that number logs in with that OTP. Remove the test numbers before going live.

## 4. Store the Gnani key and deploy the functions

Get a key at https://app.gnani.ai/voice/, then, still in the `backend` folder:

```bash
npx supabase secrets set GNANI_API_KEY=paste-your-key-here
npx supabase functions deploy
```

This deploys `auth-otp`, `gnani-stt` and `gnani-tts`. `config.toml` already marks `auth-otp` as
callable before login and the other two as login-only.

## 5. Point the frontend at your project

Open a terminal in the `fronted` folder:

```bash
cp .env.example .env     # then edit .env with your URL and anon key
npm install
npm run dev              # http://localhost:5173
```

Set `VITE_AI_API_URL=http://127.0.0.1:8000` in the frontend `.env` if you want to override
the default local AI service URL.

## 6. Start the AI extraction service

In another terminal:

```powershell
cd ..\ai_logic
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Set `GEMINI_API_KEY` in `ai_logic/.env` first. The transcript is sent from the browser to this
service and from there to Google Gemini; never put the Gemini key in the frontend `.env`.

## 7. Try it

1. **Register** with a phone number (or your test number), enter the OTP, and finish the form.
   An ASHA ID like `ASHA-2026-4819` is assigned.
2. **Log out and log in** again using the phone number, then using the ASHA ID.
3. On the dashboard record a visit. Review the Gnani transcript, AI-generated summary, and
   every prefilled suggestion; the AI does not confirm danger signs.
4. Tap **Confirm & save**, then check **Table Editor → visits / follow_ups** for the new rows.
5. On the saved screen check the summary and transcript, then tick a follow-up and refresh.
   The follow-up should stay ticked.

If something fails, **Edge Functions → (function) → Logs** in the Supabase dashboard shows the cause.

## Before going live

- Set the allowed website: `npx supabase secrets set ALLOWED_ORIGIN=https://your-app-url`.
- Add that URL under **Authentication → URL Configuration**.
- Remove test phone numbers.
- Never put `GNANI_API_KEY` or the Supabase `service_role` key in `.env` or any frontend file.
  If one was ever pasted somewhere public, rotate it.
- Patient records are health data. Check the data-protection rules that apply to your
  deployment, including consent, retention and who may access records.

## Still sample content

- The dashboard starts with an empty visit form. Shift hours and the separate Danger Alert screen
  still contain fixed sample content; the sample alert does not contact anyone or save a visit.
- AI risk and safety outputs are suggestions, not diagnoses; workers must verify them and
  follow approved clinical protocols.
- The "Call PHC doctor" button needs a real phone number.
