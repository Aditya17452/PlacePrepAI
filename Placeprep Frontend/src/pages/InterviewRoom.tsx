import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Clock, Lightbulb, Camera, Send, Volume2, Mic, MicOff, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { endInterview } from "@/services/api";

const MAX_QUESTIONS = 12;
const MAX_WARNINGS = 3;
const LOOK_AWAY_THRESHOLD_MS = 5000; // 5 seconds
const AUTO_END_AFTER_MS = 10000;     // 10 seconds countdown after 3rd warning

interface Message { role: "ai" | "user"; text: string; }

// ── Girl voice TTS ──────────────────────────────────────────────────────
const speakWithGirlVoice = (text: string, onEnd?: () => void) => {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.90; utter.pitch = 1.2; utter.volume = 1.0;
  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = ["Google UK English Female","Microsoft Zira - English (United States)","Samantha","Karen","Moira","Tessa"];
    let chosen = null;
    for (const name of preferred) { chosen = voices.find(v => v.name === name); if (chosen) break; }
    if (!chosen) chosen = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira"));
    if (chosen) utter.voice = chosen;
  };
  if (window.speechSynthesis.getVoices().length > 0) pickVoice();
  else window.speechSynthesis.onvoiceschanged = pickVoice;
  if (onEnd) utter.onend = onEnd;
  utter.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utter);
};

