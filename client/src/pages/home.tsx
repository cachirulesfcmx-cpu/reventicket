import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const SEED_EVENTS = [
  { id:"e1", title:"México vs Ghana", category:"Deportes", city:"Puebla", venue:"Estadio Cuauhtémoc", date:"22 May", price:"$1,124", img:"https://picsum.photos/seed/soccer1/700/440" },
  { id:"e2", title:"Bad Bunny — Nadie Sabe", category:"Concierto", city:"CDMX", venue:"Foro Sol", date:"14 Jun", price:"$2,850", img:"https://picsum.photos/seed/concert1/700/440" },
  { id:"e3", title:"Gran Premio México F1 2026", category:"F1", city:"CDMX", venue:"Autódromo HR", date:"26 Oct", price:"$8,500", img:"https://picsum.photos/seed/f1race/700/440" },
  { id:"e4", title:"Taylor Swift — The Eras Tour", category:"Concierto", city:"CDMX", venue:"Foro Sol", date:"19 Jul", price:"$3,200", img:"https://picsum.photos/seed/concert2/700/440" },
  { id:"e5", title:"Cumbre Tajín 2026", category:"Festival", city:"Veracruz", venue:"El Tajín", date:"05 Sep", price:"$980", img:"https://picsum.photos/seed/festival1/700/440" },
];

const GRID_EVENTS = [
  { id:"g1", title:"Día Libre Festival", city:"Monterrey", date:"09", mon:"May", price:"$1,200", img:"https://picsum.photos/seed/festival2/500/500" },
  { id:"g2", title:"Julieta Venegas — Norteña Tour", city:"CDMX", date:"30", mon:"May", price:"$650", img:"https://picsum.photos/seed/concert3/500/500" },
  { id:"g3", title:"Grupo Duelo — Gira 2026", city:"León, Gto", date:"08", mon:"Jun", price:"$784", img:"https://picsum.photos/seed/concert4/500/500" },
  { id:"g4", title:"Peso Pluma — Éxodo", city:"Guadalajara", date:"15", mon:"Jun", price:"$950", img:"https://picsum.photos/seed/concert5/500/500" },
  { id:"g5", title:"Metallica — M72 World Tour", city:"CDMX", date:"21", mon:"Jun", price:"$1,800", img:"https://picsum.photos/seed/metal1/500/500" },
  { id:"g6", title:"Cruz Azul vs América", city:"Estadio Azteca", date:"28", mon:"Jun", price:"$520", img:"https://picsum.photos/seed/soccer2/500/500" },
  { id:"g7", title:"Coldplay — Music of the Spheres", city:"Foro Sol, CDMX", date:"12", mon:"Jul", price:"$4,100", img:"https://picsum.photos/seed/coldplay/500/500" },
  { id:"g8", title:"Billie Eilish — Hit Me Hard", city:"Palacio Deportes", date:"18", mon:"Jul", price:"$2,300", img:"https://picsum.photos/seed/billie/500/500" },
  { id:"g9", title:"Rosalía — Motomami Tour", city:"Arena CDMX", date:"02", mon:"Ago", price:"$1,750", img:"https://picsum.photos/seed/rosalia/500/500" },
  { id:"g10", title:"Café Tacvba — 35 Aniversario", city:"Zócalo, CDMX", date:"22", mon:"Ago", price:"$320", img:"https://picsum.photos/seed/cafetacvba/500/500" },
  { id:"g11", title:"Chivas vs Pumas — J12", city:"Estadio Akron, GDL", date:"07", mon:"Sep", price:"$480", img:"https://picsum.photos/seed/chivas/500/500" },
  { id:"g12", title:"NBA México City Game", city:"Arena CDMX", date:"13", mon:"Sep", price:"$2,400", img:"https://picsum.photos/seed/nba1/500/500" },
  { id:"g13", title:"EDC México 2026", city:"Autódromo HR, CDMX", date:"18", mon:"Oct", price:"$1,500", img:"https://picsum.photos/seed/edc/500/500" },
  { id:"g14", title:"Vive Latino 2026", city:"Foro Sol, CDMX", date:"25", mon:"Oct", price:"$2,100", img:"https://picsum.photos/seed/vivelatino/500/500" },
  { id:"g15", title:"Tecate Pa'l Norte", city:"Parque Fundidora, MTY", date:"08", mon:"Nov", price:"$1,800", img:"https://picsum.photos/seed/palnorte/500/500" },
  { id:"g16", title:"Corona Capital 2026", city:"Autódromo HR, CDMX", date:"22", mon:"Nov", price:"$2,600", img:"https://picsum.photos/seed/coronacapital/500/500" },
];

