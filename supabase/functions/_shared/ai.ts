// Provider-agnostic model client with timeout, one retry and normalized usage.
// Supported: Anthropic Messages API and OpenAI-compatible Chat Completions.

export type Provider = 'anthropic' | 'openai_compatible';

export type AiConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  priceInputPerMTok?: number;
  priceOutputPerMTok?: number;
};

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; base64: string }
  | { type: 'pdf'; base64: string };

export type ModelMessage = { role: 'user' | 'assistant'; content: string | ContentPart[] };

export type ModelResult = { text: string; inputTokens: number; outputTokens: number; refused: boolean };

export class AiError extends Error {
  constructor(public code: 'config' | 'timeout' | 'provider_error' | 'empty' | 'unsupported', message?: string) {
    super(message ?? code);
  }
}

type Env = (name: string) => string | undefined;

export function readAiConfig(env: Env): AiConfig {
  const provider = (env('AI_PROVIDER') ?? 'anthropic') as Provider;
  const apiKey = env('AI_API_KEY');
  const model = env('AI_MODEL');
  if (!apiKey || !model || (provider !== 'anthropic' && provider !== 'openai_compatible')) {
    throw new AiError('config', 'AI provider is not configured');
  }
  const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    provider,
    apiKey,
    model,
    baseUrl: env('AI_BASE_URL') || undefined,
    timeoutMs: num(env('AI_TIMEOUT_MS')) ?? 25000,
    priceInputPerMTok: num(env('AI_PRICE_INPUT_PER_MTOK')),
    priceOutputPerMTok: num(env('AI_PRICE_OUTPUT_PER_MTOK')),
  };
}

/** Estimated USD cost; unknown prices are treated as 0 and reported by health checks. */
export function estimateCostUsd(cfg: AiConfig, inputTokens: number, outputTokens: number): number {
  return ((cfg.priceInputPerMTok ?? 0) * inputTokens + (cfg.priceOutputPerMTok ?? 0) * outputTokens) / 1_000_000;
}

function anthropicContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : p.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } },
  );
}

function openAiContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) => {
    if (p.type === 'text') return { type: 'text', text: p.text };
    if (p.type === 'image') return { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.base64}` } };
    throw new AiError('unsupported', 'PDF input requires the anthropic provider');
  });
}

export function buildRequest(
  cfg: AiConfig,
  system: string,
  messages: ModelMessage[],
  maxTokens: number,
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  if (cfg.provider === 'anthropic') {
    return {
      url: `${(cfg.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`,
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: {
        model: cfg.model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: anthropicContent(m.content) })),
      },
    };
  }
  return {
    url: `${(cfg.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: {
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: openAiContent(m.content) }))],
    },
  };
}

export function parseResponse(cfg: AiConfig, data: any): ModelResult {
  if (cfg.provider === 'anthropic') {
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n').trim()
      : '';
    return {
      text,
      inputTokens: Number(data?.usage?.input_tokens ?? 0),
      outputTokens: Number(data?.usage?.output_tokens ?? 0),
      refused: data?.stop_reason === 'refusal',
    };
  }
  const choice = data?.choices?.[0];
  return {
    text: typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '',
    inputTokens: Number(data?.usage?.prompt_tokens ?? 0),
    outputTokens: Number(data?.usage?.completion_tokens ?? 0),
    refused: choice?.finish_reason === 'content_filter',
  };
}

const retryable = (status: number) => status === 429 || status >= 500;

export async function callModel(
  cfg: AiConfig,
  system: string,
  messages: ModelMessage[],
  maxTokens: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelResult> {
  const req = buildRequest(cfg, system, messages, maxTokens);
  let lastError: AiError = new AiError('provider_error');
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 25000);
    try {
      const res = await fetchImpl(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      if (!res.ok) {
        // Never log provider bodies: they can echo user content.
        lastError = new AiError('provider_error', `status ${res.status}`);
        if (retryable(res.status) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        throw lastError;
      }
      const result = parseResponse(cfg, await res.json());
      if (!result.text && !result.refused) throw new AiError('empty');
      return result;
    } catch (e) {
      if (e instanceof AiError) throw e;
      lastError = new AiError(controller.signal.aborted ? 'timeout' : 'provider_error');
      if (attempt === 0) continue;
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
