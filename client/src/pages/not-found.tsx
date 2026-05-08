import { useLocation } from "wouter";
export default function NotFound() {
  const [,navigate] = useLocation();
  return (
    <div style={{ padding:40,textAlign:"center",animation:"fadein .25s ease" }}>
      <div style={{ fontSize:60,marginBottom:16 }}>🎟️</div>
      <h1 style={{ fontSize:24,fontWeight:800,marginBottom:8 }}>Página no encontrada</h1>
      <p style={{ color:"#888",marginBottom:24 }}>El contenido que buscas no existe.</p>
      <button onClick={() => navigate("/")} style={{ background:"#3ddc84",color:"#000",fontWeight:700,padding:"12px 24px",borderRadius:12,border:"none",cursor:"pointer" }}>
        Ir al inicio
      </button>
    </div>
  );
}
