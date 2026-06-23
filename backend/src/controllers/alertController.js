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