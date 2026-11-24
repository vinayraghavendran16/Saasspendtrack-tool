import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/admin/stats.js';

const now = Date.now();

const users = [
  {
    email: 'owner@company.com',
    status: 'active',
    created_at: now - 1000,
    trial_ends_at: now + 86400000
  },
  {
    email: 'buyer@company.com',
    status: 'trial',
    created_at: now - 1000,
    trial_ends_at: now + 86400000,
    last_login_at: now - 5000
  },
  {
    email: 'personal@gmail.com',
    status: 'trial',
    created_at: now - 1000,
    trial_ends_at: now + 86400000,
    last_login_at: now - 5000
  }
];

function mockDB() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM sessions')) {
                if (args[0] === 'valid-session') {
                  return { email: 'owner@company.com' };
                }
                if (args[0] === 'member-session') {
                  return { email: 'buyer@company.com' };
                }
                return null;
              }
              if (sql.includes('FROM users')) {
                return users.find(u => u.email === args[0]) || null;
              }
              throw new Error(`Unexpected first(): ${sql}`);
            }
          };
        },
        async all() {
          if (sql.includes('FROM users')) return { results: users };
          if (sql.includes('FROM email_log')) return { results: [] };
          throw new Error(`Unexpected all(): ${sql}`);
        }
      };
    }
  };
}

const env = {
  DB: mockDB(),
  ADMIN_EMAILS: 'owner@company.com'
};

function request(cookie = '') {
  return new Request('https://example.com/api/admin/stats', {
    headers: cookie ? { Cookie: cookie } : {}
  });
}

test('rejects unauthenticated requests', async () => {
  const response = await onRequestGet({ request: request(), env });
  assert.notEqual(response.status, 200);
});

test('rejects invalid sessions', async () => {
  const response = await onRequestGet({
    request: request('sst_session=invalid-session'),
    env
  });
  assert.notEqual(response.status, 200);
});

test('returns pipeline metrics for authorized admin', async () => {
  const response = await onRequestGet({
    request: request('sst_session=valid-session'),
    env
  });

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.equal(data.workEmailPipeline.activeWorkEmailTrials, 1);
  assert.equal(data.workEmailPipeline.verifiedWorkEmailTrials, 1);
  assert.equal(data.workEmailPipeline.excludedPersonal, 1);
  assert.equal(data.workEmailPipeline.potentialAnnualINR, 300000);
});

test('preserves original dashboard totals', async () => {
  const response = await onRequestGet({
    request: request('sst_session=valid-session'),
    env
  });

  const data = await response.json();

  assert.equal(data.totals.totalTrials, 2);
  assert.equal(data.totals.activeTrials, 2);
  assert.equal(data.totals.paid, 0);
  assert.equal(data.totals.pipelineINR, 600000);
  assert.equal(data.recent.length, 2);
  assert.equal(data.signups.length, 14);
});


test('excludes admin trial accounts even with whitespace in stored email', async () => {
  const adminTrial = {
    email: '  OWNER@COMPANY.COM  ',
    status: 'trial',
    created_at: now - 1000,
    trial_ends_at: now + 86400000,
    last_login_at: now - 5000
  };

  users.push(adminTrial);

  try {
    const response = await onRequestGet({
      request: request('sst_session=valid-session'),
      env
    });

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.equal(data.totals.totalTrials, 2);
    assert.equal(data.workEmailPipeline.activeWorkEmailTrials, 1);
    assert.equal(data.workEmailPipeline.verifiedWorkEmailTrials, 1);
    assert.equal(data.workEmailPipeline.potentialAnnualINR, 300000);
    assert.equal(
      data.recent.some(r => r.email === adminTrial.email),
      false
    );
  } finally {
    users.pop();
  }
});

test('rejects authenticated non-admin users', async () => {
  const response = await onRequestGet({
    request: request('sst_session=member-session'),
    env
  });
  assert.equal(response.status, 401);
});
