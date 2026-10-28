import { AiError, buildRequest, callModel, estimateCostUsd, parseResponse, readAiConfig, type AiConfig } from './ai';

const anthropic: AiConfig = { provider: 'anthropic', apiKey: 'test-key', model: 'model-x', timeoutMs: 50 };
const openai: AiConfig = { provider: 'openai_compatible', apiKey: 'k', model: 'm', baseUrl: 'https://llm.example/v1/' };

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const fail = (status: number) => ({ ok: false, status, json: async () => ({ error: 'echo of user text' }) }) as unknown as Response;

describe('config', () => {
  it('requires key, model and a known provider', () => {
    const env = (m: Record<string, string>) => (n: string) => m[n];
    expect(() => readAiConfig(env({}))).toThrow(AiError);
    expect(() => readAiConfig(env({ AI_PROVIDER: 'foo', AI_API_KEY: 'k', AI_MODEL: 'm' }))).toThrow(AiError);
    expect(readAiConfig(env({ AI_API_KEY: 'k', AI_MODEL: 'm', AI_PRICE_INPUT_PER_MTOK: '1' }))).toMatchObject({ provider: 'anthropic', timeoutMs: 25000, priceInputPerMTok: 1 });
  });

  it('estimates cost from configured prices only', () => {
    expect(estimateCostUsd({ ...anthropic, priceInputPerMTok: 2, priceOutputPerMTok: 10 }, 1_000_000, 100_000)).toBeCloseTo(3);
    expect(estimateCostUsd(anthropic, 1000, 1000)).toBe(0);
  });
});

describe('request shapes', () => {
  it('builds an Anthropic Messages API request', () => {
    const r = buildRequest(anthropic, 'sys', [{ role: 'user', content: [{ type: 'pdf', base64: 'AA' }, { type: 'text', text: 'hi' }] }], 300);
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers).toMatchObject({ 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' });
    expect(r.body).toMatchObject({ model: 'model-x', max_tokens: 300, system: 'sys' });
    expect(JSON.stringify(r.body)).toContain('"type":"document"');
  });

  it('builds an OpenAI-compatible request and rejects PDFs there', () => {
    const r = buildRequest(openai, 'sys', [{ role: 'user', content: 'hola' }], 100);
    expect(r.url).toBe('https://llm.example/v1/chat/completions');
    expect((r.body.messages as { role: string }[])[0]).toEqual({ role: 'system', content: 'sys' });
    expect(() => buildRequest(openai, 's', [{ role: 'user', content: [{ type: 'pdf', base64: 'A' }] }], 1)).toThrow(AiError);
  });

  it('parses text, usage and refusals', () => {
    expect(parseResponse(anthropic, { content: [{ type: 'text', text: 'Hola' }], usage: { input_tokens: 5, output_tokens: 7 } }))
      .toEqual({ text: 'Hola', inputTokens: 5, outputTokens: 7, refused: false });
    expect(parseResponse(anthropic, { content: [], stop_reason: 'refusal' }).refused).toBe(true);
    expect(parseResponse(openai, { choices: [{ message: { content: ' Hi ' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } }))
      .toEqual({ text: 'Hi', inputTokens: 1, outputTokens: 2, refused: false });
  });
});

describe('callModel resilience', () => {
  it('retries once on 5xx then succeeds', async () => {
    const f = jest.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'ok' }] }));
    await expect(callModel(anthropic, 's', [{ role: 'user', content: 'x' }], 10, f)).resolves.toMatchObject({ text: 'ok' });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors and never exposes provider bodies', async () => {
    const f = jest.fn().mockResolvedValue(fail(400));
    const err = await callModel(anthropic, 's', [{ role: 'user', content: 'x' }], 10, f).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('provider_error');
    expect(String(err.message)).not.toContain('echo of user text');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('times out hung requests', async () => {
    const hang = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const err = await callModel(anthropic, 's', [{ role: 'user', content: 'x' }], 10, hang as unknown as typeof fetch).catch((e) => e);
    expect(err.code).toBe('timeout');
    expect(hang).toHaveBeenCalledTimes(2);
  });

  it('treats empty answers as errors', async () => {
    const f = jest.fn().mockResolvedValue(ok({ content: [] }));
    await expect(callModel(anthropic, 's', [{ role: 'user', content: 'x' }], 10, f)).rejects.toMatchObject({ code: 'empty' });
  });
});
