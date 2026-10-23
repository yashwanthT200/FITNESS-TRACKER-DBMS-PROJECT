const express = require('express');
const router = express.Router();
const { Point, getWriteApi, getQueryApi, flushWrites, bucket, url: influxUrl, org: influxOrg, token: influxToken } = require('../config/influx');

/**
 * FitTrack Zepp Cloud Sync - Reads real health data from Zepp's API
 * Uses apptoken + userid extracted from user.huami.com browser cookies
 * Endpoints reverse-engineered from Zepp iOS/Android app network traffic
 */

// Regional API hosts (Zepp routes users to different servers by region)
const ZEPP_REGIONAL_HOSTS = {
  'eu':  'api-mifit-eu2.zepp.com',
  'us':  'api-mifit-us3.zepp.com',
  'cn':  'api-mifit.zepp.com',
  'in':  'api-mifit-in.zepp.com',
  'auto': 'api-mifit-us3.zepp.com'  // default fallback
};

// -----------------------------------------------------------------------
// Internal helper: call the Zepp API with apptoken + userid auth
// -----------------------------------------------------------------------
async function zeppGet(host, path, appToken, userId, extraParams = {}, { includeUserId = true } = {}) {
  // Drop null/undefined params: Zepp rejects e.g. "device_type is null"
  const clean = {};
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== null && v !== undefined && v !== '') clean[k] = String(v);
  }
  const params = new URLSearchParams(includeUserId ? { userid: userId, ...clean } : clean);
  const url = `https://${host}${path}?${params}`;

  const headers = {
    'apptoken': appToken,
    'Accept': 'application/json',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; Zepp Life)'
  };

  const res = await fetch(url, { headers, method: 'GET', signal: AbortSignal.timeout(20000) });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${host}${path}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Non-JSON response from ${host}${path}: ${text.slice(0, 120)}`);
  }
}

// -----------------------------------------------------------------------
// Helper: Determine regional host from token/userid heuristic
// -----------------------------------------------------------------------
function resolveHost(region) {
  return ZEPP_REGIONAL_HOSTS[region] || ZEPP_REGIONAL_HOSTS['auto'];
}

// -----------------------------------------------------------------------
// Helper: Write points to InfluxDB
// -----------------------------------------------------------------------
async function writeToInflux(points) {
  if (!points || points.length === 0) return 0;
  const writeApi = getWriteApi();
  for (const p of points) {
    writeApi.writePoint(p);
  }
  await flushWrites();
  return points.length;
}

// -----------------------------------------------------------------------
// Helper: local (not UTC) YYYY-MM-DD so Indian users don't get "yesterday"
// -----------------------------------------------------------------------
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// Candidate hosts for a region, most specific first, de-duplicated
function candidateHosts(host, { huami = false } = {}) {
  const list = huami
    ? [host.replace('.zepp.com', '.huami.com'), 'api-mifit.huami.com', host, 'api-mifit.zepp.com']
    : [host, host.replace('.huami.com', '.zepp.com'), 'api-mifit.zepp.com', 'api-mifit-de2.zepp.com', 'api-mifit-us3.zepp.com'];
  return [...new Set(list)];
}

// -----------------------------------------------------------------------
// Helper: band_data with host + device_type fallback.
// device_type is ALWAYS sent (the API 400s when it is missing).
// Every failure is collected so the real cause is reported, not just the last try.
// -----------------------------------------------------------------------
async function getBandDataWithFallback(host, appToken, uid, fromDateStr, toDateStr) {
  const hosts = candidateHosts(host, { huami: true });
  const deviceTypes = ['android_phone', 'ios_phone', '0'];
  const failures = [];
  let emptyOk = null;

  for (const h of hosts) {
    for (const dt of deviceTypes) {
      try {
        const res = await zeppGet(h, '/v1/data/band_data.json', appToken, uid, {
          query_type: 'detail',
          device_type: dt,
          from_date: fromDateStr,
          to_date: toDateStr
        });

        // Zepp sometimes returns HTTP 200 with {code: <non-1>, message}
        if (res && res.code !== undefined && Number(res.code) !== 1 && !res.data) {
          throw new Error(`API code ${res.code}: ${res.message || 'unknown'}`);
        }

        const dataList = res?.data || res?.items || (Array.isArray(res) ? res : null);
        if (Array.isArray(dataList) && dataList.length > 0) {
          console.log(`[Zepp] ${dataList.length} band records from ${h} (device_type=${dt})`);
          return { data: dataList, host: h };
        }
        if (Array.isArray(dataList)) emptyOk = { data: [], host: h };
        break; // this host answered fine; no need to try other device types
      } catch (e) {
        failures.push(`${h} [${dt}] -> ${e.message}`);
      }
    }
  }

  if (emptyOk) return emptyOk; // authenticated fine, just no data in range
  console.error('[Zepp] band_data failed on all hosts:\n' + failures.join('\n'));
  throw new Error(`band_data failed on all hosts. First error: ${failures[0] || 'n/a'}`);
}

// -----------------------------------------------------------------------
// Helper: /users/:uid/events (stress, blood_oxygen, ...).
// Matches the working reference script: only from/to (ms, at local midnight),
// eventType, limit, timeZone. No userid query param, no extra params
// (extra params make the server answer 500 "Failed to process the request").
// -----------------------------------------------------------------------
async function getEvents(host, appToken, uid, eventType, fromDate, toDate) {
  const from = localMidnight(fromDate).getTime();
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999).getTime();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const failures = [];

  for (const h of candidateHosts(host)) {
    try {
      const res = await zeppGet(h, `/users/${uid}/events`, appToken, uid, {
        from, to, eventType, limit: 1000, timeZone: tz
      }, { includeUserId: false });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(items) ? items : [];
    } catch (e) {
      failures.push(`${h} -> ${e.message}`);
    }
  }
  throw new Error(`${eventType} events failed. First error: ${failures[0]}`);
}

// -----------------------------------------------------------------------
// 0. GET /api/zepp/ping  (proves which code is running)
// -----------------------------------------------------------------------
console.log('[Zepp] routes loaded: version 2 (multi-host band_data + fixed events)');
router.get('/ping', (req, res) => res.json({ zeppRoutesVersion: 2, file: __filename, pid: process.pid }));

// -----------------------------------------------------------------------
// 0b. POST /api/zepp/login  { email, password }
// The browser-cookie "apptoken" from user.huami.com is a *web* token and the
// band_data/events APIs reject it with HTTP 500 / -50000. This performs the
// same login the Zepp/Mi Fit app does (see scripts/mifit_ref.py) to obtain a
// real app_token + user_id. Credentials are used once and never stored.
// -----------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Stage 1: email/password -> access code (returned in a redirect Location header)
    const r1 = await fetch(`https://api-user.huami.com/registrations/${encodeURIComponent(email)}/tokens`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        state: 'REDIRECTION',
        client_id: 'HuaMi',
        redirect_uri: 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
        token: 'access',
        password
      }),
      signal: AbortSignal.timeout(20000)
    });
    const loc = r1.headers.get('location');
    if (!loc) {
      const body = (await r1.text()).slice(0, 200);
      return res.status(401).json({ error: `Login rejected (HTTP ${r1.status}). Wrong email/password, or this account uses Google/Apple/Mi sign-in. ${body}` });
    }
    const q = new URL(loc).searchParams;
    const access = q.get('access');
    const countryCode = q.get('country_code');
    if (!access) {
      return res.status(401).json({ error: `No access token in login response (${q.get('error') || 'unknown error'})` });
    }

    // Stage 2: access code -> app_token + user_id
    const r2 = await fetch('https://account.huami.com/v2/client/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_name: 'com.xiaomi.hm.health',
        dn: 'account.huami.com,api-user.huami.com,api-watch.huami.com,api-analytics.huami.com,app-analytics.huami.com,api-mifit.huami.com',
        device_id: '02:00:00:00:00:00',
        device_model: 'android_phone',
        app_version: '4.0.9',
        allow_registration: 'false',
        third_name: 'huami',
        grant_type: 'access_token',
        country_code: countryCode || '',
        code: access
      }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await r2.json();
    const ti = data?.token_info;
    if (!ti?.app_token || !ti?.user_id) {
      return res.status(401).json({ error: `Login stage 2 failed: ${JSON.stringify(data).slice(0, 200)}` });
    }
    res.json({ appToken: ti.app_token, userId: String(ti.user_id), countryCode });
  } catch (err) {
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// -----------------------------------------------------------------------
// 1. GET /api/zepp/validate
// Validates that the provided apptoken and userid are working
// -----------------------------------------------------------------------
router.post('/validate', async (req, res) => {
  try {
    const { appToken, userId, region = 'auto' } = req.body;
    if (!appToken || !userId) {
      return res.status(400).json({ error: 'appToken and userId are required' });
    }

    const host = resolveHost(region);
    const data = await zeppGet(host, '/huami.health.getUserInfo.json', appToken, userId);

    // getUserInfo answers 200 even for web-session tokens, so also prove the token
    // can read real data. Otherwise the UI says "Connected" and every sync 500s.
    const today = localDateStr(new Date());
    try {
      await getBandDataWithFallback(host, appToken, String(userId), today, today);
    } catch (e) {
      return res.status(401).json({
        valid: false,
        error: 'Token is accepted by the profile endpoint but rejected by the data API (HTTP 500 / -50000). ' +
               'The user.huami.com cookie is a web token. Use "Login with Zepp email & password" below to get a real app token.'
      });
    }

    // Extract user info
    const profile = data?.data?.id ? data.data : (data?.user || data);

    res.json({
      valid: true,
      host,
      userId,
      displayName: profile?.display_name || profile?.nick_name || 'Zepp User',
      profileIcon: profile?.icon || null,
      region
    });
  } catch (err) {
    res.status(401).json({
      valid: false,
      error: `Token validation failed: ${err.message}`,
      hint: 'Make sure to copy apptoken and userid from user.huami.com cookies'
    });
  }
});

// -----------------------------------------------------------------------
// 2. POST /api/zepp/sync
// Full sync: fetches health metrics from Zepp API and writes to InfluxDB
// Uses Huami band_data.json (steps, sleep, calories, continuous HR) and events
// -----------------------------------------------------------------------
router.post('/sync', async (req, res) => {
  try {
    const { appToken, userId, region = 'auto', days = 7 } = req.body;

    if (!appToken || !userId) {
      return res.status(400).json({ error: 'appToken and userId are required' });
    }

    const host = resolveHost(region);
    const uid = String(userId);
    const results = {
      synced: {},
      errors: {},
      total: 0
    };

    const numDays = Math.max(1, Math.min(Number(days) || 7, 30));
    const now = new Date();
    const toDateStr = localDateStr(now);
    const fromDate = new Date(now.getTime() - (numDays - 1) * 86400000);
    const fromDateStr = localDateStr(fromDate);

    // ── 1. BAND DATA: Steps, Distance, Calories, Sleep, Continuous Heart Rate ──
    try {
      const bandRes = await getBandDataWithFallback(host, appToken, uid, fromDateStr, toDateStr);

      const items = bandRes?.data || [];
      const hrPoints = [];
      const dailyPoints = [];
      const sleepPoints = [];

      for (const day of items) {
        const dateStr = day.date_time || day.date;
        if (!dateStr) continue;

        // 1a. Parse Summary (Steps, Calories, Distance, Sleep)
        if (day.summary) {
          try {
            let summary = null;
            if (typeof day.summary === 'string') {
              try {
                summary = JSON.parse(Buffer.from(day.summary, 'base64').toString('utf8'));
              } catch (_) {
                summary = JSON.parse(day.summary);
              }
            } else if (typeof day.summary === 'object') {
              summary = day.summary;
            }

            if (summary) {
              const dayTs = new Date(`${dateStr}T23:59:00`);

              // Steps, Calories, Distance
              if (summary.stp) {
                if (summary.stp.ttl != null) {
                  dailyPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'STEPS')
                      .tag('unit', 'steps')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.stp.ttl))
                      .timestamp(dayTs)
                  );
                }
                if (summary.stp.cal != null) {
                  dailyPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'CALORIES')
                      .tag('unit', 'kcal')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.stp.cal))
                      .timestamp(dayTs)
                  );
                }
                if (summary.stp.dis != null) {
                  dailyPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'DISTANCE')
                      .tag('unit', 'm')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.stp.dis))
                      .timestamp(dayTs)
                  );
                }
              }

              // Resting HR
              const rhr = summary.rhr || summary.resting_heart_rate || summary.resting_hr;
              if (rhr != null && Number(rhr) > 30) {
                dailyPoints.push(
                  new Point('health_metric')
                    .tag('userId', uid)
                    .tag('deviceId', 'zepp_e')
                    .tag('metricType', 'RESTING_HR')
                    .tag('unit', 'bpm')
                    .tag('source', 'zepp_cloud')
                    .floatField('value', Number(rhr))
                    .timestamp(new Date(`${dateStr}T06:00:00Z`))
                );
              }

              // Sleep (Deep, REM, Light, Total)
              if (summary.slp) {
                const slpStart = summary.slp.st ? new Date(summary.slp.st * 1000) : new Date(`${dateStr}T08:00:00Z`);
                if (summary.slp.dp != null) {
                  sleepPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'SLEEP_DEEP')
                      .tag('unit', 'min')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.slp.dp))
                      .timestamp(slpStart)
                  );
                }
                if (summary.slp.rem != null) {
                  sleepPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'SLEEP_REM')
                      .tag('unit', 'min')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.slp.rem))
                      .timestamp(slpStart)
                  );
                }
                const totalSleep = (summary.slp.dp || 0) + (summary.slp.lt || 0) + (summary.slp.rem || 0);
                if (totalSleep > 0) {
                  sleepPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'SLEEP_TOTAL')
                      .tag('unit', 'min')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(totalSleep))
                      .timestamp(slpStart)
                  );
                }
                if (summary.slp.score != null) {
                  sleepPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'SLEEP_SCORE')
                      .tag('unit', 'score')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', Number(summary.slp.score))
                      .timestamp(slpStart)
                  );
                }
              }
            }
          } catch (e) {
            console.warn(`Summary parse warning for ${dateStr}:`, e.message);
          }
        }

        // 1b. Parse Continuous Heart Rate (data_hr blob)
        if (day.data_hr) {
          try {
            const hrBuf = Buffer.from(day.data_hr, 'base64');
            const dayStartMs = new Date(`${dateStr}T00:00:00`).getTime();

            if (hrBuf.length >= 2880) {
              // 2 bytes per minute
              for (let m = 0; m < 1440; m++) {
                const bpm = hrBuf.readUInt16BE ? hrBuf.readUInt16BE(m * 2) : (hrBuf[m * 2] << 8) | hrBuf[m * 2 + 1];
                if (bpm > 35 && bpm < 200) {
                  hrPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'HEART_RATE')
                      .tag('unit', 'bpm')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', bpm)
                      .timestamp(new Date(dayStartMs + m * 60 * 1000))
                  );
                }
              }
            } else {
              // 1 byte per minute
              for (let m = 0; m < hrBuf.length; m++) {
                const bpm = hrBuf[m];
                if (bpm > 35 && bpm < 200) {
                  hrPoints.push(
                    new Point('health_metric')
                      .tag('userId', uid)
                      .tag('deviceId', 'zepp_e')
                      .tag('metricType', 'HEART_RATE')
                      .tag('unit', 'bpm')
                      .tag('source', 'zepp_cloud')
                      .floatField('value', bpm)
                      .timestamp(new Date(dayStartMs + m * 60 * 1000))
                  );
                }
              }
            }
          } catch (e) {
            console.warn(`Heart rate parse warning for ${dateStr}:`, e.message);
          }
        }
      }

      if (dailyPoints.length > 0) {
        const c = await writeToInflux(dailyPoints);
        results.synced.daily = c;
        results.total += c;
      }
      if (sleepPoints.length > 0) {
        const c = await writeToInflux(sleepPoints);
        results.synced.sleep = c;
        results.total += c;
      }
      if (hrPoints.length > 0) {
        const c = await writeToInflux(hrPoints);
        results.synced.heartRate = c;
        results.total += c;
      }
    } catch (e) {
      results.errors.bandData = e.message;
    }

    // ── 2. STRESS (via /users/:uid/events) ──────────────────────────────
    try {
      const items = await getEvents(host, appToken, uid, 'all_day_stress', fromDate, now);
      const stressPoints = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const val = item.avgStress || item.current_stress_level || item.stress || item.value;
          const ts = item.timestamp || item.time || item.date_time;
          if (val != null && ts) {
            stressPoints.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'STRESS')
                .tag('unit', 'score')
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(val))
                .timestamp(new Date(Number(ts) < 99999999999 ? Number(ts) * 1000 : Number(ts)))
            );
          }
        }
      }
      if (stressPoints.length > 0) {
        const c = await writeToInflux(stressPoints);
        results.synced.stress = c;
        results.total += c;
      }
    } catch (e) {
      results.errors.stress = e.message;
    }

    // ── 3. SPO2 / BLOOD OXYGEN (via /users/:uid/events) ─────────────────
    try {
      const items = await getEvents(host, appToken, uid, 'blood_oxygen', fromDate, now);
      const spo2Points = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          let val = item.spo2_level || item.spo2;
          if (!val && item.extra) {
            try {
              const extra = typeof item.extra === 'string' ? JSON.parse(item.extra) : item.extra;
              val = extra.spo2_level || extra.spo2;
            } catch (_) {}
          }
          const ts = item.timestamp || item.time || item.date_time;
          if (val != null && ts) {
            spo2Points.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'SPO2')
                .tag('unit', '%')
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(val))
                .timestamp(new Date(Number(ts) < 99999999999 ? Number(ts) * 1000 : Number(ts)))
            );
          }
        }
      }
      if (spo2Points.length > 0) {
        const c = await writeToInflux(spo2Points);
        results.synced.spo2 = c;
        results.total += c;
      }
    } catch (e) {
      results.errors.spo2 = e.message;
    }

    // ── 4. WORKOUTS (Run/Walk/Cycle history) ────────────────────────────
    try {
      const workoutPoints = [];
      let workoutData = null;
      let wErr = null;
      for (const h of candidateHosts(host, { huami: true })) {
        try {
          workoutData = await zeppGet(h, `/v1/sport/run/history.json`, appToken, uid, { source: 'run.mifit.huami.com' });
          wErr = null;
          break;
        } catch (e) { wErr = e; }
      }
      if (wErr) throw wErr;

      const workouts = workoutData?.data?.summary || workoutData?.summary || workoutData?.data || [];
      if (Array.isArray(workouts)) {
        for (const w of workouts) {
          const ts = w.start_time || w.startTime || w.trackId;
          if (!ts) continue;
          const workoutDate = new Date(Number(ts) < 99999999999 ? Number(ts) * 1000 : Number(ts));

          if (w.avg_heart_rate || w.avgHeartRate) {
            workoutPoints.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'WORKOUT_HR')
                .tag('unit', 'bpm')
                .tag('sportType', String(w.sport_type || 'run'))
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(w.avg_heart_rate || w.avgHeartRate))
                .timestamp(workoutDate)
            );
          }
          if (w.distance) {
            workoutPoints.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'WORKOUT_DISTANCE')
                .tag('unit', 'm')
                .tag('sportType', String(w.sport_type || 'run'))
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(w.distance))
                .timestamp(workoutDate)
            );
          }
          if (w.calorie || w.calories) {
            workoutPoints.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'WORKOUT_CALORIES')
                .tag('unit', 'kcal')
                .tag('sportType', String(w.sport_type || 'run'))
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(w.calorie || w.calories))
                .timestamp(workoutDate)
            );
          }
        }
      }
      if (workoutPoints.length > 0) {
        const c = await writeToInflux(workoutPoints);
        results.synced.workouts = c;
        results.total += c;
      }
    } catch (e) {
      results.errors.workouts = e.message;
    }

    res.json({
      success: true,
      message: `Zepp sync complete: ${results.total} data points written to InfluxDB`,
      synced: results.synced,
      errors: Object.keys(results.errors).length > 0 ? results.errors : undefined,
      total: results.total,
      bucket,
      host
    });
  } catch (err) {
    console.error('Zepp full sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------
// 3. POST /api/zepp/sync-daily
// Quick sync: today's steps, calories, HR only
// -----------------------------------------------------------------------
router.post('/sync-daily', async (req, res) => {
  try {
    const { appToken, userId, region = 'auto' } = req.body;
    if (!appToken || !userId) {
      return res.status(400).json({ error: 'appToken and userId are required' });
    }

    const host = resolveHost(region);
    const uid = String(userId);
    const today = localDateStr(new Date());

    const bandRes = await getBandDataWithFallback(host, appToken, uid, today, today);

    const items = bandRes?.data || [];
    const points = [];
    const day = items[0];

    if (day) {
      if (day.summary) {
        let summary = null;
        try {
          summary = JSON.parse(Buffer.from(day.summary, 'base64').toString('utf8'));
        } catch (_) {
          try { summary = JSON.parse(day.summary); } catch (_) {}
        }
        if (summary?.stp) {
          const ts = new Date();
          if (summary.stp.ttl != null) {
            points.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'STEPS')
                .tag('unit', 'steps')
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(summary.stp.ttl))
                .timestamp(ts)
            );
          }
          if (summary.stp.cal != null) {
            points.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'CALORIES')
                .tag('unit', 'kcal')
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(summary.stp.cal))
                .timestamp(ts)
            );
          }
          if (summary.stp.dis != null) {
            points.push(
              new Point('health_metric')
                .tag('userId', uid)
                .tag('deviceId', 'zepp_e')
                .tag('metricType', 'DISTANCE')
                .tag('unit', 'm')
                .tag('source', 'zepp_cloud')
                .floatField('value', Number(summary.stp.dis))
                .timestamp(ts)
            );
          }
        }
      }

      if (day.data_hr) {
        try {
          const hrBuf = Buffer.from(day.data_hr, 'base64');
          const dayStartMs = localMidnight(new Date()).getTime();
          for (let m = 0; m < hrBuf.length; m++) {
            const bpm = hrBuf[m];
            if (bpm > 35 && bpm < 200) {
              points.push(
                new Point('health_metric')
                  .tag('userId', uid)
                  .tag('deviceId', 'zepp_e')
                  .tag('metricType', 'HEART_RATE')
                  .tag('unit', 'bpm')
                  .tag('source', 'zepp_cloud')
                  .floatField('value', bpm)
                  .timestamp(new Date(dayStartMs + m * 60 * 1000))
              );
            }
          }
        } catch (_) {}
      }
    }

    const count = await writeToInflux(points);

    res.json({
      success: true,
      message: `Today's Zepp data synced: ${count} points`,
      total: count,
      date: today
    });
  } catch (err) {
    console.error('Zepp daily sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------
// 4. GET /api/zepp/data/:metric
// Query synced Zepp data from InfluxDB (for display in charts)
// -----------------------------------------------------------------------
router.get('/data/:metric', async (req, res) => {
  try {
    const metricType = req.params.metric.toUpperCase();
    const userId = req.query.userId || '1';
    const days = req.query.days || '7';
    const queryApi = getQueryApi();

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -${days}d)
        |> filter(fn: (r) => r._measurement == "health_metric")
        |> filter(fn: (r) => r.metricType == "${metricType}")
        |> filter(fn: (r) => r.source == "zepp_cloud")
        |> filter(fn: (r) => r._field == "value")
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
            unit: o.unit,
            metricType: o.metricType,
            source: o.source
          });
        },
        error: reject,
        complete: resolve
      });
    });

    res.json({ metricType, days, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================================================================
// PHONE SYNC: Zepp -> Health Connect (Android) -> bridge app -> this endpoint
// Health Connect has no web API, so a bridge app on the phone POSTs JSON here.
// Protect with ZEPP_INGEST_KEY in backend/.env (sent as x-api-key header
// or "Authorization: Bearer <key>").
// =======================================================================
const os = require('os');
const crypto = require('crypto');

function ingestAuthorized(req) {
  const key = process.env.ZEPP_INGEST_KEY;
  if (!key) return { ok: false, status: 503, error: 'ZEPP_INGEST_KEY is not set in backend/.env. Add a long random value and restart the backend.' };
  const given = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.query.key || '';
  const a = Buffer.from(String(given));
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, status: 401, error: 'Invalid API key' };
  return { ok: true };
}

// GET /api/zepp/ingest-info : tells the UI which URLs the phone can use (never returns the key)
router.get('/ingest-info', (req, res) => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  }
  const port = process.env.PORT || 5000;
  res.json({
    keyConfigured: !!process.env.ZEPP_INGEST_KEY,
    urls: ips.map((ip) => `http://${ip}:${port}/api/zepp/ingest`)
  });
});

