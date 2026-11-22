import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from ai_service import extract_visit_information

logger = logging.getLogger(__name__)
app = FastAPI(title="ASHA Sathi AI Service")

frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://aashasathi.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VisitTranscriptRequest(BaseModel):
    transcript: str = Field(min_length=3, max_length=10000)
    speech_language: Literal["kanglish", "hinglish", "english"] = "english"

    @field_validator("transcript")
    @classmethod
    def validate_transcript(cls, value):
        if not value.strip():
            raise ValueError("Transcript cannot be empty")
        return value.strip()


@app.get("/")
def health_check():
    return {
        "status": "ASHA Sathi AI service is running",
        "service": "AI & Health Logic",
        "version": "1.0.0",
    }


@app.post("/extract-visit")
def extract_visit(request: VisitTranscriptRequest):
    try:
        visit_record = extract_visit_information(request.transcript, request.speech_language)

        return {
            "success": True,
            "message": "Visit successfully processed",
            "data": visit_record,
        }

    except Exception as e:
        error_message = str(e).lower()
        logger.exception("AI visit extraction failed")

        # Gemini API quota / rate limit
        if "429" in error_message or "resource_exhausted" in error_message:
            raise HTTPException(
                status_code=429,
                detail="AI request limit reached. Please try again later.",
            )

        # Gemini service temporarily unavailable
        elif "503" in error_message or "unavailable" in error_message:
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable. Please try again.",
            )

        # Unexpected error
        else:
            raise HTTPException(
                status_code=500,
                detail="Something went wrong while processing the visit.",
            )
