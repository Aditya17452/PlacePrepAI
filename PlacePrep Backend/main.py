from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.interviews import router as interview_router
from api.resume import router as resume_router
from api.auth import router as auth_router
from models.database import create_tables
from core.config import settings
from api.credits import router as credits_router

app = FastAPI(title="PlacePrep AI", version="1.0.0")
app.include_router(credits_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    create_tables()
    print("✅ All SQLite tables created")
    print("✅ PlacePrep AI Backend Running")

app.include_router(auth_router)
app.include_router(interview_router)
app.include_router(resume_router)

try:
    from api.officer import router as officer_router
    app.include_router(officer_router)
    print("✅ Officer router loaded")
except Exception as e:
    print(f"⚠️ Officer router not loaded: {e}")

@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.GROQ_MODEL}

@app.get("/")
async def root():
    return {"status": "PlacePrep AI running"}