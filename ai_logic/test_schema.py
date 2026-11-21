from schemas import ASHAVisitRecord


record = ASHAVisitRecord(
    visit_summary="A visit was documented.",
    beneficiary_name=None,
    age=None,
    visit_type=None,
    symptoms=[],
    duration_of_symptoms=None,
    temperature=None,
    blood_pressure=None,
    danger_signs=[],
    advice_given=[],
    follow_up_date=None,
    missing_information=[],
    uncertain_information=[]
)

print(record.model_dump())