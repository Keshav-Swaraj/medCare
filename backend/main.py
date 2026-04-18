from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json
import os
import requests
from fastapi import Query
from ocr_service import process_prescription_image

app = FastAPI(title="MedCare OCR API", version="1.0.0")

# Allow the Vite dev server (port 5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"status": "MedCare OCR API is running"}


@app.post("/api/v1/extract-prescription/")
async def process_prescription(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    try:
        raw_bytes = await file.read()
        raw_text = process_prescription_image(raw_bytes)

        # Strip markdown code fences if present
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        final_data = json.loads(text)

        return {
            "status": "success",
            "extracted_data": final_data,
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid JSON response. Try again or try a clearer image.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/search-medicine")
def search_medicine(q: str = Query(..., description="Medicine name to search")):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    url = f"https://pharmeasy.in/api/search/search/?intent_id=1&p=1&q={q}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        products = data.get("data", {}).get("products", [])
        
        results = []
        for p in products[:3]:
            mrp = float(p.get("mrpDecimal") or 0)
            sale_price = float(p.get("salePriceDecimal") or 0)
            slug = p.get("slug", "")
            name = p.get("name", "Unknown Medicine")
            
            savings = round(mrp - sale_price, 2)
            if savings < 0:
                savings = 0
            
            results.append({
                "medicineName": name,
                "brandedPrice": mrp,
                "janAushadhiPrice": sale_price,
                "savings": savings,
                "buyLink": f"https://pharmeasy.in/online-medicine-order/{slug}" if slug else "#"
            })
            
        return {
            "status": "success",
            "results": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_context: dict = {}

@app.post("/api/v1/chat")
def chat(request: ChatRequest):
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key or groq_key == "your_groq_api_key_here":
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    from openai import OpenAI
    client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

    ctx = request.user_context
    name = ctx.get("name", "the patient")
    age = ctx.get("age", "")
    gender = ctx.get("gender", "")
    conditions = ctx.get("conditions", "")
    allergies = ctx.get("allergies", "")
    medicines = ctx.get("medicines", [])

    med_list = "\n".join([
        f"- {m.get('name', m.get('medicine_name', 'Unknown'))}: "
        f"{m.get('frequency', '')} for {m.get('duration', '')}. "
        f"{m.get('description', '')}"
        for m in medicines
    ]) or "No medicines on record."

    system_prompt = f"""You are MedCare Agent, a compassionate and knowledgeable AI medical assistant.

PATIENT PROFILE:
- Name: {name}
- Age: {age}
- Gender: {gender}
- Pre-existing Conditions: {conditions or 'None mentioned'}
- Allergies: {allergies or 'None mentioned'}

CURRENT PRESCRIPTIONS:
{med_list}

YOUR ROLE:
- Answer questions about the patient's medicines, dosage, timing, and side effects.
- Give practical, personalized advice based on their specific profile and medicines.
- Always remind patients to consult their doctor for serious concerns.
- Be warm, clear, and use simple language suitable for patients and caregivers.
- Do not diagnose new conditions; focus on medication guidance and adherence.
- Keep responses concise and actionable.
"""

    groq_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        role = "user" if msg.role == "user" else "assistant"
        groq_messages.append({"role": role, "content": msg.content})

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            max_tokens=512,
            temperature=0.6,
        )
        reply = response.choices[0].message.content.strip()
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

