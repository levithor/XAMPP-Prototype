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
        const { camera_id, occupancy_count } = req.body;

        const [cameraRows] = await db.query(
            `SELECT assigned_room_id
            FROM cameras
            WHERE camera_id = ?`,
            [camera_id]
        );

        if (cameraRows.length === 0) {
            return res.status(404).json({
                error: "Camera not found."
            });
        }

        const room_id = cameraRows[0].assigned_room_id;

        if (!room_id) {
            return res.status(400).json({
                error: "Camera is not assigned to a room."
            });
        }

        const [result] = await db.query(
            `INSERT INTO occupancy_logs
            (room_id, camera_id, occupancy_count)
            VALUES (?, ?, ?)`,
            [room_id, camera_id, occupancy_count]
        );

        await db.query(
            `UPDATE cameras
            SET last_communication = NOW()
            WHERE camera_id = ?`,
            [camera_id]
        );

        // Check thresholds and fire/resolve alerts automatically.
        // This runs after the response is sent so the camera isn't
        // kept waiting on alert logic.
        await checkAndCreateAlerts(room_id, occupancy_count);

        res.status(201).json({log_id: result.insertId});

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