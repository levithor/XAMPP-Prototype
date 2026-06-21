const db = require('../config/db');

exports.getRooms = async (req, res) => {
    const [rows] = await db.query(
        'SELECT * FROM rooms'
    );

    res.json(rows);
};

exports.createRoom = async (req, res) => {

    const {
        room_name,
        capacity_limit,
        occupancy_threshold
    } = req.body;

    const [result] = await db.query(
        `INSERT INTO rooms
        (room_name, capacity_limit, occupancy_threshold)
        VALUES (?, ?, ?)`,
        [
            room_name,
            capacity_limit,
            occupancy_threshold
        ]
    );

    res.json({
        message: "Room created",
        room_id: result.insertId
    });
};