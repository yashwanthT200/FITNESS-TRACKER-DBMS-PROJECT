const { Point, getWriteApi, getQueryApi, checkInfluxHealth, flushWrites, bucket } = require('../config/influx');

async function seedInflux() {
  console.log('--- Starting InfluxDB Time-Series Seeding ---');
  const health = await checkInfluxHealth();
  console.log(`InfluxDB Status: ${health.status}`);

  if (health.status !== 'healthy') {
    console.warn(`InfluxDB returned non-healthy response (${health.status}). Proceeding to attempt write...`);
  }

  const writeApi = getWriteApi();
  const now = Date.now();
  const hours = 48; // Seed 48 hours of wearable data
  const intervalSeconds = 30; // 1 data point every 30 seconds
  const totalSteps = (hours * 3600) / intervalSeconds;

  console.log(`Generating ~${totalSteps * 4} time-series points across 48 hours for UserID: 1 (Smartwatch)...`);

  let count = 0;
  const startTime = now - (hours * 3600 * 1000);

  for (let i = 0; i < totalSteps; i++) {
    const timestamp = new Date(startTime + (i * intervalSeconds * 1000));
    const hourOfDay = timestamp.getHours();

    // Circadian rhythm simulation:
    // Sleep (23:00 - 07:00): HR 50-65 bpm
    // Day/Active (07:00 - 23:00): HR 70-110 bpm, with workout spikes up to 165 bpm
    let baseHR = 72;
    if (hourOfDay >= 23 || hourOfDay < 7) {
      baseHR = 55 + Math.sin(i * 0.05) * 5;
    } else if (hourOfDay >= 17 && hourOfDay <= 18) {
      // Workout hour
      baseHR = 145 + Math.sin(i * 0.1) * 20;
    } else {
      baseHR = 75 + Math.sin(i * 0.02) * 15;
    }

    const hrVal = Math.round(Math.max(48, baseHR + (Math.random() * 6 - 3)));
    const hrPoint = new Point('health_metric')
      .tag('userId', '1')
      .tag('deviceId', '1')
      .tag('metricType', 'HEART_RATE')
      .tag('unit', 'bpm')
      .floatField('value', hrVal)
      .timestamp(timestamp);
    writeApi.writePoint(hrPoint);
    count++;

    // SpO2 (every 5 min)
    if (i % 10 === 0) {
      const spo2Val = 97 + Math.floor(Math.random() * 3);
      const spo2Point = new Point('health_metric')
        .tag('userId', '1')
        .tag('deviceId', '1')
        .tag('metricType', 'SPO2')
        .tag('unit', '%')
        .floatField('value', spo2Val)
        .timestamp(timestamp);
      writeApi.writePoint(spo2Point);
      count++;
    }

    // Steps & Speed during workout hour
    if (hourOfDay >= 17 && hourOfDay <= 18) {
      const speedVal = parseFloat((9.5 + Math.sin(i * 0.08) * 2.5).toFixed(2));
      const speedPoint = new Point('health_metric')
        .tag('userId', '1')
        .tag('deviceId', '1')
        .tag('metricType', 'SPEED')
        .tag('unit', 'km/h')
        .floatField('value', speedVal)
        .timestamp(timestamp);
      writeApi.writePoint(speedPoint);
      count++;

      const cadenceVal = 165 + Math.floor(Math.random() * 15);
      const cadencePoint = new Point('health_metric')
        .tag('userId', '1')
        .tag('deviceId', '1')
        .tag('metricType', 'CADENCE')
        .tag('unit', 'spm')
        .floatField('value', cadenceVal)
        .timestamp(timestamp);
      writeApi.writePoint(cadencePoint);
      count++;
    }
  }

  console.log(`Flushing ${count} points to InfluxDB bucket '${bucket}'...`);
  await flushWrites();
  console.log(`Successfully seeded ${count} biometric time-series points into InfluxDB!`);

  // Quick verification query with downsampling
  console.log('\nRunning test downsampling query (aggregateWindow every 1h, fn: mean)...');
  const queryApi = getQueryApi();
  const testFlux = `
    from(bucket: "${bucket}")
      |> range(start: -48h)
      |> filter(fn: (r) => r._measurement == "health_metric" and r.metricType == "HEART_RATE" and r.userId == "1")
      |> aggregateWindow(every: 2h, fn: mean, createEmpty: false)
      |> limit(n: 5)
  `;

  await new Promise((resolve) => {
    queryApi.queryRows(testFlux, {
      next(row, tableMetadata) {
        const o = tableMetadata.toObject(row);
        console.log(`[InfluxDB Query Result] Time: ${o._time} | Metric: ${o.metricType} | 2h Avg: ${Math.round(o._value)} ${o.unit}`);
      },
      error(err) {
        console.warn('Test query error (InfluxDB might still be initializing):', err.message);
        resolve();
      },
      complete() {
        console.log('Test query completed successfully.');
        resolve();
      }
    });
  });

  process.exit(0);
}

seedInflux().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
