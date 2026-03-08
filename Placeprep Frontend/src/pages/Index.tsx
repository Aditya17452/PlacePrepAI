import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Brain, Mic, FileText, BarChart3, ChevronRight, Upload,
  Sparkles, Shield, Clock, Users, Star, CheckCircle, ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";

const FEATURES = [
  { icon: <Brain className="w-6 h-6" />, title: "AI-Powered Questions", desc: "Dynamic questions adapt to your answers in real time using Groq LLM.", color: "from-purple-500 to-indigo-500" },
  { icon: <Mic className="w-6 h-6" />, title: "Voice or Text", desc: "Answer by typing or speaking — the AI evaluates both equally well.", color: "from-pink-500 to-rose-500" },
  { icon: <FileText className="w-6 h-6" />, title: "Resume Matching", desc: "Upload your resume and get matched to the best JDs for your profile.", color: "from-cyan-500 to-blue-500" },
  { icon: <BarChart3 className="w-6 h-6" />, title: "Detailed Reports", desc: "Get a full PDF report with scores, strengths, and improvement tips.", color: "from-green-500 to-emerald-500" },
  { icon: <Shield className="w-6 h-6" />, title: "Fair Evaluation", desc: "Every answer is evaluated consistently by the same AI model.", color: "from-orange-500 to-amber-500" },
  { icon: <Clock className="w-6 h-6" />, title: "15-Minute Sessions", desc: "Focused 12-question interview sessions that fit your schedule.", color: "from-violet-500 to-purple-500" },
];

const STEPS = [
  { num: "01", title: "Create Account", desc: "Sign up with your college email in under a minute." },
  { num: "02", title: "Upload Resume", desc: "Upload your PDF resume for AI-powered JD matching." },
  { num: "03", title: "Pick a Role", desc: "Choose a job matching ≥70% to your resume profile." },
  { num: "04", title: "Start Interview", desc: "Answer 12 AI-generated questions in 15-20 minutes." },
  { num: "05", title: "Get Your Report", desc: "Download a detailed PDF report with your full evaluation." },
];

const STATS = [
  { value: "12", label: "Questions Per Session", icon: <Brain className="w-5 h-5" /> },
  { value: "15", label: "Minutes Duration", icon: <Clock className="w-5 h-5" /> },
  { value: "6+", label: "Job Roles Available", icon: <Users className="w-5 h-5" /> },
  { value: "AI", label: "Powered Evaluation", icon: <Star className="w-5 h-5" /> },
];

const FloatingOrb = ({ className }: { className: string }) => (
  <div className={`absolute rounded-full blur-3xl opacity-20 animate-pulse ${className}`} />
);

const Index = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  // Read auth state on every render — localStorage.getItem is synchronous and always fresh
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const isLoggedIn = !!token;

  // If already logged in, redirect immediately to correct dashboard
  useEffect(() => {
    if (isLoggedIn) {
      if (role === "officer") {
        navigate("/officer", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, []);

  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToResume = () => {
    resumeRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Don't render anything while redirecting
  if (isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      {/* ── HERO ─────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <FloatingOrb className="w-96 h-96 bg-primary top-20 -left-20" />
        <FloatingOrb className="w-80 h-80 bg-purple-500 bottom-20 -right-20" />
        <FloatingOrb className="w-64 h-64 bg-cyan-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px"
        }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-20">

          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Placement Preparation
            <Sparkles className="w-4 h-4" />
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-5xl md:text-7xl font-black text-foreground leading-tight mb-6">
            Crack Your
            <span className="block bg-gradient-to-r from-primary via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Dream Placement
            </span>
            With AI
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            PlacePrepAI runs real mock interviews tailored to your resume and target role.
            Get honest feedback, detailed scores, and a downloadable report — all in 15 minutes.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button onClick={() => navigate("/register")} size="lg"
              className="gap-2 text-base px-8 h-14 font-bold">
              Get Started Free <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => navigate("/login")} variant="outline" size="lg"
              className="text-base px-8 h-14">
              Sign In
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {STATS.map((s, i) => (
              <div key={i} className="flex flex-col items-center p-4 rounded-xl bg-card/50 border border-border backdrop-blur-sm">
                <div className="text-primary mb-1">{s.icon}</div>
                <div className="text-2xl font-black text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground text-center">{s.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="mt-12 flex flex-col items-center gap-2 text-muted-foreground cursor-pointer"
            onClick={scrollToResume}>
            <span className="text-xs">Scroll to learn more</span>
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-black text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground">Five simple steps from signup to your report</p>
          </motion.div>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors group">
                <div className="text-4xl font-black text-primary/20 group-hover:text-primary/40 transition-colors font-mono w-14 flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-primary/30 group-hover:text-primary transition-colors ml-auto flex-shrink-0 mt-1" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────── */}
      <section className="py-24 px-4 bg-card/30">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-black text-foreground mb-4">Everything You Need</h2>
            <p className="text-muted-foreground">Built specifically for placement season</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all group hover:shadow-lg hover:shadow-primary/5">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ───────────────────────── */}
      <section ref={resumeRef} className="py-24 px-4">
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
              <Upload className="w-4 h-4" /> Start Here
            </div>
            <h2 className="text-4xl font-black text-foreground mb-4">Ready to Practice?</h2>
            <p className="text-muted-foreground mb-8">
              Create your account, upload your resume, and get matched to job roles instantly.
              Only roles with ≥70% match are available to interview for.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/register")} size="lg"
                className="w-full h-14 text-base font-bold gap-2">
                Create Free Account <ChevronRight className="w-5 h-5" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => navigate("/login")}
                  className="text-primary underline font-medium hover:text-primary/80 transition-colors">
                  Sign in here
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">PlacePrepAI</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate("/about")} className="hover:text-foreground transition-colors">About Us</button>
            <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">Dashboard</button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">Login</button>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 PlacePrepAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
