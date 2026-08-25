const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp, createProviderClient, rowsToUsers, rowsToProductBriefs, parseQaRubric, qaPrompt } = require('../server');
const { loadTemplate, loadAndValidateTemplates, renderTemplate, validateQaResult, renderQaCall, qaSchema } = require('../lib/audit-pipeline');

const RUBRIC = `১. Greetings (৫ নম্বর)\n- Greetings (২)\n- Permission (৩)\n\n২. Closing (৫ নম্বর)\n- Summary (২)\n- Goodbye (৩)\n\nCritical Errors\n- Wrong information\n- Rudeness`;

function fakeStore(options = {}) {
  const users = [{ email: 'user@example.com', password: 'plain-password', name: 'Test User', companyName: 'Robi', geminiKey: 'gemini-secret', openaiKey: 'openai-secret', usage: 0, defaultParameter: 'Outbound', defaultParameterColumn: 6 }];
  const writes = [];
  return {
    users, writes,
    async findByEmail(email) { return users.find(user => user.email === email) || null; },
    async getAuditConfiguration() { return { products: [{ category: 'HSC 28', subCategories: ['PCMB', 'BEI'] }], parameters: ['Outbound', 'Inbound'] }; },
    async getProductBriefs(categories, selections) { const products = [{ category: 'HSC 28', subCategory: 'PCMB', brief: 'Official PCMB facts' }, { category: 'HSC 28', subCategory: 'BEI', brief: 'Official BEI facts' }]; if (selections.length) return products.filter(product => selections.some(item => item.category === product.category && item.subCategory === product.subCategory)); return products.filter(product => categories.includes(product.category)); },
    async getQaParameter(name) { return ['Outbound', 'Inbound'].includes(name) ? { name, detail: options.malformedRubric ? 'not a rubric' : RUBRIC } : null; },
    async saveDefaultParameter(email, parameter) { users.find(user => user.email === email).defaultParameter = parameter; return true; },
    async appendAuditResults(rows) { if (options.writeFailure) throw new Error('write failed'); writes.push(...rows); return rows.length; },
    async incrementUsage(email) { users.find(user => user.email === email).usage += 1; return true; }
  };
}

function qaResult(overrides = {}) {
  return {
    agent_name: 'Agent One', call_summary: 'কল সারাংশ', client_type_and_need: 'শিক্ষার্থী', call_duration_and_tone: '১ মিনিট, পেশাদার',
    product_fact_check: 'সঠিক', ce_detected: false, ce_audit_details: 'CE নেই', ce_alert: 'Non-CE',
    scores: [
      { category: 'Greetings', parameter: 'Greetings', maximum: 2, achieved: 2, timestamp: '[00:01]', deduction_reason: '—' },
      { category: 'Greetings', parameter: 'Permission', maximum: 3, achieved: 2, timestamp: '[00:03]', deduction_reason: 'এক নম্বর কাটা' },
      { category: 'Closing', parameter: 'Summary', maximum: 2, achieved: 2, timestamp: '[00:50]', deduction_reason: '—' },
      { category: 'Closing', parameter: 'Goodbye', maximum: 3, achieved: 3, timestamp: '[00:55]', deduction_reason: '—' }
    ],
    deduction_justifications: [{ timestamp: '[00:03]', detail: 'Permission উন্নত করুন' }], strengths: [{ timestamp: '[00:01]', detail: 'ভালো সম্ভাষণ' }],
    script_corrections: [{ timestamp: '[00:03]', wrong: 'দুর্বল কথা', correct: 'সঠিক কথা' }], actionable_tips: [{ timestamp: '[00:03]', detail: 'প্রোবিং করুন' }], overall_status: 'ভালো', ...overrides
  };
}

