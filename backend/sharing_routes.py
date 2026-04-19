"""
Caregiver Sharing Layer — FastAPI Routes
=========================================
POST   /api/v1/share/generate     → create a share code  (auth required)
GET    /api/v1/shared/{code}      → fetch read-only data (public)
DELETE /api/v1/share/{code}       → revoke a share code  (auth required)
"""

import os
import string
import random
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

load_dotenv()

router = APIRouter()

# ── Supabase config ──────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# If not set, try the VITE_ prefixed ones (dev convenience)
if not SUPABASE_URL:
    SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
if not SUPABASE_SERVICE_KEY:
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))

SUPABASE_HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
}

SLOT_HOURS = {"morning": "8:00 AM", "afternoon": "1:00 PM", "evening": "8:00 PM"}


# ── Helpers ──────────────────────────────────────────────────

async def _get_user_id_from_token(authorization: str) -> str:
    """Extract user ID from Supabase JWT payload (base64-decoded)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.replace("Bearer ", "")

    # Decode JWT payload (middle segment) to extract user_id
    try:
        import base64, json
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed JWT")
        # Add padding for base64
        payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No 'sub' claim in JWT")
        # Check expiry
        exp = payload.get("exp", 0)
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            raise HTTPException(status_code=401, detail="Token has expired.")
        print(f"[SHARE AUTH] SUCCESS: user_id={user_id}")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SHARE AUTH] FAIL: Could not decode JWT: {e}")
        raise HTTPException(status_code=401, detail="Invalid token.")


def _generate_share_code() -> str:
    """Generate a short unique code like MED-AX72K."""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=5))
    return f"MED-{suffix}"


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _compute_shared_data(
    journeys: list,
    dose_logs: list,
    owner_name: str,
) -> dict:
    """
    Transform raw journey + dose_log data into a safe, filtered response
    for the caregiver view. No raw JSONB or internal IDs are exposed.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    # Merge all medicines from all journeys
    all_meds = []
    first_created = None
    max_duration_days = 30

    for j in journeys:
        extracted = j.get("extracted_data") or []
        created_at = j.get("created_at", "")
        if created_at and (first_created is None or created_at < first_created):
            first_created = created_at
        for med in extracted:
            name = med.get("medicine_name") or med.get("name", "Unknown")
            duration_str = med.get("duration", "30 days")
            days = 30
            import re
            m = re.search(r"(\d+)", str(duration_str))
            if m:
                days = int(m.group(1))
            max_duration_days = max(max_duration_days, days)
            all_meds.append({
                "name": name,
                "frequency": med.get("frequency", ""),
                "duration": duration_str,
                "description": med.get("description", ""),
                "morning": bool(med.get("morning")),
                "afternoon": bool(med.get("afternoon")),
                "evening": bool(med.get("evening")),
                "course_days": days,
            })

    # Deduplicate by name
    seen = {}
    unique_meds = []
    for med in all_meds:
        if med["name"] not in seen:
            seen[med["name"]] = True
            unique_meds.append(med)

    # Journey day calculation
    journey_day = 1
    if first_created:
        try:
            start = datetime.fromisoformat(first_created.replace("Z", "+00:00"))
            journey_day = max(1, (now - start).days + 1)
        except Exception:
            pass

    # Build today's schedule
    today_schedule = []
    for slot in ["morning", "afternoon", "evening"]:
        slot_meds = [m for m in unique_meds if m.get(slot)]
        if not slot_meds:
            continue
        for med in slot_meds:
            # Find dose log for this med/slot/today
            log_status = "pending"
            for log in dose_logs:
                if (
                    log.get("medicine_name") == med["name"]
                    and log.get("slot") == slot
                    and log.get("log_date") == today
                ):
                    log_status = log.get("status", "pending")
                    break
            today_schedule.append({
                "medicine": med["name"],
                "slot": slot,
                "time": SLOT_HOURS.get(slot, ""),
                "status": log_status,
                "description": med["description"],
            })

    # Adherence calculations
    total_today = len(today_schedule)
    taken_today = sum(1 for s in today_schedule if s["status"] == "taken")
    adherence_today = round((taken_today / total_today) * 100) if total_today else 0

    # Weekly adherence (last 7 days)
    weekly_total = 0
    weekly_taken = 0
    for i in range(7):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        for slot in ["morning", "afternoon", "evening"]:
            for med in unique_meds:
                if med.get(slot):
                    weekly_total += 1
                    for log in dose_logs:
                        if (
                            log.get("medicine_name") == med["name"]
                            and log.get("slot") == slot
                            and log.get("log_date") == d
                            and log.get("status") == "taken"
                        ):
                            weekly_taken += 1
                            break
    weekly_adherence = round((weekly_taken / weekly_total) * 100) if weekly_total else 0

    # Missed doses (today)
    missed_doses = [s for s in today_schedule if s["status"] == "not_taken"]

    # Next dose
    current_hour = datetime.now().hour
    next_dose = "8:00 AM (Tomorrow)"
    if any(m.get("morning") for m in unique_meds) and current_hour < 8:
        next_dose = "8:00 AM"
    elif any(m.get("afternoon") for m in unique_meds) and current_hour < 13:
        next_dose = "1:00 PM"
    elif any(m.get("evening") for m in unique_meds) and current_hour < 20:
        next_dose = "8:00 PM"

    # Status flag
    overall_adherence = weekly_adherence
    if overall_adherence >= 80:
        status = "good"
    elif overall_adherence >= 60:
        status = "warning"
    else:
        status = "critical"

    # Course progress per medicine
    course_progress = []
    for med in unique_meds:
        days_in = min(journey_day, med["course_days"])
        pct = min(100, round((days_in / med["course_days"]) * 100))
        course_progress.append({
            "medicine": med["name"],
            "frequency": med["frequency"],
            "duration": med["duration"],
            "progress_pct": pct,
        })

    # Weekly bar data (last 5 days) for chart
    weekly_bars = []
    for i in range(4, -1, -1):
        d = now - timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        day_label = d.strftime("%a")
        day_total = 0
        day_taken = 0
        for slot in ["morning", "afternoon", "evening"]:
            for med in unique_meds:
                if med.get(slot):
                    day_total += 1
                    for log in dose_logs:
                        if (
                            log.get("medicine_name") == med["name"]
                            and log.get("slot") == slot
                            and log.get("log_date") == d_str
                            and log.get("status") == "taken"
                        ):
                            day_taken += 1
                            break
        pct = round((day_taken / day_total) * 100) if day_total else 0
        weekly_bars.append({
            "day": day_label,
            "pct": pct,
            "is_today": d_str == today,
        })

    return {
        "patient_name": owner_name,
        "journey_day": journey_day,
        "journey_duration": max_duration_days,
        "today_schedule": today_schedule,
        "adherence_today": adherence_today,
        "weekly_adherence": weekly_adherence,
        "missed_doses": missed_doses,
        "next_dose": next_dose,
        "status": status,
        "medicines": [
            {
                "name": m["name"],
                "frequency": m["frequency"],
                "duration": m["duration"],
                "description": m["description"],
                "morning": m["morning"],
                "afternoon": m["afternoon"],
                "evening": m["evening"],
            }
            for m in unique_meds
        ],
        "course_progress": course_progress,
        "weekly_bars": weekly_bars,
        "doses_today_taken": taken_today,
        "doses_today_total": total_today,
    }