// ── Warning overlay component ───────────────────────────────────────────
const WarningOverlay = ({
  warningCount, isFinalWarning, countdown, reason, onDismiss
}: {
  warningCount: number;
  isFinalWarning: boolean;
  countdown: number;
  reason: string;
  onDismiss: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.85, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.85, y: 20 }}
      className={`relative w-full max-w-md mx-4 p-8 rounded-2xl border-2 shadow-2xl text-center
        ${isFinalWarning
          ? "bg-red-950 border-red-500 shadow-red-500/20"
          : "bg-card border-yellow-500/60 shadow-yellow-500/10"}`}
    >
      {/* Warning icon */}
      <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
        ${isFinalWarning ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
        <AlertTriangle className={`w-8 h-8 ${isFinalWarning ? "text-red-400" : "text-yellow-400"}`} />
      </div>

      {/* Warning count badges */}
      <div className="flex justify-center gap-2 mb-4">
        {[1,2,3].map(i => (
          <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${i <= warningCount
              ? isFinalWarning ? "bg-red-500 text-white" : "bg-yellow-500 text-black"
              : "bg-muted text-muted-foreground"}`}>
            {i}
          </div>
        ))}
      </div>

      <h2 className={`text-xl font-black mb-2 ${isFinalWarning ? "text-red-400" : "text-yellow-400"}`}>
        {isFinalWarning ? "⚠️ Final Warning!" : `Warning ${warningCount} of ${MAX_WARNINGS}`}
      </h2>

      <p className="text-muted-foreground text-sm mb-2">{reason}</p>

      {isFinalWarning ? (
        <>
          <p className="text-red-300 text-sm font-medium mb-4">
            This is your last warning. The interview will end automatically if this happens again.
          </p>
          <div className="text-4xl font-black text-red-400 mb-4">{countdown}s</div>
          <p className="text-xs text-muted-foreground mb-6">Interview ends in {countdown} seconds unless you dismiss this</p>
        </>
      ) : (
        <p className="text-sm text-foreground/80 mb-6 mt-3">
          Please keep your attention on the screen during the interview.<br/>
          <span className="text-yellow-400 font-semibold">{MAX_WARNINGS - warningCount} warning(s) remaining</span> before the interview ends.
        </p>
      )}

      <Button
        onClick={onDismiss}
        className={`w-full font-bold ${isFinalWarning
          ? "bg-red-500 hover:bg-red-600 text-white"
          : "bg-yellow-500 hover:bg-yellow-600 text-black"}`}
      >
        I understand — continue interview
      </Button>
    </motion.div>
  </motion.div>
);

// ── Main component ──────────────────────────────────────────────────────
const InterviewRoom = () => {
  const navigate = useNavigate();

  // Existing state
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<{ tip: string; tone: string }[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [phase, setPhase] = useState("warmup");
  const [elapsed, setElapsed] = useState("00:00");
  const [postureTip, setPostureTip] = useState("");
  const [statusMsg, setStatusMsg] = useState("Connecting...");
  const [textInput, setTextInput] = useState("");
  const [greeted, setGreeted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ── Attention / body language state ─────────────────────────────────
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [isFinalWarning, setIsFinalWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [webcamActive, setWebcamActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceCheckRef = useRef<any>(null);
  const lookAwayTimerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const warningCountRef = useRef(0); // ref to avoid stale closure
  const sessionEndedRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const isProcessingRef = useRef(false);
  const timerRef = useRef<any>(null);
  const startRef = useRef<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sessionId = localStorage.getItem("session_id") || "";
  const openingQ = localStorage.getItem("opening_question") || "Tell me about yourself.";
  const role = localStorage.getItem("interview_role") || "Session";
  const studentName = localStorage.getItem("student_name") || "there";

  const greetingText = `Hello ${studentName}! Welcome to your PlacePrepAI mock interview for the ${role} position. I'm your AI interviewer today. Take a breath, relax, and answer clearly. Let's begin!`;

  const speak = (text: string, onEnd?: () => void) => {
    setIsSpeaking(true);
    speakWithGirlVoice(text, () => { setIsSpeaking(false); onEnd?.(); });
  };

  // ── TRIGGER WARNING ─────────────────────────────────────────────────
  const triggerWarning = useCallback((reason: string) => {
    if (sessionEndedRef.current || warningCountRef.current >= MAX_WARNINGS) return;

    const newCount = warningCountRef.current + 1;
    warningCountRef.current = newCount;
    setWarningCount(newCount);
    setWarningReason(reason);

    const isFinal = newCount >= MAX_WARNINGS;
    setIsFinalWarning(isFinal);
    setShowWarning(true);

    // Stop mic + TTS during warning
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    setIsListening(false);

    // Speak warning aloud
    const warningMsg = isFinal
      ? `Warning ${newCount}. This is your final warning. Please look at the screen. The interview will end in 10 seconds if you dismiss and look away again.`
      : `Warning ${newCount} of ${MAX_WARNINGS}. ${reason}. Please keep your attention on the interview.`;
    speakWithGirlVoice(warningMsg);

    if (isFinal) {
      // Start countdown
      let secs = 10;
      setCountdown(secs);
      countdownRef.current = setInterval(() => {
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) {
          clearInterval(countdownRef.current);
          handleAutoEnd(true);
        }
      }, 1000);
    }
  }, []);

  // ── DISMISS WARNING ─────────────────────────────────────────────────
  const dismissWarning = () => {
    clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(10);
    // Resume interview
    setTimeout(() => textareaRef.current?.focus(), 200);
  };

  // ── AUTO END ────────────────────────────────────────────────────────
  const handleAutoEnd = useCallback((fromWarning = false) => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setShowWarning(false);
    clearInterval(countdownRef.current);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();

    const msg = fromWarning
      ? `The interview has ended due to repeated inattention. Your report will be generated based on answers provided so far.`
      : `Thank you ${studentName}! That's all 12 questions. Your report is being prepared. Well done!`;

    setStatusMsg(fromWarning ? "⚠️ Interview ended — attention violations" : "✅ Interview complete! Generating report...");

    speak(msg, () => {
      setTimeout(async () => {
        wsRef.current?.close();
        stopWebcam();
        try { await endInterview(sessionId); } catch (e) { }
        navigate(`/report?session=${sessionId}`);
      }, 800);
    });
  }, []);

  // ── WEBCAM SETUP ────────────────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setWebcamActive(true);
      startFaceDetection();
    } catch (e) {
      console.log("Webcam not available — tab detection only");
      setWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    clearInterval(faceCheckRef.current);
    clearTimeout(lookAwayTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
  };

  // ── FACE DETECTION (skin pixel heuristic — no external library) ─────
  const startFaceDetection = () => {
    faceCheckRef.current = setInterval(() => {
      if (sessionEndedRef.current || showWarning) return;
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState < 2) return;

      canvas.width = 80; canvas.height = 60;
      ctx.drawImage(video, 0, 0, 80, 60);

      const imageData = ctx.getImageData(0, 0, 80, 60).data;
      let skinPixels = 0;
      const totalPixels = 80 * 60;

      // Skin tone detection — counts pixels in typical skin color range
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i], g = imageData[i+1], b = imageData[i+2];
        if (r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / totalPixels;
      const facePresent = skinRatio > 0.04; // at least 4% skin pixels = face present

      setFaceDetected(facePresent);

      if (!facePresent) {
        // Start look-away timer
        if (!lookAwayTimerRef.current) {
          lookAwayTimerRef.current = setTimeout(() => {
            lookAwayTimerRef.current = null;
            if (!sessionEndedRef.current && !showWarning) {
              triggerWarning("You looked away from the screen for more than 5 seconds.");
            }
          }, LOOK_AWAY_THRESHOLD_MS);
        }
      } else {
        // Face back — cancel look-away timer
        if (lookAwayTimerRef.current) {
          clearTimeout(lookAwayTimerRef.current);
          lookAwayTimerRef.current = null;
        }
      }
    }, 800); // check every 800ms
  };

  // ── TAB VISIBILITY DETECTION ────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !sessionEndedRef.current && greeted) {
        triggerWarning("You switched tabs or minimized the window during the interview.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [greeted, triggerWarning]);

  // ── VOICE INPUT SETUP ───────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        let interim = "", final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t; else interim += t;
        }
        setTextInput(final || interim);
      };
      recognition.onend = () => { setIsListening(false); setTimeout(() => textareaRef.current?.focus(), 100); };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === "not-allowed") setStatusMsg("⚠️ Mic denied. Allow mic in browser settings.");
        else if (event.error !== "aborted") setStatusMsg("⚠️ Voice error. Use text input instead.");
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else {
      window.speechSynthesis?.cancel(); setIsSpeaking(false); setTextInput("");
      try { recognitionRef.current.start(); setIsListening(true); setStatusMsg("🎤 Listening... speak your answer"); }
      catch (e) { setStatusMsg("⚠️ Could not start microphone."); }
    }
  };

  // ── QUESTION LIMIT CHECK ────────────────────────────────────────────
  useEffect(() => {
    if (questionsAsked >= MAX_QUESTIONS && !sessionEnded) handleAutoEnd();
  }, [questionsAsked]);

  // ── MAIN INIT ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { navigate("/dashboard"); return; }
    initWebSocket();
    startTimer();
    startWebcam(); // Start webcam — falls back gracefully if denied

    setMessages([{ role: "ai", text: greetingText }]);
    setTimeout(() => {
      speak(greetingText, () => {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: "ai", text: openingQ }]);
          speak(openingQ, () => {
            setStatusMsg("✏️ Type or 🎤 speak your answer, then press Enter");
            setTimeout(() => textareaRef.current?.focus(), 200);
          });
          setGreeted(true);
        }, 600);
      });
    }, 800);

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      wsRef.current?.close();
      stopWebcam();
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      clearTimeout(lookAwayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const startTimer = () => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    }, 1000);
  };

  const initWebSocket = () => {
    const ws = new WebSocket(`ws://localhost:8000/ws/interview/${sessionId}`);
    ws.onopen = () => { setIsConnected(true); setStatusMsg("Connected! Listen to the greeting then answer."); };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "next_question") {
          isProcessingRef.current = false; setIsProcessing(false); setTextInput("");
          setQuestionsAsked(data.questions_asked || 0);
          setPhase(data.phase || "technical");
          setMessages(prev => [...prev, { role: "ai", text: data.question }]);
          setStatusMsg("🔊 AI is speaking...");
          speak(data.question, () => {
            setStatusMsg("✏️ Type or 🎤 speak your answer, then press Enter");
            setTimeout(() => textareaRef.current?.focus(), 200);
          });
          if (data.feedback) setFeedback(prev => [data.feedback, ...prev].slice(0, 5));
        }
        if (data.type === "posture_warning") { setPostureTip(data.message); setTimeout(() => setPostureTip(""), 6000); }
        if (data.type === "session_complete") { if (!sessionEndedRef.current) handleAutoEnd(); }
        if (data.type === "error") setStatusMsg("❌ " + data.message);
      } catch (err) { console.error("WS parse:", err); }
    };
    ws.onclose = (e) => { setIsConnected(false); if (e.code !== 1000) setStatusMsg("⚠️ Connection lost. Refresh."); };
    ws.onerror = () => setStatusMsg("❌ Backend not reachable on port 8000.");
    wsRef.current = ws;
  };

  const handleSubmit = () => {
    if (sessionEnded || showWarning) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setStatusMsg("⚠️ Not connected. Refresh."); return; }
    const answer = textInput.trim();
    if (!answer) { textareaRef.current?.focus(); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    setMessages(prev => [...prev, { role: "user", text: answer }]);
    setTextInput("");
    isProcessingRef.current = true; setIsProcessing(true); setStatusMsg("⏳ AI is thinking...");
    window.speechSynthesis?.cancel();
    wsRef.current.send(JSON.stringify({ type: "turn_complete", transcript: answer, audio: null }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleEndInterview = async () => {
    if (confirm("End interview early? Report will be generated with answers so far.")) {
      sessionEndedRef.current = true; setSessionEnded(true);
      recognitionRef.current?.stop(); window.speechSynthesis?.cancel();
      wsRef.current?.close(); stopWebcam();
      clearInterval(countdownRef.current);
      try { await endInterview(sessionId); } catch (e) { }
      navigate(`/report?session=${sessionId}`);
    }
  };

  const phaseColor = phase === "warmup" ? "text-warning" : phase === "technical" ? "text-primary" : "text-success";
  const canUseMic = !isProcessing && !isSpeaking && isConnected && greeted && !sessionEnded && !showWarning && voiceSupported;
  const canSubmit = !isProcessing && !isSpeaking && isConnected && textInput.trim().length > 0 && greeted && !sessionEnded && !showWarning;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Warning Overlay ── */}
      <AnimatePresence>
        {showWarning && (
          <WarningOverlay
            warningCount={warningCount}
            isFinalWarning={isFinalWarning}
            countdown={countdown}
            reason={warningReason}
            onDismiss={dismissWarning}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="mt-16 flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground text-sm">{role}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full bg-primary/10 font-semibold ${phaseColor}`}>{phase}</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> {elapsed}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Warning count indicator */}
          {warningCount > 0 && (
            <div className="flex items-center gap-1">
              {[1,2,3].map(i => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full ${
                  i <= warningCount ? "bg-yellow-500" : "bg-muted"
                }`} />
              ))}
              <span className="text-xs text-yellow-500 ml-1 font-medium">{warningCount}/{MAX_WARNINGS}</span>
            </div>
          )}
          {/* Face detection indicator */}
          {webcamActive && (
            <div className={`flex items-center gap-1 text-xs ${faceDetected ? "text-green-400" : "text-red-400"}`}>
              {faceDetected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{faceDetected ? "Focused" : "Look here"}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground font-mono">Q {questionsAsked}/{MAX_QUESTIONS}</span>
          <Progress value={(questionsAsked / MAX_QUESTIONS) * 100} className="w-24 h-2" />
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
          {!sessionEnded && (
            <Button variant="destructive" size="sm" onClick={handleEndInterview}>
              <Phone className="w-3 h-3 mr-1" /> End
            </Button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className={`px-6 py-2 text-xs text-center font-medium border-b border-border transition-all
        ${isListening ? "bg-red-500/10 text-red-400"
          : isProcessing ? "bg-primary/10 text-primary"
          : isSpeaking ? "bg-purple-500/10 text-purple-400"
          : "bg-green-500/10 text-green-400"}`}>
        {isListening ? "🎤 " : isProcessing ? "⏳ " : isSpeaking ? "🔊 " : "✏️ "}{statusMsg}
      </div>

      <AnimatePresence>
        {postureTip && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-auto mt-2 px-5 py-2.5 rounded-xl bg-warning/15 border border-warning/30 text-sm z-40">
            💡 {postureTip}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden">
        <div className="flex flex-col overflow-hidden border-r border-border">

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl max-w-[85%] ${msg.role === "ai"
                  ? "bg-primary/10 border border-primary/20 mr-auto"
                  : "bg-card border border-border ml-auto"}`}>
                <p className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${msg.role === "ai" ? "text-primary" : "text-muted-foreground"}`}>
                  {msg.role === "ai" ? <><Volume2 className="w-3 h-3" /> AI Interviewer</> : "👤 You"}
                </p>
                <p className="text-sm leading-relaxed text-foreground">{msg.text}</p>
              </motion.div>
            ))}
            {isSpeaking && !isProcessing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-3 rounded-xl bg-purple-500/8 border border-purple-500/20 mr-auto max-w-[180px]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 items-end">
                    {[8,14,10,16,8].map((h,i) => (
                      <div key={i} className="w-1 bg-purple-400 rounded-full animate-bounce"
                        style={{height:`${h}px`,animationDelay:`${i*0.1}s`}} />
                    ))}
                  </div>
                  <p className="text-xs text-purple-400 font-medium">Speaking...</p>
                </div>
              </motion.div>
            )}
            {isListening && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mr-auto max-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 items-end">
                    {[6,12,8,14,6].map((h,i) => (
                      <div key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                        style={{height:`${h}px`,animationDelay:`${i*0.12}s`}} />
                    ))}
                  </div>
                  <p className="text-xs text-red-400 font-medium">Listening...</p>
                </div>
              </motion.div>
            )}
            {isProcessing && !isSpeaking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-primary/5 border border-primary/10 mr-auto max-w-[220px]">
                <p className="text-xs text-primary mb-2">AI is thinking...</p>
                <div className="flex gap-1.5">
                  {[0,0.2,0.4].map((d,i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay:`${d}s`}} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-border bg-card">
            {sessionEnded ? (
              <div className="text-center py-4 text-green-400 font-medium text-sm">
                ✅ Interview complete — redirecting to your report...
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing || !greeted || sessionEnded || showWarning}
                    placeholder={
                      showWarning ? "Dismiss the warning to continue..."
                        : !greeted ? "Wait for greeting..."
                        : isProcessing ? "Processing..."
                        : isListening ? "Listening — speak now..."
                        : isSpeaking ? "Wait for AI..."
                        : "Type or speak your answer... (Enter to submit)"
                    }
                    rows={3}
                    className={`w-full px-4 py-3 text-sm bg-background border rounded-xl resize-none
                      focus:outline-none focus:ring-2 transition-all text-foreground placeholder:text-muted-foreground
                      ${isListening ? "border-red-500/50 focus:ring-red-500/20"
                        : isProcessing || !greeted || showWarning ? "border-border opacity-50 cursor-not-allowed focus:ring-0"
                        : "border-primary/30 hover:border-primary/60 focus:ring-primary/40"}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1 ml-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Enter</kbd> to submit ·{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Shift+Enter</kbd> new line
                    {voiceSupported && <span className="ml-2">· 🎤 mic to speak</span>}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {voiceSupported && (
                    <button onClick={toggleMic} disabled={!canUseMic} title={isListening ? "Stop" : "Speak"}
                      className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all
                        ${isListening ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse"
                          : canUseMic ? "bg-secondary hover:bg-secondary/80 border border-border"
                          : "bg-muted opacity-40 cursor-not-allowed"}`}>
                      {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className={`w-4 h-4 ${canUseMic ? "text-foreground" : "text-muted-foreground"}`} />}
                    </button>
                  )}
                  <button onClick={handleSubmit} disabled={!canSubmit}
                    className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all
                      ${canSubmit ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
                        : "bg-muted cursor-not-allowed opacity-40"}`}>
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
            {!isConnected && !sessionEnded && (
              <p className="text-center text-xs text-red-400 mt-2">⚠️ Not connected — make sure backend is running on port 8000.</p>
            )}
          </div>
        </div>

        {/* Right coaching panel */}
        <div className="hidden lg:flex flex-col">
          <div className="px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" /> Live Coaching
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Live webcam feed */}
            <div className="rounded-xl bg-muted/10 border border-border overflow-hidden relative h-36">
              {webcamActive ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Face status badge */}
                  <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium
                    ${faceDetected ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"}`}>
                    {faceDetected ? "👁 Focused" : "⚠️ Look here"}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground/50">Camera not active</p>
                  </div>
                </div>
              )}
            </div>

            {/* Warning status */}
            {warningCount > 0 && (
              <div className={`p-3 rounded-xl border text-xs ${
                warningCount >= MAX_WARNINGS
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-bold">Attention Warnings: {warningCount}/{MAX_WARNINGS}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {MAX_WARNINGS - warningCount > 0
                    ? `${MAX_WARNINGS - warningCount} warning(s) before interview ends`
                    : "Final warning issued"}
                </p>
              </div>
            )}

            {feedback.length === 0
              ? <p className="text-xs text-muted-foreground text-center mt-2">Tips appear every 3rd answer</p>
              : feedback.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-xl border text-xs ${f.tone === "positive"
                    ? "bg-green-500/10 border-green-500/20 text-green-300"
                    : "bg-warning/10 border-warning/20 text-warning"}`}>
                  {f.tone === "positive" ? "✅ " : "💡 "}{f.tip}
                </motion.div>
              ))
            }
            <div className="mt-2 space-y-2">
              {["Use STAR method for behavioral answers","Be specific — mention tools & metrics",
                "Think 3 seconds before answering","Show enthusiasm for the role"]
                .map((tip, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
                    {i+1}. {tip}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;
