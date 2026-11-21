# ASHA Sathi Multilingual STT Testing Lab

A local developer tool for collecting comparable Kannada, Kanglish, Hindi, and Hinglish speech samples and reviewing Gnani STT v3 responses. Kanglish and Hinglish testing is useful to see how a recognizer handles natural code switching in maternal-health documentation. This lab only records and evaluates speech recognition. It does not diagnose, recommend treatment, verify a medical record, or connect to the ASHA Sathi beneficiary database.

## Folder layout

```text
voice/
  .env                    # local API key (never commit)
  sample.wav              # existing smoke-test sample
  test_gnani.py            # single-file smoke test
  test_gnani.py.bak        # original script backup
  test_samples/{kannada,kanglish,hindi,hinglish}/
  results/                 # timestamped JSON and CSV sessions
  tools/record_audio.py    # desktop recorder
  tools/batch_test.py      # batch and single-file CLI
  tools/compare_results.py # console comparison
  tools/audio_utils.py     # reusable client and result storage
  dashboard/app.py         # local Streamlit review UI
```

## Setup (Windows PowerShell)

From this `voice` directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Add the key to `voice/.env` (the file already exists):

```text
GNANI_API_KEY=your_key_here
```

Keep `.env` private. The client never logs the key. Python, `requests`, and `python-dotenv` are used for requests; `sounddevice` records microphone audio; Streamlit serves the local dashboard.

## Record samples

```powershell
python tools\record_audio.py
```

Choose a category, edit the suggested sentence if desired, start/stop, play it back, then save. The recorder creates mono 16 kHz PCM16 WAV files with timestamped names in the matching `test_samples` folder. It does not upload. Windows may ask you to enable microphone permission. Errors identify when the microphone cannot be opened or recording cannot be saved.

## Run transcription tests

Explicitly start a test when ready:

```powershell
# Existing sample baseline
python test_gnani.py

# One recording
python tools\batch_test.py --file test_samples\kannada\kannada_20261122_120000.wav

# All recordings in one category or in all categories
python tools\batch_test.py --category kanglish
python tools\batch_test.py --all

# Retry failed audio files from the newest session that contains failures
python tools\batch_test.py --all --retry-failed
```

Each run writes a unique `results/session_<timestamp>.json` and `.csv`. Per-file failures are recorded without interrupting other files. Results include the request configuration, status, elapsed time, raw response, transcript, error, and editable reviewer fields. No API key is stored.

## Dashboard and comparisons

```powershell
streamlit run dashboard\app.py
```

The dashboard summarizes result counts and response times, plays saved audio, displays transcripts by category, and lets you add a manual 1–5 rating and notes. Use the comparison tables to review the original sentence beside each transcript. For a terminal view:

```powershell
python tools\compare_results.py
```

Ratings are human judgments only. No WER or automated accuracy value is calculated. A controlled comparison should use the same speaker, sentence, recording conditions, and clear reference text across categories.

## Gnani configuration and limitations

The client keeps the current request unchanged: endpoint `https://api.vachana.ai/stt/v3`, `X-API-Key-ID`, `language_code=kn-IN`, `preferred_language=kn-IN`, `format=transcribe`, and `itn_native_numerals=true`. The official Gnani API example confirms these request fields and demonstrates `hi-IN` in its example. However, the official documentation available for this implementation did not establish REST support for automatic language detection, multiple languages in one request, a multilingual/code-switch mode, or dedicated support for Kanglish/Hinglish. Those behaviors remain unverified and are not enabled. Thus the categories identify what the speaker says, while every test currently records that the configured API locale is `kn-IN`; results for Hindi and mixed-language speech are experimental baseline comparisons, not claims of language support.

The `sample.wav` in this workspace is currently empty, so record a usable clip before invoking that smoke test. Keep this lab isolated: it does not edit the main React frontend, Pipecat pipeline, Gemini extraction service, or beneficiary data.
