// FitTrack Server Entry Point
// Forwards execution to the complete backend (Oracle DB + InfluxDB + Zepp Sync)
const { fork } = require('child_process');
const path = require('path');

const backendServer = path.resolve(__dirname, 'backend', 'server.js');
const backendCwd = path.resolve(__dirname, 'backend');

console.log('Starting FitTrack backend from backend/server.js...');

const child = fork(backendServer, process.argv.slice(2), {
  cwd: backendCwd,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit(0);
});

