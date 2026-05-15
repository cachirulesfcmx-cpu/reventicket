import { useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("admin@reventicket.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/jwt-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Credenciales inválidas");
      }

      if (data.user?.role !== "admin") {
        throw new Error("No tienes permisos de administrador");
      }

      // Store JWT in localStorage
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.user));

      setLocation("/portal-admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0a0a",
    border: "1px solid #2a2a2a", borderRadius: 12,
    padding: "13px 16px", color: "#fff", fontSize: 15,
    fontFamily: "Inter, sans-serif", outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif", color: "#fff",
      backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #166534, #15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(34,197,94,0.3)",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, color: "#555", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            RevenTicket
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20, padding: "36px 32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 6, letterSpacing: "-0.02em" }}>
            Panel de administración
          </h1>
          <p style={{ fontSize: 13, color: "#555", textAlign: "center", marginBottom: 28, lineHeight: 1.5 }}>
            Acceso restringido — personal autorizado únicamente
          </p>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, padding: "11px 14px", marginBottom: 18,
              fontSize: 13, color: "#fca5a5", textAlign: "center", lineHeight: 1.4,
            }}>
              🔒 {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                fontSize: 11, color: "#666", display: "block",
                marginBottom: 6, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                Correo electrónico
              </label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                style={inp}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                fontSize: 11, color: "#666", display: "block",
                marginBottom: 6, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                Contraseña
              </label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password"
                placeholder="••••••••••••"
                style={inp}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: loading || !password
                  ? "#1a2a1a"
                  : "linear-gradient(135deg, #16a34a, #15803d)",
                color: loading || !password ? "#4a6a4a" : "#fff",
                fontWeight: 800, fontSize: 15,
                boxShadow: loading || !password ? "none" : "0 4px 20px rgba(34,197,94,0.3)",
                transition: "all 0.2s",
                letterSpacing: "-0.01em",
              }}
            >
              {loading ? "Verificando..." : "Ingresar al panel"}
            </button>
          </form>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 20, justifyContent: "center",
            fontSize: 11, color: "#333",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Conexión segura · JWT Authentication
          </div>
        </div>
      </div>
    </div>
  );
}
