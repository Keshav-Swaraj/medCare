from fastapi import FastAPI, UploadFile, File, HTTPException ,Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
from contextlib import asynccontextmanager
import os
import base64
from services.xray_service import process_xray, init_xray_model
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Query
import httpx
from typing import List, Tuple
from dotenv import load_dotenv
import io
import re
import json
import difflib
import numpy as np
import nibabel as nib # type: ignore
from PIL import Image
from nibabel.loadsave import load # type: ignore
from geopy.geocoders import Nominatim



# Load environment variables
load_dotenv()

# Import your ML model functions for each modality
from services.xray_service import process_xray, init_xray_model
# Uncomment when available:
from services.ct_service import process_ct, init_ct_models
from services.ultrasound_service import process_ultrasound, init_ultrasound_model
from services.mri_service import process_mri, init_mri_models
from services.gatekeeper_service import validate_modality, format_mismatch_message

# Initialize Groq Client
from groq import Groq
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Global: store latest predictions for frontend polling
latest_xray_results: dict = {}
latest_reports = {}  


def has_volume_extension(filename: str) -> bool:
    lower = filename.lower()
    return lower.endswith(".nii") or lower.endswith(".nii.gz") or lower.endswith(".dcm")

# Startup: initialize all models (failures are non-fatal – model may be unavailable)
@asynccontextmanager
async def lifespan(app: FastAPI):
    for name, init_fn in [
        ("X-ray", init_xray_model),
        ("CT", init_ct_models),
        ("Ultrasound", init_ultrasound_model),
        ("MRI", init_mri_models),
    ]:
        try:
            init_fn()
        except Exception as exc:
            print(f"[STARTUP] Warning: {name} model could not be loaded: {exc}")
    yield
    print("Shutting down models...")


from fastapi import APIRouter
router = APIRouter()



PROMPT_TEMPLATES = {
    "xray": (
        """"
        You are a medical AI assistant. 
        Based on the image and the patient symptoms: {symptoms} your task is to:

        1. Idenify if the image is of a chest X-ray. If not, return "Not a chest X-ray" and do not proceed.
        2. Identify the disease with the highest confidence score.
        3. Generate a clear and concise diagnosis statement indicating which disease is most likely present based on the AI analysis.
        4. Mention the confidence score as a percentage.
        5. Include a disclaimer that this is a preliminary AI-based diagnosis and advise the user to consult a healthcare professional for confirmation.
        6. Do not begin with "Based on the image and the patient symptoms" or any other introductory phrase.
        7. Report size should be always between 200 and 300 words.
        8. Use the following format for the output:


        Example Output:
        Disease Expected: Mass
        The AI model analyzed the chest X-ray image and determined that the most likely condition present is Mass, with a confidence score of 47.00%. 
        This suggests there may be an abnormal growth or lump in the lung area that requires further attention. Masses can range from benign 
        (non-cancerous) to malignant (cancerous), so additional medical evaluation such as a CT scan or biopsy may be recommended to determine its 
        nature. This result is an early indication provided by an AI system and should not replace professional medical advice or diagnosis. 
        Please consult a certified radiologist or doctor.

        """
    
    ),
    "ct": (
        '''
        You are a medical AI assistant specialized in interpreting 3D and 2D CT scan results. 
        Given a set of AI-generated confidence scores for tumor detection, your task is to:

        1. Identify whether a tumor or no tumor is more likely based on the highest confidence score.
        2. Clearly mention the detected condition and the confidence score as a percentage (e.g., 92.00%).
        3. Explain what this result means for the patient in clear, simple language.
        4. Describe briefly how 3D CT scans assist in detecting tumors by providing detailed cross-sectional views of the body.
        5. Recommend possible next steps such as further imaging or biopsy for confirmation.
        6. End with a disclaimer stating that this is an AI-generated preliminary result and must be verified by a certified medical professional.
        7. Do not begin with "Based on the image and the patient symptoms" or any other introductory phrase.
        8. Report size should be always between 200 and 300 words.
        9. Use the following format for the output:

        """
        Output example 
        Condition Detected: Tumor
        The AI analysis of your 3D CT scan of the brain indicates a high probability of a tumor, with a confidence score of 92.00%. This suggests there may be an abnormal mass or growth
        present in the scanned region. 3D CT scans allow doctors to view detailed cross-sectional images of internal tissues, making it easier to identify potential issues like 
        tumors. While this result is a strong indicator, it is not a confirmed diagnosis. Further testing, such as an MRI or biopsy, may be required. 
        Disclaimer: This is an AI-generated summary. Please consult a certified doctor or radiologist for medical confirmation and advice.
        '''
        "Based on the image and the patient symptoms: {symptoms}, "
        "produce a detailed CT scan report including observations, differential diagnoses, and next steps."
    ),
    "ultrasound": (
        '''

        You are a medical assistant specialized in interpreting ultrasound scan results. 
        Based on the image and the patient symptoms: {symptoms}, your task is to:

        1. Identify the most likely condition based on the highest confidence score from the following categories: Normal, Cyst, Mass, Fluid, Other Anomaly.
        2. Clearly state the detected condition along with its confidence score as a percentage (e.g., 88.50%).
        3. Explain in simple and compassionate language what the result implies for the patient.
        4. Provide a brief explanation of how ultrasound helps in detecting such conditions using sound waves for real-time internal imaging.
        5. Suggest next medical steps such as follow-up scans, consultations, or further diagnostic procedures.
        6. End with a disclaimer stating that this is an AI-generated preliminary result and must be verified by a certified medical professional.
        7. Do not begin with "Based on the image and the patient symptoms" or any other introductory phrase.
        8. Report size should be always between 200 and 300 words.
        9. Use the following format for the output:
        
        Example Output:
        Condition Detected: Cyst

        Based on the ultrasound image, the AI model has identified the most likely condition as a Cyst, with a confidence score of 92.30%. This suggests the presence of a fluid-filled sac, which is typically benign and may not cause symptoms. Ultrasound imaging uses sound waves to create real-time visuals of internal organs and is effective in detecting such abnormalities. While most cysts are harmless, a follow-up consultation with a healthcare professional is recommended to evaluate its size, nature, and whether further investigation is needed.

        Disclaimer: This is an AI-generated summary and not a substitute for professional medical advice.

        Output the result as one clear and concise paragraph of around 100 words for easy understanding by non-medical users.
        '''
        
        "generate a comprehensive ultrasound report covering findings, clinical significance, and recommendations."
    ),
    "mri": (
        "You are a radiology report assistant specialized in interpreting MRI scans. "
        "Based on the image and the patient symptoms: {symptoms}, "
        "create a detailed MRI report including key findings, interpretation, and suggested follow‑up."
    ),
}
# A generic fallback if you ever get an unexpected modality:
FALLBACK_TEMPLATE = (
    "You are a medical report assistant. Based on the image and patient symptoms: {symptoms}, "
    "generate a concise professional report including findings and recommendations."
)
# Utility: extract top-k symptom labels
def extract_top_symptoms(predictions: List[Tuple[str, float]], top_k: int = 3) -> List[str]:
    sorted_preds = sorted(predictions, key=lambda x: x[1], reverse=True)
    return [label for label, _ in sorted_preds[:top_k]]


