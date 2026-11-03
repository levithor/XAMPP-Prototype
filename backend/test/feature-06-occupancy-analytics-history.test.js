const assert = require('node:assert/strict');
const { test } = require('node:test');

const db = require('../src/config/db');
const analyticsController = require('../src/controllers/analyticsController');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('getHistoricalRecords applies room, date, and hour filters and reports empty results', async (t) => {
  const rows = [{ log_id: 7, room_id: 4, occupancy_count: 12 }];
  let resultRows = rows;
  const query = t.mock.method(db, 'query', async () => [resultRows, []]);
  const req = {
    query: {
      room_id: '4',
      date: '2026-10-29',
      hour_from: '9',
      hour_to: '12',
    },
  };
  const success = createResponse();

  await analyticsController.getHistoricalRecords(req, success);

  assert.deepEqual(success.body, rows);
  assert.match(query.mock.calls[0].arguments[0], /DATE\(ol\.recorded_at\) = \?/);
  assert.match(query.mock.calls[0].arguments[0], /HOUR\(ol\.recorded_at\) BETWEEN \? AND \?/);
  assert.match(query.mock.calls[0].arguments[0], /AND ol\.room_id = \?/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    '2026-10-29',
    9,
    12,
    '4',
  ]);

  resultRows = [];
  const empty = createResponse();
  await analyticsController.getHistoricalRecords(req, empty);

  assert.equal(empty.statusCode, 404);
  assert.deepEqual(empty.body, {
    error: 'No historical occupancy data available for the chosen filters.',
  });
});
