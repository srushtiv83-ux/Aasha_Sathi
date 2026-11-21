ASHA SATHI
Voice-Based Digital Field Register for ASHA Workers
1. Introduction
ASHA SATHI is a voice-based digital field register designed to help ASHA (Accredited Social Health Activist) workers manage healthcare information easily.

It aims to reduce manual paperwork by providing voice-based data entry, digital visit records, maternal and child health tracking, and smart follow-up reminders.
2. Problem Statement
ASHA workers regularly visit households and maintain records related to pregnant women, newborn babies, and children's health.

Maintaining these records manually can be time-consuming and may lead to missing information or delayed follow-ups. ASHA SATHI aims to simplify this process through a digital and voice-based platform.

3. Objectives
a) To provide voice-based data entry.
b) To maintain digital household visit records.
c) To track maternal and child health information.
d) To provide smart follow-up reminders.
e) To identify reported health danger signs and display appropriate alerts.
f) To reduce manual paperwork.
4. Main Features
4.1 Voice-Based Data Entry
Allows ASHA workers to enter beneficiary information using voice input.
4.2 Digital Visit Records
Maintains records of household visits and beneficiary details.
4.3 Maternal and Child Health Tracking
Helps maintain pregnancy, maternal care, newborn, and child health records.
4.4 Smart Follow-Up and Reminders
Provides reminders for scheduled visits and follow-up activities.
4.5 Safety Alerts
Identifies predefined maternal and newborn danger signs and displays appropriate warning messages.


5. Clinical Safety Reference
ASHA SATHI's maternal and newborn danger-sign detection logic is informed by publicly available Government of India and National Health Mission (NHM) maternal and newborn healthcare guidelines.

The danger-sign list is intended to support identification of potentially concerning symptoms mentioned during ASHA home visits and to flag records for review or referral consideration.

5.1 Maternal Danger Signs
- Bleeding
- Severe anaemia or breathlessness
- High fever
- Severe headache
- Blurred vision
- Convulsions
- Swelling
- Prolonged labour
- Ruptured membranes without labour
- Reduced fetal movement

  
5.2 Newborn Danger Signs
- Poor feeding
- Convulsions
- Fast breathing
- Severe chest indrawing
- Absent spontaneous movement
- Fever
- Low body temperature
- Jaundice in the first 24 hours
- Yellow palms or soles
  
5.3 References
1. National Health Mission, Government of India — Revised Mother and Child Protection (MCP) Card.
2. National Health Mission, Government of India — Skilled Birth Attendance Guidelines.
3. WHO recommendations on postnatal care of the mother and newborn.
The danger-sign logic is a screening and alert-support mechanism only. It does not provide a diagnosis or replace assessment by qualified healthcare professionals. Suspected danger signs should not be ignored or downgraded by the AI system.
6.Technology Stack
## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Speech Recognition | Gnani AI |
| Backend | Python, FastAPI, Uvicorn |
| AI & Information Extraction | Google Gemini API |
| Data Validation | Pydantic |
| Safety Engine | Custom Python-based logic |
| Database | Supabase (PostgreSQL) |

7.System Architecture
7.1Overall System Architecture
| Step | Component | Description |
| 1 | ASHA Worker | Initiates a home visit and records information through voice |
| 2 | Voice Input | Captures the ASHA worker's spoken observations |
| 3 | Gnani AI | Converts speech into text |
| 4 | React Frontend | Displays the transcript and sends it to the backend |
| 5 | FastAPI Backend | Receives and processes the transcript |
| 6 | Google Gemini API | Extracts relevant health and visit information |
| 7 | Pydantic Validation | Validates the extracted structured data |
| 8 | Python Safety Engine | Checks danger signs, blood pressure, and risk consistency |
| 9 | Structured Visit Record | Generates the validated digital visit record |
| 10 | Supabase | Stores visit data in the PostgreSQL database |
| 11 | Dashboard | Displays visit history, alerts, and follow-up information |

7.2 AI Processing Workflow
| Stage | Processing | Output |
| 1 | Transcript Input | Raw speech-to-text transcript |
| 2 | AI Processing | Extracts information using Gemini |
| 3 | Information Extraction | Beneficiary details, visit type, symptoms, vitals, maternal/newborn data |
| 4 | JSON Generation | Converts extracted information into structured JSON |
| 5 | Pydantic Validation | Validates data structure and field types |
| 6 | Safety Engine | Checks danger signs and safety inconsistencies |
| 7 | Final Output | Validated structured visit record |

7.3 Safety Processing Flow
| Stage | Action | Result |
| 1 | Receive extracted visit data | Visit information passed to safety engine |
| 2 | Danger-sign detection | Checks for reported warning signs |
| 3 | Blood pressure evaluation | Identifies abnormal BP values |
| 4 | Risk consistency check | Checks for inconsistencies in risk assessment |
| 5 | Safety evaluation | Generates alerts or flags records for review |
| 6 | Final record generation | Produces the safety-checked visit record |

7.4 Data Flow
| Sequence | Data Flow |
| 1 | Voice Input → Speech Recognition |
| 2 | Speech Recognition → Transcript |
| 3 | Transcript → AI Extraction |
| 4 | AI Extraction → Structured JSON |
| 5 | Structured JSON → Validation |
| 6 | Validation → Safety Checks |
| 7 | Safety Checks → Visit Record |
| 8 | Visit Record → Database & Dashboard |
| 9 | Dashboard → History, Alerts & Follow-ups |

8. Future Enhancements
- Multilingual Support: Enable speech recognition and interaction in multiple regional languages to improve accessibility for ASHA workers.
- Offline Functionality: Allow voice recording and visit data collection in areas with limited internet connectivity, with automatic synchronization when connectivity is restored.
- Predictive Risk Analysis: Introduce AI-based predictive analytics to identify high-risk pregnancies and newborns based on historical health data and visit records.
- Automated Follow-up Reminders: Provide timely reminders for upcoming antenatal visits, immunizations, and postnatal check-ups.
- Government Health System Integration: Integrate with existing government healthcare platforms to enable seamless data sharing and reduce duplicate data entry.
- Advanced Analytics Dashboard: Generate insights into maternal health, immunization coverage, follow-up completion, and community health trends.
- AI-Powered Voice Assistant: Enable conversational voice interaction to guide ASHA workers through home visits and clarify missing information in real time.
