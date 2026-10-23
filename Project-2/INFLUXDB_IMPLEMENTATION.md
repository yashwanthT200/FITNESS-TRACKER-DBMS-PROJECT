# ⚡ InfluxDB Time-Series Implementation & Academic Justification

> **Project:** FitTrack (Garmin Clone)  
> **Course:** Database Management Systems (Advanced Database Extension)  
> **Chosen Category:** Time-Series Database (TSDB)  
> **Technology:** InfluxDB 2.x  

---

## 1. Executive Summary & Problem Statement

FitTrack is an enterprise-grade fitness tracking platform emulating wearable ecosystems like **Garmin Connect, Strava, and Apple Health**. 

In fitness tracking, workloads naturally divide into two distinct tiers:
1. **Relational / Transactional Data:** User accounts, authentication credentials, trainer-athlete supervision contracts, nutrition logs, and goals. This data requires ACID guarantees, normalized relational schemas, and foreign-key integrity (managed via **Oracle Database**).
2. **High-Frequency Wearable Telemetry:** Smartwatches and fitness bands emit continuous biometric sensor streams (Heart Rate, Blood Oxygen/SpO2, Cadence, GPS Pace/Speed, Elevation) every **1 to 5 seconds**. 

Storing continuous sensor streams in traditional relational databases (such as Oracle or MySQL) creates severe architectural bottlenecks:
* **Write Lock Contention & B-Tree Fragmentation:** Every second, thousands of sensor samples trigger random writes to B-Tree indexes and redo logs.
* **Storage Bloat:** Normalized RDBMS tables store repetitive column headers and timestamps with no compression on repeated temporal keys.
* **Lack of Automated Downsampling & Lifecycle Policies:** Displaying a 6-month resting heart rate trend does not require 1-second raw precision. In Oracle, aggregating and pruning billions of rows requires costly PL/SQL cron jobs, triggers, and table locks.

To solve this, we implemented **Polyglot Persistence**, augmenting Oracle with **InfluxDB**, the industry-standard time-series database.

---

## 2. Polyglot Architecture

```
                       ┌─────────────────────────────────────────┐
                       │           FitTrack Frontend             │
                       │    (React 19, Vite, Recharts UI)        │
                       └────────────────────┬────────────────────┘
                                            │ REST API (Axios)
                       ┌────────────────────▼────────────────────┐
                       │          Express.js Backend             │
                       │     (Node.js 24 + InfluxDB SDK)         │
                       └───────────┬───────────────────┬─────────┘
                                   │                   │
         Relational Transactions   │                   │ High-Frequency Telemetry
         (ACID, Users, Auth,       │                   │ (Append-Only Time-Series,
          Goals, Nutrition)        │                   │  Downsampling, Aggregation)
                                   │                   │
                      ┌────────────▼──────┐     ┌──────▼────────────┐
                      │    Oracle DB      │     │    InfluxDB 2.x   │
                      │ (Container Free)  │     │   (Docker Engine) │
                      │  Port: 1521/1522  │     │     Port: 8086    │
                      └───────────────────┘     └───────────────────┘
```

---

## 3. Advantages of InfluxDB Over Traditional Relational Databases

| Dimension | Traditional Relational DB (Oracle / MySQL) | InfluxDB (Time-Series Database) |
| :--- | :--- | :--- |
| **Storage Engine** | B-Tree / Heap tables (optimized for random reads/updates) | **Time-Structured Merge (TSM) Tree & Columnar Store** (optimized for sequential, append-only time-ordered writes) |
| **Write Performance** | Suffers from write amplification, index re-balancing, and WAL locking on streaming sensor data | **10x to 100x higher ingestion throughput**; writes append sequentially to in-memory buffers before flushing to immutable TSM blocks |
| **Data Compression** | Generic row compression (typically 1.5x–2x) | **Gorilla Encoding**: Double-delta timestamp encoding + XOR floating-point compression (**80%–90% storage reduction**) |
| **Downsampling** | Requires manual PL/SQL scheduled procedures, batch deletion scripts, and temporary summary tables | **Native Windowing & Rollups**: Single Flux operator `aggregateWindow(every: 5m, fn: mean)` executes in milliseconds |
| **Data Retention** | Manual `DELETE FROM table WHERE timestamp < ...` which causes table locks and tablespace fragmentation | **Automated Retention Policies (RPs)**: Buckets drop expired time shards instantly at the filesystem block level |
| **Query Semantics** | Complex SQL window functions (`OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN)`) | Purpose-built time-range filters and temporal aggregation functions |

---

## 4. InfluxDB Data Model in FitTrack

In InfluxDB, data points are modeled using **Line Protocol**:
```
<measurement>,<tag_set> <field_set> <timestamp>
```

### Schema Mapping
* **Measurement:** `health_metric`
* **Tags (Indexed for rapid filtering):**
  * `userId`: ID of the athlete (e.g. `1`)
  * `deviceId`: ID of the Garmin smartwatch (e.g. `1`)
  * `metricType`: Sensor type (`HEART_RATE`, `SPEED`, `CADENCE`, `ELEVATION`, `SPO2`)
  * `unit`: Measurement unit (`bpm`, `km/h`, `spm`, `m`, `%`)
