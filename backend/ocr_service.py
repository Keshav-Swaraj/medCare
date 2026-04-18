import io
import os
import PIL.Image
from dotenv import load_dotenv

load_dotenv()


def _get_client():
    """Lazy-load the Gemini client so the server starts even if key is missing."""
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY is not set. "
            "Add it to backend/.env — get a free key at https://aistudio.google.com/app/apikey"
        )
    return genai.Client(api_key=api_key)


PROMPT = """
You are a strict data entry transcriptionist. Your ONLY job is to transcribe
the exact letters written on this medical prescription.

CRITICAL RULES:
1. DO NOT autocorrect spelling.
2. DO NOT guess the medicine name based on context.
3. Type exactly what you see, letter-for-letter.
4. Only transcribe medicines (Tab, Syp, Cap, Inj, Oint). Ignore symptoms.
5. Extract fields related to medicine name, dosage frequency, and duration.
6. Based on the extracted medicine, provide a simple 1-sentence description of its general purpose.
7. Parse the frequency into boolean flags: morning, afternoon, evening. (e.g. 1-0-1 is morning=true, afternoon=false, evening=true).

For each medicine found output exactly these fields:
  "medicine_name" — Medicine name + strength (exact literal text from the paper)
  "frequency"     — When to take (exact text, e.g. "Twice a day after food" or "1-0-1")
  "duration"      — How many days to take (e.g. "30 days")
  "description"   — Short explanation of what this medicine is for (e.g. "Used to treat fever and pain.")
  "morning"       — true/false based on frequency
  "afternoon"     — true/false based on frequency
  "evening"       — true/false based on frequency

Format: a JSON array of objects ONLY. No markdown fences. No commentary.

Example:
[
  {
    "medicine_name": "Tab Dolo 650",
    "frequency": "1-0-1 after food",
    "duration": "5 days",
    "description": "Used to relieve pain and reduce fever.",
    "morning": true,
    "afternoon": false,
    "evening": true
  }
]
"""


def process_prescription_image(image_bytes: bytes) -> str:
    """
    Send the prescription image to Gemini 2.5 Flash and return a JSON string
    containing a list of extracted medicine objects.
    """
    client = _get_client()
    image = PIL.Image.open(io.BytesIO(image_bytes))

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[PROMPT, image],
    )

    return response.text.strip()
