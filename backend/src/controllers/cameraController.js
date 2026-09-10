const db = require('../config/db');
const {
  createCameraOfflineAlert,
  resolveCameraOfflineAlert,
} = require('../services/alertService');


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

    res.json(cameras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getCameraById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `${CAMERA_SELECT} WHERE camera_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Camera not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.createCamera = async (req, res) => {
  try {
    const { camera_name, rtsp_url, assigned_room_id } = req.body;
    if (!camera_name) return res.status(400).json({ message: 'camera_name is required' });

    const [result] = await db.query(
      `INSERT INTO cameras (camera_name, rtsp_url, assigned_room_id)
       VALUES (?, ?, ?)`,
      [camera_name, rtsp_url || null, assigned_room_id || null]
    );
    res.status(201).json({ camera_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.updateCamera = async (req, res) => {
  try {
    const { camera_name, rtsp_url, assigned_room_id } = req.body;
    if (!camera_name) return res.status(400).json({ message: 'camera_name is required' });

    const [result] = await db.query(
      `UPDATE cameras
       SET camera_name = ?, rtsp_url = ?, assigned_room_id = ?
       WHERE camera_id = ?`,
      [camera_name, rtsp_url || null, assigned_room_id || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Camera not found' });
    res.json({ message: 'updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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