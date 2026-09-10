const db = require('../config/db');

exports.getHourlyTrend = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;

        const params = [date, hour_from, hour_to];
        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                HOUR(ol.recorded_at)                                        AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)  AS avg_pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) = ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY HOUR(ol.recorded_at)
             ORDER BY hour`,
            params
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getWeeklyHeatmap = async (req, res) => {
    try {
        const date    = req.query.date    || new Date().toISOString().slice(0, 10);
        const room_id = req.query.room_id || null;

        const params = [date, date];
        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                DAYOFWEEK(ol.recorded_at)                                   AS day_of_week,
                HOUR(ol.recorded_at)                                        AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)  AS avg_pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE ol.recorded_at BETWEEN DATE_SUB(?, INTERVAL 28 DAY) AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY DAYOFWEEK(ol.recorded_at), HOUR(ol.recorded_at)
             ORDER BY day_of_week, hour`,
            params
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── FORECAST ─────────────────────────────────────────────────────────────────
// Uses simple linear regression on the last 7 days of hourly averages to
// project occupancy % for a future time window on a given date.
//
// Query params:
//   date       – the FUTURE date to forecast (default: tomorrow)
//   hour_from  – start hour 0-23 (default: 0)
//   hour_to    – end hour 0-23   (default: 23)
//   room_id    – optional filter
//
// Returns: [{ hour, predicted_pct, lower_pct, upper_pct }, ...]
exports.getForecast = async (req, res) => {
    try {
        const today     = new Date()
        const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1)
        const date      = req.query.date      || tomorrow.toISOString().slice(0, 10)
        const hour_from = parseInt(req.query.hour_from ?? 0)
        const hour_to   = parseInt(req.query.hour_to   ?? 23)
        const room_id   = req.query.room_id   || null

        // Pull the last 28 days of hourly averages as the training set
        const roomClause = room_id ? 'AND ol.room_id = ?' : ''
        const params = []
        if (room_id) params.push(room_id)

        const [rows] = await db.query(
            `SELECT
                HOUR(ol.recorded_at)                                       AS hour,
                DAYOFWEEK(ol.recorded_at)                                  AS dow,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1) AS avg_pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE ol.recorded_at >= NOW() - INTERVAL 28 DAY
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY HOUR(ol.recorded_at), DAYOFWEEK(ol.recorded_at)
             ORDER BY hour`,
            params
        );


        const forecastDow = new Date(date).getDay() + 1

        // Build per-hour averages: prefer same-DOW rows, fall back to all-DOW
        const byHourSameDow = {}
        const byHourAllDow  = {}
        rows.forEach(r => {
            if (!byHourAllDow[r.hour])  byHourAllDow[r.hour]  = []
            byHourAllDow[r.hour].push(r.avg_pct)
            if (r.dow === forecastDow) {
                if (!byHourSameDow[r.hour]) byHourSameDow[r.hour] = []
                byHourSameDow[r.hour].push(r.avg_pct)
            }
        })

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length


        const points = []
        for (let h = 0; h <= 23; h++) {
            const vals = byHourSameDow[h]?.length ? byHourSameDow[h] : byHourAllDow[h]
            if (vals?.length) points.push({ x: h, y: avg(vals) })
        }

        if (points.length < 2) {
            return res.json([]) // not enough history
        }


        const n   = points.length
        const sumX = points.reduce((s, p) => s + p.x, 0)
        const sumY = points.reduce((s, p) => s + p.y, 0)
        const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
        const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
        const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
        const b = (sumY - m * sumX) / n

        // Residual standard deviation → ±1 SD confidence band
        const residuals = points.map(p => p.y - (m * p.x + b))
        const variance  = residuals.reduce((s, r) => s + r * r, 0) / (n - 2)
        const sd        = Math.sqrt(variance)

        const result = []
        for (let h = hour_from; h <= hour_to; h++) {
            const predicted = Math.max(0, Math.min(100, Math.round(m * h + b)))
            result.push({
                hour:          h,
                predicted_pct: predicted,
                lower_pct:     Math.max(0,   Math.round(predicted - sd)),
                upper_pct:     Math.min(100, Math.round(predicted + sd)),
            })
        }

        res.json(result)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
};

exports.getRoomUtilization = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;

        const roomClause = room_id ? 'AND r.room_id = ?' : '';

        // Build params — room_id needed 3× (window sub-query, fallback sub-query, outer filter)
        const params = [date, hour_from, hour_to, date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                r.room_id,
                r.room_name                                     AS name,
                r.capacity_limit                                AS capacity,
                r.occupancy_threshold                           AS threshold,

                -- prefer the window reading; fall back to the all-time latest
                COALESCE(win.occupancy_count, fb.occupancy_count, 0)  AS occupancy_count,
                COALESCE(win.recorded_at,     fb.recorded_at)         AS last_updated

             FROM rooms r

             -- latest log within the selected date/hour window
             LEFT JOIN (
                 SELECT ol.room_id, ol.occupancy_count, ol.recorded_at
                 FROM occupancy_logs ol
                 INNER JOIN (
                     SELECT room_id, MAX(recorded_at) AS max_ts
                     FROM occupancy_logs
                     WHERE DATE(recorded_at) = ?
                       AND HOUR(recorded_at) BETWEEN ? AND ?
                     GROUP BY room_id
                 ) mx ON ol.room_id = mx.room_id AND ol.recorded_at = mx.max_ts
             ) win ON r.room_id = win.room_id

             -- fallback: most recent log ever for this room
             LEFT JOIN (
                 SELECT ol.room_id, ol.occupancy_count, ol.recorded_at
                 FROM occupancy_logs ol
                 INNER JOIN (
                     SELECT room_id, MAX(recorded_at) AS max_ts
                     FROM occupancy_logs
                     WHERE DATE(recorded_at) <= ?
                       AND HOUR(recorded_at) BETWEEN ? AND ?
                     GROUP BY room_id
                 ) mx ON ol.room_id = mx.room_id AND ol.recorded_at = mx.max_ts
             ) fb ON r.room_id = fb.room_id

             WHERE 1=1 ${roomClause}
             ORDER BY r.room_name`,
            params
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};