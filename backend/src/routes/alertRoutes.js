const express = require('express');
const router = express.Router();

const alertController =
    require('../controllers/alertController');

router.get('/',
    alertController.getAlerts);

router.post('/',
    alertController.createAlert);

router.patch('/:id/resolve',
    alertController.resolveAlert);

module.exports = router;