# ── Route models ─────────────────────────────────────────────

class GenerateRequest(BaseModel):
    expires_in_days: int = 7


class GenerateResponse(BaseModel):
    share_code: str
    share_link: str
    expires_at: str


# ── POST /api/v1/share/generate ──────────────────────────────

@router.post("/api/v1/share/generate", response_model=GenerateResponse)
async def generate_share_code(
    body: GenerateRequest = GenerateRequest(),
    authorization: Optional[str] = Header(None),
):
    user_id = await _get_user_id_from_token(authorization)
    share_code = _generate_share_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)).isoformat()

    # Insert into shared_access via Supabase REST
    # Forward the user's JWT authorization so Supabase RLS evaluates auth.uid() correctly
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/shared_access",
            headers={**SUPABASE_HEADERS, "Authorization": authorization, "Prefer": "return=representation"},
            json={
                "owner_id": user_id,
                "share_code": share_code,
                "permission": "read_only",
                "expires_at": expires_at,
            },
        )
    if resp.status_code not in (200, 201):
        err_body = resp.text[:500]
        print(f"[SHARE] Insert failed ({resp.status_code}): {err_body}")
        if resp.status_code == 404 or "relation" in err_body.lower() or "does not exist" in err_body.lower():
            raise HTTPException(
                status_code=500,
                detail="The 'shared_access' table does not exist in Supabase. Please create it — see the README for the SQL."
            )
        raise HTTPException(status_code=500, detail=f"Failed to create share code: {err_body}")

    return GenerateResponse(
        share_code=share_code,
        share_link=f"/shared/journey/{share_code}",
        expires_at=expires_at,
    )


