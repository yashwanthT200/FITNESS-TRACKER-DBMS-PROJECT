const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Point, getWriteApi, getQueryApi, checkInfluxHealth, flushWrites, deleteData, bucket } = require('../config/influx');
const { getConnection } = require('../config/database');

// Optional/Flexible auth middleware
const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_fittrack_key');
      req.user = decoded;
    } catch {
      // Invalid token, proceed as unauthenticated
    }
  }
  next();
};

/**
 * 1. Healthcheck for InfluxDB
 * GET /api/telemetry/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkInfluxHealth();
    res.json({
      database: 'InfluxDB 2.x',
      category: 'Time-Series Database',
      organization: process.env.INFLUX_ORG || 'FitTrackOrg',
      bucket: bucket,
      status: health.status,
      details: health
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Ingest Single or Batch Telemetry Point(s)
 * POST /api/telemetry
 * Body: { userId, deviceId, metricType, value, unit, timestamp }
 * or Array of such points
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const writeApi = getWriteApi();
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    if (payload.length === 0) {
      return res.status(400).json({ error: 'No telemetry data provided' });
    }

    let pointsWritten = 0;

    for (const item of payload) {
      const userId = String(item.userId || (req.user && req.user.UserID) || '1');
      const deviceId = String(item.deviceId || '1');
      const metricType = String(item.metricType || 'HEART_RATE').toUpperCase();
      const value = parseFloat(item.value);
      const unit = String(item.unit || (metricType === 'HEART_RATE' ? 'bpm' : 'unit'));

      if (isNaN(value)) continue;

      const point = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', metricType)
        .tag('unit', unit)
        .floatField('value', value);

      if (item.timestamp) {
        point.timestamp(new Date(item.timestamp));
      } else {
        point.timestamp(new Date());
      }

      writeApi.writePoint(point);
      pointsWritten++;
    }

    await flushWrites();

    res.status(201).json({
      message: 'Telemetry point(s) written to InfluxDB successfully',
      count: pointsWritten
    });
  } catch (err) {
    console.error('InfluxDB write error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Query Time-Series with Downsampling
 * GET /api/telemetry/query
 * Query params:
 *   userId (optional, defaults to token user or 1)
 *   metricType (e.g. HEART_RATE, SPO2, SPEED, CADENCE)
 *   timeRange (e.g. -15m, -1h, -6h, -24h, -7d, -30d; defaults to -24h)
 *   window (e.g. 10s, 30s, 1m, 5m, 1h; defaults to 1m)
 *   fn (mean, max, min, sum, count; defaults to mean)
 */
