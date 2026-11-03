const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDahuaApiClient,
  readConfig,
  DahuaApiError,
} = require('../src/services/dahuaApiClient');

test('Dahua requests use the documented GET endpoints and API-key header', async () => {
  const requests = [];
  const client = createDahuaApiClient({
    baseUrl: 'http://xampp.local/dahua-server/api',
    apiKey: 'test-only-key',
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
      return { ok: true, json: async () => ({ cameras: [] }) };
    },
  });

  await client.getLatest();
  await client.getHistory({
    cameraId: 'cam 01',
    areaId: 'north',
    limit: 500,
    beforeObservationId: 20500,
  });

  assert.equal(requests[0].url.href, 'http://xampp.local/dahua-server/api/latest.php');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers['X-API-Key'], 'test-only-key');
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.equal(requests[1].url.pathname, '/dahua-server/api/history.php');
  assert.equal(requests[1].url.searchParams.get('camera_id'), 'cam 01');
  assert.equal(requests[1].url.searchParams.get('area_id'), 'north');
  assert.equal(requests[1].url.searchParams.get('limit'), '500');
  assert.equal(requests[1].url.searchParams.get('before_observation_id'), '20500');
});

test('backend configuration rejects whitespace and URL credentials without revealing values', () => {
  assert.throws(
    () => readConfig({
      DAHUA_API_BASE_URL: 'http://xampp.local/api',
      DAHUA_API_KEY: ' test-only-key ',
    }),
    (error) => error instanceof DahuaApiError
      && error.code === 'CONFIG_API_KEY'
      && !error.message.includes('test-only-key')
  );
  assert.throws(
    () => readConfig({
      DAHUA_API_BASE_URL: 'http://user:password@xampp.local/api',
      DAHUA_API_KEY: 'test-only-key',
    }),
    (error) => error instanceof DahuaApiError
      && error.code === 'CONFIG_BASE_URL'
      && !error.message.includes('password')
  );
});

test('HTTP error details do not include external response bodies', async () => {
  const client = createDahuaApiClient({
    baseUrl: 'http://xampp.local/api',
    apiKey: 'test-only-key',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'do-not-include-this-response' }),
    }),
  });

  await assert.rejects(client.getLatest(), (error) => {
    assert.equal(error.code, 'HTTP_401');
    assert.equal(error.statusCode, 401);
    assert.doesNotMatch(error.message, /test-only-key|do-not-include-this-response/);
    return true;
  });
});
