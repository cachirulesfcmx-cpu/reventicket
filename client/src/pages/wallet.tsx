import { useQuery } from "@tanstack/react-query";
export default function Wallet() {
  const { data: orders } = useQuery({ queryKey:["/api/orders/my"], retry:false });
  return (
    <div style={{ padding:24, animation:"fadein .25s ease" }}>
      <h1 style={{ fontSize:20,fontWeight:800,marginBottom:16 }}>Mis compras</h1>
      {(orders as any[])?.length ? (orders as any[]).map((o:any) => (
        <div key={o.id} style={{ background:"#151515",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:8,display:"flex",gap:12,alignItems:"center" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14,fontWeight:700,marginBottom:2 }}>{o.event?.title || "Evento"}</div>
            <div style={{ fontSize:12,color:"#666" }}>{o.ticket?.zone} · Fila {o.ticket?.row} · Asiento {o.ticket?.seat}</div>
            <div style={{ display:"inline-block",background:"#3ddc8420",color:"#3ddc84",fontSize:11,padding:"2px 8px",borderRadius:999,marginTop:5,fontWeight:600 }}>
              ✓ {o.status === "paid" ? "Confirmado" : o.status}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:15,fontWeight:700,color:"#3ddc84" }}>${o.totalAmount}</div>
          </div>
        </div>
      )) : (
        <div style={{ textAlign:"center",color:"#444",fontSize:14,padding:40 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🎟️</div>
          No tienes compras aún
        </div>
      )}
    </div>
  );
}
