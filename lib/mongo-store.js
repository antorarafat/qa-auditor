const { MongoClient, GridFSBucket } = require('mongodb');

const AUDIT_HEADERS = [
  'timestamp', 'agent_name', 'qa_perameter', 'audit_total_score', 'audit_score_breakdown_json', 'CE/Non-CE',
  'product_fact-check_&_critical_error_audit', 'deduction_justification', 'strengths_or_pros', 'script_correction',
  'actionable_coaching_&_final_rating'
];

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }

function createMongoStore(config = {}) {
  const uri = config.uri || process.env.MONGODB_URI;
  const databaseName = config.databaseName || process.env.MONGODB_DATABASE || '10ms-qaaudit';
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  const client = config.client || new MongoClient(uri, {
    appName: '10ms-qaaudit', maxPoolSize: 20, minPoolSize: 1,
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000
  });
  let readyPromise;

  async function ready() {
    if (!readyPromise) readyPromise = (async () => {
      await client.connect();
      const db = client.db(databaseName);
      await Promise.all([
        db.collection('user').createIndex({ email: 1 }, { unique: true, name: 'user_email_unique' }),
        db.collection('product_brief').createIndex({ category: 1, subCategory: 1 }, { unique: true, name: 'product_unique' }),
        db.collection('qa_scorecard').createIndex({ normalizedName: 1 }, { unique: true, name: 'qa_parameter_unique' }),
        db.collection('audit_result').createIndex({ timestamp: -1 }, { name: 'audit_timestamp' }),
        db.collection('analysis_cache').createIndex({ key: 1 }, { unique: true, name: 'cache_key_unique' }),
        db.collection('analysis_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'cache_ttl' }),
        db.collection('analysis_jobs').createIndex({ jobId: 1 }, { unique: true, name: 'job_id_unique' }),
        db.collection('analysis_jobs').createIndex({ ownerEmail: 1, dedupeKey: 1, status: 1 }, { name: 'job_dedupe_lookup' }),
        db.collection('analysis_jobs').createIndex({ status: 1, createdAt: 1 }, { name: 'job_queue_order' }),
        db.collection('analysis_jobs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'job_ttl' }),
        db.collection('audio_files.files').createIndex({ 'metadata.sha256': 1, 'metadata.ownerEmail': 1 }, { name: 'audio_hash_owner' })
      ]);
      return db;
    })().catch(error => { readyPromise = null; throw error; });
    return readyPromise;
  }

  async function companyName(db) {
    const company = await db.collection('company').findOne({}, { sort: { _id: 1 } });
    return String(company?.companyName || company?.['Company Name'] || '').trim() || null;
  }

  async function uploadAudio(ownerEmail, file) {
    const db = await ready();
    const bucket = new GridFSBucket(db, { bucketName: 'audio_files' });
    const buffer = Buffer.from(file.data, 'base64');
    return new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(file.name, { metadata: { ownerEmail, mimeType: file.mimeType, sha256: file.sha256, size: buffer.length, createdAt: new Date() } });
      stream.once('error', reject);
      stream.once('finish', () => resolve({ fileId: stream.id, name: file.name, mimeType: file.mimeType, sha256: file.sha256, size: buffer.length }));
      stream.end(buffer);
    });
  }

  async function downloadAudio(file) {
    const db = await ready();
    const bucket = new GridFSBucket(db, { bucketName: 'audio_files' });
    const chunks = [];
    await new Promise((resolve, reject) => bucket.openDownloadStream(file.fileId).on('data', chunk => chunks.push(chunk)).once('error', reject).once('end', resolve));
    return { name: file.name, mimeType: file.mimeType, data: Buffer.concat(chunks).toString('base64') };
  }

  return {
    async ping() { const db = await ready(); return db.command({ ping: 1 }); },
    async close() { await client.close(); readyPromise = null; },
    async findByEmail(email) {
      const db = await ready();
      const normalized = normalizeEmail(email);
      const user = await db.collection('user').findOne({ $or: [{ email: normalized }, { 'User Email': normalized }] });
      if (!user) return null;
      return {
        ...user,
        email: normalizeEmail(user.email || user['User Email']),
        password: String(user.password ?? user['User Password'] ?? ''),
        name: String(user.name ?? user['User Name'] ?? ''),
        geminiKey: String(user.geminiKey ?? user.GEMINI_API_KEY ?? ''),
        openaiKey: String(user.openaiKey ?? user.OPENAI_API_KEY ?? ''),
        usage: Number(user.usage ?? user.Usage ?? 0) || 0,
        defaultParameter: String(user.defaultParameter ?? user['Default QA Parameter'] ?? ''),
        companyName: await companyName(db) || user.companyName || '10 Minute School'
      };
    },
    async getAuditConfiguration() {
      const db = await ready();
      const [products, parameters] = await Promise.all([
        db.collection('product_brief').find({}, { projection: { _id: 0, category: 1, subCategory: 1 } }).sort({ _id: 1 }).toArray(),
        db.collection('qa_scorecard').find({}, { projection: { _id: 0, name: 1 } }).sort({ _id: 1 }).toArray()
      ]);
      const grouped = new Map();
      for (const product of products) { if (!grouped.has(product.category)) grouped.set(product.category, []); grouped.get(product.category).push(product.subCategory); }
      return { products: [...grouped].map(([category, subCategories]) => ({ category, subCategories })), parameters: parameters.map(item => item.name) };
    },
    async getProductBriefs(categories = [], selections = []) {
      const db = await ready();
      let filter = { _id: { $exists: true } };
      if (selections.length) filter = { $or: selections.map(item => ({ category: item.category, subCategory: item.subCategory })) };
      else if (categories.length) filter = { category: { $in: categories } };
      else return [];
      return db.collection('product_brief').find(filter, { projection: { _id: 0, category: 1, subCategory: 1, brief: 1 } }).sort({ _id: 1 }).toArray();
    },
    async getQaParameter(name) {
      const db = await ready();
      return db.collection('qa_scorecard').findOne({ normalizedName: String(name || '').trim().toLowerCase() }, { projection: { _id: 0, name: 1, detail: 1 } });
    },
    async saveDefaultParameter(email, parameter) {
      const db = await ready();
      const normalized = normalizeEmail(email);
      const result = await db.collection('user').updateOne({ $or: [{ email: normalized }, { 'User Email': normalized }] }, { $set: { defaultParameter: parameter, 'Default QA Parameter': parameter, updatedAt: new Date() } });
      if (!result.matchedCount) throw new Error('User was not found.');
      return true;
    },
    async appendAuditResults(rows) {
      if (!rows.length) return 0;
      const db = await ready();
      const documents = rows.map(row => Object.fromEntries(AUDIT_HEADERS.map((header, index) => [header, row[index] ?? '']))).map(document => ({ ...document, createdAt: new Date() }));
      await db.collection('audit_result').insertMany(documents, { ordered: true });
      return documents.length;
    },
    async incrementUsage(email) {
      const db = await ready();
      const normalized = normalizeEmail(email);
      const user = await db.collection('user').findOne({ $or: [{ email: normalized }, { 'User Email': normalized }] }, { projection: { usage: 1, Usage: 1 } });
      if (!user) return false;
      const usage = (Number(user.usage ?? user.Usage ?? 0) || 0) + 1;
      const result = await db.collection('user').updateOne({ _id: user._id }, { $set: { usage, Usage: usage, updatedAt: new Date() } });
      return Boolean(result.matchedCount);
    },
    async getCachedAnalysis(key) {
      const db = await ready();
      const entry = await db.collection('analysis_cache').findOne({ key, expiresAt: { $gt: new Date() } });
      return entry?.result || null;
    },
    async setCachedAnalysis(key, result, ttlMs) {
      const db = await ready(); const now = new Date();
      await db.collection('analysis_cache').updateOne({ key }, { $set: { result, updatedAt: now, expiresAt: new Date(now.getTime() + ttlMs) }, $setOnInsert: { createdAt: now } }, { upsert: true });
    },
    async findActiveJob(ownerEmail, dedupeKey) {
      const db = await ready();
      return db.collection('analysis_jobs').findOne({ ownerEmail: normalizeEmail(ownerEmail), dedupeKey, status: { $in: ['queued', 'processing'] } }, { projection: { _id: 0, jobId: 1, status: 1, createdAt: 1 } });
    },
    async createAnalysisJob(job, audioFiles) {
      const storedAudio = [];
      try { for (const file of audioFiles) storedAudio.push(await uploadAudio(job.ownerEmail, file)); }
      catch (error) { const db = await ready(); const bucket = new GridFSBucket(db, { bucketName: 'audio_files' }); await Promise.allSettled(storedAudio.map(file => bucket.delete(file.fileId))); throw error; }
      const db = await ready();
      await db.collection('analysis_jobs').insertOne({ ...job, ownerEmail: normalizeEmail(job.ownerEmail), audioFiles: storedAudio, status: 'queued', createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      return { jobId: job.jobId, status: 'queued' };
    },
    async acquireWorkerLease(owner, leaseMs) {
      const db = await ready(); const now = new Date(); const leaseUntil = new Date(now.getTime() + leaseMs);
      try {
        const lease = await db.collection('rate_limit_state').findOneAndUpdate(
          { _id: 'analysis-worker', $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }, { owner }] },
          { $set: { owner, leaseUntil, updatedAt: now } },
          { upsert: true, returnDocument: 'after' }
        );
        return lease?.owner === owner ? leaseUntil : null;
      } catch (error) {
        if (error?.code === 11000) return null;
        throw error;
      }
    },
    async releaseWorkerLease(owner) {
      const db = await ready();
      await db.collection('rate_limit_state').updateOne({ _id: 'analysis-worker', owner }, { $unset: { owner: '', leaseUntil: '' }, $set: { updatedAt: new Date() } });
    },
    async recoverJobs() {
      const db = await ready();
      await db.collection('analysis_jobs').updateMany({ status: 'processing', $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: { $exists: false } }] }, { $set: { status: 'queued', updatedAt: new Date() }, $unset: { startedAt: '', workerId: '', leaseUntil: '' } });
    },
    async claimNextJob(workerId, leaseUntil) {
      const db = await ready();
      return db.collection('analysis_jobs').findOneAndUpdate({ status: 'queued' }, { $set: { status: 'processing', startedAt: new Date(), updatedAt: new Date(), workerId, leaseUntil }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
    },
    async loadJobAudio(job) { return Promise.all(job.audioFiles.map(downloadAudio)); },
    async completeJob(jobId, result) {
      const db = await ready(); const now = new Date();
      await db.collection('analysis_jobs').updateOne({ jobId }, { $set: { status: 'complete', result, completedAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, $unset: { error: '', workerId: '', leaseUntil: '' } });
    },
    async failJob(jobId, error) {
      const db = await ready(); const now = new Date();
      await db.collection('analysis_jobs').updateOne({ jobId }, { $set: { status: 'failed', error, completedAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, $unset: { workerId: '', leaseUntil: '' } });
    },
    async getJob(ownerEmail, jobId) {
      const db = await ready();
      const job = await db.collection('analysis_jobs').findOne({ ownerEmail: normalizeEmail(ownerEmail), jobId }, { projection: { _id: 0, audioFiles: 0, request: 0, prepared: 0 } });
      if (!job) return null;
      if (job.status === 'queued') job.position = await db.collection('analysis_jobs').countDocuments({ status: 'queued', createdAt: { $lte: job.createdAt } });
      return job;
    },
    async getRateState(key = 'gemini') { const db = await ready(); return db.collection('rate_limit_state').findOne({ _id: key }); },
    async setNextAllowedAt(date, key = 'gemini') { const db = await ready(); await db.collection('rate_limit_state').updateOne({ _id: key }, { $set: { nextAllowedAt: date, updatedAt: new Date() } }, { upsert: true }); },
    async setCooldownUntil(date, key = 'gemini') { const db = await ready(); await db.collection('rate_limit_state').updateOne({ _id: key }, [{ $set: { nextAllowedAt: { $max: [{ $ifNull: ['$nextAllowedAt', new Date(0)] }, date] }, updatedAt: '$$NOW' } }], { upsert: true }); }
  };
}

module.exports = { createMongoStore, AUDIT_HEADERS };