const normKey = (k) => String(k).toLowerCase().replace(/record$/, '').replace(/[^a-z0-9]/g, '');
const toDate = (v) => {
  if (v == null) return null;
  const n = Number(v);
  const d = new Date(Number.isFinite(n) && String(v).trim() !== '' ? (n < 99999999999 ? n * 1000 : n) : v);
  return isNaN(d.getTime()) ? null : d;
};
const num = (...vals) => { for (const v of vals) { const n = Number(v); if (v != null && v !== '' && Number.isFinite(n)) return n; } return null; };
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Health Connect sleep stage ids / names
function sleepStageName(stage) {
  const map = { 1: 'awake', 2: 'sleeping', 3: 'out_of_bed', 4: 'light', 5: 'deep', 6: 'rem', 7: 'awake' };
  if (typeof stage === 'number' || /^\d+$/.test(String(stage))) return map[Number(stage)] || 'other';
  const t = String(stage).toLowerCase();
  if (t.includes('deep')) return 'deep';
  if (t.includes('rem')) return 'rem';
  if (t.includes('light')) return 'light';
  if (t.includes('awake') || t.includes('out')) return 'awake';
  return 'sleeping';
}

function mkPoint(uid, metricType, unit, value, ts, extraTags = {}) {
  const p = new Point('health_metric')
    .tag('userId', uid).tag('deviceId', 'zepp_e').tag('metricType', metricType)
    .tag('unit', unit).tag('source', 'zepp_cloud');
  for (const [k, v] of Object.entries(extraTags)) p.tag(k, String(v));
  return p.floatField('value', Number(value)).timestamp(ts);
}

