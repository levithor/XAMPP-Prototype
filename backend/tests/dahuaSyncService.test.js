const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DahuaSyncService,
  validateHistoryPage,
  validateLatestResponse,
} = require('../src/services/dahuaSyncService');
const fs = require('node:fs');
const path = require('node:path');

function measuredState({
  cameraId = 'cam-01',
  areaId = '1',
  count = 5,
  observationId = 1001,
  observedAt = '2026-11-02T00:30:00.123456Z',
  evaluatedAt = '2026-11-02T00:30:01.000000Z',
  status = 'measured',
} = {}) {
  return {
    camera_id: cameraId,
    area_id: areaId,
    occupancy_count: count,
    observation_id: observationId,
    status,
    observed_at_utc: observedAt,
    received_at_utc: observedAt,
    status_evaluated_at_utc: evaluatedAt,
    reporting_status: 'recently_reporting',
  };
}

function historyEvent(observationId, count = 5, cameraId = 'cam-01', areaId = '1') {
  return {
    camera_id: cameraId,
    area_id: areaId,
    occupancy_count: count,
    observation_id: observationId,
    status: 'measured',
    observed_at_utc: '2026-11-02T00:30:00.123456Z',
  };
}

function historyPage(events) {
  return {
    events,
    limit: 500,
    next_before_observation_id: events.length === 500
      ? events[events.length - 1].observation_id
      : null,
  };
}

