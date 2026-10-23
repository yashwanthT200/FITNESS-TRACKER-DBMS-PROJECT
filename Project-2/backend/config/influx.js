const { InfluxDB, Point } = require('@influxdata/influxdb-client');
require('dotenv').config();

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || 'fittrack-super-secret-admin-token-2026';
const org = process.env.INFLUX_ORG || 'FitTrackOrg';
const bucket = process.env.INFLUX_BUCKET || 'telemetry';

let influxDB = null;
let writeApi = null;
let queryApi = null;

function getInfluxClient() {
  if (!influxDB) {
    influxDB = new InfluxDB({ url, token });
  }
  return influxDB;
}

function getWriteApi() {
  if (!writeApi) {
    const client = getInfluxClient();
    // Default precision is nanoseconds ('ns')
    writeApi = client.getWriteApi(org, bucket, 'ns', {
      batchSize: 10,
      flushInterval: 5000,
      maxBufferLines: 5000,
      maxRetries: 3
    });
  }
  return writeApi;
}

function getQueryApi() {
  if (!queryApi) {
    const client = getInfluxClient();
    queryApi = client.getQueryApi(org);
  }
  return queryApi;
}

async function checkInfluxHealth() {
  try {
    const fetch = globalThis.fetch;
    if (fetch) {
      const res = await fetch(`${url}/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        return { status: 'healthy', data };
      }
    }
    return { status: 'unknown', url };
  } catch (err) {
    return { status: 'unreachable', error: err.message, url };
  }
}

async function flushWrites() {
  if (writeApi) {
    try {
      await writeApi.flush();
    } catch (err) {
      console.error('Error flushing InfluxDB writes:', err.message);
    }
  }
}

async function deleteData({ start, stop, predicate }) {
  const deleteUrl = `${url}/api/v2/delete?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}`;
  const body = {
    start: start || '1970-01-01T00:00:00Z',
    stop: stop || '2050-01-01T00:00:00Z'
  };
  if (predicate) {
    body.predicate = predicate;
  }
  const res = await fetch(deleteUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`InfluxDB delete failed (${res.status}): ${text}`);
  }
  return true;
}

module.exports = {
  url,
  org,
  bucket,
  token,
  Point,
  getInfluxClient,
  getWriteApi,
  getQueryApi,
  checkInfluxHealth,
  flushWrites,
  deleteData
};
