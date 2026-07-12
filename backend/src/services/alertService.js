const db = require('../config/db');

async function checkAndCreateAlerts(room_id, occupancy_count) {
  try {

    const [rooms] = await db.query(
      'SELECT capacity_limit, occupancy_threshold, room_name FROM rooms WHERE room_id = ?',
      [room_id]
    );
    if (rooms.length === 0) return;

    const { capacity_limit, occupancy_threshold, room_name } = rooms[0];

    const isOverCapacity  = occupancy_count >  capacity_limit;
    const isNearCapacity  = occupancy_count >= occupancy_threshold && !isOverCapacity;
    const isClear         = occupancy_count <  occupancy_threshold;

    if (isOverCapacity) {
      await createIfNotExists(
        room_id,
        'overcrowding',
        `${room_name} is over capacity — ${occupancy_count} of ${capacity_limit} max`
      );
    } else {
      // Count dropped back to or below capacity — auto-resolve any open overcrowding alert
      await autoResolve(room_id, 'overcrowding');
    }

    if (isNearCapacity) {
      await createIfNotExists(
        room_id,
        'near_capacity',
        `${room_name} is approaching capacity — ${occupancy_count} of ${capacity_limit} max`
      );
    } else {
      await autoResolve(room_id, 'near_capacity');
    }

  } catch (err) {
    console.error('alertService error:', err.message);
  }
}

async function createIfNotExists(room_id, alert_type, message) {
  const [existing] = await db.query(
    `SELECT alert_id FROM alerts
     WHERE room_id = ? AND alert_type = ? AND is_resolved = FALSE
     LIMIT 1`,
    [room_id, alert_type]
  );
  if (existing.length > 0) return; 

  await db.query(
    `INSERT INTO alerts (room_id, alert_type, message) VALUES (?, ?, ?)`,
    [room_id, alert_type, message]
  );
}

async function autoResolve(room_id, alert_type) {
  await db.query(
    `UPDATE alerts
     SET is_resolved = TRUE
     WHERE room_id = ? AND alert_type = ? AND is_resolved = FALSE`,
    [room_id, alert_type]
  );
}

module.exports = { checkAndCreateAlerts };