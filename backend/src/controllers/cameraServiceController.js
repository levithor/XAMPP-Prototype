const db = require('../config/db');

exports.getDesiredCameras = async (req, res) => {
  try {
    const [cameras] = await db.query(
      `SELECT camera_id, rtsp_url, assigned_room_id
       FROM cameras
       WHERE desired_connection_state = 'connected'
       ORDER BY camera_id`
    );
    res.json(cameras);
  } catch (err) {
    console.error('[cameraService] Could not load camera configuration:', err.code || 'unknown database error');
    res.status(500).json({ error: 'Could not load camera configuration.' });
  }
};

exports.markDesiredCamerasOffline = async (req, res) => {
  try {
    await db.query(
      `UPDATE cameras
       SET last_communication = NULL
       WHERE desired_connection_state = 'connected'`
    );
    res.json({ message: 'Camera communication state reset.' });
  } catch (err) {
    console.error('[cameraService] Could not reset camera communication state:', err.code || 'unknown database error');
    res.status(500).json({ error: 'Could not initialize camera communication state.' });
  }
};
