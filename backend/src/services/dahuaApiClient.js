const DEFAULT_TIMEOUT_MS = 5000;

class DahuaApiError extends Error {
  constructor(message, code, statusCode = null) {
    super(message);
    this.name = 'DahuaApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function readConfig(env = process.env) {
  const rawBaseUrl = env.DAHUA_API_BASE_URL;
  const apiKey = env.DAHUA_API_KEY;
  if (typeof rawBaseUrl !== 'string' || !rawBaseUrl.trim()) {
    throw new DahuaApiError('Dahua API base URL is not configured.', 'CONFIG_BASE_URL');
  }
  if (typeof apiKey !== 'string' || !apiKey || apiKey !== apiKey.trim()) {
    throw new DahuaApiError('Dahua API key is missing or contains surrounding whitespace.', 'CONFIG_API_KEY');
  }

  let base;
  try {
    base = new URL(rawBaseUrl);
  } catch {
    throw new DahuaApiError('Dahua API base URL is invalid.', 'CONFIG_BASE_URL');
  }
  if (!['http:', 'https:'].includes(base.protocol)
      || !base.hostname
      || base.username
      || base.password
      || base.search
      || base.hash) {
    throw new DahuaApiError('Dahua API base URL must be an HTTP(S) URL without credentials or query parameters.', 'CONFIG_BASE_URL');
  }

  return {
    baseUrl: base.href.replace(/\/+$/, ''),
    apiKey,
  };
}

function createDahuaApiClient({
  baseUrl,
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new DahuaApiError('This Node.js runtime does not provide fetch.', 'FETCH_UNAVAILABLE');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new DahuaApiError('Dahua API timeout must be a positive integer.', 'CONFIG_TIMEOUT');
  }
  const config = baseUrl === undefined || apiKey === undefined
    ? readConfig()
    : readConfig({ DAHUA_API_BASE_URL: baseUrl, DAHUA_API_KEY: apiKey });

  async function getJson(path, query = {}) {
    const url = new URL(`${config.baseUrl}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timeout.unref === 'function') timeout.unref();
    try {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-API-Key': config.apiKey,
          },
          signal: controller.signal,
        });
      } catch (error) {
        const code = error && error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
        throw new DahuaApiError('Dahua API request failed.', code);
      }

      if (!response.ok) {
        throw new DahuaApiError(
          `Dahua API returned HTTP ${response.status}.`,
          `HTTP_${response.status}`,
          response.status
        );
      }

      try {
        return await response.json();
      } catch {
        throw new DahuaApiError('Dahua API returned invalid JSON.', 'INVALID_JSON', response.status);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    getLatest: () => getJson('latest.php'),
    getHistory: ({ cameraId, areaId, limit = 500, beforeObservationId } = {}) => {
      if (typeof cameraId !== 'string' || !cameraId
          || typeof areaId !== 'string' || !areaId
          || Buffer.byteLength(cameraId, 'utf8') > 64
          || Buffer.byteLength(areaId, 'utf8') > 128
          || !Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new DahuaApiError('Dahua history request parameters are invalid.', 'INVALID_HISTORY_QUERY');
      }
      if (beforeObservationId !== undefined && beforeObservationId !== null
          && (!Number.isSafeInteger(beforeObservationId) || beforeObservationId < 1)) {
        throw new DahuaApiError('Dahua history request parameters are invalid.', 'INVALID_HISTORY_QUERY');
      }
      return getJson('history.php', {
        camera_id: cameraId,
        area_id: areaId,
        limit,
        before_observation_id: beforeObservationId,
      });
    },
    getHealth: () => getJson('health.php'),
  };
}

module.exports = {
  createDahuaApiClient,
  DahuaApiError,
  readConfig,
};