def _looks_like_non_medical_photo(image_bytes: bytes) -> bool:
    """Conservative fallback detector to reject obvious natural photos (e.g., pets)."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.asarray(img, dtype=np.float32) / 255.0
        r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

        # Medical scans are often low-saturation; natural photos usually have stronger color separation.
        channel_sep = np.mean(np.abs(r - g) + np.abs(g - b) + np.abs(r - b))

        # Approximate saturation in [0, 1].
        cmax = np.max(arr, axis=2)
        cmin = np.min(arr, axis=2)
        saturation = np.where(cmax > 0, (cmax - cmin) / (cmax + 1e-8), 0)
        avg_saturation = float(np.mean(saturation))

        # Use a conservative threshold to reduce false rejection of valid scans.
        return channel_sep > 0.35 and avg_saturation > 0.18
    except Exception:
        return False


def ensure_modality_upload(expected_modality: str, image_bytes: bytes) -> None:
    gate_result = validate_modality(image_bytes, expected_modality)
    is_match = bool(gate_result.get("is_match", False))

    if is_match:
        return

    # Strict fail-closed behavior: reject any non-match across all modalities.
    raise HTTPException(
        status_code=400,
        detail=f"Wrong image given, expected {expected_modality}."
    )


def generate_fallback_report(symptoms: List[str], modality: str) -> str:
    top = symptoms[0] if symptoms else "Unknown"
    return (
        f"Condition Detected: {top}\n"
        f"A preliminary {modality.upper()} analysis suggests {top} as the most likely finding. "
        "Please consult a certified radiologist or physician for diagnosis and treatment decisions."
    )


def extract_confidence_from_report(report: str) -> Optional[float]:
    if not report:
        return None
    match = re.search(r"(\d{1,3}(?:\.\d+)?)\s*%", report)
    if not match:
        return None
    try:
        value = float(match.group(1))
        if 0 <= value <= 100:
            return value
    except Exception:
        return None
    return None


def _groq_generate_text(prompt: str) -> str:
    """Send a text prompt to Groq and return generated text."""
    model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    response = client.chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1024,
    )

    return (response.choices[0].message.content or "").strip()


def _guess_image_mime_type(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = (image.format or "jpeg").lower()
        if image_format == "jpg":
            image_format = "jpeg"
        return f"image/{image_format}"
    except Exception:
        return "image/jpeg"


def _groq_generate_vision_text(image_bytes: bytes, prompt: str) -> str:
    model_name = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    mime_type = _guess_image_mime_type(image_bytes)
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{encoded_image}"},
                    },
                ],
            }
        ],
        temperature=0.2,
        max_tokens=1024,
    )

    return (response.choices[0].message.content or "").strip()


def _groq_is_lab_report_text(text: str) -> bool:
    prompt = (
        "Classify the following medical text. Return only JSON with keys is_lab_report and reason. "
        "Set is_lab_report to true only if it is clearly a lab report, pathology report, CBC, blood test, urinalysis, "
        "lipid report, or similar diagnostic results table. If it is not clearly a lab report, set it to false.\n\n"
        f"TEXT:\n{text}"
    )
    response_text = _groq_generate_text(prompt)
    try:
        parsed = json.loads(response_text)
        return bool(parsed.get("is_lab_report", False))
    except Exception:
        lowered = response_text.lower()
        return "true" in lowered and "false" not in lowered


def _groq_is_lab_report_image(image_bytes: bytes) -> bool:
    prompt = (
        "You are a strict medical document classifier. Decide whether this image is a lab report. "
        "Return only JSON with keys is_lab_report and reason. Set is_lab_report to true only if the image clearly shows "
        "a lab report, blood test results, pathology report, CBC, urinalysis, lipid panel, or similar diagnostic values. "
        "If it is any other image, set is_lab_report to false."
    )
    response_text = _groq_generate_vision_text(image_bytes, prompt)
    try:
        parsed = json.loads(response_text)
        return bool(parsed.get("is_lab_report", False))
    except Exception:
        lowered = response_text.lower()
        return "true" in lowered and "false" not in lowered


def _sanitize_lab_report_text(report: str) -> str:
    if not report:
        return report

    lines = []
    for line in report.splitlines():
        lowered = line.lower()
        if "confidence" in lowered or "probability" in lowered or "confidence score" in lowered:
            continue
        lines.append(line)

    sanitized = "\n".join(lines).strip()
    sanitized = re.sub(r"(?i)\bconfidence score\s*:\s*\d+(?:\.\d+)?\s*%?", "", sanitized)
    sanitized = re.sub(r"(?i)\bconfidence\s*:\s*\d+(?:\.\d+)?\s*%?", "", sanitized)
    sanitized = re.sub(r"\n{3,}", "\n\n", sanitized)
    return sanitized.strip()

# Generate report using Groq API
def generate_medical_report(symptoms: List[str], image_bytes: bytes, modality: str, mime_type: Optional[str] = None) -> str:
    # Prepare prompt
    template = PROMPT_TEMPLATES.get(modality.lower(), FALLBACK_TEMPLATE)
    prompt = template.format(symptoms=", ".join(symptoms))
    # prompt = (
    #     f"Based on the provided image and the following symptoms: {', '.join(symptoms)}, "
    #     "generate a clear, concise, and professional medical report. "
    #     "Include possible diagnoses, recommended next steps, and any relevant notes."
    # )
    try:
        report = _groq_generate_text(prompt)
        if not report:
            raise ValueError("Empty response from Groq API.")
        return report
    except Exception as exc:
        print(f"REPORT API ERROR ({modality}): {exc}")
        return generate_fallback_report(symptoms, modality)




@router.post("/predict/xray/")
async def predict_xray(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png", "image/bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    file_bytes = await file.read()
    ensure_modality_upload("xray", file_bytes)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(file_bytes)

    try:
        predictions = process_xray(temp_path, device="cpu")
        os.remove(temp_path)
        global latest_xray_results
        latest_xray_results = {label: float(prob) for label, prob in predictions}
        return JSONResponse(content={"predictions": predictions})
    except Exception as e:
        os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get_latest_results/")
async def get_latest_results():
    if not latest_xray_results:
        return {"message": "No prediction results available yet."}
    return latest_xray_results


@router.post("/generate-report/{modality}/")
async def generate_report(
    modality: str = Path(..., description="One of: xray, ct, ultrasound, mri"),
    file: UploadFile = File(...)
):
    modality = modality.lower()
    if modality not in ["xray", "ct", "ultrasound", "mri"]:
        raise HTTPException(status_code=400, detail="Invalid modality.")
    if file.content_type not in ["image/jpeg", "image/png", "image/bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    file_bytes = await file.read()
    ensure_modality_upload(modality, file_bytes)

    temp_path = f"temp_{modality}_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)
    try:
        # Inference dispatch
        if modality == "xray":
            raw_preds = process_xray(temp_path, device="cpu")
        # elif modality == "ct": raw_preds = process_ct(temp_path, device="cpu")
        # elif modality == "ultrasound": raw_preds = process_ultrasound(temp_path, device="cpu")
        # else: raw_preds = process_mri(temp_path, device="cpu")

        symptoms = extract_top_symptoms(raw_preds)
        sorted_preds = sorted(raw_preds, key=lambda x: x[1], reverse=True)
        top_label, top_prob = sorted_preds[0] if sorted_preds else ("Unknown", 0.0)
        # Read bytes
        with open(temp_path, "rb") as f:
            img_bytes = f.read()
        os.remove(temp_path)

        report = generate_medical_report(symptoms, img_bytes, modality, mime_type=file.content_type)
        report_confidence = extract_confidence_from_report(report)
        confidence = round(report_confidence if report_confidence is not None else float(top_prob) * 100, 2)
        # Extract the disease from the report
        match = re.search(r"Disease Expected:\s*(.+)", report)
        disease = match.group(1).strip() if match else str(top_label)
        # Store the report in a global variable
        latest_reports[modality] = {
        "disease": disease,
        "symptoms": symptoms,
        "confidence": confidence,
        "report": report
        
        }
        return JSONResponse(content={"symptoms": symptoms, "disease": disease, "confidence": confidence, "report": report})
    except HTTPException:
        os.remove(temp_path)
        raise
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/get-latest-report/{modality}/")
async def get_latest_report(modality: str = Path(...)):
    modality = modality.lower()
    if modality not in latest_reports:
        raise HTTPException(status_code=404, detail="No report available for this modality.")
    return latest_reports[modality]


# CT 2D and 3D routes
@router.post("/predict/ct/2d/")
async def generate_report_ct2d(file: UploadFile = File(...)):
    modality = "ct"
    mode = "2d"

    # Only allow image files for 2D slices
    if file.content_type not in ["image/jpeg", "image/png", "image/bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type for CT2D.")

    file_bytes = await file.read()
    ensure_modality_upload("ct", file_bytes)

    temp_path = f"temp_ct2d_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)

    try:
        # Inference
        raw_preds = process_ct(temp_path, mode=mode, device="cpu")
        symptoms = extract_top_symptoms(raw_preds)
        sorted_preds = sorted(raw_preds, key=lambda x: x[1], reverse=True)
        top_label, top_prob = sorted_preds[0] if sorted_preds else ("Unknown", 0.0)

        # Read image bytes before deleting temp
        with open(temp_path, "rb") as f:
            img_bytes = f.read()
        os.remove(temp_path)

        # Generate report using correct MIME type
        report = generate_medical_report(
            symptoms, img_bytes, modality=modality, mime_type=file.content_type
        )

        # Extract disease
        match = re.search(r"Condition Detected:\s*(.+)", report)
        disease = match.group(1).strip() if match else str(top_label)
        report_confidence = extract_confidence_from_report(report)
        confidence = round(report_confidence if report_confidence is not None else float(top_prob) * 100, 2)

        # Store
        latest_reports["ct2d"] = {
            "symptoms": symptoms,
            "disease": disease,
            "confidence": confidence,
            "report": report
        }

        return JSONResponse({
            "symptoms": symptoms,
            "disease": disease,
            "confidence": confidence,
            "report": report
        })

    except HTTPException:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))



## 3d route 
@router.post("/predict/ct/3d/")
async def generate_report_ct3d(file: UploadFile = File(...)):
    image_mime_types = ["image/jpeg", "image/png", "image/bmp"]
    if file.content_type not in image_mime_types and not has_volume_extension(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Supported formats: JPEG, PNG, BMP."
        )

    file_bytes = await file.read()
    if file.content_type in image_mime_types:
        ensure_modality_upload("ct", file_bytes)

    # 1) Save upload to disk
    temp_path = f"temp_ct3d_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)

    # Convert 2D image uploads into a pseudo 3D volume for the 3D inference pipeline.
    if file.content_type in image_mime_types:
        try:
            pil_img = Image.open(temp_path).convert("L").resize((224, 224))
            arr = np.array(pil_img, dtype=np.float32)
            arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
            pseudo_vol = np.repeat(arr[np.newaxis, :, :], 64, axis=0)
            pseudo_path = f"temp_ct3d_{os.path.splitext(file.filename or 'upload')[0]}.nii"
            nii_img = nib.Nifti1Image(pseudo_vol, affine=np.eye(4))
            nib.save(nii_img, pseudo_path)
            os.remove(temp_path)
            temp_path = pseudo_path
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"Invalid image file for CT Tumor analysis: {e}")

    try:
        # 2) Run your 3D model to get symptoms label(s)
        raw_preds = process_ct(temp_path, mode="3d", device="cpu")
        label, prob = raw_preds[0] # type: ignore
        symptoms = [label]

        # 3) Load volume and pick mid-slices
        img = load(temp_path)
        vol = img.get_fdata() #type: ignore
        z, y, x = [d // 2 for d in vol.shape]
        slices = {
            "axial":   vol[z, :, :],
            "coronal": vol[:, y, :],
            "sagittal":vol[:, :, x],
        }

        os.remove(temp_path)

        # 5) Build prompt & send all three images + prompt
        prompt = (
        '''
        You are a medical AI assistant specialized in interpreting 3D and 2D CT scan results. 
        Given a set of AI-generated confidence scores for tumor detection, your task is to:

        1. Identify whether a tumor or no tumor is more likely based on the highest confidence score.
        2. Clearly mention the detected condition and the confidence score as a percentage (e.g., 92.00%).
        3. Explain what this result means for the patient in clear, simple language.
        4. Describe briefly how 3D CT scans assist in detecting tumors by providing detailed cross-sectional views of the body.
        5. Recommend possible next steps such as further imaging or biopsy for confirmation.
        6. End with a disclaimer stating that this is an AI-generated preliminary result and must be verified by a certified medical professional.
        7. Do not begin with "Based on the image and the patient symptoms" or any other introductory phrase.
        8. Report size should be always between 200 and 300 words.
        9. Use the following format for the output:

        Output example 
        Condition Detected: Tumor
        The AI analysis of your 3D CT scan of the brain indicates a high probability of a tumor, with a confidence score of 92.00%. This suggests there may be an abnormal mass or growth
        present in the scanned region. 3D CT scans allow doctors to view detailed cross-sectional images of internal tissues, making it easier to identify potential issues like 
        tumors. While this result is a strong indicator, it is not a confirmed diagnosis. Further testing, such as an MRI or biopsy, may be required. 
        Disclaimer: This is an AI-generated summary. Please consult a certified doctor or radiologist for medical confirmation and advice.
        '''
        )

        try:
            report = _groq_generate_text(prompt)
        except Exception as exc:
            print(f"REPORT API ERROR (ct3d): {exc}")
            report = ""

        if not report:
            report = generate_fallback_report(symptoms, modality="ct")

        match = re.search(r"Condition Detected:\s*(.+)", report)
        disease = match.group(1).strip() if match else "Unknown"
        report_confidence = extract_confidence_from_report(report)
        confidence = round(report_confidence if report_confidence is not None else float(prob) * 100, 2)

        # 6) Store & return
        latest_reports["ct3d"] = {
            "Symptom": label,
            "disease": disease,
            "confidence": confidence,
            "report": report
        }
        return JSONResponse(latest_reports["ct3d"])

    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/predict/ct/2d/")
async def get_latest_report_ct2d():
    if "ct2d" not in latest_reports:
        raise HTTPException(status_code=404, detail="No 2D CT report available.")
    return latest_reports["ct2d"]

@router.get("/predict/ct/3d/")
async def get_latest_report_ct3d():
    if "ct3d" not in latest_reports:
        raise HTTPException(status_code=404, detail="No 3D CT report available.")
    return latest_reports["ct3d"]

@router.post("/predict/mri/3d/")
async def generate_report_mri3d(file: UploadFile = File(...)):  
    image_mime_types = ["image/jpeg", "image/png", "image/bmp"]
    if file.content_type not in image_mime_types and not has_volume_extension(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Supported formats: JPEG, PNG, BMP."
        )

    file_bytes = await file.read()
    if file.content_type in image_mime_types:
        ensure_modality_upload("mri", file_bytes)

    # 1) Save upload to disk
    temp_path = f"temp_mri3d_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)

    # Convert 2D image uploads into a pseudo 3D volume for the 3D inference pipeline.
    if file.content_type in image_mime_types:
        try:
            pil_img = Image.open(temp_path).convert("L").resize((224, 224))
            arr = np.array(pil_img, dtype=np.float32)
            arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
            pseudo_vol = np.repeat(arr[np.newaxis, :, :], 64, axis=0)
            pseudo_path = f"temp_mri3d_{os.path.splitext(file.filename or 'upload')[0]}.nii"
            nii_img = nib.Nifti1Image(pseudo_vol, affine=np.eye(4))
            nib.save(nii_img, pseudo_path)
            os.remove(temp_path)
            temp_path = pseudo_path
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"Invalid image file for MRI analysis: {e}")
    try:
        # 2) Run your 3D model to get symptoms label(s)
        raw_preds = process_mri(temp_path, mode='3d', device="cpu")
        label, prob = raw_preds[0]
        symptoms = [label]

        # 3) Load volume and pick mid-slices
        img = load(temp_path)
        vol = img.get_fdata() #type: ignore
        z, y, x = [d // 2 for d in vol.shape]
        slices = {
            "axial":   vol[z, :, :],
            "coronal": vol[:, y, :],
            "sagittal":vol[:, :, x],
        }

        os.remove(temp_path)

        # 5) Build prompt & send all three images + prompt
        prompt = (
            '''
                You are a medical specialist in interpreting brain MRI results. 
                Based on the image and the patient symptoms: {symptoms}, your task is to:

                1. Identify the condition with the highest confidence score from the list: ["No Tumor", "Meningioma", "Glioma", "Pituitary Tumor"].
                2. Clearly mention the detected condition and the confidence score as a percentage (e.g., 87.45%).
                3. Explain what this result means for the patient in clear, simple language, based on the detected condition.
                4. Describe briefly how brain MRI helps in identifying such conditions by providing high-resolution images of soft tissues.
                5. Suggest possible next steps, such as neurologist consultation, further imaging, or biopsy, depending on the condition.
                6. End with a disclaimer stating that this is an AI-generated preliminary result and must be verified by a certified medical professional.
                7. Do not begin with "Based on the image and the patient symptoms" or any other introductory phrase.
                8. Report size should be always between 200 and 300 words.
                9. create a detailed MRI report including key findings, interpretation, and suggested follow‑up
                9. Use the following format for the output:

                Condition Detected: Glioma
                The AI analysis of your brain MRI scan suggests a high probability of Glioma, with a confidence score of 89.00%. Gliomas are tumors that originate in the glial cells of the brain or spinal cord. They can affect brain function depending on their location, size, and growth rate, potentially causing symptoms such as headaches, seizures, or neurological changes.

                MRI scans are highly effective for detecting such tumors, as they offer detailed images of soft brain tissues. This allows for accurate visualization of the tumor's structure and position, which is crucial for early diagnosis and treatment planning.

                Although this result indicates a strong likelihood of Glioma, it is not a confirmed medical diagnosis. You should consult a neurologist or oncologist for further evaluation. Additional tests like a contrast-enhanced MRI or biopsy may be recommended to validate the finding.

                Disclaimer: This is an AI-generated result. Please seek advice from a certified medical professional.
            '''
        ).format(symptoms=symptoms)

        try:
            report = _groq_generate_text(prompt)
        except Exception as exc:
            print(f"REPORT API ERROR (mri3d): {exc}")
            report = ""

        if not report:
            report = generate_fallback_report(symptoms, modality="mri")

        match = re.search(r"Condition Detected:\s*(.+)", report)
        disease = match.group(1).strip() if match else "Unknown"
        report_confidence = extract_confidence_from_report(report)
        confidence = round(report_confidence if report_confidence is not None else float(prob) * 100, 2)

        # 6) Store & return
        latest_reports["mri3d"] = {
            "Symptom": label,
            "disease": disease,
            "confidence": confidence,
            "report": report
        }
        return JSONResponse(latest_reports["mri3d"])
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/predict/mri/3d/")
async def get_latest_report_mri3d():
    if "mri3d" not in latest_reports:
        raise HTTPException(status_code=404, detail="No 3D MRI report available.")
    return latest_reports["mri3d"]

@router.post("/predict/ultrasound/")
async def generate_report_ultrasound(file: UploadFile = File(...)):
    modality = "ultrasound"

    # 1) Validate content type before saving
    if file.content_type not in ["image/jpeg", "image/png", "image/bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    file_bytes = await file.read()
    ensure_modality_upload("ultrasound", file_bytes)

    # 2) Save upload to disk
    temp_path = f"temp_{modality}_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)

    try:
        # 3) Run your ultrasound model to get symptom labels
        raw_preds = process_ultrasound(temp_path, device="cpu")
        symptoms = extract_top_symptoms(raw_preds)

        # 4) Read bytes for report generation
        with open(temp_path, "rb") as f:
            img_bytes = f.read()

        # remove temp file ASAP
        os.remove(temp_path)

        # 5) Generate the Groq-based medical report
        report = generate_medical_report(symptoms, img_bytes, modality=modality)

        def extract_condition(report: str) -> str:
            """
            Robustly pull the text immediately following 'Condition Detected:' 
            up to the first non‑empty line, ignoring case/extra whitespace.
            """
            if not report:
                return "Unknown"

            lower = report.lower()
            keyword = "condition detected"
            start = lower.find(keyword)
            if start == -1:
                return "Unknown"

            # Find the colon after the keyword
            colon = report.find(":", start + len(keyword))
            if colon == -1:
                return "Unknown"

            # Grab everything after the colon
            tail = report[colon+1:]

            # Split into lines, return the first non-blank one
            for line in tail.splitlines():
                line = line.strip()
                if line:
                    return line

            return "Unknown"

        disease = extract_condition(report)
        sorted_preds = sorted(raw_preds, key=lambda x: x[1], reverse=True)
        _, top_prob = sorted_preds[0] if sorted_preds else ("Unknown", 0.0)
        report_confidence = extract_confidence_from_report(report)
        confidence = round(report_confidence if report_confidence is not None else float(top_prob) * 100, 2)
        # 7) Store in global for frontend polling if needed
        latest_reports[modality] = {
            "disease":  disease,
            "symptoms": symptoms,
            "confidence": confidence,
            "report":   report,
        }

        # 8) Return JSON
        return JSONResponse(
            content={"symptoms": symptoms, "disease": disease, "confidence": confidence, "report": report}
        )

    except HTTPException:
        # Already an HTTPException—nothing extra to clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    except Exception as e:
        # Catch‐all: ensure temp file is removed
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/predict/ultrasound/")
async def get_latest_report_ultrasound():   
    if "ultrasound" not in latest_reports:
        raise HTTPException(status_code=404, detail="No ultrasound report available.")
    return latest_reports["ultrasound"]


@router.post("/predict/lab-report/")
async def generate_lab_report(file: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/png", "image/bmp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    temp_path = f"temp_lab_report_{file.filename}"
    with open(temp_path, "wb") as buf:
        buf.write(file_bytes)

    try:
        prompt = (
            "You are a patient-friendly lab report assistant. "
            "Read the uploaded lab report carefully and explain the important values in simple language. "
            "Highlight which values look normal and which may need follow-up. "
            "Do not diagnose or mention confidence scores or percentages. If the image is unreadable, say so clearly. "
            "Return a concise report with these labels exactly: Summary, Abnormal Values, Normal Values, Suggested Next Steps, Disclaimer. "
            "Keep the response warm, clear, and easy to understand."
        )
        if file.content_type == "application/pdf":
            try:
                from PyPDF2 import PdfReader  # type: ignore

                reader = PdfReader(io.BytesIO(file_bytes))
                extracted_text = "\n".join(page.extract_text() or "" for page in reader.pages)
                if not extracted_text.strip():
                    raise HTTPException(
                        status_code=400,
                        detail="Wrong image given, expected lab report."
                    )

                if not _groq_is_lab_report_text(extracted_text):
                    raise HTTPException(
                        status_code=400,
                        detail="Wrong image given, expected lab report."
                    )

                prompt = (
                    "You are a patient-friendly lab report assistant. "
                    "Explain the following lab report text in simple language, highlighting normal and abnormal values. "
                    "Do not diagnose or mention confidence scores or percentages. Return a concise report with these labels exactly: Summary, Abnormal Values, Normal Values, Suggested Next Steps, Disclaimer.\n\n"
                    f"LAB REPORT TEXT:\n{extracted_text}"
                )
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Wrong image given, expected lab report."
                )

        else:
            if not _groq_is_lab_report_image(file_bytes):
                raise HTTPException(
                    status_code=400,
                    detail="Wrong image given, expected lab report."
                )

        report = _groq_generate_vision_text(file_bytes, prompt) if file.content_type != "application/pdf" else _groq_generate_text(prompt)
        report = _sanitize_lab_report_text(report)
        if not report:
            report = (
                "Summary: The uploaded lab report could not be read clearly. "
                "Please upload a sharper image or a text-based PDF so I can explain it properly."
            )

        latest_reports["lab_report"] = {
            "disease": "Lab Report Summary",
            "symptoms": [],
            "report": report,
            "hideConfidence": True,
        }

        return JSONResponse(
            content={
                "symptoms": [],
                "disease": "Lab Report Summary",
                "report": report,
                "hideConfidence": True,
                "recommendations": [
                    "Review the lab report with your doctor.",
                    "Ask which values are normal, borderline, or abnormal.",
                    "Repeat the test if your clinician recommends it."
                ],
                "suggested_tests": [],
                "specialty": "General Physician",
            }
        )

    except HTTPException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# Live nearby-doctor lookup
class Doctor(BaseModel):
    name: str
    specialty: str
    location: str
    phone: str
    lat: float
    lng: float

def _resolve_doctor_specialty(tags: Dict[str, Any]) -> str:
    return (
        tags.get("healthcare:speciality")
        or tags.get("healthcare:specialty")
        or tags.get("specialty")
        or tags.get("department")
        or tags.get("healthcare")
        or tags.get("amenity")
        or "General Physician"
    )


def _matches_specialty(requested: str, doctor_specialty: str) -> bool:
    if not requested.strip():
        return True

    requested_lower = requested.lower().strip()
    doctor_lower = doctor_specialty.lower()
    return requested_lower in doctor_lower or doctor_lower in requested_lower


def _format_doctor_entry(element: Dict[str, Any], fallback_location: str) -> Optional[Dict[str, Any]]:
    tags = element.get("tags", {})
    lat = element.get("lat")
    lng = element.get("lon")
    if lat is None or lng is None:
        return None

    name = tags.get("name") or tags.get("operator") or "Unnamed Doctor"
    specialty = _resolve_doctor_specialty(tags)
    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile") or "Not available"

    address_parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb"),
        tags.get("addr:city"),
    ]
    address = ", ".join([part for part in address_parts if part]) or tags.get("addr:full") or fallback_location

    return {
        "name": name,
        "specialty": specialty,
        "location": address,
        "phone": phone,
        "lat": float(lat),
        "lng": float(lng),
    }


def _sort_doctors_by_distance(doctors: List[Dict[str, Any]], lat: float, lng: float) -> List[Dict[str, Any]]:
    def distance_sq(doctor: Dict[str, Any]) -> float:
        return (doctor["lat"] - lat) ** 2 + (doctor["lng"] - lng) ** 2

    return sorted(doctors, key=distance_sq)


def build_overpass_query(lat: float, lng: float, shift: float = 0.03) -> str:
    lat_min = lat - shift
    lng_min = lng - shift
    lat_max = lat + shift
    lng_max = lng + shift
    return f"""
    [out:json][timeout:25];
    node
      [healthcare=doctor]
      ({lat_min},{lng_min},{lat_max},{lng_max});
    out;
    """

@router.get("/api/search-doctors")
async def search_doctors(
    location: str,
    specialty: str = "",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
):
    if lat is not None and lng is not None:
        search_lat, search_lng = lat, lng
    else:
        try:
            geolocator = Nominatim(user_agent="doctor-search")
            location_obj = geolocator.geocode(location + ", India")
        except Exception as e:
            print(f"Geocoding failed for {location}: {e}")
            location_obj = None

        if not location_obj:
            print(f"Could not geocode location: {location}")
            return []

        search_lat, search_lng = location_obj.latitude, location_obj.longitude
        print(f"Geocoded {location} to ({search_lat}, {search_lng})")

    radius = 15000  # 15 km
    query = f"""
    [out:json][timeout:30];
    (
      node["healthcare"="doctor"](around:{radius},{search_lat},{search_lng});
      node["amenity"="doctors"](around:{radius},{search_lat},{search_lng});
      node["amenity"="clinic"](around:{radius},{search_lat},{search_lng});
      node["amenity"="hospital"](around:{radius},{search_lat},{search_lng});
      node["healthcare"="clinic"](around:{radius},{search_lat},{search_lng});
    );
    out body;
    """

    overpass_mirrors = [
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
    ]
    elements = []
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            for mirror_url in overpass_mirrors:
                try:
                    res = await client.post(mirror_url, data={"data": query})
                    if res.status_code == 200:
                        data = res.json()
                        elements = data.get("elements", [])
                        print(f"Overpass ({mirror_url.split('//')[1].split('/')[0]}) returned {len(elements)} elements for {location}")
                        break
                    else:
                        print(f"Overpass mirror {mirror_url} returned {res.status_code}, trying next...")
                except Exception as mirror_err:
                    print(f"Overpass mirror {mirror_url} failed: {mirror_err}, trying next...")
                    continue
    except Exception as e:
        print(f"Overpass query failed: {e}")
        elements = []

    doctors: List[Dict[str, Any]] = []
    for element in elements:
        doctor = _format_doctor_entry(element, location)
        if not doctor:
            continue
        if specialty and not _matches_specialty(specialty, doctor["specialty"]):
            continue
        doctors.append(doctor)

    doctors = _sort_doctors_by_distance(doctors, search_lat, search_lng)
    print(f"Returning {len(doctors)} doctors for {location} (specialty: {specialty})")
    return doctors
# @router.get("/api/get-doctor/{doctor_id}", response_model=Doctor)


#chatbot of landing page 

class ChatRequest(BaseModel):
    message: str
    report_context: Optional[Dict[str, Any]] = None
    chat_history: Optional[List[Dict[str, str]]] = None


def _safe_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return []


_CONDITION_EXPLANATIONS = {
    "nodule": (
        "A nodule is a small, round spot seen in the lung. Many nodules are benign "
        "(old infection/scar), but some need follow-up imaging to rule out serious causes."
    ),
    "mass": (
        "A mass is a larger abnormal area in tissue. It can be benign or malignant, "
        "so doctors usually recommend additional imaging and sometimes biopsy."
    ),
    "consolidation": (
        "Consolidation means part of the lung air spaces are filled with fluid/pus/cells, "
        "commonly seen in infections like pneumonia."
    ),
    "pleural effusion": (
        "Pleural effusion is fluid around the lungs (in pleural space). "
        "It can happen with infection, heart/liver/kidney issues, or inflammation."
    ),
    "pneumonia": (
        "Pneumonia is a lung infection causing inflammation and fluid in air sacs. "
        "Symptoms can include fever, cough, chest pain, and breathing difficulty."
    ),
    "glioma": (
        "Glioma is a tumor that arises from glial cells in the brain or spinal cord. "
        "Treatment depends on type, grade, and location."
    ),
    "meningioma": (
        "Meningioma is a tumor from the brain/spinal cord covering (meninges). "
        "Many are slow-growing and benign, but evaluation is still important."
    ),
    "pituitary tumor": (
        "A pituitary tumor is growth in the pituitary gland. It may affect hormones, vision, "
        "or cause headaches depending on size and activity."
    ),
    "tumor": (
        "A tumor is an abnormal tissue growth. Tumors can be benign or malignant, "
        "and confirmation typically needs specialist review and tests."
    ),
    "cyst": (
        "A cyst is a fluid-filled sac. Many cysts are benign, but follow-up depends on size, "
        "location, symptoms, and imaging characteristics."
    ),
}

_CONDITION_ALIASES = {
    "giloma": "glioma",
    "gliom": "glioma",
    "glimoa": "glioma",
    "meningiom": "meningioma",
    "pnemonia": "pneumonia",
    "phenumonia": "pneumonia",
    "noduel": "nodule",
    "nodul": "nodule",
}


def _normalize_term(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", "", text.lower()).strip()


def _extract_condition_query(user_message: str) -> Optional[str]:
    patterns = [
        r"what is ([a-zA-Z\s-]{2,40})",
        r"what is a ([a-zA-Z\s-]{2,40})",
        r"what is an ([a-zA-Z\s-]{2,40})",
        r"explain ([a-zA-Z\s-]{2,40})",
        r"tell me about ([a-zA-Z\s-]{2,40})",
        r"meaning of ([a-zA-Z\s-]{2,40})",
    ]
    for pattern in patterns:
        match = re.search(pattern, user_message, flags=re.IGNORECASE)
        if match:
            term = match.group(1).strip(" ?.!")
            return _normalize_term(term)
    return None


def _find_best_known_condition(term: str, report_terms: List[str]) -> Optional[str]:
    if not term:
        return None

    term = _CONDITION_ALIASES.get(term, term)

    normalized_known = {k: k for k in _CONDITION_EXPLANATIONS.keys()}
    for report_term in report_terms:
        rt = _normalize_term(report_term)
        if rt and rt not in normalized_known and rt in _CONDITION_EXPLANATIONS:
            normalized_known[rt] = rt

    if term in normalized_known:
        return normalized_known[term]

    for known in normalized_known:
        if term in known or known in term:
            return normalized_known[known]

    close = difflib.get_close_matches(term, list(normalized_known.keys()), n=1, cutoff=0.72)
    if close:
        return normalized_known[close[0]]

    return None


def _build_report_chat_reply(user_message: str, report_context: Optional[Dict[str, Any]], chat_history: Optional[List[Dict[str, str]]] = None) -> str:
    msg = user_message.strip()
    if not msg:
        return "Please ask your question about the report."

    ctx = report_context or {}
    diagnosis = str(ctx.get("diagnosis") or ctx.get("disease") or "Unknown")
    confidence = ctx.get("confidence")
    confidence_text = f"{confidence}%" if confidence is not None else "not available"
    symptoms = _safe_list(ctx.get("symptoms"))
    recommendations = _safe_list(ctx.get("recommendations"))
    suggested_tests = _safe_list(ctx.get("suggested_tests"))
    specialty = str(ctx.get("specialty") or "General Physician")
    report_text = str(ctx.get("report") or "")

    if not ctx:
        return (
            "I can answer report-specific doubts, but I do not have your latest report context. "
            "Please open chat from the result page after upload."
        )

    system_prompt = f"""You are MedVision AI Assistant, a professional radiology and diagnostic specialist.
