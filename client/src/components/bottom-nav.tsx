import { Link, useLocation } from "wouter";
import { Home, Search, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",       icon: Home,   label: "Inicio"      },
  { href: "/search", icon: Search, label: "Buscar"      },
  { href: "/wallet", icon: Ticket, label: "Mis Boletos" },
  { href: "/login",  icon: User,   label: "Cuenta"      },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <>
      {/* Spacer so content isn't hidden behind nav */}
      <div className="h-24 md:hidden" />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Liquid Glass pill */}
        <div style={{
          margin: "0 12px 12px",
          borderRadius: "28px",
          background: "rgba(20, 20, 24, 0.55)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          {/* Subtle top highlight */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
            borderRadius: "28px 28px 0 0",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: 60, position: "relative" }}>
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href === "/" && location === "/") ||
                (item.href === "/login" && (location === "/login" || location === "/profile"));

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      padding: "6px 18px",
                      borderRadius: 20,
                      transition: "all 0.2s ease",
                      background: isActive ? "rgba(34,197,94,0.18)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <item.icon
                      style={{
                        width: 22, height: 22,
                        color: isActive ? "#22c55e" : "rgba(255,255,255,0.45)",
                        strokeWidth: isActive ? 2.5 : 1.8,
                        transition: "color 0.2s",
                        filter: isActive ? "drop-shadow(0 0 6px rgba(34,197,94,0.6))" : "none",
                      }}
                    />
                    <span style={{
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#22c55e" : "rgba(255,255,255,0.4)",
                      transition: "color 0.2s",
                      letterSpacing: "0.01em",
                    }}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