// POST /api/zepp/ingest
// Accepts Health Connect style payloads, e.g.
//  { "userId":"...", "steps":[{"count":120,"startTime":"...","endTime":"..."}],
//    "heartRate":[{"samples":[{"time":"...","beatsPerMinute":72}]}],
//    "sleep":[{"startTime":"...","endTime":"...","stages":[{"stage":5,"startTime":"...","endTime":"..."}]}],
//    "oxygenSaturation":[{"time":"...","percentage":97}],
//    "restingHeartRate":[{"time":"...","beatsPerMinute":60}],
//    "activeCaloriesBurned":[{"startTime":"...","endTime":"...","energy":{"inKilocalories":12}}],
//    "distance":[{"startTime":"...","endTime":"...","distance":{"inMeters":80}}] }
// Also tolerates a top-level "records"/"data" wrapper and flat {type,time,value} items.
router.post('/ingest', async (req, res) => {
  const auth = ingestAuthorized(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    let body = req.body || {};
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) body = { ...body.data, userId: body.userId ?? body.data.userId };
    const uid = String(body.userId || req.query.userId || process.env.ZEPP_USER_ID || '1');

    // Group records by normalised type
    const groups = {};
    const add = (type, rec) => { (groups[type] = groups[type] || []).push(rec); };
    for (const [k, v] of Object.entries(body)) {
      if (['userId', 'records', 'device', 'timestamp'].includes(k)) continue;
      if (Array.isArray(v)) v.forEach((r) => add(normKey(k), r));
    }
    for (const r of asList(body.records || (Array.isArray(body) ? body : null))) {
      if (r && (r.type || r.recordType)) add(normKey(r.type || r.recordType), r);
    }

    const points = [];
    const dailySums = { steps: {}, calories: {}, distance: {} };
    const dayKey = (d) => localDateStr(d);
    const addDaily = (bucket, d, v) => { const k = dayKey(d); dailySums[bucket][k] = (dailySums[bucket][k] || 0) + v; };

    for (const r of groups.steps || []) {
      const d = toDate(r.startTime || r.time || r.start); const v = num(r.count, r.value, r.steps);
      if (d && v != null) addDaily('steps', d, v);
    }
    for (const t of ['activecaloriesburned', 'totalcaloriesburned', 'calories']) {
      for (const r of groups[t] || []) {
        const d = toDate(r.startTime || r.time || r.start);
        const v = num(r.energy?.inKilocalories, r.energy?.kilocalories, r.energy?.value, r.kcal, r.value);
        if (d && v != null) addDaily('calories', d, v);
      }
      if ((groups[t] || []).length) break; // don't double count active + total
    }
    for (const r of groups.distance || []) {
      const d = toDate(r.startTime || r.time || r.start);
      const v = num(r.distance?.inMeters, r.distance?.meters, r.meters, r.value);
      if (d && v != null) addDaily('distance', d, v);
    }
    const metaFor = { steps: ['STEPS', 'steps'], calories: ['CALORIES', 'kcal'], distance: ['DISTANCE', 'm'] };
    for (const [bucket, days] of Object.entries(dailySums)) {
      for (const [day, total] of Object.entries(days)) {
        points.push(mkPoint(uid, metaFor[bucket][0], metaFor[bucket][1], total, new Date(`${day}T23:59:00`)));
      }
    }

    for (const r of groups.heartrate || []) {
      const samples = Array.isArray(r.samples) ? r.samples : [r];
      for (const s of samples) {
        const d = toDate(s.time || s.timestamp || s.startTime); const bpm = num(s.beatsPerMinute, s.bpm, s.value);
        if (d && bpm != null && bpm > 30 && bpm < 230) points.push(mkPoint(uid, 'HEART_RATE', 'bpm', bpm, d));
      }
    }
    for (const r of groups.restingheartrate || []) {
      const d = toDate(r.time || r.startTime); const bpm = num(r.beatsPerMinute, r.bpm, r.value);
      if (d && bpm != null) points.push(mkPoint(uid, 'RESTING_HR', 'bpm', bpm, d));
    }
    for (const r of groups.oxygensaturation || groups.spo2 || []) {
      const d = toDate(r.time || r.startTime); const v = num(r.percentage, r.value, r.spo2);
      if (d && v != null) points.push(mkPoint(uid, 'SPO2', '%', v, d));
    }
    for (const r of groups.heartratevariability || groups.hrv || []) {
      const d = toDate(r.time || r.startTime); const v = num(r.heartRateVariabilityMillis, r.rmssd, r.value);
      if (d && v != null) points.push(mkPoint(uid, 'HRV', 'ms', v, d));
    }

    for (const r of groups.sleepsession || groups.sleep || []) {
      const start = toDate(r.startTime || r.start); const end = toDate(r.endTime || r.end);
      if (!start) continue;
      const mins = { deep: 0, rem: 0, light: 0, sleeping: 0, awake: 0 };
      for (const st of asList(r.stages)) {
        const a = toDate(st.startTime), b = toDate(st.endTime);
        if (a && b) { const n = sleepStageName(st.stage ?? st.type); mins[n] = (mins[n] || 0) + (b - a) / 60000; }
      }
      let total = mins.deep + mins.rem + mins.light + mins.sleeping;
      if (total === 0 && end) total = (end - start) / 60000; // no stage data: whole session
      if (total > 0) points.push(mkPoint(uid, 'SLEEP_TOTAL', 'min', Math.round(total), start));
      if (mins.deep > 0) points.push(mkPoint(uid, 'SLEEP_DEEP', 'min', Math.round(mins.deep), start));
      if (mins.rem > 0) points.push(mkPoint(uid, 'SLEEP_REM', 'min', Math.round(mins.rem), start));
    }

    const written = await writeToInflux(points);
    const received = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
    console.log(`[Zepp] ingest: ${written} points from ${JSON.stringify(received)}`);
    res.json({ success: true, written, received, userId: uid, bucket });
  } catch (err) {
    console.error('Zepp ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =======================================================================
// FILE IMPORT: upload the Zepp "Export data" zip (or its CSVs) -> InfluxDB
// No Zepp login / token / phone bridge needed.
//   POST /api/zepp/import?dryRun=1&tz=330&userId=...
//     - body = the .zip itself (Content-Type: application/zip),
//       zip password in the x-zip-password header (the export email has it)
//     - OR JSON { files: [{ name, text }] } for loose CSV files
// dryRun=1 only parses and reports what WOULD be written.
// =======================================================================
const { readZip, ZipError } = require('../services/aesZip');
const { parseExport } = require('../services/zeppImport');

router.post('/import',
  express.raw({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], limit: '100mb' }),
  async (req, res) => {
    try {
      const dryRun = ['1', 'true'].includes(String(req.query.dryRun));
      const tzQ = Number(req.query.tz);
      const tz = Number.isFinite(tzQ) ? tzQ : Number(process.env.ZEPP_TZ_OFFSET_MIN || 330); // default IST

      // 1. Collect CSV text from the upload
      const files = {};
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        const entries = readZip(req.body, req.get('x-zip-password') || '');
        for (const e of entries) if (/\.csv$/i.test(e.name)) files[e.name] = e.data.toString('utf8');
      } else if (Array.isArray(req.body?.files)) {
        for (const f of req.body.files) if (f?.name && typeof f.text === 'string') files[f.name] = f.text;
      }
      if (Object.keys(files).length === 0) {
        return res.status(400).json({ error: 'No CSV files found. Upload the Zepp export .zip or its .csv files.' });
      }

      // 2. Parse into point descriptors
      const { points, summary } = parseExport(files, { tz });
      if (summary.unknown.length) summary.note = `Ignored unrecognised files: ${summary.unknown.join(', ')}`;
      const uid = String(req.query.userId || summary.userId || process.env.ZEPP_USER_ID || '1').replace(/[^A-Za-z0-9_.-]/g, '');
      summary.userId = uid;
      if (dryRun || points.length === 0) {
        return res.json({ success: true, dryRun, written: 0, summary, bucket });
      }

      // 3. Write as line protocol over one explicit HTTP call per chunk. The batching
      //    client's flush() does not wait for its background batches and flushWrites()
      //    swallows errors, so here every HTTP response is checked and any failure is
      //    reported. The result is then verified by querying InfluxDB.
      const lines = points.map((p) => mkPoint(uid, p.metricType, p.unit, p.value, p.ts, p.tags || {}).toLineProtocol());
      const writeUrl = `${influxUrl}/api/v2/write?org=${encodeURIComponent(influxOrg)}&bucket=${encodeURIComponent(bucket)}&precision=ns`;
      for (let i = 0; i < lines.length; i += 5000) {
        let r;
        try {
          r = await fetch(writeUrl, {
            method: 'POST',
            headers: { Authorization: `Token ${influxToken}`, 'Content-Type': 'text/plain; charset=utf-8' },
            body: lines.slice(i, i + 5000).join('\n'),
            signal: AbortSignal.timeout(30000)
          });
        } catch (e) {
          return res.status(502).json({ error: `Cannot reach InfluxDB at ${influxUrl} (${e.cause?.code || e.cause?.errors?.[0]?.code || e.cause?.message || e.message}). Is it running? Start it with start-influx.bat.`, summary });
        }
        if (!r.ok) {
          const detail = (await r.text()).slice(0, 200);
          const hint = r.status === 401 ? ' Check INFLUX_TOKEN in backend/.env.' : r.status === 404 ? ' Check INFLUX_ORG / INFLUX_BUCKET in backend/.env.' : '';
          return res.status(502).json({ error: `InfluxDB rejected the write (HTTP ${r.status}): ${detail}.${hint}`, summary });
        }
      }

      const verified = {};
      try {
        const start = new Date(new Date(summary.from).getTime() - 1000).toISOString();
        const stop = new Date(new Date(summary.to).getTime() + 1000).toISOString();
        const flux = `
          from(bucket: "${bucket}")
            |> range(start: ${start}, stop: ${stop})
            |> filter(fn: (r) => r._measurement == "health_metric" and r.source == "zepp_cloud" and r.userId == "${uid}" and r._field == "value")
            |> group(columns: ["metricType"])
            |> count()`;
        await new Promise((resolve, reject) => {
          getQueryApi().queryRows(flux, {
            next(row, meta) { const o = meta.toObject(row); verified[o.metricType] = o._value; },
            error: reject, complete: resolve
          });
        });
      } catch (e) {
        summary.verifyError = `Written, but could not verify: ${e.message}`;
      }
      const missing = Object.entries(summary.byMetric).filter(([m]) => !verified[m]).map(([m]) => m);
      const stored = !summary.verifyError && missing.length === 0;
      if (!summary.verifyError && !stored) {
        return res.status(502).json({ error: `InfluxDB did not store: ${missing.join(', ')}. Check INFLUX_URL / INFLUX_TOKEN / INFLUX_BUCKET in backend/.env.`, summary, verified });
      }
      console.log(`[Zepp] import: ${points.length} points for user ${uid} (${summary.from} -> ${summary.to})`);
      res.json({ success: true, written: points.length, summary, verified, bucket });
    } catch (err) {
      if (err instanceof ZipError) {
        const status = err.code === 'PASSWORD_REQUIRED' || err.code === 'BAD_PASSWORD' ? 401 : 400;
        return res.status(status).json({ error: err.message, code: err.code });
      }
      console.error('Zepp import error:', err);
      res.status(500).json({ error: `Import failed: ${err.message}` });
    }
  });

module.exports = router;