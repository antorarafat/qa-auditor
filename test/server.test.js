const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp, rowsToUsers, rowsToProductBriefs } = require('../server');

function fakeStore() {
  const users = [{
    email: 'user@example.com',
    password: 'plain-password',
    name: 'Test User',
    companyName: 'Robi',
    geminiKey: 'gemini-secret',
    openaiKey: 'openai-secret',
    usage: 0
  }];
  return {
    users,
    async findByEmail(email) { return users.find(user => user.email === email) || null; },
    async getAuditConfiguration() {
      return {
        products: [
          { category: 'HSC 28', subCategories: ['PCMB', 'BEI'] },
          { category: 'SSC', subCategories: ['SSC Science'] }
        ],
        scorecard: 'Sheet QA scorecard'
      };
    },
    async getProductBriefs(categories, productSelections) {
      const products = [
        ...['PCMB', 'BEI'].map(subCategory => ({ category: 'HSC 28', subCategory, brief: `Official product brief for ${subCategory}` })),
        { category: 'SSC', subCategory: 'SSC Science', brief: 'Official product brief for SSC Science' }
      ];
      if (productSelections.length) {
        return products.filter(product => productSelections.some(item => item.category === product.category && item.subCategory === product.subCategory));
      }
      return products.filter(product => categories.includes(product.category));
    },
    async getQaScorecard() { return 'Sheet QA scorecard'; },
    async incrementUsage(email) {
      const user = users.find(item => item.email === email);
      if (user) user.usage += 1;
      return Boolean(user);
    }
  };
}

function auditPayload(overrides = {}) {
  return {
    provider: 'gemini',
    mode: 'single',
    categories: ['HSC 28'],
    productSelections: [{ category: 'HSC 28', subCategory: 'PCMB' }],
    audioFiles: [{ name: 'call.wav', mimeType: 'audio/wav', data: Buffer.from('audio').toString('base64') }],
    ...overrides
  };
}

function fakeProviders() {
  return {
    calls: [],
    async callGemini(key, files, prompt) {
      this.calls.push({ provider: 'gemini', key, files, prompt });
      return '# Gemini report';
    },
    async callOpenAI(key, files, prompt) {
      this.calls.push({ provider: 'openai', key, files, prompt });
      return '# OpenAI report';
    }
  };
}

test('rowsToUsers maps the sheet headers without exposing the leading index column', () => {
  const users = rowsToUsers([
    ['', 'User Email', 'User Password', 'User Name', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'Usage'],
    [0, 'USER@example.com', 'pw', 'User', 'g-key', '', '3']
  ]);
  assert.deepEqual(users[0], {
    rowNumber: 2,
    email: 'user@example.com',
    password: 'pw',
    name: 'User',
    companyName: '10 Minute School',
    geminiKey: 'g-key',
    openaiKey: '',
    usage: 3,
    usageColumn: 6
  });
});

test('maps the exact product brief sheet headers', () => {
  assert.deepEqual(rowsToProductBriefs([
    ['Category', 'Sub-Category', 'Brief'],
    ['HSC 28', 'PCMB', 'Official facts']
  ]), [{ category: 'HSC 28', subCategory: 'PCMB', brief: 'Official facts' }]);
});

test('requires authentication and never returns provider keys', async () => {
  const store = fakeStore();
  const providers = fakeProviders();
  const app = createApp({ sheetStore: store, providerClient: providers });
  const response = await request(app).get('/api/session');
  assert.equal(response.status, 401);
});

test('allows configured LAN origins and issues an HTTP-compatible session cookie', async () => {
  const app = createApp({
    sheetStore: fakeStore(),
    providerClient: fakeProviders(),
    allowedOrigins: ['http://localhost:3000', 'http://192.168.99.147:3000'],
    secureCookies: false
  });
  const login = await request(app)
    .post('/api/login')
    .set('Origin', 'http://192.168.99.147:3000')
    .send({ email: 'user@example.com', password: 'plain-password' });
  assert.equal(login.status, 200);
  assert.equal(login.headers['set-cookie'][0].includes('Secure'), false);

  const rejected = await request(app)
    .post('/api/login')
    .set('Origin', 'http://untrusted.example')
    .send({ email: 'user@example.com', password: 'plain-password' });
  assert.equal(rejected.status, 403);
});

