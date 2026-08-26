#!/usr/bin/env node
require('dotenv').config();
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { MongoClient, BSON } = require('mongodb');
const { encryptionKey } = require('../lib/security');

async function write(stream, value) { if (!stream.write(value)) await once(stream, 'drain'); }
async function writeRecord(stream, value) { const payload = BSON.serialize(value); const size = Buffer.allocUnsafe(4); size.writeUInt32BE(payload.length); await write(stream, size); await write(stream, payload); }

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const client = new MongoClient(process.env.MONGODB_URI, { appName: 'qa-auditor-secure-backup' });
  const directory = path.resolve(process.argv[2] || 'backups');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(directory, `qa-auditor-${stamp}.bson.aes`);
  const output = fs.createWriteStream(target, { mode: 0o600 });
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  await write(output, Buffer.from('QAAUDIT1')); await write(output, iv); cipher.pipe(output, { end: false });
  try {
    await client.connect(); const db = client.db(process.env.MONGODB_DATABASE || '10ms-qaaudit');
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name).sort();
    await writeRecord(cipher, { type: 'header', database: db.databaseName, createdAt: new Date(), collections: names });
    for (const collection of names) {
      await writeRecord(cipher, { type: 'collection', name: collection });
      for await (const document of db.collection(collection).find({})) await writeRecord(cipher, { type: 'document', collection, document });
    }
    cipher.end(); await once(cipher, 'end'); await write(output, cipher.getAuthTag()); output.end(); await once(output, 'finish');
    console.log(`Encrypted backup created: ${target}`);
  } finally { await client.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
