const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const WS_BASE  = import.meta.env.VITE_WS_BASE_URL  || "ws://localhost:8000";

// ── Types ─────────────────────────────────────────────────

export interface ResumeAnalysis {
  skills: string[];
  experience: { title: string; company: string; duration: string }[];
  education: { degree: string; institution: string; cgpa: number }[];
  suggestedRoles: string[];
  summary: string;
}

export interface JDMatch {
  company: string;
  role: string;
  matchScore: number;
  status: "Best Match" | "Good Match" | "Also Consider";
  matchedSkills: string[];
  missingSkills: string[];
  reasoning: string;
  jdId: string;
}

export interface TranscriptAnalysis {
  overallScore: number;
  categories: {
    technicalAccuracy: number;
    communication: number;
    problemSolving: number;
    confidence: number;
    bodyLanguage: number;
  };
  strengths: string[];
  improvements: string[];
  questionBreakdown: { question: string; answer: string; score: number; feedback: string }[];
  summary: string;
}

export interface ShortlistCandidate {
  rank: number;
  name: string;
  matchScore: number;
  cgpa: number;
  reasoning: string;
  interviewScore?: number;
  technicalScore?: number;
  communicationScore?: number;
}

export interface InterviewSession {
  id: string;
  company: string;
  role: string;
  date: string;
  score: number;
  status: "Completed" | "In Progress" | "Scheduled";
}

// ── Auth helpers ───────────────────────────────────────────

export function getToken(): string {
  return localStorage.getItem("token") || "";
}

export function getStudentId(): string {
  return localStorage.getItem("student_id") || "";
}

export function getStudentName(): string {
  return localStorage.getItem("student_name") || "Candidate";
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Base fetch ─────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await api<{ token: string; role: string; name: string; id: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("name", data.name);
  localStorage.setItem("student_id", data.id);
  localStorage.setItem("student_name", data.name); // ✅ used by InterviewRoom greeting
  return data;
}

export async function register(payload: {
  name: string; email: string; password: string;
  role?: string; cgpa?: number; branch?: string;
}) {
  const data = await api<{ token: string; role: string; name: string; id: string }>(
    "/auth/register",
    { method: "POST", body: JSON.stringify(payload) }
  );
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("name", data.name);
  localStorage.setItem("student_id", data.id);
  localStorage.setItem("student_name", data.name); // ✅ used by InterviewRoom greeting
  return data;
}

export function logout() {
  localStorage.clear();
  window.location.href = "/";
}

// ── Resume ─────────────────────────────────────────────────

export async function analyzeResume(file: File): Promise<{ suggestions: JDMatch[] }> {
  const formData = new FormData();
  formData.append("resume", file);

  const studentId = getStudentId();
  const token = getToken();
  const url = `${API_BASE}/resume/upload${studentId ? `?student_id=${studentId}` : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Resume upload failed");
  }
  return res.json();
}

export async function matchResumeWithJDs(): Promise<JDMatch[]> {
  const result = await analyzeResume(new File([""], "dummy"));
  return result.suggestions || [];
}

// ── Interview ──────────────────────────────────────────────

export function getInterviewWebSocketURL(sessionId: string): string {
  return `${WS_BASE}/ws/interview/${sessionId}`;
}

export async function startInterview(
  jdId: string,
  studentId?: string
): Promise<{ sessionId: string; openingQuestion: string; company: string; role: string }> {
  const sid = studentId || getStudentId();
  const data = await api<any>("/interviews/start", {
    method: "POST",
    body: JSON.stringify({ jd_id: jdId, student_id: sid }),
  });

  // ✅ Save interview context for InterviewRoom + PreInterview pages
  localStorage.setItem("session_id", data.sessionId);
  localStorage.setItem("opening_question", data.openingQuestion);
  localStorage.setItem("interview_company", data.company);
  localStorage.setItem("interview_role", data.role);

  return {
    sessionId: data.sessionId,
    openingQuestion: data.openingQuestion,
    company: data.company,
    role: data.role,
  };
}

export async function endInterview(sessionId: string): Promise<void> {
  await api(`/interviews/${sessionId}/end`, { method: "POST" });
}

export async function analyzeTranscript(sessionId: string): Promise<TranscriptAnalysis> {
  const poll = async (): Promise<TranscriptAnalysis> => {
    const result = await api<any>(`/interviews/${sessionId}/report`);
    if (result.status === "complete") return result;
    if (result.status === "failed") throw new Error("Evaluation failed");
    await new Promise((r) => setTimeout(r, 4000));
    return poll();
  };
  return poll();
}

export async function fetchSessions(): Promise<InterviewSession[]> {
  const studentId = getStudentId();
  if (!studentId) return [];
  return api<InterviewSession[]>(`/interviews/history/${studentId}`);
}

// ── Credits ────────────────────────────────────────────────

export async function getCredits(): Promise<{ credits: number; total_used: number }> {
  const studentId = getStudentId();
  if (!studentId) return { credits: 0, total_used: 0 };
  return api(`/credits/${studentId}`);
}

export async function useCredit(): Promise<{ credits: number; success: boolean }> {
  const studentId = getStudentId();
  return api(`/credits/${studentId}/use`, { method: "POST" });
}

// ── Shortlist ──────────────────────────────────────────────

export async function generateShortlist(jdId: string): Promise<ShortlistCandidate[]> {
  const data = await api<ShortlistCandidate[]>(`/officer/shortlist`, {
    method: "POST",
    body: JSON.stringify({ jd_id: jdId })
  });
  return data;
}

export async function getStudents(): Promise<{ students: any[] }> {
  const data = await api<{ students: any[] }>(`/officer/students`);
  return data;
}
