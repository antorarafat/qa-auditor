const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { google } = require('googleapis');

const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, '10ms-qa-audit-portal.html');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_MAX_AUDIO_FILES = 5;
const DEFAULT_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const DEFAULT_GEMINI_MODELS = ['gemini-3.6-flash'];
const DEFAULT_OPENAI_MODELS = ['gpt-4o-audio-preview', 'gpt-4o-mini-audio-preview'];
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 100;

function envNumber(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envList(name, fallback) {
  const value = (process.env[name] || '').split(',').map(item => item.trim()).filter(Boolean);
  return value.length ? value : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function columnLetter(index) {
  let result = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function rowsToUsers(values) {
  if (!Array.isArray(values) || values.length < 1) return [];
  const headers = values[0].map(normalizeHeader);
  const indexOf = name => headers.indexOf(normalizeHeader(name));
  const emailIndex = indexOf('User Email');
  const passwordIndex = indexOf('User Password');
  const nameIndex = indexOf('User Name');
  const geminiIndex = indexOf('GEMINI_API_KEY');
  const openaiIndex = indexOf('OPENAI_API_KEY');
  const usageIndex = indexOf('Usage');
  const companyIndex = ['Company Name', 'Company', 'Organization']
    .map(indexOf)
    .find(index => index >= 0);

  if (emailIndex < 0 || passwordIndex < 0) {
    throw new Error('The user sheet must contain User Email and User Password columns.');
  }

  return values.slice(1).map((row, offset) => ({
    rowNumber: offset + 2,
    email: normalizeEmail(row[emailIndex]),
    password: String(row[passwordIndex] || ''),
    name: String(row[nameIndex] || row[emailIndex] || '').trim(),
    companyName: String(row[companyIndex] || '').trim() || '10 Minute School',
    geminiKey: String(row[geminiIndex] || '').trim(),
    openaiKey: String(row[openaiIndex] || '').trim(),
    usage: usageIndex >= 0 ? Number.parseInt(row[usageIndex] || '0', 10) || 0 : 0,
    usageColumn: usageIndex
  })).filter(user => user.email);
}

function createGoogleSheetStore(config = {}) {
  const spreadsheetId = config.spreadsheetId || process.env.GOOGLE_SHEETS_ID;
  const sheetName = config.sheetName || process.env.GOOGLE_SHEETS_TAB || 'user';
  const companySheetName = config.companySheetName || process.env.GOOGLE_SHEETS_COMPANY_TAB || 'company';
  let sheetsClient;

  function getClient() {
    if (sheetsClient) return sheetsClient;
    const authOptions = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    };
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      authOptions.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  }

  function assertConfigured() {
    if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID is not configured.');
  }

  async function readUsers() {
    assertConfigured();
    const response = await getClient().spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName.replace(/'/g, "''")}'!A1:Z1000`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    return rowsToUsers(response.data.values || []);
  }

  async function readCompanyName() {
    assertConfigured();
    try {
      const response = await getClient().spreadsheets.values.get({
        spreadsheetId,
        range: `'${companySheetName.replace(/'/g, "''")}'!A1:B20`,
        valueRenderOption: 'UNFORMATTED_VALUE'
      });
      const values = response.data.values || [];
      if (!values.length) return null;
      const headers = values[0].map(normalizeHeader);
      const companyColumn = headers.indexOf(normalizeHeader('Company Name'));
      if (companyColumn >= 0) {
        return String(values.slice(1).find(row => row[companyColumn])?.[companyColumn] || '').trim() || null;
      }
      return String(values[0][0] || '').trim() || null;
    } catch (error) {
      console.error('Company tab lookup skipped:', error.message);
      return null;
    }
  }

  return {
    async findByEmail(email) {
      const normalized = normalizeEmail(email);
      const [users, companyName] = await Promise.all([readUsers(), readCompanyName()]);
      const user = users.find(item => item.email === normalized) || null;
      if (user && companyName) user.companyName = companyName;
      return user;
    },
    async incrementUsage(email) {
      assertConfigured();
      const users = await readUsers();
      const user = users.find(item => item.email === normalizeEmail(email));
      if (!user || user.usageColumn < 0) return false;
      const cell = `${columnLetter(user.usageColumn)}${user.rowNumber}`;
      await getClient().spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName.replace(/'/g, "''")}'!${cell}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[user.usage + 1]] }
      });
      return true;
    }
  };
}

function publicUser(user) {
  return {
    email: user.email,
    name: user.name,
    companyName: user.companyName || '10 Minute School',
    providers: [
      user.geminiKey ? 'gemini' : null,
      user.openaiKey ? 'openai' : null
    ].filter(Boolean)
  };
}

