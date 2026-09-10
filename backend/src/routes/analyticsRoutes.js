const express    = require('express');
const router     = express.Router();
const analytics  = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');

router.get('/hourly-trend',      analytics.getHourlyTrend);
router.get('/weekly-heatmap',    analytics.getWeeklyHeatmap);
router.get('/room-utilization',  analytics.getRoomUtilization);
router.get('/forecast',          analytics.getForecast);

module.exports = router;