Your goal is to explain medical diagnostic reports to patients in a clear, compassionate, and accurate manner.

CURRENT REPORT CONTEXT:
- Diagnosis/Condition: {diagnosis}
- AI Confidence: {confidence_text}
- Findings/Symptoms: {", ".join(symptoms) if symptoms else "Not specified"}
- Recommendations: {"; ".join(recommendations) if recommendations else "Consult a specialist"}
- Suggested Tests: {", ".join(suggested_tests) if suggested_tests else "Not specified"}
- Suggested Specialist: {specialty}

FULL REPORT TEXT:
{report_text}

GUIDELINES:
1. Use the provided context to answer questions specifically about this report.
2. Explain medical terms in simple, easy-to-understand language.
3. If asked to "summarize" or "explain the report", provide a concise overview of the diagnosis, confidence, and next steps.
4. If a question is unrelated to the report or general medical knowledge, politely redirect to the report context.
5. ALWAYS maintain a professional tone and include a disclaimer that you are an AI and the patient should consult a doctor for final confirmation.
6. Do not mention "confidence scores" unless specifically asked or explaining the reliability of the AI finding.
7. Be encouraging but realistic.
"""

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add history
    if chat_history:
        for m in chat_history:
            role = "user" if m.get("role") == "user" else "assistant"
            content = m.get("text") or m.get("content") or ""
            if content:
                messages.append({"role": role, "content": content})
    
    # Add current message
    messages.append({"role": "user", "content": msg})

    try:
        model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as exc:
        print(f"CHAT_WITH_REPORT ERROR: {exc}")
        return "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment."

@router.post("/chat_with_report/")
async def chat_with_report(request: ChatRequest):
    reply = _build_report_chat_reply(
        request.message,
        request.report_context,
        request.chat_history,
    )

    return {"response": reply}