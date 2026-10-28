import { AiError, callModel, estimateCostUsd, readAiConfig } from '../_shared/ai.ts';
import { corsHeaders, isOriginAllowed, json, mapDbError } from '../_shared/http.ts';
import {
  BLOCKED_RESPONSE, CRISIS_RESPONSE, buildSystemPrompt, detectCrisis, isBlockedRequest,
  looksLikeInjection, redactPII, validateMessages, wrapUntrustedMaterial,
} from '../_shared/safety.ts';
import { allowedOrigins, env, log, serviceClient, userClient } from '../_shared/deno-env.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const allowed = allowedOrigins();
  const headers = corsHeaders(origin, allowed);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!isOriginAllowed(origin, allowed)) return json({ error: 'origin_not_allowed' }, 403, headers);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
  const started = Date.now();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'auth_required' }, 401, headers);
  const supabase = userClient(authHeader);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'invalid_session' }, 401, headers);

  let body: { messages?: unknown; studentId?: unknown; materialId?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, headers); }
  const parsed = validateMessages(body.messages);
  if (!parsed.ok) return json({ error: parsed.error }, 400, headers);
  const last = parsed.messages[parsed.messages.length - 1].content;

  // Safety gates run before any provider call or quota consumption.
  if (detectCrisis(last)) {
    log('tutor_safety', { kind: 'crisis' });
    return json({ answer: CRISIS_RESPONSE, safety: 'crisis' }, 200, headers);
  }
  if (isBlockedRequest(last)) {
    log('tutor_safety', { kind: 'blocked' });
    return json({ answer: BLOCKED_RESPONSE, safety: 'blocked' }, 200, headers);
  }

  let cfg;
  try { cfg = readAiConfig(env); } catch { return json({ error: 'tutor_not_configured' }, 503, headers); }

  const admin = serviceClient();
  const cap = Number(env('AI_DAILY_BUDGET_USD') ?? '5');
  const { data: quota, error: quotaError } = await admin.rpc('consume_ai_quota', { p_user: user.id, p_global_cap_usd: cap });
  if (quotaError) {
    const mapped = mapDbError(quotaError.message);
    return json({ error: mapped.code }, mapped.status, headers);
  }

  // Optional context: student level and a processed material (RLS proves ownership).
  let schoolLevel: string | undefined;
  if (typeof body.studentId === 'string') {
    const { data } = await supabase.from('student_profiles').select('school_level').eq('id', body.studentId).maybeSingle();
    schoolLevel = data?.school_level;
  }
  let material = '';
  if (typeof body.materialId === 'string') {
    const { data } = await supabase.from('materials').select('extracted_text,status').eq('id', body.materialId).maybeSingle();
    if (data?.status === 'ready' && data.extracted_text) material = wrapUntrustedMaterial(redactPII(data.extracted_text));
  }

  const messages = parsed.messages.map((m) => ({ role: m.role, content: redactPII(m.content) }));
  if (material) messages[messages.length - 1].content = `${material}\n\n${messages[messages.length - 1].content}`;
  const injectionSuspected = looksLikeInjection(last);

  try {
    const result = await callModel(cfg, buildSystemPrompt({ schoolLevel, hasMaterial: !!material }), messages,
      Number(quota?.maxOutputTokens ?? 700));
    const answer = result.refused || !result.text ? BLOCKED_RESPONSE : redactPII(result.text);
    const cost = estimateCostUsd(cfg, result.inputTokens, result.outputTokens);
    const alertThreshold = Number(env('AI_ALERT_THRESHOLD_USD') ?? String(cap * 0.8));
    const { data: alert } = await admin.rpc('record_ai_usage', {
      p_user: user.id, p_input: result.inputTokens, p_output: result.outputTokens,
      p_cost_usd: cost, p_alert_threshold_usd: alertThreshold,
    });
    if (alert === true) {
      log('ai_budget_alert', { thresholdUsd: alertThreshold });
      const hook = env('ALERT_WEBHOOK_URL');
      if (hook) await fetch(hook, { method: 'POST', body: JSON.stringify({ text: 'StudIA: umbral diario de gasto de IA alcanzado' }) }).catch(() => {});
    }
    log('tutor_ok', { ms: Date.now() - started, inTok: result.inputTokens, outTok: result.outputTokens, injectionSuspected });
    return json({ answer, remaining: quota?.remaining ?? null }, 200, headers);
  } catch (e) {
    const code = e instanceof AiError ? e.code : 'provider_error';
    log('tutor_error', { code, ms: Date.now() - started });
    return json({ error: code === 'timeout' ? 'tutor_timeout' : 'tutor_unavailable' }, code === 'timeout' ? 504 : 502, headers);
  }
});
