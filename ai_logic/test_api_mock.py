from fastapi.testclient import TestClient
import main
from main import app

client = TestClient(app)


# Fake AI function — does not call Gemini
def mock_extract_visit_information(transcript):

    print("\nMock AI received transcript:", transcript)

    return {
        "visit_summary": "Routine antenatal visit. The beneficiary reported no complaints.",
        "beneficiary_name": "Anitha",
        "beneficiary_location": None,
        "age": 24,
        "visit_type": "Antenatal visit",
        "symptoms": [],
        "duration_of_symptoms": None,
        "temperature": 36.8,
        "temperature_unit": "C",
        "blood_pressure": "120/80",
        "pregnancy_month": 7,
        "pregnancy_status": "Pregnant",
        "expected_delivery_date": None,
        "newborn_birth_date": None,
        "newborn_weight_kg": None,
        "breastfeeding_status": None,
        "immunization_name": [],
        "immunization_status": None,
        "danger_signs": [],
        "advice_given": ["Maintain a balanced diet"],
        "recommended_action": "Routine antenatal follow-up",
        "urgent_referral": False,
        "follow_up_date": None,
        "missing_information": ["Expected delivery date"],
        "uncertain_information": [],
        "risk_level": "LOW",
        "risk_reasoning": "No danger signs reported",
        "safety_alerts": [],
    }


# Replace the real AI function temporarily
main.extract_visit_information = mock_extract_visit_information


# Test a valid transcript
response = client.post(
    "/extract-visit",
    json={
        "transcript": (
            "Anitha is 24 years old and is in her seventh month "
            "of pregnancy. Her temperature is 36.8 degrees Celsius "
            "and her blood pressure is 120/80. "
            "She has no complaints."
        )
    },
)


print("\n========== MOCK API TEST ==========")
print("Status code:", response.status_code)
print("\nResponse JSON:")
print(response.json())
print("================================")


# Assertions
assert response.status_code == 200
assert response.json()["success"] is True
assert response.json()["data"]["beneficiary_name"] == "Anitha"
assert response.json()["data"]["visit_summary"]
assert response.json()["data"]["temperature_unit"] == "C"
assert response.json()["data"]["risk_level"] == "LOW"
assert response.json()["data"]["safety_alerts"] == []

print("\nALL MOCK API ASSERTIONS PASSED!")