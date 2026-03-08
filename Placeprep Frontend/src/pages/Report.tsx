import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Download, Star, TrendingUp, AlertCircle, CheckCircle,
  BarChart3, Brain, MessageSquare, Eye, ArrowLeft, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";

interface ReportData {
  status: string;
  overallScore: number;
  verdict: string;
  categories: {
    technicalAccuracy: number;
    communication: number;
    problemSolving: number;
    confidence: number;
    bodyLanguage: number;
  };
  strengths: string[];
  improvements: string[];
  summary: string;
  tips: string[];
  topics: { name: string; score: number; feedback: string }[];
}

const ScoreRing = ({ score, size = 120, color }: { score: number; size?: number; color: string }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
    </svg>
  );
};

const getColor = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
};

const getVerdict = (verdict: string) => {
  const map: Record<string, { color: string; bg: string }> = {
    "Excellent": { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    "Good": { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    "Needs Work": { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    "Poor": { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  };
  return map[verdict] || map["Good"];
};

const Report = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session") || localStorage.getItem("session_id") || "";
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const studentName = localStorage.getItem("student_name") || "Candidate";
  const company = localStorage.getItem("interview_company") || "Company";
  const role = localStorage.getItem("interview_role") || "Role";

  useEffect(() => {
    if (!sessionId) { navigate("/dashboard"); return; }
    fetchReport();
  }, [sessionId]);

  const fetchReport = async () => {
    try {
      const r = await fetch(`http://localhost:8000/api/interviews/${sessionId}/report`);
      const data = await r.json();
      if (data.status === "processing") {
        setPolling(p => p + 1);
        setTimeout(fetchReport, 3000);
        return;
      }
      setReport(data);
    } catch (e) {
      setTimeout(fetchReport, 4000);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!report) return;
    setDownloading(true);

    // Dynamically load jsPDF
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);

    script.onload = () => {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const H = 297;

      // ── Background ────────────────────────────────────────────────
      doc.setFillColor(10, 10, 20);
      doc.rect(0, 0, W, H, "F");

      // ── Header gradient band ─────────────────────────────────────
      doc.setFillColor(79, 70, 229); // primary indigo
      doc.rect(0, 0, W, 45, "F");

      // ── PlacePrepAI logo text ─────────────────────────────────────
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("PlacePrepAI", 15, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 200, 255);
      doc.text("AI-Powered Interview Report", 15, 26);

      // Date top right
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 220);
      doc.text(new Date().toLocaleDateString("en-IN", { dateStyle: "long" }), W - 15, 18, { align: "right" });
      doc.text(`Session: ${sessionId.slice(0, 8)}...`, W - 15, 25, { align: "right" });

      // ── Candidate info ────────────────────────────────────────────
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(studentName, 15, 38);

      doc.setFontSize(9);
      doc.setTextColor(200, 200, 255);
      doc.setFont("helvetica", "normal");
      doc.text(`${role} · ${company}`, 15, 44);

      // ── Overall score circle (drawn manually) ─────────────────────
      const score = report.overallScore;
      const scoreColor = score >= 80 ? [34, 197, 94] : score >= 60 ? [245, 158, 11] : [239, 68, 68];

      // Background circle
      doc.setDrawColor(40, 40, 60);
      doc.setLineWidth(4);
      doc.circle(W - 35, 25, 16, "S");

      // Score text
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...scoreColor);
      doc.text(`${score}`, W - 35, 27, { align: "center" });
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 200);
      doc.text("/100", W - 35, 33, { align: "center" });

      let y = 55;

      // ── Verdict badge ─────────────────────────────────────────────
      const verdictColors: Record<string, number[]> = {
        "Excellent": [34, 197, 94], "Good": [59, 130, 246],
        "Needs Work": [245, 158, 11], "Poor": [239, 68, 68]
      };
      const vc = verdictColors[report.verdict] || [59, 130, 246];
      doc.setFillColor(vc[0], vc[1], vc[2], 0.15);
      doc.setDrawColor(...vc);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, y, 45, 10, 3, 3, "FD");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...vc);
      doc.text(`Verdict: ${report.verdict}`, 37.5, y + 6.5, { align: "center" });

      y += 18;

      // ── Score categories ──────────────────────────────────────────
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 220, 255);
      doc.text("Score Breakdown", 15, y);
      y += 6;

      const cats = [
        ["Technical Accuracy", report.categories.technicalAccuracy],
        ["Communication", report.categories.communication],
        ["Problem Solving", report.categories.problemSolving],
        ["Confidence", report.categories.confidence],
        ["Body Language", report.categories.bodyLanguage],
      ] as [string, number][];

      cats.forEach(([label, val]) => {
        const c = val >= 80 ? [34, 197, 94] : val >= 60 ? [245, 158, 11] : [239, 68, 68];
        doc.setFontSize(9);
        doc.setTextColor(180, 180, 210);
        doc.setFont("helvetica", "normal");
        doc.text(label, 15, y + 4);
        doc.text(`${val}%`, W - 15, y + 4, { align: "right" });

        // Bar background
        doc.setFillColor(30, 30, 50);
        doc.roundedRect(15, y + 5.5, W - 30, 3.5, 1, 1, "F");
        // Bar fill
        doc.setFillColor(...c);
        doc.roundedRect(15, y + 5.5, (W - 30) * val / 100, 3.5, 1, 1, "F");

        y += 12;
      });

      y += 4;

      // ── Topics ────────────────────────────────────────────────────
      if (report.topics && report.topics.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 220, 255);
        doc.text("Topic Analysis", 15, y);
        y += 7;

        report.topics.slice(0, 4).forEach(topic => {
          const c = topic.score >= 80 ? [34, 197, 94] : topic.score >= 60 ? [245, 158, 11] : [239, 68, 68];
          doc.setFillColor(20, 20, 35);
          doc.setDrawColor(50, 50, 80);
          doc.setLineWidth(0.3);
          doc.roundedRect(15, y, W - 30, 14, 2, 2, "FD");

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(210, 210, 240);
          doc.text(topic.name, 19, y + 5);

          doc.setFontSize(10);
          doc.setTextColor(...c);
          doc.text(`${topic.score}%`, W - 19, y + 5, { align: "right" });

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(140, 140, 170);
          doc.text(topic.feedback || "", 19, y + 11, { maxWidth: W - 50 });

          y += 17;
        });
      }

      y += 4;

      // ── Strengths ─────────────────────────────────────────────────
      if (y > 230) { doc.addPage(); doc.setFillColor(10, 10, 20); doc.rect(0, 0, W, H, "F"); y = 20; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("✓ Strengths", 15, y);
      y += 6;

      (report.strengths || []).forEach(s => {
        doc.setFillColor(15, 40, 25);
        doc.setDrawColor(34, 197, 94, 0.3);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, y, W - 30, 9, 1.5, 1.5, "FD");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 230, 170);
        doc.text(`• ${s}`, 19, y + 6);
        y += 12;
      });

      y += 4;

      // ── Improvements ──────────────────────────────────────────────
      if (y > 230) { doc.addPage(); doc.setFillColor(10, 10, 20); doc.rect(0, 0, W, H, "F"); y = 20; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11);
      doc.text("↑ Areas to Improve", 15, y);
      y += 6;

      (report.improvements || []).forEach(imp => {
        doc.setFillColor(35, 25, 5);
        doc.setDrawColor(245, 158, 11, 0.3);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, y, W - 30, 9, 1.5, 1.5, "FD");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 200, 100);
        doc.text(`• ${imp}`, 19, y + 6);
        y += 12;
      });

      y += 4;

      // ── Tips ──────────────────────────────────────────────────────
      if (y > 230) { doc.addPage(); doc.setFillColor(10, 10, 20); doc.rect(0, 0, W, H, "F"); y = 20; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(139, 92, 246);
      doc.text("💡 Actionable Tips", 15, y);
      y += 6;

      (report.tips || []).forEach((tip, i) => {
        doc.setFillColor(20, 10, 40);
        doc.setDrawColor(139, 92, 246, 0.3);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, y, W - 30, 9, 1.5, 1.5, "FD");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(190, 160, 255);
        doc.text(`${i + 1}. ${tip}`, 19, y + 6);
        y += 12;
      });

      // ── Footer ────────────────────────────────────────────────────
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFillColor(20, 20, 40);
        doc.rect(0, H - 12, W, 12, "F");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 140);
        doc.text("Generated by PlacePrepAI · AI-Powered Placement Preparation", W / 2, H - 5, { align: "center" });
        doc.text(`Page ${i} of ${pages}`, W - 15, H - 5, { align: "right" });
      }

      doc.save(`PlacePrepAI_Report_${studentName.replace(/\s+/g, "_")}.pdf`);
      setDownloading(false);
    };

    script.onerror = () => {
      alert("PDF library failed to load. Please check your internet connection.");
      setDownloading(false);
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <div className="text-center mt-20">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-foreground font-medium">Generating your evaluation...</p>
          <p className="text-sm text-muted-foreground mt-1">This takes 15-30 seconds</p>
          {polling > 3 && (
            <p className="text-xs text-muted-foreground mt-3">Still processing... please wait</p>
          )}
        </div>
      </div>
    );
  }

  if (!report || report.status === "failed") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto text-center pt-40 px-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Report Not Available</h2>
          <p className="text-muted-foreground mb-6">The evaluation could not be completed. Please try again.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Button>
            <Button onClick={fetchReport} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const verdictStyle = getVerdict(report.verdict);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-5 h-5 text-primary" />
                <span className="text-sm text-primary font-semibold">PlacePrepAI Report</span>
              </div>
              <h1 className="text-3xl font-black text-foreground">{studentName}</h1>
              <p className="text-muted-foreground">{role} · {company}</p>
            </div>
            <Button
              onClick={downloadPDF}
              disabled={downloading}
              className="gap-2 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Generating PDF..." : "Download PDF Report"}
            </Button>
          </div>
        </motion.div>

        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-2xl bg-card border border-border mb-6 text-center"
        >
          <div className="relative inline-block mb-4">
            <ScoreRing score={report.overallScore} size={140} color={getColor(report.overallScore)} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-foreground">{report.overallScore}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${verdictStyle.bg} ${verdictStyle.color}`}>
            <Star className="w-4 h-4" /> {report.verdict}
          </div>
        </motion.div>

        {/* Category bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-card border border-border mb-6"
        >
          <h2 className="font-bold text-foreground mb-5 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Score Breakdown
          </h2>
          <div className="space-y-4">
            {[
              ["Technical Accuracy", report.categories.technicalAccuracy, <Brain className="w-4 h-4" />],
              ["Communication", report.categories.communication, <MessageSquare className="w-4 h-4" />],
              ["Problem Solving", report.categories.problemSolving, <TrendingUp className="w-4 h-4" />],
              ["Confidence", report.categories.confidence, <Star className="w-4 h-4" />],
              ["Body Language", report.categories.bodyLanguage, <Eye className="w-4 h-4" />],
            ].map(([label, val, icon]: any) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span style={{ color: getColor(val) }}>{icon}</span>
                    {label}
                  </div>
                  <span className="text-sm font-bold" style={{ color: getColor(val) }}>{val}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: getColor(val) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${val}%` }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Topics */}
        {report.topics && report.topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-card border border-border mb-6"
          >
            <h2 className="font-bold text-foreground mb-4">Topic Analysis</h2>
            <div className="space-y-3">
              {report.topics.map((t, i) => (
                <div key={i} className="p-4 rounded-xl bg-background border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground">{t.name}</span>
                    <span className="text-sm font-bold" style={{ color: getColor(t.score) }}>{t.score}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.feedback}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Strengths + Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl bg-green-500/5 border border-green-500/20"
          >
            <h2 className="font-bold text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Strengths
            </h2>
            <ul className="space-y-2">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-green-400 mt-0.5">✓</span> {s}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl bg-yellow-500/5 border border-yellow-500/20"
          >
            <h2 className="font-bold text-yellow-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Areas to Improve
            </h2>
            <ul className="space-y-2">
              {(report.improvements || []).map((imp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-yellow-400 mt-0.5">↑</span> {imp}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-primary/5 border border-primary/20 mb-6"
        >
          <h2 className="font-bold text-primary mb-4">💡 Actionable Tips</h2>
          <div className="space-y-3">
            {(report.tips || []).map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground/80 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <Button onClick={downloadPDF} disabled={downloading} className="gap-2">
            <Download className="w-4 h-4" />
            {downloading ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Report;
