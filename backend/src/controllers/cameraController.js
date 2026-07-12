const db = require('../config/db');

exports.getCameras = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM cameras ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCameraById = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cameras WHERE camera_id = ?',
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
    const { camera_name, ip_address, status, assigned_room_id } = req.body;
    if (!camera_name) return res.status(400).json({ message: 'camera_name is required' });

    const [result] = await db.query(
      `INSERT INTO cameras (camera_name, ip_address, status, assigned_room_id)
       VALUES (?, ?, ?, ?)`,
      [camera_name, ip_address || null, status || 'online', assigned_room_id || null]
    );
    res.status(201).json({ camera_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCamera = async (req, res) => {
  try {
    const { camera_name, ip_address, status, assigned_room_id } = req.body;
    if (!camera_name) return res.status(400).json({ message: 'camera_name is required' });

    const [result] = await db.query(
      `UPDATE cameras
       SET camera_name = ?, ip_address = ?, status = ?, assigned_room_id = ?
       WHERE camera_id = ?`,
      [camera_name, ip_address || null, status || 'online', assigned_room_id || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Camera not found' });
    res.json({ message: 'updated' });
  } catch (err) {
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