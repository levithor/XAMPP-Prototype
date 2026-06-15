const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "yourpassword",
    database: "occuvision"
});

module.exports = connection;

app.post("/api/occupancy", (req, res) => {

    const roomId = req.body.roomId;
    const occupancy = req.body.occupancy;

    const sql = `
        INSERT INTO occupancy_logs
        (room_id, occupancy_count)
        VALUES (?, ?)
    `;

    connection.query(
        sql,
        [roomId, occupancy],
        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json({
                message: "Occupancy recorded"
            });
        }
    );
});