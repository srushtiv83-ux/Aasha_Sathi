from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_service import extract_visit_information

app = FastAPI(title="ASHA Sathi AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VisitTranscriptRequest(BaseModel):
    transcript: str = Field(min_length=1)


@app.get("/")
def health_check():
    return {"status": "ASHA Sathi AI service is running"}


@app.post("/extract-visit")
def extract_visit(request: VisitTranscriptRequest):
    try:
        visit_record = extract_visit_information(request.transcript)
        return visit_record

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Visit extraction failed: {str(e)}"
        )