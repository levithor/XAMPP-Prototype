const db = require('../config/db');
const { checkAndCreateAlerts } = require('../services/alertService');

exports.getLogs = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT *
             FROM occupancy_logs
             ORDER BY recorded_at DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getLatestOccupancy = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                ol.*,
                r.room_name,
                r.capacity_limit,
                r.occupancy_threshold
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE ol.recorded_at = (
                 SELECT MAX(ol2.recorded_at)
                 FROM occupancy_logs ol2
                 WHERE ol2.room_id = ol.room_id
             )
             ORDER BY ol.recorded_at DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createLog = async (req, res) => {
    try {
        const { room_id, camera_id, occupancy_count } = req.body;

        const [result] = await db.query(
            `INSERT INTO occupancy_logs (room_id, camera_id, occupancy_count)
             VALUES (?, ?, ?)`,
            [room_id, camera_id, occupancy_count]
        );

        // Check thresholds and fire/resolve alerts automatically.
        // This runs after the response is sent so the camera isn't
        // kept waiting on alert logic.
        res.status(201).json({ log_id: result.insertId });

        await checkAndCreateAlerts(room_id, occupancy_count);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getLogsByRoom = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT *
             FROM occupancy_logs
             WHERE room_id = ?
             ORDER BY recorded_at DESC`,
            [req.params.roomId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};