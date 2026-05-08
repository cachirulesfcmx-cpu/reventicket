import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const MOCK_TICKETS = [
  { id:"t1", zone:"Pista", row:"Fila 8", seat:"Asiento 142", price:2850, fee:427, rating:"4.9", sales:127 },
  { id:"t2", zone:"Pista", row:"Fila 12", seat:"Asiento 78", price:2600, fee:390, rating:"5.0", sales:43 },
  { id:"t3", zone:"General A", row:"Fila 1", seat:"Asiento 22", price:1350, fee:202, rating:"4.7", sales:89 },
];

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [selTicket, setSelTicket] = useState(0);

  const { data: event } = useQuery({ queryKey:[`/api/events/${id}`], retry:false });
  const { data: tickets } = useQuery({ queryKey:[`/api/events/${id}/tickets`], retry:false });

  const ev = event as any;
  const tix = ((tickets as any[])?.length ? tickets as any[] : MOCK_TICKETS);
  const sel = tix[selTicket] as any;

  const WAIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#25d366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  return (
    <div style={{ animation:"fadein .25s ease" }}>
      {/* Back */}
      <div onClick={() => navigate("/")} style={{ display:"flex",alignItems:"center",gap:6,padding:"14px 16px 0",color:"#aaa",cursor:"pointer",fontSize:14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </div>

      {/* Hero */}
      <div style={{ position:"relative",margin:"12px 16px 0",borderRadius:18,overflow:"hidden" }}>
        <img src={`https://picsum.photos/seed/${id || "ev"}/600/380`} alt="event"
          style={{ width:"100%",display:"block",borderRadius:18 }}
          onError={(e:any)=>{ e.target.src="https://picsum.photos/seed/concert1/600/380"; }}
        />
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 35%,rgba(13,13,13,.95) 100%)",borderRadius:18 }}/>
        <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:16 }}>
          <span style={{ display:"inline-block",background:"#3ddc84",color:"#000",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,marginBottom:8 }}>Reventa</span>
          <h1 style={{ fontSize:22,fontWeight:800,lineHeight:1.15,color:"#fff" }}>{ev?.title || "Bad Bunny — El Último Tour"}</h1>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:14 }}>
        {[
          { icon:"📅", label:"Fecha", val: ev?.date ? new Date(ev.date).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}) : "18 Jun 2026" },
          { icon:"⏰", label:"Hora", val:"20:00 hrs" },
          { icon:"📍", label:"Recinto", val: ev?.venue?.name || "Foro Sol, CDMX", full:true },
        ].map(m => (
          <div key={m.label} style={{ background:"#1a1a1a",border:"1px solid #252525",borderRadius:12,padding:12,display:"flex",alignItems:"center",gap:8,gridColumn:m.full?"1/-1":"" }}>
            <span style={{ fontSize:16 }}>{m.icon}</span>
            <div>
              <div style={{ fontSize:10,color:"#666",marginBottom:2 }}>{m.label}</div>
              <div style={{ fontSize:13,fontWeight:600 }}>{m.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Venue Map SVG */}
      <div style={{ padding:"0 16px 10px" }}>
        <h3 style={{ fontSize:16,fontWeight:700,marginBottom:10 }}>Selecciona tu zona</h3>
        <div style={{ borderRadius:14,overflow:"hidden",background:"#131313",border:"1px solid #222" }}>
          <svg viewBox="0 0 300 170" width="100%" style={{ display:"block" }}>
            <rect width="300" height="170" fill="#111"/>
            <rect x="95" y="8" width="110" height="28" rx="5" fill="#1e1e1e" stroke="#333"/>
            <text x="150" y="26" fill="#555" fontSize="9" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700">ESCENARIO</text>
            <ellipse cx="150" cy="98" rx="62" ry="42" fill="rgba(61,220,132,.1)" stroke="rgba(61,220,132,.5)" strokeWidth="1.5" style={{cursor:"pointer"}}/>
            <text x="150" y="100" fill="#3ddc84" fontSize="8.5" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700">PISTA</text>
            <text x="150" y="111" fill="#3ddc84" fontSize="7.5" textAnchor="middle" fontFamily="Inter,sans-serif">Desde $2,850</text>
            <rect x="16" y="50" width="58" height="62" rx="5" fill="rgba(123,79,255,.1)" stroke="rgba(123,79,255,.4)" strokeWidth="1.5"/>
            <text x="45" y="79" fill="#a78fff" fontSize="8" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700">VIP</text>
            <text x="45" y="89" fill="#a78fff" fontSize="7" textAnchor="middle" fontFamily="Inter,sans-serif">$5,200+</text>
            <rect x="226" y="50" width="58" height="62" rx="5" fill="rgba(123,79,255,.1)" stroke="rgba(123,79,255,.4)" strokeWidth="1.5"/>
            <text x="255" y="79" fill="#a78fff" fontSize="8" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700">VIP</text>
            <text x="255" y="89" fill="#a78fff" fontSize="7" textAnchor="middle" fontFamily="Inter,sans-serif">$5,200+</text>
            <rect x="50" y="128" width="200" height="26" rx="4" fill="rgba(250,199,117,.08)" stroke="rgba(250,199,117,.4)" strokeWidth="1.5"/>
            <text x="150" y="145" fill="#fac775" fontSize="8" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="700">GENERAL A — Desde $1,200</text>
          </svg>
        </div>
      </div>

      {/* Tickets */}
      <div style={{ padding:"0 16px 8px" }}>
        <h3 style={{ fontSize:16,fontWeight:700,marginBottom:10 }}>Boletos disponibles</h3>
        {tix.map((t: any, i: number) => (
          <div key={t.id || i} onClick={() => setSelTicket(i)}
            style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",borderRadius:12,background: i===selTicket?"#0d1a12":"#151515",border:`1px solid ${i===selTicket?"#3ddc84":"#222"}`,marginBottom:6,cursor:"pointer" }}>
            <div>
              <div style={{ fontSize:14,fontWeight:700 }}>{t.zone || `Zona ${i+1}`} — {t.row}</div>
              <div style={{ fontSize:11,color:"#666",marginTop:2 }}>{t.seat}</div>
              <div style={{ display:"inline-flex",alignItems:"center",gap:4,marginTop:5,background:"#25d36615",border:"1px solid #25d36625",color:"#25d366",fontSize:10,padding:"2px 7px",borderRadius:999 }}>
                <WAIcon/> Vendedor verificado · ⭐ {t.rating || "4.9"}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:17,fontWeight:800,color:"#3ddc84" }}>${(t.price || t.price).toLocaleString("es-MX")}</div>
              <div style={{ fontSize:10,color:"#555" }}>+${(t.fee || Math.round(t.price*0.15)).toLocaleString("es-MX")} cargos</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={() => navigate(`/checkout/${sel?.id || "t1"}`)}
        style={{ position:"sticky",bottom:"calc(var(--nav-h,72px) + 8px)",display:"block",width:"calc(100% - 32px)",margin:"10px 16px 16px",background:"#3ddc84",color:"#000",fontSize:16,fontWeight:800,padding:15,borderRadius:14,textAlign:"center",cursor:"pointer",border:"none",boxShadow:"0 4px 24px rgba(61,220,132,.25)" }}>
        Comprar — ${sel?.price?.toLocaleString("es-MX") || "2,850"}
      </button>
    </div>
  );
}
