const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { google } = require('googleapis');
const pipeline = require('./lib/audit-pipeline');

const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, '10ms-qa-audit-portal.html');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(ROOT, 'templates');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const DEFAULT_OPENAI_MODELS = ['gpt-4o-audio-preview', 'gpt-4o-mini-audio-preview'];

function envNumber(name, fallback) { const value = Number.parseInt(process.env[name] || '', 10); return Number.isFinite(value) && value > 0 ? value : fallback; }
function envList(name, fallback) { const value = (process.env[name] || '').split(',').map(item => item.trim()).filter(Boolean); return value.length ? value : fallback; }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function normalizeHeader(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, '_'); }
function safeEqual(left, right) { const a = Buffer.from(String(left || '')); const b = Buffer.from(String(right || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function columnLetter(index) { let result = ''; for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result; return result; }

function rowsToUsers(values) {
  if (!Array.isArray(values) || !values.length) return [];
  const headers = values[0].map(normalizeHeader);
  const indexOf = name => headers.indexOf(normalizeHeader(name));
  const emailIndex = indexOf('User Email');
  const passwordIndex = indexOf('User Password');
  const nameIndex = indexOf('User Name');
  const geminiIndex = indexOf('GEMINI_API_KEY');
  const openaiIndex = indexOf('OPENAI_API_KEY');
  const usageIndex = indexOf('Usage');
  const defaultParameterIndex = indexOf('Default QA Parameter');
  const companyIndex = ['Company Name', 'Company', 'Organization'].map(indexOf).find(index => index >= 0);
  if (emailIndex < 0 || passwordIndex < 0) throw new Error('The user sheet must contain User Email and User Password columns.');
  return values.slice(1).map((row, offset) => ({
    rowNumber: offset + 2, email: normalizeEmail(row[emailIndex]), password: String(row[passwordIndex] || ''),
    name: String(row[nameIndex] || row[emailIndex] || '').trim(), companyName: String(row[companyIndex] || '').trim() || '10 Minute School',
    geminiKey: String(row[geminiIndex] || '').trim(), openaiKey: String(row[openaiIndex] || '').trim(),
    usage: usageIndex >= 0 ? Number.parseInt(row[usageIndex] || '0', 10) || 0 : 0, usageColumn: usageIndex,
    defaultParameter: String(row[defaultParameterIndex] || '').trim(), defaultParameterColumn: defaultParameterIndex
  })).filter(user => user.email);
}

function rowsToProductBriefs(values) {
  if (!Array.isArray(values) || !values.length) return [];
  const headers = values[0].map(normalizeHeader);
  const categoryIndex = headers.indexOf('category');
  const subCategoryIndex = headers.indexOf('sub-category') >= 0 ? headers.indexOf('sub-category') : headers.indexOf('sub_category');
  const briefIndex = headers.indexOf('brief');
  if (categoryIndex < 0 || subCategoryIndex < 0 || briefIndex < 0) throw new Error('The product brief sheet must contain Category, Sub-Category and Brief columns.');
  return values.slice(1).map(row => ({ category: String(row[categoryIndex] || '').trim(), subCategory: String(row[subCategoryIndex] || '').trim(), brief: String(row[briefIndex] || '').trim() })).filter(item => item.category && item.subCategory && item.brief);
}

function groupProductOptions(products) {
  const grouped = new Map();
  for (const product of products) { if (!grouped.has(product.category)) grouped.set(product.category, []); if (!grouped.get(product.category).includes(product.subCategory)) grouped.get(product.category).push(product.subCategory); }
  return Array.from(grouped, ([category, subCategories]) => ({ category, subCategories }));
}

function createGoogleSheetStore(config = {}) {
  const spreadsheetId = config.spreadsheetId || process.env.GOOGLE_SHEETS_ID;
  const sheetName = config.sheetName || process.env.GOOGLE_SHEETS_TAB || 'user';
  const companySheetName = config.companySheetName || process.env.GOOGLE_SHEETS_COMPANY_TAB || 'company';
  const productSheetName = config.productSheetName || process.env.GOOGLE_SHEETS_PRODUCT_TAB || 'product_brief';
  const scorecardSheetName = config.scorecardSheetName || process.env.GOOGLE_SHEETS_SCORECARD_TAB || 'qa_scorecard';
  const auditResultSheetName = config.auditResultSheetName || process.env.GOOGLE_SHEETS_AUDIT_RESULT_TAB || 'audit_result';
  let sheetsClient;
  const quoted = name => `'${name.replace(/'/g, "''")}'`;
  function assertConfigured() { if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID is not configured.'); }
  function getClient() {
    if (sheetsClient) return sheetsClient;
    const authOptions = { scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) authOptions.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    sheetsClient = google.sheets({ version: 'v4', auth: new google.auth.GoogleAuth(authOptions) });
    return sheetsClient;
  }
  async function readValues(range, valueRenderOption = 'UNFORMATTED_VALUE') { assertConfigured(); const response = await getClient().spreadsheets.values.get({ spreadsheetId, range, valueRenderOption }); return response.data.values || []; }
  async function readUsers() { return rowsToUsers(await readValues(`${quoted(sheetName)}!A1:Z1000`)); }
  async function readCompanyName() {
    try { const values = await readValues(`${quoted(companySheetName)}!A1:B20`); if (!values.length) return null; const headers = values[0].map(normalizeHeader); const index = headers.indexOf(normalizeHeader('Company Name')); return String(index >= 0 ? values.slice(1).find(row => row[index])?.[index] : values[0][0] || '').trim() || null; }
    catch (error) { console.error('Company tab lookup skipped:', error.message); return null; }
  }
  async function readProductBriefs() { return rowsToProductBriefs(await readValues(`${quoted(productSheetName)}!A1:C1000`, 'FORMATTED_VALUE')); }
  async function readQaParameters() {
    const values = await readValues(`${quoted(scorecardSheetName)}!A1:B1000`, 'FORMATTED_VALUE');
    const parameters = values.slice(1).map(row => ({ name: String(row[0] || '').trim(), detail: String(row[1] || '').trim() })).filter(item => item.name);
    const names = new Set();
    for (const item of parameters) { if (names.has(item.name.toLowerCase())) throw new Error(`Duplicate QA parameter: ${item.name}.`); names.add(item.name.toLowerCase()); if (!item.detail) throw new Error(`QA parameter ${item.name} has no rubric text.`); }
    if (!parameters.length) throw new Error('No QA parameters are configured.');
    return parameters;
  }
  return {
    async findByEmail(email) { const [users, companyName] = await Promise.all([readUsers(), readCompanyName()]); const user = users.find(item => item.email === normalizeEmail(email)) || null; if (user && companyName) user.companyName = companyName; return user; },
    async getAuditConfiguration() { const [products, parameters] = await Promise.all([readProductBriefs(), readQaParameters()]); return { products: groupProductOptions(products), parameters: parameters.map(item => item.name) }; },
    async getProductBriefs(categories = [], selections = []) { const products = await readProductBriefs(); if (selections.length) { const selected = new Set(selections.map(item => `${item.category}\0${item.subCategory}`)); return products.filter(item => selected.has(`${item.category}\0${item.subCategory}`)); } const set = new Set(categories); return products.filter(item => set.has(item.category)); },
    async getQaParameter(name) { const parameters = await readQaParameters(); return parameters.find(item => item.name.toLowerCase() === String(name || '').trim().toLowerCase()) || null; },
    async saveDefaultParameter(email, parameter) { const users = await readUsers(); const user = users.find(item => item.email === normalizeEmail(email)); if (!user || user.defaultParameterColumn < 0) throw new Error('Default QA Parameter column is unavailable.'); const cell = `${columnLetter(user.defaultParameterColumn)}${user.rowNumber}`; await getClient().spreadsheets.values.update({ spreadsheetId, range: `${quoted(sheetName)}!${cell}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[parameter]] } }); return true; },
    async appendAuditResults(rows) { if (!rows.length) return 0; await getClient().spreadsheets.values.append({ spreadsheetId, range: `${quoted(auditResultSheetName)}!A:K`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: rows } }); return rows.length; },
    async incrementUsage(email) { const users = await readUsers(); const user = users.find(item => item.email === normalizeEmail(email)); if (!user || user.usageColumn < 0) return false; const cell = `${columnLetter(user.usageColumn)}${user.rowNumber}`; await getClient().spreadsheets.values.update({ spreadsheetId, range: `${quoted(sheetName)}!${cell}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[user.usage + 1]] } }); return true; }
  };
}

function publicUser(user) { return { email: user.email, name: user.name, companyName: user.companyName || '10 Minute School', providers: [user.geminiKey ? 'gemini' : null, user.openaiKey ? 'openai' : null].filter(Boolean) }; }
function createAnalysisCache(config = {}) {
  const ttlMs = config.ttlMs || envNumber('AI_CACHE_TTL_MS', 6 * 60 * 60 * 1000); const maxEntries = config.maxEntries || envNumber('AI_CACHE_MAX_ENTRIES', 100); const entries = new Map();
  function prune() { const now = Date.now(); for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key); while (entries.size > maxEntries) entries.delete(entries.keys().next().value); }
  return { get(key) { prune(); const entry = entries.get(key); if (!entry) return null; entries.delete(key); entries.set(key, entry); return entry.value; }, set(key, value) { prune(); entries.set(key, { value, expiresAt: Date.now() + ttlMs }); prune(); }, size() { prune(); return entries.size; } };
}
function analysisCacheKey(user, provider, prompt, files) { const hash = crypto.createHash('sha256').update(`${user.email}\0${provider}\0${prompt}`); for (const file of files) hash.update(`\0${file.name}\0${file.mimeType}\0${file.data}`); return hash.digest('hex'); }
function parseCookies(header) { return String(header || '').split(';').reduce((result, item) => { const at = item.indexOf('='); if (at >= 0) result[item.slice(0, at).trim()] = decodeURIComponent(item.slice(at + 1).trim()); return result; }, {}); }
function createSessionManager() {
  const sessions = new Map(); const prune = () => { const now = Date.now(); for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token); };
  return { create(email, activeParameter = '') { prune(); const token = crypto.randomBytes(32).toString('base64url'); sessions.set(token, { email, activeParameter, expiresAt: Date.now() + SESSION_TTL_MS }); return token; }, get(token) { prune(); const session = sessions.get(token); return session && session.expiresAt > Date.now() ? session : null; }, setParameter(token, parameter) { const session = sessions.get(token); if (!session) return false; session.activeParameter = parameter; return true; }, destroy(token) { sessions.delete(token); }, size() { prune(); return sessions.size; } };
}
function setSessionCookie(res, token, secure) { res.setHeader('Set-Cookie', `qa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`); }
function clearSessionCookie(res, secure) { res.setHeader('Set-Cookie', `qa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`); }
function isSameOrigin(req, allowedOrigins) { const origin = req.get('origin'); return !origin || (allowedOrigins.length ? allowedOrigins.includes(origin) : origin === `${req.protocol}://${req.get('host')}`); }
function validateAudioFiles(files) { if (!Array.isArray(files) || !files.length) throw new Error('Upload at least one audio file.'); return files.map(file => { if (!file || typeof file.data !== 'string' || !String(file.mimeType || '').startsWith('audio/')) throw new Error('Only audio files are supported.'); const bytes = Math.ceil(Buffer.byteLength(file.data, 'base64')); if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('Invalid audio data.'); return { data: file.data, mimeType: String(file.mimeType), name: String(file.name || 'audio').slice(0, 200) }; }); }
function parseJsonText(text) { const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); try { return JSON.parse(cleaned); } catch { throw new Error('The AI returned malformed structured JSON.'); } }

