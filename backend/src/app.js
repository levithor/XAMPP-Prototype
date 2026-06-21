const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Server is running!");
});

module.exports = app;

const roomRoutes =
    require('./routes/roomRoutes');

app.use('/api/rooms', roomRoutes);

