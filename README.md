# PlacePrepAI 🎯

> AI-powered mock interview platform for college students preparing for campus placements.

![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)
![Stack](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python-green)
![Stack](https://img.shields.io/badge/AI-Groq%20llama3--70b-orange)
![Stack](https://img.shields.io/badge/DB-SQLite-lightgrey)

---

## What it does

Students upload their resume, get matched to job roles by AI, and practice with a 12-question mock interview. The AI evaluates their performance and generates a detailed PDF report with scores, strengths, and actionable tips.

---

## Features

- 📄 **Resume Matching** — AI matches resume to 6 job roles with skill gap analysis
- 🎤 **Voice + Text Input** — Answer by typing or speaking
- 🤖 **AI Interviewer** — 12-question adaptive interview with female voice
- 📊 **Score Report** — Technical, Communication, Body Language scores + PDF download
- 👁 **Attention Tracking** — Webcam face detection + tab switch monitoring with warnings
- 💬 **AI Chatbot** — n8n + Pinecone RAG chatbot for platform help
- 🎓 **Officer Panel** — Manage student credits and view shortlists

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Python, WebSockets, SQLAlchemy |
| AI | Groq API (llama3-70b-8192) |
| Database | SQLite |
| Voice | Browser Web Speech API |
| Chatbot | n8n + Pinecone RAG |
| PDF | ReportLab |

---

## Project Structure

```
PlacePrepAI/
├── backend/
│   ├── agents/          # Interview, evaluation, resume matching agents
│   ├── api/             # FastAPI route handlers
│   ├── core/            # Config and settings
│   ├── models/          # SQLAlchemy DB models
│   ├── scripts/         # Seed data script
│   ├── services/        # RAG, session manager
│   ├── main.py          # App entry point
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/  # Navbar, ChatBot, UI components
    │   ├── pages/       # Dashboard, Interview, Report, Officer
    │   └── services/    # API client
    ├── index.html
    └── package.json
```

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
cp .env.example .env         # Add your GROQ_API_KEY
python scripts/seed_data.py
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env         # Add API URLs
npm run dev
```

Open `http://localhost:5173`

---

## Environment Variables

### Backend `.env`
```
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_secret_key
DATABASE_URL=sqlite:///./placeprep.db
```

### Frontend `.env`
```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_CHATBOT_WEBHOOK_URL=your_n8n_webhook_url
```

---

## Test Credentials

| Role | Email | Password |
|---|---|---|
| Student | john@test.com | password123 |
| Officer | officer@placeprep.com | admin123 |

---

## Available Job Roles

| Role | Min CGPA |
|---|---|
| Machine Learning Engineer | 7.0 |
| AI / GenAI Engineer | 7.5 |
| Data Scientist | 6.5 |
| Data Analyst | 6.0 |
| Frontend Developer | 6.5 |
| Data Engineer | 7.0 |

---

## License

MIT — free to use and modify.

---

> Built for college placement cells. Powered by Groq.
