'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty glass" role="alert">
      <h1 className="page-title">No pudimos cargar esta sección</h1>
      <p>Puede ser un problema de conexión o del proveedor de datos. No mostramos información incompleta.</p>
      <button className="btn" onClick={reset}>Reintentar</button>
    </div>
  );
}
