const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const db = require('../src/config/db');
const alertService = require('../src/services/alertService');

let occupancyAlertHandler = async () => {};
alertService.checkAndCreateAlerts = (...args) =>
  occupancyAlertHandler(...args);

const occupancyController = require('../src/controllers/occupancyController');

beforeEach(() => {
  occupancyAlertHandler = async () => {};
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

test('createLog rejects missing or unassigned cameras', async (t) => {
  let cameraRows = [];
  stubQuery(t, async () => [cameraRows, []]);
  const req = { body: { camera_id: 7, occupancy_count: 2 } };
  const missingRes = createResponse();

  await occupancyController.createLog(req, missingRes);

  assert.equal(missingRes.statusCode, 404);
  assert.deepEqual(missingRes.body, { error: 'Camera not found.' });

  cameraRows = [{ assigned_room_id: null }];
  const unassignedRes = createResponse();
  await occupancyController.createLog(req, unassignedRes);

  assert.equal(unassignedRes.statusCode, 400);
  assert.deepEqual(unassignedRes.body, { error: 'Camera is not assigned to a room.' });
});

test('createLog returns 500 when the camera lookup fails', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await occupancyController.createLog(
    { body: { camera_id: 7, occupancy_count: 2 } },
    res
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('createLog returns 500 when inserting the occupancy record fails', async (t) => {
  let queryCount = 0;
  stubQuery(t, async () => {
    queryCount += 1;
    if (queryCount === 1) return [[{ assigned_room_id: 5 }], []];
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await occupancyController.createLog(
    { body: { camera_id: 7, occupancy_count: 2 } },
    res
  );

  assert.equal(queryCount, 2);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('createLog inserts the room-camera-count tuple and updates camera communication', async (t) => {
  const queries = [];
  const alertCalls = [];
  occupancyAlertHandler = async (...args) => alertCalls.push(args);
  stubQuery(t, async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('SELECT assigned_room_id')) {
      return [[{ assigned_room_id: 5 }], []];
    }
    if (sql.includes('INSERT INTO occupancy_logs')) {
      return [{ insertId: 31 }, []];
    }
    return [{ affectedRows: 1 }, []];
  });
  const res = createResponse();

  await occupancyController.createLog(
    { body: { camera_id: 7, occupancy_count: 4 } },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { log_id: 31 });
  assert.match(queries[1][0], /INSERT INTO occupancy_logs/);
  assert.deepEqual(queries[1][1], [5, 7, 4]);
  assert.match(queries[2][0], /UPDATE cameras/);
  assert.deepEqual(queries[2][1], [7]);
  assert.deepEqual(alertCalls, [[5, 4]]);
});
