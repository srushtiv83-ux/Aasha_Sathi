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
| `#/visit-saved` | Visit Saved & Follow-Ups |
| `#/danger` | Danger-Sign Alert |

## Demo behavior and limitations
- Login and registration use the demo OTP `123456`; no SMS is sent and no account is created.
- Patient details and danger alerts are sample content. Confirming a visit or acknowledging a referral does not contact a service, sync data, or update a real patient record.
- Spoken playback and voice recognition depend on browser speech services. If voice recognition is unavailable, a correction can be entered as a text note; it does not change clinical measurements.
- The PHC call action displays a notice because no phone number is configured.
- Follow-up checkboxes are local to the page and are not saved.

## Validation
Run `npm run build` to validate the production bundle. There is no automated test script configured in this frontend.
