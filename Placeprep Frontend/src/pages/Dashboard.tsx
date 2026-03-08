import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Upload, FileText, Play, Clock, Target, TrendingUp,
  Lock, CreditCard, AlertCircle, CheckCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyzeResume, fetchSessions, startInterview, getCredits, useCredit,
  type JDMatch, type InterviewSession
} from "@/services/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [jdMatches, setJdMatches] = useState<JDMatch[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditError, setCreditError] = useState("");

  const studentName =
    localStorage.getItem("student_name") ||
    localStorage.getItem("name") ||
    "Student";

  useEffect(() => {
    fetchSessions().then(setSessions).catch(console.error);
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      const data = await getCredits();
      setCredits(data.credits);
      setCreditsUsed(data.total_used);
    } catch {
      setCredits(99); // fallback: unlimited if API not ready
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsAnalyzing(true);
    setCreditError("");
    try {
      const result = await analyzeResume(file);
      setJdMatches(result.suggestions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartInterview = async (jd: JDMatch) => {
    setCreditError("");

    // Block if no credits
    if (credits !== null && credits !== 99 && credits <= 0) {
      setCreditError("No interview credits left. Contact Team Saksham for getting the credits and enhance your preparation.");
      return;
    }

    setIsStarting(jd.jdId);
    try {
      // Deduct 1 credit before starting
      if (credits !== null && credits !== 99) {
        await useCredit();
        setCredits(c => Math.max(0, (c ?? 1) - 1));
        setCreditsUsed(u => u + 1);
      }

      // startInterview (api.ts) automatically saves:
      // session_id, opening_question, interview_company, interview_role to localStorage
      await startInterview(jd.jdId);

      // Go to pre-interview checklist (NOT directly to /interview)
      navigate("/pre-interview");
    } catch (err: any) {
      console.error(err);
      setCreditError(err.message || "Failed to start interview. Please try again.");
      // Reload actual credit count in case something went wrong
      loadCredits();
    } finally {
      setIsStarting(null);
    }
  };

  // Split into eligible (>=70%) and locked (<70%)
  const eligibleJDs = jdMatches.filter(jd => jd.matchScore >= 70);
  const lockedJDs   = jdMatches.filter(jd => jd.matchScore < 70);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Welcome, {studentName} 👋
            </h1>
            <p className="text-muted-foreground">Upload your resume, match with JDs, and start practicing.</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Target,     label: "Sessions",    value: sessions.length.toString(), color: "text-primary" },
              {
                icon: TrendingUp, label: "Avg Score", color: "text-success",
                value: sessions.length
                  ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) + "%"
                  : "—"
              },
              { icon: Clock,      label: "JD Matches",  value: jdMatches.length.toString(), color: "text-warning" },
              {
                icon: CreditCard, label: "Credits Left",
                color: credits === 0 ? "text-red-400" : "text-green-400",
                value: credits === null ? "..." : credits === 99 ? "∞" : String(credits)
              },
            ].map((stat) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-card border border-border">
                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <div className="font-display text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* No credits warning */}
          {credits === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">No interview credits remaining</p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  Contact your placement officer to get more credits assigned to your account.
                </p>
              </div>
            </motion.div>
          )}

          {/* Credit / start error */}
          {creditError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {creditError}
            </motion.div>
          )}

          {/* Resume Upload */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/30 transition-colors mb-8 text-center cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">
              {fileName || "Upload Your Resume"}
            </p>
            <p className="text-sm text-muted-foreground">PDF format · AI matches you to best JDs · only ≥70% roles unlocked</p>
            <Button variant="hero" size="sm" className="mt-4" disabled={isAnalyzing}>
              <FileText className="w-4 h-4 mr-1" />
              {isAnalyzing ? "Analyzing resume..." : "Choose PDF"}
            </Button>
          </motion.div>

          {/* ── ELIGIBLE JDs ≥70% ───────────────────────────────────── */}
          {eligibleJDs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h2 className="font-display text-xl font-semibold text-foreground">
                  You're Eligible For
                </h2>
                <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                  {eligibleJDs.length} role{eligibleJDs.length > 1 ? "s" : ""} · ≥70% match
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {eligibleJDs.map((jd, i) => (
                  <motion.div key={jd.jdId}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="p-5 rounded-xl bg-card border border-green-500/20 hover:border-green-500/40 transition-all hover:shadow-lg hover:shadow-green-500/5">

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-foreground">{jd.company}</h3>
                        <p className="text-sm text-muted-foreground">{jd.role}</p>
                      </div>
                      <div className="text-sm font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        {jd.matchScore}%
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mb-2">{jd.status}</div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {jd.matchedSkills.slice(0, 4).map((s) => (
                        <span key={s} className="px-2 py-0.5 text-xs rounded-md bg-green-500/10 text-green-400">{s}</span>
                      ))}
                      {jd.missingSkills.slice(0, 2).map((s) => (
                        <span key={s} className="px-2 py-0.5 text-xs rounded-md bg-warning/10 text-warning">{s}</span>
                      ))}
                    </div>

                    {credits !== null && credits !== 99 && (
                      <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                        <CreditCard className="w-3 h-3" />
                        Uses 1 credit · {credits} left
                      </div>
                    )}

                    <Button
                      variant="hero"
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={isStarting === jd.jdId || credits === 0}
                      onClick={() => handleStartInterview(jd)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {isStarting === jd.jdId
                        ? "Starting..."
                        : credits === 0
                        ? "No Credits Left"
                        : "Start Interview"}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* ── LOCKED JDs <70% ─────────────────────────────────────── */}
          {lockedJDs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-display text-xl font-semibold text-muted-foreground">
                  Not Eligible Yet
                </h2>
                <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border">
                  {lockedJDs.length} role{lockedJDs.length > 1 ? "s" : ""} · &lt;70% match
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {lockedJDs.map((jd, i) => (
                  <motion.div key={jd.jdId}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className="p-5 rounded-xl bg-card/50 border border-red-500/10 opacity-65 relative overflow-hidden">

                    {/* Lock badge */}
                    <div className="absolute top-3 right-3">
                      <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-red-400" />
                      </div>
                    </div>

                    <div className="mb-3 pr-8">
                      <h3 className="font-display font-semibold text-foreground/70">{jd.company}</h3>
                      <p className="text-sm text-muted-foreground">{jd.role}</p>
                    </div>

                    <div className="inline-block text-sm font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 mb-3">
                      {jd.matchScore}% match
                    </div>

                    {jd.missingSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {jd.missingSkills.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-md bg-red-500/10 text-red-400/70">
                            Missing: {s}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400/80">
                        Requires ≥70% match. Add the missing skills to your resume.
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {jdMatches.length === 0 && !isAnalyzing && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-foreground/60">No JD matches yet</p>
              <p className="text-sm mt-1">Upload your resume above to see which roles you qualify for</p>
            </div>
          )}

          {/* Past Sessions */}
          {sessions.length > 0 && (
            <>
              <h2 className="font-display text-xl font-semibold text-foreground mb-4 mt-4">Past Sessions</h2>
              <div className="space-y-3">
                {sessions.map((s, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                    <div>
                      <p className="font-medium text-foreground">{s.company} — {s.role}</p>
                      <p className="text-sm text-muted-foreground">{s.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-display font-bold text-lg ${
                        s.score >= 80 ? "text-green-400"
                        : s.score >= 60 ? "text-primary"
                        : "text-warning"
                      }`}>{s.score}%</span>
                      <Button variant="hero-outline" size="sm"
                        onClick={() => navigate(`/report?session=${s.id}`)}>
                        View Report
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