test('logs in, analyzes with the matching provider key, and increments usage', async () => {
  const store = fakeStore();
  const providers = fakeProviders();
  const app = createApp({ sheetStore: store, providerClient: providers });
  const agent = request.agent(app);
  const login = await agent.post('/api/login').send({ email: 'USER@example.com', password: 'plain-password' });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.user, {
    email: 'user@example.com',
    name: 'Test User',
    companyName: 'Robi',
    providers: ['gemini', 'openai']
  });
  assert.equal(JSON.stringify(login.body).includes('secret'), false);

  const configuration = await agent.get('/api/audit-config');
  assert.equal(configuration.status, 200);
  assert.deepEqual(configuration.body.products, [
    { category: 'HSC 28', subCategories: ['PCMB', 'BEI'] },
    { category: 'SSC', subCategories: ['SSC Science'] }
  ]);
  assert.equal(configuration.body.scorecard, 'Sheet QA scorecard');
  assert.equal(JSON.stringify(configuration.body).includes('Official product brief'), false);

  const analysis = await agent.post('/api/analyze').send(auditPayload());
  assert.equal(analysis.status, 200);
  assert.equal(analysis.body.report, '# Gemini report');
  assert.equal(providers.calls[0].key, 'gemini-secret');
  assert.match(providers.calls[0].prompt, /Official product brief for PCMB/);
  assert.match(providers.calls[0].prompt, /Sheet QA scorecard/);
  assert.match(providers.calls[0].prompt, /COMPANY NAME: "Robi"/);
  assert.doesNotMatch(providers.calls[0].prompt, /10 Minute School/);
  assert.equal(store.users[0].usage, 1);

  const cached = await agent.post('/api/analyze').send(auditPayload());
  assert.equal(cached.status, 200);
  assert.equal(cached.body.cached, true);
  assert.equal(providers.calls.length, 1);
  assert.equal(store.users[0].usage, 1);
});

test('runs a generic audit without product selections and supports multiple selected briefs', async () => {
  const providers = fakeProviders();
  const app = createApp({ sheetStore: fakeStore(), providerClient: providers });
  const agent = request.agent(app);
  await agent.post('/api/login').send({ email: 'user@example.com', password: 'plain-password' });

  const generic = await agent.post('/api/analyze').send(auditPayload({ categories: [], productSelections: [] }));
  assert.equal(generic.status, 200);
  assert.match(providers.calls[0].prompt, /generic QA evaluation/);
  assert.doesNotMatch(providers.calls[0].prompt, /Official product brief/);

  const multiple = await agent.post('/api/analyze').send(auditPayload({
    productSelections: [
      { category: 'HSC 28', subCategory: 'PCMB' },
      { category: 'HSC 28', subCategory: 'BEI' },
      { category: 'SSC', subCategory: 'SSC Science' }
    ]
  }));
  assert.equal(multiple.status, 200);
  assert.match(providers.calls[1].prompt, /Official product brief for PCMB/);
  assert.match(providers.calls[1].prompt, /Official product brief for BEI/);
  assert.match(providers.calls[1].prompt, /Official product brief for SSC Science/);
});

test('rejects arbitrary providers and invalid audio payloads', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() });
  const agent = request.agent(app);
  await agent.post('/api/login').send({ email: 'user@example.com', password: 'plain-password' });
  const providerResponse = await agent.post('/api/analyze').send(auditPayload({ provider: 'custom', audioFiles: [] }));
  assert.equal(providerResponse.status, 400);
  const audioResponse = await agent.post('/api/analyze').send(auditPayload({ audioFiles: [{ data: 'x', mimeType: 'text/plain' }] }));
  assert.equal(audioResponse.status, 400);
});

test('accepts any number of audio files without the legacy size options', async () => {
  const providers = fakeProviders();
  const app = createApp({
    sheetStore: fakeStore(),
    providerClient: providers,
    maxAudioFiles: 1,
    maxAudioBytes: 1
  });
  const agent = request.agent(app);
  await agent.post('/api/login').send({ email: 'user@example.com', password: 'plain-password' });
  const audioFiles = Array.from({ length: 6 }, (_, index) => ({
    name: `call-${index + 1}.wav`,
    mimeType: 'audio/wav',
    data: Buffer.from(`audio-${index + 1}`).toString('base64')
  }));
  const response = await agent.post('/api/analyze').send({
    ...auditPayload(),
    audioFiles
  });
  assert.equal(response.status, 200);
  assert.equal(providers.calls[0].files.length, 6);
});

test('does not serve the credential file or arbitrary files', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() });
  assert.equal((await request(app).get('/arafat-alahe-403508-11c3d59ec795.json')).status, 404);
  assert.equal((await request(app).get('/package.json')).status, 404);
});

test('serves the production favicon without exposing other root files', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() });
  const response = await request(app).get('/favicon.svg');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /image\/svg\+xml/);
  assert.match(response.body.toString('utf8'), /#e5484d/);
});
