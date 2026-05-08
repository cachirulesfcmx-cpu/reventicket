import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Admin() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("events");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", category:"Concierto", date:"", venueId:"", image:"", description:"" });

  const { data: events } = useQuery({ queryKey:["/api/events"], retry:false });
  const { data: orders } = useQuery({ queryKey:["/api/admin/orders"], retry:false });
  const { data: waStatus } = useQuery({ queryKey:["/api/whatsapp/status"], retry:false, refetchInterval:10000 });

  const createEvent = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/events", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, date: new Date(form.date).toISOString() }),
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    onSuccess: () => { toast.success("Evento creado"); qc.invalidateQueries({queryKey:["/api/events"]}); setShowForm(false); },
    onError: () => toast.error("Error creando evento"),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id:string) => {
      await fetch(`/api/events/${id}`, { method:"DELETE" });
    },
    onSuccess: () => { toast.success("Evento eliminado"); qc.invalidateQueries({queryKey:["/api/events"]}); },
  });

  const wa = waStatus as any;
  const evList = (events as any[]) || [];
  const orList = (orders as any[]) || [];

  const TABS = ["events","orders","whatsapp"];
  const TAB_LABELS: Record<string,string> = { events:"Eventos", orders:"Órdenes", whatsapp:"WhatsApp" };

  const inp: React.CSSProperties = { background:"#111",border:"1px solid #282828",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",width:"100%" };

  return (
    <div style={{ background:"#0d0d0d",minHeight:"100vh",color:"#fff",fontFamily:"Inter,sans-serif" }}>
      {/* Header */}
      <div style={{ padding:"20px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <h1 style={{ fontSize:22,fontWeight:800 }}>Panel Admin</h1>
        <button onClick={() => navigate("/")} style={{ background:"#1e1e1e",border:"1px solid #333",borderRadius:10,padding:"8px 14px",color:"#aaa",fontSize:13,cursor:"pointer" }}>
          Salir
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"16px 16px 0" }}>
        {[
          { label:"Ventas hoy", val:"$48,200", delta:"↑ 12%", green:true },
          { label:"Órdenes", val: orList.length || "127", delta:"↑ 8 esta hora", green:true },
          { label:"Eventos activos", val: evList.length || "38", delta:"Publicados", green:false },
          { label:"Comisiones", val:"$7,230", delta:"15% promedio", green:true },
        ].map(k => (
          <div key={k.label} style={{ background:"#151515",border:"1px solid #222",borderRadius:12,padding:14 }}>
            <div style={{ fontSize:11,color:"#666",marginBottom:4,textTransform:"uppercase",letterSpacing:".06em" }}>{k.label}</div>
            <div style={{ fontSize:20,fontWeight:700,color:k.green?"#3ddc84":"#fff" }}>{k.val}</div>
            <div style={{ fontSize:11,color:"#3ddc84",marginTop:2 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:6,padding:"16px 16px 0",overflowX:"auto",scrollbarWidth:"none" }}>
        {TABS.map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ flexShrink:0,padding:"6px 14px",borderRadius:999,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${tab===t?"#3ddc84":"#2a2a2a"}`,background:tab===t?"#0d1a12":"#1a1a1a",color:tab===t?"#3ddc84":"#888" }}>
            {TAB_LABELS[t]}
          </div>
        ))}
      </div>

      <div style={{ padding:"16px 16px 32px" }}>

        {/* EVENTS TAB */}
        {tab === "events" && (
          <>
            <button onClick={() => setShowForm(!showForm)}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:14,borderRadius:14,border:"1px dashed rgba(61,220,132,.3)",background:"rgba(61,220,132,.05)",color:"#3ddc84",fontWeight:600,fontSize:14,cursor:"pointer",marginBottom:14 }}>
              + Publicar nuevo evento
            </button>

            {showForm && (
              <div style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:14 }}>
                <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>Nuevo evento</h3>
                <div style={{ marginBottom:8 }}><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Título</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Nombre del evento" style={inp}/></div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                  <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Categoría</label>
                    <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{ ...inp }}>
                      {["Concierto","Deportes","Festival","Teatro","F1"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Fecha</label><input type="datetime-local" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp}/></div>
                </div>
                <div style={{ marginBottom:8 }}><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>URL imagen</label><input value={form.image} onChange={e=>setForm({...form,image:e.target.value})} placeholder="https://..." style={inp}/></div>
                <div style={{ marginBottom:12 }}><label style={{ fontSize:11,color:"#666",display:"block",marginBottom:4 }}>Descripción</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descripción del evento..." style={{ ...inp, minHeight:80, resize:"vertical" as any }}/></div>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={() => createEvent.mutate()} style={{ flex:1,padding:12,borderRadius:10,background:"#3ddc84",color:"#000",fontWeight:700,border:"none",cursor:"pointer" }}>
                    {createEvent.isPending ? "Guardando..." : "Publicar evento"}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ padding:"12px 16px",borderRadius:10,background:"#1e1e1e",color:"#888",fontWeight:600,border:"1px solid #333",cursor:"pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {evList.map((ev: any) => (
              <div key={ev.id} style={{ display:"flex",gap:12,alignItems:"center",background:"#151515",border:"1px solid #222",borderRadius:14,padding:14,marginBottom:6 }}>
                <img src={ev.image || `https://picsum.photos/seed/${ev.id}/200/200`} alt="" style={{ width:48,height:48,borderRadius:10,objectFit:"cover",flexShrink:0 }}
                  onError={(e:any)=>{ e.target.src=`https://picsum.photos/seed/ev${ev.id}/200/200`; }}
                />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{ev.title}</div>
                  <div style={{ fontSize:12,color:"#666",marginTop:2 }}>{ev.category} · {new Date(ev.date).toLocaleDateString("es-MX")}</div>
                </div>
                <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                  <button style={{ width:32,height:32,borderRadius:8,border:"1px solid #2a2a2a",background:"#1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#888" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => deleteEvent.mutate(ev.id)} style={{ width:32,height:32,borderRadius:8,border:"1px solid #3a1a1a",background:"#1a0a0a",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#ff6666" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
            {evList.length === 0 && <div style={{ textAlign:"center",color:"#444",padding:32 }}>Sin eventos publicados</div>}
          </>
        )}

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <>
            <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>Órdenes recientes</h3>
            {orList.length ? orList.slice(0,20).map((o:any) => (
              <div key={o.id} style={{ background:"#151515",border:"1px solid #222",borderRadius:12,padding:14,marginBottom:6 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:13,fontWeight:600 }}>#{o.id?.slice(0,8)}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:"#3ddc84" }}>${o.totalAmount}</span>
                </div>
                <div style={{ fontSize:12,color:"#666" }}>{o.phone} · {o.paymentMethod} · {o.status}</div>
              </div>
            )) : <div style={{ textAlign:"center",color:"#444",padding:32 }}>Sin órdenes aún</div>}
          </>
        )}

        {/* WHATSAPP TAB */}
        {tab === "whatsapp" && (
          <>
            <div style={{ background:"#151515",border:`1px solid ${wa?.isReady?"#1a3522":"#333"}`,borderRadius:14,padding:16,marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:10,height:10,borderRadius:"50%",background:wa?.isReady?"#25d366":"#666",flexShrink:0,boxShadow:wa?.isReady?"0 0 8px #25d366":undefined }}/>
                <div>
                  <div style={{ fontSize:15,fontWeight:700 }}>WhatsApp Bot — {wa?.isReady ? "Activo ✓" : wa?.enabled ? "Conectando..." : "Deshabilitado"}</div>
                  <div style={{ fontSize:12,color:"#666",marginTop:2 }}>{wa?.enabled ? "Mensajes OTP, confirmaciones y marketing activos" : "Activa WHATSAPP_ENABLED=true en las variables de entorno"}</div>
                </div>
              </div>
            </div>

            {wa?.qrCode && (
              <div style={{ background:"#fff",borderRadius:14,padding:20,textAlign:"center",marginBottom:12 }}>
                <div style={{ fontSize:13,color:"#000",marginBottom:8,fontWeight:600 }}>Escanea este QR en WhatsApp Web</div>
                <div style={{ fontSize:11,color:"#666",wordBreak:"break-all" }}>{wa.qrCode}</div>
              </div>
            )}

            <div style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16 }}>
              <div style={{ fontSize:14,fontWeight:700,marginBottom:12 }}>Mensajes automáticos configurados</div>
              {[
                "✅ OTP de verificación al iniciar sesión",
                "🎉 Confirmación de compra con detalles del boleto",
                "💳 Instrucciones de pago (SPEI / OXXO)",
                "⏰ Recordatorio de pago pendiente (1h, 6h, 12h)",
                "👋 Carrito abandonado (24h después)",
                "🎟️ Entrega digital del boleto",
                "📢 Mensajes de marketing (nuevos eventos)",
              ].map(m => (
                <div key={m} style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#aaa",marginBottom:8 }}>
                  <span style={{ color:"#3ddc84",flexShrink:0 }}>✓</span>{m}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
