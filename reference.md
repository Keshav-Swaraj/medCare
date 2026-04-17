# MedCare Agent – Reference.md
**Project Reference for Antigravity Agent**

**Version:** 1.0 (Hackathon MVP – 36-hour build)  
**Last Updated:** 18 April 2026  
**Goal:** Build a complete, agentic prescription journey companion for elderly patients and caregivers in India.  
**Track:** Autonomous Agents + HealthTech (HackSurgeX / Open Innovation)

This file is the single source of truth for the Antigravity agent. Use it to generate code, UI, backend routes, and features consistently.

---

## 1. Project Overview
**Name:** MedCare Agent (formerly MedGuide Agent / Prescription Journey Agent)

**One-line description:**  
Upload any handwritten prescription, discharge summary, or lab report → AI extracts medicines → shows price comparison + buying links → Activate MedCare Agent → persistent 30-day journey with day-by-day adherence tracking, graphical dashboard, and daily WhatsApp reminders.

**Core Value Proposition (for demo & pitch):**
- Solves India’s #1 chronic care failure: low medication adherence (~51% in elderly).
- Persistent memory + autonomous actions (no general LLM can do this reliably).
- Built for elderly + caregivers (Hindi support, simple UI, WhatsApp-first).

**Key Differentiator:**  
Not another reminder app. It is the first **autonomous prescription journey agent** that starts from one photo and runs for 30 days with visible results.

---

## 2. User Flow (Exact Order)

1. **Landing Page** (`/`)
   - Hero image + tagline: “Turn any prescription into a 30-day personal health journey”
   - CTA: “Get Started” → Sign Up / Sign In

2. **Auth Pages** (`/login`, `/signup`)
   - Email + Password (simple JWT)
   - Google login optional
   - Guest/demo mode allowed for hackathon

3. **Upload / Manual Entry Page** (`/upload`)
   - Two tabs: “Upload Image” + “Manual Entry”
   - Image upload → Google Vision OCR (existing pipeline)
   - Extracts exactly **3 fields** per medicine:
     - Medicine name + strength
     - When to take (frequency + timing, e.g. “twice a day after food”)
     - How many days to take (duration)
   - Manual form fallback (same 3 fields)

4. **Results / Medicine Cards Page** (`/journey/:id` or `/results`)
   - Grid of medicine cards (name, dosage, frequency, duration, purpose)
   - **Price Comparison Section** (real Jan Aushadhi vs branded)
     - Savings in ₹
     - Direct working buying links (1mg / PharmEasy / official Jan Aushadhi search URL)
   - Big green button: **“Activate MedCare Agent”**

5. **MedCare Agent Dashboard** (Graphical Journey Page) (`/agent/:journeyId`)
   - Only visible after activation
   - 30-day adherence calendar (grid + streak counter)
   - Adherence % graph (line chart – weekly progress)
   - Visible results section (placeholder for future BP/sugar/symptom logs)
   - Daily summary card

6. **Separate Chatbot Page** (`/chatbot` or `/agent/chat`)
   - Full-screen chat interface
   - **Preloaded user context** (critical):
     - Current journey ID
     - All medicines + schedule
     - Current adherence %
     - Start date
     - User profile (name, age group, caregiver phone)
   - Chat remembers the entire prescription journey (use system prompt + conversation history stored in DB)
   - Example: User asks “What should I eat with my morning tablet?” → bot answers using the exact medicines in context.

---

## 3. Tech Stack (Antigravity Default)
- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express.js (for heavy AI/OCR) or Supabase Edge Functions
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **OCR:** Google Cloud Vision API (existing pipeline – reuse + tweak prompt)
- **Charts:** Recharts or Chart.js
- **File Upload:** Supabase Storage
- **WhatsApp:** Demo mode → generate ready-to-send message + `wa.me` link (real API later)
- **Price Data:** Pre-load official Jan Aushadhi CSV (daily downloadable)

---

## 4. Supabase (PostgreSQL) Schema

Since this is a hackathon, we will leverage **JSONB** columns for nested data to maintain speed and flexibility, avoiding overly complex relational joins.

**Tables:**
- `auth.users` (Managed by Supabase)
- `journeys` (Main table)

```sql
-- journeys table schema
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('draft', 'active')) DEFAULT 'draft',
  source TEXT CHECK (source IN ('image', 'manual')),
  raw_image_url TEXT,
  
  -- JSONB column to store extracted medicine list
  -- Format: [{ id, name, strength, frequency, durationDays, purpose }]
  extracted_data JSONB,
  
  -- JSONB column for price comparisons
  -- Format: [{ medicineName, brandedPrice, janAushadhiPrice, savings, buyLink }]
  price_comparison JSONB,
  
  -- JSONB column for the 30-day calendar
  -- Format: { startDate: timestamp, calendar: [{ date, status: 'taken'|'missed'|'pending', timestamp }] }
  adherence JSONB,
  
  -- JSONB column for whatsapp history
  -- Format: [{ date, message, sent, userRepliedDone, replyTimestamp }]
  whatsapp_reminders JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```