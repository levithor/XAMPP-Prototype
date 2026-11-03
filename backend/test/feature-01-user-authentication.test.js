const assert = require('node:assert/strict');
const { test } = require('node:test');

const db = require('../src/config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const adminController = require('../src/controllers/adminController');
const { requireAuth } = require('../src/middleware/auth');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function stubQuery(t, implementation) {
  return t.mock.method(db, 'query', implementation);
}

test('createAdmin rejects missing required fields without hashing or querying', async (t) => {
  const query = stubQuery(t, async () => {
    throw new Error('query should not run');
  });
  const hash = t.mock.method(bcrypt, 'hash', async () => 'hash');
  const res = createResponse();

  await adminController.createAdmin({ body: { email: 'admin@example.test' } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'email, password, and username are required',
  });
  assert.equal(query.mock.callCount(), 0);
  assert.equal(hash.mock.callCount(), 0);
});

test('createAdmin hashes the password and inserts the hashed value', async (t) => {
  const hash = t.mock.method(bcrypt, 'hash', async () => 'hashed-password');
  const query = stubQuery(t, async () => [{ insertId: 17 }, []]);
  const res = createResponse();

  await adminController.createAdmin(
    { body: { email: 'admin@example.test', password: 'secret', username: 'Admin' } },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { admin_id: 17 });
  assert.deepEqual(hash.mock.calls[0].arguments, ['secret', 10]);
  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO admins/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'admin@example.test',
    'hashed-password',
    'Admin',
  ]);
});

test('createAdmin reports duplicate email conflicts', async (t) => {
  const duplicateError = Object.assign(new Error('duplicate'), {
    code: 'ER_DUP_ENTRY',
  });
  stubQuery(t, async () => {
    throw duplicateError;
  });
  t.mock.method(bcrypt, 'hash', async () => 'hashed-password');
  const res = createResponse();

  await adminController.createAdmin(
    { body: { email: 'admin@example.test', password: 'secret', username: 'Admin' } },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    error: 'an admin with that email already exists',
  });
});

test('login rejects missing credentials without querying', async (t) => {
  const query = stubQuery(t, async () => {
    throw new Error('query should not run');
  });
  const res = createResponse();

  await adminController.login({ body: { email: '', password: '' } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'email and password are required' });
  assert.equal(query.mock.callCount(), 0);
});

test('login rejects an unknown account without checking a password', async (t) => {
  stubQuery(t, async () => [[], []]);
  const compare = t.mock.method(bcrypt, 'compare', async () => true);
  const res = createResponse();

  await adminController.login(
    { body: { email: 'missing@example.test', password: 'secret' } },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'invalid credentials' });
  assert.equal(compare.mock.callCount(), 0);
});

test('login rejects a password that does not match the stored hash', async (t) => {
  const query = stubQuery(t, async () => [[{
    admin_id: 3,
    email: 'admin@example.test',
    username: 'Admin',
    password_hash: 'stored-hash',
  }], []]);
  const compare = t.mock.method(bcrypt, 'compare', async () => false);
  const sign = t.mock.method(jwt, 'sign', () => 'token');
  const res = createResponse();

  await adminController.login(
    { body: { email: 'admin@example.test', password: 'wrong' } },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'invalid credentials' });
  assert.deepEqual(compare.mock.calls[0].arguments, ['wrong', 'stored-hash']);
  assert.equal(query.mock.callCount(), 1);
  assert.equal(sign.mock.callCount(), 0);
});

test('login updates last-login and returns a signed token for valid credentials', async (t) => {
  const queries = [];
  stubQuery(t, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('SELECT * FROM admins')) {
      return [[{
        admin_id: 3,
        email: 'admin@example.test',
        username: 'Admin',
        password_hash: 'stored-hash',
        profile_image_url: null,
      }], []];
    }
    return [{ affectedRows: 1 }, []];
  });
  const compare = t.mock.method(bcrypt, 'compare', async () => true);
  const sign = t.mock.method(jwt, 'sign', () => 'signed-token');
  const res = createResponse();

  await adminController.login(
    { body: { email: 'admin@example.test', password: 'secret' } },
    res
  );

  assert.deepEqual(compare.mock.calls[0].arguments, ['secret', 'stored-hash']);
  assert.equal(queries.length, 2);
  assert.match(queries[1][0], /UPDATE admins SET last_login/);
  assert.deepEqual(queries[1][1], [3]);
  assert.deepEqual(sign.mock.calls[0].arguments[0], {
    admin_id: 3,
    email: 'admin@example.test',
    username: 'Admin',
  });
  assert.deepEqual(res.body, {
    token: 'signed-token',
    admin: {
      admin_id: 3,
      email: 'admin@example.test',
      username: 'Admin',
      profile_image_url: null,
    },
  });
});

test('requireAuth rejects a missing bearer token', () => {
  const res = createResponse();
  let nextCalled = false;

  requireAuth({ headers: {} }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'authentication required' });
  assert.equal(nextCalled, false);
});

test('requireAuth verifies a bearer token and attaches the administrator', (t) => {
  const admin = { admin_id: 3, email: 'admin@example.test' };
  const verify = t.mock.method(jwt, 'verify', () => admin);
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = createResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.deepEqual(verify.mock.calls[0].arguments, [
    'valid-token',
    process.env.JWT_SECRET || 'change_this_secret',
  ]);
  assert.equal(req.admin, admin);
  assert.equal(nextCalled, true);
});

test('requireAuth reports expired tokens distinctly', (t) => {
  const expired = Object.assign(new Error('expired'), {
    name: 'TokenExpiredError',
  });
  t.mock.method(jwt, 'verify', () => {
    throw expired;
  });
  const res = createResponse();

  requireAuth(
    { headers: { authorization: 'Bearer expired-token' } },
    res,
    () => assert.fail('next must not be called for an expired token')
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    error: 'session expired, please sign in again',
  });
});
