const db = require('../config/db');

exports.getAdmins = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT
                admin_id,
                email,
                username,
                profile_image_url,
                created_at,
                last_login
            FROM admins
            `
        );

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};

exports.createAdmin = async (req, res) => {

    try {

        const {
            email,
            password_hash,
            username
        } = req.body;

        const [result] = await db.query(
            `
            INSERT INTO admins
            (
                email,
                password_hash,
                username
            )
            VALUES (?, ?, ?)
            `,
            [
                email,
                password_hash,
                username
            ]
        );

        res.status(201).json({
            admin_id: result.insertId
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
};