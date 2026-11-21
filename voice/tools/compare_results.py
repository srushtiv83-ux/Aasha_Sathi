"""Print a compact side-by-side comparison from local session JSON files."""
import json
from pathlib import Path

RESULTS = Path(__file__).resolve().parents[1] / "results"
def main():
    sessions = sorted(RESULTS.glob("session_*.json"))
    if not sessions:
        print("No results yet. Run a transcription test first."); return
    records = []
    for path in sessions:
        records.extend(json.loads(path.read_text(encoding="utf-8")).get("records", []))
    print(f"{'Category':12} | {'Spoken language':20} | {'Rating':6} | Transcript")
    print("-" * 110)
    spoken = {"kannada":"Kannada", "kanglish":"Kannada + English", "hindi":"Hindi", "hinglish":"Hindi + English"}
    for r in records:
        print(f"{r.get('category','?'):12} | {spoken.get(r.get('category'),'?'):20} | {str(r.get('accuracy_score') or '—'):6} | {(r.get('transcription') or r.get('error') or '—').replace(chr(10),' ')}")
if __name__ == "__main__": main()
