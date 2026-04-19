# Caregiver Sharing Layer — Implementation Plan

## Goal
Add a secure, read-only caregiver sharing feature that lets a patient share their medication journey with a caregiver/doctor via a short code or link.

---

## Proposed Changes

### Database Layer (Supabase SQL)

#### [NEW] `shared_access` table
```sql
CREATE TABLE shared_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE NOT NULL,
  permission TEXT DEFAULT 'read_only',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own shares
CREATE POLICY "owner_manage" ON shared_access FOR ALL USING (auth.uid() = owner_id);

-- Anyone can read by share_code (needed for the public lookup)
CREATE POLICY "public_read_by_code" ON shared_access FOR SELECT USING (true);
```

> [!IMPORTANT]
> You will need to run this SQL in your **Supabase SQL Editor** before the feature works.

---

### Backend (FastAPI)

#### [NEW] [sharing_routes.py](file:///d:/medCare/backend/sharing_routes.py)

New FastAPI `APIRouter` with 3 endpoints:

| Endpoint | Method | Auth? | Description |
|---|---|---|---|
| `/api/v1/share/generate` | POST | Yes (Supabase JWT) | Generate a `MED-XXXXX` code, store in `shared_access` |
| `/api/v1/shared/{share_code}` | GET | No | Validate code, fetch owner's journey + dose_logs, return filtered/safe JSON |
| `/api/v1/share/{share_code}` | DELETE | Yes | Revoke a share code (owner only) |

**Key design decisions:**
- Auth is done by reading the `Authorization: Bearer <jwt>` header and verifying against Supabase's `auth.getUser()` REST endpoint (lightweight, no Supabase Python SDK needed — just an `httpx` call).
- The shared data response computes `today_schedule`, `adherence_today`, `weekly_adherence`, `missed_doses`, `next_dose`, `journey_day`, and a `status` field (`good`/`warning`/`critical`) from raw journey + dose_log data.
- No raw JSONB, no internal IDs, no auth tokens are exposed.

#### [MODIFY] [main.py](file:///d:/medCare/backend/main.py)
- Import and register `sharing_router` with `app.include_router(sharing_router)`.

---

### Frontend (React)

#### [NEW] [SharedJourney.jsx](file:///d:/medCare/src/pages/SharedJourney.jsx)

Public page at `/shared/journey/:code` — **no auth required**.

- Fetches `GET /api/v1/shared/{code}` from the backend.
- Renders a **read-only dashboard** reusing the same visual patterns as `AgentDashboard.jsx`:
  - Today's Schedule (medicines by slot, with taken/missed/pending badges — no toggle)
  - Adherence Overview (three circular rings: Today, Weekly, Journey)
  - Course progress bars per medicine
  - Status banner (`good`/`warning`/`critical`)
- Header clearly shows **"👥 Caregiver View (Read Only)"** label.
- Error states: expired code, invalid code, loading spinner.

#### [MODIFY] [AgentDashboard.jsx](file:///d:/medCare/src/pages/AgentDashboard.jsx)
- Add a **"Share My Journey"** button in the header area (next to "Download PDF Report").
- On click, opens a modal/popover that:
  - Calls `POST /api/v1/share/generate` with the user's Supabase JWT.
  - Displays the generated share code and a copyable link.
  - Shows a "Revoke" button for any existing active share code.

#### [MODIFY] [App.jsx](file:///d:/medCare/src/App.jsx)
- Add route: `<Route path="/shared/journey/:code" element={<SharedJourney />} />`
- This route is **public** (no `ProtectedRoute` wrapper).

---

## File Summary

| File | Action | Description |
|---|---|---|
| `backend/sharing_routes.py` | NEW | 3 API endpoints for share lifecycle |
| `backend/main.py` | MODIFY | Register the sharing router |
| `src/pages/SharedJourney.jsx` | NEW | Read-only caregiver dashboard page |
| `src/pages/AgentDashboard.jsx` | MODIFY | Add "Share My Journey" button + modal |
| `src/App.jsx` | MODIFY | Add `/shared/journey/:code` public route |
| Supabase SQL Editor | MANUAL | Create `shared_access` table + RLS policies |

---

## Verification Plan

### Automated Tests
1. Start backend → hit `POST /api/v1/share/generate` with a valid JWT → confirm `share_code` returned.
2. Hit `GET /api/v1/shared/{code}` → confirm structured response with no raw DB fields.
3. Hit `GET /api/v1/shared/INVALID` → confirm 404.
4. Hit `DELETE /api/v1/share/{code}` → confirm revocation, then GET returns 404.

### Manual / Browser Verification
1. Log in as User1 → click "Share My Journey" → copy link.
2. Open link in incognito (no auth) → see read-only dashboard with correct data.
3. Verify no interactive elements (no toggles, no mutation buttons).
4. Revoke from User1 → refresh incognito → see "Access denied" error.