function createAnalysisCache(config = {}) {
  const ttlMs = config.ttlMs || envNumber('AI_CACHE_TTL_MS', DEFAULT_CACHE_TTL_MS);
  const maxEntries = config.maxEntries || envNumber('AI_CACHE_MAX_ENTRIES', DEFAULT_CACHE_MAX_ENTRIES);
  const entries = new Map();

  function prune() {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  return {
    get(key) {
      prune();
      const entry = entries.get(key);
      if (!entry) return null;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      prune();
      entries.delete(key);
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      prune();
    },
    size() {
      prune();
      return entries.size;
    }
  };
}

function analysisCacheKey(user, provider, promptText, audioFiles) {
  const hash = crypto.createHash('sha256');
  hash.update(`${user.email}\0${provider}\0${promptText}`);
  for (const file of audioFiles) {
    hash.update(`\0${file.name}\0${file.mimeType}\0${file.data}`);
  }
  return hash.digest('hex');
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function createSessionManager() {
  const sessions = new Map();

  function prune() {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  }

  return {
    create(email) {
      prune();
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });
      return token;
    },
    get(token) {
      prune();
      const session = sessions.get(token);
      return session && session.expiresAt > Date.now() ? session : null;
    },
    destroy(token) {
      sessions.delete(token);
    },
    size() {
      prune();
      return sessions.size;
    }
  };
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `qa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'qa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

function isSameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  const configured = process.env.PUBLIC_ORIGIN;
  if (configured) return origin === configured;
  return origin === `${req.protocol}://${req.get('host')}`;
}

function validateAudioFiles(files, limits) {
  if (!Array.isArray(files) || files.length < 1 || files.length > limits.maxFiles) {
    throw new Error(`Upload between 1 and ${limits.maxFiles} audio files.`);
  }
  let totalBytes = 0;
  return files.map(file => {
    if (!file || typeof file.data !== 'string' || !String(file.mimeType || '').startsWith('audio/')) {
      throw new Error('Only audio files are supported.');
    }
    const bytes = Math.ceil(Buffer.byteLength(file.data, 'base64'));
    totalBytes += bytes;
    if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('Invalid audio data.');
    return {
      data: file.data,
      mimeType: String(file.mimeType),
      name: String(file.name || 'audio').slice(0, 200)
    };
  }).filter(Boolean).map(file => file);
}

function createProviderClient(config = {}) {
  const fetchImpl = config.fetchImpl || fetch;
  const geminiModels = config.geminiModels || envList('GEMINI_MODELS', DEFAULT_GEMINI_MODELS);
  const openaiModels = config.openaiModels || envList('OPENAI_MODELS', DEFAULT_OPENAI_MODELS);

  async function callGemini(apiKey, audioFiles, promptText) {
    const payload = {
      contents: [{
        parts: [{ text: promptText }, ...audioFiles.map(file => ({
          inlineData: { mimeType: file.mimeType, data: file.data }
        }))]
      }]
    };
    let lastError = 'No supported Gemini model responded.';
    for (const model of geminiModels) {
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
        if (text) return text;
        lastError = 'Gemini returned no report text.';
        continue;
      }
      const message = String(data.error?.message || 'Gemini request failed');
      console.error(`Gemini model ${model} returned HTTP ${response.status}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`);
      if (response.status === 404 || /not found|deprecated|not supported/i.test(message)) {
        lastError = message;
        continue;
      }
      const error = new Error(`Gemini request rejected (HTTP ${response.status}).`);
      error.providerStatus = response.status;
      throw error;
    }
    throw new Error(lastError);
  }

  async function callOpenAI(apiKey, audioFiles, promptText) {
    const content = [
      { type: 'text', text: promptText },
      ...audioFiles.map(file => ({
        type: 'input_audio',
        input_audio: {
          data: file.data,
          format: /wav/i.test(`${file.mimeType} ${file.name}`) ? 'wav' : 'mp3'
        }
      }))
    ];
    let lastError = 'No supported OpenAI model responded.';
    for (const model of openaiModels) {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, modalities: ['text'], messages: [{ role: 'user', content }] })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
        lastError = 'OpenAI returned no report text.';
        continue;
      }
      const message = String(data.error?.message || 'OpenAI request failed');
      console.error(`OpenAI model ${model} returned HTTP ${response.status}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`);
      if (response.status === 404 || /not found|deprecated|not supported|model/i.test(message)) {
        lastError = message;
        continue;
      }
      const error = new Error(`OpenAI request rejected (HTTP ${response.status}).`);
      error.providerStatus = response.status;
      throw error;
    }
    throw new Error(lastError);
  }

  return { callGemini, callOpenAI };
}

