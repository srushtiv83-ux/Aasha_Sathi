from typing import Optional, Literal
from pydantic import BaseModel, Field


class ASHAVisitRecord(BaseModel):

    beneficiary_name: Optional[str] = None
    age: Optional[int] = None

    visit_type: Optional[
        Literal[
            "Antenatal visit",
            "Postnatal visit",
            "Newborn visit",
            "Immunization visit",
            "General home visit"
        ]
    ] = None

    symptoms: list[str] = Field(default_factory=list)
    duration_of_symptoms: Optional[str] = None

    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None

    danger_signs: list[str] = Field(default_factory=list)
    advice_given: list[str] = Field(default_factory=list)

    follow_up_date: Optional[str] = None

    missing_information: list[str] = Field(default_factory=list)
    uncertain_information: list[str] = Field(default_factory=list)

    # AI-assisted risk assessment
    risk_level: Literal["HIGH", "MEDIUM", "LOW", "UNKNOWN"] = "UNKNOWN"
    risk_reasoning: Optional[str] = None
    recommended_action: Optional[str] = None
    urgent_referral: bool = False

    # Independent safety alerts
    safety_alerts: list[str] = Field(default_factory=list)