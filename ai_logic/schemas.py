from typing import Optional, Literal
from pydantic import BaseModel, Field


class ASHAVisitRecord(BaseModel):

    # ==========================================
    # BENEFICIARY DETAILS
    # ==========================================

    beneficiary_name: Optional[str] = None
    age: Optional[int] = None


    # ==========================================
    # VISIT CLASSIFICATION
    # ==========================================

    visit_type: Optional[
        Literal[
            "Antenatal visit",
            "Postnatal visit",
            "Newborn visit",
            "Immunization visit",
            "General home visit"
        ]
    ] = None


    # ==========================================
    # GENERAL HEALTH INFORMATION
    # ==========================================

    symptoms: list[str] = Field(default_factory=list)
    duration_of_symptoms: Optional[str] = None

    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None


    # ==========================================
    # PREGNANCY INFORMATION
    # ==========================================

    pregnancy_month: Optional[int] = None
    pregnancy_status: Optional[str] = None
    expected_delivery_date: Optional[str] = None


    # ==========================================
    # NEWBORN INFORMATION
    # ==========================================

    newborn_birth_date: Optional[str] = None
    newborn_weight_kg: Optional[float] = None
    breastfeeding_status: Optional[str] = None


    # ==========================================
    # IMMUNIZATION INFORMATION
    # ==========================================

    immunization_name: list[str] = Field(default_factory=list)
    immunization_status: Optional[str] = None


    # ==========================================
    # DANGER SIGNS & HEALTH ACTIONS
    # ==========================================

    danger_signs: list[str] = Field(default_factory=list)
    advice_given: list[str] = Field(default_factory=list)

    recommended_action: Optional[str] = None
    urgent_referral: bool = False


    # ==========================================
    # FOLLOW-UP
    # ==========================================

    follow_up_date: Optional[str] = None


    # ==========================================
    # AI INFORMATION QUALITY
    # ==========================================

    missing_information: list[str] = Field(default_factory=list)
    uncertain_information: list[str] = Field(default_factory=list)


    # ==========================================
    # AI-ASSISTED RISK ASSESSMENT
    # ==========================================

    risk_level: Literal[
        "HIGH",
        "MEDIUM",
        "LOW",
        "UNKNOWN"
    ] = "UNKNOWN"

    risk_reasoning: Optional[str] = None


    # ==========================================
    # INDEPENDENT SAFETY ALERTS
    # ==========================================

    safety_alerts: list[str] = Field(default_factory=list)