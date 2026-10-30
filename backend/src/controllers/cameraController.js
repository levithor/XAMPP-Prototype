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
    WHEN last_communication IS NULL
      THEN 'offline'
    WHEN last_communication < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      THEN 'offline'
    ELSE 'online'
  END
`;


// ── CAMERA SELECT FIELDS — add new columns HERE ──
const CAMERA_SELECT = `
  SELECT
    camera_id,
    camera_name,
    rtsp_url,
    assigned_room_id,
    last_communication,
    desired_connection_state,
    created_at,
    (${COMPUTED_STATUS}) AS status
  FROM cameras
`;

// GET /api/cameras
exports.getCameras = async (req, res) => {
  try {
    const [cameras] = await db.query(`${CAMERA_SELECT} ORDER BY created_at DESC`);

    for (const cam of cameras) {
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
      `${CAMERA_SELECT} WHERE camera_id = ?`,
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
    const { camera_name, rtsp_url, assigned_room_id } = req.body;
    if (typeof camera_name !== 'string' || !camera_name.trim()) {
      return res.status(400).json({ message: 'Camera name is required.' });
    }
    if (containsRedactionMarker(rtsp_url)) {
      return res.status(400).json({ message: 'Enter the complete RTSP URL; redacted values cannot be saved.' });
    }
    if (rtsp_url && !validRtspUrl(rtsp_url)) {
      return res.status(400).json({ message: 'Camera RTSP URL must be a valid rtsp:// URL.' });
    }

    const [result] = await db.query(
      `INSERT INTO cameras (camera_name, rtsp_url, assigned_room_id)
       VALUES (?, ?, ?)`,
      [camera_name.trim(), rtsp_url || null, assigned_room_id || null]
    );
    res.status(201).json({ camera_id: result.insertId });
  } catch (err) {
    logDatabaseError('camera creation', err);
    res.status(500).json({ error: 'Could not create camera.' });
  }
};


exports.updateCamera = async (req, res) => {
  try {
    const { camera_name, rtsp_url, assigned_room_id } = req.body;
    if (typeof camera_name !== 'string' || !camera_name.trim()) {
      return res.status(400).json({ message: 'Camera name is required.' });
    }
    const hasRtspUrl = Object.prototype.hasOwnProperty.call(req.body, 'rtsp_url');
    if (hasRtspUrl && containsRedactionMarker(rtsp_url)) {
      return res.status(400).json({ message: 'Enter the complete RTSP URL; redacted values cannot be saved.' });
    }
    if (hasRtspUrl && rtsp_url != null && rtsp_url !== '' && !validRtspUrl(rtsp_url)) {
      return res.status(400).json({ message: 'Camera RTSP URL must be a valid rtsp:// URL.' });
    }
    const normalizedRtspUrl = !hasRtspUrl || rtsp_url === '' ? null : rtsp_url;

    const [result] = await db.query(
      `UPDATE cameras
       SET camera_name = ?,
           rtsp_url = CASE WHEN ? THEN ? ELSE rtsp_url END,
           last_communication = CASE WHEN ? THEN NULL ELSE last_communication END,
           assigned_room_id = ?,
           desired_connection_state = CASE
             WHEN ? IS NULL THEN 'disconnected'
             ELSE desired_connection_state
           END
       WHERE camera_id = ?`,
      [
        camera_name.trim(),
        hasRtspUrl,
        normalizedRtspUrl,
        hasRtspUrl,
        assigned_room_id || null,
        assigned_room_id || null,
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
    res.json({ message: 'updated' });
  } catch (err) {
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
        'SELECT rtsp_url, assigned_room_id FROM cameras WHERE camera_id = ?',
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
      if (!validRtspUrl(cameras[0].rtsp_url)) {
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