function fakeProviders(options = {}) {
  return {
    calls: [],
    async callStructured(provider, key, files, prompt, schema) {
      this.calls.push({ provider, key, files, prompt, schema });
      if (options.failFile && files[0]?.name === options.failFile) throw new Error('provider failed');
      if (schema.properties?.scores) return qaResult(options.qaOverrides || {});
      if (schema.properties?.recurring_issues) return { recurring_issues: ['একটি সমস্যা'], best_and_worst_calls: 'তুলনা', overall_recommendations: ['কোচিং দিন'] };
      if (schema.properties?.customer_questions) return { advisors_list: 'Agent One', overall_sentiment: 'ইতিবাচক', customer_profile: 'শিক্ষার্থী', customer_need: 'কোর্স', customer_questions: ['মূল্য কত?'], barriers: ['বাজেট'], product_feedback: ['ভালো'], advisor_name: 'Agent One', objection_handling_assessment: 'ভালো', improvement_areas: ['আরও শুনুন'], actionable_recommendations: ['ফলো আপ'] };
      return { advisor_name: 'Agent One', call_topic: 'কোর্স', sales_pitch_audit: ['[00:10] ভালো'], tone_pitch_analysis: ['[00:20] আত্মবিশ্বাসী'], talk_to_listen_ratio: '60:40', listening_skill_notes: 'ভালো', probing_gap_notes: 'আরও প্রশ্ন', script_corrections: [{ timestamp: '[00:30]', wrong: 'পুরনো', correct: 'নতুন' }], weekly_growth_plan: ['অনুশীলন'] };
    }
  };
}

function payload(overrides = {}) { return { provider: 'gemini', mode: 'single', parameter: 'Outbound', categories: [], productSelections: [], audioFiles: [{ name: 'call.wav', mimeType: 'audio/wav', data: Buffer.from('audio').toString('base64') }], ...overrides }; }
async function login(agent) { const response = await agent.post('/api/login').send({ email: 'user@example.com', password: 'plain-password' }); assert.equal(response.status, 200); }

test('maps user defaults and product sheet headers', () => {
  const users = rowsToUsers([['User Email', 'User Password', 'User Name', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'Usage', 'Default QA Parameter'], ['USER@example.com', 'pw', 'User', 'g', '', '3', 'Inbound']]);
  assert.equal(users[0].email, 'user@example.com'); assert.equal(users[0].defaultParameter, 'Inbound'); assert.equal(users[0].defaultParameterColumn, 6);
  assert.deepEqual(rowsToProductBriefs([['Category', 'Sub-Category', 'Brief'], ['HSC', 'Science', 'Facts']]), [{ category: 'HSC', subCategory: 'Science', brief: 'Facts' }]);
});

test('parses Bengali numerals, categories, rows, weights, and CE rules', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  assert.equal(rubric.categories.length, 2); assert.equal(rubric.rows.length, 4); assert.equal(rubric.maximum, 10); assert.deepEqual(rubric.criticalErrors, ['Wrong information', 'Rudeness']);
});

test('reconciles raw points and zeros only the CE final score', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  const result = validateQaResult(qaResult({ ce_detected: true }), rubric);
  assert.equal(result.achievedScore, 9); assert.equal(result.deductedScore, 1); assert.equal(result.finalScore, 0);
  assert.throws(() => validateQaResult(qaResult({ scores: qaResult().scores.slice(1) }), rubric), /required/);
});

test('accepts empty optional QA narratives and derives safe report content from scores', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  const result = validateQaResult(qaResult({ deduction_justifications: [], strengths: [], actionable_tips: [] }), rubric);
  assert.match(result.deductionJustifications[0], /Permission/);
  assert.ok(result.strengths.length > 0);
  assert.ok(result.actionableTips.length > 0);
  assert.match(result.actionableTips[0], /^\[00:03\]/);
});

test('requires precise call times for QA evidence and coaching suggestions', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  const result = validateQaResult(qaResult(), rubric);
  assert.match(result.deductionJustifications[0], /^\[00:03\]/);
  assert.match(result.strengths[0], /^\[00:01\]/);
  assert.match(result.actionableTips[0], /^\[00:03\]/);
  assert.throws(() => validateQaResult(qaResult({ actionable_tips: [{ timestamp: '', detail: 'প্রোবিং করুন' }] }), rubric), /timestamp/);
});

