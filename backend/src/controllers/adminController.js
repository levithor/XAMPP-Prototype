const db     = require('../config/db');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change_this_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'email and password are required'
            });
        }

        const [rows] = await db.query(
            `SELECT * FROM admins WHERE email = ? LIMIT 1`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: 'invalid credentials'
            });
        }

        const admin = rows[0];
        const match = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!match) {
            return res.status(401).json({
                error: 'invalid credentials'
            });
        }

        await db.query(
            `UPDATE admins SET last_login = NOW() WHERE admin_id = ?`,
            [admin.admin_id]
        );

        const payload = {
            admin_id: admin.admin_id,
            email:    admin.email,
            username: admin.username,
        };

        const token = jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        return res.json({
            token,
            admin: {
                admin_id: admin.admin_id,
                email:    admin.email,
                username: admin.username,
                profile_image_url: admin.profile_image_url ?? null,
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({
            error: 'internal server error'
        });
    }
};

exports.getMe = async (req, res) => {

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
            WHERE admin_id = ?
            `,
            [req.admin.admin_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'admin not found'
            });
        }

        return res.json(rows[0]);

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};

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

        const { email, password, username } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({
                error: 'email, password, and username are required'
            });
        }

        const SALT_ROUNDS = 10;
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const [result] = await db.query(
            `
            INSERT INTO admins
            (email, password_hash, username)
            VALUES (?, ?, ?)
            `,
            [email, password_hash, username]
        );

        res.status(201).json({
            admin_id: result.insertId
        });

    } catch (err) {
        // dupe mail catch
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'an admin with that email already exists'
            });
        }
        res.status(500).json({
            error: err.message
        });
    }
};