function makeMemoryDatabase(cameraRows) {
  const store = {
    cameras: cameraRows.map((camera) => ({ ...camera })),
    states: new Map(),
    logs: new Map(),
    checkpoints: new Map(),
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function selectCamera(id) {
    return store.cameras.find((camera) => Number(camera.camera_id) === Number(id));
  }

  async function poolQuery(sql, params = []) {
    if (sql.includes('FROM cameras') && sql.includes("desired_connection_state = 'connected'")) {
      return [clone(store.cameras.filter((camera) =>
        camera.source_type === 'dahua_external'
          && camera.desired_connection_state === 'connected'
      )), []];
    }
    if (sql.includes('UPDATE camera_external_state ces')) return [{ affectedRows: 0 }, []];
    if (sql.startsWith('INSERT IGNORE INTO dahua_sync_checkpoints')) {
      const [key, cameraId, externalCameraId, externalAreaId] = params;
      if (!store.checkpoints.has(key)) {
        store.checkpoints.set(key, {
          checkpoint_key: key,
          camera_id: cameraId,
          external_camera_id: externalCameraId,
          external_area_id: externalAreaId,
          completed_observation_id: null,
          scan_target_observation_id: null,
          scan_before_observation_id: null,
        });
      }
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('SELECT completed_observation_id')) {
      const checkpoint = store.checkpoints.get(params[0]);
      return [checkpoint ? [clone(checkpoint)] : [], []];
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  }

  const database = {
    query: poolQuery,
    async getConnection() {
      let snapshot;
      return {
        async beginTransaction() {
          snapshot = clone({
            states: [...store.states.entries()],
            logs: [...store.logs.entries()],
            checkpoints: [...store.checkpoints.entries()],
          });
        },
        async commit() {
          snapshot = null;
        },
        async rollback() {
          if (!snapshot) return;
          store.states = new Map(snapshot.states);
          store.logs = new Map(snapshot.logs);
          store.checkpoints = new Map(snapshot.checkpoints);
          snapshot = null;
        },
        release() {},
        async query(sql, params = []) {
          if (sql.startsWith('SELECT source_type')) {
            const camera = selectCamera(params[0]);
            return [camera ? [{
              source_type: camera.source_type,
              external_camera_id: camera.external_camera_id,
              external_area_id: camera.external_area_id,
              assigned_room_id: camera.assigned_room_id,
              desired_connection_state: camera.desired_connection_state,
              dahua_mapping_revision: camera.dahua_mapping_revision,
              dahua_mapping_updated_at: camera.dahua_mapping_updated_at,
            }] : [], []];
          }
          if (sql.includes('FROM camera_external_state') && sql.includes('FOR UPDATE')) {
            const state = store.states.get(Number(params[0]));
            if (!state) return [[], []];
            if (sql.includes('DATE_FORMAT')) return [[clone(state)], []];
            if (sql.includes('SELECT observation_id, occupancy_status')) {
              return [[{
                observation_id: state.observation_id,
                occupancy_status: state.occupancy_status,
              }], []];
            }
            return [[{
              external_camera_id: state.external_camera_id,
              external_area_id: state.external_area_id,
            }], []];
          }
          if (sql.startsWith('DELETE FROM camera_external_state')) {
            store.states.delete(Number(params[0]));
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('INSERT INTO camera_external_state')) {
            const [
              cameraId, externalCameraId, externalAreaId, occupancyCount, occupancyStatus,
              observationId, observedAt, receivedAt, evaluatedAt, reportingStatus,
            ] = params;
            store.states.set(Number(cameraId), {
              camera_id: Number(cameraId),
              external_camera_id: externalCameraId,
              external_area_id: externalAreaId,
              occupancy_count: occupancyCount,
              occupancy_status: occupancyStatus,
              observation_id: observationId,
              observed_at_utc: observedAt,
              received_at_utc: receivedAt,
              status_evaluated_at_utc: evaluatedAt,
              reporting_status: reportingStatus,
              sync_health: 'pending',
              last_error_code: null,
            });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('UPDATE camera_external_state') && sql.includes('occupancy_count = ?')) {
            const [
              occupancyCount, occupancyStatus, observationId, observedAt,
              receivedAt, evaluatedAt, reportingStatus, cameraId,
            ] = params;
            const state = store.states.get(Number(cameraId));
            Object.assign(state, {
              occupancy_count: occupancyCount,
              occupancy_status: occupancyStatus,
              observation_id: observationId,
              observed_at_utc: observedAt,
              received_at_utc: receivedAt,
              status_evaluated_at_utc: evaluatedAt,
              reporting_status: reportingStatus,
            });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('UPDATE camera_external_state') && sql.includes('sync_health = ?')) {
            const [syncHealth, errorCode, successfulRequest, cameraId] = params;
            const state = store.states.get(Number(cameraId));
            Object.assign(state, {
              sync_health: syncHealth,
              last_error_code: errorCode,
              ...(successfulRequest ? { last_successful_sync_at: 'database-now' } : {}),
            });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('SELECT external_camera_id, external_area_id FROM occupancy_logs')) {
            const log = store.logs.get(Number(params[0]));
            return [log ? [{
              external_camera_id: log.external_camera_id,
              external_area_id: log.external_area_id,
            }] : [], []];
          }
          if (sql.startsWith('SELECT external_camera_id, external_area_id')) {
            const state = store.states.get(Number(params[0]));
            return [state ? [{
              external_camera_id: state.external_camera_id,
              external_area_id: state.external_area_id,
            }] : [], []];
          }
          if (sql.startsWith('INSERT INTO occupancy_logs')) {
            const [
              roomId, cameraId, occupancyCount, recordedAt, observationId,
              externalCameraId, externalAreaId,
            ] = params;
            if (store.logs.has(Number(observationId))) {
              const error = new Error('duplicate key');
              error.code = 'ER_DUP_ENTRY';
              throw error;
            }
            store.logs.set(Number(observationId), {
              room_id: roomId,
              camera_id: cameraId,
              occupancy_count: occupancyCount,
              recorded_at: recordedAt,
              source_type: 'dahua_external',
              external_observation_id: observationId,
              external_camera_id: externalCameraId,
              external_area_id: externalAreaId,
            });
            return [{ affectedRows: 1, insertId: observationId }, []];
          }
          if (sql.startsWith('UPDATE dahua_sync_checkpoints')) {
            const [
              completedId, scanTargetId, scanBeforeId, key, cameraId,
              externalCameraId, externalAreaId,
            ] = params;
            const checkpoint = store.checkpoints.get(key);
            assert.ok(checkpoint);
            assert.equal(checkpoint.camera_id, cameraId);
            assert.equal(checkpoint.external_camera_id, externalCameraId);
            assert.equal(checkpoint.external_area_id, externalAreaId);
            Object.assign(checkpoint, {
              completed_observation_id: completedId,
              scan_target_observation_id: scanTargetId,
              scan_before_observation_id: scanBeforeId,
            });
            return [{ affectedRows: 1 }, []];
          }
          throw new Error(`Unexpected connection query: ${sql}`);
        },
      };
    },
  };

  return { database, store };
}

function connectedCamera(cameraId = 7, externalCameraId = 'cam-01', areaId = '1') {
  return {
    camera_id: cameraId,
    external_camera_id: externalCameraId,
    external_area_id: areaId,
    assigned_room_id: 4,
    dahua_mapping_revision: 1,
    dahua_mapping_updated_at: '2026-11-01 00:00:00.000000',
    source_type: 'dahua_external',
    desired_connection_state: 'connected',
  };
}

function silentLogger() {
  return { error() {} };
}

test('contract validation preserves explicit inferred, stale, and unknown states', () => {
  const states = validateLatestResponse({
    cameras: [
      measuredState(),
      measuredState({
        cameraId: 'cam-02',
        status: 'inferred_zero',
        count: 0,
        observationId: 1002,
      }),
      measuredState({
        cameraId: 'cam-04',
        status: 'stale',
        count: 2,
        observationId: 1004,
      }),
      {
        camera_id: 'cam-03',
        area_id: '3',
        occupancy_count: null,
        observation_id: null,
        status: 'unknown',
        observed_at_utc: null,
        received_at_utc: null,
        status_evaluated_at_utc: '2026-11-02T00:30:01.000000Z',
        reporting_status: 'unknown',
      },
    ],
  });

  assert.equal(states.get('cam-02\u00001').status, 'inferred_zero');
  assert.equal(states.get('cam-03\u00003').occupancyCount, null);
  assert.equal(states.get('cam-04\u00001').status, 'stale');
});

test('history validation enforces descending observation IDs and documented cursor', () => {
  assert.doesNotThrow(() => validateHistoryPage(historyPage([
    historyEvent(9),
    historyEvent(4),
  ]), null));
  assert.throws(() => validateHistoryPage({
    events: [historyEvent(4), historyEvent(9)],
    next_before_observation_id: null,
  }, null), /unordered/);
  assert.throws(() => validateHistoryPage({
    events: [historyEvent(9)],
    next_before_observation_id: 9,
  }, null), /partial page/);
});

test('measured observations import once and inferred-zero updates current status only', async () => {
  const { database, store } = makeMemoryDatabase([connectedCamera()]);
  const alerts = [];
  let latest = measuredState();
  const client = {
    getLatest: async () => ({ cameras: [latest] }),
    getHistory: async () => historyPage([historyEvent(1001)]),
  };
  const service = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async (...args) => alerts.push(args),
    logger: silentLogger(),
    now: () => Date.parse('2026-11-02T00:31:00Z'),
  });

  await service.runOnce();
  await service.runOnce();
  assert.equal(store.logs.size, 1);
  assert.equal(alerts.length, 1);
  assert.equal([...store.logs.values()][0].recorded_at, '2026-11-02 00:30:00.123456');
  assert.equal([...store.logs.values()][0].source_type, 'dahua_external');

  latest = measuredState({
    status: 'inferred_zero',
    count: 0,
    evaluatedAt: '2026-11-02T00:30:20.000000Z',
  });
  await service.runOnce();
  assert.equal(store.logs.size, 1);
  assert.equal(store.states.get(7).occupancy_status, 'inferred_zero');
  assert.equal(store.states.get(7).occupancy_count, 0);
  assert.equal(alerts.length, 1);
});

