const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const pipeline = require('./lib/audit-pipeline');
const { createMongoStore } = require('./lib/mongo-store');

const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, '10ms-qa-audit-portal.html');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(ROOT, 'templates');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const DEFAULT_OPENAI_MODELS = ['gpt-audio-1.5'];
const DEFAULT_GEMINI_DEADLINE_MS = 10 * 60 * 1000;
const DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS = 590 * 1000;
const DEFAULT_GEMINI_RETRY_DELAY_MS = 15 * 1000;
const DEFAULT_GEMINI_MAX_ROUNDS = 1;
const DEFAULT_GEMINI_TEMPERATURE = 0.2;
const ANALYSIS_VERSION = '2026-08-26-simple-prompt-v1';

function envNumber(name, fallback) { const value = Number.parseInt(process.env[name] || '', 10); return Number.isFinite(value) && value > 0 ? value : fallback; }
function envFloat(name, fallback) { const value = Number.parseFloat(process.env[name] || ''); return Number.isFinite(value) && value >= 0 && value <= 2 ? value : fallback; }
function envList(name, fallback) { const value = (process.env[name] || '').split(',').map(item => item.trim()).filter(Boolean); return value.length ? value : fallback; }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function safeEqual(left, right) { const a = Buffer.from(String(left || '')); const b = Buffer.from(String(right || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }

function publicUser(user) {
  const providers = user.providers || [user.geminiKey ? 'gemini' : null, user.openaiKey ? 'openai' : null].filter(Boolean);
  return { id: user.id || String(user._id || ''), email: user.email, username: user.username || user.name, name: user.username || user.name, role: user.role || 'user', status: user.status || 'active', mustChangePassword: Boolean(user.mustChangePassword), companyName: user.companyName || 'QA Auditor', providers, apiKeyStatus: user.apiKeyStatus || Object.fromEntries(['gemini', 'openai'].map(provider => [provider, { configured: providers.includes(provider) }])) };
}
function createAnalysisCache(config = {}) {
  const ttlMs = config.ttlMs || envNumber('AI_CACHE_TTL_MS', 6 * 60 * 60 * 1000); const maxEntries = config.maxEntries || envNumber('AI_CACHE_MAX_ENTRIES', 100); const entries = new Map();
  function prune() { const now = Date.now(); for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key); while (entries.size > maxEntries) entries.delete(entries.keys().next().value); }
  return { get(key) { prune(); const entry = entries.get(key); if (!entry) return null; entries.delete(key); entries.set(key, entry); return entry.value; }, set(key, value) { prune(); entries.set(key, { value, expiresAt: Date.now() + ttlMs }); prune(); }, size() { prune(); return entries.size; } };
}
function analysisCacheKey(user, provider, prompt, files) { const hash = crypto.createHash('sha256').update(`${user.email}\0${provider}\0${prompt}`); for (const file of files) hash.update(`\0${file.name}\0${file.mimeType}\0${file.data}`); return hash.digest('hex'); }
function analysisDedupeKey(email, input, files) {
  const hash = crypto.createHash('sha256').update(JSON.stringify({ email: normalizeEmail(email), provider: input.provider, mode: input.mode, parameter: input.parameter, categories: input.categories, selections: input.selections }));
  for (const file of files) hash.update(`\0${file.name}\0${file.mimeType}\0${file.sha256}`);
  return hash.digest('hex');
}
function parseCookies(header) { return String(header || '').split(';').reduce((result, item) => { const at = item.indexOf('='); if (at >= 0) result[item.slice(0, at).trim()] = decodeURIComponent(item.slice(at + 1).trim()); return result; }, {}); }
function createSessionManager() {
  const sessions = new Map(); const prune = () => { const now = Date.now(); for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token); };
  return { create(email, activeParameter = '') { prune(); const token = crypto.randomBytes(32).toString('base64url'); sessions.set(token, { email, activeParameter, expiresAt: Date.now() + SESSION_TTL_MS }); return token; }, get(token) { prune(); const session = sessions.get(token); return session && session.expiresAt > Date.now() ? session : null; }, setParameter(token, parameter) { const session = sessions.get(token); if (!session) return false; session.activeParameter = parameter; return true; }, destroy(token) { sessions.delete(token); }, size() { prune(); return sessions.size; } };
}
function setSessionCookie(res, token, secure) { res.setHeader('Set-Cookie', `qa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`); }
function clearSessionCookie(res, secure) { res.setHeader('Set-Cookie', `qa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`); }
function isSameOrigin(req, allowedOrigins) { const origin = req.get('origin'); return !origin || (allowedOrigins.length ? allowedOrigins.includes(origin) : origin === `${req.protocol}://${req.get('host')}`); }
function validateAudioFiles(files) { if (!Array.isArray(files) || !files.length) throw new Error('Upload at least one audio file.'); return files.map(file => { if (!file || typeof file.data !== 'string' || !String(file.mimeType || '').startsWith('audio/')) throw new Error('Only audio files are supported.'); const buffer = Buffer.from(file.data, 'base64'); if (!buffer.length) throw new Error('Invalid audio data.'); return { data: file.data, mimeType: String(file.mimeType), name: String(file.name || 'audio').slice(0, 200), size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') }; }); }
function parseJsonText(text) { const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); try { return JSON.parse(cleaned); } catch { throw new Error('The AI returned malformed structured JSON.'); } }

function providerError(message, errorCode, retryable, providerStatus, attempts = []) {
  const error = new Error(message);
  error.errorCode = errorCode;
  error.retryable = retryable;
  if (Number.isInteger(providerStatus)) error.providerStatus = providerStatus;
  error.attempts = attempts;
  return error;
}

function safeProviderFailure(error) {
  const code = String(error?.errorCode || 'provider_failed');
  const messages = {
    rate_limited: 'The AI service is temporarily rate limited. Please try again shortly.',
    provider_incompatible: 'The configured AI models could not accept this report format.',
    provider_timeout: 'The AI service took too long to respond. Please try again.',
    provider_network: 'The AI service could not be reached. Please try again.',
    invalid_credentials: 'The configured AI credential is invalid or does not have access.',
    provider_unavailable: 'The AI service is temporarily unavailable. Please try again.',
    invalid_response: 'The AI returned an invalid report. Please run the call again.',
    request_rejected: 'The AI service rejected this request.'
  };
  return { error: messages[code] || 'The AI analysis could not be completed.', errorCode: code, retryable: error?.retryable === true, retryAfterMs: Number(error?.retryAfterMs || 0) || undefined };
}

function retryAfterMilliseconds(response) {
  const value = response?.headers?.get?.('retry-after');
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function createProviderClient(config = {}) {
  const fetchImpl = config.fetchImpl || fetch;
  const sleepImpl = config.sleepImpl || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const geminiModels = config.geminiModels || envList('GEMINI_MODELS', DEFAULT_GEMINI_MODELS);
  const openaiModels = config.openaiModels || envList('OPENAI_MODELS', DEFAULT_OPENAI_MODELS);
  const geminiDeadlineMs = config.geminiDeadlineMs ?? envNumber('GEMINI_CALL_DEADLINE_MS', DEFAULT_GEMINI_DEADLINE_MS);
  const geminiAttemptTimeoutMs = config.geminiAttemptTimeoutMs ?? envNumber('GEMINI_ATTEMPT_TIMEOUT_MS', DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS);
  const geminiRetryDelayMs = config.geminiRetryDelayMs ?? envNumber('GEMINI_RETRY_DELAY_MS', DEFAULT_GEMINI_RETRY_DELAY_MS);
  const geminiMaxRounds = config.geminiMaxRounds ?? envNumber('GEMINI_MAX_ROUNDS', DEFAULT_GEMINI_MAX_ROUNDS);
  const geminiTemperature = config.geminiTemperature ?? envFloat('GEMINI_TEMPERATURE', DEFAULT_GEMINI_TEMPERATURE);
  async function callGemini(apiKey, audioFiles, prompt, schema, models = geminiModels, callOptions = {}) {
    const generationConfig = { temperature: geminiTemperature };
    if (schema) { generationConfig.responseMimeType = 'application/json'; generationConfig.responseJsonSchema = schema; }
    const payload = { contents: [{ parts: [{ text: prompt }, ...audioFiles.map(file => ({ inlineData: { mimeType: file.mimeType, data: file.data } }))] }], generationConfig };
    const deadlineMs = callOptions.deadlineMs ?? geminiDeadlineMs;
    const attemptTimeoutMs = callOptions.attemptTimeoutMs ?? geminiAttemptTimeoutMs;
    const maxRounds = callOptions.maxRounds ?? geminiMaxRounds;
    const deadline = Date.now() + deadlineMs;
    const incompatibleModels = new Set();
    const attempts = [];
    let lastFailure = providerError('No supported Gemini model responded.', 'provider_unavailable', true, undefined, attempts);
    let requestedRetryAfterMs = 0;

    for (let round = 0; round < maxRounds; round += 1) {
      for (const model of models) {
        if (incompatibleModels.has(model)) continue;
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw providerError('Gemini call deadline exceeded.', 'provider_timeout', true, undefined, attempts);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(attemptTimeoutMs, remaining));
        let response;
        try {
          response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(payload), signal: controller.signal });
        } catch (error) {
          const timedOut = controller.signal.aborted || error?.name === 'AbortError';
          const code = timedOut ? 'provider_timeout' : 'provider_network';
          attempts.push({ model, round: round + 1, errorCode: code });
          console.error(`Gemini model ${model} ${timedOut ? 'timed out' : 'network request failed'}.`);
          lastFailure = providerError(timedOut ? 'Gemini request timed out.' : 'Gemini network request failed.', code, true, undefined, attempts);
          continue;
        } finally {
          clearTimeout(timeout);
        }

        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const text = data.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
          if (text) {
            if (!schema) { console.log(`Gemini model ${model} completed the Markdown analysis.`); const value = String(text).trim(); return callOptions.withMeta ? { value, model } : value; }
            try { const value = parseJsonText(text); console.log(`Gemini model ${model} completed the structured analysis.`); return callOptions.withMeta ? { value, model } : value; }
            catch { attempts.push({ model, round: round + 1, errorCode: 'invalid_response' }); lastFailure = providerError('Gemini returned malformed structured JSON.', 'invalid_response', true, response.status, attempts); continue; }
          }
          attempts.push({ model, round: round + 1, errorCode: 'invalid_response', status: response.status });
          lastFailure = providerError(schema ? 'Gemini returned no structured result.' : 'Gemini returned no report text.', 'invalid_response', true, response.status, attempts);
          continue;
        }

        const message = String(data.error?.message || 'Gemini request failed');
        const normalizedMessage = message.replace(/\s+/g, ' ');
        console.error(`Gemini model ${model} returned HTTP ${response.status}: ${normalizedMessage.slice(0, 300)}`);
        if (response.status === 401 || response.status === 403) throw providerError('Gemini credential rejected.', 'invalid_credentials', false, response.status, attempts.concat({ model, round: round + 1, errorCode: 'invalid_credentials', status: response.status }));
        if (response.status === 400 && /invalid argument|response.*schema|json schema/i.test(message)) {
          incompatibleModels.add(model);
          attempts.push({ model, round: round + 1, errorCode: 'provider_incompatible', status: response.status });
          lastFailure = providerError('Gemini model rejected the structured report schema.', 'provider_incompatible', false, response.status, attempts);
          continue;
        }
        if (response.status === 404 || /not found|deprecated|not supported/i.test(message)) {
          incompatibleModels.add(model);
          attempts.push({ model, round: round + 1, errorCode: 'provider_incompatible', status: response.status });
          lastFailure = providerError('Gemini model is unavailable or incompatible.', 'provider_incompatible', false, response.status, attempts);
          continue;
        }
        if (response.status === 429) {
          const retryAfterMs = retryAfterMilliseconds(response);
          requestedRetryAfterMs = Math.max(requestedRetryAfterMs, retryAfterMs);
          attempts.push({ model, round: round + 1, errorCode: 'rate_limited', status: response.status });
          lastFailure = providerError('Gemini quota or rate limit exceeded.', 'rate_limited', true, response.status, attempts);
          lastFailure.retryAfterMs = retryAfterMs;
          continue;
        }
        if (response.status >= 500) {
          attempts.push({ model, round: round + 1, errorCode: 'provider_unavailable', status: response.status });
          lastFailure = providerError('Gemini is temporarily unavailable.', 'provider_unavailable', true, response.status, attempts);
          continue;
        }
        throw providerError(`Gemini request rejected (HTTP ${response.status}).`, 'request_rejected', false, response.status, attempts.concat({ model, round: round + 1, errorCode: 'request_rejected', status: response.status }));
      }

      if (round + 1 >= maxRounds || incompatibleModels.size === models.length) break;
      const remaining = deadline - Date.now();
      const delay = Math.min(Math.max(requestedRetryAfterMs, geminiRetryDelayMs * (round + 1)), Math.max(0, remaining - 1));
      if (delay <= 0) break;
      await sleepImpl(delay);
    }
    if (Date.now() >= deadline && lastFailure.retryable) throw providerError('Gemini call deadline exceeded.', 'provider_timeout', true, lastFailure.providerStatus, attempts);
    throw lastFailure;
  }
  async function callOpenAI(apiKey, audioFiles, prompt, schema, withMeta = false) {
    const content = [{ type: 'text', text: `${prompt}\n\nReturn JSON only matching this schema: ${JSON.stringify(schema)}` }, ...audioFiles.map(file => ({ type: 'input_audio', input_audio: { data: file.data, format: /wav/i.test(`${file.mimeType} ${file.name}`) ? 'wav' : 'mp3' } }))]; let lastError = 'No supported OpenAI model responded.';
    for (const model of openaiModels) { const response = await fetchImpl('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, modalities: ['text'], messages: [{ role: 'user', content }] }) }); const data = await response.json().catch(() => ({})); if (response.ok) { const text = data.choices?.[0]?.message?.content; if (text) { const value = parseJsonText(text); return withMeta ? { value, model } : value; } lastError = 'OpenAI returned no structured result.'; continue; } const message = String(data.error?.message || 'OpenAI request failed'); console.error(`OpenAI model ${model} returned HTTP ${response.status}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`); if (response.status === 401 || response.status === 403) throw providerError('OpenAI credential rejected.', 'invalid_credentials', false, response.status); if (response.status === 429) { lastError = message; continue; } if (response.status === 404 || response.status >= 500 || /not found|deprecated|not supported|model/i.test(message)) { lastError = message; continue; } throw providerError(`OpenAI request rejected (HTTP ${response.status}).`, 'request_rejected', false, response.status); }
    throw providerError(lastError, /quota|rate limit/i.test(lastError) ? 'rate_limited' : 'provider_unavailable', true);
  }
  async function callOpenAIMarkdown(apiKey, audioFiles, prompt, withMeta = false) {
    const content = [{ type: 'text', text: prompt }, ...audioFiles.map(file => ({ type: 'input_audio', input_audio: { data: file.data, format: /wav/i.test(`${file.mimeType} ${file.name}`) ? 'wav' : 'mp3' } }))];
    let lastError = 'No supported OpenAI model responded.';
    for (const model of openaiModels) {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, modalities: ['text'], messages: [{ role: 'user', content }] }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { const text = data.choices?.[0]?.message?.content; if (text) { const value = String(text).trim(); return withMeta ? { value, model } : value; } lastError = 'OpenAI returned no report text.'; continue; }
      const message = String(data.error?.message || 'OpenAI request failed');
      if (response.status === 401 || response.status === 403) throw providerError('OpenAI credential rejected.', 'invalid_credentials', false, response.status);
      if (response.status === 429 || response.status >= 500 || response.status === 404 || /not found|deprecated|not supported|model/i.test(message)) { lastError = message; continue; }
      throw providerError(`OpenAI request rejected (HTTP ${response.status}).`, 'request_rejected', false, response.status);
    }
    throw providerError(lastError, /quota|rate limit/i.test(lastError) ? 'rate_limited' : 'provider_unavailable', true);
  }
  return {
    async callStructured(provider, key, files, prompt, schema) { return provider === 'gemini' ? callGemini(key, files, prompt, schema, geminiModels, { maxRounds: 1 }) : callOpenAI(key, files, prompt, schema); },
    async callMarkdown(provider, key, files, prompt) { return provider === 'gemini' ? callGemini(key, files, prompt, null, geminiModels, { maxRounds: 1 }) : callOpenAIMarkdown(key, files, prompt); },
    async callStructuredWithMeta(provider, key, files, prompt, schema) { return provider === 'gemini' ? callGemini(key, files, prompt, schema, geminiModels, { maxRounds: 1, withMeta: true }) : callOpenAI(key, files, prompt, schema, true); },
    async callMarkdownWithMeta(provider, key, files, prompt) { return provider === 'gemini' ? callGemini(key, files, prompt, null, geminiModels, { maxRounds: 1, withMeta: true }) : callOpenAIMarkdown(key, files, prompt, true); },
    callGemini, callOpenAI, callOpenAIMarkdown
  };
}

function productContext(products) { return products.length ? products.map(item => `[${item.category} / ${item.subCategory}]\n${item.brief}`).join('\n\n') : 'No product was selected. Do a generic evaluation and do not assume product-specific facts.'; }
function cleanText(value, maximum = 300) { return String(value || '').trim().slice(0, maximum); }
function validateEmail(value) { const email = normalizeEmail(value); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw Object.assign(new Error('Enter a valid email address.'), { statusCode: 400 }); return email; }
function validateUsername(value) { const username = cleanText(value, 80); if (username.length < 2) throw Object.assign(new Error('Username must be at least 2 characters.'), { statusCode: 400 }); return username; }
function scorecardDocument(input) {
  const name = cleanText(input?.name, 120); const categories = Array.isArray(input?.definition?.categories) ? input.definition.categories : []; const criticalErrors = Array.isArray(input?.definition?.criticalErrors) ? input.definition.criticalErrors.map(item => cleanText(item, 300)).filter(Boolean) : [];
  if (!name || !categories.length) throw Object.assign(new Error('Scorecard name and at least one category are required.'), { statusCode: 400 });
  const normalized = categories.map(category => ({ name: cleanText(category?.name, 150), weight: Number(category?.weight), rows: (Array.isArray(category?.rows) ? category.rows : []).map(row => ({ name: cleanText(row?.name, 180), weight: Number(row?.weight) })) }));
  if (new Set(normalized.map(category => category.name.toLowerCase())).size !== normalized.length) throw Object.assign(new Error('Scorecard category names must be unique.'), { statusCode: 400 });
  const rowNames = new Set();
  for (const category of normalized) {
    if (!category.name || !Number.isFinite(category.weight) || category.weight <= 0 || !category.rows.length || category.rows.some(row => !row.name || !Number.isFinite(row.weight) || row.weight <= 0)) throw Object.assign(new Error('Every scorecard category and row needs a name and positive weight.'), { statusCode: 400 });
    for (const row of category.rows) { const key = `${category.name}\0${row.name}`.toLowerCase(); if (rowNames.has(key)) throw Object.assign(new Error('Scorecard rows must be unique inside each category.'), { statusCode: 400 }); rowNames.add(key); }
    category.maximum = category.rows.reduce((sum, row) => sum + row.weight, 0);
    if (Math.abs(category.maximum - category.weight) > 0.0001) throw Object.assign(new Error(`${category.name} row weights must total ${category.weight}.`), { statusCode: 400 });
  }
  const overallTotal = Number(input?.definition?.overallTotal ?? input?.definition?.total); const calculatedTotal = normalized.reduce((sum, category) => sum + category.weight, 0);
  if (!Number.isFinite(overallTotal) || overallTotal <= 0 || Math.abs(calculatedTotal - overallTotal) > 0.0001) throw Object.assign(new Error(`Category weights must total the overall score of ${overallTotal || 0}.`), { statusCode: 400 });
  const detail = normalized.map((category, index) => `${index + 1}. ${category.name} (${category.maximum} points)\n${category.rows.map(row => `- ${row.name} (${row.weight})`).join('\n')}`).join('\n\n') + `\n\nCritical Errors${criticalErrors.length ? `\n${criticalErrors.map(rule => `- ${rule}`).join('\n')}` : ''}`;
  pipeline.parseQaRubric(name, detail);
  return { name, detail, definition: { categories: normalized.map(({ name: categoryName, weight, rows }) => ({ name: categoryName, weight, rows })), criticalErrors, overallTotal, total: calculatedTotal } };
}
function scorecardForEditor(item) {
  if (item?.definition?.categories?.length) return item;
  const rubric = pipeline.parseQaRubric(item.name, item.detail);
  return { ...item, definition: { overallTotal: rubric.maximum, total: rubric.maximum, criticalErrors: rubric.criticalErrors, categories: rubric.categories.map(category => ({ name: category.name, weight: category.maximum, rows: category.rows.map(row => ({ name: row.parameter, weight: row.maximum })) })) } };
}
function qaPrompt(company, rubric, products, fileName) {
  const ceRules = rubric.criticalErrors.length ? rubric.criticalErrors.map(rule => `- ${rule}`).join('\n') : '- No CE rules are configured.';
  return `Analyze exactly one call (${fileName}) as a QA evaluator for ${company}. Write every narrative field in Bangla and cite precise [MM:SS] timestamps. Score every rubric row exactly once using its exact category, parameter, and maximum. Preserve raw achieved points.

TIMESTAMPED EVIDENCE AND COACHING — MANDATORY:
- Every deduction_justifications, strengths, and actionable_tips item must contain a precise call timestamp and its evidence-based detail.
- Tie every suggestion to the exact moment that motivated it. Never return generic, untimestamped coaching advice.
- Use a timestamp range such as [01:30-01:50] when the behavior spans a conversation segment.

SALE-PITCH APPLICABILITY — SCORE BEFORE JUDGING THE PITCH:
- First determine customer_enrollment_status and the primary call_objective from the recording, with timestamped evidence.
- Set sales_pitch_applicable to false only when the audio clearly establishes that the customer is already enrolled AND the primary purpose is feedback collection, service checking, or support—not a new sale, upsell, cross-sell, or renewal.
- When sales_pitch_applicable is false, every Sale Pitch, Sales Pitch, or Product Pitch rubric row is not applicable: award its full maximum score and do not list the missing pitch as a deduction or coaching gap.
- Being enrolled alone is not enough for exemption. If the call includes a genuine upsell, cross-sell, renewal, or other sales objective, sales_pitch_applicable remains true and the pitch is evaluated normally.
- If enrollment status or call purpose is unclear, sales_pitch_applicable remains true. Never assume an exemption without clear audio evidence.

CRITICAL ERROR DECISION — STRICT ZERO-SCORE OVERRIDE:
- Complete the CE decision before assigning the final score.
- Evaluate every listed CE rule against the audio. If any listed rule is evidenced, ce_detected MUST be true. The server will then set the final score to zero regardless of raw achieved points.
- For Rudeness: direct scolding, shaming, belittling, mocking, insulting, contemptuous questioning, or humiliating a customer/student is a CE even when no profanity is used. Repeated blame, sarcastic comments about guessing, or asking why a student is so inattentive qualify when the wording and tone support that interpretation.
- Mild firmness, ordinary coaching, or hurried speech alone is not Rudeness CE.
- For every detected CE, quote the exact words and cite precise [MM:SS] timestamps in ce_audit_details.
- Keep ce_detected, ce_audit_details, ce_alert, the relevant score-row deduction, and overall_status mutually consistent. Never describe a listed CE in the evidence while returning ce_detected false.

LISTED CE RULES FROM THE LIVE RUBRIC:
${ceRules}

PRODUCT CONTEXT:
${productContext(products)}

LIVE RUBRIC (${rubric.name}):
${rubric.source}`;
}
function qaMarkdownPrompt(company, rubric, products, files, evaluationDate) {
  const recordings = files.map((file, index) => `${index + 1}. ${JSON.stringify(file.name)} — use audio attachment ${index + 1}`).join('\n');
  const ceRules = rubric.criticalErrors.length ? rubric.criticalErrors.map(rule => `- ${rule}`).join('\n') : '- No CE rules are configured.';
  const selectedFacts = products.length ? productContext(products) : 'No product/category was selected in the portal.';
  return `You are a world-class Quality Assurance Manager and Call Evaluator for ${company}. Listen carefully to all ${files.length} attached recordings and evaluate each call independently. Return one clean Bangla Markdown response—no JSON, no code fence, and no run summary. The server creates the run summary locally.

RECORDINGS (same order as the audio attachments):
${recordings}

For each call, use the exact filename and wrap its report with:
  <!-- QA_CALL_START {"fileName":"exact filename"} -->
  <!-- QA_META {"fileName":"exact filename","agentName":"detected name or শনাক্ত করা যায়নি","finalScore":81,"maximum":${rubric.maximum},"ceDetected":false} -->
  ...report Markdown...
  <!-- QA_CALL_END -->

MANDATORY AUDIT RULES:
- First identify the call objective and whether the customer is already enrolled. Apply the live rubric contextually, not as a blind checklist; do not deduct for something genuinely outside the call's purpose.
- For an enrolled customer receiving feedback, service-check, or support, Sale/Sales/Product Pitch is not applicable unless there is a real upsell, cross-sell, renewal, or new-sale objective. Give non-applicable pitch rows full marks and explain briefly.
- When official product facts are provided, verify every concrete claim in a table: Timestamp | Advisor claim | Official fact | Correct / Incorrect / Not verifiable. Contradictions may trigger Wrong information or Wrong guidance CE. If no product is selected, state that product verification was unavailable and invent nothing.
- Check every live CE rule. Any evidenced CE sets the final score to 0 regardless of raw marks. Evidence-based scolding, shaming, belittling, mocking, insulting, contemptuous questioning, or humiliation is Rudeness CE. Keep the CE decision, visible score, and QA_META consistent.
- Cite precise [MM:SS] timestamps for every deduction, strength, correction, and recommendation. Score every live rubric row once and reconcile achieved, deducted, and final totals.

SELECTED OFFICIAL PRODUCT FACTS:
${selectedFacts}

LIVE CE RULES:
${ceRules}

LIVE RUBRIC (${rubric.name}, maximum ${rubric.maximum}):
${rubric.source}

REQUIRED SECTIONS FOR EACH CALL:
# 📊 ${company} - QA Audit & Call Scorecard Report
## ১. কলের সংক্ষিপ্ত তথ্য (Call Summary)
- Topic, customer need/type, call purpose, enrollment status, duration/tone, agent name, evaluation date (${evaluationDate}), and final score.
## ২. প্রোডাক্ট ফ্যাক্ট-চেক ও ক্রিটিক্যাল এরর অডিট (Product Fact-Check & Critical Error Audit)
- Product-claim table, CE evidence, and CE Alert.
## ৩. QA স্কোরকার্ড ও স্কোর ব্রেকডাউন (QA Scorecard Breakdown)
| প্যারামিটার | সর্বোচ্চ নম্বর | অর্জিত নম্বর | কাটা নম্বর | টাইমস্ট্যাম্প [MM:SS] | নম্বর কাটার বিবরণ ও সংক্ষেপ |
## ৪. মার্ক কাটার বিস্তারিত কারণ ও বিচার বিশ্লেষণ (Deduction Justification)
## ৫. এডভাইসরের ভালো দিকসমূহ (Strengths / Pros)
## ৬. ভুল Approach বনাম সঠিক Approach (Script Correction)
## ৭. অ্যাকশনেবল পরামর্শ ও ফাইনাল পারফরম্যান্স রেটিং (Actionable Coaching & Final Rating)`;
}
function markdownRunSummary(results) {
  return {
    recurringIssues: results.flatMap(result => result.deductionJustifications).slice(0, 12),
    bestAndWorstCalls: results.length === 1 ? `${results[0].fileName}: ${results[0].finalScore}/${results[0].maximum}${results[0].ceDetected ? ' (CE)' : ' (Non-CE)'}` : 'সফল কলগুলোর স্কোর ও প্রমাণভিত্তিক ফলাফল সার্ভারে তুলনা করা হয়েছে।',
    overallRecommendations: results.flatMap(result => result.actionableTips).slice(0, 12)
  };
}
function voicePrompt(company, products, count) { return `Analyze ${count} calls for ${company} as a Customer Insights analyst. Return one Bangla summary grounded only in the recordings. Include precise timestamps where useful. This is not a QA scorecard and must not score calls.\n\nPRODUCT CONTEXT:\n${productContext(products)}`; }
function coachingPrompt(company, rubric, products, count) { return `Analyze ${count} calls for ${company} as a senior sales communication coach. Return one Bangla coaching summary with precise [MM:SS] timestamps. Use the selected ${rubric.name} rubric only as coaching context; do not produce scores.\n\nPRODUCT CONTEXT:\n${productContext(products)}\n\nLIVE RUBRIC:\n${rubric.source}`; }

function normalizeAnalysisInput(body) {
  const provider = String(body?.provider || '').toLowerCase();
  const mode = String(body?.mode || 'single');
  if (!['gemini', 'openai'].includes(provider)) throw Object.assign(new Error('Unsupported AI provider.'), { statusCode: 400 });
  if (!['single', 'voice', 'coaching'].includes(mode)) throw Object.assign(new Error('Unsupported analysis mode.'), { statusCode: 400 });
  const categories = [...new Set((Array.isArray(body?.categories) ? body.categories : []).map(item => String(item || '').trim()).filter(Boolean))];
  const selections = (Array.isArray(body?.productSelections) ? body.productSelections : []).map(item => ({ category: String(item?.category || '').trim(), subCategory: String(item?.subCategory || '').trim() })).filter(item => item.category && item.subCategory);
  if (categories.length > 50 || selections.length > 200 || categories.some(item => item.length > 300) || selections.some(item => item.category.length > 300 || item.subCategory.length > 500)) throw Object.assign(new Error('Invalid product selection.'), { statusCode: 400 });
  return { provider, mode, parameter: String(body?.parameter || '').trim(), categories, selections };
}

async function prepareAnalysis(dataStore, user, input, audioFiles, templateDir) {
  const apiKey = input.provider === 'gemini' ? user.geminiKey : user.openaiKey;
  if (!apiKey) throw Object.assign(new Error(`No ${input.provider} API key is configured for this account.`), { statusCode: 400 });
  const products = await dataStore.getProductBriefs(input.categories, input.selections);
  if ((input.categories.length || input.selections.length) && !products.length) throw Object.assign(new Error('The selected product briefs were not found.'), { statusCode: 400 });
  let parameter = ''; let rubric = null;
  if (input.mode !== 'voice') {
    if (!input.parameter) throw Object.assign(new Error('Choose a QA parameter.'), { statusCode: 400 });
    const entry = await dataStore.getQaParameter(input.parameter);
    if (!entry) throw Object.assign(new Error('The selected QA parameter is no longer available.'), { statusCode: 400 });
    rubric = pipeline.parseQaRubric(entry.name, entry.detail); parameter = entry.name;
  }
  const templateKeys = input.mode === 'single' ? ['qaSummary'] : [input.mode];
  const templates = pipeline.loadAndValidateTemplates(templateDir, templateKeys);
  const identity = input.mode === 'single'
    ? `${ANALYSIS_VERSION}\nqa-markdown\n${user.companyName}\n${parameter}\n${rubric.source}\n${productContext(products)}\n${templates.qaSummary}`
    : `${ANALYSIS_VERSION}\n${input.mode}\n${user.companyName}\n${parameter}\n${rubric?.source || ''}\n${productContext(products)}\n${templates[input.mode]}`;
  return { apiKey, products, parameter, rubric, templates, cacheKey: analysisCacheKey(user, input.provider, identity, audioFiles) };
}

async function cacheGet(dataStore, memoryCache, key) { return dataStore.getCachedAnalysis ? dataStore.getCachedAnalysis(key) : memoryCache.get(key); }
async function cacheSet(dataStore, memoryCache, key, result, ttlMs) { return dataStore.setCachedAnalysis ? dataStore.setCachedAnalysis(key, result, ttlMs) : memoryCache.set(key, result); }

async function runAnalysis({ dataStore, providerClient, memoryCache, templateDir, cacheTtlMs }, user, input, audioFiles, runContext = {}) {
  const prepared = await prepareAnalysis(dataStore, user, input, audioFiles, templateDir);
  const cached = await cacheGet(dataStore, memoryCache, prepared.cacheKey);
  if (cached) return { ...cached, cached: true, auditResultWrite: cached.mode === 'single' ? { status: 'cached', savedRows: 0 } : cached.auditResultWrite };
  const timestamp = new Date().toISOString(); const evaluationDate = timestamp.slice(0, 10); const jobId = runContext.jobId || crypto.randomUUID(); let responseBody; let actualModel = '';
  if (input.mode === 'single') {
    const prompt = qaMarkdownPrompt(user.companyName, prepared.rubric, prepared.products, audioFiles, evaluationDate);
    const providerResult = providerClient.callMarkdownWithMeta ? await providerClient.callMarkdownWithMeta(input.provider, prepared.apiKey, audioFiles, prompt) : { value: await providerClient.callMarkdown(input.provider, prepared.apiKey, audioFiles, prompt), model: '' };
    const reportMarkdown = providerResult.value; actualModel = providerResult.model || '';
    const parsedCalls = pipeline.parseQaMarkdownReport(reportMarkdown, audioFiles.map(file => file.name), prepared.rubric);
    const remainingCalls = [...parsedCalls]; const items = []; const results = [];
    for (const file of audioFiles) {
      let index = remainingCalls.findIndex(result => result.fileName === file.name);
      if (index < 0 && remainingCalls.length === audioFiles.length - results.length) index = 0;
      if (index < 0) { items.push({ kind: 'call', fileName: file.name, status: 'failed', error: 'The combined Markdown response did not contain a separate report for this call. No database row was created.', errorCode: 'report_parse', retryable: true }); continue; }
      const result = remainingCalls.splice(index, 1)[0]; result.fileName = file.name;
      if (prepared.products.length && !result.productCheckPresent) result.markdown = `> ⚠️ নির্বাচিত প্রোডাক্ট তথ্য দেওয়া হয়েছিল, কিন্তু AI রিপোর্টে claim-by-claim product verification পাওয়া যায়নি।\n\n${result.markdown}`;
      results.push(result); items.push({ kind: 'call', fileName: file.name, status: 'success', markdown: result.markdown, score: Number.isFinite(result.finalScore) ? result.finalScore : '—', maximum: result.maximum, ce: result.ceDetected });
    }
    const storableResults = results.filter(result => result.storageEligible);
    if (storableResults.length) {
      try { const summary = markdownRunSummary(storableResults); items.push({ kind: 'summary', status: 'success', markdown: pipeline.renderQaSummary(prepared.templates.qaSummary, summary, storableResults, storableResults.map(result => result.fileName), user.companyName, prepared.parameter, evaluationDate) }); }
      catch (error) { console.error('Local QA run summary failed:', error.message); items.push({ kind: 'summary', status: 'failed', error: 'The local run summary could not be generated.', errorCode: 'summary_render', retryable: false }); }
    }
    let auditResultWrite = { status: 'saved', savedRows: storableResults.length };
    if (storableResults.length !== results.length) auditResultWrite = { status: 'failed', savedRows: 0, message: 'The Markdown reports were generated, but one or more scores could not be read, so no audit rows were saved.' };
    else { try { await dataStore.appendAuditResults(storableResults.map(result => pipeline.auditResultRowFromMarkdown(result, prepared.parameter, timestamp)), { ownerUserId: user.id, ownerEmail: user.email, jobId, files: storableResults.map(result => audioFiles.find(file => file.name === result.fileName) || { name: result.fileName }), companyName: user.companyName, parameter: prepared.parameter, products: prepared.products, model: actualModel }); } catch (error) { console.error('Audit result storage failed:', error.message); auditResultWrite = { status: 'failed', savedRows: 0, message: 'Reports were generated, but the audit results were not saved to the database.' }; } }
    responseBody = { mode: input.mode, items, report: items.filter(item => item.markdown).map(item => item.markdown).join('\n\n---\n\n'), partial: items.some(item => item.status === 'failed') || auditResultWrite.status === 'failed', auditResultWrite, cached: false, model: actualModel };
  } else {
    const prompt = input.mode === 'voice' ? voicePrompt(user.companyName, prepared.products, audioFiles.length) : coachingPrompt(user.companyName, prepared.rubric, prepared.products, audioFiles.length);
    const schema = input.mode === 'voice' ? pipeline.VOICE_SCHEMA : pipeline.COACHING_SCHEMA; const template = prepared.templates[input.mode];
    const providerResult = providerClient.callStructuredWithMeta ? await providerClient.callStructuredWithMeta(input.provider, prepared.apiKey, audioFiles, prompt, schema) : { value: await providerClient.callStructured(input.provider, prepared.apiKey, audioFiles, prompt, schema), model: '' };
    const structured = providerResult.value; actualModel = providerResult.model || '';
    const markdown = input.mode === 'voice' ? pipeline.renderVoice(template, pipeline.validateVoiceResult(structured), audioFiles.length) : pipeline.renderCoaching(template, pipeline.validateCoachingResult(structured), user.companyName);
    responseBody = { mode: input.mode, items: [{ kind: input.mode, status: 'success', markdown }], report: markdown, partial: false, auditResultWrite: { status: 'not_applicable', savedRows: 0 }, cached: false, model: actualModel };
  }
  if (dataStore.saveReportRun) {
    try {
      const successfulCalls = responseBody.items.filter(item => item.kind === 'call' && item.status === 'success');
      const saved = await dataStore.saveReportRun({ jobId, ownerUserId: user.id, ownerEmail: user.email, ownerName: user.username || user.name, mode: input.mode, provider: input.provider, model: actualModel, companySnapshot: user.companyName, parameterSnapshot: prepared.parameter, productSnapshot: prepared.products, rubricSnapshot: prepared.rubric ? { name: prepared.rubric.name, maximum: prepared.rubric.maximum, source: prepared.rubric.source } : null, files: audioFiles.map(file => ({ name: file.name, sha256: file.sha256, mimeType: file.mimeType, size: file.size })), items: responseBody.items, report: responseBody.report, partial: responseBody.partial, cached: false, ceCount: successfulCalls.filter(item => item.ce).length, minimumScore: successfulCalls.length ? Math.min(...successfulCalls.map(item => Number(item.score) || 0)) : null, maximumScore: successfulCalls.length ? Math.max(...successfulCalls.map(item => Number(item.score) || 0)) : null, searchText: `${user.email} ${user.username || user.name} ${prepared.parameter} ${audioFiles.map(file => file.name).join(' ')} ${responseBody.report}`.slice(0, 16000), completedAt: new Date() });
      responseBody.reportRunId = saved.id;
    } catch (error) { console.error('Report history storage failed:', error.message); responseBody.historyWarning = 'The report was generated but could not be added to report history.'; responseBody.partial = true; }
  }
  if (!responseBody.partial) await cacheSet(dataStore, memoryCache, prepared.cacheKey, responseBody, cacheTtlMs);
  await dataStore.incrementUsage(user.email).catch(error => console.error('Usage update failed:', error.message));
  return responseBody;
}

function createAnalysisQueue({ dataStore, handler, minStartIntervalMs = envNumber('AI_MIN_START_INTERVAL_MS', 60000), cooldownMs = envNumber('AI_RATE_LIMIT_COOLDOWN_MS', 60000), workerLeaseMs = envNumber('AI_WORKER_LEASE_MS', 30 * 60 * 1000), pollMs = 2000 }) {
  const workerId = crypto.randomUUID(); let running = false; let stopped = false; let timer = null;
  function schedule(delay = pollMs) { if (stopped || timer) return; timer = setTimeout(() => { timer = null; drain().catch(error => { console.error('Analysis queue failed:', error.message); schedule(); }); }, delay); timer.unref?.(); }
  async function drain() {
    if (running || stopped) return;
    const leaseUntil = dataStore.acquireWorkerLease ? await dataStore.acquireWorkerLease(workerId, workerLeaseMs) : new Date(Date.now() + workerLeaseMs);
    if (!leaseUntil) return schedule();
    let job;
    try { await dataStore.recoverJobs(); job = await dataStore.claimNextJob(workerId, leaseUntil); }
    catch (error) { if (dataStore.releaseWorkerLease) await dataStore.releaseWorkerLease(workerId).catch(() => {}); throw error; }
    if (!job) { if (dataStore.releaseWorkerLease) await dataStore.releaseWorkerLease(workerId); return schedule(); }
    running = true;
    try {
      const rateKey = job.rateKey || job.provider || 'gemini'; const state = await dataStore.getRateState(rateKey); const delay = Math.max(0, new Date(state?.nextAllowedAt || 0).getTime() - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      await dataStore.setNextAllowedAt(new Date(Date.now() + minStartIntervalMs), rateKey);
      const audioFiles = await dataStore.loadJobAudio(job);
      const result = await handler(job, audioFiles);
      await dataStore.completeJob(job.jobId, result);
    } catch (error) {
      const safe = safeProviderFailure(error);
      if (safe.errorCode === 'rate_limited') await dataStore.setCooldownUntil(new Date(Date.now() + Math.max(cooldownMs, safe.retryAfterMs || 0)), job.rateKey || job.provider || 'gemini').catch(() => {});
      await dataStore.failJob(job.jobId, safe);
      console.error(`Analysis job ${job.jobId} failed:`, error.message);
    } finally { if (dataStore.releaseWorkerLease) await dataStore.releaseWorkerLease(workerId).catch(() => {}); running = false; schedule(0); }
  }
  return {
    async start() { schedule(0); },
    wake() { schedule(0); },
    stop() { stopped = true; if (timer) clearTimeout(timer); timer = null; }
  };
}

function createApp(options = {}) {
  const app = express(); const dataStore = options.dataStore || createMongoStore(); const providerClient = options.providerClient || createProviderClient(); const sessions = options.sessions || createSessionManager(); const memoryCache = options.analysisCache || createAnalysisCache(); const templateDir = options.templateDir || TEMPLATE_DIR;
  const cacheTtlMs = options.cacheTtlMs || envNumber('AI_CACHE_TTL_MS', 6 * 60 * 60 * 1000); const queueEnabled = options.queueEnabled ?? Boolean(dataStore.createAnalysisJob);
  const allowedOrigins = options.allowedOrigins || envList('PUBLIC_ORIGINS', process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : []); const secureCookies = options.secureCookies ?? (process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : String(process.env.COOKIE_SECURE).toLowerCase() === 'true');
  const setupToken = String(options.setupToken ?? process.env.SETUP_TOKEN ?? '');
  const queue = queueEnabled ? createAnalysisQueue({ dataStore, handler: async (job, audioFiles) => { const user = await dataStore.findByEmail(job.ownerEmail, { includeSecrets: true }); if (!user || user.active === false || user.status === 'inactive') throw Object.assign(new Error('The analysis user is inactive or no longer exists.'), { errorCode: 'account_inactive', retryable: false }); return runAnalysis({ dataStore, providerClient, memoryCache, templateDir, cacheTtlMs }, user, job.request, audioFiles, { jobId: job.jobId }); }, ...(options.queueOptions || {}) }) : null;
  if (queue) queue.start().catch(error => console.error('Analysis queue startup failed:', error.message));
  async function createSession(user, activeParameter) { return dataStore.createSession ? dataStore.createSession(user, activeParameter, SESSION_TTL_MS) : sessions.create(user.email, activeParameter); }
  async function destroySession(token) { return dataStore.destroySession ? dataStore.destroySession(token) : sessions.destroy(token); }
  async function setActiveParameter(token, parameter) { return dataStore.setSessionParameter ? dataStore.setSessionParameter(token, parameter) : sessions.setParameter(token, parameter); }
  app.disable('x-powered-by'); app.set('trust proxy', options.trustProxy ?? (process.env.NODE_ENV === 'production' ? 1 : false)); app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })); app.use(async (req, res, next) => {
    try { const token = parseCookies(req.headers.cookie).qa_session; req.sessionToken = token; req.session = token ? (dataStore.getSession ? await dataStore.getSession(token) : sessions.get(token)) : null; req.currentUser = req.session ? await dataStore.findByEmail(req.session.email) : null; if (req.session && (!req.currentUser || req.currentUser.active === false || req.currentUser.status === 'inactive')) { await destroySession(token); req.session = null; req.currentUser = null; clearSessionCookie(res, secureCookies); } next(); }
    catch (error) { console.error('Session middleware failed:', error.message); res.status(503).json({ error: 'Authentication service is temporarily unavailable.' }); }
  });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again later.' } }); const requireAuth = (req, res, next) => req.session && req.currentUser ? next() : res.status(401).json({ error: 'Authentication required.' }); const requireReady = (req, res, next) => req.currentUser?.mustChangePassword ? res.status(428).json({ error: 'Change your temporary password before continuing.', errorCode: 'password_change_required' }) : next(); const requireAdmin = (req, res, next) => req.currentUser?.role === 'admin' ? next() : res.status(403).json({ error: 'Administrator access is required.' }); const requireSameOrigin = (req, res, next) => isSameOrigin(req, allowedOrigins) ? next() : res.status(403).json({ error: 'Invalid request origin.' }); const jsonSmall = express.json({ limit: '20kb' }); const jsonAdmin = express.json({ limit: '500kb' });
  app.get('/healthz', async (req, res) => { try { if (dataStore.ping) await dataStore.ping(); return res.json({ ok: true, database: 'mongodb' }); } catch (error) { return res.status(503).json({ ok: false, database: 'unavailable' }); } });
  app.get('/api/setup/status', async (req, res) => { try { return res.json({ required: dataStore.hasUsers ? !await dataStore.hasUsers() : false }); } catch { return res.status(503).json({ error: 'Setup status is unavailable.' }); } });
  app.post('/api/setup', requireSameOrigin, jsonSmall, async (req, res) => { try { if (!setupToken || !safeEqual(req.body?.setupToken, setupToken)) return res.status(403).json({ error: 'Invalid setup token.' }); if (!dataStore.createFirstAdmin) return res.status(409).json({ error: 'Setup is unavailable.' }); const user = await dataStore.createFirstAdmin({ email: validateEmail(req.body?.email), username: validateUsername(req.body?.username), password: String(req.body?.password || ''), initialCompanyName: cleanText(req.body?.companyName, 160) || 'QA Auditor' }); return res.status(201).json({ user: publicUser(user) }); } catch (error) { return res.status(error.code === 11000 ? 409 : error.statusCode || 400).json({ error: error.code === 11000 ? 'That email or username is already in use.' : error.message }); } });
  app.post('/api/login', loginLimiter, requireSameOrigin, jsonSmall, async (req, res) => { const email = normalizeEmail(req.body?.email); const password = String(req.body?.password || ''); if (!email || !password || email.length > 320 || password.length > 512) return res.status(401).json({ error: 'Invalid email or password.' }); try { const user = await dataStore.findByEmail(email); const valid = user && (dataStore.verifyUserPassword ? await dataStore.verifyUserPassword(user, password) : safeEqual(user.password, password)); if (!valid) return res.status(401).json({ error: 'Invalid email or password.' }); if (user.active === false || user.status === 'inactive') return res.status(403).json({ error: 'This account is inactive.' }); const token = await createSession(user, user.defaultParameter || 'Outbound'); setSessionCookie(res, token, secureCookies); return res.json({ user: publicUser(user) }); } catch (error) { console.error('Login lookup failed:', error.message); return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' }); } });
  app.get('/api/session', requireAuth, (req, res) => res.json({ user: publicUser(req.currentUser) }));
  app.get('/api/audit-config', requireAuth, requireReady, async (req, res) => { try { const configuration = await dataStore.getAuditConfiguration(); const user = req.currentUser; const saved = configuration.parameters.includes(user.defaultParameter) ? user.defaultParameter : configuration.parameters[0] || ''; const active = configuration.parameters.includes(req.session.activeParameter) ? req.session.activeParameter : saved; await setActiveParameter(req.sessionToken, active); return res.json({ products: configuration.products, parameters: configuration.parameters, savedDefaultParameter: saved, activeParameter: active }); } catch (error) { console.error('Audit configuration lookup failed:', error.message); return res.status(503).json({ error: 'Audit configuration is temporarily unavailable.' }); } });
  async function validateParameter(req, res) { const parameter = String(req.body?.parameter || '').trim(); if (!parameter) { res.status(400).json({ error: 'Choose a QA parameter.' }); return null; } const entry = await dataStore.getQaParameter(parameter); if (!entry) { res.status(400).json({ error: 'The selected QA parameter is no longer available.' }); return null; } return entry.name; }
  app.put('/api/session/parameter', requireSameOrigin, requireAuth, requireReady, jsonSmall, async (req, res) => { try { const parameter = await validateParameter(req, res); if (!parameter) return; await setActiveParameter(req.sessionToken, parameter); return res.json({ activeParameter: parameter }); } catch (error) { console.error('Parameter selection failed:', error.message); return res.status(503).json({ error: 'The parameter could not be updated.' }); } });
  app.put('/api/user/default-parameter', requireSameOrigin, requireAuth, requireReady, jsonSmall, async (req, res) => { try { const parameter = await validateParameter(req, res); if (!parameter) return; await dataStore.saveDefaultParameter(req.session.email, parameter); await setActiveParameter(req.sessionToken, parameter); return res.json({ savedDefaultParameter: parameter, activeParameter: parameter }); } catch (error) { console.error('Default parameter update failed:', error.message); return res.status(503).json({ error: 'The default parameter could not be saved.' }); } });
  app.post('/api/logout', requireSameOrigin, async (req, res) => { if (req.sessionToken) await destroySession(req.sessionToken); clearSessionCookie(res, secureCookies); res.json({ ok: true }); });

  app.put('/api/account/password', requireSameOrigin, requireAuth, jsonSmall, async (req, res) => {
    try { const valid = dataStore.verifyUserPassword ? await dataStore.verifyUserPassword(req.currentUser, String(req.body?.currentPassword || '')) : safeEqual(req.currentUser.password, req.body?.currentPassword); if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' }); if (!dataStore.changePassword) return res.status(501).json({ error: 'Password management is unavailable.' }); await dataStore.changePassword(req.currentUser.id || req.currentUser._id, String(req.body?.newPassword || ''), false); clearSessionCookie(res, secureCookies); return res.json({ ok: true, loginRequired: true }); }
    catch (error) { return res.status(error.statusCode || 400).json({ error: error.message }); }
  });
  app.get('/api/account/api-keys', requireAuth, requireReady, (req, res) => res.json({ apiKeys: req.currentUser.apiKeyStatus || {} }));
  app.get('/api/account/api-keys/:provider', requireAuth, requireReady, (req, res) => { const provider = String(req.params.provider || '').toLowerCase(); if (!['gemini', 'openai'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider.' }); return res.json({ apiKey: req.currentUser.apiKeyStatus?.[provider] || { configured: false } }); });
  async function validateProviderKey(provider, key) {
    const timeoutMs = Math.max(250, Number(options.apiKeyValidationTimeoutMs || 8000));
    const controller = new AbortController();
    const validationFetch = options.apiKeyValidationFetch || fetch;
    let timeout;
    const probe = async () => {
      if (options.apiKeyValidator) return options.apiKeyValidator(provider, key, { signal: controller.signal });
      if (provider === 'gemini') {
        const response = await validationFetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key }, signal: controller.signal });
        if (response.status === 401 || response.status === 403) return { valid: false, status: 'invalid' };
        return { valid: response.ok ? true : null, status: response.ok ? 'verified' : 'unverified' };
      }
      const modelsResponse = await validationFetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal });
      if (modelsResponse.status === 401) return { valid: false, status: 'invalid' };
      if (modelsResponse.ok) return { valid: true, status: 'verified' };
      if (modelsResponse.status !== 403) return { valid: null, status: 'unverified' };

      // Restricted project keys may be allowed to run audits while intentionally
      // lacking api.model.read. An empty request verifies Chat Completions access
      // without running inference or consuming tokens.
      const chatResponse = await validationFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: '{}',
        signal: controller.signal
      });
      if (chatResponse.status === 400 || chatResponse.ok) return { valid: true, status: 'verified' };
      if (chatResponse.status === 401 || chatResponse.status === 403) return { valid: false, status: 'invalid' };
      return { valid: null, status: 'unverified' };
    };
    try {
      return await Promise.race([
        probe(),
        new Promise(resolve => { timeout = setTimeout(() => { controller.abort(); resolve({ valid: null, status: 'unverified' }); }, timeoutMs); })
      ]);
    } catch { return { valid: null, status: 'unverified' }; }
    finally { clearTimeout(timeout); }
  }
  app.put('/api/account/api-keys/:provider', requireSameOrigin, requireAuth, requireReady, jsonSmall, async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase(); const apiKey = String(req.body?.apiKey || '').trim(); if (!['gemini', 'openai'].includes(provider) || !apiKey || apiKey.length > 512) return res.status(400).json({ error: 'Enter a valid provider API key.' });
    try { const validation = await validateProviderKey(provider, apiKey); if (validation.valid === false) return res.status(400).json({ error: 'The provider rejected this API key.' }); const value = await dataStore.setApiKey(req.currentUser.id || req.currentUser._id, provider, apiKey, validation.status); return res.json({ apiKey: value, warning: validation.status === 'unverified' ? 'The key was encrypted and saved, but the provider could not verify it right now.' : '' }); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  });
  app.delete('/api/account/api-keys/:provider', requireSameOrigin, requireAuth, requireReady, async (req, res) => { const provider = String(req.params.provider || '').toLowerCase(); if (!['gemini', 'openai'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider.' }); await dataStore.deleteApiKey(req.currentUser.id || req.currentUser._id, provider); return res.json({ ok: true }); });

  app.get('/api/reports', requireAuth, requireReady, async (req, res) => { try { return res.json(await dataStore.listReports(req.currentUser, req.query)); } catch (error) { console.error('Report history lookup failed:', error.message); return res.status(503).json({ error: 'Report history is temporarily unavailable.' }); } });
  app.get('/api/reports/:id', requireAuth, requireReady, async (req, res) => { try { const report = await dataStore.getReport(req.currentUser, req.params.id); return report ? res.json({ report }) : res.status(404).json({ error: 'Report was not found.' }); } catch { return res.status(503).json({ error: 'The report is temporarily unavailable.' }); } });

  app.get('/api/admin/users', requireAuth, requireReady, requireAdmin, async (req, res) => res.json({ users: (await dataStore.listUsers()).map(publicUser) }));
  app.post('/api/admin/users', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { try { const user = await dataStore.createUser({ email: validateEmail(req.body?.email), username: validateUsername(req.body?.username), password: String(req.body?.password || '') }); return res.status(201).json({ user: publicUser(user) }); } catch (error) { return res.status(error.code === 11000 ? 409 : error.statusCode || 400).json({ error: error.code === 11000 ? 'That email or username is already in use.' : error.message }); } });
  app.put('/api/admin/users/:id/role', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'user' ? 'user' : ''; if (!role) return res.status(400).json({ error: 'Invalid role.' }); if (String(req.currentUser.id) === String(req.params.id)) return res.status(400).json({ error: 'Ask another administrator to change your role.' }); try { await dataStore.setUserRole(req.params.id, role); return res.json({ ok: true }); } catch (error) { return res.status(400).json({ error: error.message }); } });
  app.put('/api/admin/users/:id/status', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { const status = req.body?.status === 'active' ? 'active' : req.body?.status === 'inactive' ? 'inactive' : ''; if (!status) return res.status(400).json({ error: 'Invalid account status.' }); if (status === 'inactive' && String(req.currentUser.id) === String(req.params.id)) return res.status(400).json({ error: 'You cannot deactivate your own account.' }); try { await dataStore.setUserStatus(req.params.id, status); return res.json({ ok: true }); } catch (error) { return res.status(400).json({ error: error.message }); } });
  app.post('/api/admin/users/:id/reset-password', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { if (String(req.currentUser.id) === String(req.params.id)) return res.status(400).json({ error: 'Use account settings to change your own password.' }); try { await dataStore.changePassword(req.params.id, String(req.body?.temporaryPassword || ''), true); return res.json({ ok: true }); } catch (error) { return res.status(400).json({ error: error.message }); } });
  app.get('/api/admin/company', requireAuth, requireReady, requireAdmin, async (req, res) => res.json(await dataStore.getCompany()));
  app.put('/api/admin/company', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { const companyName = cleanText(req.body?.companyName, 160); if (companyName.length < 2) return res.status(400).json({ error: 'Company name is required.' }); return res.json(await dataStore.updateCompany(companyName)); });
  app.get('/api/admin/product-taxonomy', requireAuth, requireReady, requireAdmin, async (req, res) => res.json({ categories: await dataStore.listProductTaxonomy() }));
  app.post('/api/admin/product-categories', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { const name = cleanText(req.body?.name, 200); if (!name) return res.status(400).json({ error: 'Category name is required.' }); try { return res.status(201).json({ category: await dataStore.createProductCategory(name) }); } catch (error) { return res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'That category already exists.' : error.message }); } });
  app.put('/api/admin/product-categories/:id', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { try { await dataStore.setProductCategoryArchived(req.params.id, Boolean(req.body?.archived)); return res.json({ ok: true }); } catch (error) { return res.status(400).json({ error: error.message }); } });
  app.post('/api/admin/product-subcategories', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { const name = cleanText(req.body?.name, 300); const categoryId = cleanText(req.body?.categoryId, 50); if (!name || !categoryId) return res.status(400).json({ error: 'Category and sub-category name are required.' }); try { return res.status(201).json({ subCategory: await dataStore.createProductSubCategory(categoryId, name) }); } catch (error) { return res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'That sub-category already exists in this category.' : error.message }); } });
  app.put('/api/admin/product-subcategories/:id', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonSmall, async (req, res) => { try { await dataStore.setProductSubCategoryArchived(req.params.id, Boolean(req.body?.archived)); return res.json({ ok: true }); } catch (error) { return res.status(400).json({ error: error.message }); } });
  app.get('/api/admin/product-briefs', requireAuth, requireReady, requireAdmin, async (req, res) => res.json({ items: await dataStore.listProductBriefs() }));
  app.post('/api/admin/product-briefs', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonAdmin, async (req, res) => { const input = { categoryId: cleanText(req.body?.categoryId, 50), subCategoryId: cleanText(req.body?.subCategoryId, 50), brief: cleanText(req.body?.brief, 30000) }; if (!input.categoryId || !input.subCategoryId || !input.brief) return res.status(400).json({ error: 'Choose a category and sub-category, then add the description.' }); try { return res.status(201).json({ item: await dataStore.createProductBrief(input) }); } catch (error) { return res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'A description already exists for that category and sub-category.' : error.message }); } });
  app.put('/api/admin/product-briefs/:id', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonAdmin, async (req, res) => { const fields = {}; for (const key of ['categoryId', 'subCategoryId', 'brief']) if (req.body?.[key] !== undefined) fields[key] = cleanText(req.body[key], key === 'brief' ? 30000 : 50); if (req.body?.archived !== undefined) fields.archived = Boolean(req.body.archived); if (Object.values(fields).some(value => typeof value === 'string' && !value)) return res.status(400).json({ error: 'Product fields cannot be empty.' }); try { await dataStore.updateProductBrief(req.params.id, fields); return res.json({ ok: true }); } catch (error) { return res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'A description already exists for that category and sub-category.' : error.message }); } });
  app.get('/api/admin/scorecards', requireAuth, requireReady, requireAdmin, async (req, res) => { try { return res.json({ items: (await dataStore.listScorecards()).map(scorecardForEditor) }); } catch (error) { return res.status(503).json({ error: error.message }); } });
  app.post('/api/admin/scorecards', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonAdmin, async (req, res) => { try { return res.status(201).json({ item: await dataStore.createScorecard(scorecardDocument(req.body)) }); } catch (error) { return res.status(error.code === 11000 ? 409 : error.statusCode || 400).json({ error: error.code === 11000 ? 'That scorecard name already exists.' : error.message }); } });
  app.put('/api/admin/scorecards/:id', requireSameOrigin, requireAuth, requireReady, requireAdmin, jsonAdmin, async (req, res) => { try { if (req.body?.archived !== undefined && !req.body?.definition) await dataStore.updateScorecard(req.params.id, { archived: Boolean(req.body.archived) }); else await dataStore.updateScorecard(req.params.id, scorecardDocument(req.body)); return res.json({ ok: true }); } catch (error) { return res.status(error.code === 11000 ? 409 : error.statusCode || 400).json({ error: error.code === 11000 ? 'That scorecard name already exists.' : error.message }); } });

  app.post('/api/analyze', requireSameOrigin, requireAuth, requireReady, express.json({ limit: Infinity }), async (req, res) => {
    let input; let audioFiles;
    try { input = normalizeAnalysisInput(req.body); audioFiles = validateAudioFiles(req.body?.audioFiles); }
    catch (error) { return res.status(error.statusCode || 400).json({ error: error.message }); }
    try {
      const user = await dataStore.findByEmail(req.session.email, { includeSecrets: true }); if (!user || user.active === false || user.status === 'inactive') return res.status(401).json({ error: 'Session is no longer valid.' });
      const prepared = await prepareAnalysis(dataStore, user, input, audioFiles, templateDir);
      if (input.mode !== 'voice') await setActiveParameter(req.sessionToken, prepared.parameter);
      const cached = await cacheGet(dataStore, memoryCache, prepared.cacheKey);
      if (cached) return res.json({ ...cached, cached: true, auditResultWrite: input.mode === 'single' ? { status: 'cached', savedRows: 0 } : cached.auditResultWrite });
      if (!queue) return res.json(await runAnalysis({ dataStore, providerClient, memoryCache, templateDir, cacheTtlMs }, user, input, audioFiles, { jobId: crypto.randomUUID() }));
      const dedupeKey = analysisDedupeKey(user.email, input, audioFiles); const active = await dataStore.findActiveJob(user.email, dedupeKey);
      if (active) return res.status(202).json({ jobId: active.jobId, status: active.status, deduplicated: true });
      const primaryModel = input.provider === 'gemini' ? envList('GEMINI_MODELS', DEFAULT_GEMINI_MODELS)[0] : envList('OPENAI_MODELS', DEFAULT_OPENAI_MODELS)[0];
      const jobId = crypto.randomUUID(); await dataStore.createAnalysisJob({ jobId, ownerUserId: user.id, ownerEmail: user.email, provider: input.provider, rateKey: `${input.provider}:${user.apiKeyFingerprints?.[input.provider] || user.id}:${primaryModel}`, mode: input.mode, dedupeKey, cacheKey: prepared.cacheKey, request: input, attempts: 0 }, audioFiles); queue.wake();
      return res.status(202).json({ jobId, status: 'queued', position: 1, deduplicated: false });
    } catch (error) { console.error('Analysis submission failed:', error.message); if (error.statusCode) return res.status(error.statusCode).json({ error: error.message }); if (/rubric|template|placeholder/i.test(error.message)) return res.status(503).json({ error: error.message, errorCode: 'configuration_error', retryable: false }); return res.status(502).json(safeProviderFailure(error)); }
  });

  app.get('/api/analysis-jobs/:jobId', requireAuth, requireReady, async (req, res) => {
    if (!queue) return res.status(404).json({ error: 'Queued analysis is unavailable.' });
    try { const job = await dataStore.getJob(req.session.email, String(req.params.jobId || '')); if (!job) return res.status(404).json({ error: 'Analysis job was not found.' }); if (job.status === 'complete') return res.json({ jobId: job.jobId, status: job.status, result: job.result }); if (job.status === 'failed') return res.json({ jobId: job.jobId, status: job.status, error: job.error }); return res.json({ jobId: job.jobId, status: job.status, position: job.position || 0, createdAt: job.createdAt, startedAt: job.startedAt }); }
    catch (error) { console.error('Analysis job lookup failed:', error.message); return res.status(503).json({ error: 'Analysis status is temporarily unavailable.' }); }
  });

  if (fs.existsSync(DIST_INDEX_PATH)) { app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { index: false })); app.get('/favicon.svg', (req, res) => res.sendFile(path.join(DIST_DIR, 'favicon.svg'))); app.get(['/', '/setup'], (req, res) => res.sendFile(DIST_INDEX_PATH)); }
  else app.get(['/', '/setup', '/10ms-qa-audit-portal.html'], (req, res) => res.sendFile(INDEX_PATH));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' })); return app;
}

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const port = envNumber('PORT', 3000); const dataStore = createMongoStore(); await dataStore.initialize();
    createApp({ dataStore }).listen(port, () => console.log(`QA Auditor listening on port ${port}`));
  })().catch(error => { console.error(`Startup failed: ${error.message}`); process.exit(1); });
}
module.exports = { createApp, createMongoStore, createProviderClient, createSessionManager, createAnalysisCache, createAnalysisQueue, normalizeAnalysisInput, normalizeEmail, qaPrompt, qaMarkdownPrompt, scorecardDocument, scorecardForEditor, parseQaRubric: pipeline.parseQaRubric };
