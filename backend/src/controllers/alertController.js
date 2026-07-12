const db = require('../config/db');

exports.getAlerts = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT *
            FROM alerts
            ORDER BY created_at DESC
            `
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.createAlert = async (req, res) => {

    try {

        const {
            room_id,
            alert_type,
            message
        } = req.body;

        const [existing] = await db.query(
            `
            SELECT alert_id
            FROM alerts
            WHERE room_id = ?
              AND alert_type = ?
              AND is_resolved = FALSE
            LIMIT 1
            `,
            [room_id, alert_type]
        );

        if (existing.length > 0) {
            return res.status(200).json({
                alert_id: existing[0].alert_id,
                message: 'Active alert already exists for this room/type'
            });
        }

        const [result] = await db.query(
            `
            INSERT INTO alerts
            (
                room_id,
                alert_type,
                message
            )
            VALUES (?, ?, ?)
            `,
            [
                room_id,
                alert_type,
                message
            ]
        );

        res.status(201).json({
            alert_id: result.insertId
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.resolveAlert = async (req, res) => {

    try {

        await db.query(
            `
            UPDATE alerts
            SET is_resolved = TRUE
            WHERE alert_id = ?
            `,
            [req.params.id]
        );

        res.json({
            message: 'Alert resolved'
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.unresolveAlert = async (req, res) => {

    try {

        await db.query(
            `
            UPDATE alerts
            SET is_resolved = FALSE
            WHERE alert_id = ?
            `,
            [req.params.id]
        );

        res.json({
            message: 'Alert unresolved'
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.deleteAlert = async (req, res) => {

    try {

        await db.query(
            `
            DELETE FROM alerts
            WHERE alert_id = ?
            `,
            [req.params.id]
        );

        res.json({
            message: 'Alert deleted'
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};