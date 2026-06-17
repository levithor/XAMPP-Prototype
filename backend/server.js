require("dotenv").config();
const express = require("express");
const connection = require("./database");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("OccuVision API Running");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});

connection.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Connected to MySQL");
    }
});

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

app.get("/api/occupancy/history", (req, res) => {

    const sql = `
        SELECT *
        FROM occupancy_logs
        ORDER BY timestamp DESC
    `;

    connection.query(sql, (err, results) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(results);
    });
});

app.get("/api/test", (req, res) => {
    res.json({
        message: "API is working"
    });
});