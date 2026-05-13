import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Settings {
  clipApiKey: string;
  clipSecretKey: string;
  clipEnabled: boolean;
  metaPixelId: string;
  metaEnabled: boolean;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  googleAdsId: string;
  googleEnabled: boolean;
  whatsappPhone: string;
  siteName: string;
  supportEmail: string;
  commissionPercent: number;
}

const EMPTY: Settings = {
  clipApiKey: "", clipSecretKey: "", clipEnabled: false,
  metaPixelId: "", metaEnabled: false,
  googleAnalyticsId: "", googleTagManagerId: "", googleAdsId: "", googleEnabled: false,
  whatsappPhone: "", siteName: "RevenTicket",
  supportEmail: "soporte@reventicket.com.mx", commissionPercent: 15,
};

const s = {
  page: { background: "#0d0d0d", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif" },
  header: { padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e", paddingBottom: "16px" },
  title: { fontSize: "20px", fontWeight: 800 },
  back: { color: "#888", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none" },
  section: { background: "#111", border: "1px solid #1e1e1e", borderRadius: "16px", padding: "20px", marginBottom: "12px" },
  sHead: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" },
  sIcon: (color: string) => ({ width: 36, height: 36, borderRadius: "10px", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as React.CSSProperties),
  sTitle: { fontSize: "15px", fontWeight: 700 },
  sSub: { fontSize: "12px", color: "#666", marginTop: "2px" },
  toggle: (on: boolean) => ({
    width: 44, height: 24, borderRadius: "12px", border: "none", cursor: "pointer", padding: "2px",
    background: on ? "#22c55e" : "#333", transition: "background 0.2s", display: "flex", alignItems: "center",
  } as React.CSSProperties),
  toggleDot: (on: boolean) => ({
    width: 20, height: 20, borderRadius: "50%", background: "#fff",
    transform: on ? "translateX(20px)" : "translateX(0)", transition: "transform 0.2s",
  } as React.CSSProperties),
  row: { marginBottom: "12px" },
  label: { fontSize: "11px", color: "#666", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: "5px" },
  input: { width: "100%", background: "#0a0a0a", border: "1px solid #282828", borderRadius: "10px", padding: "10px 12px", color: "#fff", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none" } as React.CSSProperties,
  hint: { fontSize: "11px", color: "#555", marginTop: "4px", display: "block" },
  saveBtn: { width: "100%", padding: "14px", borderRadius: "12px", background: "#22c55e", color: "#000", fontWeight: 800, fontSize: "15px", border: "none", cursor: "pointer", marginTop: "8px", boxShadow: "0 4px 20px rgba(34,197,94,0.25)" } as React.CSSProperties,
  badge: (on: boolean) => ({ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: on ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", color: on ? "#4ade80" : "#555" } as React.CSSProperties),
};

function Field({ label, value, onChange, type = "text", hint, placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; hint?: string; placeholder?: string }) {
  return (
    <div style={s.row}>
      <label style={s.label}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""} style={s.input} />
      {hint && <span style={s.hint}>{hint}</span>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
      <span style={{ fontSize: "14px", fontWeight: 600 }}>{label}</span>
      <button onClick={() => onChange(!checked)} style={s.toggle(checked)}>
        <div style={s.toggleDot(checked)} />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const [, navigate] = useLocation();
  const [cfg, setCfg] = useState<Settings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => { setCfg({ ...EMPTY, ...data }); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const set = (key: keyof Settings) => (val: string | boolean | number) => setCfg(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      if (!res.ok) throw new Error("Error guardando");
      toast.success("✅ Ajustes guardados correctamente");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#555" }}>Cargando ajustes...</div></div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>⚙️ Ajustes avanzados</div>
          <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>Configuración de pagos, analytics y sistema</div>
        </div>
        <button onClick={() => navigate("/portal-admin/dashboard")} style={s.back}>
          ← Volver al panel
        </button>
      </div>

      <div style={{ padding: "20px 24px 80px" }}>

        {/* ── CLIP.MX ── */}
        <div style={s.section}>
          <div style={s.sHead}>
            <div style={s.sIcon("rgba(34,197,94,0.15)")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div>
              <div style={s.sTitle}>Clip.mx — Pasarela de pagos</div>
              <div style={s.sSub}>Tarjeta, OXXO Pay y SPEI · <span style={s.badge(cfg.clipEnabled)}>{cfg.clipEnabled ? "Activo" : "Inactivo"}</span></div>
            </div>
          </div>
          <Toggle label="Habilitar pagos con Clip" checked={cfg.clipEnabled} onChange={set("clipEnabled")} />
          <Field label="API Key de Clip" value={cfg.clipApiKey} onChange={set("clipApiKey")} type="password" placeholder="clip_key_..." hint="Obtenla en dashboard.clip.mx → Desarrolladores → API Keys" />
          <Field label="Secret Key de Clip (webhooks)" value={cfg.clipSecretKey} onChange={set("clipSecretKey")} type="password" placeholder="clip_secret_..." hint="Usada para verificar pagos automáticos de OXXO y SPEI" />
          <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", color: "#4ade80", marginTop: "4px" }}>
            📌 Webhook URL: <strong>https://reventicket-production.up.railway.app/api/payments/webhook/clip</strong>
          </div>
        </div>

        {/* ── META ADS ── */}
        <div style={s.section}>
          <div style={s.sHead}>
            <div style={s.sIcon("rgba(59,130,246,0.15)")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#60a5fa"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </div>
            <div>
              <div style={s.sTitle}>Meta Ads (Facebook & Instagram)</div>
              <div style={s.sSub}>Meta Pixel para remarketing y conversiones · <span style={s.badge(cfg.metaEnabled)}>{cfg.metaEnabled ? "Activo" : "Inactivo"}</span></div>
            </div>
          </div>
          <Toggle label="Habilitar Meta Pixel" checked={cfg.metaEnabled} onChange={set("metaEnabled")} />
          <Field label="Meta Pixel ID" value={cfg.metaPixelId} onChange={set("metaPixelId")} placeholder="123456789012345" hint="Ve a business.facebook.com → Events Manager → tu Pixel → ID" />
        </div>

        {/* ── GOOGLE ── */}
        <div style={s.section}>
          <div style={s.sHead}>
            <div style={s.sIcon("rgba(234,179,8,0.15)")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <div>
              <div style={s.sTitle}>Google Analytics & Ads</div>
              <div style={s.sSub}>GA4, Tag Manager y Google Ads · <span style={s.badge(cfg.googleEnabled)}>{cfg.googleEnabled ? "Activo" : "Inactivo"}</span></div>
            </div>
          </div>
          <Toggle label="Habilitar Google Analytics/Ads" checked={cfg.googleEnabled} onChange={set("googleEnabled")} />
          <Field label="Google Analytics 4 (GA4)" value={cfg.googleAnalyticsId} onChange={set("googleAnalyticsId")} placeholder="G-XXXXXXXXXX" hint="analytics.google.com → tu propiedad → ID de medición" />
          <Field label="Google Tag Manager" value={cfg.googleTagManagerId} onChange={set("googleTagManagerId")} placeholder="GTM-XXXXXXX" hint="tagmanager.google.com → tu contenedor → ID" />
          <Field label="Google Ads — ID de conversión" value={cfg.googleAdsId} onChange={set("googleAdsId")} placeholder="AW-XXXXXXXXXX" hint="ads.google.com → Herramientas → Conversiones → ID" />
        </div>

        {/* ── WHATSAPP ── */}
        <div style={s.section}>
          <div style={s.sHead}>
            <div style={s.sIcon("rgba(37,211,102,0.15)")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div>
              <div style={s.sTitle}>WhatsApp Bot</div>
              <div style={s.sSub}>Número de negocio y configuración</div>
            </div>
          </div>
          <Field label="Número de WhatsApp de negocio" value={cfg.whatsappPhone} onChange={set("whatsappPhone")} placeholder="+52 55 1234 5678" hint="El número que usará el bot para enviar OTPs y boletos" />
        </div>

        {/* ── GENERAL ── */}
        <div style={s.section}>
          <div style={s.sHead}>
            <div style={s.sIcon("rgba(168,85,247,0.15)")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            </div>
            <div>
              <div style={s.sTitle}>Configuración general</div>
              <div style={s.sSub}>Nombre del sitio, comisiones y contacto</div>
            </div>
          </div>
          <Field label="Nombre del sitio" value={cfg.siteName} onChange={set("siteName")} placeholder="RevenTicket" />
          <Field label="Email de soporte" value={cfg.supportEmail} onChange={set("supportEmail")} type="email" placeholder="soporte@reventicket.com.mx" />
          <div style={s.row}>
            <label style={s.label}>Comisión de venta (%)</label>
            <input type="number" min={0} max={50} value={cfg.commissionPercent} onChange={e => set("commissionPercent")(e.target.value)} style={s.input} />
            <span style={s.hint}>Porcentaje que RevenTicket cobra al vendedor por cada boleto vendido</span>
          </div>
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving} style={s.saveBtn}>
          {saving ? "Guardando..." : "💾 Guardar todos los ajustes"}
        </button>

        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#444" }}>
          Los cambios se aplican inmediatamente al guardar
        </div>
      </div>
    </div>
  );
}
