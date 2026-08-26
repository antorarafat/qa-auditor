const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const security = require('../lib/security');

const encryptionKey = crypto.randomBytes(32).toString('base64');

test('Argon2id passwords verify without storing the original password', async () => {
  const password = 'Strong-Unique-Passphrase-42';
  const passwordHash = await security.hashPassword(password, { email: 'person@northstar.example', username: 'Morgan' });
  assert.match(passwordHash, /^\$argon2id\$/);
  assert.equal(passwordHash.includes(password), false);
  assert.equal(await security.verifyPassword(passwordHash, password), true);
  assert.equal(await security.verifyPassword(passwordHash, 'wrong-password'), false);
});

test('new passwords reject account identifiers and weak lengths', async () => {
  await assert.rejects(security.hashPassword('Morgan-very-long-password', { username: 'Morgan' }), /must not contain/);
  await assert.rejects(security.hashPassword('short', {}), /12 and 128/);
});

test('AES-256-GCM keys are masked and bound to user and provider', () => {
  const secret = 'provider-secret-1234567890';
  const record = security.encryptSecret(secret, 'user-a', 'gemini', encryptionKey);
  assert.equal(JSON.stringify(record).includes(secret), false);
  assert.deepEqual(security.apiKeySummary(record).lastFour, '7890');
  assert.equal(security.decryptSecret(record, 'user-a', 'gemini', encryptionKey), secret);
  assert.throws(() => security.decryptSecret(record, 'user-b', 'gemini', encryptionKey));
  assert.throws(() => security.decryptSecret(record, 'user-a', 'openai', encryptionKey));
  assert.throws(() => security.decryptSecret(record, 'user-a', 'gemini', crypto.randomBytes(32).toString('base64')));
});

test('session tokens are stored as irreversible hashes', () => {
  const token = security.newToken(); const digest = security.hashToken(token);
  assert.notEqual(token, digest); assert.equal(digest.length, 64); assert.equal(security.hashToken(token), digest);
});