test('constrains every Gemini score position to the exact live rubric row and weight', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  const schema = qaSchema(rubric).properties.scores;
  assert.equal(schema.prefixItems.length, rubric.rows.length);
  assert.deepEqual(schema.prefixItems[1].properties.category.enum, ['Greetings']);
  assert.deepEqual(schema.prefixItems[1].properties.parameter.enum, ['Permission']);
  assert.deepEqual(schema.prefixItems[1].properties.maximum.enum, [3]);
  const narrativeSchema = qaSchema(rubric).properties.actionable_tips.items;
  assert.deepEqual(narrativeSchema.required, ['timestamp', 'detail']);
});

test('validates placeholders and reloads templates from disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-template-'));
  fs.writeFileSync(path.join(dir, 'customer_voice_template.md'), '{{total_calls_analyzed}} {{advisors_list}} {{overall_sentiment}} {{customer_profile}} {{customer_need}} {{customer_questions_list}} {{barriers_list}} {{product_feedback_list}} {{advisor_name}} {{objection_handling_assessment}} {{improvement_areas}} {{actionable_recommendations}}');
  assert.match(loadTemplate(dir, 'voice'), /total_calls_analyzed/);
  fs.appendFileSync(path.join(dir, 'customer_voice_template.md'), '\nEDITED');
  assert.match(loadTemplate(dir, 'voice'), /EDITED/);
  assert.equal(renderTemplate('{{company_name}}', { company_name: 'Robi' }), 'Robi');
});

test('approved templates render as document headings and real Markdown tables', async () => {
  const templates = loadAndValidateTemplates(path.join(__dirname, '..', 'templates'), ['qaCall', 'qaSummary', 'coaching', 'voice']);
  assert.match(templates.qaCall, /^<!--[\s\S]*?# 📊/);
  assert.match(templates.qaSummary, /\| :--- \| ---: \|/);
  assert.match(templates.coaching, /^<!--[\s\S]*?# 🎯/);
  assert.match(templates.voice, /^<!--[\s\S]*?# 🗣️/);

  const rubric = parseQaRubric('Outbound', RUBRIC);
  const result = validateQaResult(qaResult(), rubric);
  const report = renderQaCall(templates.qaCall, result, 'Robi', '2026-08-25');
  assert.match(report, /^# 📊 Robi - QA Audit/);
  assert.match(report, /\| :--- \| ---: \| ---: \|/);
  assert.match(report, /\| \*\*Greetings\*\*<br>Permission \| 3 \| 2 \| 1 \|/);
  assert.match(report, /## ৭\. অ্যাকশনেবল পরামর্শ/);
  const { marked } = await import('marked');
  const html = marked.parse(report);
  assert.match(html, /<h1>.*Robi - QA Audit/);
  assert.match(html, /<table>/);
  assert.match(html, /<th[^>]*>প্যারামিটার<\/th>/);
});

test('sends full JSON Schema through Gemini responseJsonSchema, not the legacy OpenAPI field', async () => {
  let requestBody;
  const client = createProviderClient({
    geminiModels: ['gemini-test'],
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }; } };
    }
  });
  const schema = { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string' } } };
  const result = await client.callStructured('gemini', 'test-key', [], 'Return a status.', schema);
  assert.deepEqual(result, { status: 'ok' });
  assert.deepEqual(requestBody.generationConfig.responseJsonSchema, schema);
  assert.equal(requestBody.generationConfig.temperature, 0);
  assert.equal('responseSchema' in requestBody.generationConfig, false);
});

test('makes the live CE rules and rudeness zero-score override explicit', () => {
  const rubric = parseQaRubric('Outbound', RUBRIC);
  const prompt = qaPrompt('Robi', rubric, [], 'call.mp3');
  assert.match(prompt, /STRICT ZERO-SCORE OVERRIDE/);
  assert.match(prompt, /direct scolding, shaming, belittling/);
  assert.match(prompt, /Never describe a listed CE in the evidence while returning ce_detected false/);
  assert.match(prompt, /- Rudeness/);
});

test('uses full Gemini Flash before Flash Lite when the primary model is unavailable', async () => {
  const previous = process.env.GEMINI_MODELS;
  delete process.env.GEMINI_MODELS;
  const requestedModels = [];
  try {
    const client = createProviderClient({
      fetchImpl: async url => {
        requestedModels.push(url);
        if (requestedModels.length === 1) return { ok: false, status: 429, async json() { return { error: { message: 'Quota exceeded' } }; } };
        return { ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }; } };
      }
    });
    await client.callStructured('gemini', 'test-key', [], 'Return ok.', { type: 'object', properties: { status: { type: 'string' } } });
  } finally {
    if (previous === undefined) delete process.env.GEMINI_MODELS;
    else process.env.GEMINI_MODELS = previous;
  }
  assert.match(requestedModels[0], /gemini-3\.6-flash/);
  assert.match(requestedModels[1], /gemini-3\.5-flash:generateContent/);
  assert.doesNotMatch(requestedModels[1], /flash-lite/);
});

