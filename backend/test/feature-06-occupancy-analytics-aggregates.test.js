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

function stubQuery(t, implementation) {
  return t.mock.method(db, 'query', implementation);
}

test('calculateAverageOccupancy returns the aggregate for the selected room and time range', async (t) => {
  const aggregate = {
    avg_occupancy_count: 7.5,
    avg_pct: 37.5,
    sample_size: 4,
  };
  const query = stubQuery(t, async () => [[aggregate], []]);
  const res = createResponse();

  await analyticsController.calculateAverageOccupancy(
    {
      query: {
        room_id: '6',
        date: '2026-10-29',
        hour_from: '8',
        hour_to: '12',
      },
    },
    res
  );

  assert.deepEqual(res.body, aggregate);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    '2026-10-29',
    8,
    12,
    '6',
  ]);
  assert.match(query.mock.calls[0].arguments[0], /AVG\(ol\.occupancy_count\)/);
  assert.match(query.mock.calls[0].arguments[0], /r\.capacity_limit > 0/);
});

test('calculateAverageOccupancy returns 404 for an empty aggregate', async (t) => {
  stubQuery(t, async () => [[{
    avg_occupancy_count: null,
    avg_pct: null,
    sample_size: 0,
  }], []]);
  const res = createResponse();

  await analyticsController.calculateAverageOccupancy({ query: {} }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: 'No matching records exist to calculate the average occupancy.',
  });
});

test('calculateAverageOccupancy uses inclusive default hours and reports query errors', async (t) => {
  let fail = false;
  const query = stubQuery(t, async () => {
    if (fail) throw new Error('analytics query failed');
    return [[{
      avg_occupancy_count: 0,
      avg_pct: 0,
      sample_size: 1,
    }], []];
  });
  const success = createResponse();

  await analyticsController.calculateAverageOccupancy({ query: {} }, success);

  assert.equal(success.body.sample_size, 1);
  assert.deepEqual(query.mock.calls[0].arguments[1].slice(1), [0, 23]);

  fail = true;
  const failure = createResponse();
  await analyticsController.calculateAverageOccupancy({ query: {} }, failure);

  assert.equal(failure.statusCode, 500);
  assert.deepEqual(failure.body, { error: 'analytics query failed' });
});

test('getPeakOccupancyPeriods returns ordered room peaks for the requested interval', async (t) => {
  const rows = [
    { room_id: 6, occupancy_count: 19, occupancy_pct: 95 },
    { room_id: 6, occupancy_count: 18, occupancy_pct: 90 },
  ];
  const query = stubQuery(t, async () => [rows, []]);
  const res = createResponse();

  await analyticsController.getPeakOccupancyPeriods(
    {
      query: {
        room_id: '6',
        date: '2026-10-29',
        hour_from: '9',
        hour_to: '10',
      },
    },
    res
  );

  assert.deepEqual(res.body, rows);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    '2026-10-29',
    9,
    10,
    '6',
  ]);
  assert.match(query.mock.calls[0].arguments[0], /ORDER BY ol\.occupancy_count DESC, ol\.recorded_at ASC/);
  assert.match(query.mock.calls[0].arguments[0], /LIMIT 5/);
});

test('getPeakOccupancyPeriods returns 404 when no data matches the filters', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await analyticsController.getPeakOccupancyPeriods({ query: {} }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: 'No matching records exist to identify peak occupancy periods.',
  });
});

test('getPeakOccupancyPeriods reports database errors', async (t) => {
  stubQuery(t, async () => {
    throw new Error('analytics query failed');
  });
  const res = createResponse();

  await analyticsController.getPeakOccupancyPeriods({ query: {} }, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'analytics query failed' });
});
