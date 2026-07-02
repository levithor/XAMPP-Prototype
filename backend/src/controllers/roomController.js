const db = require('../config/db');

// GET all rooms
exports.getRooms = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM rooms');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET single room by ID
exports.getRoomById = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM rooms WHERE room_id = ?',
            [req.params.room_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST create a new room
exports.createRoom = async (req, res) => {
    try {
        const { room_name, capacity_limit, occupancy_threshold } = req.body;

        if (!room_name) {
            return res.status(400).json({ error: 'room_name is required' });
        }

        const [result] = await db.query(
            `INSERT INTO rooms (room_name, capacity_limit, occupancy_threshold)
             VALUES (?, ?, ?)`,
            [room_name, capacity_limit ?? 40, occupancy_threshold ?? 35]
        );

        res.json({ message: 'Room created', room_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT update a room
exports.updateRoom = async (req, res) => {
    try {
        const { room_name, capacity_limit, occupancy_threshold } = req.body;

        const [result] = await db.query(
            `UPDATE rooms SET
                room_name           = COALESCE(?, room_name),
                capacity_limit      = COALESCE(?, capacity_limit),
                occupancy_threshold = COALESCE(?, occupancy_threshold)
             WHERE room_id = ?`,
            [room_name, capacity_limit, occupancy_threshold, req.params.room_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({ message: 'Room updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE a room — removes all dependent records first, then the room
exports.deleteRoom = async (req, res) => {
    const { room_id } = req.params;
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Remove all records that reference this room
        await conn.query('DELETE FROM alerts        WHERE room_id = ?', [room_id]);
        await conn.query('DELETE FROM occupancy_logs WHERE room_id = ?', [room_id]);
        await conn.query(
            'UPDATE cameras SET assigned_room_id = NULL WHERE assigned_room_id = ?',
            [room_id]
        );

        const [result] = await conn.query(
            'DELETE FROM rooms WHERE room_id = ?',
            [room_id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Room not found' });
        }

        await conn.commit();
        res.json({ message: 'Room deleted' });

    } catch (err) {
        await conn.rollback();
        console.error('deleteRoom error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
};