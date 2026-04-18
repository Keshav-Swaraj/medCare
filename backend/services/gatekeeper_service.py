import json
import os
import base64
from imghdr import what
from typing import Dict

from groq import Groq


class ModalityValidationAPIError(Exception):
    """Raised when modality validation API cannot be completed."""


_ALLOWED_MODALITIES = {
    "xray",
    "ct",
    "mri",
    "ultrasound",
}

_OFFLINE_ACTUAL_TYPE = "verification_unavailable"
_DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _infer_mime_type(image_bytes: bytes) -> str:
    detected = what(None, h=image_bytes) or "jpeg"
    if detected == "jpg":
        detected = "jpeg"
    return f"image/{detected}"


def _extract_text_response(response) -> str:
    # Groq returns response.choices[0].message.content
    try:
        if hasattr(response, 'choices') and response.choices:
            return response.choices[0].message.content or ""
    except Exception as exc:
        raise ModalityValidationAPIError("Could not extract text from Groq response") from exc

    raise ModalityValidationAPIError("Could not extract text from Groq response")


def validate_modality(image_bytes: bytes, expected_modality: str) -> Dict[str, object]:
    """
    Validate whether an uploaded image matches the expected medical modality.

    Returns strict JSON-like dict with exactly two keys:
      - is_match: bool
      - actual_type: str

        Raises:
            - ValueError for invalid expected_modality
    """
    expected = expected_modality.strip().lower()
    if expected not in _ALLOWED_MODALITIES:
        raise ValueError(
            f"Unsupported expected_modality '{expected_modality}'. "
            f"Allowed: {sorted(_ALLOWED_MODALITIES)}"
        )

    if not image_bytes:
        return {"is_match": False, "actual_type": "empty_or_invalid_image"}

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("API ERROR: GROQ_API_KEY is not set")
        return {"is_match": False, "actual_type": _OFFLINE_ACTUAL_TYPE}

    prompt = (
        "You are a strict medical image modality gatekeeper. "
        "Classify the uploaded image as one of: xray, ct, mri, ultrasound, or non_medical. "
        "Return ONLY valid JSON with exactly these keys: "
        "{\"is_match\": boolean, \"actual_type\": string}. "
        f"expected_modality='{expected}'. "
        "Set is_match=true only if actual_type exactly matches expected_modality."
    )

    client = Groq(api_key=api_key)
    mime_type = _infer_mime_type(image_bytes)
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    vision_model = os.getenv("GROQ_VISION_MODEL", _DEFAULT_GROQ_VISION_MODEL)

    try:
        response = client.chat.completions.create(
            model=vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                        },
                    ],
                }
            ],
            max_tokens=300,
            temperature=0,
        )
        raw_json = _extract_text_response(response)
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            start = raw_json.find("{")
            end = raw_json.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            parsed = json.loads(raw_json[start:end + 1])
    except Exception as e:
        print(f"API ERROR: {str(e)}")
        return {"is_match": False, "actual_type": _OFFLINE_ACTUAL_TYPE}

    is_match = bool(parsed.get("is_match", False))
    actual_type = str(parsed.get("actual_type", "unknown")).strip().lower() or "unknown"

    # Strict output shape.
    return {
        "is_match": is_match,
        "actual_type": actual_type,
    }


def format_mismatch_message(expected_modality: str, actual_type: str) -> str:
    expected = (expected_modality or "").strip().lower() or "xray"
    actual = (actual_type or "").strip().lower()

    if actual == _OFFLINE_ACTUAL_TYPE:
        return "Verification service unavailable. Cannot validate scan type right now."

    return f"Wrong image given, expected {expected}."
