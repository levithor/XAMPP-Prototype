const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Server is running!");
});

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
const analyticsRoutes =
    require('./routes/analyticsRoutes');
const imageRoutes =
    require('./routes/imageRoutes');

app.use('/api/rooms',     roomRoutes);
app.use('/api/cameras',   cameraRoutes);
app.use('/api/occupancy', occupancyRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/admins',    adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/images',    imageRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({ error: err.message });
});

module.exports = app;