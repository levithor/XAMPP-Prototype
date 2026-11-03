const db = require('../config/db');

exports.getHistoricalRecords = async (req, res) => {
    try {
        const room_id   = req.query.room_id || null;
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                ol.*,
                r.room_name
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) = ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               ${roomClause}
             ORDER BY ol.recorded_at ASC`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No historical occupancy data available for the chosen filters.' });
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.calculateAverageOccupancy = async (req, res) => {
    try {
        const room_id   = req.query.room_id || null;
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                ROUND(AVG(ol.occupancy_count), 1)                            AS avg_occupancy_count,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)   AS avg_pct,
                COUNT(*)                                                     AS sample_size
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) = ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}`,
            params
        );

        if (!rows[0] || rows[0].sample_size === 0) {
            return res.status(404).json({ error: 'No matching records exist to calculate the average occupancy.' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPeakOccupancyPeriods = async (req, res) => {
    try {
        const room_id   = req.query.room_id || null;
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                ol.room_id,
                r.room_name,
                ol.occupancy_count,
                ROUND(ol.occupancy_count / r.capacity_limit * 100, 1) AS occupancy_pct,
                ol.recorded_at
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) = ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             ORDER BY ol.occupancy_count DESC, ol.recorded_at ASC
             LIMIT 5`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No matching records exist to identify peak occupancy periods.' });
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

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
                ROUND(AVG(ol.occupancy_count), 1)                           AS avg_occupancy_count,
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

exports.getTimeSeriesTrend = async (req, res) => {
    try {
        const room_id      = req.query.room_id   || null;
        const date         = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from    = parseInt(req.query.hour_from ?? 0);
        const hour_to      = parseInt(req.query.hour_to   ?? 23);
        const intervalMins = parseInt(req.query.interval ?? 15);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [intervalMins, intervalMins, date, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(ol.recorded_at) / (? * 60)) * (? * 60)) AS interval_time,
                ROUND(AVG(ol.occupancy_count), 1)                           AS avg_occupancy_count,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)  AS avg_pct,
                COUNT(*)                                                    AS sample_size
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) = ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY interval_time
             ORDER BY interval_time ASC`,
            params
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getWeeklyHeatmap = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const room_id   = req.query.room_id   || null;
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);

        const d         = new Date(date + 'T12:00:00'); 
        const dayOfWeek = d.getDay();                   
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday    = new Date(d);
        monday.setDate(d.getDate() + diffToMon);
        const sunday    = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const weekStart = monday.toISOString().slice(0, 10);
        const weekEnd   = sunday.toISOString().slice(0, 10);

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        const params = [weekStart, weekEnd, hour_from, hour_to];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                DAYOFWEEK(ol.recorded_at)                                   AS day_of_week,
                HOUR(ol.recorded_at)                                        AS hour,
                ROUND(AVG(ol.occupancy_count / r.capacity_limit * 100), 1)  AS avg_pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE DATE(ol.recorded_at) BETWEEN ? AND ?
               AND HOUR(ol.recorded_at) BETWEEN ? AND ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY DAYOFWEEK(ol.recorded_at), HOUR(ol.recorded_at)
             ORDER BY day_of_week, hour`,
            params
        );

        res.json({
            week_start: weekStart,
            week_end:   weekEnd,
            rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// Forecast model
//   • History is aggregated to one value per (day, hour), so every
//     observation is a distinct day (no inflation from many logs/hour).
//   • Recent days count more (exponential decay, 14-day half-life).
//   • Same-weekday history is preferred; with fewer than 3 same-weekday
//     days it is blended with the all-days average instead of switching
//     abruptly.
//   • Accuracy is measured by backtesting: the same model is re-run on
//     recent past days using only data from before each day, then
//     compared with what actually happened.
// ─────────────────────────────────────────────────────────────
const FC_WINDOW_DAYS   = 28;  // history used for one prediction
const FC_HALF_LIFE     = 14;  // days until an observation's weight halves
const FC_MIN_SAME_DOW  = 3;   // same-weekday days needed to rely on weekday pattern fully
const FC_BACKTEST_DAYS = 7;   // most recent days with data used for accuracy
const FC_BACKTEST_MIN  = 10;  // min hourly points to report accuracy
const DAY_MS = 86400000;

const toUtc      = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayDiff    = (a, b) => Math.round((toUtc(a) - toUtc(b)) / DAY_MS);
const dowOf      = s => new Date(toUtc(s)).getUTCDay() + 1;            // 1 = Sunday (same as MySQL DAYOFWEEK)
const shiftDay   = (s, n) => new Date(toUtc(s) + n * DAY_MS).toISOString().slice(0, 10);
const localDate  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clampPct   = v => Math.max(0, Math.min(100, Math.round(v)));

// recency-weighted mean and standard deviation of observations [{day, pct}]
function weightedStats(obs, targetDay) {
    let w1 = 0, w2 = 0, sum = 0;
    const ws = obs.map(o => {
        const w = Math.pow(0.5, dayDiff(targetDay, o.day) / FC_HALF_LIFE);
        w1 += w; w2 += w * w; sum += w * o.pct;
        return w;
    });
    const mean = sum / w1;
    let sd = 0;
    if (obs.length > 1) {
        const ss    = obs.reduce((s, o, i) => s + ws[i] * (o.pct - mean) ** 2, 0);
        const denom = w1 - w2 / w1;
        sd = denom > 0 ? Math.sqrt(ss / denom) : 0;
    }
    return { mean, sd };
}

// hist: [{day, hour, dow, pct}] already limited to the window before targetDay
function predictHour(hist, targetDay, hour) {
    const all = hist.filter(o => o.hour === hour);
    if (all.length === 0) return null;

    const same  = all.filter(o => o.dow === dowOf(targetDay));
    const allS  = weightedStats(all, targetDay);
    const sameS = same.length ? weightedStats(same, targetDay) : null;

    const alpha = Math.min(1, same.length / FC_MIN_SAME_DOW);   // trust in the weekday pattern
    const mean  = sameS ? alpha * sameS.mean + (1 - alpha) * allS.mean : allS.mean;
    const sd    = sameS && same.length >= 2 ? sameS.sd : allS.sd;

    const basis = same.length >= FC_MIN_SAME_DOW ? 'same_weekday'
                : same.length > 0               ? 'blended'
                :                                 'all_days';
    return { mean, sd, basis, n: same.length > 0 ? same.length : all.length };
}

function buildPredictions(history, targetDay, hourFrom, hourTo) {
    const lo   = shiftDay(targetDay, -FC_WINDOW_DAYS);
    const hist = history.filter(o => o.day >= lo && o.day < targetDay);
    const out  = [];
    for (let h = hourFrom; h <= hourTo; h++) {
        const p = predictHour(hist, targetDay, h);
        if (!p) {
            out.push({ hour: h, predicted_pct: null, lower_pct: null, upper_pct: null, sample_size: 0, basis: null });
            continue;
        }
        out.push({
            hour:          h,
            predicted_pct: clampPct(p.mean),
            lower_pct:     clampPct(p.mean - p.sd),
            upper_pct:     clampPct(p.mean + p.sd),
            sample_size:   p.n,      // distinct days behind this prediction
            basis:         p.basis,  // same_weekday | blended | all_days
        });
    }
    return out;
}

// Re-forecast recent past days using only earlier data, compare with actuals.
function backtest(history, targetDay, hourFrom, hourTo) {
    const lo   = shiftDay(targetDay, -FC_WINDOW_DAYS);
    const days = [...new Set(history.filter(o => o.day >= lo && o.day < targetDay).map(o => o.day))]
        .sort().reverse().slice(0, FC_BACKTEST_DAYS);

    let errSum = 0, inside = 0, n = 0, usedDays = 0;
    for (const day of days) {
        const preds   = buildPredictions(history, day, hourFrom, hourTo);
        const actuals = history.filter(o => o.day === day && o.hour >= hourFrom && o.hour <= hourTo);
        let counted = false;
        for (const a of actuals) {
            const p = preds.find(x => x.hour === a.hour);
            if (!p || p.predicted_pct === null) continue;
            errSum += Math.abs(p.predicted_pct - a.pct);
            if (a.pct >= p.lower_pct && a.pct <= p.upper_pct) inside++;
            n++; counted = true;
        }
        if (counted) usedDays++;
    }
    if (n < FC_BACKTEST_MIN) return null;
    return {
        mae:              Math.round((errSum / n) * 10) / 10,   // avg error in percentage points
        coverage_pct:     Math.round((inside / n) * 100),       // % of actual values inside the range
        evaluated_points: n,
        evaluated_days:   usedDays,
    };
}

exports.getForecast = async (req, res) => {
    try {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        const date      = req.query.date      || localDate(tomorrow);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;

        const roomClause = room_id ? 'AND ol.room_id = ?' : '';
        // history = the 56 days before the forecast date
        // (28 for the prediction + 28 more so recent days can be backtested)
        const params = [date, date];
        if (room_id) params.push(room_id);

        const [rows] = await db.query(
            `SELECT
                DATE_FORMAT(ol.recorded_at, '%Y-%m-%d')            AS day,
                HOUR(ol.recorded_at)                               AS hour,
                DAYOFWEEK(ol.recorded_at)                          AS dow,
                AVG(ol.occupancy_count / r.capacity_limit * 100)   AS pct
             FROM occupancy_logs ol
             JOIN rooms r ON ol.room_id = r.room_id
             WHERE ol.recorded_at >= DATE_SUB(?, INTERVAL ${FC_WINDOW_DAYS * 2} DAY)
               AND ol.recorded_at <  ?
               AND r.capacity_limit > 0
               ${roomClause}
             GROUP BY day, hour, dow`,
            params
        );

        const history = rows.map(r => ({ day: r.day, hour: Number(r.hour), dow: Number(r.dow), pct: Number(r.pct) }));

        const predictions = buildPredictions(history, date, hour_from, hour_to);

        // E1: no historical data for the chosen filters
        if (predictions.every(p => p.predicted_pct === null)) {
            return res.json({ predictions: [], accuracy: null });
        }

        res.json({ predictions, accuracy: backtest(history, date, hour_from, hour_to) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getRoomUtilization = async (req, res) => {
    try {
        const date      = req.query.date      || new Date().toISOString().slice(0, 10);
        const hour_from = parseInt(req.query.hour_from ?? 0);
        const hour_to   = parseInt(req.query.hour_to   ?? 23);
        const room_id   = req.query.room_id   || null;
        const mode      = req.query.mode      || 'live';

        const roomClause = room_id ? 'AND r.room_id = ?' : '';

        if (mode === 'average') {
            const params = [date, hour_from, hour_to];
            if (room_id) params.push(room_id);
            const [rows] = await db.query(
                `SELECT
                    r.room_id,
                    r.room_name                                     AS name,
                    r.capacity_limit                                AS capacity,
                    r.occupancy_threshold                           AS threshold,
                    ROUND(AVG(ol.occupancy_count), 1)               AS occupancy_count,
                    MAX(ol.recorded_at)                             AS last_updated
                 FROM rooms r
                 LEFT JOIN occupancy_logs ol ON r.room_id = ol.room_id
                   AND DATE(ol.recorded_at) = ?
                   AND HOUR(ol.recorded_at) BETWEEN ? AND ?
                 WHERE 1=1 ${roomClause}
                 GROUP BY r.room_id, r.room_name, r.capacity_limit, r.occupancy_threshold
                 ORDER BY r.room_name`,
                params
            );
            return res.json(rows);
        }

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