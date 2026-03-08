import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Mail, Lock, User, Hash, BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { register } from "@/services/api";

const BRANCHES = ["CSE", "AIML", "IT", "ECE", "EEE", "ME", "CE", "Other"];

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    cgpa: "", branch: "AIML"
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all required fields."); return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    const cgpa = parseFloat(form.cgpa);
    if (form.cgpa && (isNaN(cgpa) || cgpa < 0 || cgpa > 10)) {
      setError("CGPA must be between 0 and 10."); return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: "student",
        cgpa: cgpa || 7.0,
        branch: form.branch,
      });
      if (data.role === "officer") {
        navigate("/officer", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute w-96 h-96 bg-primary rounded-full blur-3xl opacity-10 top-10 -left-20 animate-pulse" />
      <div className="absolute w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-10 bottom-10 -right-20 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-foreground">PlacePrepAI</span>
          </Link>
          <h1 className="text-3xl font-black text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground text-sm">Start your placement preparation journey</p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl bg-card border border-border shadow-xl">
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
              {error}
            </motion.div>
          )}

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                onKeyDown={handleKey} placeholder="Aditya Kumar"
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                onKeyDown={handleKey} placeholder="your@college.edu"
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            </div>
          </div>

          {/* Branch + CGPA side by side */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select value={form.branch} onChange={e => set("branch", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors appearance-none">
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">CGPA</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="number" min="0" max="10" step="0.1"
                  value={form.cgpa} onChange={e => set("cgpa", e.target.value)}
                  onKeyDown={handleKey} placeholder="8.5"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type={showPass ? "text" : "password"}
                value={form.password} onChange={e => set("password", e.target.value)}
                onKeyDown={handleKey} placeholder="Min 6 characters"
                className="w-full pl-9 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password"
                value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)}
                onKeyDown={handleKey} placeholder="••••••••"
                className={`w-full pl-9 pr-4 py-2.5 bg-background border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-border focus:border-primary"
                }`} />
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-red-400 mt-1 ml-1">Passwords do not match</p>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full h-11 font-bold text-base gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
