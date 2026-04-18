import io
import os
import base64
from dotenv import load_dotenv

load_dotenv()

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


def _process_with_groq(image_bytes: bytes) -> str:
    """Use Groq's free tier with Llama 4 Scout (vision model)."""
    from openai import OpenAI

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is not set. Get a free key at https://console.groq.com")

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    b64_image = base64.standard_b64encode(image_bytes).decode("utf-8")
    data_url = f"data:image/jpeg;base64,{b64_image}"

    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": PROMPT},
            ],
        }],
        max_tokens=2048,
        temperature=0.1,
    )
    return response.choices[0].message.content.strip()


def _process_with_gemini(image_bytes: bytes) -> str:
    """Use Google Gemini 2.0 Flash."""
    import PIL.Image
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not set.")

    client = genai.Client(api_key=api_key)
    image = PIL.Image.open(io.BytesIO(image_bytes))
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[PROMPT, image],
    )
    return response.text.strip()


def process_prescription_image(image_bytes: bytes) -> str:
    """
    Try Groq first (free tier, fast), fall back to Gemini.
    Returns a JSON string of extracted medicine objects.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key and groq_key != "your_groq_api_key_here":
        try:
            return _process_with_groq(image_bytes)
        except Exception as e:
            err_str = str(e)
            print(f"Groq failed: {err_str[:120]}, trying Gemini...")

    # Fall back to Gemini
    return _process_with_gemini(image_bytes)
