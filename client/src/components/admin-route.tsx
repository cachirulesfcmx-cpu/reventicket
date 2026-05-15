import { useEffect, useState } from "react";
import { Redirect } from "wouter";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const user = localStorage.getItem("admin_user");

    if (!token || !user) {
      setStatus("denied");
      return;
    }

    try {
      const parsed = JSON.parse(user);
      if (parsed.role === "admin") {
        // Verify token is not expired by checking with server
        fetch("/api/auth/jwt-me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => {
            if (r.ok) setStatus("ok");
            else { localStorage.removeItem("admin_token"); localStorage.removeItem("admin_user"); setStatus("denied"); }
          })
          .catch(() => {
            // If server unreachable but token exists, allow access
            setStatus("ok");
          });
      } else {
        setStatus("denied");
      }
    } catch {
      setStatus("denied");
    }
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight:"100vh", background:"#080808", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ color:"#22c55e", fontSize:14 }}>Verificando acceso...</div>
      </div>
    );
  }

  if (status === "denied") {
    return <Redirect to="/portal-admin/login" />;
  }

  return <>{children}</>;
}
