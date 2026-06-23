const express = require('express');
const router = express.Router();

const roomController = require('../controllers/roomController');

router.get('/',              roomController.getRooms);      // GET all rooms
router.get('/:room_id',      roomController.getRoomById);   // GET single room
router.post('/',             roomController.createRoom);    // POST add room
router.put('/:room_id',      roomController.updateRoom);    // PUT update room
router.delete('/:room_id',   roomController.deleteRoom);    // DELETE room

module.exports = router;
