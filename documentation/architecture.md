# ASHA SATHI – System Architecture

## 1. Introduction

ASHA SATHI is a voice-based digital field register designed to help ASHA workers manage healthcare information digitally.

The system aims to reduce manual paperwork by providing voice-based data entry, digital visit records, maternal and child health tracking, smart follow-up reminders, and safety alerts.

## 2. System Overview

ASHA SATHI consists of different components that work together to provide a simple and user-friendly healthcare record management system.

The main components are:

- **Frontend:** Provides the user interface for ASHA workers.
- **Backend:** Handles application logic and processes user inputs.
- **Voice Input:** Helps users enter information through voice.
- **Database:** Stores beneficiary details and household visit records.
- **Safety Alerts:** Identifies predefined danger signs and displays warning messages.

## 3. Frontend

The frontend is developed using:

- HTML
- CSS
- JavaScript

It provides the interface through which ASHA workers can enter beneficiary details, record household visits, view health information, and check reminders and alerts.

## 4. Backend

The backend is developed using Python.

It is responsible for:

- Processing information received from the frontend.
- Validating the entered data.
- Handling beneficiary and visit records.
- Checking predefined safety rules.
- Supporting follow-up and reminder functions.

## 5. Voice Input Module

The voice input module allows ASHA workers to enter information using speech instead of typing.

The voice input process is intended to:

1. Capture the user's voice.
2. Convert speech into text.
3. Display the converted text for review.
4. Send the confirmed information for further processing.

The specific speech recognition technology will be documented after it is finalized in the project.

## 6. Database

The database is intended to store and manage:

- Beneficiary details.
- Household information.
- Pregnancy and maternal health records.
- Newborn and child health records.
- Household visit details.
- Follow-up information.

The database technology will be updated once the final database is selected and integrated.

## 7. Data Flow

The general working flow of ASHA SATHI is:

1. The ASHA worker enters information through the application.
2. The information may be entered using voice input or the available form.
3. Voice input is converted into text.
4. The backend receives and validates the information.
5. The system checks predefined safety rules where applicable.
6. The information is stored in the database when the required storage functionality is implemented.
7. The application displays the available records, reminders, and alerts.

## 8. Conclusion

ASHA SATHI combines frontend, backend, voice input, data storage, and safety alert components to support digital healthcare record management for ASHA workers.

Its architecture is designed to make data entry easier, improve record management, and support timely follow-up activities.
