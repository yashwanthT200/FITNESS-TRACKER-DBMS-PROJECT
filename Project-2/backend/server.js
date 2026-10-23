const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./config/database');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const apiRoutes = require('./routes/api');
const telemetryRoutes = require('./routes/telemetry');
const zeppRoutes = require('./routes/zepp');
const { checkInfluxHealth } = require('./config/influx');

app.use('/api', apiRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/zepp', zeppRoutes);

app.get('/', (req, res) => {
  res.send('FitTrack API with InfluxDB Time-Series Telemetry is running');
});

async function startServer() {
  try {
    await initializeDatabase();

    // Check InfluxDB connection status
    checkInfluxHealth().then((health) => {
      if (health.status === 'healthy') {
        console.log(`InfluxDB connected successfully at ${process.env.INFLUX_URL || 'http://localhost:8086'}`);
      } else {
        console.log(`InfluxDB status: ${health.status} (${health.url || 'configured URL'}). Real-time telemetry endpoints ready.`);
      }
    }).catch(err => {
      console.warn(`InfluxDB check warning: ${err.message}`);
    });

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();