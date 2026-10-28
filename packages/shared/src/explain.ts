// Deterministic explanations: they only restate retrieved, timestamped facts. No language model
// is involved, so the text cannot invent statistics or probabilities.
import { formatPercent } from './probability';

export type ExplanationFact = { label: string; value: string | number; source: string; observedAt: string };

export type ExplanationInput = {
  probability: number | null;
  marketProbability?: number | null;
  facts: ExplanationFact[];
  modelName?: string | null;
  validated: boolean;
};

export function buildExplanation(input: ExplanationInput): string {
  if (input.probability == null) {
    return 'Sin probabilidad publicada: no hay un modelo validado ni datos suficientes para este evento.';
  }
  const parts = [
    `${input.validated ? 'Modelo validado' : 'Resultado experimental (no es una recomendación)'}${input.modelName ? ` · ${input.modelName}` : ''}: probabilidad estimada ${formatPercent(input.probability)}.`,
  ];
  if (input.marketProbability != null) {
    parts.push(`El mercado (sin margen) implica ${formatPercent(input.marketProbability)}; diferencia ${formatPercent(input.probability - input.marketProbability)}.`);
  }
  if (input.facts.length === 0) {
    parts.push('No hay datos de contexto disponibles para este evento.');
  } else {
    for (const f of input.facts.slice(0, 6)) {
      parts.push(`${f.label}: ${f.value} (fuente ${f.source}, ${f.observedAt.slice(0, 16).replace('T', ' ')} UTC).`);
    }
  }
  parts.push('Las probabilidades no garantizan resultados.');
  return parts.join(' ');
}
