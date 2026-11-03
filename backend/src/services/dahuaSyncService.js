const { createHash } = require('node:crypto');
const db = require('../config/db');
const { checkAndCreateAlerts } = require('./alertService');
const { createDahuaApiClient } = require('./dahuaApiClient');

const HISTORY_PAGE_SIZE = 500;
const MAX_HISTORY_PAGES_PER_CAMERA_PER_POLL = 4;
const POLL_INTERVAL_MS = 5000;
const MAX_RETRY_DELAY_MS = 60000;

class DahuaSyncError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DahuaSyncError';
    this.code = code;
  }
}

function validId(value, maxBytes) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= maxBytes;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function utcSqlDate(value, fieldName) {
  if (typeof value !== 'string') {
    throw new DahuaSyncError('INVALID_RESPONSE', `${fieldName} must be a UTC timestamp.`);
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/);
  if (!match || !Number.isFinite(Date.parse(`${match[1]}T${match[2]}.${match[3] || '000'}Z`))) {
    throw new DahuaSyncError('INVALID_RESPONSE', `${fieldName} must be a UTC timestamp.`);
  }
  return `${match[1]} ${match[2]}.${(match[3] || '').padEnd(6, '0')}`;
}

function parseLatestCamera(item) {
  if (!item || !validId(item.camera_id, 64) || !validId(item.area_id, 128)
      || !['measured', 'stale', 'inferred_zero', 'unknown'].includes(item.status)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response contains an invalid camera state.');
  }
  if (item.occupancy_count !== null
      && (!Number.isSafeInteger(item.occupancy_count) || item.occupancy_count < 0)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response contains an invalid occupancy count.');
  }
  if (item.observation_id !== null && !positiveInteger(item.observation_id)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response contains an invalid observation ID.');
  }
  if (item.status === 'unknown') {
    if (item.occupancy_count !== null || item.observation_id !== null) {
      throw new DahuaSyncError('INVALID_RESPONSE', 'Unknown Dahua state must not contain a measurement.');
    }
  } else if (item.occupancy_count === null || item.observation_id === null) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Measured and stale Dahua states require their last observation.');
  }
  if (item.status === 'inferred_zero' && item.occupancy_count !== 0) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'An inferred-zero Dahua state must report zero.');
  }

  const observedAt = item.observed_at_utc === null
    ? null
    : utcSqlDate(item.observed_at_utc, 'observed_at_utc');
  const receivedAt = item.received_at_utc === null
    ? null
    : utcSqlDate(item.received_at_utc, 'received_at_utc');
  const evaluatedAt = utcSqlDate(item.status_evaluated_at_utc, 'status_evaluated_at_utc');
  if (item.status !== 'unknown' && (!observedAt || !receivedAt)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'A Dahua measurement requires observation timestamps.');
  }
  if (item.reporting_status !== null && typeof item.reporting_status !== 'string') {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua reporting_status must be a string or null.');
  }

  return {
    cameraId: item.camera_id,
    areaId: item.area_id,
    occupancyCount: item.occupancy_count,
    status: item.status,
    observationId: item.observation_id,
    observedAt,
    receivedAt,
    evaluatedAt,
    reportingStatus: item.reporting_status,
  };
}

function validateLatestResponse(response) {
  if (!response || !Array.isArray(response.cameras)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response must contain a cameras array.');
  }
  const states = new Map();
  for (const rawState of response.cameras) {
    const state = parseLatestCamera(rawState);
    const key = `${state.cameraId}\u0000${state.areaId}`;
    if (states.has(key)) {
      throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response contains a duplicate camera mapping.');
    }
    states.set(key, state);
  }
  return states;
}

function decodeLatestResponse(response) {
  if (!response || !Array.isArray(response.cameras)) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua latest response must contain a cameras array.');
  }
  const states = new Map();
  const errors = new Map();
  for (const rawState of response.cameras) {
    const key = rawState && validId(rawState.camera_id, 64) && validId(rawState.area_id, 128)
      ? `${rawState.camera_id}\u0000${rawState.area_id}`
      : null;
    try {
      const state = parseLatestCamera(rawState);
      if (states.has(key)) {
        states.delete(key);
        errors.set(key, 'DUPLICATE_MAPPING');
      } else if (!errors.has(key)) {
        states.set(key, state);
      }
    } catch (error) {
      if (key) errors.set(key, safeErrorCode(error));
    }
  }
  return { states, errors };
}

