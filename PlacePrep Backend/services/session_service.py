import json
from datetime import datetime
from core.config import settings

# In-memory store — no Redis needed
_store: dict = {}
TTL_SESSIONS: dict = {}


class SessionManager:
    def __init__(self, session_id: str):
        self.sid = session_id
        if session_id not in _store:
            _store[session_id] = {
                "state": {},
                "memory": [],
                "vision": [],
                "warned_at": None,
                "chunks": []
            }

    def _get(self) -> dict:
        return _store.get(self.sid, {
            "state": {}, "memory": [], "vision": [], "warned_at": None, "chunks": []
        })

    def init(self, student_name: str, jd_id: str, jd_role: str):
        state = {
            "student_name": student_name,
            "jd_id": jd_id,
            "jd_role": jd_role,
            "questions_asked": 0,
            "phase": "warmup",
            "started_at": datetime.utcnow().isoformat(),
            "topics_covered": [],
        }
        _store[self.sid]["state"] = state
        return state

    def get_state(self) -> dict:
        return _store.get(self.sid, {}).get("state", {})

    def update(self, updates: dict):
        if self.sid in _store:
            _store[self.sid]["state"].update(updates)

    def elapsed_minutes(self) -> float:
        s = self.get_state()
        if not s or "started_at" not in s:
            return 0.0
        started = datetime.fromisoformat(s["started_at"])
        return round((datetime.utcnow() - started).total_seconds() / 60, 1)

    def increment_question(self) -> int:
        s = self.get_state()
        current = s.get("questions_asked", 0) + 1
        phase = "warmup" if current <= 2 else ("closing" if current >= 11 else "technical")
        self.update({"questions_asked": current, "phase": phase})
        return current

    def add_chunk(self, text: str):
        if self.sid in _store:
            _store[self.sid]["chunks"].append(text)

    def get_full_answer(self) -> str:
        return " ".join(_store.get(self.sid, {}).get("chunks", []))

    def clear_chunks(self):
        if self.sid in _store:
            _store[self.sid]["chunks"] = []

    def add_exchange(self, question: str, answer: str):
        if self.sid not in _store:
            return
        memory = _store[self.sid]["memory"]
        memory.append({"q": question, "a": answer})
        # Keep last 8 exchanges
        _store[self.sid]["memory"] = memory[-8:]
        print(f"💾 Memory saved: Q={question[:50]} A={answer[:50]}")
        print(f"💾 Total exchanges: {len(_store[self.sid]['memory'])}")

    def get_memory(self) -> list:
        return _store.get(self.sid, {}).get("memory", [])

    def memory_as_text(self) -> str:
        memory = self.get_memory()
        if not memory:
            return "No previous exchanges yet."
        lines = []
        for i, e in enumerate(memory):
            lines.append(f"Q{i+1}: {e['q']}")
            lines.append(f"A{i+1}: {e['a']}")
        result = "\n".join(lines)
        print(f"📋 Memory text ({len(memory)} exchanges):\n{result[:200]}")
        return result

    def add_vision(self, scores: dict):
        if self.sid in _store:
            _store[self.sid]["vision"].append(scores)

    def vision_summary(self) -> dict:
        scores = _store.get(self.sid, {}).get("vision", [])
        if not scores:
            return {"avg_eye_contact": 75, "avg_posture": 80, "attention_pct": 90}
        return {
            "avg_eye_contact": round(
                sum(s.get("eye_contact_score", 75) for s in scores) / len(scores), 1),
            "avg_posture": round(
                sum(s.get("posture_score", 80) for s in scores) / len(scores), 1),
            "attention_pct": round(
                sum(1 for s in scores if s.get("attention", True))
                / len(scores) * 100, 1)
        }

    def can_warn_posture(self) -> bool:
        warned_at = _store.get(self.sid, {}).get("warned_at")
        if not warned_at:
            return True
        elapsed = (datetime.utcnow() - datetime.fromisoformat(warned_at)).total_seconds()
        return elapsed > getattr(settings, "POSTURE_WARN_COOLDOWN_SEC", 120)

    def mark_warned(self):
        if self.sid in _store:
            _store[self.sid]["warned_at"] = datetime.utcnow().isoformat()

    def delete(self):
        _store.pop(self.sid, None)
        print(f"🗑️ Session {self.sid} deleted from memory")