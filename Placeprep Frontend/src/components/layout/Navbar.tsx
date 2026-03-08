import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Menu, X, LogOut, LayoutDashboard, CreditCard } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logout } from "@/services/api";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Always read fresh from localStorage on every render
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const name = localStorage.getItem("student_name") || localStorage.getItem("name") || "";
  const isLoggedIn = !!token;
  const isOfficer = role === "officer";

  const handleLogout = () => {
    logout(); // clears localStorage and redirects to /
  };

  const navLinks = isLoggedIn
    ? isOfficer
      ? [
          { label: "Officer Panel", href: "/officer" },
          { label: "Credits", href: "/officer/credits" },
          { label: "About", href: "/about" },
        ]
      : [
          { label: "Dashboard", href: "/dashboard" },
          { label: "About", href: "/about" },
        ]
    : [
        { label: "How It Works", href: "/#how-it-works" },
        { label: "About", href: "/about" },
      ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">PlacePrep AI</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                location.pathname === link.href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop right buttons */}
        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <>
              {/* User name badge */}
              {name && (
                <span className="text-sm text-muted-foreground px-2">
                  👋 {name.split(" ")[0]}
                </span>
              )}
              {/* Dashboard shortcut */}
              <Button variant="ghost" size="sm" className="gap-1.5"
                onClick={() => navigate(isOfficer ? "/officer" : "/dashboard")}>
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              {/* Credits shortcut for officer */}
              {isOfficer && (
                <Button variant="ghost" size="sm" className="gap-1.5"
                  onClick={() => navigate("/officer/credits")}>
                  <CreditCard className="w-4 h-4" />
                  Credits
                </Button>
              )}
              {/* Logout */}
              <Button variant="outline" size="sm" className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10"
                onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                Sign In
              </Button>
              <Button size="sm" className="font-semibold" onClick={() => navigate("/register")}>
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary">
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border">
                {isLoggedIn ? (
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-red-400"
                    onClick={() => { setMobileOpen(false); handleLogout(); }}>
                    <LogOut className="w-4 h-4" /> Logout
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="flex-1"
                      onClick={() => { setMobileOpen(false); navigate("/login"); }}>
                      Sign In
                    </Button>
                    <Button size="sm" className="flex-1"
                      onClick={() => { setMobileOpen(false); navigate("/register"); }}>
                      Get Started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
