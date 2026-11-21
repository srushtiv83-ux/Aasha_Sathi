import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from schemas import ASHAVisitRecord
from prompts import VISIT_EXTRACTION_PROMPT

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ==========================================
# DANGER SIGN DETECTION
# ==========================================

def detect_danger_signs(visit_data: dict) -> dict:

    danger_signs = []

    symptoms = visit_data.get("symptoms") or []
    symptoms = [str(s).lower() for s in symptoms]

    pregnancy_danger_keywords = [
        "severe headache",
        "headache",
        "blurred vision",
        "swelling",
        "swelling of feet",
        "swollen feet",
        "bleeding",
        "seizure",
        "convulsion",
        "difficulty breathing",
        "breathlessness",
        "chest pain",
        "severe abdominal pain",
        "reduced fetal movement",
        "loss of consciousness",
        "fainting"
    ]

    # Detect danger signs from symptoms
    for symptom in symptoms:
        for keyword in pregnancy_danger_keywords:

            if keyword in symptom:
                if symptom not in danger_signs:
                    danger_signs.append(symptom)
                break

    # ==========================================
    # BLOOD PRESSURE CHECK
    # ==========================================

    bp = visit_data.get("blood_pressure")

    if bp:
        try:
            systolic, diastolic = map(
                int,
                str(bp).replace(" ", "").split("/")
            )

            if systolic >= 140 or diastolic >= 90:
                danger_signs.append(
                    f"High blood pressure ({bp})"
                )

        except (ValueError, AttributeError):
            print("Could not parse blood pressure:", bp)

    # ==========================================
    # PRESERVE GEMINI RISK CLASSIFICATION
    # ==========================================

    gemini_risk_level = visit_data.get("risk_level", "UNKNOWN")
    gemini_urgent_referral = visit_data.get(
        "urgent_referral", False
    )

    visit_data["risk_level"] = gemini_risk_level
    visit_data["urgent_referral"] = gemini_urgent_referral

    # ==========================================
    # MERGE GEMINI AND PYTHON DANGER SIGNS
    # ==========================================

    gemini_danger_signs = visit_data.get("danger_signs") or []

    combined_danger_signs = []

    for sign in gemini_danger_signs + danger_signs:

        normalized_sign = str(sign).strip().lower()

        # Normalize BP descriptions
        if (
            "blood pressure" in normalized_sign
            or "high blood pressure" in normalized_sign
        ):
            bp = visit_data.get("blood_pressure")

            if bp:
                normalized_sign = f"high blood pressure ({bp})"

        # Avoid duplicates
        if normalized_sign not in combined_danger_signs:
            combined_danger_signs.append(normalized_sign)

    visit_data["danger_signs"] = combined_danger_signs

    # ==========================================
    # SAFETY CONSISTENCY CHECK
    # ==========================================

    safety_alerts = []

    if combined_danger_signs:

        # Danger signs + LOW risk contradiction
        if visit_data["risk_level"] == "LOW":
            safety_alerts.append(
                "Safety review required: danger signs were detected, "
                "but the visit was classified as LOW risk."
            )

        # Danger signs + no urgent referral contradiction
        if visit_data["urgent_referral"] is False:
            safety_alerts.append(
                "Safety review required: danger signs were detected, "
                "but urgent referral was marked as false."
            )

    # ==========================================
    # POSTPARTUM BLEEDING SAFETY CHECK
    # ==========================================

    visit_type = str(
        visit_data.get("visit_type") or ""
    ).lower()

    symptoms = [
        str(s).lower()
        for s in (visit_data.get("symptoms") or [])
    ]

    if "postpartum" in visit_type or "postnatal" in visit_type:

        if any("bleeding" in symptom for symptom in symptoms):

            safety_alerts.append(
                "Postpartum bleeding reported. Clinical assessment is required."
            )

            if not visit_data.get("duration_of_symptoms"):
                safety_alerts.append(
                    "Bleeding duration was not established."
                )

            safety_alerts.append(
                "Bleeding amount/severity is not documented."
            )

    visit_data["safety_alerts"] = safety_alerts

    return visit_data


# ==========================================
# GEMINI VISIT INFORMATION EXTRACTION
# ==========================================

def extract_visit_information(transcript: str) -> dict:

    prompt = f"""
{VISIT_EXTRACTION_PROMPT}

ASHA VISIT TRANSCRIPT:
{transcript}
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ASHAVisitRecord,
            temperature=0,
        ),
    )

    # Validate Gemini response
    visit_record = ASHAVisitRecord.model_validate_json(
        response.text
    )

    # Convert model to dictionary
    visit_data = visit_record.model_dump()

    # Run Python safety checks
    visit_data = detect_danger_signs(visit_data)

    return visit_data


# ==========================================
# TEST 1: DANGER DETECTION
# ==========================================

def test_danger_detection():

    test_visit = {
        "beneficiary_name": "Anitha",
        "age": 24,
        "visit_type": "Antenatal visit",
        "symptoms": [
            "severe headache",
            "blurred vision",
            "swelling of feet"
        ],
        "duration_of_symptoms": "since yesterday",
        "temperature": None,
        "blood_pressure": "150/100",
        "danger_signs": [],
        "advice_given": [],
        "follow_up_date": None,
        "missing_information": [],
        "uncertain_information": [],
        "risk_level": "LOW",
        "risk_reasoning": "No significant concern identified.",
        "recommended_action": "Routine follow-up.",
        "urgent_referral": False,
        "safety_alerts": []
    }

    result = detect_danger_signs(test_visit)

    print("\n========== DANGER DETECTION TEST ==========")
    print("Risk level:", result["risk_level"])
    print("Danger signs:", result["danger_signs"])
    print("Safety alerts:", result["safety_alerts"])
    print("Urgent referral:", result["urgent_referral"])
    print("========================================\n")

    return result


# ==========================================
# TEST 2: SAFETY CONSISTENCY
# ==========================================

def test_safety_consistency():

    test_visit = {
        "beneficiary_name": "Anitha",
        "age": 24,
        "visit_type": "Antenatal visit",
        "symptoms": [
            "severe headache",
            "blurred vision"
        ],
        "duration_of_symptoms": "since yesterday",
        "temperature": None,
        "blood_pressure": "150/100",
        "danger_signs": [],
        "advice_given": [],
        "follow_up_date": None,
        "missing_information": [],
        "uncertain_information": [],
        "risk_level": "LOW",
        "risk_reasoning": "Routine visit",
        "recommended_action": "Routine follow-up",
        "urgent_referral": False,
        "safety_alerts": []
    }

    result = detect_danger_signs(test_visit)

    print("\n========== SAFETY CONSISTENCY TEST ==========")
    print("Risk level:", result["risk_level"])
    print("Danger signs:", result["danger_signs"])
    print("Urgent referral:", result["urgent_referral"])
    print("Safety alerts:", result["safety_alerts"])
    print("==========================================\n")

    return result
