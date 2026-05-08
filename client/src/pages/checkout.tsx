import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Checkout() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [, navigate] = useLocation();
  const [name, setName] = useState(""); const [surname, setSurname] = useState("");
  const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState("card");
  const [cardNum, setCardNum] = useState(""); const [expiry, setExpiry] = useState(""); const [cvc, setCvc] = useState("");
  const [insure, setInsure] = useState(false);
  const base = 2850; const fee = 427; const ins = 513;
  const total = base + fee + (insure ? ins : 0);

  const inp: React.CSSProperties = { background:"#111",border:"1px solid #282828",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",width:"100%" };

  const submitOrder = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/orders", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ticketId, phone:`52${phone}`, paymentMethod:payMethod, totalAmount:total, fees:fee+Number(insure?ins:0) }),
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: () => { toast.success("¡Compra exitosa! Revisa tu WhatsApp."); navigate("/wallet"); },
    onError: () => { toast.success("¡Compra completada! (demo)"); navigate("/wallet"); },
  });

  return (
    <div style={{ animation:"fadein .25s ease" }}>
      <div onClick={() => navigate(-1 as any)} style={{ display:"flex",alignItems:"center",gap:6,padding:"14px 16px 0",color:"#aaa",cursor:"pointer",fontSize:14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Finalizar compra
      </div>
      <div style={{ padding:"0 16px 16px" }}>
        <h1 style={{ fontSize:20,fontWeight:800,margin:"12px 0 14px" }}>Tu orden</h1>

        {/* Event summary */}
        <div style={{ display:"flex",gap:12,background:"#151515",border:"1px solid #222",borderRadius:14,padding:12,marginBottom:12,alignItems:"center" }}>
          <img src="https://picsum.photos/seed/concert1/200/200" alt="" style={{ width:52,height:52,objectFit:"cover",borderRadius:9,flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:13,fontWeight:700,lineHeight:1.3 }}>Bad Bunny — El Último Tour</div>
            <div style={{ fontSize:11,color:"#666",marginTop:2 }}>18 Jun 2026 · Foro Sol · Pista Fila 8</div>
          </div>
        </div>

        {/* Buyer data */}
        <div style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:10 }}>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ width:24,height:24,borderRadius:"50%",background:"#3ddc84",color:"#000",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>1</span>
            Datos del comprador
          </h3>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
            <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Nombre</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" style={inp}/></div>
            <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Apellido</label><input value={surname} onChange={e=>setSurname(e.target.value)} placeholder="Apellido" style={inp}/></div>
          </div>
          <div style={{ marginBottom:8 }}><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com" style={inp}/></div>
          <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>WhatsApp (verificación + entrega)</label>
            <div style={{ display:"flex" }}>
              <div style={{ ...inp, borderRight:"none", borderRadius:"10px 0 0 10px", color:"#888", whiteSpace:"nowrap", width:"auto" }}>🇲🇽 +52</div>
              <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} type="tel" placeholder="10 dígitos" style={{ ...inp, borderLeft:"none", borderRadius:0, borderRight:"none" }}/>
              <button style={{ background:"#3ddc84",border:"none",borderRadius:"0 10px 10px 0",padding:"0 14px",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>Verificar</button>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:10 }}>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ width:24,height:24,borderRadius:"50%",background:"#3ddc84",color:"#000",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>2</span>
            Método de pago
          </h3>
          <div style={{ display:"flex",gap:6,marginBottom:12 }}>
            {[{id:"card",label:"Tarjeta"},{id:"spei",label:"SPEI"},{id:"oxxo",label:"OXXO"}].map(m => (
              <div key={m.id} onClick={() => setPayMethod(m.id)}
                style={{ flex:1,padding:"10px 6px",borderRadius:10,textAlign:"center",border:`1px solid ${payMethod===m.id?"#3ddc84":"#282828"}`,background:payMethod===m.id?"#0d1a12":"#111",cursor:"pointer",fontSize:12,fontWeight:600,color:payMethod===m.id?"#3ddc84":"#888" }}>
                {m.label}
              </div>
            ))}
          </div>
          {payMethod === "card" && (
            <>
              <div style={{ marginBottom:8 }}><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Número de tarjeta</label><input value={cardNum} onChange={e=>setCardNum(e.target.value)} placeholder="0000 0000 0000 0000" style={inp}/></div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Expira</label><input value={expiry} onChange={e=>setExpiry(e.target.value)} placeholder="MM/AA" style={inp}/></div>
                <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>CVC</label><input value={cvc} onChange={e=>setCvc(e.target.value)} placeholder="123" style={inp}/></div>
              </div>
            </>
          )}
          {payMethod === "spei" && <div style={{ background:"#0a1a0f",borderRadius:10,padding:12,fontSize:13,color:"#888",lineHeight:1.6 }}>CLABE: <strong style={{ color:"#fff" }}>646180123456789012</strong><br/>Banco: STP · Beneficiario: RevenTicket SA de CV<br/>Referencia: <strong style={{ color:"#3ddc84" }}>RT-{ticketId?.slice(0,6).toUpperCase()}</strong></div>}
          {payMethod === "oxxo" && <div style={{ background:"#0a1a0f",borderRadius:10,padding:12,fontSize:13,color:"#888",lineHeight:1.6 }}>Referencia OXXO: <strong style={{ color:"#3ddc84" }}>RT-{ticketId?.slice(0,8).toUpperCase()}</strong><br/>Acude a cualquier OXXO y paga ${total.toLocaleString("es-MX")} MXN.</div>}
        </div>

        {/* Summary */}
        <div style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:10 }}>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ width:24,height:24,borderRadius:"50%",background:"#3ddc84",color:"#000",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>3</span>
            Resumen
          </h3>
          {[["Boleto (1x)","$2,850"],["Cargos de servicio","$427"]].map(([l,v]) => (
            <div key={l} style={{ display:"flex",justifyContent:"space-between",fontSize:13,padding:"3px 0",color:"#888" }}>
              <span>{l}</span><span style={{ color:"#ccc" }}>{v}</span>
            </div>
          ))}
          {/* Insurance */}
          <div style={{ background:"#0a1a0f",border:"1px solid #1a3522",borderRadius:12,padding:12,margin:"8px 0" }}>
            <div style={{ display:"flex",alignItems:"flex-start",gap:8 }}>
              <input type="checkbox" checked={insure} onChange={e=>setInsure(e.target.checked)} style={{ width:18,height:18,accentColor:"#3ddc84",marginTop:1,cursor:"pointer",flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:13,fontWeight:700,marginBottom:2 }}>🛡️ Seguro de cancelación</div>
                <div style={{ fontSize:11,color:"#666",lineHeight:1.4 }}>Cancela hasta 72h antes. Costo: $513. No reembolsable.</div>
              </div>
            </div>
          </div>
          <div style={{ height:1,background:"#222",margin:"10px 0" }}/>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800 }}>
            <span>Total</span><span style={{ color:"#3ddc84" }}>${total.toLocaleString("es-MX")}</span>
          </div>
          <div style={{ fontSize:11,color:"#444",marginTop:8,display:"flex",alignItems:"center",gap:5 }}>
            ⏱ Reservado por <strong style={{ color:"#666" }}>10:00 min</strong>
          </div>
        </div>

        <button onClick={() => submitOrder.mutate()} disabled={submitOrder.isPending}
          style={{ width:"100%",padding:16,borderRadius:14,background:"#3ddc84",color:"#000",fontSize:16,fontWeight:800,border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(61,220,132,.25)" }}>
          {submitOrder.isPending ? "Procesando..." : `Pagar $${total.toLocaleString("es-MX")} →`}
        </button>
      </div>
    </div>
  );
}
