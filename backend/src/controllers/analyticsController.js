const db = require('../config/db');

/**
 * GET /api/analytics/hourly-trend?date=YYYY-MM-DD&hour_from=0&hour_to=23
 */
exports.getHourlyTrend = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const [rows] = await db.query(
            `
            SELECT
                HOUR(ol.recorded_at)                                      AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1) AS avg_pct
            FROM occupancy_logs ol
            JOIN rooms r ON ol.room_id = r.room_id
            WHERE DATE(ol.recorded_at) = ?
              AND HOUR(ol.recorded_at) BETWEEN ? AND ?
              AND r.capacity_limit > 0
            GROUP BY HOUR(ol.recorded_at)
            ORDER BY hour
            `,
            [date, hour_from, hour_to]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/analytics/weekly-heatmap?date=YYYY-MM-DD
 * Always returns the 4-week window ending on the selected date
 */
exports.getWeeklyHeatmap = async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);

        const [rows] = await db.query(
            `
            SELECT
                DAYOFWEEK(ol.recorded_at)                                  AS day_of_week,
                HOUR(ol.recorded_at)                                       AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1) AS avg_pct
            FROM occupancy_logs ol
            JOIN rooms r ON ol.room_id = r.room_id
            WHERE ol.recorded_at BETWEEN DATE_SUB(?, INTERVAL 28 DAY) AND ?
              AND r.capacity_limit > 0
            GROUP BY DAYOFWEEK(ol.recorded_at), HOUR(ol.recorded_at)
            ORDER BY day_of_week, hour
            `,
            [date, date]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/analytics/room-utilization?date=YYYY-MM-DD&hour_from=0&hour_to=23
 * Returns each room with the latest occupancy reading within the selected window
 */
exports.getRoomUtilization = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const [rows] = await db.query(
            `
            SELECT
                r.room_id,
                r.room_name                                   AS name,
                r.capacity_limit                              AS capacity,
                r.occupancy_threshold                         AS threshold,
                COALESCE(latest.occupancy_count, 0)           AS occupancy_count,
                latest.recorded_at                            AS last_updated
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
            ) latest ON r.room_id = latest.room_id
            ORDER BY r.room_name
            `,
            [date, hour_from, hour_to]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};