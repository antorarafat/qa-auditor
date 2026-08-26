#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function inspect() {
  const client = new MongoClient(process.env.MONGODB_URI, { appName: 'qa-auditor-migration-dry-run' });
  try {
    await client.connect(); const db = client.db(process.env.MONGODB_DATABASE || '10ms-qaaudit');
    const users = await db.collection('user').find({}).toArray();
    const jobs = await db.collection('analysis_jobs').countDocuments({ status: 'complete', 'result.report': { $type: 'string' } });
    const legacyAudits = await db.collection('audit_result').countDocuments({ ownerUserId: { $exists: false } });
    return {
      users: users.length,
      plaintextPasswords: users.filter(user => user.password || user['User Password']).length,
      usersWithPlaintextKeys: users.filter(user => user.geminiKey || user.openaiKey || user.GEMINI_API_KEY || user.OPENAI_API_KEY).length,
      recoverableReportJobs: jobs,
      unownedLegacyAudits: legacyAudits
    };
  } finally { await client.close(); }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const counts = await inspect(); console.log(JSON.stringify({ dryRun: !process.argv.includes('--apply'), ...counts }, null, 2));
  if (process.argv.includes('--apply')) {
    const { createMongoStore } = require('../lib/mongo-store'); const store = createMongoStore();
    try { await store.initialize(); console.log('Migrations and database initialization completed.'); }
    finally { await store.close(); }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
