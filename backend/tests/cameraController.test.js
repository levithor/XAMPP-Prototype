const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const cameraController = require('../src/controllers/cameraController');
const cameraServiceController = require('../src/controllers/cameraServiceController');
const { requireCameraService } = require('../src/middleware/cameraServiceAuth');

function response() {
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

test('ordinary camera lookup redacts RTSP authority and query credentials', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  db.query = async () => [[{
    camera_id: 7,
    camera_name: 'Test camera',
    rtsp_url: 'rtsp://operator:s3cr3t@camera.local/live?username=admin&password=pwd&access_key=keyvalue',
  }]];

  const res = response();
  await cameraController.getCameraById({ params: { id: '7' } }, res);

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(JSON.stringify(res.body), /operator|s3cr3t|admin|pwd|keyvalue/);
  assert.match(res.body.rtsp_url, /REDACTED/);
});

test('connect validates room and URL before updating only desired state', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT rtsp_url')) {
      return [[{ rtsp_url: 'rtsp://camera.local/live', assigned_room_id: 4 }]];
    }
    if (sql.startsWith('SELECT camera_id')) return [[{ camera_id: 7 }]];
    return [{ affectedRows: 0 }];
  };

  const res = response();
  await cameraController.setConnectionState({
    params: { id: '7' },
    body: { desired_connection_state: 'connected' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { camera_id: 7, desired_connection_state: 'connected' });
  assert.match(queries[1].sql, /desired_connection_state/);
  assert.doesNotMatch(queries[1].sql, /last_communication/);
});

test('connect rejects a camera without a room without persisting desired state', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  let updateAttempted = false;
  db.query = async (sql) => {
    if (sql.startsWith('SELECT rtsp_url')) {
      return [[{ rtsp_url: 'rtsp://camera.local/live', assigned_room_id: null }]];
    }
    updateAttempted = true;
    return [{ affectedRows: 1 }];
  };

  const res = response();
  await cameraController.setConnectionState({
    params: { id: '7' },
    body: { desired_connection_state: 'connected' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Assign this camera to a room/);
  assert.equal(updateAttempted, false);
});

test('disconnect is idempotent for a camera already marked disconnected', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  db.query = async (sql) => {
    if (sql.startsWith('UPDATE cameras')) return [{ affectedRows: 0 }];
    return [[{ camera_id: 7 }]];
  };

  const res = response();
  await cameraController.setConnectionState({
    params: { id: '7' },
    body: { desired_connection_state: 'disconnected' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.desired_connection_state, 'disconnected');
});

test('malformed RTSP input is rejected without echoing the submitted value', async () => {
  const res = response();
  await cameraController.createCamera({
    body: {
      camera_name: 'Test camera',
      rtsp_url: 'not-an-rtsp-url-with-password',
      assigned_room_id: 1,
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(JSON.stringify(res.body), /password/);
});

test('camera edit without an RTSP URL preserves its stored value', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  let queryParams;
  db.query = async (sql, params) => {
    queryParams = params;
    return [{ affectedRows: 1 }];
  };

  const res = response();
  await cameraController.updateCamera({
    params: { id: '7' },
    body: { camera_name: 'Renamed camera', assigned_room_id: 4 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(queryParams[1], false);
  assert.equal(queryParams[2], null);
});

test('changing RTSP URL clears stale communication status', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  let queryText = '';
  let queryParams;
  db.query = async (sql, params) => {
    queryText = sql;
    queryParams = params;
    return [{ affectedRows: 1 }];
  };

  const res = response();
  await cameraController.updateCamera({
    params: { id: '7' },
    body: {
      camera_name: 'Test camera',
      assigned_room_id: 4,
      rtsp_url: 'rtsp://new-user:new-password@camera.local/live',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.match(queryText, /last_communication = CASE WHEN \? THEN NULL/);
  assert.equal(queryParams[3], true);
  assert.doesNotMatch(JSON.stringify(res.body), /new-user|new-password/);
});

test('camera edit rejects a redacted RTSP URL instead of storing its marker', async (t) => {
  let queryAttempted = false;
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  db.query = async () => {
    queryAttempted = true;
    return [{ affectedRows: 1 }];
  };

  const res = response();
  await cameraController.updateCamera({
    params: { id: '7' },
    body: {
      camera_name: 'Renamed camera',
      assigned_room_id: 4,
      rtsp_url: 'rtsp://REDACTED:REDACTED@camera.local/live',
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queryAttempted, false);
});

test('Python configuration endpoint selects only manager fields', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  let queryText = '';
  db.query = async (sql) => {
    queryText = sql;
    return [[{
      camera_id: 7,
      rtsp_url: 'rtsp://user:secret@camera.local/live',
      assigned_room_id: 4,
    }]];
  };

  const res = response();
  await cameraServiceController.getDesiredCameras({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body[0]).sort(), [
    'assigned_room_id',
    'camera_id',
    'rtsp_url',
  ]);
  assert.match(queryText, /desired_connection_state = 'connected'/);
});

test('Python service startup clears communication only for desired-connected cameras', async (t) => {
  const originalQuery = db.query;
  t.after(() => { db.query = originalQuery; });
  let queryText = '';
  db.query = async (sql) => {
    queryText = sql;
    return [{ affectedRows: 2 }];
  };

  const res = response();
  await cameraServiceController.markDesiredCamerasOffline({}, res);

  assert.equal(res.statusCode, 200);
  assert.match(queryText, /SET last_communication = NULL/);
  assert.match(queryText, /desired_connection_state = 'connected'/);
});

test('camera service middleware requires the configured bearer token', async (t) => {
  const originalToken = process.env.CAMERA_SERVICE_TOKEN;
  t.after(() => {
    if (originalToken === undefined) delete process.env.CAMERA_SERVICE_TOKEN;
    else process.env.CAMERA_SERVICE_TOKEN = originalToken;
  });
  process.env.CAMERA_SERVICE_TOKEN = 'test-only-service-token';

  const res = response();
  const req = { get: () => 'Bearer wrong-token' };
  let nextCalled = false;
  requireCameraService(req, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.doesNotMatch(JSON.stringify(res.body), /test-only-service-token|wrong-token/);
});