function validateHistoryPage(response, requestedBeforeId) {
  if (!response || !Array.isArray(response.events)
      || response.events.length > HISTORY_PAGE_SIZE) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua history response must contain a valid events array.');
  }

  let previousId = Infinity;
  const events = response.events.map((event) => {
    if (!event || !validId(event.camera_id, 64) || !validId(event.area_id, 128)
        || event.status !== 'measured'
        || !positiveInteger(event.observation_id)
        || !Number.isSafeInteger(event.occupancy_count)
        || event.occupancy_count < 0
        || event.observation_id >= previousId) {
      throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua history contains an invalid or unordered measurement.');
    }
    if (requestedBeforeId !== null && event.observation_id >= requestedBeforeId) {
      throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua history pagination did not move to older observations.');
    }
    previousId = event.observation_id;
    return {
      cameraId: event.camera_id,
      areaId: event.area_id,
      occupancyCount: event.occupancy_count,
      observationId: event.observation_id,
      observedAt: utcSqlDate(event.observed_at_utc, 'observed_at_utc'),
    };
  });

  const nextBeforeId = response.next_before_observation_id;
  if (events.length === HISTORY_PAGE_SIZE) {
    if (!positiveInteger(nextBeforeId) || nextBeforeId !== events[events.length - 1].observationId) {
      throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua history pagination cursor does not match the final event.');
    }
  } else if (nextBeforeId !== null) {
    throw new DahuaSyncError('INVALID_RESPONSE', 'Dahua history returned a cursor for a partial page.');
  }

  return { events, nextBeforeId };
}

function mappingKey(camera) {
  const identity = [
    String(camera.camera_id),
    camera.external_camera_id,
    camera.external_area_id,
    String(camera.assigned_room_id),
    String(camera.dahua_mapping_revision),
    camera.dahua_mapping_updated_at || '',
  ].join('\u0000');
  return createHash('sha256').update(identity, 'utf8').digest('hex');
}

function safeErrorCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : 'SYNC_ERROR';
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'SYNC_ERROR';
}

function maxRetryDelay(failures, baseDelayMs) {
  return Math.min(baseDelayMs * (2 ** Math.min(failures - 1, 10)), MAX_RETRY_DELAY_MS);
}

