const express = require('express');
const router  = express.Router();

const analyticsController =
    require('../controllers/analyticsController');

router.get('/hourly-trend',
    analyticsController.getHourlyTrend);

router.get('/weekly-heatmap',
    analyticsController.getWeeklyHeatmap);

router.get('/room-utilization',
    analyticsController.getRoomUtilization);

module.exports = router;