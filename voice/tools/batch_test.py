from __future__ import annotations
import argparse
import json
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audio_utils import GnaniSTTClient, make_record, save_session

VOICE = Path(__file__).resolve().parents[1]
CATEGORIES = ("kannada", "kanglish", "hindi", "hinglish")

def main() -> None:
    parser = argparse.ArgumentParser(description="Run controlled tests with the current Kannada baseline configuration.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", type=Path, help="Test one WAV recording")
    group.add_argument("--category", choices=CATEGORIES, help="Test all WAV recordings in one category")
    group.add_argument("--all", action="store_true", help="Test WAV recordings in all categories")
    parser.add_argument("--retry-failed", action="store_true", help="Re-run files from the newest result session that failed")
    args = parser.parse_args()
    if args.retry_failed:
        old = sorted((VOICE / "results").glob("session_*.json"))
        paths = []
        for f in reversed(old):
            entries = json.loads(f.read_text(encoding="utf-8")).get("records", [])
            paths = [Path(r["audio_path"]) for r in entries if r.get("error") and Path(r.get("audio_path", "")).is_file()]
            if paths: break
        category_map = {p: next((c for c in CATEGORIES if c in p.parts), "unknown") for p in paths}
    elif args.file:
        paths = [args.file.resolve()]
        category_map = {paths[0]: next((c for c in CATEGORIES if c in paths[0].parts), "unknown")}
    else:
        cats = CATEGORIES if args.all else (args.category,)
        paths = [p for cat in cats for p in sorted((VOICE / "test_samples" / cat).glob("*.wav"))]
        category_map = {p: next((c for c in CATEGORIES if c in p.parts), "unknown") for p in paths}
    if not paths:
        print("No recordings found to test.")
        return
    client, records = GnaniSTTClient(), []
    for i, path in enumerate(paths, 1):
        print(f"[{i}/{len(paths)}] {path.name}")
        result = client.transcribe(path)
        try:
            metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            metadata = {}
        record = make_record(path, metadata.get("category", category_map[path]), result, metadata.get("sentence", ""))
        records.append(record)
        print(f"  HTTP {result.http_status if result.http_status is not None else 'n/a'}; {result.response_time_seconds:.2f}s; {result.error or 'transcription received'}")
    sid = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    jp, cp = save_session(records, sid)
    print(f"Saved {jp.name} and {cp.name}")

if __name__ == "__main__": main()