test('falls back to the next Gemini model on quota or temporary provider errors', async () => {
  const requestedModels = [];
  const client = createProviderClient({
    geminiModels: ['primary-model', 'fallback-model'],
    fetchImpl: async url => {
      requestedModels.push(url);
      if (url.includes('primary-model')) return { ok: false, status: 503, async json() { return { error: { message: 'High demand' } }; } };
      return { ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] }; } };
    }
  });
  const result = await client.callStructured('gemini', 'test-key', [], 'Return ok.', { type: 'object', properties: { status: { type: 'string' } } });
  assert.deepEqual(result, { status: 'ok' });
  assert.equal(requestedModels.length, 2);
  assert.match(requestedModels[1], /fallback-model/);
});

test('auth config returns parameters and session/default behavior without secrets', async () => {
  const store = fakeStore(); const app = createApp({ sheetStore: store, providerClient: fakeProviders() }); const agent = request.agent(app); await login(agent);
  const config = await agent.get('/api/audit-config'); assert.equal(config.status, 200); assert.deepEqual(config.body.parameters, ['Outbound', 'Inbound']); assert.equal(config.body.activeParameter, 'Outbound'); assert.equal('scorecard' in config.body, false); assert.equal(JSON.stringify(config.body).includes('secret'), false);
  assert.equal((await agent.put('/api/session/parameter').send({ parameter: 'Inbound' })).status, 200);
  assert.equal((await agent.get('/api/audit-config')).body.activeParameter, 'Inbound'); assert.equal(store.users[0].defaultParameter, 'Outbound');
  assert.equal((await agent.put('/api/user/default-parameter').send({ parameter: 'Inbound' })).status, 200); assert.equal(store.users[0].defaultParameter, 'Inbound');
});

test('trusts one configured proxy hop for Cloudflare forwarded client addresses', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders(), trustProxy: 1 });
  assert.equal(app.get('trust proxy'), 1);
  const response = await request(app).post('/api/login').set('X-Forwarded-For', '203.0.113.10').send({ email: 'user@example.com', password: 'plain-password' });
  assert.equal(response.status, 200);
});

test('requires parameter for QA and coaching but ignores it for Customer Voice', async () => {
  const providers = fakeProviders(); const app = createApp({ sheetStore: fakeStore(), providerClient: providers }); const agent = request.agent(app); await login(agent);
  assert.equal((await agent.post('/api/analyze').send(payload({ parameter: '' }))).status, 400);
  assert.equal((await agent.post('/api/analyze').send(payload({ mode: 'coaching', parameter: '' }))).status, 400);
  const voice = await agent.post('/api/analyze').send(payload({ mode: 'voice', parameter: 'Does not exist' })); assert.equal(voice.status, 200); assert.equal(providers.calls[0].prompt.includes('LIVE RUBRIC'), false);
});

