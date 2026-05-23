import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useVibrate } from "@/hooks/use-vibrate";
import { cn } from "@/lib/utils";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { vibrateError, vibrateSuccess, vibrateTap } = useVibrate();
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [focusedInput, setFocusedInput] = useState<number | null>(null);

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(value);
  };

  const startCountdown = () => {
    setCountdown(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      vibrateError();
      toast({
        title: "Número inválido",
        description: "Ingresa un número de 10 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `52${phone}`;
      const result = await apiRequest<any>("POST", "/api/otp/send", { phone: fullPhone });
      vibrateTap();
      setStep("otp");
      startCountdown();

      // Modo dev: auto-rellenar el código si el servidor lo devuelve
      if (result?.devCode) {
        const digits = String(result.devCode).split("");
        setOtp(digits);
        toast({
          title: "Modo dev — código auto-rellenado",
          description: `Código: ${result.devCode}`,
        });
      } else {
        toast({
          title: "Código enviado",
          description: "Revisa tu WhatsApp para el código de verificación",
        });
      }
    } catch (error: any) {
      vibrateError();
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el código",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    vibrateTap();
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;

    setIsLoading(true);
    try {
      const fullPhone = `52${phone}`;
      const result = await apiRequest<any>("POST", "/api/otp/verify", { phone: fullPhone, code });

      // Guardar JWT si el servidor lo devuelve (para futuras requests autenticadas)
      if (result?.token) {
        localStorage.setItem("auth_token", result.token);
      }

      vibrateSuccess();
      setStep("success");

      setTimeout(() => {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente",
        });
        navigate("/");
      }, 1500);
    } catch (error: any) {
      vibrateError();
      toast({
        title: "Código incorrecto",
        description: error.message || "El código no es válido o ha expirado",
        variant: "destructive",
      });
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    await handleSendOTP();
  };

  const isOtpComplete = otp.every((digit) => digit !== "");

  return (
    <Layout hideNav>
      <div className="min-h-[calc(100vh-56px)] flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 flex flex-col px-6 pt-12 pb-8"
            >
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                Inicia sesión con tu teléfono
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-muted-foreground mb-8"
              >
                Ingresa tu número de teléfono para recibir un código de autenticación
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border bg-card mb-6 transition-all duration-200",
                  focusedInput === -1 ? "border-primary ring-2 ring-primary/20" : "border-border"
                )}
              >
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="text-xl">🇲🇽</span>
                  <span>+52</span>
                </div>
                <div className="w-px h-6 bg-border" />
                <Input
                  type="tel"
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneChange}
                  onFocus={() => setFocusedInput(-1)}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="55 1234 5678"
                  className="border-0 bg-transparent text-lg font-medium focus-visible:ring-0 p-0"
                  autoFocus
                  data-testid="input-phone"
                />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex items-center gap-4 mb-6"
              >
                <label className="flex items-center gap-2">
                  <motion.div 
                    whileTap={{ scale: 0.9 }}
                    className="w-5 h-5 rounded bg-primary flex items-center justify-center"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                  <span className="text-sm text-foreground">Enviar código por WhatsApp</span>
                </label>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-muted-foreground mb-8"
              >
                Al continuar, recibirás un código de verificación por WhatsApp.
              </motion.p>

              <div className="mt-auto">
                <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }}>
                  <Button
                    onClick={handleSendOTP}
                    disabled={phone.length !== 10 || isLoading}
                    className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 relative overflow-hidden"
                    data-testid="button-siguiente"
                  >
                    {isLoading ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando...
                      </motion.div>
                    ) : (
                      "Siguiente"
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 flex flex-col px-6 pt-6 pb-8"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setStep("phone");
                  setOtp(["", "", "", "", "", ""]);
                }}
                className="flex items-center gap-2 text-foreground mb-8 -ml-1"
                data-testid="button-back"
              >
                <ArrowLeft className="h-6 w-6" />
              </motion.button>

              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                Ingresa tu código
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-muted-foreground mb-2"
              >
                Introduce el código enviado al:
              </motion.p>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-foreground font-bold text-lg mb-8"
              >
                +52{phone}
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex gap-3 justify-center mb-6"
              >
                {otp.map((digit, index) => (
                  <motion.input
                    key={index}
                    id={`otp-${index}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onFocus={() => setFocusedInput(index)}
                    onBlur={() => setFocusedInput(null)}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ 
                      scale: digit ? 1.05 : 1, 
                      opacity: 1,
                      borderColor: focusedInput === index ? "hsl(var(--primary))" : digit ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"
                    }}
                    transition={{ 
                      delay: index * 0.05,
                      scale: { type: "spring", stiffness: 300, damping: 20 }
                    }}
                    className={cn(
                      "w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-card text-foreground focus:outline-none transition-all duration-200",
                      digit && "animate-bounce-in"
                    )}
                    autoFocus={index === 0}
                    data-testid={`input-otp-${index}`}
                  />
                ))}
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center text-sm text-muted-foreground mb-8"
              >
                ¿No recibiste el código?{" "}
                {canResend ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleResend}
                    className="text-primary font-medium hover:underline"
                    data-testid="button-resend"
                  >
                    Reenviar
                  </motion.button>
                ) : (
                  <span>Reenviar en {String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}</span>
                )}
              </motion.div>

              <div className="mt-auto">
                <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }}>
                  <Button
                    onClick={handleVerifyOTP}
                    disabled={!isOtpComplete || isLoading}
                    className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50"
                    data-testid="button-verify"
                  >
                    {isLoading ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Verificando...
                      </motion.div>
                    ) : (
                      "Siguiente"
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-1 flex flex-col items-center justify-center px-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-6"
              >
                <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <motion.path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                  />
                </svg>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                ¡Bienvenido!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-muted-foreground text-center"
              >
                Sesión iniciada correctamente
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
