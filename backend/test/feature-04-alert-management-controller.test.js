const assert = require('node:assert/strict');
const { test } = require('node:test');

const db = require('../src/config/db');
const alertController = require('../src/controllers/alertController');

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

test('getAlerts returns alert rows in creation-time order', async (t) => {
  const rows = [{ alert_id: 8 }, { alert_id: 7 }];
  const query = stubQuery(t, async () => [rows, []]);
  const res = createResponse();

  await alertController.getAlerts({}, res);

  assert.deepEqual(res.body, rows);
  assert.match(query.mock.calls[0].arguments[0], /FROM alerts/);
  assert.match(query.mock.calls[0].arguments[0], /ORDER BY created_at DESC/);
  assert.equal(query.mock.calls[0].arguments.length, 1);
});

test('getAlerts returns an empty list when there are no alerts', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await alertController.getAlerts({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('getAlerts reports database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await alertController.getAlerts({}, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('resolveAlert marks the requested alert resolved', async (t) => {
  const query = stubQuery(t, async () => [{ affectedRows: 1 }, []]);
  const res = createResponse();

  await alertController.resolveAlert({ params: { id: '14' } }, res);

  assert.match(query.mock.calls[0].arguments[0], /SET is_resolved = TRUE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['14']);
  assert.deepEqual(res.body, { message: 'Alert resolved' });
});

test('unresolveAlert marks the requested alert unresolved', async (t) => {
  const query = stubQuery(t, async () => [{ affectedRows: 1 }, []]);
  const res = createResponse();

  await alertController.unresolveAlert({ params: { id: '15' } }, res);

  assert.match(query.mock.calls[0].arguments[0], /SET is_resolved = FALSE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['15']);
  assert.deepEqual(res.body, { message: 'Alert unresolved' });
});

test('deleteAlert deletes the requested alert', async (t) => {
  const query = stubQuery(t, async () => [{ affectedRows: 1 }, []]);
  const res = createResponse();

  await alertController.deleteAlert({ params: { id: '16' } }, res);

  assert.match(query.mock.calls[0].arguments[0], /DELETE FROM alerts\s+WHERE alert_id = \?/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['16']);
  assert.deepEqual(res.body, { message: 'Alert deleted' });
});

test('alert status and delete operations report database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const actions = [
    [alertController.resolveAlert, { params: { id: '14' } }],
    [alertController.unresolveAlert, { params: { id: '15' } }],
    [alertController.deleteAlert, { params: { id: '16' } }],
  ];

  for (const [action, req] of actions) {
    const res = createResponse();

    await action(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'database unavailable' });
  }
});
