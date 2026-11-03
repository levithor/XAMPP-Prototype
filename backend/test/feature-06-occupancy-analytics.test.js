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

test('getForecast averages same-weekday samples and reports bounds', async (t) => {
  const query = stubQuery(t, async () => [[
    { hour: 9, dow: 6, pct: 50 },
    { hour: 9, dow: 6, pct: 70 },
    { hour: 9, dow: 2, pct: 99 },
  ], []]);
  const res = createResponse();

  await analyticsController.getForecast(
    { query: { date: '2026-10-30', room_id: '4', hour_from: '9', hour_to: '9' } },
    res
  );

  assert.deepEqual(res.body, [{
    hour: 9,
    predicted_pct: 60,
    lower_pct: 46,
    upper_pct: 74,
    sample_size: 2,
  }]);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['4']);
});

test('getForecast falls back to all weekdays when same weekday has fewer than two samples', async (t) => {
  stubQuery(t, async () => [[
    { hour: 10, dow: 6, pct: 90 },
    { hour: 10, dow: 2, pct: 20 },
    { hour: 10, dow: 3, pct: 30 },
  ], []]);
  const res = createResponse();

  await analyticsController.getForecast(
    { query: { date: '2026-10-30', hour_from: '10', hour_to: '10' } },
    res
  );

  assert.deepEqual(res.body, [{
    hour: 10,
    predicted_pct: 47,
    lower_pct: 9,
    upper_pct: 85,
    sample_size: 3,
  }]);
});

test('getForecast returns null predictions for hours with no historical samples', async (t) => {
  stubQuery(t, async () => [[], []]);
  const res = createResponse();

  await analyticsController.getForecast(
    { query: { date: '2026-10-30', hour_from: '4', hour_to: '5' } },
    res
  );

  assert.deepEqual(res.body, [
    { hour: 4, predicted_pct: null, lower_pct: null, upper_pct: null, sample_size: 0 },
    { hour: 5, predicted_pct: null, lower_pct: null, upper_pct: null, sample_size: 0 },
  ]);
});

test('getForecast clamps prediction and bounds at percentage limits', async (t) => {
  stubQuery(t, async () => [[
    { hour: 12, dow: 6, pct: 0 },
    { hour: 12, dow: 6, pct: 200 },
  ], []]);
  const res = createResponse();

  await analyticsController.getForecast(
    { query: { date: '2026-10-30', hour_from: '12', hour_to: '12' } },
    res
  );

  assert.deepEqual(res.body, [{
    hour: 12,
    predicted_pct: 100,
    lower_pct: 0,
    upper_pct: 100,
    sample_size: 2,
  }]);
});

test('getForecast returns a server error when the history query fails', async (t) => {
  stubQuery(t, async () => {
    throw new Error('database unavailable');
  });
  const res = createResponse();

  await analyticsController.getForecast(
    { query: { date: '2026-10-30', hour_from: '9', hour_to: '9' } },
    res
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'database unavailable' });
});
