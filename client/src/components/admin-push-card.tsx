import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff, BellRing, Loader2, ShieldAlert } from "lucide-react";

export function AdminPushCard() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notificaciones Push
          </CardTitle>
          <CardDescription>Tu navegador no soporta notificaciones push.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isSubscribed ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          Notificaciones Push
        </CardTitle>
        <CardDescription>
          Recibe alertas en tiempo real en tu dispositivo cada vez que se complete una venta,
          incluso con el navegador cerrado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === "denied" ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Permiso bloqueado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Habilita las notificaciones en la configuración de tu navegador para este sitio.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isSubscribed ? "Notificaciones activas" : "Notificaciones desactivadas"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isSubscribed
                  ? "Recibirás alertas de ventas en este dispositivo."
                  : "Activa para recibir alertas de ventas en tiempo real."}
              </p>
            </div>
            <Button
              size="sm"
              variant={isSubscribed ? "outline" : "default"}
              disabled={isLoading}
              onClick={isSubscribed ? unsubscribe : subscribe}
              className="shrink-0 gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {isLoading ? "Procesando..." : isSubscribed ? "Desactivar" : "Activar"}
            </Button>
          </div>
        )}

        {isSubscribed && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs text-primary font-medium">
              Este dispositivo recibirá notificaciones de ventas
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
