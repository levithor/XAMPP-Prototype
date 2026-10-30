const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const db = require('../src/config/db');
const alertService = require('../src/services/alertService');

let alertHandler = async () => {};
alertService.checkAndCreateAlerts = (...args) => alertHandler(...args);

const roomController = require('../src/controllers/roomController');

beforeEach(() => {
  alertHandler = async () => {};
});

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

function createConnection(queryImplementation) {
  return {
    beginTransaction: async () => {},
    query: queryImplementation,
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
}

test('getRooms returns database rows and reports query failures', async (t) => {
  const rooms = [{ room_id: 4, room_name: 'Lab' }];
  let shouldFail = false;
  stubQuery(t, async () => {
    if (shouldFail) throw new Error('database unavailable');
    return [rooms, []];
  });
  const success = createResponse();

  await roomController.getRooms({}, success);

  assert.deepEqual(success.body, rooms);

  shouldFail = true;
  const failure = createResponse();

  await roomController.getRooms({}, failure);

  assert.equal(failure.statusCode, 500);
  assert.deepEqual(failure.body, { error: 'database unavailable' });
});

test('getRoomById returns 404 when no room matches', async (t) => {
  const query = stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await roomController.getRoomById({ params: { room_id: '44' } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Room not found' });
  assert.deepEqual(query.mock.calls[0].arguments[1], ['44']);
});

test('createRoom requires a name and applies documented defaults', async (t) => {
  const query = stubQuery(t, async () => [{ insertId: 18 }, []]);
  const invalid = createResponse();

  await roomController.createRoom({ body: {} }, invalid);

  assert.equal(invalid.statusCode, 400);
  assert.equal(query.mock.callCount(), 0);

  const res = createResponse();
  await roomController.createRoom({ body: { room_name: 'Lab' } }, res);

  assert.deepEqual(res.body, { message: 'Room created', room_id: 18 });
  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO rooms/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['Lab', 40, 35]);
});

test('createRoom passes supplied capacity values to the insert', async (t) => {
  const query = stubQuery(t, async () => [{ insertId: 19 }, []]);
  const res = createResponse();

  await roomController.createRoom(
    { body: { room_name: 'Studio', capacity_limit: 24, occupancy_threshold: 20 } },
    res
  );

  assert.deepEqual(query.mock.calls[0].arguments[1], ['Studio', 24, 20]);
});

test('updateRoom updates fields and rechecks alerts using the latest occupancy', async (t) => {
  const queries = [];
  const alertCalls = [];
  alertHandler = async (...args) => alertCalls.push(args);
  stubQuery(t, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('UPDATE rooms')) return [{ affectedRows: 1 }, []];
    if (sql.includes('SELECT occupancy_count')) {
      return [[{ occupancy_count: 21 }], []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  const res = createResponse();

  await roomController.updateRoom(
    {
      params: { room_id: '8' },
      body: { room_name: 'Studio', capacity_limit: 24, occupancy_threshold: 20 },
    },
    res
  );

  assert.deepEqual(res.body, { message: 'Room updated' });
  assert.match(queries[0][0], /UPDATE rooms SET/);
  assert.deepEqual(queries[0][1], ['Studio', 24, 20, '8']);
  assert.match(queries[1][0], /SELECT occupancy_count/);
  assert.deepEqual(queries[1][1], ['8']);
  assert.deepEqual(alertCalls, [['8', 21]]);
});

test('updateRoom returns 404 without querying occupancy for an unknown room', async (t) => {
  const query = stubQuery(t, async () => [{ affectedRows: 0 }, []]);
  const res = createResponse();

  await roomController.updateRoom(
    { params: { room_id: '99' }, body: { room_name: 'Missing' } },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Room not found' });
  assert.equal(query.mock.callCount(), 1);
});

test('deleteRoom detaches related data and commits successful deletion', async (t) => {
  const statements = [];
  const lifecycle = [];
  const conn = createConnection(async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('DELETE FROM rooms')) return [{ affectedRows: 1 }, []];
    return [{ affectedRows: 1 }, []];
  });
  conn.beginTransaction = async () => lifecycle.push('begin');
  conn.commit = async () => lifecycle.push('commit');
  conn.rollback = async () => lifecycle.push('rollback');
  conn.release = () => lifecycle.push('release');
  t.mock.method(db, 'getConnection', async () => conn);
  const res = createResponse();

  await roomController.deleteRoom({ params: { room_id: '8' } }, res);

  assert.deepEqual(res.body, { message: 'Room deleted' });
  assert.match(statements[0][0], /DELETE FROM alerts\s+WHERE room_id = \?/);
  assert.match(statements[1][0], /DELETE FROM occupancy_logs WHERE room_id = \?/);
  assert.match(statements[2][0], /UPDATE cameras SET assigned_room_id = NULL WHERE assigned_room_id = \?/);
  assert.match(statements[3][0], /DELETE FROM rooms WHERE room_id = \?/);
  assert.deepEqual(statements.map(([, params]) => params), [
    ['8'],
    ['8'],
    ['8'],
    ['8'],
  ]);
  assert.deepEqual(lifecycle, ['begin', 'commit', 'release']);
});

test('deleteRoom rolls back and releases the connection when a query fails', async (t) => {
  const lifecycle = [];
  const conn = createConnection(async () => {
    throw new Error('database unavailable');
  });
  conn.beginTransaction = async () => lifecycle.push('begin');
  conn.commit = async () => lifecycle.push('commit');
  conn.rollback = async () => lifecycle.push('rollback');
  conn.release = () => lifecycle.push('release');
  t.mock.method(db, 'getConnection', async () => conn);
  t.mock.method(console, 'error', () => {});
  const res = createResponse();

  await roomController.deleteRoom({ params: { room_id: '8' } }, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
  assert.deepEqual(lifecycle, ['begin', 'rollback', 'release']);
});