test('older event times cannot replace newer current state', () => {
  const service = new DahuaSyncService({ logger: silentLogger() });
  const [olderState] = validateLatestResponse({
    cameras: [measuredState({
      observationId: 1001,
      observedAt: '2026-11-02T00:29:00.000000Z',
      evaluatedAt: '2026-11-02T00:31:00.000000Z',
    })],
  }).values();
  const current = {
    observation_id: 1002,
    observed_at_utc: '2026-11-02 00:30:00.000000',
    status_evaluated_at_utc: '2026-11-02 00:30:30.000000',
  };

  assert.equal(service.shouldApplyState(current, olderState), false);
});

test('history pagination checkpoints each bounded page and resumes after restart', async () => {
  const events = Array.from({ length: 501 }, (_, index) =>
    historyEvent(1001 - index, index === 0 ? 5 : 1)
  );
  const firstPage = historyPage(events.slice(0, 500));
  const secondPage = historyPage(events.slice(500));
  const { database, store } = makeMemoryDatabase([connectedCamera()]);
  const requestedBeforeIds = [];
  const client = {
    getLatest: async () => ({ cameras: [measuredState()] }),
    getHistory: async ({ beforeObservationId }) => {
      requestedBeforeIds.push(beforeObservationId ?? null);
      return beforeObservationId == null ? firstPage : secondPage;
    },
  };

  const firstInstance = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async () => {},
    logger: silentLogger(),
    maxHistoryPagesPerCamera: 1,
  });
  await firstInstance.runOnce();

  const checkpoint = [...store.checkpoints.values()][0];
  assert.equal(checkpoint.completed_observation_id, null);
  assert.equal(checkpoint.scan_target_observation_id, 1001);
  assert.equal(checkpoint.scan_before_observation_id, 502);
  assert.equal(store.logs.size, 500);

  const restartedInstance = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async () => {},
    logger: silentLogger(),
    maxHistoryPagesPerCamera: 1,
  });
  await restartedInstance.runOnce();

  assert.deepEqual(requestedBeforeIds, [null, 502]);
  assert.equal(store.logs.size, 501);
  assert.equal(checkpoint.completed_observation_id, 1001);
  assert.equal(checkpoint.scan_target_observation_id, null);
  assert.equal(checkpoint.scan_before_observation_id, null);
});

