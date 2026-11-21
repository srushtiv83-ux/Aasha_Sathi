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

From this folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

`db push` runs `supabase/migrations/0001_init.sql`. If you prefer, paste that file into
**SQL Editor → New query** and press Run instead.

What it creates: `profiles`, `patients`, `visits`, `follow_ups`, `alerts`, with Row Level
Security so every worker sees only their own rows, plus two functions the app calls:
`create_profile` (registration, generates the ASHA ID) and `confirm_visit` (saves a visit and
its follow-ups together).

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

Get a key at https://app.gnani.ai/voice/, then:

```bash
npx supabase secrets set GNANI_API_KEY=paste-your-key-here
npx supabase functions deploy
```

This deploys `auth-otp`, `gnani-stt` and `gnani-tts`. `config.toml` already marks `auth-otp` as
callable before login and the other two as login-only.

## 5. Point the frontend at your project

```bash
cp .env.example .env     # then edit .env with your URL and anon key
npm install
npm run dev              # http://localhost:5173
```

## 6. Try it

1. **Register** with a phone number (or your test number), enter the OTP, and finish the form.
   An ASHA ID like `ASHA-2026-4819` is assigned.
2. **Log out and log in** again using the phone number, then using the ASHA ID.
3. On the dashboard tap **Listen** to hear the summary read by Gnani.
4. Tap **Is it correct? Record a correction**, speak, tap again to stop, and review the text.
5. Tap **Confirm & save**, then check **Table Editor → visits / follow_ups** for the new rows.
6. On the saved screen tick a follow-up and refresh. It should stay ticked.

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

- The visit on the dashboard (Meera Devi), the shift hours, and the danger-sign alert are still
  fixed sample content. Confirming the visit saves that sample into your database.
- Turning a spoken visit into structured fields and detecting danger signs is the job of the
  `ai logic` part of the project, which is not connected yet.
- The "Call PHC doctor" button needs a real phone number.
