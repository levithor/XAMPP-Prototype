const db = require('../config/db');
const {
  createCameraOfflineAlert,
  resolveCameraOfflineAlert,
} = require('../services/alertService');

function validRtspUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'rtsp:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validExternalIdentifier(value, maxBytes) {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && Buffer.byteLength(value, 'utf8') <= maxBytes;
}

function validSourceType(value) {
  return value === 'rtsp_yolo' || value === 'dahua_external';
}

function containsRedactionMarker(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (/^REDACTED$/i.test(url.username) || /^REDACTED$/i.test(url.password)) {
      return true;
    }
    for (const [key, parameter] of url.searchParams) {
      if (/(user|pass|pwd|token|auth|secret|credential|(?:api|access)[_-]?key)/i.test(key)
          && /^REDACTED$/i.test(parameter)) {
        return true;
      }
    }
    return false;
  } catch {
    return /(?:\/\/REDACTED(?::REDACTED)?@|[?&][^=&#]*(?:user|pass|pwd|token|auth|secret)[^=&#]*=REDACTED(?:&|$))/i.test(value);
  }
}

function redactRtspUrl(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = 'REDACTED';
      url.password = 'REDACTED';
    }
    for (const key of url.searchParams.keys()) {
      if (/(user|pass|pwd|token|auth|secret|credential|(?:api|access)[_-]?key)/i.test(key)) {
        url.searchParams.set(key, 'REDACTED');
      }
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value
      .replace(/(rtsp:\/\/)[^/@]*@/i, '$1REDACTED@')
      .replace(/([?&][^=&#]*(?:user|pass|pwd|token|auth|secret|credential|(?:api|access)[_-]?key)[^=&#]*=)[^&#]*/ig, '$1REDACTED')
      .replace(/#.*$/, '');
  }
}

function publicCamera(camera) {
  return { ...camera, rtsp_url: redactRtspUrl(camera.rtsp_url) };
}

function logDatabaseError(operation, err) {
  console.error(`[cameraController] ${operation} failed:`, err.code || 'unknown database error');
}

const COMPUTED_STATUS = `
  CASE
    WHEN c.last_communication IS NULL
      THEN 'offline'
    WHEN c.last_communication < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      THEN 'offline'
    ELSE 'online'
  END
`;


// ── CAMERA SELECT FIELDS — add new columns HERE ──
const CAMERA_SELECT = `
  SELECT
    c.camera_id,
    c.camera_name,
    c.rtsp_url,
    c.source_type,
    c.external_camera_id,
    c.external_area_id,
    c.assigned_room_id,
    c.last_communication,
    c.desired_connection_state,
    c.created_at,
    (${COMPUTED_STATUS}) AS status,
    ces.occupancy_count AS external_occupancy_count,
    ces.occupancy_status AS external_occupancy_status,
    ces.observation_id AS external_observation_id,
    DATE_FORMAT(ces.observed_at_utc, '%Y-%m-%dT%H:%i:%s.%fZ') AS external_observed_at_utc,
    DATE_FORMAT(ces.received_at_utc, '%Y-%m-%dT%H:%i:%s.%fZ') AS external_received_at_utc,
    DATE_FORMAT(ces.status_evaluated_at_utc, '%Y-%m-%dT%H:%i:%s.%fZ') AS external_status_evaluated_at_utc,
    ces.reporting_status AS external_reporting_status,
    ces.sync_health AS synchronization_health,
    DATE_FORMAT(ces.last_successful_sync_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS last_successful_sync_at,
    ces.last_error_code AS synchronization_error_code
  FROM cameras c
  LEFT JOIN camera_external_state ces ON ces.camera_id = c.camera_id
`;

// GET /api/cameras
exports.getCameras = async (req, res) => {
  try {
    const [cameras] = await db.query(`${CAMERA_SELECT} ORDER BY c.created_at DESC`);

    for (const cam of cameras) {
      if (cam.source_type === 'dahua_external') continue;
      if (cam.status === 'offline') {
        await createCameraOfflineAlert(cam.camera_id, cam.camera_name, cam.assigned_room_id);
      } else {
        await resolveCameraOfflineAlert(cam.assigned_room_id);
      }
    }

    res.json(cameras.map(publicCamera));
  } catch (err) {
    logDatabaseError('camera listing', err);
    res.status(500).json({ error: 'Could not load cameras.' });
  }
};


exports.getCameraById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `${CAMERA_SELECT} WHERE c.camera_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Camera not found' });
    res.json(publicCamera(rows[0]));
  } catch (err) {
    logDatabaseError('camera lookup', err);
    res.status(500).json({ error: 'Could not load camera.' });
  }
};


exports.createCamera = async (req, res) => {
  try {
    const {
      camera_name,
      rtsp_url,
      assigned_room_id,
      external_camera_id,
      external_area_id,
    } = req.body;
    const sourceType = req.body.source_type ?? 'rtsp_yolo';
    if (typeof camera_name !== 'string' || !camera_name.trim()) {
      return res.status(400).json({ message: 'Camera name is required.' });
    }
    if (!validSourceType(sourceType)) {
      return res.status(400).json({ message: 'Camera source_type must be rtsp_yolo or dahua_external.' });
    }

    let storedRtspUrl = rtsp_url || null;
    let storedExternalCameraId = null;
    let storedExternalAreaId = null;
    if (sourceType === 'dahua_external') {
      if (assigned_room_id == null || assigned_room_id === '') {
        return res.status(400).json({ message: 'Assign this camera to a room before enabling occupancy synchronization.' });
      }
      if (!validExternalIdentifier(external_camera_id, 64)) {
        return res.status(400).json({ message: 'Dahua external_camera_id must be a non-empty ID of at most 64 bytes.' });
      }
      if (!validExternalIdentifier(external_area_id, 128)) {
        return res.status(400).json({ message: 'Dahua external_area_id must be a non-empty ID of at most 128 bytes.' });
      }
      if (rtsp_url) {
        return res.status(400).json({ message: 'Dahua External cameras do not use an RTSP URL.' });
      }
      storedRtspUrl = null;
      storedExternalCameraId = external_camera_id;
      storedExternalAreaId = external_area_id;
    } else {
      if (containsRedactionMarker(rtsp_url)) {
        return res.status(400).json({ message: 'Enter the complete RTSP URL; redacted values cannot be saved.' });
      }
      if (rtsp_url && !validRtspUrl(rtsp_url)) {
        return res.status(400).json({ message: 'Camera RTSP URL must be a valid rtsp:// URL.' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO cameras
         (camera_name, rtsp_url, source_type, external_camera_id, external_area_id,
          dahua_mapping_revision, dahua_mapping_updated_at, assigned_room_id)
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'dahua_external' THEN UTC_TIMESTAMP(6) ELSE NULL END, ?)`,
      [
        camera_name.trim(),
        storedRtspUrl,
        sourceType,
        storedExternalCameraId,
        storedExternalAreaId,
        sourceType === 'dahua_external' ? 1 : 0,
        sourceType,
        assigned_room_id || null,
      ]
    );
    res.status(201).json({ camera_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This Dahua camera and area are already assigned to another OccuVision camera.' });
    }
    logDatabaseError('camera creation', err);
    res.status(500).json({ error: 'Could not create camera.' });
  }
};


exports.updateCamera = async (req, res) => {
  try {
    const { camera_name } = req.body;
    if (typeof camera_name !== 'string' || !camera_name.trim()) {
      return res.status(400).json({ message: 'Camera name is required.' });
    }

    const [existingRows] = await db.query(
      `SELECT source_type, rtsp_url, external_camera_id, external_area_id,
              assigned_room_id, dahua_mapping_revision
       FROM cameras
       WHERE camera_id = ?`,
      [req.params.id]
    );
    if (existingRows.length === 0) return res.status(404).json({ message: 'Camera not found' });
    const existing = existingRows[0];
    const sourceType = req.body.source_type ?? existing.source_type ?? 'rtsp_yolo';
    if (!validSourceType(sourceType)) {
      return res.status(400).json({ message: 'Camera source_type must be rtsp_yolo or dahua_external.' });
    }

    const hasRtspUrl = Object.prototype.hasOwnProperty.call(req.body, 'rtsp_url');
    const rtspUrl = req.body.rtsp_url;
    if (sourceType === 'rtsp_yolo' && hasRtspUrl && containsRedactionMarker(rtspUrl)) {
      return res.status(400).json({ message: 'Enter the complete RTSP URL; redacted values cannot be saved.' });
    }
    if (sourceType === 'rtsp_yolo' && hasRtspUrl && rtspUrl != null && rtspUrl !== '' && !validRtspUrl(rtspUrl)) {
      return res.status(400).json({ message: 'Camera RTSP URL must be a valid rtsp:// URL.' });
    }
    if (sourceType === 'dahua_external' && hasRtspUrl && rtspUrl) {
      return res.status(400).json({ message: 'Dahua External cameras do not use an RTSP URL.' });
    }

    const assignedRoomId = Object.prototype.hasOwnProperty.call(req.body, 'assigned_room_id')
      ? (req.body.assigned_room_id || null)
      : existing.assigned_room_id;
    const externalCameraId = req.body.external_camera_id ?? existing.external_camera_id;
    const externalAreaId = req.body.external_area_id ?? existing.external_area_id;
    if (sourceType === 'dahua_external') {
      if (!assignedRoomId) {
        return res.status(400).json({ message: 'Assign this camera to a room before enabling occupancy synchronization.' });
      }
      if (!validExternalIdentifier(externalCameraId, 64)) {
        return res.status(400).json({ message: 'Dahua external_camera_id must be a non-empty ID of at most 64 bytes.' });
      }
      if (!validExternalIdentifier(externalAreaId, 128)) {
        return res.status(400).json({ message: 'Dahua external_area_id must be a non-empty ID of at most 128 bytes.' });
      }
    }

    const sourceChanged = sourceType !== existing.source_type;
    const roomChanged = sourceType === 'dahua_external'
      && Number(assignedRoomId) !== Number(existing.assigned_room_id);
    const mappingChanged = sourceChanged
      || roomChanged
      || (sourceType === 'dahua_external'
        && (externalCameraId !== existing.external_camera_id || externalAreaId !== existing.external_area_id));
    const normalizedRtspUrl = sourceType === 'dahua_external'
      ? null
      : sourceChanged
        ? (hasRtspUrl && rtspUrl ? rtspUrl : null)
        : hasRtspUrl
          ? (rtspUrl || null)
          : existing.rtsp_url;
    const normalizedExternalCameraId = sourceType === 'dahua_external' ? externalCameraId : null;
    const normalizedExternalAreaId = sourceType === 'dahua_external' ? externalAreaId : null;

    const [result] = await db.query(
      `UPDATE cameras
       SET camera_name = ?,
           rtsp_url = ?,
           source_type = ?,
           external_camera_id = ?,
           external_area_id = ?,
           dahua_mapping_revision = CASE WHEN ? THEN
             CASE WHEN ? = 'dahua_external'
               THEN CASE WHEN ? = 'dahua_external' THEN dahua_mapping_revision + 1 ELSE 1 END
               ELSE 0
             END
             ELSE dahua_mapping_revision
           END,
           dahua_mapping_updated_at = CASE WHEN ? THEN UTC_TIMESTAMP(6) ELSE dahua_mapping_updated_at END,
           last_communication = CASE WHEN ? THEN NULL ELSE last_communication END,
           assigned_room_id = ?,
           desired_connection_state = CASE WHEN ? OR ? IS NULL
             THEN 'disconnected' ELSE desired_connection_state END
       WHERE camera_id = ?`,
      [
        camera_name.trim(),
        normalizedRtspUrl,
        sourceType,
        normalizedExternalCameraId,
        normalizedExternalAreaId,
        mappingChanged,
        sourceType,
        existing.source_type,
        mappingChanged,
        hasRtspUrl || mappingChanged,
        assignedRoomId,
        mappingChanged,
        assignedRoomId,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) {
      const [cameras] = await db.query(
        'SELECT camera_id FROM cameras WHERE camera_id = ?',
        [req.params.id]
      );
      if (cameras.length === 0) return res.status(404).json({ message: 'Camera not found' });
    }
    if (mappingChanged) {
      await db.query('DELETE FROM camera_external_state WHERE camera_id = ?', [req.params.id]);
    }
    res.json({ message: 'updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This Dahua camera and area are already assigned to another OccuVision camera.' });
    }
    logDatabaseError('camera update', err);
    res.status(500).json({ error: 'Could not update camera.' });
  }
};

exports.setConnectionState = async (req, res) => {
  const cameraId = Number(req.params.id);
  const desiredState = req.body && req.body.desired_connection_state;
  if (!Number.isInteger(cameraId) || cameraId < 1) {
    return res.status(400).json({ error: 'Camera ID must be a positive integer.' });
  }
  if (!['connected', 'disconnected'].includes(desiredState)) {
    return res.status(400).json({ error: 'Connection state must be connected or disconnected.' });
  }

  try {
    if (desiredState === 'connected') {
      const [cameras] = await db.query(
      `SELECT rtsp_url, source_type, external_camera_id, external_area_id, assigned_room_id
       FROM cameras
       WHERE camera_id = ?`,
      [cameraId]
    );
    if (cameras.length === 0) {
      return res.status(404).json({ error: 'Camera not found.' });
    }
      if (!cameras[0].assigned_room_id) {
        return res.status(400).json({
          error: 'Assign this camera to a room before connecting; cameras without a room cannot submit occupancy.',
        });
      }
      if (cameras[0].source_type === 'dahua_external') {
        if (!validExternalIdentifier(cameras[0].external_camera_id, 64)
            || !validExternalIdentifier(cameras[0].external_area_id, 128)) {
          return res.status(400).json({ error: 'Configure valid Dahua camera and area IDs before connecting.' });
        }
      } else if (!validRtspUrl(cameras[0].rtsp_url)) {
        return res.status(400).json({ error: 'Configure a valid rtsp:// URL before connecting.' });
      }
    }

    const [result] = await db.query(
      'UPDATE cameras SET desired_connection_state = ? WHERE camera_id = ?',
      [desiredState, cameraId]
    );
    if (result.affectedRows === 0) {
      const [cameras] = await db.query(
        'SELECT camera_id FROM cameras WHERE camera_id = ?',
        [cameraId]
      );
      if (cameras.length === 0) {
        return res.status(404).json({ error: 'Camera not found.' });
      }
    }
    await db.query(
      `UPDATE camera_external_state
       SET sync_health = ?, last_error_code = NULL
       WHERE camera_id = ?`,
      [desiredState === 'connected' ? 'pending' : 'disabled', cameraId]
    );
    res.json({ camera_id: cameraId, desired_connection_state: desiredState });
  } catch (err) {
    logDatabaseError('camera connection update', err);
    res.status(500).json({ error: 'Could not update camera connection state.' });
  }
};


exports.deleteCamera = async (req, res) => {
  try {
    await db.query(
      'UPDATE occupancy_logs SET camera_id = NULL WHERE camera_id = ?',
      [req.params.id]
    );
    const [result] = await db.query(
      'DELETE FROM cameras WHERE camera_id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Camera not found' });
    res.json({ message: 'deleted' });
  } catch (err) {
    logDatabaseError('camera deletion', err);
    res.status(500).json({ error: 'Could not delete camera.' });
  }
};


exports.assignRoom = async (req, res) => {
  const { assigned_room_id } = req.body;
  const [result] = await db.query(
    `UPDATE cameras SET assigned_room_id = ? WHERE camera_id = ?`,
    [assigned_room_id, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Camera not found.' });
  res.json({ message: 'Room assigned.' });
};

exports.setCameraConnection = async (req, res) => {
  try {
    const cameraId = req.params.id;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        message: 'enabled must be a boolean'
      });
    }

    const [result] = await db.query(
      `UPDATE cameras
       SET connection_enabled = ?
       WHERE camera_id = ?`,
      [enabled ? 1 : 0, cameraId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Camera not found'
      });
    }

    res.json({
      camera_id: Number(cameraId),
      connection_enabled: enabled
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};