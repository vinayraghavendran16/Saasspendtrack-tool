import test from 'node:test';
import assert from 'node:assert/strict';
import { workEmailPipeline } from '../functions/_shared/work-email-pipeline.js';

const trial = (email, changes = {}) => ({
  email,
  status: 'trial',
  trial_ends_at: 2000,
  last_login_at: 500,
  ...changes
});

const run = (users, options = {}) =>
  workEmailPipeline(users, { nowMs: 1000, ...options });

test('accepts verified business-email trials', () => {
  const r = run([trial('buyer@company.com')]);
  assert.equal(r.activeWorkEmailTrials, 1);
  assert.equal(r.verifiedWorkEmailTrials, 1);
});

test('excludes personal email domains', () => {
  assert.equal(run([trial('buyer@gmail.com')]).excludedPersonal, 1);
});

test('excludes expired trials', () => {
  assert.equal(run([trial('buyer@company.com', { trial_ends_at: 1000 })]).activeWorkEmailTrials, 0);
});

test('excludes paid accounts from trial pipeline', () => {
  assert.equal(run([trial('buyer@company.com', { status: 'active' })]).activeWorkEmailTrials, 0);
});

test('counts users without a successful login as unverified', () => {
  const r = run([trial('buyer@company.com', { last_login_at: null })]);
  assert.equal(r.activeWorkEmailTrials, 1);
  assert.equal(r.verifiedWorkEmailTrials, 0);
  assert.equal(r.unverified, 1);
});

test('deduplicates email addresses', () => {
  assert.equal(run([trial('buyer@company.com'), trial('buyer@company.com')]).duplicateRows, 1);
});

test('excludes configured internal addresses', () => {
  assert.equal(run([trial('staff@company.com')], {
    excludedEmails: ['staff@company.com']
  }).excludedInternal, 1);
});

test('excludes configured domains', () => {
  assert.equal(run([trial('buyer@internal.com')], {
    excludedDomains: ['internal.com']
  }).excludedPersonal, 1);
});

test('rejects invalid email addresses', () => {
  assert.equal(run([trial('invalid')]).excludedInvalid, 1);
});

test('calculates potential annual value using verified trials only', () => {
  const r = run([
    trial('buyer@company.com'),
    trial('pending@company.com', { last_login_at: null })
  ]);
  assert.equal(r.potentialAnnualINR, 300000);
});

test('does not mutate input records', () => {
  const users = [trial('buyer@company.com')];
  const before = JSON.stringify(users);
  run(users);
  assert.equal(JSON.stringify(users), before);
});
