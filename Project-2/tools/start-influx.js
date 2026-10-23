const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const influxDir = path.join(__dirname, 'influxdb');
const influxExe = path.join(influxDir, 'influxd.exe');
const enginePath = path.join(influxDir, 'data', 'engine');
const boltPath = path.join(influxDir, 'data', 'influxd.bolt');

// Ensure data dir exists
fs.mkdirSync(path.join(influxDir, 'data'), { recursive: true });

console.log('========================================================');
console.log('   Starting InfluxDB v2.7 (Native Windows Mode)         ');
console.log('========================================================');
console.log(`Binary: ${influxExe}`);
console.log(`Port:   http://localhost:8086`);
console.log('');

const influxProcess = spawn(influxExe, [
  `--engine-path=${enginePath}`,
  `--bolt-path=${boltPath}`
], {
  stdio: ['ignore', 'pipe', 'pipe']
});

influxProcess.stdout.on('data', (data) => {
  const line = data.toString().trim();
  // Filter out noise, log important startup markers
  if (line.includes('Listening') || line.includes('msg=') || line.includes('starting')) {
    console.log(`[InfluxDB] ${line.slice(0, 140)}`);
  }
});

influxProcess.stderr.on('data', (data) => {
  console.error(`[InfluxDB Error] ${data.toString().trim()}`);
});

influxProcess.on('close', (code) => {
  console.log(`InfluxDB process exited with code ${code}`);
  process.exit(code || 0);
});

// Setup Initial Org, Bucket, and Admin Token
async function setupInflux() {
  const setupUrl = 'http://localhost:8086/api/v2/setup';
  const healthUrl = 'http://localhost:8086/health';

  // Wait for health endpoint
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        break;
      }
    } catch {
      // Waiting for server to boot
    }
  }

  try {
    // Check if onboarding is required
    const checkRes = await fetch(setupUrl);
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.allowed) {
        console.log('Performing first-time setup for FitTrackOrg & telemetry bucket...');
        const initRes = await fetch(setupUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'fittrack_admin',
            password: 'FitTrackInflux2026!',
            org: 'FitTrackOrg',
            bucket: 'telemetry',
            token: 'fittrack-super-secret-admin-token-2026'
          })
        });

        if (initRes.ok) {
          console.log('First-time setup completed successfully!');
        } else {
          const err = await initRes.text();
          console.log(`Setup response: ${err}`);
        }
      } else {
        console.log('InfluxDB is already initialized and ready.');
      }
    }
    console.log('========================================================');
    console.log('  InfluxDB is ONLINE and ready for FitTrack telemetry!   ');
    console.log('  UI: http://localhost:8086                              ');
    console.log('  User: fittrack_admin / Token configured                ');
    console.log('========================================================');
  } catch (err) {
    console.error('Error during setup check:', err.message);
  }
}

setupInflux();

process.on('SIGINT', () => {
  console.log('\nShutting down InfluxDB...');
  influxProcess.kill();
});
