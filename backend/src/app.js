const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Server is running!");
});

module.exports = app;

const roomRoutes =
    require('./routes/roomRoutes');

const cameraRoutes =
    require('./routes/cameraRoutes');

const occupancyRoutes =
    require('./routes/occupancyRoutes');

const alertRoutes =
    require('./routes/alertRoutes');

const adminRoutes =
    require('./routes/adminRoutes');

app.use('/api/rooms', roomRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/occupancy', occupancyRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/admins', adminRoutes);
