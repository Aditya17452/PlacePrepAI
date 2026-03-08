from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, Student
import jwt, hashlib
from datetime import datetime, timedelta
from core.config import settings

router = APIRouter()


def make_token(student_id: str, role: str) -> str:
    payload = {
        "sub": student_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.post("/api/auth/register")
async def register(body: dict, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.email == body["email"]).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    student = Student(
        name=body["name"],
        email=body["email"],
        role=body.get("role", "student"),
        cgpa=body.get("cgpa", 7.0),
        branch=body.get("branch", "Computer Science"),
        password_hash=hash_password(body["password"])
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    token = make_token(str(student.id), student.role)
    return {
        "token": token,
        "role": student.role,
        "name": student.name,
        "id": str(student.id)
    }


@router.post("/api/auth/login")
async def login(body: dict, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.email == body["email"]).first()
    if not student:
        raise HTTPException(401, "Invalid email or password")
    if student.password_hash != hash_password(body["password"]):
        raise HTTPException(401, "Invalid email or password")

    token = make_token(str(student.id), student.role)
    return {
        "token": token,
        "role": student.role,
        "name": student.name,
        "id": str(student.id)
    }


@router.get("/api/auth/me")
async def get_me(db: Session = Depends(get_db),
                 token: str = Depends(lambda: None)):
    # Simplified for dev — in production add proper JWT middleware
    return {"message": "Auth endpoint working"}