const CATEGORIES = ["Todos","🎤 Conciertos","⚽ Deportes","🏎️ F1","🎪 Festivales","🎭 Teatro","🏀 Basquetbol"];

function HeartBtn() {
  return (
    <button
      onClick={e => { e.stopPropagation(); }}
      style={{
        position:"absolute",top:8,right:8,zIndex:2,
        width:30,height:30,borderRadius:"50%",
        background:"rgba(0,0,0,.55)",backdropFilter:"blur(6px)",
        display:"flex",alignItems:"center",justifyContent:"center",
        border:"none",cursor:"pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}

function LocationPin() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { data: apiEvents } = useQuery({ queryKey: ["/api/events"], retry: false });

  const events = (apiEvents as any[])?.length ? apiEvents as any[] : null;

  return (
    <div style={{ animation: "fadein .25s ease" }}>
      {/* Header */}
      <header style={{
        position:"sticky",top:0,zIndex:50,
        background:"rgba(13,13,13,.92)",
        backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,.05)",
        padding:"12px 16px 0",
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none" }}>
          <div onClick={() => navigate("/login")} style={{
            width:36,height:36,borderRadius:"50%",background:"#1e1e1e",
            border:"1px solid #333",display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,cursor:"pointer",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          {CATEGORIES.map((cat, i) => (
            <div key={cat} style={{
              flexShrink:0,padding:"8px 14px",borderRadius:999,fontSize:13,fontWeight:600,
              whiteSpace:"nowrap",cursor:"pointer",
              background: i === 0 ? "#3ddc84" : "#1e1e1e",
              color: i === 0 ? "#000" : "#bbb",
              border: i === 0 ? "none" : "1px solid #2e2e2e",
            }}>{cat}</div>
          ))}
        </div>
      </header>

      {/* Populares */}
      <div style={{ padding:"20px 16px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:20, fontWeight:700 }}>Populares</span>
      </div>
      <div style={{ display:"flex", gap:12, padding:"0 16px 4px", overflowX:"auto", scrollSnapType:"x mandatory", scrollbarWidth:"none" }}>
        {(events || SEED_EVENTS).slice(0,5).map((ev: any, i: number) => {
          const seed = SEED_EVENTS[i % SEED_EVENTS.length];
          return (
            <div key={ev.id || i} onClick={() => navigate(`/events/${ev.id || ev.id}`)}
              style={{ flexShrink:0, width:"calc(100vw - 80px)", maxWidth:340, scrollSnapAlign:"start",
                background:"#1a1a1a", borderRadius:16, overflow:"hidden", cursor:"pointer" }}>
              <div style={{ position:"relative", width:"100%", aspectRatio:"16/10", overflow:"hidden" }}>
                <img src={ev.image || seed.img} alt={ev.title || seed.title}
                  style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  onError={(e: any) => { e.target.src = seed.img; }}
                />
                <div style={{
                  position:"absolute",top:10,left:10,zIndex:2,
                  background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",
                  borderRadius:10,padding:"4px 8px",textAlign:"center",minWidth:38,
                }}>
                  <span style={{ fontSize:16, fontWeight:800, color:"#fff", display:"block", lineHeight:1.1 }}>
                    {seed.date.split(" ")[0]}
                  </span>
                  <span style={{ fontSize:11, color:"#ccc" }}>{seed.date.split(" ")[1]}</span>
                </div>
                <HeartBtn/>
              </div>
              <div style={{ padding:"12px 14px 14px" }}>
                <div style={{ fontSize:16, fontWeight:700, color:"#3ddc84", marginBottom:4, lineHeight:1.3 }}>
                  {ev.title || seed.title}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"#888", marginBottom:6 }}>
                  <LocationPin/> {ev.venue || seed.venue}
                </div>
                <div style={{ fontSize:13, color:"#888" }}>
                  Desde: <strong style={{ color:"#3ddc84" }}>{ev.minPrice ? `$${ev.minPrice}` : seed.price}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sections */}
      {[
        { label:"Destacados", items: GRID_EVENTS.slice(0,6) },
        { label:"🎤 Conciertos", items: GRID_EVENTS.slice(6,10) },
        { label:"⚽ Deportes", items: GRID_EVENTS.slice(10,12) },
        { label:"🎪 Festivales", items: GRID_EVENTS.slice(12,16) },
      ].map(section => (
        <div key={section.label}>
          {/* Sell banner before Conciertos */}
          {section.label === "🎤 Conciertos" && (
            <div onClick={() => navigate("/sell")} style={{
              margin:"20px 16px",borderRadius:16,overflow:"hidden",
              background:"linear-gradient(135deg,#1a1a2e,#0f2027)",
              border:"1px solid #2a2a3a",cursor:"pointer",
              display:"flex",alignItems:"center",gap:16,padding:18,
            }}>
              <div style={{ width:48,height:48,borderRadius:12,background:"#25d36620",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#25d366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:2 }}>¿Tienes boletos que no usarás?</div>
                <div style={{ fontSize:12, color:"#888" }}>Véndelos por WhatsApp. Pago garantizado.</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ marginLeft:"auto", flexShrink:0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          )}

          <div style={{ padding:"20px 16px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:20, fontWeight:700 }}>{section.label}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, padding:"0 16px" }}>
            {section.items.map(ev => (
              <div key={ev.id} onClick={() => navigate(`/events/${ev.id}`)}
                style={{ borderRadius:14, overflow:"hidden", background:"#1a1a1a", cursor:"pointer" }}>
                <div style={{ position:"relative", width:"100%", aspectRatio:"1/1", overflow:"hidden" }}>
                  <img src={ev.img} alt={ev.title}
                    style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  />
                  <div style={{
                    position:"absolute",inset:0,
                    background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.55) 100%)",
                    pointerEvents:"none",
                  }}/>
                  <div style={{
                    position:"absolute",top:8,left:8,zIndex:2,
                    background:"rgba(0,0,0,.72)",backdropFilter:"blur(6px)",
                    borderRadius:9,padding:"3px 7px",textAlign:"center",minWidth:34,
                  }}>
                    <span style={{ fontSize:14, fontWeight:800, color:"#fff", display:"block", lineHeight:1.1 }}>{ev.date}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:"#ccc", display:"block" }}>{ev.mon}</span>
                  </div>
                  <HeartBtn/>
                </div>
                <div style={{ padding:"8px 10px 10px" }}>
                  <div style={{
                    fontSize:13, fontWeight:700, color:"#3ddc84", lineHeight:1.3, marginBottom:3,
                    display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
                  }}>{ev.title}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:"#888", marginBottom:4 }}>
                    <LocationPin/>{ev.city}
                  </div>
                  <div style={{ fontSize:12, color:"#888" }}>
                    <strong style={{ color:"#3ddc84" }}>{ev.price}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* RevenProtect */}
      <div style={{ padding:"24px 16px 32px" }}>
        <div style={{ background:"#151515", border:"1px solid #222", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ddc84" strokeWidth="2" style={{ flexShrink:0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>RevenProtect™ — Compra 100% garantizada</div>
            <div style={{ fontSize:12, color:"#888" }}>Boletos verificados · Soporte 24/7 por WhatsApp · Reembolso garantizado</div>
          </div>
        </div>
      </div>
    </div>
  );
}