test('QA analyzes each file, renders ordered items, appends exact A:K rows, and never caches re-audits', async () => {
  const store = fakeStore(); const providers = fakeProviders(); const app = createApp({ sheetStore: store, providerClient: providers }); const agent = request.agent(app); await login(agent);
  const audioFiles = ['a.wav', 'b.wav'].map(name => ({ name, mimeType: 'audio/wav', data: Buffer.from(name).toString('base64') }));
  const first = await agent.post('/api/analyze').send(payload({ audioFiles })); assert.equal(first.status, 200); assert.deepEqual(first.body.items.map(item => item.kind), ['call', 'call', 'summary']); assert.match(first.body.report, /Robi - QA Audit/); assert.equal(store.writes.length, 2); assert.equal(store.writes[0].length, 11); assert.equal(store.writes[0][2], 'Outbound'); assert.equal(store.writes[0][3], 9); assert.equal(store.users[0].usage, 1);
  const second = await agent.post('/api/analyze').send(payload({ audioFiles })); assert.equal(second.body.cached, false); assert.equal(store.writes.length, 4); assert.equal(providers.calls.length, 6); assert.equal(store.users[0].usage, 2);
});

test('partial QA keeps and stores successful calls only', async () => {
  const store = fakeStore(); const app = createApp({ sheetStore: store, providerClient: fakeProviders({ failFile: 'bad.wav' }) }); const agent = request.agent(app); await login(agent);
  const response = await agent.post('/api/analyze').send(payload({ audioFiles: ['good.wav', 'bad.wav'].map(name => ({ name, mimeType: 'audio/wav', data: Buffer.from(name).toString('base64') })) }));
  assert.equal(response.status, 200); assert.equal(response.body.partial, true); assert.equal(response.body.items[1].status, 'failed'); assert.equal(store.writes.length, 1); assert.equal(store.users[0].usage, 1);
});

test('sheet write failure returns reports with a prominent unsaved status', async () => {
  const app = createApp({ sheetStore: fakeStore({ writeFailure: true }), providerClient: fakeProviders() }); const agent = request.agent(app); await login(agent);
  const response = await agent.post('/api/analyze').send(payload()); assert.equal(response.status, 200); assert.equal(response.body.auditResultWrite.status, 'failed'); assert.equal(response.body.partial, true); assert.match(response.body.auditResultWrite.message, /not saved/);
});

test('malformed live rubric stops before AI calls and writes', async () => {
  const store = fakeStore({ malformedRubric: true }); const providers = fakeProviders(); const app = createApp({ sheetStore: store, providerClient: providers }); const agent = request.agent(app); await login(agent);
  const response = await agent.post('/api/analyze').send(payload()); assert.equal(response.status, 503); assert.equal(providers.calls.length, 0); assert.equal(store.writes.length, 0);
});

test('summary-only modes are cached and never write history', async () => {
  const store = fakeStore(); const providers = fakeProviders(); const app = createApp({ sheetStore: store, providerClient: providers }); const agent = request.agent(app); await login(agent);
  const voice1 = await agent.post('/api/analyze').send(payload({ mode: 'voice', parameter: '' })); const voice2 = await agent.post('/api/analyze').send(payload({ mode: 'voice', parameter: '' })); assert.equal(voice1.status, 200); assert.equal(voice2.body.cached, true);
  const coaching = await agent.post('/api/analyze').send(payload({ mode: 'coaching' })); assert.equal(coaching.status, 200); assert.equal(store.writes.length, 0); assert.equal(providers.calls.length, 2); assert.equal(store.users[0].usage, 2);
});

test('rejects invalid providers/audio and does not expose project files', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() }); const agent = request.agent(app); await login(agent);
  assert.equal((await agent.post('/api/analyze').send(payload({ provider: 'custom' }))).status, 400);
  assert.equal((await agent.post('/api/analyze').send(payload({ audioFiles: [{ data: 'x', mimeType: 'text/plain' }] }))).status, 400);
  assert.equal((await request(app).get('/package.json')).status, 404);
});
