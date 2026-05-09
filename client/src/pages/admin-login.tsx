import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Loader2 } from "lucide-react";
import { fetchWithCSRF } from "@/lib/csrf";

export default function AdminLogin() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Real login against backend (auth endpoints are exempt from CSRF)
      const loginRes = await fetchWithCSRF("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        const error = await loginRes.json();
        throw new Error(error.error || "Credenciales inválidas");
      }

      // Verify user is admin
      const meRes = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!meRes.ok) {
        throw new Error("Error al verificar sesión");
      }

      const user = await meRes.json();

      if (user.role !== "admin") {
        // Logout if not admin
        await fetchWithCSRF("/api/auth/logout", {
          method: "POST",
        });
        throw new Error("Acceso denegado. Solo administradores pueden acceder.");
      }

      toast({
        title: "Acceso Concedido",
        description: `Bienvenido, ${user.firstName || "Administrador"}.`,
      });
      setLocation("/portal-admin/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: error.message || "Error al iniciar sesión",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 text-white">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">Admin Portal</CardTitle>
          <CardDescription className="text-neutral-400">
            Acceso restringido únicamente para personal autorizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">Usuario Admin</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="correo@ejemplo.com" 
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                data-testid="input-admin-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">Contraseña</Label>
              <Input 
                id="password" 
                type="password" 
                className="bg-neutral-800 border-neutral-700 text-white focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                data-testid="input-admin-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 bg-primary hover:bg-primary/90 text-white" 
              disabled={loading}
              data-testid="button-admin-login"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Ingresar al Panel"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
