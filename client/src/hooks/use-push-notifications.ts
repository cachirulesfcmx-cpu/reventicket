/**
 * Hook para suscribir al admin a Web Push Notifications.
 *
 * Uso en el panel admin:
 *   const { isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();
 */

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function usePushNotifications() {
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Comprobar si ya hay suscripción activa
  useEffect(() => {
    if (!isSupported) return;

    setPermission(Notification.permission);

    getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      // Pedir permiso
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // Obtener VAPID public key del servidor
      const keyRes = await fetch("/api/push/vapid-public-key", { credentials: "include" });
      const { publicKey, enabled } = await keyRes.json();
      if (!enabled || !publicKey) {
        console.warn("[Push] Push no configurado en el servidor (falta VAPID_PUBLIC_KEY)");
        return false;
      }

      const reg = await getRegistration();
      if (!reg) return false;

      // Crear suscripción push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Enviar suscripción al servidor
      const adminToken = localStorage.getItem("admin_token");
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!saveRes.ok) throw new Error("Error guardando suscripción");

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] Error al suscribirse:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const reg = await getRegistration();
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const adminToken = localStorage.getItem("admin_token");
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
    } catch (err) {
      console.error("[Push] Error al desuscribirse:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
