"""Run this once: python scripts/seed_data.py"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.database import create_tables, SessionLocal, Student, JobDescription
from services.rag_service import embed_jd
import hashlib, uuid, json

def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

def seed():
    create_tables()
    db = SessionLocal()
    try:
        # ── Students (unchanged) ─────────────────────────────────────────
        if not db.query(Student).first():
            students = [
                Student(name="Rahul Sharma", email="rahul@college.edu",
                        role="student", cgpa=8.5, branch="Computer Science",
                        year_of_passing=2026,
                        skills=["Python","React","SQL","DSA","System Design"],
                        password_hash=hash_pw("password123")),
                Student(name="Priya Patel", email="priya@college.edu",
                        role="student", cgpa=9.1, branch="Computer Science",
                        year_of_passing=2026,
                        skills=["Java","Spring Boot","MySQL","AWS"],
                        password_hash=hash_pw("password123")),
                Student(name="Officer Singh", email="officer@college.edu",
                        role="officer", cgpa=0, branch="Admin",
                        year_of_passing=2020,
                        password_hash=hash_pw("officer123")),
            ]
            for s in students:
                db.add(s)
            db.commit()
            print("✅ Students seeded")

        # ── JDs (role-only, no company names) ────────────────────────────
        if not db.query(JobDescription).first():
            jds_data = [
                {
                    "company_name": "",
                    "role_title": "Machine Learning Engineer",
                    "required_skills": ["Python", "scikit-learn", "TensorFlow", "model deployment", "REST APIs"],
                    "cgpa_cutoff": 7.0,
                    "jd_text": """Role: Machine Learning Engineer

Requirements: Strong Python with NumPy, Pandas, scikit-learn.
Experience with TensorFlow or PyTorch.
Understanding of bias-variance tradeoff, regularization, cross-validation.
Knowledge of model deployment and REST API development.
CGPA 7.0+, B.Tech CS/AIML/IT.

Responsibilities: Design and implement ML pipelines for real-world datasets.
Deploy models as REST APIs using FastAPI or Flask.
Optimize models for performance and scalability.
Collaborate with data teams on feature engineering."""
                },
                {
                    "company_name": "",
                    "role_title": "AI/GenAI Engineer",
                    "required_skills": ["Python", "Deep Learning", "NLP", "PyTorch", "LLM", "RAG"],
                    "cgpa_cutoff": 7.5,
                    "jd_text": """Role: AI/GenAI Engineer

Requirements: Hands-on with PyTorch, Hugging Face transformers.
Understanding of embeddings, vector databases, RAG pipelines.
Experience with NLP tasks: classification, NER, summarization.
Knowledge of LLM deployment and prompt engineering.
CGPA 7.5+, B.Tech CS/AIML.

Responsibilities: Build RAG pipelines and LLM-integrated applications.
Fine-tune and evaluate language models.
Design prompt engineering frameworks.
Integrate AI features into production systems."""
                },
                {
                    "company_name": "",
                    "role_title": "Data Scientist",
                    "required_skills": ["Python", "Statistics", "SQL", "EDA", "A/B Testing", "scikit-learn"],
                    "cgpa_cutoff": 6.5,
                    "jd_text": """Role: Data Scientist

Requirements: Strong statistics — hypothesis testing, p-values, confidence intervals.
SQL proficiency for data extraction and analysis.
Python with Pandas, Matplotlib, scikit-learn.
Understanding of regression, classification, clustering algorithms.
CGPA 6.5+, B.Tech any branch.

Responsibilities: Perform exploratory data analysis and feature engineering.
Build predictive models and run statistical tests.
Design and analyze A/B experiments.
Present findings clearly to stakeholders."""
                },
                {
                    "company_name": "",
                    "role_title": "Data Analyst",
                    "required_skills": ["SQL", "Excel", "Power BI", "Python", "Data Visualization"],
                    "cgpa_cutoff": 6.0,
                    "jd_text": """Role: Data Analyst

Requirements: Advanced SQL — joins, window functions, GROUP BY, subqueries.
Proficiency in Excel pivot tables and charts.
Experience with Power BI or Tableau dashboards.
Basic Python for data manipulation with Pandas.
Strong communication and presentation skills.
CGPA 6.0+.

Responsibilities: Extract and analyze data using SQL and Python.
Build dashboards and track business KPIs.
Prepare data reports for management review."""
                },
                {
                    "company_name": "",
                    "role_title": "Frontend Developer",
                    "required_skills": ["React", "JavaScript", "TypeScript", "CSS", "REST APIs"],
                    "cgpa_cutoff": 6.5,
                    "jd_text": """Role: Frontend Developer

Requirements: Strong JavaScript and TypeScript fundamentals.
React hooks, context, state management (Redux or Zustand).
CSS and Tailwind, responsive design principles.
Understanding of browser rendering and virtual DOM.
REST API integration experience.
CGPA 6.5+, B.Tech CS/IT.

Responsibilities: Build responsive UI components with React and TypeScript.
Integrate REST APIs and manage application state.
Optimize frontend performance and write testable code."""
                },
                {
                    "company_name": "",
                    "role_title": "Data Engineer",
                    "required_skills": ["Python", "SQL", "Apache Spark", "ETL", "Cloud"],
                    "cgpa_cutoff": 7.0,
                    "jd_text": """Role: Data Engineer

Requirements: Strong SQL — window functions, query optimization, data modeling.
Python for pipeline scripting and automation.
Experience with Apache Spark or Hadoop.
Knowledge of cloud platforms (AWS/GCP/Azure).
Understanding of ETL/ELT and data warehousing concepts.
CGPA 7.0+, B.Tech CS/IT.

Responsibilities: Design and maintain data pipelines at scale.
Build data models and warehouse structures.
Monitor and optimize pipeline performance."""
                },
            ]

            jd_objects = []
            for jd_data in jds_data:
                jd = JobDescription(**jd_data)
                db.add(jd)
                jd_objects.append(jd)
            db.commit()
            print("✅ JDs seeded (role-only, no company names)")

            # Embed JDs for RAG
            print("Embedding JDs for RAG (takes ~1 minute first time)...")
            for jd in jd_objects:
                embed_jd(str(jd.id), jd.jd_text)

        print("\n✅ Seed complete!")
        print("\nTest credentials:")
        print("  Student:  rahul@college.edu / password123")
        print("  Officer:  officer@college.edu / officer123")

    finally:
        db.close()

if __name__ == "__main__":
    seed()