router.get('/query', optionalAuth, async (req, res) => {
  try {
    const queryApi = getQueryApi();

    const userId = req.query.userId || (req.user && req.user.UserID) || '1';
    const metricType = (req.query.metricType || 'HEART_RATE').toUpperCase();
    let timeRange = req.query.timeRange || '-24h';
    if (!timeRange.startsWith('-')) timeRange = `-${timeRange}`;
    const window = req.query.window || '1m';
    const fn = req.query.fn || 'mean';

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "health_metric")
        |> filter(fn: (r) => r.metricType == "${metricType}")
        ${userId ? `|> filter(fn: (r) => r.userId == "${userId}")` : ''}
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${window}, fn: ${fn}, createEmpty: false)
        |> yield(name: "${fn}_values")
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMetadata) {
          const o = tableMetadata.toObject(row);
          results.push({
            time: o._time,
            value: o._value,
            metricType: o.metricType,
            unit: o.unit,
            deviceId: o.deviceId,
            userId: o.userId
          });
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    res.json({
      metricType,
      userId,
      timeRange,
      window,
      aggregation: fn,
      totalPoints: results.length,
      data: results
    });
  } catch (err) {
    console.error('InfluxDB query error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Get Latest Raw Points (without downsampling)
 * GET /api/telemetry/raw
 */
router.get('/raw', optionalAuth, async (req, res) => {
  try {
    const queryApi = getQueryApi();

    const userId = req.query.userId || (req.user && req.user.UserID) || '1';
    const metricType = (req.query.metricType || 'HEART_RATE').toUpperCase();
    const limit = parseInt(req.query.limit, 10) || 100;
    let timeRange = req.query.timeRange || '-1h';
    if (!timeRange.startsWith('-')) timeRange = `-${timeRange}`;

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "health_metric")
        |> filter(fn: (r) => r.metricType == "${metricType}")
        ${userId ? `|> filter(fn: (r) => r.userId == "${userId}")` : ''}
        |> filter(fn: (r) => r._field == "value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit})
        |> sort(columns: ["_time"], desc: false)
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMetadata) {
          const o = tableMetadata.toObject(row);
          results.push({
            time: o._time,
            value: o._value,
            metricType: o.metricType,
            unit: o.unit,
            deviceId: o.deviceId,
            userId: o.userId
          });
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    res.json({
      metricType,
      userId,
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('InfluxDB raw query error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. Aggregate Statistics Dashboard (Min, Max, Avg, Latest)
 * GET /api/telemetry/stats
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const queryApi = getQueryApi();
    const userId = req.query.userId || (req.user && req.user.UserID) || '1';
    let timeRange = req.query.timeRange || '-24h';
    if (!timeRange.startsWith('-')) timeRange = `-${timeRange}`;

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "health_metric")
        ${userId ? `|> filter(fn: (r) => r.userId == "${userId}")` : ''}
        |> filter(fn: (r) => r._field == "value")
    `;

    const metricMap = {};

    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMetadata) {
          const o = tableMetadata.toObject(row);
          const type = o.metricType;
          if (!metricMap[type]) {
            metricMap[type] = {
              metricType: type,
              unit: o.unit,
              count: 0,
              sum: 0,
              min: o._value,
              max: o._value,
              latest: o._value,
              latestTime: o._time
            };
          }
          const m = metricMap[type];
          m.count++;
          m.sum += o._value;
          if (o._value < m.min) m.min = o._value;
          if (o._value > m.max) m.max = o._value;
          if (new Date(o._time) >= new Date(m.latestTime)) {
            m.latest = o._value;
            m.latestTime = o._time;
          }
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    const stats = Object.values(metricMap).map(m => ({
      metricType: m.metricType,
      unit: m.unit,
      count: m.count,
      avg: m.count > 0 ? parseFloat((m.sum / m.count).toFixed(2)) : 0,
      min: parseFloat(m.min.toFixed(2)),
      max: parseFloat(m.max.toFixed(2)),
      latest: parseFloat(m.latest.toFixed(2)),
      latestTime: m.latestTime
    }));

    res.json({
      userId,
      timeRange,
      stats
    });
  } catch (err) {
    console.error('InfluxDB stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. Simulate a Realistic Wearable Workout Session
 * POST /api/telemetry/simulate
 * Simulates a workout (e.g. 30 min run) generating high-frequency time-series points
 */
router.post('/simulate', optionalAuth, async (req, res) => {
  try {
    const writeApi = getWriteApi();
    const userId = String(req.body.userId || (req.user && req.user.UserID) || '1');
    const deviceId = String(req.body.deviceId || '1');
    const durationMinutes = parseInt(req.body.durationMinutes, 10) || 30; // default 30 min
    const intervalSeconds = parseInt(req.body.intervalSeconds, 10) || 5; // point every 5 seconds

    const totalSteps = Math.floor((durationMinutes * 60) / intervalSeconds);
    const now = Date.now();
    const startTime = now - (durationMinutes * 60 * 1000);

    let currentHR = 78; // resting/warmup heart rate
    let currentSpeed = 0; // km/h
    let currentCadence = 0; // spm
    let elevation = 120; // meters

    let pointsWritten = 0;

    for (let i = 0; i < totalSteps; i++) {
      const pointTime = new Date(startTime + (i * intervalSeconds * 1000));
      const progress = i / totalSteps;

      // Realistic HR curve: warm up -> peak intervals -> cool down
      if (progress < 0.15) {
        currentHR = Math.min(135, currentHR + Math.random() * 4);
        currentSpeed = 7.5 + Math.random() * 1.5;
        currentCadence = 145 + Math.floor(Math.random() * 10);
      } else if (progress < 0.85) {
        // High steady effort with minor variations
        const targetHR = 158 + Math.sin(i * 0.1) * 12;
        currentHR = currentHR * 0.9 + targetHR * 0.1 + (Math.random() * 2 - 1);
        currentSpeed = 10.8 + Math.sin(i * 0.05) * 1.8;
        currentCadence = 168 + Math.floor(Math.random() * 8);
      } else {
        // Cool down
        currentHR = Math.max(92, currentHR - Math.random() * 3);
        currentSpeed = 5.0 + Math.random() * 1.2;
        currentCadence = 120 + Math.floor(Math.random() * 10);
      }

      elevation += (Math.random() - 0.48) * 0.8;

      // Heart Rate Point
      const hrPoint = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', 'HEART_RATE')
        .tag('unit', 'bpm')
        .floatField('value', Math.round(currentHR))
        .timestamp(pointTime);
      writeApi.writePoint(hrPoint);
      pointsWritten++;

      // Speed Point
      const speedPoint = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', 'SPEED')
        .tag('unit', 'km/h')
        .floatField('value', parseFloat(currentSpeed.toFixed(2)))
        .timestamp(pointTime);
      writeApi.writePoint(speedPoint);
      pointsWritten++;

      // Cadence Point
      const cadencePoint = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', 'CADENCE')
        .tag('unit', 'spm')
        .floatField('value', currentCadence)
        .timestamp(pointTime);
      writeApi.writePoint(cadencePoint);
      pointsWritten++;

      // Elevation Point
      const elevPoint = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', 'ELEVATION')
        .tag('unit', 'm')
        .floatField('value', parseFloat(elevation.toFixed(1)))
        .timestamp(pointTime);
      writeApi.writePoint(elevPoint);
      pointsWritten++;
    }

    // Add SpO2 samples (every minute)
    for (let m = 0; m < durationMinutes; m++) {
      const spo2Time = new Date(startTime + (m * 60 * 1000));
      const spo2Val = 97 + Math.floor(Math.random() * 3);
      const spo2Point = new Point('health_metric')
        .tag('userId', userId)
        .tag('deviceId', deviceId)
        .tag('metricType', 'SPO2')
        .tag('unit', '%')
        .floatField('value', spo2Val)
        .timestamp(spo2Time);
      writeApi.writePoint(spo2Point);
      pointsWritten++;
    }

    await flushWrites();

    res.status(201).json({
      message: `Successfully simulated ${durationMinutes}-minute workout in InfluxDB`,
      totalPointsWritten: pointsWritten,
      metrics: ['HEART_RATE', 'SPEED', 'CADENCE', 'ELEVATION', 'SPO2'],
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(now).toISOString()
    });
  } catch (err) {
    console.error('Simulate telemetry error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. Bridge Oracle HEALTH_METRIC to InfluxDB (Dual-write / Sync)
 * POST /api/telemetry/sync-oracle
 */
router.post('/sync-oracle', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT
         h.MetricID,
         h.DeviceID,
         h.MetricType,
         h.Value,
         h.Unit,
         h.Timestamp,
         w.UserID
       FROM HEALTH_METRIC h
       LEFT JOIN WEARABLE_DEVICE w ON h.DeviceID = w.DeviceID`
    );

    const writeApi = getWriteApi();
    let count = 0;

    for (const row of result.rows) {
      const userId = String(row.USERID || '1');
      const deviceId = String(row.DEVICEID || '1');
      const metricType = String(row.METRICTYPE || 'HEART_RATE').toUpperCase();
      const unit = String(row.UNIT || 'unit');
      const value = parseFloat(row.VALUE);
      const ts = row.TIMESTAMP ? new Date(row.TIMESTAMP) : new Date();

      if (!isNaN(value)) {
        const point = new Point('health_metric')
          .tag('userId', userId)
          .tag('deviceId', deviceId)
          .tag('metricType', metricType)
          .tag('unit', unit)
          .floatField('value', value)
          .timestamp(ts);

        writeApi.writePoint(point);
        count++;
      }
    }

    await flushWrites();

    res.json({
      message: 'Synced records from Oracle HEALTH_METRIC to InfluxDB',
      syncedRows: count
    });
  } catch (err) {
    console.error('Sync from Oracle error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

/**
 * 8. List Raw Telemetry Points for Table / CRUD View
 * GET /api/telemetry/points
 */
router.get('/points', optionalAuth, async (req, res) => {
  try {
    const queryApi = getQueryApi();
    const userId = req.query.userId || (req.user && req.user.UserID) || '1';
    const limit = parseInt(req.query.limit, 10) || 100;
    let timeRange = req.query.timeRange || '-7d';
    if (!timeRange.startsWith('-')) timeRange = `-${timeRange}`;
    const metricType = req.query.metricType ? req.query.metricType.toUpperCase() : null;

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "health_metric")
        ${metricType ? `|> filter(fn: (r) => r.metricType == "${metricType}")` : ''}
        ${userId ? `|> filter(fn: (r) => r.userId == "${userId}")` : ''}
        |> filter(fn: (r) => r._field == "value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit})
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMetadata) {
          const o = tableMetadata.toObject(row);
          results.push({
            id: `${o.metricType}_${o._time}`,
            time: o._time,
            metricType: o.metricType,
            value: o._value,
            unit: o.unit || '',
            deviceId: o.deviceId || '1',
            userId: o.userId || '1'
          });
        },
        error(err) {
          reject(err);
        },
        complete() {
          resolve();
        }
      });
    });

    res.json(results);
  } catch (err) {
    console.error('List points error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 9. Add a Single Telemetry Point to InfluxDB
 * POST /api/telemetry/points
 */
router.post('/points', optionalAuth, async (req, res) => {
  try {
    const { metricType, value, unit, timestamp, deviceId } = req.body;
    if (!metricType || value == null) {
      return res.status(400).json({ error: 'metricType and value are required' });
    }

    const userId = String((req.user && req.user.UserID) || req.body.userId || '1');
    const writeApi = getWriteApi();

    const point = new Point('health_metric')
      .tag('userId', userId)
      .tag('deviceId', String(deviceId || '1'))
      .tag('metricType', String(metricType).toUpperCase())
      .tag('unit', String(unit || ''))
      .floatField('value', parseFloat(value))
      .timestamp(timestamp ? new Date(timestamp) : new Date());

    writeApi.writePoint(point);
    await flushWrites();

    res.status(201).json({
      message: 'Telemetry point added to InfluxDB successfully'
    });
  } catch (err) {
    console.error('Add point error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 10. Edit / Update a Telemetry Point in InfluxDB
 * PUT /api/telemetry/points
 */
router.put('/points', optionalAuth, async (req, res) => {
  try {
    const {
      oldTime,
      oldMetricType,
      time,
      metricType,
      value,
      unit,
      deviceId
    } = req.body;

    if (value == null) {
      return res.status(400).json({ error: 'value is required for update' });
    }

    const userId = String((req.user && req.user.UserID) || req.body.userId || '1');

    // If old time or metric was specified, delete the previous point
    if (oldTime) {
      const targetTime = new Date(oldTime).getTime();
      const start = new Date(targetTime - 10).toISOString();
      const stop = new Date(targetTime + 10).toISOString();
      const targetMetric = (oldMetricType || metricType).toUpperCase();
      try {
        await deleteData({
          start,
          stop,
          predicate: `_measurement="health_metric" AND metricType="${targetMetric}" AND userId="${userId}"`
        });
      } catch (delErr) {
        console.warn('Influx delete prior point warning:', delErr.message);
      }
    }

    // Write updated point
    const writeApi = getWriteApi();
    const newTs = time ? new Date(time) : (oldTime ? new Date(oldTime) : new Date());
    const finalMetric = (metricType || oldMetricType).toUpperCase();

    const point = new Point('health_metric')
      .tag('userId', userId)
      .tag('deviceId', String(deviceId || '1'))
      .tag('metricType', finalMetric)
      .tag('unit', String(unit || ''))
      .floatField('value', parseFloat(value))
      .timestamp(newTs);

    writeApi.writePoint(point);
    await flushWrites();

    res.json({
      message: 'Telemetry point updated in InfluxDB successfully'
    });
  } catch (err) {
    console.error('Update point error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 11. Delete a Telemetry Point from InfluxDB
 * DELETE /api/telemetry/points
 */
router.delete('/points', optionalAuth, async (req, res) => {
  try {
    const time = req.body.time || req.query.time;
    const metricType = (req.body.metricType || req.query.metricType || '').toUpperCase();
    const userId = String((req.user && req.user.UserID) || req.body.userId || req.query.userId || '1');

    if (!time || !metricType) {
      return res.status(400).json({ error: 'time and metricType are required to delete a point' });
    }

    const targetTime = new Date(time).getTime();
    const start = new Date(targetTime - 10).toISOString();
    const stop = new Date(targetTime + 10).toISOString();

    await deleteData({
      start,
      stop,
      predicate: `_measurement="health_metric" AND metricType="${metricType}" AND userId="${userId}"`
    });

    res.json({
      message: 'Telemetry point deleted from InfluxDB successfully'
    });
  } catch (err) {
    console.error('Delete point error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
