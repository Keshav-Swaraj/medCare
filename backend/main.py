from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
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
        structured_json_string = process_prescription_image(raw_bytes)
        final_data = json.loads(structured_json_string)

        return {
            "status": "success",
            "extracted_data": final_data,
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid JSON response. Try again.",
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
        # Take up to top 3 products
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
                "janAushadhiPrice": sale_price,  # Using Sale Price as the generic/discounted price
                "savings": savings,
                "buyLink": f"https://pharmeasy.in/online-medicine-order/{slug}" if slug else "#"
            })
            
        return {
            "status": "success",
            "results": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
