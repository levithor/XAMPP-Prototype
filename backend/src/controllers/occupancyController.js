const db = require('../config/db');

exports.getLogs = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT *
            FROM occupancy_logs
            ORDER BY recorded_at DESC
            `
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.createLog = async (req, res) => {

    try {

        const {
            room_id,
            camera_id,
            occupancy_count
        } = req.body;

        const [result] = await db.query(
            `
            INSERT INTO occupancy_logs
            (
                room_id,
                camera_id,
                occupancy_count
            )
            VALUES (?, ?, ?)
            `,
            [
                room_id,
                camera_id,
                occupancy_count
            ]
        );

        res.status(201).json({
            log_id: result.insertId
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.getLogsByRoom = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT *
            FROM occupancy_logs
            WHERE room_id = ?
            ORDER BY recorded_at DESC
            `,
            [req.params.roomId]
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};