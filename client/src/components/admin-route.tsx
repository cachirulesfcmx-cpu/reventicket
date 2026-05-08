import { useEffect, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: React.ReactNode;
}

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [_, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setIsAdmin(false);
        return;
      }

      const user: User = await res.json();
      setIsAdmin(user.role === "admin");
    } catch (error) {
      console.error("Error checking admin access:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-neutral-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/portal-admin/login" />;
  }

  return <>{children}</>;
}
