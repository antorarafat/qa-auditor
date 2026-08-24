const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp, rowsToUsers } = require('../server');

function fakeStore() {
  const users = [{
    email: 'user@example.com',
    password: 'plain-password',
    name: 'Test User',
    geminiKey: 'gemini-secret',
    openaiKey: 'openai-secret',
    usage: 0
  }];
  return {
    users,
    async findByEmail(email) { return users.find(user => user.email === email) || null; },
    async incrementUsage(email) {
      const user = users.find(item => item.email === email);
      if (user) user.usage += 1;
      return Boolean(user);
    }
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

test('requires authentication and never returns provider keys', async () => {
  const store = fakeStore();
  const providers = fakeProviders();
  const app = createApp({ sheetStore: store, providerClient: providers });
  const response = await request(app).get('/api/session');
  assert.equal(response.status, 401);
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
    companyName: '10 Minute School',
    providers: ['gemini', 'openai']
  });
  assert.equal(JSON.stringify(login.body).includes('secret'), false);

  const analysis = await agent.post('/api/analyze').send({
    provider: 'gemini',
    promptText: 'Analyze this call.',
    audioFiles: [{ name: 'call.wav', mimeType: 'audio/wav', data: Buffer.from('audio').toString('base64') }]
  });
  assert.equal(analysis.status, 200);
  assert.equal(analysis.body.report, '# Gemini report');
  assert.equal(providers.calls[0].key, 'gemini-secret');
  assert.equal(store.users[0].usage, 1);

  const cached = await agent.post('/api/analyze').send({
    provider: 'gemini',
    promptText: 'Analyze this call.',
    audioFiles: [{ name: 'call.wav', mimeType: 'audio/wav', data: Buffer.from('audio').toString('base64') }]
  });
  assert.equal(cached.status, 200);
  assert.equal(cached.body.cached, true);
  assert.equal(providers.calls.length, 1);
  assert.equal(store.users[0].usage, 1);
});

test('rejects arbitrary providers and invalid audio payloads', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() });
  const agent = request.agent(app);
  await agent.post('/api/login').send({ email: 'user@example.com', password: 'plain-password' });
  const providerResponse = await agent.post('/api/analyze').send({ provider: 'custom', promptText: 'x', audioFiles: [] });
  assert.equal(providerResponse.status, 400);
  const audioResponse = await agent.post('/api/analyze').send({ provider: 'gemini', promptText: 'x', audioFiles: [{ data: 'x', mimeType: 'text/plain' }] });
  assert.equal(audioResponse.status, 400);
});

test('does not serve the credential file or arbitrary files', async () => {
  const app = createApp({ sheetStore: fakeStore(), providerClient: fakeProviders() });
  assert.equal((await request(app).get('/arafat-alahe-403508-11c3d59ec795.json')).status, 404);
  assert.equal((await request(app).get('/package.json')).status, 404);
});
