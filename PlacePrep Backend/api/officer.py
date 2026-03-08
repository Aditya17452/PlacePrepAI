from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, Student, InterviewSession, SessionScore, JobDescription
from agents.interview_agent import InterviewAgent
from core.config import settings

router = APIRouter()

@router.get("/students")
async def get_all_students(db: Session = Depends(get_db)):
    """Get all students with their latest session scores."""
    students = db.query(Student).all()
    result = []
    
    for student in students:
        # Get latest session for this student
        latest_session = db.query(InterviewSession).filter(
            InterviewSession.student_id == str(student.id)
        ).order_by(InterviewSession.created_at.desc()).first()
        
        # Get latest scores for this student
        latest_scores = db.query(SessionScore).filter(
            SessionScore.student_id == str(student.id)
        ).order_by(SessionScore.created_at.desc()).first()
        
        student_data = {
            "id": str(student.id),
            "name": student.name,
            "email": student.email,
            "branch": student.branch,
            "cgpa": student.cgpa,
            "skills": student.skills,
            "latest_session": {
                "id": str(latest_session.id) if latest_session else None,
                "company": latest_session.company if latest_session else None,
                "role": latest_session.role if latest_session else None,
                "created_at": latest_session.created_at.isoformat() if latest_session else None
            } if latest_session else None,
            "latest_scores": {
                "technical_score": latest_scores.technical_score if latest_scores else None,
                "communication_score": latest_scores.communication_score if latest_scores else None,
                "body_language_score": latest_scores.body_language_score if latest_scores else None,
                "overall_score": latest_scores.overall_score if latest_scores else None
            } if latest_scores else None
        }
        result.append(student_data)
    
    return {"students": result}

@router.post("/shortlist")
async def generate_shortlist(jd_id: str, db: Session = Depends(get_db)):
    """Generate AI shortlist for a specific JD."""
    # Get JD details
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
    
    # Get all students with their latest scores
    students = db.query(Student).all()
    student_list = []
    
    for student in students:
        latest_scores = db.query(SessionScore).filter(
            SessionScore.student_id == str(student.id)
        ).order_by(SessionScore.created_at.desc()).first()
        
        student_data = {
            "id": str(student.id),
            "name": student.name,
            "cgpa": student.cgpa,
            "technical_score": latest_scores.technical_score if latest_scores else 0,
            "communication_score": latest_scores.communication_score if latest_scores else 0,
            "skills": student.skills
        }
        student_list.append(student_data)
    
    # Use InterviewAgent to generate shortlist
    agent = InterviewAgent(session_id="shortlist_temp", student={}, jd={
        "id": jd.id,
        "company_name": jd.company_name,
        "role_title": jd.role_title,
        "jd_text": jd.jd_text
    })
    
    ranked_candidates = await agent.generate_shortlist({
        "id": jd.id,
        "company_name": jd.company_name,
        "role_title": jd.role_title,
        "jd_text": jd.jd_text
    }, student_list)
    
    # Format response
    result = []
    for candidate in ranked_candidates:
        student = next((s for s in student_list if s["id"] == candidate["student_id"]), None)
        if student:
            result.append({
                "rank": candidate["rank"],
                "student_id": candidate["student_id"],
                "name": student["name"],
                "match_score": candidate["match_score"],
                "cgpa": student["cgpa"],
                "reasoning": candidate["reasoning"],
                "technical_score": student["technical_score"],
                "communication_score": student["communication_score"]
            })
    
    return {"jd_id": jd_id, "company": jd.company_name, "role": jd.role_title, "candidates": result}