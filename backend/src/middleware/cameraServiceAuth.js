const { timingSafeEqual } = require('crypto');

function requireCameraService(req, res, next) {
  const expectedToken = process.env.CAMERA_SERVICE_TOKEN;
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/i);

  if (!expectedToken) {
    return res.status(503).json({ error: 'Camera service authentication is not configured.' });
  }

  const suppliedToken = match && match[1];
  if (!suppliedToken) {
    return res.status(401).json({ error: 'Camera service authentication required.' });
  }

  const expected = Buffer.from(expectedToken, 'utf8');
  const supplied = Buffer.from(suppliedToken, 'utf8');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ error: 'Invalid camera service credentials.' });
  }

  next();
}

module.exports = { requireCameraService };
