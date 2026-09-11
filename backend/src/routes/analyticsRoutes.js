const express    = require('express');
const router     = express.Router();
const analytics  = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');

router.get('/historical-records', analytics.getHistoricalRecords);   // MD-18 getHistoricalRecords
router.get('/average-occupancy',  analytics.calculateAverageOccupancy); // MD-19 calculateAverageOccupancy
router.get('/peak-occupancy',     analytics.getPeakOccupancyPeriods);   // MD-20 getPeakOccupancyPeriods
router.get('/hourly-trend',      analytics.getHourlyTrend);
router.get('/weekly-heatmap',    analytics.getWeeklyHeatmap);
router.get('/room-utilization',  analytics.getRoomUtilization);
router.get('/forecast',          analytics.getForecast);

module.exports = router;