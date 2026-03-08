import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import InterviewRoom from "./pages/InterviewRoom";
import Report from "./pages/Report";
import OfficerDashboard from "./pages/OfficerDashboard";
import NotFound from "./pages/NotFound";
import PreInterview from "./pages/PreInterview";
import About from "./pages/About";
import OfficerCredits from "./pages/OfficerCredits";
import ChatBot from "./components/ChatBot";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/"                element={<Index />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/dashboard"       element={<Dashboard />} />
          <Route path="/interview"       element={<InterviewRoom />} />
          <Route path="/pre-interview"   element={<PreInterview />} />
          <Route path="/report"          element={<Report />} />
          <Route path="/officer"         element={<OfficerDashboard />} />
          <Route path="/officer/credits" element={<OfficerCredits />} />
          <Route path="/about"           element={<About />} />
          <Route path="*"                element={<NotFound />} />
        </Routes>
        <ChatBot />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;