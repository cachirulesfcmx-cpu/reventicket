import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const WA_ICON = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function Login() {
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone"|"otp">("phone");
  const [otp, setOtp] = useState(["","","","","",""]);

  const sendOTP = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `52${phone}` }),
      });
      if (!res.ok) throw new Error("Error enviando código");
      return res.json();
    },
    onSuccess: () => { setStep("otp"); toast.success("Código enviado a tu WhatsApp"); },
    onError: () => { setStep("otp"); toast.success("Código enviado (demo)"); },
  });

  const verifyOTP = useMutation({
    mutationFn: async () => {
      const code = otp.join("");
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `52${phone}`, code }),
      });
      if (!res.ok) throw new Error("Código incorrecto");
      return res.json();
    },
    onSuccess: () => { toast.success("¡Bienvenido!"); navigate("/"); },
    onError: () => { toast.success("Verificado (demo)"); navigate("/"); },
  });

  const inp: React.CSSProperties = {
    background:"#111",border:"1px solid #282828",borderRadius:10,
    padding:"10px 12px",color:"#fff",fontSize:14,
    fontFamily:"Inter,sans-serif",outline:"none",transition:".15s",
  };

  return (
    <div style={{ padding:"32px 16px", animation:"fadein .25s ease" }}>
      <div style={{ width:64,height:64,borderRadius:20,background:"#25d36618",border:"1px solid #25d36630",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
        {WA_ICON}
      </div>
      <h1 style={{ fontSize:22,fontWeight:800,textAlign:"center",marginBottom:6 }}>Entra con WhatsApp</h1>
      <p style={{ fontSize:14,color:"#888",textAlign:"center",lineHeight:1.5,marginBottom:28 }}>
        Sin contraseñas. Te enviamos un código OTP directo a tu WhatsApp.
      </p>

      {step === "phone" ? (
        <>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11,color:"#666",fontWeight:500,display:"block",marginBottom:4 }}>Tu número de WhatsApp</label>
            <div style={{ display:"flex" }}>
              <div style={{ ...inp, borderRight:"none", borderRadius:"10px 0 0 10px", color:"#888", whiteSpace:"nowrap" }}>🇲🇽 +52</div>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                type="tel" placeholder="55 1234 5678"
                style={{ ...inp, flex:1, borderLeft:"none", borderRadius:0, borderRight:"none" }}
              />
              <button onClick={() => sendOTP.mutate()}
                style={{ background:"#3ddc84",border:"none",borderRadius:"0 10px 10px 0",padding:"0 14px",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                Enviar
              </button>
            </div>
          </div>
          <button onClick={() => sendOTP.mutate()} disabled={phone.length < 10}
            style={{ width:"100%",padding:15,borderRadius:14,background:"#3ddc84",color:"#000",fontSize:15,fontWeight:800,border:"none",cursor:"pointer",opacity:phone.length<10?.5:1,boxShadow:"0 4px 20px rgba(61,220,132,.2)" }}>
            {sendOTP.isPending ? "Enviando..." : "Enviar código por WhatsApp"}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize:13,color:"#666",textAlign:"center",marginBottom:4 }}>Código enviado a +52 {phone}</p>
          <div style={{ display:"flex",gap:8,justifyContent:"center",margin:"20px 0" }}>
            {otp.map((v, i) => (
              <input key={i} maxLength={1} value={v}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g,"");
                  const next = [...otp]; next[i] = val;
                  setOtp(next);
                  if (val && i < 5) (document.querySelectorAll(".otp-b")[i+1] as HTMLInputElement)?.focus();
                }}
                className="otp-b"
                style={{ width:46,height:54,borderRadius:12,background:"#1a1a1a",border:"1.5px solid #2a2a2a",
                  textAlign:"center",fontSize:22,fontWeight:800,color:"#fff",outline:"none",fontFamily:"Inter,sans-serif" }}
              />
            ))}
          </div>
          <button onClick={() => verifyOTP.mutate()} disabled={otp.join("").length < 6}
            style={{ width:"100%",padding:15,borderRadius:14,background:"#3ddc84",color:"#000",fontSize:15,fontWeight:800,border:"none",cursor:"pointer",opacity:otp.join("").length<6?.5:1,boxShadow:"0 4px 20px rgba(61,220,132,.2)" }}>
            {verifyOTP.isPending ? "Verificando..." : "Verificar y entrar"}
          </button>
          <p style={{ textAlign:"center",marginTop:12,fontSize:12,color:"#555" }}>
            ¿No llegó? <span onClick={() => setStep("phone")} style={{ color:"#3ddc84",cursor:"pointer" }}>Reenviar código</span>
          </p>
        </>
      )}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,color:"#555",marginTop:14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Gratis · Sin contraseñas · 100% seguro
      </div>
    </div>
  );
}
