from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from models.database import get_db, Student, JobDescription
import io, json, asyncio

router = APIRouter()


@router.post("/api/resume/upload")
async def upload_resume(
    resume: UploadFile = File(...),
    student_id: str = Query(default=None),
    db: Session = Depends(get_db)
):
    content = await resume.read()
    resume_text = _extract_text(content)

    if not resume_text or len(resume_text.strip()) < 50 or resume_text == "Could not extract resume text":
        return {
            "status": "error",
            "message": "Could not read resume. Please upload a proper PDF.",
            "suggestions": []
        }

    # Save resume text to student record
    if student_id:
        try:
            db.query(Student).filter(Student.id == student_id).update({
                "resume_text": resume_text[:3000]
            })
            db.commit()
        except Exception as e:
            print(f"⚠️ Could not save resume text: {e}")

    # Get all active JDs
    jds = db.query(JobDescription).filter(JobDescription.is_active == True).all()
    if not jds:
        return {"status": "ready", "suggestions": [], "message": "No JDs available."}

    jd_list = [
        {
            "id": str(jd.id),
            "company_name": jd.company_name,
            "role_title": jd.role_title,
            "jd_text": jd.jd_text
        }
        for jd in jds
    ]

    # Match resume to JDs — with retry and timeout
    ranked = await _match_resume_with_retry(resume_text, jd_list)

    # If Groq failed entirely, use keyword-based fallback
    if not ranked:
        print("⚠️ Using keyword fallback for resume matching")
        ranked = _keyword_match(resume_text, jd_list)

    # Build suggestions — show ALL JDs (frontend handles ≥70% filter)
    suggestions = []
    for m in ranked:
        jd = next((j for j in jd_list if j["id"] == m.get("jd_id")), None)
        if not jd:
            continue
        match_pct = m.get("match_pct", 0)
        suggestions.append({
            "company": jd["company_name"],
            "role": jd["role_title"],
            "matchScore": match_pct,
            "status": (
                "Best Match" if match_pct >= 80
                else "Good Match" if match_pct >= 60
                else "Possible Match" if match_pct >= 40
                else "Low Match"
            ),
            "matchedSkills": m.get("matching_skills", []),
            "missingSkills": m.get("missing_skills", []),
            "reasoning": m.get("advice", ""),
            "jdId": jd["id"]
        })

    suggestions.sort(key=lambda x: x["matchScore"], reverse=True)
    print(f"✅ Returning {len(suggestions)} JD suggestions to frontend")
    return {"status": "ready", "suggestions": suggestions}


async def _match_resume_with_retry(resume_text: str, jd_list: list) -> list:
    """Call Groq to match resume — retry up to 3 times with 20s timeout each."""
    from groq import AsyncGroq
    from core.config import settings

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    jd_summary = "\n\n".join(
        f"JD_ID: {jd['id']}\nRole: {jd['role_title']}\nRequirements: {jd['jd_text'][:300]}"
        for jd in jd_list
    )

    system_prompt = """You are a strict resume-to-job matcher.
Analyze the resume carefully and match it to job descriptions based on ACTUAL skills present.

RULES:
- Only give high match % if the resume ACTUALLY has the required skills
- A random or non-tech resume should score 10-30%
- A CS/tech resume scores based on genuine skill overlap
- Be honest — don't give everyone 70%+

Return ONLY valid JSON, no markdown, no backticks:
{
  "ranked": [
    {
      "jd_id": "exact-uuid-here",
      "rank": 1,
      "match_pct": 85,
      "matching_skills": ["Python", "React"],
      "missing_skills": ["Docker", "AWS"],
      "advice": "Strong Python and ML skills match well with this role."
    }
  ]
}"""

    user_msg = f"""Analyze this resume and match to ALL {len(jd_list)} job descriptions:

RESUME TEXT:
{resume_text[:1500]}

JOB DESCRIPTIONS:
{jd_summary}

Return ALL {len(jd_list)} JDs in the ranked array. Use the exact JD_ID values shown above."""

    for attempt in range(3):
        try:
            print(f"🔄 Resume match attempt {attempt + 1}/3...")
            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_msg}
                    ],
                    max_tokens=800,
                    temperature=0.2,
                ),
                timeout=20.0  # 20 second hard timeout
            )
            raw = resp.choices[0].message.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            ranked = result.get("ranked", [])
            print(f"✅ Resume matched: {len(ranked)} JDs")
            for r in ranked:
                print(f"  {str(r.get('jd_id','?'))[:8]}... → {r.get('match_pct')}%")
            return ranked
        except asyncio.TimeoutError:
            print(f"⏱️ Resume match attempt {attempt + 1} timed out (20s)")
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse failed attempt {attempt + 1}: {e}")
        except Exception as e:
            print(f"❌ Resume match attempt {attempt + 1} error: {e}")

        if attempt < 2:
            await asyncio.sleep(2)

    print("❌ All Groq resume match attempts failed")
    return []


