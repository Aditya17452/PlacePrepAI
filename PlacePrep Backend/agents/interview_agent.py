import json, asyncio
from groq import AsyncGroq
from services.rag_service import retrieve_jd_context
from services.session_service import SessionManager
from core.config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

WARMUP_QUESTIONS = [
    "Tell me about yourself — your background, skills, and what drew you to this field.",
    "Walk me through your most significant project — what did you build, what was your role, and what was the biggest challenge?"
]

CLOSING_QUESTIONS = [
    "What is one technical decision you made in a project that you would do differently now, and why?",
    "Where do you see yourself growing technically in the next two years, and what steps are you taking toward that?"
]

FILLERS = ["um", "uh", "like", "you know", "basically", "literally", "so"]

MAX_QUESTIONS = 12


class InterviewAgent:

    def __init__(self, session_id: str, student: dict, jd: dict):
        self.session_id = session_id
        self.student = student
        self.jd = jd
        self.session = SessionManager(session_id)
        self.session.init(
            student_name=student["name"],
            jd_id=str(jd["id"]),
            jd_role=jd["role_title"]
        )

    async def get_opening_question(self) -> str:
        return WARMUP_QUESTIONS[0]

    async def get_next_question(self, student_answer: str) -> dict:
        state = self.session.get_state()
        q_count = state.get("questions_asked", 0)
        elapsed = self.session.elapsed_minutes()

        memory = self.session.get_memory()
        last_q = memory[-1]["q"] if memory else WARMUP_QUESTIONS[0]
        self.session.add_exchange(last_q, student_answer)

        # END CHECK
        if q_count >= MAX_QUESTIONS or elapsed >= getattr(settings, "HARD_CUTOFF_MIN", 25):
            print(f"✅ Session ending: q_count={q_count}, elapsed={elapsed:.1f}min")
            return {
                "question": None,
                "phase": "complete",
                "questions_asked": q_count,
                "session_complete": True,
                "feedback": None
            }

        new_count = self.session.increment_question()

        if new_count <= len(WARMUP_QUESTIONS):
            question = WARMUP_QUESTIONS[new_count - 1]
            phase = "warmup"
        elif new_count == MAX_QUESTIONS - 1:
            question = CLOSING_QUESTIONS[0]
            phase = "closing"
        elif new_count >= MAX_QUESTIONS:
            question = CLOSING_QUESTIONS[1]
            phase = "closing"
        else:
            question = await self._technical_question(student_answer, elapsed, new_count)
            phase = "technical"

        feedback = None
        if new_count % getattr(settings, "FEEDBACK_EVERY_N", 3) == 0:
            feedback = await self._live_feedback(student_answer)

        print(f"📝 Q{new_count}/{MAX_QUESTIONS} | phase={phase} | elapsed={elapsed:.1f}min")

        return {
            "question": question,
            "phase": phase,
            "questions_asked": new_count,
            "session_complete": False,
            "feedback": feedback
        }

    async def _technical_question(self, answer: str, elapsed: float, q_num: int) -> str:
        if not answer or answer.strip() in ["", "(no answer recorded)"]:
            answer = "The candidate gave a verbal answer that was not captured clearly."

        jd_context = await retrieve_jd_context(answer, str(self.jd["id"]))
        history = self.session.memory_as_text()
        skills = self.student.get("skills", [])
        skills_str = ", ".join(skills[:5]) if skills else "programming"
        remaining = MAX_QUESTIONS - q_num

        prompt = f"""You are a senior technical interviewer conducting a real placement interview.

ROLE: {self.jd['role_title']}

CANDIDATE:
- Name: {self.student['name']}
- Branch: {self.student.get('branch', 'CS')}, CGPA: {self.student.get('cgpa', 'N/A')}
- Skills: {skills_str}

ROLE REQUIREMENTS:
{jd_context}

CONVERSATION SO FAR:
{history}

STATE: Question {q_num}/{MAX_QUESTIONS} | {remaining} remaining | {elapsed:.0f} min elapsed

ROLE-SPECIFIC TOPICS:
- Frontend/JS: closures, promises, React hooks, virtual DOM, CSS, state management
- ML Engineer: bias-variance, cross-validation, gradient descent, regularization, CNN, deployment
- AI/GenAI: RAG pipeline, embeddings, prompt chaining, LLM temperature, fine-tuning
- Data Engineer: window functions, ETL vs ELT, Spark, DAG design, data modeling
- Data Scientist: p-value, overfitting, A/B testing, confusion matrix, feature importance
- Data Analyst: SQL GROUP BY vs HAVING, pivot tables, KPI definition, cohort analysis
- AIML: neural networks, deep learning, model optimization, feature engineering

RULES:
- NEVER repeat any question already in conversation history
- NEVER ask generic questions like "tell me about yourself" again
- ALWAYS build on what the candidate just said
- ONE question only, max 2 sentences
- NO compliments, NO "Great answer!"
- Sound like a real senior engineer

Output ONLY the question. Nothing else."""

        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f"Candidate said: \"{answer[:300]}\"\n\nNext question:"}
                    ],
                    max_tokens=120,
                    temperature=0.85,
                    timeout=20
                )
                question = response.choices[0].message.content.strip().strip('"')
                print(f"✅ Groq Q{q_num}: {question[:80]}")
                return question
            except Exception as e:
                print(f"⚠️ Groq attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(2)

        fallbacks = [
            f"Can you explain how you used {skills[0] if skills else 'Python'} in a real project?",
            f"What is the most complex technical problem you solved related to {self.jd['role_title']}?",
            "Walk me through how you approach debugging a difficult issue in your code.",
            "How do you decide between two different technical approaches to a problem?",
            "Describe a time you had to learn a new technology quickly — what was your process?",
            f"What core concepts of {self.jd['role_title']} do you feel most confident about?",
            "If you had to optimize your best project for scale, what would you change first?",
        ]
        return fallbacks[q_num % len(fallbacks)]

    async def _live_feedback(self, answer: str) -> dict:
        vision = self.session.vision_summary()
        filler_count = sum(answer.lower().count(f) for f in FILLERS)

        prompt = """You are a supportive interview coach giving quick live feedback.
Be encouraging but specific. Maximum 2 sentences.
Return ONLY valid JSON (no markdown, no backticks):
{"tip": "your coaching tip here", "tone": "positive"}
tone must be exactly one of: positive, neutral, needs_work"""

        user_msg = f"""Answer: "{answer[:300]}"
Stats: {filler_count} filler words. Eye contact: {vision['avg_eye_contact']}%, Posture: {vision['avg_posture']}%.
Give one specific actionable tip."""

        for attempt in range(2):
            try:
                resp = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_msg}
                    ],
                    max_tokens=100,
                    temperature=0.5,
                    timeout=10
                )
                raw = resp.choices[0].message.content.strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(raw)
            except Exception as e:
                print(f"⚠️ Feedback attempt {attempt + 1} failed: {e}")
                if attempt < 1:
                    await asyncio.sleep(1)

        return {"tip": "Keep giving specific examples with results!", "tone": "positive"}

    async def evaluate_session(self, session_id: str) -> dict:
        from models.database import SessionLocal, SessionTranscript, JobDescription

        db = SessionLocal()
        try:
            rows = db.query(SessionTranscript).filter(
                SessionTranscript.session_id == session_id
            ).order_by(SessionTranscript.turn_number).all()

            # ── Too few answers — don't fake scores ──────────────────────
            if len(rows) < 3:
                print(f"⚠️ Only {len(rows)} answers recorded — returning incomplete scores")
                return self._incomplete_scores(len(rows))

            transcript_text = "\n".join(
                f"Q{r.turn_number}: {r.question}\nA{r.turn_number}: {r.answer}"
                for r in rows
            )

            jd = db.query(JobDescription).filter(
                JobDescription.id == self.jd["id"]
            ).first()
            jd_text = jd.jd_text if jd else "No JD available"
            vision = self.session.vision_summary()

        finally:
            db.close()

        prompt = """You are a senior technical interviewer evaluating a mock interview.
Evaluate honestly — shallow or short answers should score 20-40, not 65.
A candidate who gave very few answers or one-word replies scores below 30.
Return ONLY valid JSON. No markdown. No backticks.

Required format:
{
  "technical_score": 0-100,
  "communication_score": 0-100,
  "body_language_score": 0-100,
  "overall_score": 0-100,
  "verdict": "Good",
  "topics": [
    {"name": "Topic Name", "score": 0-100, "feedback": "one specific sentence"}
  ],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["area 1", "area 2", "area 3"],
  "tips": ["tip 1", "tip 2", "tip 3"]
}
verdict must be exactly one of: Excellent, Good, Needs Work, Poor
Provide 3-5 topics, 3 strengths, 3 improvements, 3 tips."""

        user_msg = f"""Role: {self.jd['role_title']}

JD Requirements:
{jd_text[:600]}

Interview Transcript ({len(rows)} of 12 questions answered):
{transcript_text[:3000]}

Physical: Eye contact {vision['avg_eye_contact']}%, Posture {vision['avg_posture']}%.

IMPORTANT: Only {len(rows)} questions were answered out of 12.
Score strictly and honestly based on the actual content of answers given.
Do NOT give default 65 scores — evaluate what was actually said."""

        for attempt in range(3):
            try:
                resp = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_msg}
                    ],
                    max_tokens=900,
                    temperature=0.3,
                    timeout=35
                )
                raw = resp.choices[0].message.content.strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                result = json.loads(raw)
                print(f"✅ Evaluation: overall={result.get('overall_score')}, verdict={result.get('verdict')}")
                return result
            except json.JSONDecodeError as e:
                print(f"⚠️ Eval JSON parse failed attempt {attempt + 1}: {e}")
                if attempt < 2:
                    await asyncio.sleep(3)
            except Exception as e:
                print(f"⚠️ Eval attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(3)

        print("❌ All evaluation attempts failed")
        return self._incomplete_scores(len(rows) if 'rows' in dir() else 0)

    def _incomplete_scores(self, answers_given: int = 0) -> dict:
        """Honest scores when interview was too short or ended early."""
        if answers_given == 0:
            return {
                "technical_score": 0,
                "communication_score": 0,
                "body_language_score": 0,
                "overall_score": 0,
                "verdict": "Poor",
                "topics": [
                    {"name": "Interview Incomplete", "score": 0,
                     "feedback": "No answers were recorded in this session"}
                ],
                "strengths": [
                    "You started the interview process"
                ],
                "improvements": [
                    "Complete the full 12-question interview",
                    "Do not end the interview within seconds of starting",
                    "Prepare at least 20 minutes of uninterrupted time"
                ],
                "tips": [
                    "Start a new interview and answer all 12 questions",
                    "Prepare your answers before clicking Start Interview",
                    "Allow yourself enough time — each session takes 15-20 minutes"
                ]
            }

        # Partial — scale honestly based on completion
        completion = answers_given / 12
        base = int(35 * completion)  # max 35 for partial
        verdict = "Poor" if base < 20 else "Needs Work"

        return {
            "technical_score": base,
            "communication_score": base,
            "body_language_score": base + 10,
            "overall_score": base,
            "verdict": verdict,
            "topics": [
                {"name": "Interview Incomplete", "score": base,
                 "feedback": f"Only {answers_given} of 12 questions were answered"}
            ],
            "strengths": [
                f"Answered {answers_given} out of 12 questions",
                "Started the interview session"
            ],
            "improvements": [
                "Complete all 12 questions for a meaningful evaluation",
                "Do not end the interview early",
                "Give detailed answers — not one-word replies"
            ],
            "tips": [
                f"You completed {answers_given}/12 questions — aim for the full session next time",
                "Allow 20 minutes of uninterrupted time before starting",
                "Practice answering questions out loud before your real interview"
            ]
        }

    def _default_scores(self) -> dict:
        """Kept for compatibility — now delegates to _incomplete_scores."""
        return self._incomplete_scores(0)

    async def match_resume_to_jds(self, resume_text: str, jds: list) -> list:
        jd_list = "\n\n".join(
            f"JD {i+1} (id: {jd['id']}):\nRole: {jd['role_title']}\nRequirements: {jd['jd_text'][:400]}"
            for i, jd in enumerate(jds)
        )

        prompt = """You are a strict placement advisor matching a student resume to job roles.
Only give high scores (80-95%) if skills genuinely match.
A generic document scores 10-30%. A strong match scores 80-95%.
Return ONLY valid JSON. No markdown. No backticks.

Format:
{
  "ranked": [
    {
      "jd_id": "uuid-here",
      "rank": 1,
      "match_pct": 0-100,
      "matching_skills": ["skill1", "skill2"],
      "missing_skills": ["skill1"],
      "advice": "one sentence advice"
    }
  ]
}"""

        user_msg = f"""Student Resume:
{resume_text[:1500]}

Available Roles:
{jd_list}

Rank ALL {len(jds)} roles by genuine match. Be strict. Include all JD IDs."""

        for attempt in range(3):
            try:
                resp = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[{"role": "system", "content": prompt},
                               {"role": "user", "content": user_msg}],
                    max_tokens=800, temperature=0.2, timeout=25
                )
                raw = resp.choices[0].message.content.strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                result = json.loads(raw)
                return result.get("ranked", [])
            except Exception as e:
                print(f"⚠️ Resume match attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(2)

        return [{"jd_id": str(jd["id"]), "rank": i+1, "match_pct": 40,
                 "matching_skills": [], "missing_skills": [],
                 "advice": "Default match"} for i, jd in enumerate(jds)]

    async def generate_shortlist(self, jd: dict, students: list) -> list:
        student_list = "\n".join(
            f"- ID:{s['id']} Name:{s['name']} CGPA:{s['cgpa']} "
            f"Technical:{s.get('technical_score', 0)} "
            f"Communication:{s.get('communication_score', 0)}"
            for s in students
        )
        prompt = """Rank candidates for shortlisting.
Return ONLY valid JSON:
{"ranked": [{"student_id": "uuid", "rank": 1, "match_score": 0-100, "reasoning": "one sentence"}]}"""

        for attempt in range(2):
            try:
                resp = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f"Role: {jd['role_title']}\n\nCandidates:\n{student_list}"}
                    ],
                    max_tokens=600, temperature=0.3, timeout=20
                )
                raw = resp.choices[0].message.content.strip()
                raw = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(raw).get("ranked", [])
            except Exception as e:
                print(f"⚠️ Shortlist attempt {attempt + 1} failed: {e}")
                if attempt < 1:
                    await asyncio.sleep(2)
        return []

    def check_posture_warning(self, posture_score: int) -> str | None:
        if posture_score < settings.POSTURE_WARNING_THRESHOLD:
            if self.session.can_warn_posture():
                self.session.mark_warned()
                return "Try to sit up straight and maintain eye contact 😊"
        return None

    def _should_end(self, q_count: int, elapsed: float) -> bool:
        if elapsed >= getattr(settings, "HARD_CUTOFF_MIN", 25):
            return True
        if q_count >= MAX_QUESTIONS:
            return True
        return False