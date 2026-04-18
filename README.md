# 💊 MedCare Agent

> **Turn any prescription into a 30-day personal health journey.**

MedCare is an autonomous prescription journey companion built for elderly patients and caregivers in India. Upload a handwritten prescription or discharge summary, let AI extract your medicines, compare prices, and activate a 30-day adherence agent with daily reminders.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📸 **Prescription OCR** | Upload any handwritten or printed prescription image — Gemini AI extracts medicine name, frequency, and duration |
| 💰 **Price Comparison** | Real-time PharmEasy search with MRP vs. sale price and direct buy links |
| 📅 **30-Day Journey** | Activate the MedCare Agent to start a persistent adherence tracking journey |
| 🔔 **Smart Reminders** | Browser push notifications at 8 AM / 1 PM / 8 PM with ✅ Taken / ❌ Not Taken actions |
| 📊 **Live Dashboard** | Today's schedule, weekly adherence bar chart, radial overview, and per-medicine course progress |
| 🤖 **AI Chatbot** | Context-aware medical assistant pre-loaded with your prescription and adherence history |
| 🌐 **Hindi Support** | Designed for elderly users and caregivers in India |

---

## 🗂️ Project Structure

```
medCare/
├── public/
│   └── sw.js                  # Service Worker — dose-time push notifications
├── src/
│   ├── components/
│   │   ├── FloatingElements.jsx
│   │   ├── Hero.jsx
│   │   ├── Navbar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── hooks/
│   │   └── useReminders.js    # Reminder scheduling + Supabase dose_logs sync
│   ├── lib/
│   │   └── supabase.js        # Supabase client
│   └── pages/
│       ├── AgentDashboard.jsx # Main user home (schedule, countdown, adherence)
│       ├── Chatbot.jsx        # AI medical assistant
│       ├── Landing.jsx        # Public landing page
│       ├── Login.jsx          # Auth — sign in
│       ├── Signup.jsx         # Auth — sign up
│       └── Upload.jsx         # Prescription upload + results + activation
├── backend/
│   ├── main.py                # FastAPI — OCR, price search, AI chat endpoints
│   ├── ocr_service.py         # Gemini 2.5 Flash OCR pipeline
│   └── requirements.txt
├── design.md                  # MedCare design system & component guidelines
├── reference.md               # Project reference for AI agents
└── .env                       # Environment variables (never commit)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com) project
- A Google Gemini API key
- A Groq API key (for the chatbot)

### 1. Clone & Install Frontend

```bash
git clone https://github.com/your-username/medCare.git
cd medCare
npm install
```

### 2. Install Backend

```bash
cd backend
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OCR_API_URL=http://localhost:8000
```

Create a `.env` file inside `backend/`:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### 4. Supabase Database Setup

Run the following SQL in your **Supabase SQL Editor**:

```sql
-- Journeys table
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('draft', 'active')) DEFAULT 'draft',
  source TEXT CHECK (source IN ('image', 'manual')),
  raw_image_url TEXT,
  extracted_data JSONB,
  price_comparison JSONB,
  adherence JSONB,
  whatsapp_reminders JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Dose logs table (for reminder feedback)
CREATE TABLE dose_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  slot TEXT CHECK (slot IN ('morning', 'afternoon', 'evening')) NOT NULL,
  log_date DATE NOT NULL,
  status TEXT CHECK (status IN ('taken', 'not_taken', 'pending')) DEFAULT 'pending',
  notified_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, medicine_name, slot, log_date)
);

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own journeys" ON journeys FOR ALL USING (auth.uid() = user_id);

ALTER TABLE dose_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own logs" ON dose_logs FOR ALL USING (auth.uid() = user_id);
```

### 5. Run the App

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload
# Runs on http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd medCare
npm run dev
# Runs on http://localhost:5173
```

---

## 🔔 Reminder System

The reminder system uses the **free Web Push Notifications API** — no third-party service or cost required.

1. Open the dashboard → click **"🔔 Enable Reminders"** → grant browser permission.
2. A green **"Reminders Active"** badge appears next to the Next Dose timer.
3. At **8:00 AM**, **1:00 PM**, and **8:00 PM** a native browser notification fires with your medicine list.
4. Tap **✅ Taken** → green checkmark on the schedule card, stored in Supabase.
5. Tap **❌ Not Taken** or dismiss → after 10 minutes a **"Missed Dose Alert"** fires and the card shows a red **"Missed"** badge.
6. Works even when the browser tab is in the background.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| OCR / AI | Google Gemini 2.5 Flash |
| Chatbot LLM | Groq (LLaMA 3.3 70B) |
| Price Data | PharmEasy API |
| Reminders | Web Push / Service Worker (free) |
| Charts | Recharts |

---

## 📄 License

MIT — built for HackSurgeX Open Innovation Track.
