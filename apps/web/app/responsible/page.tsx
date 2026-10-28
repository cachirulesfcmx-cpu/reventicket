import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Juego responsable' };

export default function Responsible() {
  return (
    <section className="glass panel prose">
      <h1 className="page-title">Juego responsable y aviso legal</h1>
      <p>VANTA EDGE es una herramienta de análisis deportivo con fines informativos y de entretenimiento para personas mayores de 18 años. No acepta, realiza, procesa ni facilita apuestas, no custodia dinero y no enlaza a operadores de apuestas.</p>
      <p>Las probabilidades son estimaciones con incertidumbre. El rendimiento pasado no garantiza resultados futuros. Ningún modelo “gana siempre”: los mercados de apuestas incorporan un margen y la mayoría de los apostadores pierde dinero a largo plazo.</p>
      <h2>Señales de alerta</h2>
      <ul>
        <li>Apostar más de lo que puedes permitirte perder o para recuperar pérdidas.</li>
        <li>Ocultar el tiempo o el dinero que dedicas a apostar.</li>
        <li>Sentir ansiedad o irritabilidad cuando no apuestas.</li>
      </ul>
      <p>Si el juego te está causando problemas, busca ayuda profesional. En México puedes llamar gratis a la Línea de la Vida: <strong>800 911 2000</strong> (24 horas).</p>
    </section>
  );
}
