import json, base64, asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from agents.interview_agent import InterviewAgent
from services.whisper_service import transcribe_complete
from services.session_service import SessionManager
from models.database import (
    get_db, InterviewSession, SessionTranscript,
    SessionScore, Student, JobDescription, SessionLocal
)
from core.config import settings

router = APIRouter()
active_agents: dict[str, InterviewAgent] = {}


@router.post("/api/interviews/start")
async def start_interview(body: dict, db: Session = Depends(get_db)):
    student_id = body.get("student_id")
    jd_id = body.get("jd_id")

    student = db.query(Student).filter(Student.id == student_id).first()
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()

    if not student or not jd:
        student = db.query(Student).first()
        jd = db.query(JobDescription).first()
        if not student or not jd:
            raise HTTPException(status_code=404, detail="No student or JD found")

    session = InterviewSession(student_id=student.id, jd_id=jd.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    session_id = str(session.id)

    agent = InterviewAgent(
        session_id=session_id,
        student={
            "name": student.name,
            "branch": student.branch,
            "cgpa": student.cgpa,
            "skills": student.skills or []
        },
        jd={
            "id": jd.id,
            "company_name": jd.company_name,
            "role_title": jd.role_title,
            "jd_text": jd.jd_text
        }
    )
    active_agents[session_id] = agent
    opening = await agent.get_opening_question()

    return {
        "sessionId": session_id,
        "openingQuestion": opening,
        "company": jd.company_name,
        "role": jd.role_title,
        "maxQuestions": settings.MAX_QUESTIONS,
        "maxMinutes": settings.MAX_MINUTES
    }


@router.websocket("/ws/interview/{session_id}")
async def interview_ws(
    websocket: WebSocket,
    session_id: str,
    db: Session = Depends(get_db)
):
    await websocket.accept()
    print(f"✅ WebSocket connected: {session_id}")

    agent = active_agents.get(session_id)
    if not agent:
        await websocket.send_json({"type": "error", "message": "Session not found."})
        await websocket.close()
        return

    session_mgr = SessionManager(session_id)
    turn_number = 0
    last_question = openingQ = "Tell me about yourself — your background, skills, and what drew you to this field."

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ── turn_complete ─────────────────────────────────────────────
            if msg_type == "turn_complete":
                turn_number += 1
                full_answer = "(no answer recorded)"

                # Priority 1: direct transcript from browser SpeechRecognition
                direct_transcript = (data.get("transcript") or "").strip()
                if direct_transcript:
                    full_answer = direct_transcript
                    print(f"✅ Direct transcript: '{full_answer[:100]}'")
                    await websocket.send_json({
                        "type": "transcript_update",
                        "text": full_answer
                    })

                # Priority 2: audio blob (WAV from Web Audio API)
                elif data.get("audio"):
                    try:
                        audio_bytes = base64.b64decode(data["audio"])
                        print(f"🎙 Transcribing audio: {len(audio_bytes)} bytes")
                        result = await asyncio.to_thread(transcribe_complete, audio_bytes)
                        transcribed = result.get("text", "").strip()
                        if transcribed:
                            full_answer = transcribed
                            print(f"✅ Audio transcript: '{full_answer[:100]}'")
                        else:
                            print("⚠️ Whisper returned empty text")
                        await websocket.send_json({
                            "type": "transcript_update",
                            "text": full_answer
                        })
                    except Exception as e:
                        print(f"❌ Transcription failed: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print("⚠️ No transcript or audio in turn_complete")

                print(f"📝 Turn {turn_number}: '{full_answer[:80]}'")

                # Get next question from agent
                try:
                    result = await agent.get_next_question(full_answer)
                except Exception as e:
                    print(f"❌ Agent error: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "next_question",
                        "question": "Can you tell me about a challenging technical problem you solved recently?",
                        "phase": "technical",
                        "questions_asked": turn_number,
                        "questions_remaining": settings.MAX_QUESTIONS - turn_number
                    })
                    continue

                # Save to DB
                try:
                    db.add(SessionTranscript(
                        session_id=session_id,
                        turn_number=turn_number,
                        phase=result["phase"],
                        question=last_question,
                        answer=full_answer
                    ))
                    db.query(InterviewSession).filter(
                        InterviewSession.id == session_id
                    ).update({"question_count": result["questions_asked"]})
                    db.commit()
                    print(f"💾 Saved turn {turn_number} to DB")
                except Exception as e:
                    print(f"❌ DB error: {e}")

                if result["session_complete"]:
                    await websocket.send_json({
                        "type": "session_complete",
                        "message": "Interview complete! Generating your report..."
                    })
                    break

                last_question = result["question"]

                response = {
                    "type": "next_question",
                    "question": result["question"],
                    "phase": result["phase"],
                    "questions_asked": result["questions_asked"],
                    "questions_remaining": settings.MAX_QUESTIONS - result["questions_asked"]
                }
                if result.get("feedback"):
                    response["feedback"] = result["feedback"]

                await websocket.send_json(response)
                print(f"✅ Sent Q{result['questions_asked']}: {result['question'][:60]}")

            # ── vision_scores ─────────────────────────────────────────────
            elif msg_type == "vision_scores":
                scores = data.get("scores", {})
                session_mgr.add_vision(scores)
                warning = agent.check_posture_warning(scores.get("posture_score", 100))
                if warning:
                    await websocket.send_json({"type": "posture_warning", "message": warning})

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await _end_session(session_id, session_mgr, db, agent)


@router.post("/api/interviews/{session_id}/end")
async def end_interview(session_id: str, db: Session = Depends(get_db)):
    session_mgr = SessionManager(session_id)
    agent = active_agents.get(session_id)
    await _end_session(session_id, session_mgr, db, agent)
    return {"status": "ended"}


@router.get("/api/interviews/history/{student_id}")
async def get_history(student_id: str, db: Session = Depends(get_db)):
    sessions = db.query(InterviewSession).filter(
        InterviewSession.student_id == student_id,
        InterviewSession.status == "completed"
    ).all()
    result = []
    for s in sessions:
        score = db.query(SessionScore).filter(SessionScore.session_id == s.id).first()
        jd = db.query(JobDescription).filter(JobDescription.id == s.jd_id).first()
        result.append({
            "id": str(s.id),
            "company": jd.company_name if jd else "Unknown",
            "role": jd.role_title if jd else "Unknown",
            "date": s.started_at.strftime("%b %d, %Y") if s.started_at else "",
            "score": score.overall_score if score else 0,
            "status": "Completed"
        })
    return result


@router.get("/api/interviews/{session_id}/report")
async def get_report(session_id: str, db: Session = Depends(get_db)):
    score = db.query(SessionScore).filter(
        SessionScore.session_id == session_id
    ).first()
    if not score:
        return {"status": "processing"}
    if score.evaluation_status == "pending":
        return {"status": "processing"}
    if score.evaluation_status == "failed":
        return {"status": "failed"}
    return {
        "status": "complete",
        "overallScore": score.overall_score,
        "verdict": score.verdict,
        "categories": {
            "technicalAccuracy": score.technical_score,
            "communication": score.communication_score,
            "problemSolving": score.technical_score,
            "confidence": score.communication_score,
            "bodyLanguage": score.body_language_score,
        },
        "strengths": score.strengths_json or [],
        "improvements": score.improvements_json or [],
        "summary": f"Overall verdict: {score.verdict}",
        "tips": score.tips_json or [],
        "topics": score.topics_json or [],
        "questionBreakdown": []
    }


async def _end_session(session_id, session_mgr, db, agent=None):
    try:
        session = db.query(InterviewSession).filter(
            InterviewSession.id == session_id
        ).first()
        if not session or session.status != "active":
            return
        now = datetime.utcnow()
        vision = session_mgr.vision_summary()
        duration = int((now - session.started_at).total_seconds())
        db.query(InterviewSession).filter(
            InterviewSession.id == session_id
        ).update({"status": "completed", "ended_at": now, "duration_seconds": duration})
        db.add(SessionScore(
            session_id=session_id,
            avg_eye_contact_pct=vision["avg_eye_contact"],
            avg_posture_score=vision["avg_posture"],
            evaluation_status="pending"
        ))
        db.commit()
        print(f"✅ Session {session_id} ended")
        if agent:
            asyncio.create_task(_run_evaluation(session_id, agent))
        session_mgr.delete()
        active_agents.pop(session_id, None)
    except Exception as e:
        print(f"❌ End session error: {e}")


async def _run_evaluation(session_id: str, agent: InterviewAgent):
    try:
        db2 = SessionLocal()
        scores = await agent.evaluate_session(session_id)
        db2.query(SessionScore).filter(
            SessionScore.session_id == session_id
        ).update({
            "overall_score": scores.get("overall_score", 70),
            "technical_score": scores.get("technical_score", 70),
            "communication_score": scores.get("communication_score", 70),
            "body_language_score": scores.get("body_language_score", 70),
            "verdict": scores.get("verdict", "Good"),
            "topics_json": scores.get("topics", []),
            "strengths_json": scores.get("strengths", []),
            "improvements_json": scores.get("improvements", []),
            "tips_json": scores.get("tips", []),
            "evaluation_status": "complete",
            "evaluated_at": datetime.utcnow()
        })
        db2.commit()
        db2.close()
        print(f"✅ Evaluation complete for {session_id}")
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")
        try:
            db3 = SessionLocal()
            db3.query(SessionScore).filter(
                SessionScore.session_id == session_id
            ).update({"evaluation_status": "failed"})
            db3.commit()
            db3.close()
        except Exception:
            pass