test('mapping changes during a request prevent importing to the wrong camera', async () => {
  const { database, store } = makeMemoryDatabase([connectedCamera()]);
  const client = {
    getLatest: async () => {
      store.cameras[0].external_camera_id = 'cam-02';
      return { cameras: [measuredState()] };
    },
    getHistory: async () => historyPage([historyEvent(1001)]),
  };
  const service = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async () => {},
    logger: silentLogger(),
  });

  await service.runOnce();
  assert.equal(store.logs.size, 0);
});

test('events older than a changed camera-to-room mapping are not imported into its new room', async () => {
  const camera = connectedCamera();
  camera.dahua_mapping_revision = 2;
  camera.dahua_mapping_updated_at = '2026-11-02 00:31:00.000000';
  const { database, store } = makeMemoryDatabase([camera]);
  const client = {
    getLatest: async () => ({
      cameras: [measuredState({
        observationId: 1001,
        observedAt: '2026-11-02T00:30:00.123456Z',
      })],
    }),
    getHistory: async () => historyPage([historyEvent(1001)]),
  };
  const service = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async () => {},
    logger: silentLogger(),
  });

  await service.runOnce();

  assert.equal(store.logs.size, 0);
  assert.equal([...store.checkpoints.values()][0].completed_observation_id, 1001);
});

test('one camera history failure does not block another camera synchronization', async () => {
  const { database, store } = makeMemoryDatabase([
    connectedCamera(7, 'cam-01', '1'),
    connectedCamera(8, 'cam-02', '2'),
  ]);
  const client = {
    getLatest: async () => ({
      cameras: [
        measuredState({ cameraId: 'cam-01', areaId: '1', observationId: 1001 }),
        measuredState({ cameraId: 'cam-02', areaId: '2', observationId: 2002 }),
      ],
    }),
    getHistory: async ({ cameraId }) => {
      if (cameraId === 'cam-01') {
        const error = new Error('network failure');
        error.code = 'NETWORK_ERROR';
        throw error;
      }
      return historyPage([historyEvent(2002, 3, 'cam-02', '2')]);
    },
  };
  const service = new DahuaSyncService({
    database,
    clientFactory: () => client,
    alertChecker: async () => {},
    logger: silentLogger(),
    now: () => Date.parse('2026-11-02T00:31:00Z'),
  });

  const result = await service.runOnce();

  assert.equal(result.hasErrors, true);
  assert.deepEqual([...store.logs.keys()], [2002]);
  assert.equal(store.states.get(7).sync_health, 'error');
  assert.equal(store.states.get(8).sync_health, 'healthy');
});

test('migration is additive and provides unique measurements and durable checkpoints', () => {
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '20261101_add_dahua_external_integration.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(migration, /ALTER TABLE cameras/i);
  assert.match(migration, /uq_occupancy_external_observation/i);
  assert.match(migration, /CREATE TABLE camera_external_state/i);
  assert.match(migration, /CREATE TABLE dahua_sync_checkpoints/i);
  assert.match(migration, /DATETIME\(6\)/i);
});
