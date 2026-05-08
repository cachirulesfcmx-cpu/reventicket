import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("pwa-install-dismissed");
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    
    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (dismissed || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-[60] md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
      >
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl shadow-black/50">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-dismiss-install"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-heading font-bold text-xl">R</span>
            </div>
            <div className="flex-1 pr-6">
              <h3 className="font-bold text-foreground mb-1">Instalar RevenTicket</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isIOS
                  ? "Toca el botón compartir y luego 'Agregar a inicio'"
                  : "Accede más rápido desde tu pantalla de inicio"}
              </p>
              
              {isIOS ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                  <Smartphone className="h-4 w-4" />
                  <span>Compartir → Agregar a inicio</span>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="w-full gap-2 bg-primary hover:bg-primary/90"
                  data-testid="button-install-pwa"
                >
                  <Download className="h-4 w-4" />
                  Instalar ahora
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
