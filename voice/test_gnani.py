"""Run the legacy single-file smoke test against sample.wav and save a session."""
from datetime import datetime
from pathlib import Path
import sys

TOOLS = Path(__file__).resolve().parent / "tools"
sys.path.insert(0, str(TOOLS))
from audio_utils import GnaniSTTClient, make_record, save_session

audio = Path(__file__).resolve().parent / "sample.wav"
result = GnaniSTTClient().transcribe(audio)
record = make_record(audio, "kannada", result)
print(f"HTTP status: {result.http_status if result.http_status is not None else 'n/a'}")
print(f"Response time: {result.response_time_seconds:.2f}s")
print(f"Transcription: {result.transcription or '—'}")
if result.error:
    print(f"Error: {result.error}")
sid = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
json_path, csv_path = save_session([record], sid)
print(f"Saved: {json_path.name}, {csv_path.name}")
