const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const security = require('./security');

const AUDIT_HEADERS = [
  'timestamp', 'agent_name', 'qa_perameter', 'audit_total_score', 'audit_score_breakdown_json', 'CE/Non-CE',
  'product_fact-check_&_critical_error_audit', 'deduction_justification', 'strengths_or_pros', 'script_correction',
  'actionable_coaching_&_final_rating'
];

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function objectId(value) { try { return value instanceof ObjectId ? value : new ObjectId(String(value)); } catch { return null; } }

function createMongoStore(config = {}) {
  const uri = config.uri || process.env.MONGODB_URI;
  const databaseName = config.databaseName || process.env.MONGODB_DATABASE || '10ms-qaaudit';
  const encryptionKeyValue = config.encryptionKey || process.env.APP_ENCRYPTION_KEY;
  const sessionSecret = String(config.sessionSecret || process.env.SESSION_SECRET || '');
  const deploymentNamespace = String(config.deploymentNamespace || process.env.DEPLOYMENT_NAMESPACE || process.env.NODE_ENV || 'development').trim().toLowerCase();
  const initialAdminEmail = normalizeEmail(config.initialAdminEmail || process.env.INITIAL_ADMIN_EMAIL || 'arafat.alahe@10minuteschool.com');
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  security.encryptionKey(encryptionKeyValue);
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const client = config.client || new MongoClient(uri, {
    appName: '10ms-qaaudit', maxPoolSize: 20, minPoolSize: 1,
    serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000
  });
  let readyPromise;

  async function ensureCollection(db, name, validator = {}) {
    const info = await db.listCollections({ name }).next();
    if (!info) await db.createCollection(name, { validator });
    else if (Object.keys(validator).length) {
      if (info.options?.validator?.$jsonSchema) return;
      if (await db.collection('schema_migrations').findOne({ _id: `validator-restricted:${name}` })) return;
      try { await db.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' }); }
      catch (error) {
        if (error.code !== 13 && error.codeName !== 'Unauthorized') throw error;
        console.warn(`MongoDB role cannot update the ${name} validator; application validation remains active.`);
        await db.collection('schema_migrations').updateOne({ _id: `validator-restricted:${name}` }, { $setOnInsert: { detectedAt: new Date(), reason: 'MongoDB role lacks collMod permission' } }, { upsert: true });
      }
    }
  }

  async function ensureCollections(db) {
    const userValidator = { $jsonSchema: { bsonType: 'object', required: ['email', 'normalizedUsername', 'passwordHash', 'role', 'status', 'authVersion'], properties: {
      email: { bsonType: 'string' }, normalizedUsername: { bsonType: 'string' }, passwordHash: { bsonType: 'string' },
      role: { enum: ['admin', 'user'] }, status: { enum: ['active', 'inactive'] }, authVersion: { bsonType: ['int', 'long', 'double', 'decimal'] }, apiKeys: { bsonType: 'object' }
    } } };
    const sessionValidator = { $jsonSchema: { bsonType: 'object', required: ['tokenHash', 'userId', 'authVersion', 'expiresAt'], properties: { tokenHash: { bsonType: 'string' }, userId: { bsonType: 'objectId' }, expiresAt: { bsonType: 'date' } } } };
    const reportValidator = { $jsonSchema: { bsonType: 'object', required: ['mode', 'status', 'createdAt'], properties: { mode: { enum: ['single', 'voice', 'coaching', 'legacy'] }, status: { enum: ['complete', 'partial', 'failed', 'legacy'] }, createdAt: { bsonType: 'date' }, items: { bsonType: 'array' } } } };
    const productValidator = { $jsonSchema: { bsonType: 'object', required: ['category', 'subCategory', 'brief'], properties: { category: { bsonType: 'string' }, subCategory: { bsonType: 'string' }, brief: { bsonType: 'string' }, archived: { bsonType: 'bool' } } } };
    const categoryValidator = { $jsonSchema: { bsonType: 'object', required: ['name', 'normalizedName', 'archived'], properties: { name: { bsonType: 'string' }, normalizedName: { bsonType: 'string' }, archived: { bsonType: 'bool' } } } };
    const subCategoryValidator = { $jsonSchema: { bsonType: 'object', required: ['categoryId', 'name', 'normalizedName', 'archived'], properties: { categoryId: { bsonType: 'objectId' }, name: { bsonType: 'string' }, normalizedName: { bsonType: 'string' }, archived: { bsonType: 'bool' } } } };
    const scorecardValidator = { $jsonSchema: { bsonType: 'object', required: ['name', 'normalizedName', 'detail'], properties: { name: { bsonType: 'string' }, normalizedName: { bsonType: 'string' }, detail: { bsonType: 'string' }, archived: { bsonType: 'bool' } } } };
    await ensureCollection(db, 'user', userValidator);
    for (const [name, validator] of [['sessions', sessionValidator], ['report_runs', reportValidator], ['product_brief', productValidator], ['product_category', categoryValidator], ['product_subcategory', subCategoryValidator], ['qa_scorecard', scorecardValidator]]) await ensureCollection(db, name, validator);
    for (const name of ['company', 'audit_result', 'analysis_jobs', 'analysis_cache', 'rate_limit_state', 'schema_migrations', 'setup_state']) await ensureCollection(db, name);
  }

  async function migrateLegacyUsers(db) {
    if (await db.collection('schema_migrations').findOne({ _id: 'secure-users-v1' })) return;
    const users = await db.collection('user').find({}).toArray();
    const usedNames = new Set(users.map(user => normalizeUsername(user.username)).filter(Boolean));
    for (const user of users) {
      const email = normalizeEmail(user.email || user['User Email']);
      if (!email) continue;
      let username = String(user.username || user.name || user['User Name'] || email.split('@')[0]).trim();
      let normalizedUsername = normalizeUsername(username);
      if (!user.username) {
        let suffix = 1;
        while (usedNames.has(normalizedUsername)) { suffix += 1; username = `${String(user.name || user['User Name'] || email.split('@')[0]).trim()} ${suffix}`; normalizedUsername = normalizeUsername(username); }
        usedNames.add(normalizedUsername);
      }
      const passwordHash = user.passwordHash || await security.hashLegacyPassword(String(user.password ?? user['User Password'] ?? ''));
      const apiKeys = { ...(user.apiKeys || {}) };
      const gemini = String(user.geminiKey ?? user.GEMINI_API_KEY ?? '').trim();
      const openai = String(user.openaiKey ?? user.OPENAI_API_KEY ?? '').trim();
      if (!apiKeys.gemini?.ciphertext && gemini) apiKeys.gemini = { ...security.encryptSecret(gemini, user._id, 'gemini', encryptionKeyValue), status: 'migrated' };
      if (!apiKeys.openai?.ciphertext && openai) apiKeys.openai = { ...security.encryptSecret(openai, user._id, 'openai', encryptionKeyValue), status: 'migrated' };
      await db.collection('user').updateOne({ _id: user._id }, {
        $set: {
          email, 'User Email': email, username, normalizedUsername, name: username, 'User Name': username,
          passwordHash, apiKeys, role: user.role === 'admin' || email === initialAdminEmail ? 'admin' : 'user',
          status: user.status === 'inactive' ? 'inactive' : 'active', mustChangePassword: Boolean(user.mustChangePassword),
          authVersion: Number(user.authVersion || 1), createdAt: user.createdAt || new Date(), updatedAt: new Date()
        },
        $unset: { password: '', 'User Password': '', geminiKey: '', GEMINI_API_KEY: '', openaiKey: '', OPENAI_API_KEY: '' }
      });
    }
    await db.collection('schema_migrations').updateOne({ _id: 'secure-users-v1' }, { $setOnInsert: { appliedAt: new Date(), usersMigrated: users.length } }, { upsert: true });
  }

  async function backfillReportHistory(db) {
    if (await db.collection('schema_migrations').findOne({ _id: 'report-history-v1' })) return;
    const users = await db.collection('user').find({}).toArray();
    const userByEmail = new Map(users.map(user => [normalizeEmail(user.email || user['User Email']), user]));
    const jobs = await db.collection('analysis_jobs').find({ status: 'complete', 'result.report': { $type: 'string' } }).sort({ createdAt: 1 }).toArray();
    let recovered = 0;
    for (const job of jobs) {
      const ownerEmail = normalizeEmail(job.ownerEmail); const owner = userByEmail.get(ownerEmail); const result = job.result || {};
      if (!owner || !result.report) continue;
      const items = Array.isArray(result.items) ? result.items : [{ kind: job.mode || 'legacy', status: 'success', markdown: result.report }];
      const successfulCalls = items.filter(item => item.kind === 'call' && item.status === 'success');
      await db.collection('report_runs').updateOne({ jobId: job.jobId }, { $setOnInsert: {
        jobId: job.jobId, namespace: job.namespace || 'legacy', ownerUserId: owner._id, ownerEmail, ownerName: owner.username || owner.name,
        mode: result.mode || job.mode || 'legacy', status: result.partial ? 'partial' : 'complete', provider: job.provider || '', model: result.model || '',
        companySnapshot: owner.companyName || await companyName(db) || 'QA Auditor', parameterSnapshot: job.request?.parameter || '', productSnapshot: job.request?.productSelections || [],
        files: (job.audioFiles || []).map(file => ({ name: file.name, sha256: file.sha256, mimeType: file.mimeType, size: file.size })), items, report: result.report,
        partial: Boolean(result.partial), cached: Boolean(result.cached), ceCount: successfulCalls.filter(item => item.ce).length,
        minimumScore: successfulCalls.length ? Math.min(...successfulCalls.map(item => Number(item.score) || 0)) : null,
        maximumScore: successfulCalls.length ? Math.max(...successfulCalls.map(item => Number(item.score) || 0)) : null,
        searchText: `${ownerEmail} ${job.request?.parameter || ''} ${(job.audioFiles || []).map(file => file.name).join(' ')}`.slice(0, 4000),
        createdAt: job.createdAt || job.completedAt || new Date(), completedAt: job.completedAt || job.updatedAt || new Date(), updatedAt: new Date(), firstCreatedAt: job.createdAt || new Date()
      } }, { upsert: true });
      recovered += 1;
    }
    const legacyUpdate = await db.collection('audit_result').updateMany({ ownerUserId: { $exists: false } }, { $set: { legacyUnowned: true, visibility: 'admin-only' } });
    await db.collection('schema_migrations').insertOne({ _id: 'report-history-v1', appliedAt: new Date(), recoveredRuns: recovered, legacyUnownedAudits: legacyUpdate.modifiedCount });
  }

  async function backfillLegacyAuditReports(db) {
    if (await db.collection('schema_migrations').findOne({ _id: 'legacy-audit-reports-v1' })) return;
    const audits = await db.collection('audit_result').find({ legacyUnowned: true }).toArray(); let created = 0;
    for (const audit of audits) {
      const score = Number(audit.audit_total_score); const ce = /^ce$/i.test(String(audit['CE/Non-CE'] || '').trim()); const fileName = audit.fileName || 'Legacy audit';
      const markdown = `# Legacy QA Audit\n\n- **Agent:** ${audit.agent_name || 'Unknown'}\n- **Parameter:** ${audit.qa_perameter || 'Unknown'}\n- **Score:** ${Number.isFinite(score) ? score : 'Not recorded'}\n- **CE status:** ${audit['CE/Non-CE'] || 'Not recorded'}\n\n## Product fact-check & critical error audit\n${audit['product_fact-check_&_critical_error_audit'] || 'Not recorded'}\n\n## Deduction justification\n${audit.deduction_justification || 'Not recorded'}\n\n## Strengths\n${audit.strengths_or_pros || 'Not recorded'}\n\n## Script correction\n${audit.script_correction || 'Not recorded'}\n\n## Actionable coaching\n${audit['actionable_coaching_&_final_rating'] || 'Not recorded'}`;
      const createdAt = new Date(audit.timestamp); const safeDate = Number.isFinite(createdAt.getTime()) ? createdAt : audit.createdAt || new Date();
      const result = await db.collection('report_runs').updateOne({ jobId: `legacy-audit:${audit._id}` }, { $setOnInsert: {
        jobId: `legacy-audit:${audit._id}`, namespace: 'legacy', ownerUserId: null, ownerEmail: '', ownerName: 'Legacy unowned', mode: 'legacy', status: 'legacy', visibility: 'admin-only', legacyUnowned: true,
        provider: '', model: audit.model || '', companySnapshot: audit.companySnapshot || '', parameterSnapshot: audit.qa_perameter || '', productSnapshot: audit.productSnapshot || [],
        files: [{ name: fileName, sha256: audit.fileHash || '' }], items: [{ kind: 'call', fileName, status: 'success', markdown, score: Number.isFinite(score) ? score : null, maximum: null, ce }], report: markdown,
        partial: false, cached: false, ceCount: ce ? 1 : 0, minimumScore: Number.isFinite(score) ? score : null, maximumScore: Number.isFinite(score) ? score : null,
        searchText: `${audit.agent_name || ''} ${audit.qa_perameter || ''} ${fileName}`.slice(0, 4000), createdAt: safeDate, completedAt: safeDate, updatedAt: new Date(), firstCreatedAt: safeDate
      } }, { upsert: true });
      if (result.upsertedCount) created += 1;
    }
    await db.collection('schema_migrations').insertOne({ _id: 'legacy-audit-reports-v1', appliedAt: new Date(), reportsCreated: created });
  }

  async function migrateProductHierarchy(db) {
    if (await db.collection('schema_migrations').findOne({ _id: 'product-hierarchy-v1' })) return;
    const products = await db.collection('product_brief').find({}).toArray(); const now = new Date();
    for (const product of products) {
      const categoryName = String(product.category || '').trim(); const subCategoryName = String(product.subCategory || '').trim();
      if (!categoryName || !subCategoryName) continue;
      const category = await db.collection('product_category').findOneAndUpdate(
        { normalizedName: normalizeUsername(categoryName) },
        { $setOnInsert: { name: categoryName, normalizedName: normalizeUsername(categoryName), archived: false, createdAt: now }, $set: { updatedAt: now } },
        { upsert: true, returnDocument: 'after' }
      );
      const subCategory = await db.collection('product_subcategory').findOneAndUpdate(
        { categoryId: category._id, normalizedName: normalizeUsername(subCategoryName) },
        { $setOnInsert: { categoryId: category._id, name: subCategoryName, normalizedName: normalizeUsername(subCategoryName), archived: false, createdAt: now }, $set: { updatedAt: now } },
        { upsert: true, returnDocument: 'after' }
      );
      await db.collection('product_brief').updateOne({ _id: product._id }, { $set: { categoryId: category._id, subCategoryId: subCategory._id, updatedAt: now } });
    }
    await db.collection('schema_migrations').insertOne({ _id: 'product-hierarchy-v1', appliedAt: now, productsLinked: products.length });
  }

  async function ready() {
    if (!readyPromise) readyPromise = (async () => {
      await client.connect();
      const db = client.db(databaseName);
      await migrateLegacyUsers(db);
      await ensureCollections(db);
      await migrateProductHierarchy(db);
      await backfillReportHistory(db);
      await backfillLegacyAuditReports(db);
      const jobIndexes = await db.collection('analysis_jobs').indexes().catch(() => []);
      const legacyQueueIndex = jobIndexes.find(index => index.name === 'job_queue_order' && !index.key?.namespace);
      if (legacyQueueIndex) await db.collection('analysis_jobs').dropIndex('job_queue_order');
      await Promise.all([
        db.collection('user').createIndex({ email: 1 }, { unique: true, name: 'user_email_unique' }),
        db.collection('user').createIndex({ normalizedUsername: 1 }, { unique: true, name: 'username_unique' }),
        db.collection('product_brief').createIndex({ category: 1, subCategory: 1 }, { unique: true, name: 'product_unique' }),
        db.collection('product_category').createIndex({ normalizedName: 1 }, { unique: true, name: 'product_category_unique' }),
        db.collection('product_subcategory').createIndex({ categoryId: 1, normalizedName: 1 }, { unique: true, name: 'product_subcategory_unique' }),
        db.collection('qa_scorecard').createIndex({ normalizedName: 1 }, { unique: true, name: 'qa_parameter_unique' }),
        db.collection('audit_result').createIndex({ timestamp: -1 }, { name: 'audit_timestamp' }),
        db.collection('audit_result').createIndex({ ownerUserId: 1, createdAt: -1 }, { name: 'audit_owner_history' }),
        db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true, name: 'session_token_unique' }),
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'session_ttl' }),
        db.collection('sessions').createIndex({ userId: 1 }, { name: 'session_user' }),
        db.collection('report_runs').createIndex({ ownerUserId: 1, createdAt: -1 }, { name: 'report_owner_history' }),
        db.collection('report_runs').createIndex({ createdAt: -1 }, { name: 'report_admin_history' }),
        db.collection('report_runs').createIndex({ jobId: 1 }, { unique: true, sparse: true, name: 'report_job_unique' }),
        db.collection('analysis_cache').createIndex({ key: 1 }, { unique: true, name: 'cache_key_unique' }),
        db.collection('analysis_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'cache_ttl' }),
        db.collection('analysis_jobs').createIndex({ jobId: 1 }, { unique: true, name: 'job_id_unique' }),
        db.collection('analysis_jobs').createIndex({ ownerEmail: 1, dedupeKey: 1, status: 1 }, { name: 'job_dedupe_lookup' }),
        db.collection('analysis_jobs').createIndex({ namespace: 1, status: 1, createdAt: 1 }, { name: 'job_queue_order' }),
        db.collection('analysis_jobs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'job_ttl' }),
        db.collection('audio_files.files').createIndex({ 'metadata.sha256': 1, 'metadata.ownerEmail': 1 }, { name: 'audio_hash_owner' })
      ]);
      return db;
    })().catch(error => { readyPromise = null; throw error; });
    return readyPromise;
  }

  async function companyName(db) {
    const company = await db.collection('company').findOne({ _id: 'primary' }) || await db.collection('company').findOne({}, { sort: { _id: 1 } });
    return String(company?.companyName || company?.['Company Name'] || '').trim() || null;
  }

  async function hydrateUser(db, user, includeSecrets = false) {
    if (!user) return null;
    const email = normalizeEmail(user.email || user['User Email']);
    const value = {
      ...user,
      id: String(user._id), email, username: String(user.username || user.name || user['User Name'] || email.split('@')[0]),
      name: String(user.username || user.name || user['User Name'] || email.split('@')[0]), role: user.role === 'admin' ? 'admin' : 'user',
      status: user.status === 'inactive' ? 'inactive' : 'active', active: user.status !== 'inactive',
      mustChangePassword: Boolean(user.mustChangePassword), authVersion: Number(user.authVersion || 1),
      usage: Number(user.usage ?? user.Usage ?? 0) || 0, defaultParameter: String(user.defaultParameter ?? user['Default QA Parameter'] ?? ''),
      providers: ['gemini', 'openai'].filter(provider => user.apiKeys?.[provider]?.ciphertext),
      apiKeyStatus: { gemini: security.apiKeySummary(user.apiKeys?.gemini), openai: security.apiKeySummary(user.apiKeys?.openai) },
      apiKeyFingerprints: { gemini: user.apiKeys?.gemini?.fingerprint || '', openai: user.apiKeys?.openai?.fingerprint || '' },
      companyName: await companyName(db) || user.companyName || 'QA Auditor'
    };
    if (includeSecrets) {
      value.geminiKey = security.decryptSecret(user.apiKeys?.gemini, user._id, 'gemini', encryptionKeyValue);
      value.openaiKey = security.decryptSecret(user.apiKeys?.openai, user._id, 'openai', encryptionKeyValue);
    }
    return value;
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
    async initialize() { return ready(); },
    async hasUsers() { const db = await ready(); return (await db.collection('user').estimatedDocumentCount()) > 0; },
    async findByEmail(email, options = {}) {
      const db = await ready();
      const normalized = normalizeEmail(email);
      const user = await db.collection('user').findOne({ $or: [{ email: normalized }, { 'User Email': normalized }] });
      return hydrateUser(db, user, Boolean(options.includeSecrets));
    },
    async findUserById(id, options = {}) { const db = await ready(); const _id = objectId(id); return _id ? hydrateUser(db, await db.collection('user').findOne({ _id }), Boolean(options.includeSecrets)) : null; },
    async verifyUserPassword(user, password) { return security.verifyPassword(user?.passwordHash, password); },
    async createFirstAdmin({ email, username, password, initialCompanyName }) {
      const db = await ready();
      if (await db.collection('user').countDocuments()) throw new Error('Initial setup is already complete.');
      const setupNonce = security.newToken(16);
      try { await db.collection('setup_state').insertOne({ _id: 'first-admin', status: 'creating', nonce: setupNonce, createdAt: new Date() }); }
      catch (error) { if (error.code === 11000) throw new Error('Initial setup is already in progress or complete.'); throw error; }
      const normalizedEmail = normalizeEmail(email); const normalizedUsername = normalizeUsername(username);
      try {
        const now = new Date(); const passwordHash = await security.hashPassword(password, { email: normalizedEmail, username });
        const result = await db.collection('user').insertOne({
          email: normalizedEmail, 'User Email': normalizedEmail, username: String(username).trim(), normalizedUsername,
          name: String(username).trim(), 'User Name': String(username).trim(), passwordHash, apiKeys: {}, role: 'admin', status: 'active',
          mustChangePassword: false, authVersion: 1, usage: 0, Usage: 0, defaultParameter: '', 'Default QA Parameter': '', createdAt: now, updatedAt: now
        });
        await db.collection('company').deleteMany({});
        await db.collection('company').insertOne({ _id: 'primary', companyName: String(initialCompanyName).trim(), 'Company Name': String(initialCompanyName).trim(), updatedAt: now });
        await db.collection('setup_state').updateOne({ _id: 'first-admin', nonce: setupNonce }, { $set: { status: 'complete', completedAt: now }, $unset: { nonce: '' } });
        return hydrateUser(db, await db.collection('user').findOne({ _id: result.insertedId }));
      } catch (error) { await db.collection('setup_state').deleteOne({ _id: 'first-admin', nonce: setupNonce }); throw error; }
    },
    async listUsers() {
      const db = await ready(); const users = await db.collection('user').find({}).sort({ username: 1 }).toArray();
      return Promise.all(users.map(user => hydrateUser(db, user)));
    },
    async createUser({ email, username, password }) {
      const db = await ready(); const normalizedEmail = normalizeEmail(email); const normalizedUsername = normalizeUsername(username); const now = new Date();
      const passwordHash = await security.hashPassword(password, { email: normalizedEmail, username });
      const result = await db.collection('user').insertOne({ email: normalizedEmail, 'User Email': normalizedEmail, username: String(username).trim(), normalizedUsername, name: String(username).trim(), 'User Name': String(username).trim(), passwordHash, apiKeys: {}, role: 'user', status: 'active', mustChangePassword: true, authVersion: 1, usage: 0, Usage: 0, defaultParameter: '', 'Default QA Parameter': '', createdAt: now, updatedAt: now });
      return hydrateUser(db, await db.collection('user').findOne({ _id: result.insertedId }));
    },
    async changePassword(userId, password, mustChangePassword = false) {
      const db = await ready(); const _id = objectId(userId); const user = _id ? await db.collection('user').findOne({ _id }) : null; if (!user) throw new Error('User was not found.');
      const passwordHash = await security.hashPassword(password, { email: user.email, username: user.username });
      await db.collection('user').updateOne({ _id }, { $set: { passwordHash, mustChangePassword, updatedAt: new Date() }, $inc: { authVersion: 1 } });
      await db.collection('sessions').deleteMany({ userId: _id });
      return true;
    },
    async setUserStatus(userId, status) {
      const db = await ready(); const _id = objectId(userId); if (!_id) throw new Error('User was not found.');
      if (status === 'inactive') {
        const target = await db.collection('user').findOne({ _id }); if (!target) throw new Error('User was not found.');
        if (target.role === 'admin' && await db.collection('user').countDocuments({ role: 'admin', status: 'active', _id: { $ne: _id } }) === 0) throw new Error('At least one active administrator is required.');
      }
      const result = await db.collection('user').updateOne({ _id }, { $set: { status, updatedAt: new Date() }, $inc: { authVersion: 1 } });
      if (!result.matchedCount) throw new Error('User was not found.');
      if (status === 'inactive') {
        await db.collection('sessions').deleteMany({ userId: _id });
        await db.collection('analysis_jobs').updateMany({ ownerUserId: _id, namespace: deploymentNamespace, status: 'queued' }, { $set: { status: 'cancelled', completedAt: new Date(), updatedAt: new Date(), error: { error: 'Account was deactivated.', errorCode: 'account_inactive', retryable: false } } });
      }
      return true;
    },
    async setUserRole(userId, role) {
      const db = await ready(); const _id = objectId(userId); if (!_id) throw new Error('User was not found.'); const target = await db.collection('user').findOne({ _id }); if (!target) throw new Error('User was not found.');
      if (target.role === 'admin' && role !== 'admin' && target.status === 'active' && await db.collection('user').countDocuments({ role: 'admin', status: 'active', _id: { $ne: _id } }) === 0) throw new Error('At least one active administrator is required.');
      await db.collection('user').updateOne({ _id }, { $set: { role, updatedAt: new Date() }, $inc: { authVersion: 1 } });
      await db.collection('sessions').deleteMany({ userId: _id }); return true;
    },
    async setApiKey(userId, provider, apiKey, status = 'saved') {
      const db = await ready(); const _id = objectId(userId); if (!_id || !await db.collection('user').findOne({ _id }, { projection: { _id: 1 } })) throw new Error('User was not found.');
      const record = { ...security.encryptSecret(apiKey, _id, provider, encryptionKeyValue), status };
      await db.collection('user').updateOne({ _id }, { $set: { [`apiKeys.${provider}`]: record, updatedAt: new Date() } }); return security.apiKeySummary(record);
    },
    async deleteApiKey(userId, provider) { const db = await ready(); const _id = objectId(userId); if (!_id) return false; await db.collection('user').updateOne({ _id }, { $unset: { [`apiKeys.${provider}`]: '' }, $set: { updatedAt: new Date() } }); return true; },
    async createSession(user, activeParameter = '', ttlMs = 8 * 60 * 60 * 1000) {
      const db = await ready(); const token = security.newToken(); const now = new Date();
      await db.collection('sessions').insertOne({ tokenHash: security.hashToken(token, sessionSecret), userId: objectId(user.id || user._id), email: user.email, authVersion: user.authVersion, activeParameter, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + ttlMs) });
      return token;
    },
    async getSession(token) {
      const db = await ready(); const session = await db.collection('sessions').findOne({ tokenHash: security.hashToken(token, sessionSecret), expiresAt: { $gt: new Date() } }); if (!session) return null;
      const user = await db.collection('user').findOne({ _id: session.userId, status: 'active' });
      if (!user || Number(user.authVersion || 1) !== Number(session.authVersion || 1)) { await db.collection('sessions').deleteOne({ _id: session._id }); return null; }
      return { ...session, tokenHash: undefined, userId: String(session.userId), role: user.role === 'admin' ? 'admin' : 'user', mustChangePassword: Boolean(user.mustChangePassword) };
    },
    async setSessionParameter(token, parameter) { const db = await ready(); const result = await db.collection('sessions').updateOne({ tokenHash: security.hashToken(token, sessionSecret) }, { $set: { activeParameter: parameter, updatedAt: new Date() } }); return Boolean(result.matchedCount); },
    async destroySession(token) { const db = await ready(); await db.collection('sessions').deleteOne({ tokenHash: security.hashToken(token, sessionSecret) }); },
    async getAuditConfiguration() {
      const db = await ready();
      const [products, parameters] = await Promise.all([
        db.collection('product_brief').find({ archived: { $ne: true } }, { projection: { _id: 0, category: 1, subCategory: 1 } }).sort({ _id: 1 }).toArray(),
        db.collection('qa_scorecard').find({ archived: { $ne: true } }, { projection: { _id: 0, name: 1 } }).sort({ _id: 1 }).toArray()
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
      filter = { $and: [filter, { archived: { $ne: true } }] };
      return db.collection('product_brief').find(filter, { projection: { _id: 0, category: 1, subCategory: 1, brief: 1, version: 1 } }).sort({ _id: 1 }).toArray();
    },
    async getQaParameter(name) {
      const db = await ready();
      return db.collection('qa_scorecard').findOne({ normalizedName: String(name || '').trim().toLowerCase(), archived: { $ne: true } }, { projection: { _id: 0, name: 1, detail: 1, definition: 1, version: 1 } });
    },
    async getCompany() { const db = await ready(); return { companyName: await companyName(db) || 'QA Auditor' }; },
    async updateCompany(name) { const db = await ready(); const value = String(name || '').trim(); const now = new Date(); await db.collection('company').updateOne({ _id: 'primary' }, { $set: { companyName: value, 'Company Name': value, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); return { companyName: value }; },
    async listProductTaxonomy() {
      const db = await ready(); const [categories, subCategories] = await Promise.all([db.collection('product_category').find({}).sort({ name: 1 }).toArray(), db.collection('product_subcategory').find({}).sort({ name: 1 }).toArray()]);
      return categories.map(category => ({ id: String(category._id), name: category.name, archived: Boolean(category.archived), subCategories: subCategories.filter(item => String(item.categoryId) === String(category._id)).map(item => ({ id: String(item._id), name: item.name, archived: Boolean(item.archived) })) }));
    },
    async createProductCategory(name) {
      const db = await ready(); const value = String(name || '').trim(); const now = new Date(); const result = await db.collection('product_category').insertOne({ name: value, normalizedName: normalizeUsername(value), archived: false, createdAt: now, updatedAt: now }); return { id: String(result.insertedId), name: value, archived: false, subCategories: [] };
    },
    async createProductSubCategory(categoryId, name) {
      const db = await ready(); const _categoryId = objectId(categoryId); const category = _categoryId ? await db.collection('product_category').findOne({ _id: _categoryId, archived: { $ne: true } }) : null; if (!category) throw new Error('Category was not found.');
      const value = String(name || '').trim(); const now = new Date(); const result = await db.collection('product_subcategory').insertOne({ categoryId: category._id, name: value, normalizedName: normalizeUsername(value), archived: false, createdAt: now, updatedAt: now }); return { id: String(result.insertedId), categoryId: String(category._id), name: value, archived: false };
    },
    async setProductCategoryArchived(id, archived) { const db = await ready(); const _id = objectId(id); if (!_id) throw new Error('Category was not found.'); const result = await db.collection('product_category').updateOne({ _id }, { $set: { archived: Boolean(archived), updatedAt: new Date() } }); if (!result.matchedCount) throw new Error('Category was not found.'); return true; },
    async setProductSubCategoryArchived(id, archived) { const db = await ready(); const _id = objectId(id); if (!_id) throw new Error('Sub-category was not found.'); const result = await db.collection('product_subcategory').updateOne({ _id }, { $set: { archived: Boolean(archived), updatedAt: new Date() } }); if (!result.matchedCount) throw new Error('Sub-category was not found.'); return true; },
    async listProductBriefs() { const db = await ready(); return (await db.collection('product_brief').find({}).sort({ category: 1, subCategory: 1 }).toArray()).map(item => ({ ...item, id: String(item._id), categoryId: item.categoryId ? String(item.categoryId) : '', subCategoryId: item.subCategoryId ? String(item.subCategoryId) : '', _id: undefined })); },
    async createProductBrief({ categoryId, subCategoryId, brief }) { const db = await ready(); const category = await db.collection('product_category').findOne({ _id: objectId(categoryId), archived: { $ne: true } }); const subCategory = await db.collection('product_subcategory').findOne({ _id: objectId(subCategoryId), categoryId: category?._id, archived: { $ne: true } }); if (!category || !subCategory) throw new Error('Choose a valid category and sub-category.'); const now = new Date(); const result = await db.collection('product_brief').insertOne({ categoryId: category._id, subCategoryId: subCategory._id, category: category.name, subCategory: subCategory.name, brief, archived: false, version: 1, createdAt: now, updatedAt: now }); return { id: String(result.insertedId), categoryId: String(category._id), subCategoryId: String(subCategory._id), category: category.name, subCategory: subCategory.name, brief, archived: false, version: 1 }; },
    async updateProductBrief(id, fields) { const db = await ready(); const _id = objectId(id); if (!_id) throw new Error('Product brief was not found.'); const current = await db.collection('product_brief').findOne({ _id }); if (!current) throw new Error('Product brief was not found.'); const update = { ...fields }; if (fields.categoryId || fields.subCategoryId) { const category = await db.collection('product_category').findOne({ _id: objectId(fields.categoryId || current.categoryId), archived: { $ne: true } }); const subCategory = await db.collection('product_subcategory').findOne({ _id: objectId(fields.subCategoryId || current.subCategoryId), categoryId: category?._id, archived: { $ne: true } }); if (!category || !subCategory) throw new Error('Choose a valid category and sub-category.'); Object.assign(update, { categoryId: category._id, subCategoryId: subCategory._id, category: category.name, subCategory: subCategory.name }); } await db.collection('product_brief').updateOne({ _id }, { $set: { ...update, version: Number(current.version || 1) + 1, updatedAt: new Date() } }); return true; },
    async listScorecards() { const db = await ready(); return (await db.collection('qa_scorecard').find({}).sort({ name: 1 }).toArray()).map(item => ({ ...item, id: String(item._id), _id: undefined })); },
    async createScorecard({ name, detail, definition }) { const db = await ready(); const now = new Date(); const normalizedName = normalizeUsername(name); const result = await db.collection('qa_scorecard').insertOne({ name, normalizedName, detail, definition, schemaVersion: 1, archived: false, version: 1, createdAt: now, updatedAt: now }); return { id: String(result.insertedId), name, detail, definition, archived: false, version: 1 }; },
    async updateScorecard(id, fields) { const db = await ready(); const _id = objectId(id); if (!_id) throw new Error('Scorecard was not found.'); const current = await db.collection('qa_scorecard').findOne({ _id }); if (!current) throw new Error('Scorecard was not found.'); const update = { ...fields, version: Number(current.version || 1) + 1, updatedAt: new Date() }; if (fields.name) update.normalizedName = normalizeUsername(fields.name); await db.collection('qa_scorecard').updateOne({ _id }, { $set: update }); return true; },
    async saveDefaultParameter(email, parameter) {
      const db = await ready();
      const normalized = normalizeEmail(email);
      const result = await db.collection('user').updateOne({ $or: [{ email: normalized }, { 'User Email': normalized }] }, { $set: { defaultParameter: parameter, 'Default QA Parameter': parameter, updatedAt: new Date() } });
      if (!result.matchedCount) throw new Error('User was not found.');
      return true;
    },
    async appendAuditResults(rows, metadata = {}) {
      if (!rows.length) return 0;
      const db = await ready();
      const documents = rows.map((row, rowIndex) => ({
        ...Object.fromEntries(AUDIT_HEADERS.map((header, index) => [header, row[index] ?? ''])),
        ownerUserId: objectId(metadata.ownerUserId), ownerEmail: normalizeEmail(metadata.ownerEmail), jobId: metadata.jobId || null,
        fileName: metadata.files?.[rowIndex]?.name || '', fileHash: metadata.files?.[rowIndex]?.sha256 || '',
        mode: 'single', companySnapshot: metadata.companyName || '', parameterSnapshot: metadata.parameter || '',
        productSnapshot: metadata.products || [], model: metadata.model || '', createdAt: new Date()
      }));
      await db.collection('audit_result').insertMany(documents, { ordered: true });
      return documents.length;
    },
    async saveReportRun(report) {
      const db = await ready(); const now = new Date();
      const document = { ...report, status: report.partial ? 'partial' : 'complete', ownerUserId: objectId(report.ownerUserId), ownerEmail: normalizeEmail(report.ownerEmail), namespace: deploymentNamespace, createdAt: report.createdAt || now, updatedAt: now };
      const result = await db.collection('report_runs').findOneAndUpdate({ jobId: report.jobId }, { $set: document, $setOnInsert: { firstCreatedAt: now } }, { upsert: true, returnDocument: 'after' });
      return { ...result, id: String(result._id), _id: undefined };
    },
    async listReports(viewer, query = {}) {
      const db = await ready(); const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50); const filter = {};
      if (viewer.role !== 'admin') filter.ownerUserId = objectId(viewer.id || viewer._id);
      else if (query.ownerUserId) filter.ownerUserId = objectId(query.ownerUserId);
      if (query.mode) filter.mode = query.mode;
      if (query.parameter) filter.parameterSnapshot = String(query.parameter).slice(0, 200);
      if (query.status) filter.status = String(query.status).slice(0, 30);
      if (query.ce === 'true') filter.ceCount = { $gt: 0 }; else if (query.ce === 'false') filter.ceCount = 0;
      if (query.minScore || query.maxScore) { filter.minimumScore = {}; if (query.minScore) filter.minimumScore.$gte = Number(query.minScore); if (query.maxScore) filter.minimumScore.$lte = Number(query.maxScore); }
      if (query.from || query.to) { filter.createdAt = {}; if (query.from) filter.createdAt.$gte = new Date(query.from); if (query.to) filter.createdAt.$lte = new Date(query.to); }
      if (query.cursor) { const cursor = objectId(query.cursor); if (cursor) filter._id = { $lt: cursor }; }
      if (query.search) { const escaped = String(query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ searchText: { $regex: escaped, $options: 'i' } }, { ownerEmail: { $regex: escaped, $options: 'i' } }]; }
      const rows = await db.collection('report_runs').find(filter, { projection: { report: 0, 'items.markdown': 0 } }).sort({ _id: -1 }).limit(limit + 1).toArray(); const hasMore = rows.length > limit; const page = rows.slice(0, limit);
      return { items: page.map(item => ({ ...item, id: String(item._id), ownerUserId: item.ownerUserId ? String(item.ownerUserId) : null, _id: undefined })), nextCursor: hasMore ? String(page[page.length - 1]._id) : null };
    },
    async getReport(viewer, id) { const db = await ready(); const _id = objectId(id); if (!_id) return null; const filter = { _id }; if (viewer.role !== 'admin') filter.ownerUserId = objectId(viewer.id || viewer._id); const value = await db.collection('report_runs').findOne(filter); return value ? { ...value, id: String(value._id), ownerUserId: value.ownerUserId ? String(value.ownerUserId) : null, _id: undefined } : null; },
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
      return db.collection('analysis_jobs').findOne({ namespace: deploymentNamespace, ownerEmail: normalizeEmail(ownerEmail), dedupeKey, status: { $in: ['queued', 'processing'] } }, { projection: { _id: 0, jobId: 1, status: 1, createdAt: 1 } });
    },
    async createAnalysisJob(job, audioFiles) {
      const storedAudio = [];
      try { for (const file of audioFiles) storedAudio.push(await uploadAudio(job.ownerEmail, file)); }
      catch (error) { const db = await ready(); const bucket = new GridFSBucket(db, { bucketName: 'audio_files' }); await Promise.allSettled(storedAudio.map(file => bucket.delete(file.fileId))); throw error; }
      const db = await ready();
      await db.collection('analysis_jobs').insertOne({ ...job, namespace: deploymentNamespace, ownerUserId: objectId(job.ownerUserId), ownerEmail: normalizeEmail(job.ownerEmail), audioFiles: storedAudio, status: 'queued', createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      return { jobId: job.jobId, status: 'queued' };
    },
    async acquireWorkerLease(owner, leaseMs) {
      const db = await ready(); const now = new Date(); const leaseUntil = new Date(now.getTime() + leaseMs);
      try {
        const lease = await db.collection('rate_limit_state').findOneAndUpdate(
          { _id: `${deploymentNamespace}:analysis-worker`, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }, { owner }] },
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
      await db.collection('rate_limit_state').updateOne({ _id: `${deploymentNamespace}:analysis-worker`, owner }, { $unset: { owner: '', leaseUntil: '' }, $set: { updatedAt: new Date() } });
    },
    async recoverJobs() {
      const db = await ready();
      await db.collection('analysis_jobs').updateMany({ namespace: deploymentNamespace, status: 'processing', $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: { $exists: false } }] }, { $set: { status: 'queued', updatedAt: new Date() }, $unset: { startedAt: '', workerId: '', leaseUntil: '' } });
    },
    async claimNextJob(workerId, leaseUntil) {
      const db = await ready();
      return db.collection('analysis_jobs').findOneAndUpdate({ namespace: deploymentNamespace, status: 'queued' }, { $set: { status: 'processing', startedAt: new Date(), updatedAt: new Date(), workerId, leaseUntil }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
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
      const job = await db.collection('analysis_jobs').findOne({ namespace: deploymentNamespace, ownerEmail: normalizeEmail(ownerEmail), jobId }, { projection: { _id: 0, audioFiles: 0, request: 0, prepared: 0 } });
      if (!job) return null;
      if (job.status === 'queued') job.position = await db.collection('analysis_jobs').countDocuments({ namespace: deploymentNamespace, status: 'queued', createdAt: { $lte: job.createdAt } });
      return job;
    },
    async getRateState(key = 'gemini') { const db = await ready(); return db.collection('rate_limit_state').findOne({ _id: `${deploymentNamespace}:${key}` }); },
    async setNextAllowedAt(date, key = 'gemini') { const db = await ready(); await db.collection('rate_limit_state').updateOne({ _id: `${deploymentNamespace}:${key}` }, { $set: { nextAllowedAt: date, updatedAt: new Date() } }, { upsert: true }); },
    async setCooldownUntil(date, key = 'gemini') { const db = await ready(); await db.collection('rate_limit_state').updateOne({ _id: `${deploymentNamespace}:${key}` }, [{ $set: { nextAllowedAt: { $max: [{ $ifNull: ['$nextAllowedAt', new Date(0)] }, date] }, updatedAt: '$$NOW' } }], { upsert: true }); }
  };
}

module.exports = { createMongoStore, AUDIT_HEADERS };
