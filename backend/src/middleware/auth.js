const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'authentication required'
        });
    }

    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError'
            ? 'session expired, please sign in again'
            : 'invalid token';

        return res.status(401).json({ error: message });
    }
}

module.exports = { requireAuth };