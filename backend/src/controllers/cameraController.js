const db = require('../config/db');

exports.getCameras = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM cameras'
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.getCameraById = async (req, res) => {
    try {

        const [rows] = await db.query(
            'SELECT * FROM cameras WHERE camera_id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'Camera not found'
            });
        }

        res.json(rows[0]);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.createCamera = async (req, res) => {

    try {

        const {
            camera_name,
            ip_address,
            status,
            assigned_room_id
        } = req.body;

        const [result] = await db.query(
            `
            INSERT INTO cameras
            (
                camera_name,
                ip_address,
                status,
                assigned_room_id
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                camera_name,
                ip_address,
                status,
                assigned_room_id
            ]
        );

        res.status(201).json({
            camera_id: result.insertId
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};