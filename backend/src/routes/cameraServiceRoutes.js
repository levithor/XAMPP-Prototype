const express = require('express');
const router = express.Router();
const cameraServiceController = require('../controllers/cameraServiceController');
const { requireCameraService } = require('../middleware/cameraServiceAuth');

router.use(requireCameraService);
router.get('/cameras', cameraServiceController.getDesiredCameras);
router.post('/startup', cameraServiceController.markDesiredCamerasOffline);

module.exports = router;
