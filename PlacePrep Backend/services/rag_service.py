import asyncio
from sqlalchemy import text
from models.database import SessionLocal, JDChunk
from core.config import settings

_embedder = None

def get_embedder():
    # Still load embedder — used for future upgrade
    # For now we use keyword search in MySQL
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedder


async def retrieve_jd_context(student_answer: str, jd_id: str) -> str:
    """
    MySQL version — uses keyword matching instead of vector search.
    Finds JD chunks that contain words from the student's answer.
    Works well for 3-4 JDs in MVP.
    """
    chunks = await asyncio.to_thread(_keyword_search, student_answer, jd_id)
    if not chunks:
        # Fallback — return first 3 chunks of JD
        chunks = await asyncio.to_thread(_get_first_chunks, jd_id)
    if not chunks:
        return "No specific JD requirements found."
    return "\n".join(f"- {c}" for c in chunks)


def _keyword_search(answer: str, jd_id: str) -> list[str]:
    """Find chunks containing keywords from the student's answer."""
    db = SessionLocal()
    try:
        # Extract meaningful keywords (words > 4 chars)
        words = [w.lower() for w in answer.split() if len(w) > 4]
        if not words:
            return _get_first_chunks(jd_id)

        # Search for chunks containing any of the keywords
        # Use LIKE for simplicity — works fine for small JD sets
        results = []
        seen = set()

        for word in words[:5]:  # check top 5 keywords
            rows = db.execute(text("""
                SELECT chunk_text FROM jd_chunks
                WHERE jd_id = :jd_id
                AND LOWER(chunk_text) LIKE :word
                LIMIT 2
            """), {
                "jd_id": jd_id,
                "word": f"%{word}%"
            }).fetchall()

            for row in rows:
                if row[0] not in seen:
                    seen.add(row[0])
                    results.append(row[0])

            if len(results) >= settings.TOP_K_JD_CHUNKS:
                break

        return results[:settings.TOP_K_JD_CHUNKS]
    finally:
        db.close()


def _get_first_chunks(jd_id: str) -> list[str]:
    """Fallback — return first N chunks of the JD."""
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT chunk_text FROM jd_chunks
            WHERE jd_id = :jd_id
            ORDER BY chunk_index
            LIMIT :k
        """), {"jd_id": jd_id, "k": settings.TOP_K_JD_CHUNKS}).fetchall()
        return [r[0] for r in rows]
    finally:
        db.close()


def embed_jd(jd_id: str, jd_text: str):
    """
    For MySQL — just split and store chunks as text.
    No vector embedding needed for keyword search.
    """
    db = SessionLocal()
    try:
        # Delete old chunks
        db.execute(text(
            "DELETE FROM jd_chunks WHERE jd_id = :id"
        ), {"id": jd_id})
        db.commit()

        # Split into 150-word chunks
        words = jd_text.split()
        chunks = [
            " ".join(words[i:i+150])
            for i in range(0, len(words), 150)
        ]

        for idx, chunk_text in enumerate(chunks):
            chunk = JDChunk(
                jd_id=jd_id,
                chunk_text=chunk_text,
                chunk_index=idx
                # No embedding column in MySQL version
            )
            db.add(chunk)
        db.commit()
        print(f"✅ Stored {len(chunks)} chunks for JD {jd_id}")
    finally:
        db.close()