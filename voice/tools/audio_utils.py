"""Shared Gnani REST client and local result helpers for the isolated STT lab."""
from __future__ import annotations

import csv
import json
import os
import time
import uuid
import wave
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

VOICE_DIR = Path(__file__).resolve().parents[1]
RESULTS_DIR = VOICE_DIR / "results"
ENDPOINT = "https://api.vachana.ai/stt/v3"
BASELINE_CONFIG = {"language_code": "kn-IN", "preferred_language": "kn-IN", "format": "transcribe", "itn_native_numerals": "true"}
load_dotenv(VOICE_DIR / ".env")


@dataclass
class STTResult:
    http_status: int | None
    raw_response: Any
    transcription: str | None
    error: str | None
    response_time_seconds: float


class GnaniSTTClient:
    """Uses only the existing, documented REST request fields and baseline config."""
    def __init__(self, timeout: int = 60):
        self.api_key = os.getenv("GNANI_API_KEY")
        self.timeout = timeout

    def transcribe(self, audio_path: str | Path, language_config: dict[str, str] | None = None) -> STTResult:
        path = Path(audio_path)
        if not self.api_key:
            return STTResult(None, None, None, "GNANI_API_KEY is missing from voice/.env.", 0)
        if not path.is_file():
            return STTResult(None, None, None, "Audio file was not found.", 0)
        if path.suffix.lower() != ".wav":
            return STTResult(None, None, None, "Only WAV audio is accepted by this testing tool.", 0)
        if path.stat().st_size <= 44:
            return STTResult(None, None, None, "Audio file is empty or too short to contain audio.", 0)
        try:
            with wave.open(str(path), "rb") as wav:
                if wav.getnframes() <= 0:
                    return STTResult(None, None, None, "WAV file contains no audio frames.", 0)
                if wav.getcomptype() != "NONE":
                    return STTResult(None, None, None, "Compressed WAV audio is not supported; record PCM WAV audio.", 0)
        except (wave.Error, EOFError):
            return STTResult(None, None, None, "File is not a valid readable WAV recording.", 0)
        config = language_config or BASELINE_CONFIG
        if config != BASELINE_CONFIG:
            return STTResult(None, None, None,
                "This lab only enables the verified current Kannada baseline configuration.", 0)
        started = time.perf_counter()
        try:
            with path.open("rb") as audio:
                response = requests.post(ENDPOINT, headers={"X-API-Key-ID": self.api_key},
                    data=config,
                    files={"audio_file": (path.name, audio, "audio/wav")}, timeout=self.timeout)
            elapsed = time.perf_counter() - started
            try:
                raw = response.json()
            except ValueError:
                raw = response.text
            transcript = raw.get("transcript") if isinstance(raw, dict) else None
            if response.status_code in (401, 403):
                error = "Authentication failed (HTTP %s). Check the API key." % response.status_code
            elif response.status_code == 429:
                error = "API quota or rate limit reached (HTTP 429)."
            elif response.status_code >= 500:
                error = "Gnani service error (HTTP %s)." % response.status_code
            elif not response.ok:
                error = "Gnani request failed (HTTP %s)." % response.status_code
            elif transcript is None:
                error = "Response did not contain a transcript field."
            else:
                error = None
            return STTResult(response.status_code, raw, transcript, error, elapsed)
        except requests.Timeout:
            return STTResult(None, None, None, "Request timed out. Try again when the network is available.", time.perf_counter()-started)
        except requests.RequestException as exc:
            return STTResult(None, None, None, "Network request failed: %s" % exc, time.perf_counter()-started)


def save_session(records: list[dict[str, Any]], session_id: str | None = None) -> tuple[Path, Path]:
    RESULTS_DIR.mkdir(exist_ok=True)
    session_id = session_id or datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    json_path, csv_path = RESULTS_DIR / f"session_{session_id}.json", RESULTS_DIR / f"session_{session_id}.csv"
    json_path.write_text(json.dumps({"session_id": session_id, "records": records}, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = ["test_id", "audio_filename", "category", "language_code_used", "stt_provider", "api_endpoint", "tested_at", "http_status", "response_time_seconds", "transcription", "raw_response", "error", "notes", "accuracy_score", "original_sentence"]
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in records:
            writer.writerow({**row, "raw_response": json.dumps(row.get("raw_response"), ensure_ascii=False)})
    return json_path, csv_path


def make_record(audio: Path, category: str, result: STTResult, sentence: str = "") -> dict[str, Any]:
    return {"test_id": str(uuid.uuid4()), "audio_filename": audio.name, "audio_path": str(audio.resolve()), "category": category,
        "language_code_used": BASELINE_CONFIG["language_code"], "language_config": BASELINE_CONFIG.copy(),
        "stt_provider": "Gnani STT v3", "api_endpoint": ENDPOINT,
        "tested_at": datetime.now(timezone.utc).isoformat(), "http_status": result.http_status,
        "response_time_seconds": round(result.response_time_seconds, 3), "transcription": result.transcription,
        "raw_response": result.raw_response, "error": result.error, "notes": "", "accuracy_score": None,
        "original_sentence": sentence}
