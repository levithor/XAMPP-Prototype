const assert = require('node:assert/strict');
const { test } = require('node:test');

const db = require('../src/config/db');
const occupancyController = require('../src/controllers/occupancyController');

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

test('getLogs returns occupancy records in database order', async (t) => {
  const rows = [{ log_id: 3 }, { log_id: 2 }];
  const query = stubQuery(t, async () => [rows, []]);
  const res = createResponse();

  await occupancyController.getLogs({}, res);

  assert.deepEqual(res.body, rows);
  assert.match(query.mock.calls[0].arguments[0], /FROM occupancy_logs/);
  assert.match(query.mock.calls[0].arguments[0], /ORDER BY recorded_at DESC/);
});

test('getLogs returns an empty list when there are no occupancy records', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await occupancyController.getLogs({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('getLogs reports database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await occupancyController.getLogs({}, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('getLatestOccupancy returns the latest room occupancy rows', async (t) => {
  const rows = [{ room_id: 5, occupancy_count: 7, room_name: 'Lab' }];
  const query = stubQuery(t, async () => [rows, []]);
  const res = createResponse();

  await occupancyController.getLatestOccupancy({}, res);

  assert.deepEqual(res.body, rows);
  assert.match(query.mock.calls[0].arguments[0], /MAX\(ol2\.recorded_at\)/);
  assert.match(query.mock.calls[0].arguments[0], /JOIN rooms/);
});

test('getLatestOccupancy returns an empty list when there are no records', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await occupancyController.getLatestOccupancy({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('getLatestOccupancy reports database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await occupancyController.getLatestOccupancy({}, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('getLogsByRoom filters occupancy records by the requested room', async (t) => {
  const rows = [{ log_id: 8, room_id: 12, occupancy_count: 2 }];
  const query = stubQuery(t, async () => [rows, []]);
  const res = createResponse();

  await occupancyController.getLogsByRoom({ params: { roomId: '12' } }, res);

  assert.deepEqual(res.body, rows);
  assert.match(query.mock.calls[0].arguments[0], /WHERE room_id = \?/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['12']);
});

test('getLogsByRoom returns an empty list when that room has no records', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await occupancyController.getLogsByRoom({ params: { roomId: '12' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('getLogsByRoom reports database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await occupancyController.getLogsByRoom({ params: { roomId: '12' } }, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});