def _keyword_match(resume_text: str, jd_list: list) -> list:
    """
    Pure keyword-based fallback when Groq is unavailable.
    Counts how many required keywords from each JD appear in the resume.
    """
    resume_lower = resume_text.lower()

    # Common tech skill keywords to look for
    ALL_KEYWORDS = [
        "python", "java", "javascript", "typescript", "react", "node", "nodejs",
        "sql", "mysql", "postgresql", "mongodb", "redis",
        "machine learning", "ml", "deep learning", "neural", "tensorflow", "pytorch", "sklearn",
        "data analysis", "pandas", "numpy", "matplotlib", "tableau", "power bi",
        "docker", "kubernetes", "aws", "azure", "gcp", "cloud",
        "git", "github", "ci/cd", "devops",
        "html", "css", "frontend", "backend", "fullstack", "api", "rest",
        "nlp", "computer vision", "opencv", "transformers", "llm", "rag",
        "spark", "hadoop", "etl", "airflow", "kafka",
        "c++", "c#", "go", "rust", "kotlin", "swift",
        "linux", "bash", "shell",
        "agile", "scrum", "jira",
    ]

    # Find which keywords are in the resume
    resume_keywords = [kw for kw in ALL_KEYWORDS if kw in resume_lower]

    ranked = []
    for i, jd in enumerate(jd_list):
        jd_lower = (jd["role_title"] + " " + jd["jd_text"]).lower()

        # Find keywords required by this JD
        jd_keywords = [kw for kw in ALL_KEYWORDS if kw in jd_lower]

        if not jd_keywords:
            match_pct = 30
            matching = []
            missing = []
        else:
            matching = [kw for kw in jd_keywords if kw in resume_lower]
            missing = [kw for kw in jd_keywords if kw not in resume_lower]
            match_pct = int((len(matching) / len(jd_keywords)) * 100) if jd_keywords else 30
            # Cap at 90% for keyword match (not perfect)
            match_pct = min(match_pct, 90)
            # Minimum 10% if we have any tech keywords
            if resume_keywords:
                match_pct = max(match_pct, 10)

        ranked.append({
            "jd_id": jd["id"],
            "rank": i + 1,
            "match_pct": match_pct,
            "matching_skills": [s.title() for s in matching[:5]],
            "missing_skills": [s.title() for s in missing[:4]],
            "advice": f"Keyword-based match for {jd['role_title']}. Upload again for AI analysis."
        })

    # Sort by match percentage
    ranked.sort(key=lambda x: x["match_pct"], reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    print(f"✅ Keyword fallback matched {len(ranked)} JDs")
    return ranked


@router.get("/api/resume/jds")
async def get_jds(db: Session = Depends(get_db)):
    jds = db.query(JobDescription).filter(JobDescription.is_active == True).all()
    return [
        {"id": str(jd.id), "company": jd.company_name, "role": jd.role_title}
        for jd in jds
    ]


def _extract_text(pdf_bytes: bytes) -> str:
    # Try pdfplumber first (best quality)
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if text.strip():
            print(f"✅ PDF extracted with pdfplumber: {len(text)} chars")
            return text[:3000]
    except Exception as e:
        print(f"pdfplumber failed: {e}")

    # Fallback to PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = " ".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            print(f"✅ PDF extracted with PyPDF2: {len(text)} chars")
            return text[:3000]
    except Exception as e:
        print(f"PyPDF2 failed: {e}")

    # Plain text fallback
    try:
        text = pdf_bytes.decode("utf-8", errors="ignore")
        if len(text.strip()) > 50:
            print(f"✅ Extracted as plain text: {len(text)} chars")
            return text[:3000]
    except Exception:
        pass

    print("❌ Could not extract any text from file")
    return "Could not extract resume text"