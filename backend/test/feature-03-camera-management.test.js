const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const db = require('../src/config/db');
const alertService = require('../src/services/alertService');

const cameraAlertHandlers = {
  create: async () => {},
  resolve: async () => {},
};

alertService.createCameraOfflineAlert = (...args) =>
  cameraAlertHandlers.create(...args);
alertService.resolveCameraOfflineAlert = (...args) =>
  cameraAlertHandlers.resolve(...args);

const cameraController = require('../src/controllers/cameraController');

beforeEach(() => {
  cameraAlertHandlers.create = async () => {};
  cameraAlertHandlers.resolve = async () => {};
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

test('getCameras returns rows and applies camera-status alert actions', async (t) => {
  const cameras = [
    { camera_id: 1, camera_name: 'Offline', status: 'offline', assigned_room_id: 3 },
    { camera_id: 2, camera_name: 'Online', status: 'online', assigned_room_id: 4 },
  ];
  const alertCalls = [];
  cameraAlertHandlers.create = async (...args) => alertCalls.push(['create', ...args]);
  cameraAlertHandlers.resolve = async (...args) => alertCalls.push(['resolve', ...args]);
  stubQuery(t, async () => [cameras, []]);
  const res = createResponse();

  await cameraController.getCameras({}, res);

  assert.deepEqual(res.body, cameras);
  assert.deepEqual(alertCalls, [
    ['create', 1, 'Offline', 3],
    ['resolve', 4],
  ]);
});

test('getCameraById returns 404 when no camera exists', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await cameraController.getCameraById({ params: { id: '99' } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: 'Camera not found' });
});

test('getCameras returns 500 when the database query fails', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await cameraController.getCameras({}, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});

test('createCamera rejects a missing name and inserts valid camera data', async (t) => {
  const queries = [];
  stubQuery(t, async (...args) => {
    queries.push(args);
    return [{ insertId: 21 }, []];
  });
  const invalidRes = createResponse();

  await cameraController.createCamera({ body: {} }, invalidRes);

  assert.equal(invalidRes.statusCode, 400);
  assert.equal(queries.length, 0);

  const res = createResponse();
  await cameraController.createCamera(
    { body: { camera_name: 'Lobby', rtsp_url: 'rtsp://lobby', assigned_room_id: 5 } },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { camera_id: 21 });
  assert.match(queries[0][0], /INSERT INTO cameras/);
  assert.deepEqual(queries[0][1], ['Lobby', 'rtsp://lobby', 5]);
});

test('updateCamera returns 404 when the camera was not updated', async (t) => {
  stubQuery(t, async () => [{ affectedRows: 0 }, []]);
  const res = createResponse();

  await cameraController.updateCamera(
    { params: { id: '44' }, body: { camera_name: 'Lobby' } },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: 'Camera not found' });
});

test('deleteCamera detaches logs before deleting the camera', async (t) => {
  const queries = [];
  stubQuery(t, async (...args) => {
    queries.push(args);
    return [{ affectedRows: 1 }, []];
  });
  const res = createResponse();

  await cameraController.deleteCamera({ params: { id: '12' } }, res);

  assert.match(queries[0][0], /UPDATE occupancy_logs SET camera_id = NULL WHERE camera_id = \?/);
  assert.match(queries[1][0], /DELETE FROM cameras WHERE camera_id = \?/);
  assert.deepEqual(queries.map(([, params]) => params), [['12'], ['12']]);
  assert.deepEqual(res.body, { message: 'deleted' });
});
