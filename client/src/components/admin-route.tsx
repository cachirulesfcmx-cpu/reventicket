import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check localStorage first (fast, no network)
    const stored = localStorage.getItem("admin_logged_in");
    const user = localStorage.getItem("admin_user");
    
    if (stored === "true" && user) {
      try {
        const parsed = JSON.parse(user);
        if (parsed.role === "admin") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // Fallback: verify with server
    fetch("https://reventicket-production.up.railway.app/api/auth/me", {
      credentials: "include",
    })
      .then(res => res.ok ? res.json() : null)
      .then(user => {
        if (user?.role === "admin") {
          localStorage.setItem("admin_logged_in", "true");
          localStorage.setItem("admin_user", JSON.stringify(user));
          setIsAdmin(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 32, height: 32, color: "#22c55e", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/portal-admin/login" />;
  }

  return <>{children}</>;
}
