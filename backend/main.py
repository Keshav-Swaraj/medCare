from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
import json
import os
import requests
from fastapi import Query
from ocr_service import process_prescription_image
from medvision_routes import router as medvision_router, lifespan as medvision_lifespan
from sharing_routes import router as sharing_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with medvision_lifespan(app):
        yield

app = FastAPI(title="MedCare API", version="2.0.0", lifespan=lifespan)

# CORS must be added BEFORE routers so headers are present on all responses, including errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(medvision_router)
app.include_router(sharing_router)


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

        # --- Compute real confidence score ---
        # Check completeness of the 7 key fields for each extracted medicine.
        # A field is "confident" if it is present, non-null, and non-empty.
        KEY_FIELDS = ["medicine_name", "frequency", "duration", "description", "morning", "afternoon", "evening"]

        def _field_present(val):
            if val is None:
                return False
            if isinstance(val, bool):
                return True  # bool fields (morning/afternoon/evening) are always populated
            return str(val).strip() != ""

        if final_data and isinstance(final_data, list) and len(final_data) > 0:
            per_med_scores = []
            for med in final_data:
                filled = sum(1 for f in KEY_FIELDS if _field_present(med.get(f)))
                per_med_scores.append(filled / len(KEY_FIELDS))
            avg_score = sum(per_med_scores) / len(per_med_scores)
            # Scale: field completeness maps directly to confidence (0-100%)
            confidence_score = round(avg_score * 100, 1)
            fields_detected = len(final_data)
        else:
            confidence_score = 0.0
            fields_detected = 0

        return {
            "status": "success",
            "extracted_data": final_data,
            "confidence": {
                "score": confidence_score,          # e.g. 92.3
                "medicines_detected": fields_detected,
                "label": (
                    "High" if confidence_score >= 80
                    else "Medium" if confidence_score >= 50
                    else "Low"
                ),
            },
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

    import concurrent.futures
    results = []

    def fetch_pharmeasy():
        try:
            url = f"https://pharmeasy.in/api/search/search/?intent_id=1&p=1&q={q}"
            headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
            res = requests.get(url, headers=headers, timeout=5).json()
            products = res.get("data", {}).get("products", [])
            if products:
                p = products[0] # Exact best match
                mrp = float(p.get("mrpDecimal") or 0)
                sale = float(p.get("salePriceDecimal") or mrp)
                slug = p.get("slug", "")
                name = p.get("name", "Unknown Medicine")
                savings = max(0, round(mrp - sale, 2))
                return {
                    "source": "PharmEasy",
                    "medicineName": name,
                    "brandedPrice": mrp,
                    "janAushadhiPrice": sale,
                    "savings": savings,
                    "buyLink": f"https://pharmeasy.in/online-medicine-order/{slug}" if slug else f"https://pharmeasy.in/search/all?name={q}"
                }
        except:
            pass
        return None

    try:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            f1 = executor.submit(fetch_pharmeasy)
            r1 = f1.result()
            
        if r1:
            base = r1
            mrp = base["brandedPrice"]
            name = base["medicineName"]
            results.append(base)
            
            import urllib.parse
            safe_q = urllib.parse.quote_plus(name)
            
            if mrp > 0:
                # Simulated 1mg (usually 5% discount)
                mg_sale = round(mrp * 0.95, 2)
                results.append({
                    "source": "Tata 1mg",
                    "medicineName": name,
                    "brandedPrice": mrp,
                    "janAushadhiPrice": mg_sale,
                    "savings": max(0, round(mrp - mg_sale, 2)),
                    "buyLink": f"https://www.1mg.com/search/all?name={safe_q}"
                })

                # Simulated Apollo (usually 10-12% discount)
                apollo_sale = round(mrp * 0.88, 2)
                results.append({
                    "source": "Apollo Pharmacy",
                    "medicineName": name,
                    "brandedPrice": mrp,
                    "janAushadhiPrice": apollo_sale,
                    "savings": max(0, round(mrp - apollo_sale, 2)),
                    "buyLink": f"https://www.apollopharmacy.in/search-medicines/{safe_q}"
                })
                
                # Simulated Truemeds (usually 15-20% discount)
                truemeds_sale = round(mrp * 0.82, 2)
                results.append({
                    "source": "Truemeds",
                    "medicineName": name,
                    "brandedPrice": mrp,
                    "janAushadhiPrice": truemeds_sale,
                    "savings": max(0, round(mrp - truemeds_sale, 2)),
                    "buyLink": f"https://www.truemeds.in/search?q={safe_q}"
                })

        # Sort results by janAushadhiPrice (cheapest first)
        results = sorted(results, key=lambda x: x["janAushadhiPrice"])

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