* **Fields (Non-indexed actual floating-point measurements):**
  * `value`: Sensor reading (e.g. `158.4`)
* **Timestamp:** Nanosecond or millisecond Unix timestamp

### Example Influx Line Protocol Record:
```text
health_metric,userId=1,deviceId=1,metricType=HEART_RATE,unit=bpm value=162.0 1729302600000000000
```

---

## 5. Implementation Details

### A. Docker Setup (`docker-compose.yml`)
InfluxDB 2.7 runs as an integrated service alongside Oracle, backend, and frontend:
```yaml
  influxdb:
    image: influxdb:2.7-alpine
    container_name: fittrack-influxdb
    ports:
      - "8086:8086"
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=fittrack_admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=FitTrackInflux2026!
      - DOCKER_INFLUXDB_INIT_ORG=FitTrackOrg
      - DOCKER_INFLUXDB_INIT_BUCKET=telemetry
      - DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=fittrack-super-secret-admin-token-2026
    volumes:
      - influxdb_data:/var/lib/influxdb2
```

### B. Backend API Endpoints (`/api/telemetry`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/telemetry/health` | Health check and InfluxDB engine status |
| `POST` | `/api/telemetry` | Ingest single or batch telemetry points |
| `GET` | `/api/telemetry/query` | Time-bucket downsampled query (`?metricType=HEART_RATE&timeRange=24h&window=5m&fn=mean`) |
| `GET` | `/api/telemetry/raw` | Query latest raw points without downsampling |
| `GET` | `/api/telemetry/stats` | Real-time aggregate statistics (latest, peak, average, sample count) |
| `POST` | `/api/telemetry/simulate` | Simulates a 30-minute running workout emitting 1,800+ biometric data points |
| `POST` | `/api/telemetry/sync-oracle`| Dual-write bridge syncing historical records from Oracle `HEALTH_METRIC` |

### C. Downsampling Flux Query Example
```flux
from(bucket: "telemetry")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "health_metric")
  |> filter(fn: (r) => r.metricType == "HEART_RATE")
  |> filter(fn: (r) => r.userId == "1")
  |> filter(fn: (r) => r._field == "value")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> yield(name: "mean_values")
```

---

## 6. How to Run & Demonstrate

### 1. Launching via Docker
```bash
docker compose up -d
```
* **Frontend:** http://localhost:5173
* **Backend:** http://localhost:5000
* **InfluxDB Web UI:** http://localhost:8086 (User: `fittrack_admin` / Password: `FitTrackInflux2026!`)

### 2. Standalone / Local Run (without Docker)
If running InfluxDB locally:
```bash
# In backend directory:
npm run start

# Seed 48 hours of high-frequency data into InfluxDB:
npm run db:seed:influx
```

### 3. Demonstrating to Faculty
1. Navigate to **Fitness Connect** in the browser.
2. Click **"Telemetry (InfluxDB)"** in the sidebar.
3. Click **"Simulate Live Workout"**: Watch 1,800 points generated and saved into InfluxDB within seconds.
4. Toggle downsampling windows (`10s`, `1m`, `5m`, `1h`) to demonstrate how InfluxDB aggregates millions of points on the fly.
5. Click **"Sync from Oracle"** to show how legacy relational rows are smoothly migrated into the time-series engine.


## Zepp data-export import (manual upload -> InfluxDB)

Use this when the automated Zepp sync is unavailable. In the Zepp app / account privacy page choose **Export data**;
you get a password-protected .zip by email.

- UI: **Zepp E Sync** page -> "Import Zepp data export". Choose the .zip (or its .csv files), enter the zip password, **Preview**, then **Import to InfluxDB**.
- API: `POST /api/zepp/import?tz=330[&dryRun=1][&userId=...]`
  - zip upload: body = the zip (`Content-Type: application/zip`), password in the `x-zip-password` header
  - loose CSVs: JSON `{ "files": [{ "name": "ACTIVITY/ACTIVITY_1.csv", "text": "..." }] }`
  - `tz` = minutes ahead of UTC of the export's local times (IST = 330; the UI sends the browser's value)
- Measurements: `health_metric`, `source=zepp_cloud`. Metrics: STEPS, CALORIES, DISTANCE (daily), STEPS_MINUTE, HEART_RATE,
  SLEEP_TOTAL/DEEP/REM, WEIGHT, BMI, BODY_FAT, BODY_WATER, MUSCLE_RATE, VISCERAL_FAT, WORKOUT_DISTANCE/CALORIES/DURATION.
- Re-importing the same export overwrites identical points (no duplicates). After writing, the API queries InfluxDB and
  returns per-metric counts; write failures are reported instead of being silently ignored.
- Code: `backend/services/aesZip.js` (WinZip-AES reader, no extra deps), `backend/services/zeppImport.js` (CSV -> points).
