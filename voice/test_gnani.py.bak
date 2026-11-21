
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GNANI_API_KEY")

URL = "https://api.vachana.ai/stt/v3"

if not API_KEY:
    print("API key not found!")
    exit()

audio_path = "sample.wav"

if not os.path.exists(audio_path):
    print("sample.wav not found!")
    exit()

print("Connecting to Gnani STT...")

with open(audio_path, "rb") as audio:
    files = {
        "audio_file": ("sample.wav", audio, "audio/wav")
    }

    data = {
        "language_code": "kn-IN",
        "preferred_language": "kn-IN",
        "format": "transcribe",
        "itn_native_numerals": "true"
    }

    headers = {
        "X-API-Key-ID": API_KEY
    }

    response = requests.post(
        URL,
        headers=headers,
        data=data,
        files=files,
        timeout=60
    )

print("Status Code:", response.status_code)
print("Response:", response.text)
