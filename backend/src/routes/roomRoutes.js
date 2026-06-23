const express = require('express');
const router = express.Router();

const roomController =
    require('../controllers/roomController');

router.get('/', roomController.getRooms);
router.get('/:room_id', roomController.getRoomById);
router.post("/", roomController.createRoom);
router.put('/:room_id', roomController.updateRoom);
router.delete('/:room_id', roomController.deleteRoom);

module.exports = router;