class DahuaSyncService {
  constructor({
    database = db,
    clientFactory = createDahuaApiClient,
    alertChecker = checkAndCreateAlerts,
    logger = console,
    pollIntervalMs = POLL_INTERVAL_MS,
    maxHistoryPagesPerCamera = MAX_HISTORY_PAGES_PER_CAMERA_PER_POLL,
    now = () => Date.now(),
  } = {}) {
    this.database = database;
    this.clientFactory = clientFactory;
    this.alertChecker = alertChecker;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs;
    this.maxHistoryPagesPerCamera = maxHistoryPagesPerCamera;
    this.now = now;
    this.running = null;
    this.timer = null;
    this.stopped = true;
    this.latestFailureCount = 0;
    this.nextLatestAttemptAt = 0;
    this.latestErrorCode = null;
    this.clientFailureCount = 0;
    this.nextClientAttemptAt = 0;
    this.clientErrorCode = null;
    this.historyBackoffs = new Map();
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) await this.running;
  }

  schedule(delayMs) {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.runOnce();
      } catch (error) {
        this.logError('synchronization cycle failed', error);
      } finally {
        this.schedule(this.pollIntervalMs);
      }
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  runOnce() {
    if (this.running) return this.running;
    this.running = this.synchronize().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async synchronize() {
    const [cameraRows] = await this.database.query(
      `SELECT camera_id, external_camera_id, external_area_id, assigned_room_id,
              dahua_mapping_revision,
              DATE_FORMAT(dahua_mapping_updated_at, '%Y-%m-%d %H:%i:%s.%f') AS dahua_mapping_updated_at
       FROM cameras
       WHERE source_type = 'dahua_external'
         AND desired_connection_state = 'connected'
       ORDER BY camera_id`
    );
    const cameras = cameraRows.map((camera) => ({
      ...camera,
      camera_id: Number(camera.camera_id),
      dahua_mapping_revision: Number(camera.dahua_mapping_revision || 0),
    }));

    await this.database.query(
      `UPDATE camera_external_state ces
       JOIN cameras c ON c.camera_id = ces.camera_id
       SET ces.sync_health = 'disabled', ces.last_error_code = NULL
       WHERE c.source_type = 'dahua_external'
         AND c.desired_connection_state = 'disconnected'`
    );
    if (cameras.length === 0) return { cameraCount: 0 };

    let client;
    if (this.now() < this.nextClientAttemptAt) {
      await Promise.all(cameras.map(async (camera) => {
        try {
          await this.recordSyncHealth(camera, 'error', this.clientErrorCode || 'CLIENT_RETRY_BACKOFF', false);
        } catch (error) {
          if (error.code !== 'CAMERA_NOT_ACTIVE') this.logError('sync health update failed', error, camera.camera_id);
        }
      }));
      return { cameraCount: cameras.length, hasErrors: true };
    }
    try {
      client = this.clientFactory();
      this.clientFailureCount = 0;
      this.nextClientAttemptAt = 0;
      this.clientErrorCode = null;
    } catch (error) {
      const code = safeErrorCode(error);
      this.clientFailureCount += 1;
      this.nextClientAttemptAt = this.now() + maxRetryDelay(this.clientFailureCount, this.pollIntervalMs);
      this.clientErrorCode = code;
      await Promise.all(cameras.map(async (camera) => {
        try {
          await this.recordSyncHealth(camera, 'error', code, false);
        } catch (healthError) {
          if (healthError.code !== 'CAMERA_NOT_ACTIVE') {
            this.logError('sync health update failed', healthError, camera.camera_id);
          }
        }
      }));
      this.logError('client configuration failed', error);
      return { cameraCount: cameras.length, hasErrors: true };
    }

    const latestByMapping = new Map();
    const latestErrorsByMapping = new Map();
    let latestSucceeded = false;
    let latestErrorCode = null;
    if (this.now() >= this.nextLatestAttemptAt) {
      try {
        latestByMapping.clear();
        const latest = await client.getLatest();
        const decoded = decodeLatestResponse(latest);
        for (const [key, state] of decoded.states) latestByMapping.set(key, state);
        for (const [key, code] of decoded.errors) latestErrorsByMapping.set(key, code);
        latestSucceeded = true;
        this.latestFailureCount = 0;
        this.nextLatestAttemptAt = 0;
        this.latestErrorCode = null;
      } catch (error) {
        latestErrorCode = safeErrorCode(error);
        this.latestFailureCount += 1;
        this.nextLatestAttemptAt = this.now() + maxRetryDelay(this.latestFailureCount, this.pollIntervalMs);
        this.latestErrorCode = latestErrorCode;
        this.logError('latest-state request failed', error);
      }
    } else {
      latestErrorCode = this.latestErrorCode || 'LATEST_RETRY_BACKOFF';
    }

    const latestOutcomes = await Promise.all(cameras.map(async (camera) => {
      if (!latestSucceeded) return [camera.camera_id, latestErrorCode];
      const mapping = `${camera.external_camera_id}\u0000${camera.external_area_id}`;
      if (latestErrorsByMapping.has(mapping)) {
        return [camera.camera_id, latestErrorsByMapping.get(mapping)];
      }
      const state = latestByMapping.get(mapping);
      if (!state) return [camera.camera_id, 'CAMERA_NOT_REPORTED'];
      try {
        await this.applyCurrentState(camera, state);
        return [camera.camera_id, null];
      } catch (error) {
        this.logError('current-state update failed', error, camera.camera_id);
        return [camera.camera_id, safeErrorCode(error)];
      }
    }));
    const errorsByCamera = new Map(latestOutcomes);

    const historyOutcomes = await Promise.all(cameras.map(async (camera) => {
      const key = mappingKey(camera);
      const backoff = this.historyBackoffs.get(key);
      if (backoff && this.now() < backoff.nextAttemptAt) {
        return [camera.camera_id, backoff.errorCode, false];
      }
      try {
        await this.syncHistory(camera, client);
        this.historyBackoffs.delete(key);
        return [camera.camera_id, null, true];
      } catch (error) {
        if (error.code === 'CAMERA_NOT_ACTIVE') {
          return [camera.camera_id, null, false];
        }
        const failures = (backoff ? backoff.failures : 0) + 1;
        const errorCode = safeErrorCode(error);
        this.historyBackoffs.set(key, {
          failures,
          errorCode,
          nextAttemptAt: this.now() + maxRetryDelay(failures, this.pollIntervalMs),
        });
        this.logError('history synchronization failed', error, camera.camera_id);
        return [camera.camera_id, errorCode, false];
      }
    }));

    await Promise.all(cameras.map(async (camera) => {
      const latestError = errorsByCamera.get(camera.camera_id);
      const historyOutcome = historyOutcomes.find(([id]) => id === camera.camera_id);
      const historyError = historyOutcome && historyOutcome[1];
      const errorCode = latestError || historyError;
      const hasSuccessfulRequest = (latestSucceeded && !latestError)
        || Boolean(historyOutcome && historyOutcome[2]);
      try {
        await this.recordSyncHealth(
          camera,
          errorCode ? 'error' : 'healthy',
          errorCode || null,
          hasSuccessfulRequest
        );
      } catch (error) {
        if (error.code !== 'CAMERA_NOT_ACTIVE') {
          this.logError('sync health update failed', error, camera.camera_id);
        }
      }
    }));

    return {
      cameraCount: cameras.length,
      hasErrors: errorsByCamera.size > 0
        && [...errorsByCamera.values()].some(Boolean)
        || historyOutcomes.some(([, errorCode]) => Boolean(errorCode)),
    };
  }

  async withTransaction(operation) {
    const connection = await this.database.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        this.logError('transaction rollback failed', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async lockActiveCamera(connection, camera) {
    const [rows] = await connection.query(
      `SELECT source_type, external_camera_id, external_area_id, assigned_room_id,
              desired_connection_state, dahua_mapping_revision,
              DATE_FORMAT(dahua_mapping_updated_at, '%Y-%m-%d %H:%i:%s.%f') AS dahua_mapping_updated_at
       FROM cameras
       WHERE camera_id = ?
       FOR UPDATE`,
      [camera.camera_id]
    );
    const current = rows[0];
    if (!current
        || current.source_type !== 'dahua_external'
        || current.desired_connection_state !== 'connected'
        || current.external_camera_id !== camera.external_camera_id
        || current.external_area_id !== camera.external_area_id
        || Number(current.assigned_room_id) !== Number(camera.assigned_room_id)
        || Number(current.dahua_mapping_revision) !== Number(camera.dahua_mapping_revision)
        || current.dahua_mapping_updated_at !== camera.dahua_mapping_updated_at) {
      throw new DahuaSyncError('CAMERA_NOT_ACTIVE', 'Camera mapping is no longer active.');
    }
    if (!current.assigned_room_id) {
      throw new DahuaSyncError('CAMERA_ROOM_REQUIRED', 'Camera must be assigned to a room.');
    }
    return current;
  }

  async applyCurrentState(camera, state) {
    await this.withTransaction(async (connection) => {
      await this.lockActiveCamera(connection, camera);
      const [rows] = await connection.query(
        `SELECT observation_id,
                occupancy_status,
                DATE_FORMAT(observed_at_utc, '%Y-%m-%d %H:%i:%s.%f') AS observed_at_utc,
                DATE_FORMAT(status_evaluated_at_utc, '%Y-%m-%d %H:%i:%s.%f') AS status_evaluated_at_utc,
                external_camera_id,
                external_area_id
         FROM camera_external_state
         WHERE camera_id = ?
         FOR UPDATE`,
        [camera.camera_id]
      );
      const current = rows[0];
      if (current && !this.sameMapping(current, camera)) {
        await connection.query('DELETE FROM camera_external_state WHERE camera_id = ?', [camera.camera_id]);
      }
      const sameMapping = current && this.sameMapping(current, camera);
      if (sameMapping && !this.shouldApplyState(current, state)) return;

      if (sameMapping) {
        await connection.query(
          `UPDATE camera_external_state
           SET occupancy_count = ?,
               occupancy_status = ?,
               observation_id = ?,
               observed_at_utc = ?,
               received_at_utc = ?,
               status_evaluated_at_utc = ?,
               reporting_status = ?
           WHERE camera_id = ?`,
          [
            state.occupancyCount,
            state.status,
            state.observationId,
            state.observedAt,
            state.receivedAt,
            state.evaluatedAt,
            state.reportingStatus,
            camera.camera_id,
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO camera_external_state
             (camera_id, external_camera_id, external_area_id, occupancy_count,
              occupancy_status, observation_id, observed_at_utc, received_at_utc,
              status_evaluated_at_utc, reporting_status, sync_health)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            camera.camera_id,
            camera.external_camera_id,
            camera.external_area_id,
            state.occupancyCount,
            state.status,
            state.observationId,
            state.observedAt,
            state.receivedAt,
            state.evaluatedAt,
            state.reportingStatus,
          ]
        );
      }
    });
  }

  sameMapping(row, camera) {
    return row.external_camera_id === camera.external_camera_id
      && row.external_area_id === camera.external_area_id;
  }

  shouldApplyState(current, incoming) {
    if (current.status_evaluated_at_utc
        && incoming.evaluatedAt < current.status_evaluated_at_utc) return false;
    if (incoming.observationId === null) return current.observation_id === null;
    if (current.observation_id === null) return true;
    if (current.observed_at_utc && incoming.observedAt < current.observed_at_utc) return false;
    if (current.observed_at_utc === incoming.observedAt
        && incoming.observationId < Number(current.observation_id)) return false;
    return true;
  }

  async syncHistory(camera, client) {
    const key = mappingKey(camera);
    await this.database.query(
      `INSERT IGNORE INTO dahua_sync_checkpoints
         (checkpoint_key, camera_id, external_camera_id, external_area_id)
       VALUES (?, ?, ?, ?)`,
      [key, camera.camera_id, camera.external_camera_id, camera.external_area_id]
    );

    for (let pageNumber = 0; pageNumber < this.maxHistoryPagesPerCamera; pageNumber += 1) {
      const [checkpointRows] = await this.database.query(
        `SELECT completed_observation_id, scan_target_observation_id, scan_before_observation_id
         FROM dahua_sync_checkpoints
         WHERE checkpoint_key = ?`,
        [key]
      );
      if (checkpointRows.length === 0) {
        throw new DahuaSyncError('CHECKPOINT_MISSING', 'Dahua synchronization checkpoint was not created.');
      }
      const checkpoint = checkpointRows[0];
      const isResumingScan = checkpoint.scan_target_observation_id != null;
      const beforeId = isResumingScan ? Number(checkpoint.scan_before_observation_id) : null;
      if (isResumingScan && !positiveInteger(beforeId)) {
        throw new DahuaSyncError('CHECKPOINT_INVALID', 'Dahua history checkpoint has an invalid page cursor.');
      }
      const rawPage = await client.getHistory({
        cameraId: camera.external_camera_id,
        areaId: camera.external_area_id,
        limit: HISTORY_PAGE_SIZE,
        beforeObservationId: beforeId,
      });
      const page = validateHistoryPage(rawPage, beforeId);
      if (page.events.length === 0) {
        if (isResumingScan) {
          await this.finishEmptyScan(camera, key);
        }
        return;
      }

      for (const event of page.events) {
        if (event.cameraId !== camera.external_camera_id || event.areaId !== camera.external_area_id) {
          throw new DahuaSyncError('MAPPING_MISMATCH', 'Dahua history returned an event outside the requested camera mapping.');
        }
      }

      const completedId = checkpoint.completed_observation_id == null
        ? null
        : Number(checkpoint.completed_observation_id);
      const targetId = isResumingScan
        ? Number(checkpoint.scan_target_observation_id)
        : page.events[0].observationId;
      const pageMinId = page.events[page.events.length - 1].observationId;
      const stillNeedsOlderPage = page.nextBeforeId !== null
        && (completedId === null || pageMinId > completedId);

      const nextCheckpoint = stillNeedsOlderPage
        ? {
          completedId,
          targetId,
          beforeId: page.nextBeforeId,
        }
        : {
          completedId: completedId === null ? targetId : Math.max(completedId, targetId),
          targetId: null,
          beforeId: null,
        };

      const insertedCurrentEvents = await this.withTransaction(async (connection) => {
        const cameraRow = await this.lockActiveCamera(connection, camera);
        const [stateRows] = await connection.query(
          `SELECT observation_id, occupancy_status
           FROM camera_external_state
           WHERE camera_id = ?
           FOR UPDATE`,
          [camera.camera_id]
        );
        const currentState = stateRows[0] || null;
        const alerts = [];

        for (const event of page.events) {
          if (completedId !== null && event.observationId <= completedId) continue;
          if (camera.dahua_mapping_revision > 1
              && camera.dahua_mapping_updated_at
              && event.observedAt < camera.dahua_mapping_updated_at) {
            continue;
          }
          const [existingRows] = await connection.query(
            `SELECT external_camera_id, external_area_id
             FROM occupancy_logs
             WHERE source_type = 'dahua_external'
               AND external_observation_id = ?
             FOR UPDATE`,
            [event.observationId]
          );
          if (existingRows.length > 0) {
            const existing = existingRows[0];
            if (existing.external_camera_id !== event.cameraId || existing.external_area_id !== event.areaId) {
              throw new DahuaSyncError('OBSERVATION_MAPPING_CONFLICT', 'Observation ID is already associated with a different Dahua mapping.');
            }
            continue;
          }

          await connection.query(
            `INSERT INTO occupancy_logs
               (room_id, camera_id, occupancy_count, recorded_at, source_type,
                external_observation_id, external_camera_id, external_area_id)
             VALUES (?, ?, ?, ?, 'dahua_external', ?, ?, ?)`,
            [
              cameraRow.assigned_room_id,
              camera.camera_id,
              event.occupancyCount,
              event.observedAt,
              event.observationId,
              event.cameraId,
              event.areaId,
            ]
          );
          if (currentState
              && currentState.occupancy_status === 'measured'
              && Number(currentState.observation_id) === event.observationId) {
            alerts.push([cameraRow.assigned_room_id, event.occupancyCount]);
          }
        }

        await connection.query(
          `UPDATE dahua_sync_checkpoints
           SET completed_observation_id = ?,
               scan_target_observation_id = ?,
               scan_before_observation_id = ?
           WHERE checkpoint_key = ?
             AND camera_id = ?
             AND external_camera_id = ?
             AND external_area_id = ?`,
          [
            nextCheckpoint.completedId,
            nextCheckpoint.targetId,
            nextCheckpoint.beforeId,
            key,
            camera.camera_id,
            camera.external_camera_id,
            camera.external_area_id,
          ]
        );
        return alerts;
      });

      for (const [roomId, occupancyCount] of insertedCurrentEvents) {
        await this.alertChecker(roomId, occupancyCount);
      }

      if (!stillNeedsOlderPage) return;
    }
  }

  async finishEmptyScan(camera, key) {
    await this.withTransaction(async (connection) => {
      await this.lockActiveCamera(connection, camera);
      await connection.query(
        `UPDATE dahua_sync_checkpoints
         SET completed_observation_id = GREATEST(
               COALESCE(completed_observation_id, 0),
               COALESCE(scan_target_observation_id, 0)
             ),
             scan_target_observation_id = NULL,
             scan_before_observation_id = NULL
         WHERE checkpoint_key = ?
           AND camera_id = ?
           AND external_camera_id = ?
           AND external_area_id = ?`,
        [key, camera.camera_id, camera.external_camera_id, camera.external_area_id]
      );
    });
  }

  async recordSyncHealth(camera, health, errorCode, successfulRequest) {
    await this.withTransaction(async (connection) => {
      await this.lockActiveCamera(connection, camera);
      const [rows] = await connection.query(
        `SELECT external_camera_id, external_area_id
         FROM camera_external_state
         WHERE camera_id = ?
         FOR UPDATE`,
        [camera.camera_id]
      );
      const current = rows[0];
      if (current && !this.sameMapping(current, camera)) {
        await connection.query('DELETE FROM camera_external_state WHERE camera_id = ?', [camera.camera_id]);
      }
      const sameMapping = current && this.sameMapping(current, camera);
      if (sameMapping) {
        await connection.query(
          `UPDATE camera_external_state
           SET sync_health = ?,
               last_error_code = ?,
               last_successful_sync_at = CASE WHEN ? THEN UTC_TIMESTAMP(6) ELSE last_successful_sync_at END
           WHERE camera_id = ?`,
          [health, errorCode, successfulRequest, camera.camera_id]
        );
      } else {
        await connection.query(
          `INSERT INTO camera_external_state
             (camera_id, external_camera_id, external_area_id, occupancy_status,
              sync_health, last_error_code, last_successful_sync_at)
           VALUES (?, ?, ?, 'unknown', ?, ?, CASE WHEN ? THEN UTC_TIMESTAMP(6) ELSE NULL END)`,
          [
            camera.camera_id,
            camera.external_camera_id,
            camera.external_area_id,
            health,
            errorCode,
            successfulRequest,
          ]
        );
      }
    });
  }

  logError(operation, error, cameraId = null) {
    const code = safeErrorCode(error);
    const cameraLabel = cameraId === null ? '' : ` camera_id=${cameraId}`;
    this.logger.error(`[dahua-sync] ${operation}${cameraLabel} code=${code}`);
  }
}

const dahuaSyncService = new DahuaSyncService();

module.exports = {
  DahuaSyncService,
  DahuaSyncError,
  dahuaSyncService,
  validateLatestResponse,
  decodeLatestResponse,
  validateHistoryPage,
  utcSqlDate,
};
