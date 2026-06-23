const express = require('express');
const router = express.Router();

const cameraController =
    require('../controllers/cameraController');

router.get('/', cameraController.getCameras);

router.get('/:id',
    cameraController.getCameraById);

router.post('/',
    cameraController.createCamera);

module.exports = router;