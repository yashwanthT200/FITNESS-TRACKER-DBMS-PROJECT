/**
 * Parses a Zepp / Amazfit "Export data" bundle (CSV files) into InfluxDB
 * point descriptors. Pure functions, no database access, so it is testable.
 *
 * Output metric names/tags match what routes/zepp.js already writes
 * (health_metric, metricType, source=zepp_cloud), so the dashboards show
 * imported data alongside synced data. Re-importing the same export is safe:
 * identical timestamp + tags overwrite instead of duplicating.
 */

// ---------- CSV ----------
function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

// ---------- values & time ----------
const nullish = (v) => v == null || v === '' || v === 'null' || v === 'NULL' || v === 'NaN';
const num = (v) => { if (nullish(v)) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** "YYYY-MM-DD" + "HH:mm" in the user's local zone -> Date. tz = minutes ahead of UTC (IST = 330). */
function localToDate(dateStr, timeStr, tz) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!d) return null;
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr || '00:00') || [];
  const ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +(t[1] || 0), +(t[2] || 0), +(t[3] || 0)) - tz * 60000;
  return new Date(ms);
}

/** Epoch (s or ms), ISO with offset ("2026-10-21 04:10:32+0000"), or naive local string. */
function parseTs(v, tz) {
  if (nullish(v)) return null;
  const s = String(v).trim();
  if (/^\d{9,13}$/.test(s)) { const n = Number(s); return new Date(n < 99999999999 ? n * 1000 : n); }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  if (m[3]) {
    const off = m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
    const t = m[2].length === 5 ? m[2] + ':00' : m[2];
    const d = new Date(`${m[1]}T${t.padStart(8, '0')}${off}`);
    return isNaN(d) ? null : d;
  }
  return localToDate(m[1], m[2], tz);
}

// ---------- per-file converters: each returns point descriptors ----------
const P = (metricType, unit, value, ts, tags) => ({ metricType, unit, value, ts, tags });

const converters = {
  ACTIVITY(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const steps = num(r.steps), dist = num(r.distance), cal = num(r.calories);
      if (!steps && !dist && !cal) continue; // all-zero day = no data recorded
      const ts = localToDate(r.date, '23:59', tz); // same daily timestamp the live sync uses
      if (!ts) continue;
      if (steps != null) out.push(P('STEPS', 'steps', steps, ts));
      if (cal != null) out.push(P('CALORIES', 'kcal', cal, ts));
      if (dist != null) out.push(P('DISTANCE', 'm', dist, ts));
    }
    return out;
  },

  ACTIVITY_MINUTE(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const steps = num(r.steps), ts = localToDate(r.date, r.time, tz);
      if (ts && steps > 0) out.push(P('STEPS_MINUTE', 'steps', steps, ts));
    }
    return out;
  },

  HEARTRATE(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const bpm = num(r.heartRate), ts = parseTs(r.time, tz);
      if (ts && bpm > 30 && bpm < 230) out.push(P('HEART_RATE', 'bpm', bpm, ts));
    }
    return out;
  },

  HEARTRATE_AUTO(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const bpm = num(r.heartRate), ts = localToDate(r.date, r.time, tz);
      if (ts && bpm > 30 && bpm < 230) out.push(P('HEART_RATE', 'bpm', bpm, ts));
    }
    return out;
  },

  SLEEP(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const deep = num(r.deepSleepTime) || 0, light = num(r.shallowSleepTime) || 0, rem = num(r.REMTime) || 0;
      const total = deep + light + rem;
      if (total <= 0) continue; // no sleep recorded that night
      const ts = parseTs(r.start, tz) || localToDate(r.date, '00:00', tz);
      out.push(P('SLEEP_TOTAL', 'min', total, ts));
      if (deep > 0) out.push(P('SLEEP_DEEP', 'min', deep, ts));
      if (rem > 0) out.push(P('SLEEP_REM', 'min', rem, ts));
    }
    return out;
  },

  BODY(rows, { tz }) {
    const map = [['weight', 'WEIGHT', 'kg'], ['bmi', 'BMI', 'kg/m2'], ['fatRate', 'BODY_FAT', '%'],
      ['bodyWaterRate', 'BODY_WATER', '%'], ['muscleRate', 'MUSCLE_RATE', '%'], ['visceralFat', 'VISCERAL_FAT', 'level']];
    const out = [];
    for (const r of rows) {
      const ts = parseTs(r.time, tz);
      if (!ts) continue;
      for (const [col, metric, unit] of map) { const v = num(r[col]); if (v != null && v > 0) out.push(P(metric, unit, v, ts)); }
    }
    return out;
  },

  SPORT(rows, { tz }) {
    const out = [];
    for (const r of rows) {
      const ts = parseTs(r.startTime, tz);
      if (!ts) continue;
      const tags = { sportType: r.type || 'run' };
      const dist = num(r['distance(m)']), cal = num(r['calories(kcal)']), dur = num(r['sportTime(s)']);
      if (dist != null) out.push(P('WORKOUT_DISTANCE', 'm', dist, ts, tags));
      if (cal != null) out.push(P('WORKOUT_CALORIES', 'kcal', cal, ts, tags));
      if (dur != null) out.push(P('WORKOUT_DURATION', 's', dur, ts, tags));
    }
    return out;
  },
};

// Files present in the export but intentionally not imported
const SKIPPED = {
  ACTIVITY_STAGE: 'walk segments (already covered by daily + per-minute steps)',
  SLEEP_MINUTE: 'per-minute sleep stages (no matching metric in the dashboard)',
  HEALTH_DATA: 'body measurements (arm/waist/etc.)',
  USER: 'profile (only used to read your Zepp user id)',
};

/** "ACTIVITY_MINUTE/ACTIVITY_MINUTE_1792781106633.csv" -> "ACTIVITY_MINUTE" */
function kindOf(path) {
  const base = path.split(/[\\/]/).pop().replace(/\.csv$/i, '');
  return base.replace(/_\d{10,}$/, '').toUpperCase();
}

/**
 * files: { [path]: csvText }
 * opts:  { tz = 330 }   minutes ahead of UTC for the export's local date/time columns
 */
function parseExport(files, opts = {}) {
  const tz = Number.isFinite(opts.tz) ? opts.tz : 330;
  const points = [];
  const summary = { files: [], skipped: [], userId: null, unknown: [] };

  for (const [path, text] of Object.entries(files)) {
    if (!/\.csv$/i.test(path)) continue;
    const kind = kindOf(path);
    const rows = parseCsv(text);
    if (kind === 'USER' && rows[0]?.userId) summary.userId = String(rows[0].userId);
    if (converters[kind]) {
      const pts = converters[kind](rows, { tz });
      points.push(...pts);
      summary.files.push({ file: kind, rows: rows.length, points: pts.length });
    } else if (SKIPPED[kind]) {
      summary.skipped.push({ file: kind, rows: rows.length, reason: SKIPPED[kind] });
    } else {
      summary.unknown.push(kind);
    }
  }

  const byMetric = {};
  let min = null, max = null;
  for (const p of points) {
    byMetric[p.metricType] = (byMetric[p.metricType] || 0) + 1;
    const t = p.ts.getTime();
    if (min == null || t < min) min = t;
    if (max == null || t > max) max = t;
  }
  summary.byMetric = byMetric;
  summary.total = points.length;
  summary.from = min != null ? new Date(min).toISOString() : null;
  summary.to = max != null ? new Date(max).toISOString() : null;
  return { points, summary };
}

module.exports = { parseExport, parseCsv, parseTs, localToDate, kindOf };
