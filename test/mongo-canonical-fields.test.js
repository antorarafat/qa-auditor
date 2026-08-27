const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalFieldCleanupUpdate } = require('../lib/mongo-store');

test('removes matching user aliases without rewriting canonical values', () => {
  const prepared = canonicalFieldCleanupUpdate('user', {
    email: 'person@example.test',
    'User Email': 'PERSON@example.test ',
    username: 'Person',
    name: 'Person',
    'User Name': 'Person',
    usage: 4,
    Usage: '4',
    defaultParameter: 'Outbound',
    'Default QA Parameter': 'Outbound',
    normalizedUsername: 'person'
  });

  assert.deepEqual(prepared.update, { $unset: {
    'User Email': '', name: '', 'User Name': '', Usage: '', 'Default QA Parameter': ''
  } });
  assert.deepEqual(prepared.stats, { fieldsBackfilled: 0, fieldsRemoved: 5, conflicts: 0 });
});

test('backfills canonical fields before removing legacy aliases', () => {
  const prepared = canonicalFieldCleanupUpdate('qa_scorecard', {
    'QA Parameter': ' Inbound ',
    Details: 'Rubric detail'
  });

  assert.deepEqual(prepared.update, {
    $set: { name: 'Inbound', detail: 'Rubric detail', normalizedName: 'inbound' },
    $unset: { 'QA Parameter': '', Details: '' }
  });
  assert.deepEqual(prepared.stats, { fieldsBackfilled: 2, fieldsRemoved: 2, conflicts: 0 });
});

test('keeps canonical data when a legacy alias conflicts', () => {
  const prepared = canonicalFieldCleanupUpdate('company', {
    companyName: 'Canonical Company',
    'Company Name': 'Old Company'
  });

  assert.deepEqual(prepared.update, { $unset: { 'Company Name': '' } });
  assert.equal(prepared.stats.conflicts, 1);
});

test('keeps the required audit_result field and removes its redundant snapshot', () => {
  const prepared = canonicalFieldCleanupUpdate('audit_result', {
    qa_perameter: 'Outbound',
    parameterSnapshot: 'Outbound'
  });

  assert.deepEqual(prepared.update, { $unset: { parameterSnapshot: '' } });
  assert.equal(prepared.stats.conflicts, 0);
});
