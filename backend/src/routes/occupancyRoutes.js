const express = require('express');
const router = express.Router();

const occupancyController =
    require('../controllers/occupancyController');

router.get('/latest',
    occupancyController.getLatestOccupancy);   

router.get('/',
    occupancyController.getLogs);

router.get('/room/:roomId',
    occupancyController.getLogsByRoom);

router.post('/',
    occupancyController.createLog);

module.exports = router;