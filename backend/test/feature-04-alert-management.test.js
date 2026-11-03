const assert = require('node:assert/strict');
const { test } = require('node:test');

const db = require('../src/config/db');
const { checkAndCreateAlerts } = require('../src/services/alertService');

function stubQuery(t, implementation) {
  return t.mock.method(db, 'query', implementation);
}

test('checkAndCreateAlerts creates overcrowding only above capacity', async (t) => {
  const inserted = [];
  const resolved = [];
  stubQuery(t, async (sql, params) => {
    if (sql.includes('SELECT capacity_limit')) {
      return [[{ capacity_limit: 10, occupancy_threshold: 8, room_name: 'Lab' }], []];
    }
    if (sql.includes('SELECT alert_id')) return [[], []];
    if (sql.includes('INSERT INTO alerts')) {
      inserted.push(params);
      return [{ insertId: inserted.length }, []];
    }
    if (sql.includes('UPDATE alerts')) {
      resolved.push(params);
      return [{ affectedRows: 1 }, []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  await checkAndCreateAlerts(5, 11);

  assert.deepEqual(inserted.map(([roomId, type]) => [roomId, type]), [
    [5, 'overcrowding'],
  ]);
  assert.deepEqual(resolved, [[5, 'near_capacity']]);
});

test('checkAndCreateAlerts treats exact capacity as near capacity', async (t) => {
  const inserted = [];
  const resolved = [];
  stubQuery(t, async (sql, params) => {
    if (sql.includes('SELECT capacity_limit')) {
      return [[{ capacity_limit: 10, occupancy_threshold: 8, room_name: 'Lab' }], []];
    }
    if (sql.includes('SELECT alert_id')) return [[], []];
    if (sql.includes('INSERT INTO alerts')) {
      inserted.push(params);
      return [{ insertId: inserted.length }, []];
    }
    if (sql.includes('UPDATE alerts')) {
      resolved.push(params);
      return [{ affectedRows: 1 }, []];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  await checkAndCreateAlerts(5, 10);

  assert.deepEqual(inserted.map(([roomId, type]) => [roomId, type]), [
    [5, 'near_capacity'],
  ]);
  assert.deepEqual(resolved, [[5, 'overcrowding']]);
});

test('checkAndCreateAlerts creates near-capacity alert at the threshold', async (t) => {
  const inserted = [];
  stubQuery(t, async (sql, params) => {
    if (sql.includes('SELECT capacity_limit')) {
      return [[{ capacity_limit: 10, occupancy_threshold: 8, room_name: 'Lab' }], []];
    }
    if (sql.includes('SELECT alert_id')) return [[], []];
    if (sql.includes('INSERT INTO alerts')) {
      inserted.push(params);
      return [{ insertId: inserted.length }, []];
    }
    return [{ affectedRows: 1 }, []];
  });

  await checkAndCreateAlerts(5, 8);

  assert.deepEqual(inserted.map(([roomId, type]) => [roomId, type]), [
    [5, 'near_capacity'],
  ]);
});
