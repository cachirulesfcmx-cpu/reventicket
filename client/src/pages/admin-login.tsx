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
      const res = await fetch("https://reventicket-production.up.railway.app/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Credenciales inválidas");
      }

      if (data.role !== "admin") {
        throw new Error("No tienes permisos de administrador");
      }

      // Store session info in localStorage
      localStorage.setItem("admin_user", JSON.stringify(data));
      localStorage.setItem("admin_logged_in", "true");

      setLocation("/portal-admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif", color: "#fff",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: "20px",
          padding: "40px 32px",
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: "16px",
            background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>
            Admin Portal
          </h1>
          <p style={{ fontSize: 13, color: "#666", textAlign: "center", marginBottom: 28 }}>
            Acceso restringido únicamente para personal autorizado.
          </p>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: "#f87171", textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Usuario Admin
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: "100%", background: "#0a0a0a", border: "1px solid #282828",
                  borderRadius: 10, padding: "11px 14px", color: "#fff",
                  fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                onKeyDown={e => e.key === "Enter" && handleLogin(e as any)}
                style={{
                  width: "100%", background: "#0a0a0a", border: "1px solid #282828",
                  borderRadius: 10, padding: "11px 14px", color: "#fff",
                  fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 14, borderRadius: 12,
                background: loading ? "#1a4a2a" : "#22c55e",
                color: loading ? "#4ade80" : "#000",
                fontWeight: 800, fontSize: 15, border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(34,197,94,0.25)",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Verificando..." : "Ingresar al Panel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
