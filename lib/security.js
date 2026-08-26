const crypto = require('node:crypto');
const { Algorithm, hash, verify } = require('@node-rs/argon2');

const PASSWORD_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32
};

function encryptionKey(value = process.env.APP_ENCRYPTION_KEY) {
  const source = String(value || '').trim();
  if (!source) throw new Error('APP_ENCRYPTION_KEY is required. Generate a random 32-byte base64 value.');
  const key = /^[a-f0-9]{64}$/i.test(source) ? Buffer.from(source, 'hex') : Buffer.from(source, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return key;
}

function validatePassword(password, user = {}) {
  const value = String(password || '');
  if (value.length < 12 || value.length > 128) throw new Error('Password must be between 12 and 128 characters.');
  const lowered = value.toLowerCase();
  const username = String(user.username || user.name || '').trim().toLowerCase();
  const emailName = String(user.email || '').split('@')[0].trim().toLowerCase();
  if ((username.length >= 3 && lowered.includes(username)) || (emailName.length >= 3 && lowered.includes(emailName))) throw new Error('Password must not contain the username or email name.');
  return value;
}

async function hashPassword(password, user = {}) {
  return hash(validatePassword(password, user), PASSWORD_OPTIONS);
}

async function hashLegacyPassword(password) {
  const value = String(password || '');
  if (!value) throw new Error('A legacy account has no password to migrate.');
  return hash(value, PASSWORD_OPTIONS);
}

async function verifyPassword(passwordHash, password) {
  if (!passwordHash || !password) return false;
  try { return await verify(String(passwordHash), String(password)); }
  catch { return false; }
}

function secretAad(userId, provider, version = 1) {
  return Buffer.from(`qa-auditor:${String(userId)}:${String(provider)}:v${version}`, 'utf8');
}

function encryptSecret(secret, userId, provider, keyValue) {
  const value = String(secret || '').trim();
  if (!value) throw new Error('API key is required.');
  const version = 1;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(keyValue), iv);
  cipher.setAAD(secretAad(userId, provider, version));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    version,
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    lastFour: value.slice(-4),
    fingerprint: crypto.createHash('sha256').update(value).digest('hex').slice(0, 24),
    updatedAt: new Date()
  };
}

function decryptSecret(record, userId, provider, keyValue) {
  if (!record?.ciphertext || !record?.iv || !record?.tag) return '';
  const version = Number(record.version || 1);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(keyValue), Buffer.from(record.iv, 'base64'));
  decipher.setAAD(secretAad(userId, provider, version));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function hashToken(token, secret = '') {
  return secret ? crypto.createHmac('sha256', String(secret)).update(String(token || '')).digest('hex') : crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function apiKeySummary(record) {
  if (!record?.ciphertext) return { configured: false };
  return { configured: true, lastFour: record.lastFour || '', status: record.status || 'saved', updatedAt: record.updatedAt || null };
}

module.exports = { PASSWORD_OPTIONS, encryptionKey, validatePassword, hashPassword, hashLegacyPassword, verifyPassword, encryptSecret, decryptSecret, hashToken, newToken, apiKeySummary };
