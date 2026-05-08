import { useLocation } from "wouter";

const items = [
  {
    id: "home", label: "Inicio", href: "/",
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? "#3ddc84" : "none"} stroke={active ? "#3ddc84" : "#666"} strokeWidth="1.7" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke={active ? "#000" : "#666"} strokeWidth="1.7"/>
      </svg>
    ),
  },
  {
    id: "search", label: "Buscar", href: "/search",
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? "#3ddc84" : "#666"} strokeWidth="1.7">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: "wallet", label: "Mis compras", href: "/wallet",
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? "#3ddc84" : "#666"} strokeWidth="1.7" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="10" rx="2"/>
        <line x1="12" y1="7" x2="12" y2="17" strokeDasharray="2 1.5" strokeWidth="1.2"/>
        <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      </svg>
    ),
  },
  {
    id: "sell", label: "Vender", href: "/sell",
    icon: (active: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? "#3ddc84" : "#666"} strokeWidth="1.7" strokeLinejoin="round">
        <rect x="6" y="3" width="13" height="9" rx="1.5"/>
        <line x1="10" y1="3" x2="10" y2="12" strokeDasharray="2 1.5" strokeWidth="1.2"/>
        <path d="M3 15c0-1.1.9-2 2-2h3l2-1h5l1 1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z"/>
      </svg>
    ),
  },
];

const nav: React.CSSProperties = {
  position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
  width: "100%", maxWidth: 430, zIndex: 50,
  background: "rgba(22,22,28,.72)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  borderTop: "1px solid rgba(255,255,255,.07)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 -8px 32px rgba(0,0,0,.4)",
  display: "flex", alignItems: "center", justifyContent: "space-around",
  padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
  minHeight: "var(--nav-h, 72px)",
};

export default function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav style={nav}>
      {items.map(item => {
        const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
        return (
          <div
            key={item.id}
            onClick={() => navigate(item.href)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 5, cursor: "pointer", flex: 1, padding: "4px 0",
              color: active ? "#3ddc84" : "#666",
              position: "relative",
            }}
          >
            {/* Liquid glass pill for active item */}
            {active && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 62, height: 62, borderRadius: "50%",
                background: "rgba(20,22,26,.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,.06)",
                boxShadow: "0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07)",
                zIndex: 0,
              }}/>
            )}
            <div style={{ position: "relative", zIndex: 1 }}>{item.icon(active)}</div>
            <span style={{ fontSize: 11, fontWeight: 600, position: "relative", zIndex: 1 }}>{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