# ── GET /api/v1/shared/{share_code} ─────────────────────────

@router.get("/api/v1/shared/{share_code}")
async def get_shared_journey(share_code: str):
    auth_header = f"Bearer {SUPABASE_SERVICE_KEY}"

    async with httpx.AsyncClient() as client:
        # 1. Validate share code
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/shared_access?share_code=eq.{share_code}&select=*",
            headers={**SUPABASE_HEADERS, "Authorization": auth_header},
        )
    if resp.status_code != 200 or not resp.json():
        raise HTTPException(status_code=404, detail="Invalid share code.")

    share_record = resp.json()[0]

    # Check expiry
    expires_at = share_record.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(status_code=410, detail="This share link has expired.")
        except (ValueError, TypeError):
            pass

    owner_id = share_record["owner_id"]

    async with httpx.AsyncClient() as client:
        # 2. Fetch owner's journeys
        j_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/journeys?user_id=eq.{owner_id}&select=extracted_data,created_at&order=created_at.asc",
            headers={**SUPABASE_HEADERS, "Authorization": auth_header},
        )
        journeys = j_resp.json() if j_resp.status_code == 200 else []

        # 3. Fetch owner's dose_logs (last 7 days)
        date_limit = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        d_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/dose_logs?user_id=eq.{owner_id}&log_date=gte.{date_limit}&select=medicine_name,slot,status,log_date",
            headers={**SUPABASE_HEADERS, "Authorization": auth_header},
        )
        dose_logs = d_resp.json() if d_resp.status_code == 200 else []

        # 4. Fetch owner's display name
        u_resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users/{owner_id}",
            headers={**SUPABASE_HEADERS, "Authorization": auth_header},
        )
    owner_name = "Patient"
    if u_resp.status_code == 200:
        user_data = u_resp.json()
        meta = user_data.get("user_metadata", {})
        owner_name = meta.get("full_name") or user_data.get("email", "Patient").split("@")[0]

    return _compute_shared_data(journeys, dose_logs, owner_name)


# ── DELETE /api/v1/share/{share_code} ────────────────────────

@router.delete("/api/v1/share/{share_code}")
async def revoke_share_code(
    share_code: str,
    authorization: Optional[str] = Header(None),
):
    user_id = await _get_user_id_from_token(authorization)

    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/shared_access?share_code=eq.{share_code}&owner_id=eq.{user_id}",
            headers={**SUPABASE_HEADERS, "Authorization": authorization},
        )
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=404, detail="Share code not found or not owned by you.")

    return {"status": "revoked", "share_code": share_code}
