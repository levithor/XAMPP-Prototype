const db = require('../config/db');

/**
 * GET /api/analytics/hourly-trend
 */
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

/**
 * GET /api/analytics/weekly-heatmap?date=YYYY-MM-DD&room_id=1
 *
 * Returns occupancy data for the Mon–Sun week that contains the selected date.
 * Each row shows the average occupancy % per day-of-week + hour for that week only.
 * Changing the date to a different week shows that week's data fresh.
 */
exports.getWeeklyHeatmap = async (req, res) => {
    try {
        const date    = req.query.date    || new Date().toISOString().slice(0, 10);
        const room_id = req.query.room_id || null;

        // Find Monday of the week containing the selected date.
        // DATE_FORMAT weekday: 0=Monday … 6=Sunday (MODE 1)
        // We use DAYOFWEEK (1=Sun … 7=Sat) and adjust to get Mon.
        // Easier to just calculate in JS and pass two dates to SQL.
        const d         = new Date(date + 'T12:00:00'); // noon avoids DST edge
        const dayOfWeek = d.getDay();                   // 0=Sun, 1=Mon … 6=Sat
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday    = new Date(d);
        monday.setDate(d.getDate() + diffToMon);
        const sunday    = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const weekStart = monday.toISOString().slice(0, 10);
        const weekEnd   = sunday.toISOString().slice(0, 10);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [weekStart, weekEnd];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                DAYOFWEEK(ol.recorded_at)                                   AS day_of_week,
                HOUR(ol.recorded_at)                                        AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)  AS avg_pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY DAYOFWEEK(ol.recorded_at), HOUR(ol.recorded_at)
             ORDER BY day_of_week, hour`,
            params
        );

        // Also return the week bounds so the frontend can label the heatmap
        res.json({
            week_start: weekStart,
            week_end:   weekEnd,
            rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/analytics/forecast
 */
exports.getForecast = async (req, res) => {
    try {
        const today    = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const date      = req.query.date      || tomorrow.toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;

        const forecastDow = new Date(date + 'T12:00:00').getDay() + 1;

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                HOUR(ol.recorded_at)                              AS hour,
                DAYOFWEEK(ol.recorded_at)                         AS dow,
                ol.occupancy_count / r.capacity_limit * 100       AS pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE ol.recorded_at >= NOW() - INTERVAL 28 DAY
               AND r.capacity_limit > 0
               ${roomClause}
             ORDER BY hour, dow`,
            params
        );

        const sameDow = {};
        const allDow  = {};

        rows.forEach(r => {
            const h = r.hour;
            if (!allDow[h])  allDow[h]  = [];
            allDow[h].push(Number(r.pct));
            if (r.dow === forecastDow) {
                if (!sameDow[h]) sameDow[h] = [];
                sameDow[h].push(Number(r.pct));
            }
        });

        function stats(arr) {
            if (!arr || arr.length === 0) return null;
            const n   = arr.length;
            const avg = arr.reduce((a, b) => a + b, 0) / n;
            const sd  = n > 1
                ? Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1))
                : 0;
            return { avg, sd, n };
        }

        const result = [];
        for (let h = hour_from; h <= hour_to; h++) {
            const useSameDow = (sameDow[h]?.length ?? 0) >= 2;
            const s = stats(useSameDow ? sameDow[h] : allDow[h]);
            if (!s) {
                result.push({ hour: h, predicted_pct: null, lower_pct: null, upper_pct: null, sample_size: 0 });
                continue;
            }
            const predicted = Math.max(0, Math.min(100, Math.round(s.avg)));
            result.push({
                hour:          h,
                predicted_pct: predicted,
                lower_pct:     Math.max(0,   Math.round(s.avg - s.sd)),
                upper_pct:     Math.min(100, Math.round(s.avg + s.sd)),
                sample_size:   s.n,
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/analytics/room-utilization
 */
exports.getRoomUtilization = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;

        const roomClause = room_id ? 'AND r.room_id = ?' : '';
        const params = [date, hour_from, hour_to, date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                r.room_id,
                r.room_name                                     AS name,
                r.capacity_limit                                AS capacity,
                r.occupancy_threshold                           AS threshold,
                COALESCE(win.occupancy_count, fb.occupancy_count, 0)  AS occupancy_count,
                COALESCE(win.recorded_at,     fb.recorded_at)         AS last_updated
             FROM rooms r
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