function createProviderClient(config = {}) {
  const fetchImpl = config.fetchImpl || fetch; const geminiModels = config.geminiModels || envList('GEMINI_MODELS', DEFAULT_GEMINI_MODELS); const openaiModels = config.openaiModels || envList('OPENAI_MODELS', DEFAULT_OPENAI_MODELS);
  async function callGemini(apiKey, audioFiles, prompt, schema) {
    const payload = { contents: [{ parts: [{ text: prompt }, ...audioFiles.map(file => ({ inlineData: { mimeType: file.mimeType, data: file.data } }))] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: schema } }; let lastError = 'No supported Gemini model responded.'; let lastStatus;
    for (const model of geminiModels) { const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (response.ok) { const text = data.candidates?.[0]?.content?.parts?.find(part => part.text)?.text; if (text) return parseJsonText(text); lastError = 'Gemini returned no structured result.'; continue; } const message = String(data.error?.message || 'Gemini request failed'); console.error(`Gemini model ${model} returned HTTP ${response.status}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`); if (response.status === 404 || response.status === 429 || response.status >= 500 || /not found|deprecated|not supported/i.test(message)) { lastError = message; lastStatus = response.status; continue; } const error = new Error(`Gemini request rejected (HTTP ${response.status}).`); error.providerStatus = response.status; throw error; }
    const error = new Error(lastError); if (lastStatus) error.providerStatus = lastStatus; throw error;
  }
  async function callOpenAI(apiKey, audioFiles, prompt, schema) {
    const content = [{ type: 'text', text: `${prompt}\n\nReturn JSON only matching this schema: ${JSON.stringify(schema)}` }, ...audioFiles.map(file => ({ type: 'input_audio', input_audio: { data: file.data, format: /wav/i.test(`${file.mimeType} ${file.name}`) ? 'wav' : 'mp3' } }))]; let lastError = 'No supported OpenAI model responded.';
    for (const model of openaiModels) { const response = await fetchImpl('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, modalities: ['text'], response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }) }); const data = await response.json().catch(() => ({})); if (response.ok) { const text = data.choices?.[0]?.message?.content; if (text) return parseJsonText(text); lastError = 'OpenAI returned no structured result.'; continue; } const message = String(data.error?.message || 'OpenAI request failed'); console.error(`OpenAI model ${model} returned HTTP ${response.status}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`); if (response.status === 404 || response.status === 429 || response.status >= 500 || /not found|deprecated|not supported|model/i.test(message)) { lastError = message; continue; } const error = new Error(`OpenAI request rejected (HTTP ${response.status}).`); error.providerStatus = response.status; throw error; }
    throw new Error(lastError);
  }
  return { async callStructured(provider, key, files, prompt, schema) { return provider === 'gemini' ? callGemini(key, files, prompt, schema) : callOpenAI(key, files, prompt, schema); }, callGemini, callOpenAI };
}

function productContext(products) { return products.length ? products.map(item => `[${item.category} / ${item.subCategory}]\n${item.brief}`).join('\n\n') : 'No product was selected. Do a generic evaluation and do not assume product-specific facts.'; }
function qaPrompt(company, rubric, products, fileName) {
  const ceRules = rubric.criticalErrors.length ? rubric.criticalErrors.map(rule => `- ${rule}`).join('\n') : '- No CE rules are configured.';
  return `Analyze exactly one call (${fileName}) as a QA evaluator for ${company}. Write every narrative field in Bangla and cite precise [MM:SS] timestamps. Score every rubric row exactly once using its exact category, parameter, and maximum. Preserve raw achieved points.

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
function summaryPrompt(company, parameter, results) { const compact = results.map(result => ({ file: result.fileName, agent: result.agentName, score: result.finalScore, ce: result.ceDetected, deductions: result.deductionJustifications })); return `Create a concise Bangla run summary for ${company} using only these validated successful ${parameter} QA results. Identify recurring issues, compare best/worst calls, and give actionable recommendations.\n${JSON.stringify(compact)}`; }
function voicePrompt(company, products, count) { return `Analyze ${count} calls for ${company} as a Customer Insights analyst. Return one Bangla summary grounded only in the recordings. Include precise timestamps where useful. This is not a QA scorecard and must not score calls.\n\nPRODUCT CONTEXT:\n${productContext(products)}`; }
function coachingPrompt(company, rubric, products, count) { return `Analyze ${count} calls for ${company} as a senior sales communication coach. Return one Bangla coaching summary with precise [MM:SS] timestamps. Use the selected ${rubric.name} rubric only as coaching context; do not produce scores.\n\nPRODUCT CONTEXT:\n${productContext(products)}\n\nLIVE RUBRIC:\n${rubric.source}`; }

function createApp(options = {}) {
  const app = express(); const sheetStore = options.sheetStore || createGoogleSheetStore(); const providerClient = options.providerClient || createProviderClient(); const sessions = options.sessions || createSessionManager(); const analysisCache = options.analysisCache || createAnalysisCache(); const templateDir = options.templateDir || TEMPLATE_DIR;
  const allowedOrigins = options.allowedOrigins || envList('PUBLIC_ORIGINS', process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : []); const secureCookies = options.secureCookies ?? (process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : String(process.env.COOKIE_SECURE).toLowerCase() === 'true'); const usageLocks = new Map();
  app.disable('x-powered-by'); app.set('trust proxy', options.trustProxy ?? (process.env.NODE_ENV === 'production' ? 1 : false)); app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })); app.use((req, res, next) => { const token = parseCookies(req.headers.cookie).qa_session; req.sessionToken = token; req.session = token ? sessions.get(token) : null; next(); });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again later.' } }); const requireAuth = (req, res, next) => req.session ? next() : res.status(401).json({ error: 'Authentication required.' }); const requireSameOrigin = (req, res, next) => isSameOrigin(req, allowedOrigins) ? next() : res.status(403).json({ error: 'Invalid request origin.' }); const jsonSmall = express.json({ limit: '20kb' });
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.post('/api/login', loginLimiter, requireSameOrigin, jsonSmall, async (req, res) => { const email = normalizeEmail(req.body?.email); const password = String(req.body?.password || ''); if (!email || !password || email.length > 320 || password.length > 512) return res.status(401).json({ error: 'Invalid email or password.' }); try { const user = await sheetStore.findByEmail(email); if (!user || !safeEqual(user.password, password)) return res.status(401).json({ error: 'Invalid email or password.' }); const token = sessions.create(user.email, user.defaultParameter || 'Outbound'); setSessionCookie(res, token, secureCookies); return res.json({ user: publicUser(user) }); } catch (error) { console.error('Login lookup failed:', error.message); return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' }); } });
  app.get('/api/session', requireAuth, async (req, res) => { try { const user = await sheetStore.findByEmail(req.session.email); if (!user) { sessions.destroy(req.sessionToken); clearSessionCookie(res, secureCookies); return res.status(401).json({ error: 'Session is no longer valid.' }); } return res.json({ user: publicUser(user) }); } catch (error) { console.error('Session lookup failed:', error.message); return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' }); } });
  app.get('/api/audit-config', requireAuth, async (req, res) => { try { const [configuration, user] = await Promise.all([sheetStore.getAuditConfiguration(), sheetStore.findByEmail(req.session.email)]); if (!user) return res.status(401).json({ error: 'Session is no longer valid.' }); const saved = configuration.parameters.includes(user.defaultParameter) ? user.defaultParameter : configuration.parameters[0]; const active = configuration.parameters.includes(req.session.activeParameter) ? req.session.activeParameter : saved; sessions.setParameter(req.sessionToken, active); return res.json({ products: configuration.products, parameters: configuration.parameters, savedDefaultParameter: saved, activeParameter: active }); } catch (error) { console.error('Audit configuration lookup failed:', error.message); return res.status(503).json({ error: 'Audit configuration is temporarily unavailable.' }); } });
  async function validateParameter(req, res) { const parameter = String(req.body?.parameter || '').trim(); if (!parameter) { res.status(400).json({ error: 'Choose a QA parameter.' }); return null; } const entry = await sheetStore.getQaParameter(parameter); if (!entry) { res.status(400).json({ error: 'The selected QA parameter is no longer available.' }); return null; } return entry.name; }
  app.put('/api/session/parameter', requireSameOrigin, requireAuth, jsonSmall, async (req, res) => { try { const parameter = await validateParameter(req, res); if (!parameter) return; sessions.setParameter(req.sessionToken, parameter); return res.json({ activeParameter: parameter }); } catch (error) { console.error('Parameter selection failed:', error.message); return res.status(503).json({ error: 'The parameter could not be updated.' }); } });
  app.put('/api/user/default-parameter', requireSameOrigin, requireAuth, jsonSmall, async (req, res) => { try { const parameter = await validateParameter(req, res); if (!parameter) return; await sheetStore.saveDefaultParameter(req.session.email, parameter); sessions.setParameter(req.sessionToken, parameter); return res.json({ savedDefaultParameter: parameter, activeParameter: parameter }); } catch (error) { console.error('Default parameter update failed:', error.message); return res.status(503).json({ error: 'The default parameter could not be saved.' }); } });
  app.post('/api/logout', requireSameOrigin, (req, res) => { if (req.sessionToken) sessions.destroy(req.sessionToken); clearSessionCookie(res, secureCookies); res.json({ ok: true }); });

  app.post('/api/analyze', requireSameOrigin, requireAuth, express.json({ limit: Infinity }), async (req, res) => {
    const provider = String(req.body?.provider || '').toLowerCase(); const mode = String(req.body?.mode || 'single');
    if (!['gemini', 'openai'].includes(provider)) return res.status(400).json({ error: 'Unsupported AI provider.' }); if (!['single', 'voice', 'coaching'].includes(mode)) return res.status(400).json({ error: 'Unsupported analysis mode.' });
    const categories = [...new Set((Array.isArray(req.body?.categories) ? req.body.categories : []).map(item => String(item || '').trim()).filter(Boolean))]; const selections = (Array.isArray(req.body?.productSelections) ? req.body.productSelections : []).map(item => ({ category: String(item?.category || '').trim(), subCategory: String(item?.subCategory || '').trim() })).filter(item => item.category && item.subCategory);
    if (categories.length > 50 || selections.length > 200 || categories.some(item => item.length > 300) || selections.some(item => item.category.length > 300 || item.subCategory.length > 500)) return res.status(400).json({ error: 'Invalid product selection.' });
    let audioFiles; try { audioFiles = validateAudioFiles(req.body?.audioFiles); } catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      const user = await sheetStore.findByEmail(req.session.email); if (!user) return res.status(401).json({ error: 'Session is no longer valid.' }); const apiKey = provider === 'gemini' ? user.geminiKey : user.openaiKey; if (!apiKey) return res.status(400).json({ error: `No ${provider} API key is configured for this account.` });
      const products = await sheetStore.getProductBriefs(categories, selections); if ((categories.length || selections.length) && !products.length) return res.status(400).json({ error: 'The selected product briefs were not found.' });
      let parameter = ''; let rubric = null;
      if (mode !== 'voice') { parameter = String(req.body?.parameter || '').trim(); if (!parameter) return res.status(400).json({ error: 'Choose a QA parameter.' }); const entry = await sheetStore.getQaParameter(parameter); if (!entry) return res.status(400).json({ error: 'The selected QA parameter is no longer available.' }); rubric = pipeline.parseQaRubric(entry.name, entry.detail); parameter = entry.name; sessions.setParameter(req.sessionToken, parameter); }
      const templateKeys = mode === 'single' ? ['qaCall', 'qaSummary'] : [mode]; const templates = pipeline.loadAndValidateTemplates(templateDir, templateKeys); const timestamp = new Date().toISOString(); const evaluationDate = timestamp.slice(0, 10); let responseBody;
      if (mode === 'single') {
        const items = []; const results = []; const successfulNames = [];
        for (const file of audioFiles) {
          try { const structured = await providerClient.callStructured(provider, apiKey, [file], qaPrompt(user.companyName, rubric, products, file.name), pipeline.qaSchema(rubric)); const result = pipeline.validateQaResult(structured, rubric); const markdown = pipeline.renderQaCall(templates.qaCall, result, user.companyName, evaluationDate); result.fileName = file.name; results.push(result); successfulNames.push(file.name); items.push({ kind: 'call', fileName: file.name, status: 'success', markdown, score: result.finalScore, maximum: result.maximum, ce: result.ceDetected }); }
          catch (error) { console.error(`Call analysis failed for ${file.name}:`, error.message); items.push({ kind: 'call', fileName: file.name, status: 'failed', error: 'This call could not be evaluated. No Sheet row was created.' }); }
        }
        if (!results.length) return res.status(502).json({ error: 'None of the uploaded calls could be evaluated.', items, partial: true, auditResultWrite: { status: 'not_saved', savedRows: 0 } });
        try { const structured = await providerClient.callStructured(provider, apiKey, [], summaryPrompt(user.companyName, parameter, results), pipeline.SUMMARY_SCHEMA); const summary = pipeline.validateSummaryResult(structured); items.push({ kind: 'summary', status: 'success', markdown: pipeline.renderQaSummary(templates.qaSummary, summary, results, successfulNames, user.companyName, parameter, evaluationDate) }); }
        catch (error) { console.error('QA run summary failed:', error.message); items.push({ kind: 'summary', status: 'failed', error: 'The run summary could not be generated.' }); }
        let auditResultWrite = { status: 'saved', savedRows: results.length }; try { await sheetStore.appendAuditResults(results.map(result => pipeline.auditResultRow(result, parameter, timestamp))); } catch (error) { console.error('Audit result storage failed:', error.message); auditResultWrite = { status: 'failed', savedRows: 0, message: 'Reports were generated, but the audit results were not saved to Google Sheets.' }; }
        responseBody = { mode, items, report: items.filter(item => item.markdown).map(item => item.markdown).join('\n\n---\n\n'), partial: items.some(item => item.status === 'failed') || auditResultWrite.status === 'failed', auditResultWrite, cached: false };
      } else {
        const prompt = mode === 'voice' ? voicePrompt(user.companyName, products, audioFiles.length) : coachingPrompt(user.companyName, rubric, products, audioFiles.length); const schema = mode === 'voice' ? pipeline.VOICE_SCHEMA : pipeline.COACHING_SCHEMA; const template = templates[mode]; const cacheKey = analysisCacheKey(user, provider, `${prompt}\n${template}`, audioFiles); const cached = analysisCache.get(cacheKey); if (cached) return res.json({ ...cached, cached: true });
        const structured = await providerClient.callStructured(provider, apiKey, audioFiles, prompt, schema); const markdown = mode === 'voice' ? pipeline.renderVoice(template, pipeline.validateVoiceResult(structured), audioFiles.length) : pipeline.renderCoaching(template, pipeline.validateCoachingResult(structured), user.companyName); responseBody = { mode, items: [{ kind: mode, status: 'success', markdown }], report: markdown, partial: false, auditResultWrite: { status: 'not_applicable', savedRows: 0 }, cached: false }; analysisCache.set(cacheKey, responseBody);
      }
      const previous = usageLocks.get(user.email) || Promise.resolve(); const next = previous.catch(() => {}).then(() => sheetStore.incrementUsage(user.email)); usageLocks.set(user.email, next); await next.catch(error => console.error('Usage update failed:', error.message)); if (usageLocks.get(user.email) === next) usageLocks.delete(user.email); return res.json(responseBody);
    } catch (error) { console.error('Analysis failed:', error.message); if (/rubric|template|placeholder/i.test(error.message)) return res.status(503).json({ error: error.message }); const suffix = Number.isInteger(error.providerStatus) ? ` (provider HTTP ${error.providerStatus})` : ''; return res.status(502).json({ error: `The AI analysis could not be completed${suffix}.` }); }
  });

  if (fs.existsSync(DIST_INDEX_PATH)) { app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { index: false })); app.get('/favicon.svg', (req, res) => res.sendFile(path.join(DIST_DIR, 'favicon.svg'))); app.get('/', (req, res) => res.sendFile(DIST_INDEX_PATH)); }
  else app.get(['/', '/10ms-qa-audit-portal.html'], (req, res) => res.sendFile(INDEX_PATH));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' })); return app;
}

if (require.main === module) { require('dotenv').config(); const port = envNumber('PORT', 3000); createApp().listen(port, () => console.log(`QA Auditor listening on port ${port}`)); }
module.exports = { createApp, createGoogleSheetStore, createProviderClient, createSessionManager, createAnalysisCache, rowsToUsers, rowsToProductBriefs, groupProductOptions, normalizeEmail, qaPrompt, parseQaRubric: pipeline.parseQaRubric };
