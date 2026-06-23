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

router.patch('/:id/unresolve',
    alertController.unresolveAlert);

router.delete('/:id',
    alertController.deleteAlert);

module.exports = router;