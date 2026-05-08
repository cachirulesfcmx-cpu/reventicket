import { useState } from "react";
import { useLocation } from "wouter";

const EVENTS = [
  { id:"e1", title:"México vs Ghana", sub:"22 May · Estadio Cuauhtémoc, Puebla", price:"$1,124", img:"https://picsum.photos/seed/soccer1/200/200" },
  { id:"e2", title:"Bad Bunny — Nadie Sabe Lo Que Va a Pasar Mañana", sub:"14 Jun · Foro Sol, CDMX", price:"$2,850", img:"https://picsum.photos/seed/concert1/200/200" },
  { id:"e3", title:"Gran Premio México F1 2026", sub:"26 Oct · Autódromo HR, CDMX", price:"$8,500", img:"https://picsum.photos/seed/f1race/200/200" },
  { id:"e4", title:"Taylor Swift — The Eras Tour", sub:"19 Jul · Foro Sol, CDMX", price:"$3,200", img:"https://picsum.photos/seed/concert2/200/200" },
  { id:"e5", title:"Día Libre Festival", sub:"09 May · Explanada Libre, Monterrey", price:"$1,200", img:"https://picsum.photos/seed/festival2/200/200" },
  { id:"e6", title:"Julieta Venegas — Norteña Tour", sub:"30 May · Palacio Deportes, CDMX", price:"$650", img:"https://picsum.photos/seed/concert3/200/200" },
  { id:"e7", title:"Coldplay — Music of the Spheres", sub:"12 Jul · Foro Sol, CDMX", price:"$4,100", img:"https://picsum.photos/seed/coldplay/200/200" },
  { id:"e8", title:"EDC México 2026", sub:"18 Oct · Autódromo HR, CDMX", price:"$1,500", img:"https://picsum.photos/seed/edc/200/200" },
  { id:"e9", title:"Vive Latino 2026", sub:"25 Oct · Foro Sol, CDMX", price:"$2,100", img:"https://picsum.photos/seed/vivelatino/200/200" },
  { id:"e10", title:"Corona Capital 2026", sub:"22 Nov · Autódromo HR, CDMX", price:"$2,600", img:"https://picsum.photos/seed/coronacapital/200/200" },
];

export default function Search() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const filtered = EVENTS.filter(e => e.title.toLowerCase().includes(q.toLowerCase()) || e.sub.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ padding:16, animation:"fadein .25s ease" }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"12px 14px",marginBottom:14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={e=>setQ(e.target.value)} autoFocus placeholder="Artista, evento o recinto..."
          style={{ flex:1,background:"none",border:"none",outline:"none",color:"#fff",fontSize:15,fontFamily:"Inter,sans-serif" }}
        />
      </div>
      {filtered.map(ev => (
        <div key={ev.id} onClick={() => navigate(`/events/${ev.id}`)}
          style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #1e1e1e",cursor:"pointer" }}>
          <img src={ev.img} alt={ev.title} style={{ width:54,height:54,borderRadius:10,objectFit:"cover",flexShrink:0 }}/>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:600,marginBottom:3,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{ev.title}</div>
            <div style={{ fontSize:12,color:"#777" }}>{ev.sub}</div>
          </div>
          <div style={{ textAlign:"right",flexShrink:0 }}>
            <div style={{ fontSize:10,color:"#666" }}>desde</div>
            <div style={{ fontSize:15,fontWeight:700,color:"#3ddc84" }}>{ev.price}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
