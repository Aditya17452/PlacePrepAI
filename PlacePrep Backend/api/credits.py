from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from models.database import get_db, Student
import uuid
from datetime import datetime

router = APIRouter()


def _ensure_credits_table(db: Session):
    """Create table if not exists and seed any missing student rows."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS student_credits (
            id TEXT PRIMARY KEY,
            student_id TEXT UNIQUE NOT NULL,
            credits INTEGER DEFAULT 3,
            total_used INTEGER DEFAULT 0,
            updated_at TEXT
        )
    """))
    db.commit()

    # Seed any students who don't have a credits row yet
    students = db.execute(text("SELECT id FROM students")).fetchall()
    for row in students:
        sid = row[0]
        exists = db.execute(
            text("SELECT id FROM student_credits WHERE student_id = :sid"),
            {"sid": sid}
        ).fetchone()
        if not exists:
            db.execute(
                text("INSERT INTO student_credits (id, student_id, credits, total_used, updated_at) VALUES (:id, :sid, 3, 0, :ts)"),
                {"id": str(uuid.uuid4()), "sid": sid, "ts": datetime.utcnow().isoformat()}
            )
    db.commit()


@router.get("/api/credits/{student_id}")
def get_credits(student_id: str, db: Session = Depends(get_db)):
    try:
        _ensure_credits_table(db)
        row = db.execute(
            text("SELECT credits, total_used FROM student_credits WHERE student_id = :sid"),
            {"sid": student_id}
        ).fetchone()
        if not row:
            # Auto-create with 3 credits
            db.execute(
                text("INSERT INTO student_credits (id, student_id, credits, total_used, updated_at) VALUES (:id, :sid, 3, 0, :ts)"),
                {"id": str(uuid.uuid4()), "sid": student_id, "ts": datetime.utcnow().isoformat()}
            )
            db.commit()
            return {"credits": 3, "total_used": 0}
        return {"credits": row[0], "total_used": row[1]}
    except Exception as e:
        print(f"get_credits error: {e}")
        return {"credits": 3, "total_used": 0}


@router.post("/api/credits/{student_id}/use")
def use_credit(student_id: str, db: Session = Depends(get_db)):
    try:
        _ensure_credits_table(db)
        row = db.execute(
            text("SELECT credits, total_used FROM student_credits WHERE student_id = :sid"),
            {"sid": student_id}
        ).fetchone()

        if not row:
            # Auto-create and immediately use 1
            db.execute(
                text("INSERT INTO student_credits (id, student_id, credits, total_used, updated_at) VALUES (:id, :sid, 2, 1, :ts)"),
                {"id": str(uuid.uuid4()), "sid": student_id, "ts": datetime.utcnow().isoformat()}
            )
            db.commit()
            print(f"✅ Created credits for {student_id[:8]}..., used 1, 2 remaining")
            return {"credits": 2, "total_used": 1, "success": True}

        credits, used = row[0], row[1]

        if credits <= 0:
            raise HTTPException(
                status_code=403,
                detail="No credits remaining. Contact your placement officer."
            )

        db.execute(
            text("UPDATE student_credits SET credits = :c, total_used = :u, updated_at = :ts WHERE student_id = :sid"),
            {"c": credits - 1, "u": used + 1, "ts": datetime.utcnow().isoformat(), "sid": student_id}
        )
        db.commit()
        print(f"✅ Credit used for {student_id[:8]}..., {credits - 1} remaining")
        return {"credits": credits - 1, "total_used": used + 1, "success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ use_credit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/officer/credits")
def list_all_credits(db: Session = Depends(get_db)):
    """Officer view — all students with their credit counts."""
    try:
        _ensure_credits_table(db)
        rows = db.execute(text("""
            SELECT s.id, s.name, s.email,
                   COALESCE(c.credits, 3),
                   COALESCE(c.total_used, 0)
            FROM students s
            LEFT JOIN student_credits c ON s.id = c.student_id
            ORDER BY s.name
        """)).fetchall()
        return [
            {
                "student_id": r[0],
                "name": r[1],
                "email": r[2],
                "credits": r[3],
                "total_used": r[4]
            }
            for r in rows
        ]
    except Exception as e:
        print(f"list_all_credits error: {e}")
        return []


@router.post("/api/officer/credits/{student_id}/add")
def add_credits(student_id: str, body: dict, db: Session = Depends(get_db)):
    """Officer adds N credits to a student."""
    try:
        _ensure_credits_table(db)
        amount = int(body.get("amount", 1))
        if amount < 1 or amount > 20:
            raise HTTPException(status_code=400, detail="Amount must be 1–20")

        row = db.execute(
            text("SELECT credits FROM student_credits WHERE student_id = :sid"),
            {"sid": student_id}
        ).fetchone()

        if not row:
            db.execute(
                text("INSERT INTO student_credits (id, student_id, credits, total_used, updated_at) VALUES (:id, :sid, :c, 0, :ts)"),
                {"id": str(uuid.uuid4()), "sid": student_id, "c": amount, "ts": datetime.utcnow().isoformat()}
            )
            new_credits = amount
        else:
            new_credits = row[0] + amount
            db.execute(
                text("UPDATE student_credits SET credits = :c, updated_at = :ts WHERE student_id = :sid"),
                {"c": new_credits, "ts": datetime.utcnow().isoformat(), "sid": student_id}
            )
        db.commit()
        print(f"✅ Added {amount} credits to {student_id[:8]}..., now {new_credits}")
        return {"success": True, "new_credits": new_credits}

    except HTTPException:
        raise
    except Exception as e:
        print(f"add_credits error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/officer/credits/{student_id}/reset")
def reset_credits(student_id: str, body: dict, db: Session = Depends(get_db)):
    """Officer resets student credits to a specific value."""
    try:
        _ensure_credits_table(db)
        amount = int(body.get("credits", 3))
        if amount < 0 or amount > 50:
            raise HTTPException(status_code=400, detail="Credits must be 0–50")

        row = db.execute(
            text("SELECT id FROM student_credits WHERE student_id = :sid"),
            {"sid": student_id}
        ).fetchone()

        if not row:
            db.execute(
                text("INSERT INTO student_credits (id, student_id, credits, total_used, updated_at) VALUES (:id, :sid, :c, 0, :ts)"),
                {"id": str(uuid.uuid4()), "sid": student_id, "c": amount, "ts": datetime.utcnow().isoformat()}
            )
        else:
            db.execute(
                text("UPDATE student_credits SET credits = :c, updated_at = :ts WHERE student_id = :sid"),
                {"c": amount, "ts": datetime.utcnow().isoformat(), "sid": student_id}
            )
        db.commit()
        print(f"✅ Reset credits for {student_id[:8]}... to {amount}")
        return {"success": True, "credits": amount}

    except HTTPException:
        raise
    except Exception as e:
        print(f"reset_credits error: {e}")
        raise HTTPException(status_code=500, detail=str(e))