function createApp(options = {}) {
  const app = express();
  const sheetStore = options.sheetStore || createGoogleSheetStore();
  const providerClient = options.providerClient || createProviderClient();
  const sessions = options.sessions || createSessionManager();
  const analysisCache = options.analysisCache || createAnalysisCache();
  const limits = {
    maxFiles: options.maxAudioFiles || envNumber('MAX_AUDIO_FILES', DEFAULT_MAX_AUDIO_FILES),
    maxBytes: options.maxAudioBytes || envNumber('MAX_AUDIO_BYTES', DEFAULT_MAX_AUDIO_BYTES)
  };
  const usageLocks = new Map();

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: `${Math.ceil(limits.maxBytes * 1.4 / 1024 / 1024)}mb` }));

  app.use((req, res, next) => {
    const token = parseCookies(req.headers.cookie).qa_session;
    const session = token ? sessions.get(token) : null;
    req.session = session;
    req.sessionToken = token;
    next();
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' }
  });

  function requireAuth(req, res, next) {
    if (!req.session) return res.status(401).json({ error: 'Authentication required.' });
    next();
  }

  function requireSameOrigin(req, res, next) {
    if (!isSameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
    next();
  }

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.post('/api/login', loginLimiter, requireSameOrigin, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password || email.length > 320 || password.length > 512) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    try {
      const user = await sheetStore.findByEmail(email);
      if (!user || !safeEqual(user.password, password)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const token = sessions.create(user.email);
      setSessionCookie(res, token);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      console.error('Login lookup failed:', error.message);
      return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
    }
  });

  app.get('/api/session', requireAuth, async (req, res) => {
    try {
      const user = await sheetStore.findByEmail(req.session.email);
      if (!user) {
        sessions.destroy(req.sessionToken);
        clearSessionCookie(res);
        return res.status(401).json({ error: 'Session is no longer valid.' });
      }
      return res.json({ user: publicUser(user) });
    } catch (error) {
      console.error('Session lookup failed:', error.message);
      return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
    }
  });

  app.post('/api/logout', requireSameOrigin, (req, res) => {
    if (req.sessionToken) sessions.destroy(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/analyze', requireSameOrigin, requireAuth, async (req, res) => {
    const provider = String(req.body?.provider || '').toLowerCase();
    const promptText = String(req.body?.promptText || '').trim();
    if (!['gemini', 'openai'].includes(provider)) return res.status(400).json({ error: 'Unsupported AI provider.' });
    if (!promptText || promptText.length > 100000) return res.status(400).json({ error: 'Invalid analysis prompt.' });
    let audioFiles;
    try {
      audioFiles = validateAudioFiles(req.body?.audioFiles, limits);
      const totalBytes = audioFiles.reduce((sum, file) => sum + Math.ceil(Buffer.byteLength(file.data, 'base64')), 0);
      if (totalBytes > limits.maxBytes) throw new Error('Audio upload is too large.');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    try {
      const user = await sheetStore.findByEmail(req.session.email);
      if (!user) return res.status(401).json({ error: 'Session is no longer valid.' });
      const apiKey = provider === 'gemini' ? user.geminiKey : user.openaiKey;
      if (!apiKey) return res.status(400).json({ error: `No ${provider} API key is configured for this account.` });
      const cacheKey = analysisCacheKey(user, provider, promptText, audioFiles);
      const cachedReport = analysisCache.get(cacheKey);
      if (cachedReport) return res.json({ report: cachedReport, cached: true });
      const report = provider === 'gemini'
        ? await providerClient.callGemini(apiKey, audioFiles, promptText)
        : await providerClient.callOpenAI(apiKey, audioFiles, promptText);
      analysisCache.set(cacheKey, report);

      const previous = usageLocks.get(user.email) || Promise.resolve();
      const next = previous.catch(() => {}).then(() => sheetStore.incrementUsage(user.email));
      usageLocks.set(user.email, next.finally(() => {
        if (usageLocks.get(user.email) === next) usageLocks.delete(user.email);
      }));
      await next.catch(error => console.error('Usage update failed:', error.message));
      return res.json({ report, cached: false });
    } catch (error) {
      console.error('Analysis failed:', error.message);
      const status = Number.isInteger(error.providerStatus) ? ` (provider HTTP ${error.providerStatus})` : '';
      return res.status(502).json({ error: `The AI analysis could not be completed${status}.` });
    }
  });

  if (fs.existsSync(DIST_INDEX_PATH)) {
    app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { index: false }));
    app.get('/', (req, res) => res.sendFile(DIST_INDEX_PATH));
  } else {
    app.get(['/', '/10ms-qa-audit-portal.html'], (req, res) => res.sendFile(INDEX_PATH));
  }
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  return app;
}

if (require.main === module) {
  require('dotenv').config();
  const port = envNumber('PORT', 3000);
  createApp().listen(port, () => console.log(`QA Auditor listening on port ${port}`));
}

module.exports = {
  createApp,
  createGoogleSheetStore,
  createProviderClient,
  createSessionManager,
  createAnalysisCache,
  rowsToUsers,
  normalizeEmail
};
