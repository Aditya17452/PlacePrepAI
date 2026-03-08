from sqlalchemy import (
    create_engine, Column, String, Integer,
    Float, Text, DateTime, Boolean, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import uuid
from datetime import datetime
from core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def gen_uuid():
    return str(uuid.uuid4())


class Student(Base):
    __tablename__ = "students"
    id              = Column(String(36), primary_key=True, default=gen_uuid)
    name            = Column(String(200))
    email           = Column(String(200), unique=True)
    role            = Column(String(20), default="student")
    cgpa            = Column(Float, default=7.0)
    branch          = Column(String(100), default="Computer Science")
    year_of_passing = Column(Integer, default=2026)
    skills          = Column(JSON, default=list)
    resume_text     = Column(Text, nullable=True)
    password_hash   = Column(String(200), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    id               = Column(String(36), primary_key=True, default=gen_uuid)
    company_name     = Column(String(200))
    role_title       = Column(String(200))
    required_skills  = Column(JSON, default=list)
    cgpa_cutoff      = Column(Float, default=6.0)
    jd_text          = Column(Text)
    difficulty       = Column(String(20), default="medium")
    duration_minutes = Column(Integer, default=22)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)


class JDChunk(Base):
    __tablename__ = "jd_chunks"
    id          = Column(String(36), primary_key=True, default=gen_uuid)
    jd_id       = Column(String(36))
    chunk_text  = Column(Text)
    chunk_index = Column(Integer)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id                 = Column(String(36), primary_key=True, default=gen_uuid)
    student_id         = Column(String(36))
    jd_id              = Column(String(36))
    status             = Column(String(20), default="active")
    started_at         = Column(DateTime, default=datetime.utcnow)
    ended_at           = Column(DateTime, nullable=True)
    duration_seconds   = Column(Integer, nullable=True)
    question_count     = Column(Integer, default=0)
    total_filler_words = Column(Integer, default=0)
    avg_wpm            = Column(Float, nullable=True)


class SessionTranscript(Base):
    __tablename__ = "session_transcripts"
    id           = Column(String(36), primary_key=True, default=gen_uuid)
    session_id   = Column(String(36))
    turn_number  = Column(Integer)
    phase        = Column(String(20))
    question     = Column(Text)
    answer       = Column(Text)
    answer_wpm   = Column(Float, nullable=True)
    filler_count = Column(Integer, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)


class SessionScore(Base):
    __tablename__ = "session_scores"
    id                  = Column(String(36), primary_key=True, default=gen_uuid)
    session_id          = Column(String(36), unique=True)
    overall_score       = Column(Float, nullable=True)
    technical_score     = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    body_language_score = Column(Float, nullable=True)
    avg_eye_contact_pct = Column(Float, nullable=True)
    avg_posture_score   = Column(Float, nullable=True)
    verdict             = Column(String(50), nullable=True)
    topics_json         = Column(JSON, nullable=True)
    strengths_json      = Column(JSON, nullable=True)
    improvements_json   = Column(JSON, nullable=True)
    tips_json           = Column(JSON, nullable=True)
    evaluation_status   = Column(String(20), default="pending")
    evaluated_at        = Column(DateTime, nullable=True)


class Shortlist(Base):
    __tablename__ = "shortlists"
    id           = Column(String(36), primary_key=True, default=gen_uuid)
    jd_id        = Column(String(36))
    officer_id   = Column(String(36))
    status       = Column(String(20), default="processing")
    results_json = Column(JSON, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


JD_TEMPLATES = [
    {
        "company_name": "Top Tech Companies",
        "role_title": "JavaScript / Frontend Developer",
        "required_skills": ["JavaScript", "React", "HTML", "CSS", "TypeScript"],
        "jd_text": """Role: JavaScript / Frontend Developer
Required Skills: JavaScript, React, HTML, CSS, TypeScript, REST APIs, Git
Good to Have: Next.js, Redux, Tailwind CSS, Jest, Webpack
Responsibilities:
- Build responsive web applications using React and TypeScript
- Integrate REST APIs and manage application state
- Write clean, maintainable, well-tested code
- Optimize application performance and load times
- Collaborate with designers and backend engineers
Key Evaluation Topics:
- JavaScript fundamentals: closures, promises, async/await, event loop
- React: hooks (useState, useEffect, useCallback, useMemo), lifecycle, virtual DOM
- State management: Redux, Context API, Zustand
- CSS: flexbox, grid, responsive design, animations
- REST APIs: fetch, axios, error handling
- Performance: lazy loading, code splitting, memoization
- Testing: Jest, React Testing Library"""
    },
    {
        "company_name": "Top Tech Companies",
        "role_title": "Machine Learning Engineer",
        "required_skills": ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Scikit-learn"],
        "jd_text": """Role: Machine Learning Engineer
Required Skills: Python, Machine Learning, Scikit-learn, TensorFlow or PyTorch, NumPy, Pandas
Good to Have: MLflow, Docker, FastAPI, Kubernetes, model deployment, cloud platforms
Responsibilities:
- Design, train and evaluate ML models for production
- Clean and preprocess large datasets
- Deploy models as REST APIs
- Monitor model performance in production
- Collaborate with data scientists and engineers
Key Evaluation Topics:
- ML algorithms: linear/logistic regression, decision trees, random forests, SVM, KNN
- Deep learning: neural networks, CNNs, RNNs, transformers, backpropagation
- Model evaluation: precision, recall, F1, ROC-AUC, cross-validation
- Overfitting/underfitting: regularization, dropout, early stopping
- Feature engineering: encoding, scaling, selection, PCA
- Python: NumPy, Pandas, Matplotlib, Scikit-learn
- Model deployment: REST APIs, Docker, model serialization"""
    },
    {
        "company_name": "Top Tech Companies",
        "role_title": "AI / Generative AI Engineer",
        "required_skills": ["Python", "LLMs", "LangChain", "Prompt Engineering", "RAG"],
        "jd_text": """Role: AI / Generative AI Engineer
Required Skills: Python, LLMs, Prompt Engineering, LangChain or LlamaIndex, OpenAI/Groq APIs, RAG
Good to Have: Vector databases (Pinecone, Chroma, Weaviate), fine-tuning, embeddings, FastAPI
Responsibilities:
- Build AI-powered applications using LLMs and RAG pipelines
- Design and optimize prompts for various use cases
- Integrate AI features into production applications
- Build and maintain vector databases and embedding pipelines
- Evaluate and improve AI output quality and reliability
Key Evaluation Topics:
- LLM concepts: tokens, context window, temperature, top-p sampling
- RAG: chunking strategies, embedding models, vector search, reranking
- Prompt engineering: chain-of-thought, few-shot, system prompts, structured output
- LangChain/LlamaIndex: agents, tools, memory, chains
- Embeddings: semantic search, cosine similarity, FAISS
- Fine-tuning: LoRA, PEFT, instruction tuning
- Evaluation: hallucination detection, faithfulness, RAGAS"""
    },
    {
        "company_name": "Top Tech Companies",
        "role_title": "Data Engineer",
        "required_skills": ["Python", "SQL", "ETL", "Apache Spark", "Airflow"],
        "jd_text": """Role: Data Engineer
Required Skills: Python, SQL, ETL pipelines, Apache Spark or Airflow, Data Warehousing
Good to Have: AWS/GCP/Azure, Kafka, dbt, BigQuery, Snowflake, Delta Lake
Responsibilities:
- Design and build scalable batch and real-time data pipelines
- Transform and load data into data warehouses
- Maintain data quality, reliability and pipeline monitoring
- Work with analysts and scientists to deliver clean, structured data
- Optimize SQL queries and pipeline performance
Key Evaluation Topics:
- SQL: complex joins, window functions, CTEs, query optimization, indexing
- ETL design: extraction strategies, transformation logic, incremental loads
- Data modeling: star schema, snowflake schema, normalization, denormalization
- Apache Spark: RDDs, DataFrames, transformations vs actions, partitioning
- Airflow: DAGs, operators, scheduling, dependencies
- Data warehousing: OLAP vs OLTP, columnar storage, partitioning
- Streaming: Kafka concepts, event-driven architecture"""
    },
    {
        "company_name": "Top Tech Companies",
        "role_title": "Data Scientist",
        "required_skills": ["Python", "Statistics", "Machine Learning", "Pandas", "Data Visualization"],
        "jd_text": """Role: Data Scientist
Required Skills: Python, Statistics, Machine Learning, Pandas, NumPy, Data Visualization
Good to Have: R, A/B Testing, SQL, Tableau, Jupyter, Bayesian statistics
Responsibilities:
- Analyze large datasets to discover business insights
- Build predictive models and run statistical analyses
- Design and analyze A/B experiments
- Present findings clearly to technical and non-technical stakeholders
- Define and track key business metrics
Key Evaluation Topics:
- Statistics: mean/median/mode, variance, distributions, CLT, confidence intervals
- Hypothesis testing: t-test, chi-square, ANOVA, p-values, type I/II errors
- Regression: linear, logistic, polynomial, assumptions, interpretation
- Classification: decision trees, random forests, gradient boosting, evaluation metrics
- A/B testing: experimental design, sample size, statistical significance
- EDA: data cleaning, outlier detection, correlation, visualization
- Python: Pandas, NumPy, Matplotlib, Seaborn, Scikit-learn
- Business thinking: translating data insights to decisions"""
    },
    {
        "company_name": "Top Tech Companies",
        "role_title": "Data Analyst",
        "required_skills": ["SQL", "Excel", "Data Visualization", "Python", "Business Intelligence"],
        "jd_text": """Role: Data Analyst
Required Skills: SQL, Excel, Data Visualization, Python or R basics, Business Intelligence tools
Good to Have: Tableau, Power BI, Google Analytics, Statistics, Google Sheets
Responsibilities:
- Query databases and analyze business data to answer key questions
- Build dashboards and reports for stakeholders
- Identify trends, patterns and anomalies in data
- Support data-driven business decisions
- Collaborate with product, marketing and operations teams
Key Evaluation Topics:
- SQL: SELECT, JOINs, GROUP BY, HAVING, subqueries, window functions
- Excel: VLOOKUP, pivot tables, formulas, conditional formatting
- Data visualization: choosing right chart types, dashboard design, storytelling
- Business metrics: KPIs, conversion rates, retention, cohort analysis
- Python basics: Pandas for data manipulation, Matplotlib for visualization
- Statistics: descriptive stats, basic probability, trend analysis
- Business thinking: framing questions, actionable insights, communication"""
    }
]


def seed_jds(db_session):
    existing = db_session.query(JobDescription).count()
    if existing > 0:
        print(f"✅ JDs already seeded ({existing} found)")
        return

    for jd_data in JD_TEMPLATES:
        jd = JobDescription(
            company_name=jd_data["company_name"],
            role_title=jd_data["role_title"],
            required_skills=jd_data["required_skills"],
            jd_text=jd_data["jd_text"],
            is_active=True
        )
        db_session.add(jd)

    db_session.commit()
    print(f"✅ Seeded {len(JD_TEMPLATES)} role-based JDs")


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ All SQLite tables created")
    # Auto-seed JDs
    db = SessionLocal()
    try:
        seed_jds(db)
    finally:
        db.close()