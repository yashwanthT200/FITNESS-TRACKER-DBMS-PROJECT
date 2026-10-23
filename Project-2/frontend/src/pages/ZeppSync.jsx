import React, { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  Watch, Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle,
  Activity, Moon, Zap, Flame, Footprints, Heart, Wind, Dumbbell,
  ChevronRight, Info, Shield, Clock, TrendingUp, Upload, FileArchive
} from "lucide-react";

const API = "";   // Vite proxy → backend on :5000

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, dec = 0) =>
  n != null ? Number(n).toFixed(dec) : "—";

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const COLORS = {
  HEART_RATE:  "#ef4444",
  STEPS:       "#3b82f6",
  CALORIES:    "#f97316",
  SLEEP_SCORE: "#8b5cf6",
  SLEEP_DEEP:  "#6366f1",
  SLEEP_REM:   "#a78bfa",
  SLEEP_TOTAL: "#c4b5fd",
  STRESS:      "#eab308",
  SPO2:        "#06b6d4",
  HRV:         "#10b981",
  WORKOUT_HR:  "#f43f5e",
};

// ─── Token Setup Panel ────────────────────────────────────────────────────────
function TokenPanel({ creds, setCreds, onValidate, validating, user, onLogin, loggingIn }) {
  const [login, setLogin] = useState({ email: "", password: "" });
  const [form, setForm] = useState({
    appToken: creds.appToken || "",
    userId:   creds.userId   || "",
    region:   creds.region   || "auto",
  });

  const handleChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-blue-400" />
        <h2 className="text-white font-semibold text-lg">Step 1 — Connect Zepp Account</h2>
      </div>

      {/* How to get credentials */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-5 text-sm text-blue-200">
        <p className="font-semibold mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> How to get your apptoken &amp; userid</p>
        <ol className="list-decimal ml-4 space-y-1 text-blue-300">
          <li>Open <a href="https://user.huami.com/privacy2/index.html" target="_blank" rel="noreferrer" className="underline text-blue-400">user.huami.com/privacy2/index.html</a> and log in.</li>
          <li>Press <kbd className="bg-gray-700 px-1 rounded text-xs">F12</kbd> → Application tab → Cookies → <code className="bg-gray-700 px-1 rounded">user.huami.com</code></li>
          <li>Copy the values for <code className="bg-gray-700 px-1 rounded">apptoken</code> and <code className="bg-gray-700 px-1 rounded">userid</code>.</li>
          <li>Paste them below and click <strong>Validate</strong>.</li>
        </ol>
        <p className="text-xs text-blue-400 mt-2">⚠ Credentials are stored only in your browser (localStorage) and never sent anywhere except the Zepp API.</p>
      </div>

      {/* Login with email & password (gets a real app token) */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 mb-5">
        <p className="text-gray-300 text-sm font-semibold mb-1">Recommended: Login with Zepp email &amp; password</p>
        <p className="text-gray-500 text-xs mb-3">Gets a real app token (the browser cookie token is rejected by the data API). Not stored. Won't work for Google/Apple sign-in accounts.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <input type="email" placeholder="Zepp account email" value={login.email}
            onChange={(e) => setLogin((l) => ({ ...l, email: e.target.value }))}
            className="flex-1 min-w-[180px] bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <input type="password" placeholder="Password" value={login.password}
            onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))}
            className="flex-1 min-w-[160px] bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <button
            onClick={async () => {
              const t = await onLogin(login);
              if (t) setForm((f) => ({ ...f, appToken: t.appToken, userId: t.userId }));
            }}
            disabled={loggingIn || !login.email || !login.password}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {loggingIn ? "Logging in…" : "Login & fill token"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <label className="block text-gray-400 text-xs mb-1">App Token</label>
          <input
            type="text"
            value={form.appToken}
            onChange={handleChange("appToken")}
            placeholder="Paste apptoken cookie value..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">User ID</label>
          <input
            type="text"
            value={form.userId}
            onChange={handleChange("userId")}
            placeholder="userid value..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div>
          <label className="block text-gray-400 text-xs mb-1">Region</label>
          <select
            value={form.region}
            onChange={handleChange("region")}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="auto">Auto (US/India)</option>
            <option value="eu">Europe (EU)</option>
            <option value="us">United States</option>
            <option value="in">India</option>
            <option value="cn">China</option>
          </select>
        </div>

        <button
          onClick={() => onValidate(form)}
          disabled={validating || !form.appToken || !form.userId}
          className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {validating ? "Validating…" : "Validate & Connect"}
        </button>
      </div>

      {/* Connected state */}
      {user && (
        <div className="flex items-center gap-3 bg-green-900/30 border border-green-700/40 rounded-lg px-4 py-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-300 font-semibold">Connected as {user.displayName}</p>
            <p className="text-green-500 text-xs">Region: {user.host} · User ID: {user.userId}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sync Controls Panel ──────────────────────────────────────────────────────
function SyncPanel({ connected, syncing, syncResult, onSync, onQuickSync, days, setDays }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="w-5 h-5 text-green-400" />
        <h2 className="text-white font-semibold text-lg">Step 2 — Sync Data to InfluxDB</h2>
      </div>

      {!connected && (
        <p className="text-gray-500 text-sm mb-4">Connect your Zepp account in Step 1 first.</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Sync last</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={!connected}
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onSync}
          disabled={!connected || syncing}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          {syncing ? "Syncing…" : `Sync All (${days}d)`}
        </button>

        <button
          onClick={onQuickSync}
          disabled={!connected || syncing}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Zap className="w-4 h-4 text-yellow-400" />
          Quick Sync (Today)
        </button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`rounded-lg px-4 py-3 text-sm ${syncResult.success ? "bg-green-900/30 border border-green-700/40 text-green-300" : "bg-red-900/30 border border-red-700/40 text-red-300"}`}>
          {syncResult.success ? (
            <>
              <p className="font-semibold mb-1">✓ {syncResult.message}</p>
              {syncResult.synced && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(syncResult.synced).map(([k, v]) => (
                    <span key={k} className="bg-green-900/50 px-2 py-0.5 rounded text-xs">
                      {k}: <strong>{v}</strong> pts
                    </span>
                  ))}
                </div>
              )}
              {syncResult.errors && Object.keys(syncResult.errors).length > 0 && (
                <p className="text-yellow-400 text-xs mt-2">
                  ⚠ Partial errors: {Object.entries(syncResult.errors).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                </p>
              )}
            </>
          ) : (
            <p>{syncResult.error || "Sync failed"}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Import Panel (Zepp "Export data" zip / CSVs -> InfluxDB) ───────────
function ImportPanel({ onImported }) {
  const [files, setFiles] = useState([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(null);   // "preview" | "import" | null
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);

  const isZip = files.length === 1 && /\.zip$/i.test(files[0].name);

  const run = async (dryRun) => {
    setBusy(dryRun ? "preview" : "import");
    setError(null);
    if (dryRun) setOut(null);
    try {
      const tz = -new Date().getTimezoneOffset();   // minutes ahead of UTC (IST = 330)
      const url = `${API}/api/zepp/import?tz=${tz}${dryRun ? "&dryRun=1" : ""}`;
      let opts;
      if (isZip) {
        opts = {
          method: "POST",
          headers: { "Content-Type": "application/zip", "x-zip-password": password },
          body: files[0],
        };
      } else {
        const list = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
        opts = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: list }),
        };
      }
      const r = await fetch(url, opts);
      const isJson = (r.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await r.json() : { error: `Server returned HTTP ${r.status}. Restart the backend so the new /api/zepp/import route loads.` };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setOut({ ...data, dryRun });
      if (!dryRun && onImported) onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const s = out?.summary;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-4">
      <div className="flex items-center gap-3 mb-2">
        <FileArchive className="w-5 h-5 text-emerald-400" />
        <h2 className="text-white font-semibold text-lg">Import Zepp data export (no login needed)</h2>
      </div>
      <p className="text-gray-400 text-sm mb-4">
        Request <strong>Export data</strong> in the Zepp app / Zepp account privacy page, then upload the .zip it emails you
        (or its .csv files) here. Everything is parsed and written to InfluxDB. Importing the same file twice won&apos;t create duplicates.
      </p>

      <div className="flex flex-wrap gap-3 items-end mb-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-gray-400 text-xs mb-1">Export file (.zip or .csv files)</label>
          <input
            type="file" accept=".zip,.csv" multiple
            onChange={(e) => { setFiles(Array.from(e.target.files || [])); setOut(null); setError(null); }}
            className="w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-white hover:file:bg-gray-600"
          />
        </div>
        {isZip && (
          <div className="min-w-[200px]">
            <label className="block text-gray-400 text-xs mb-1">Zip password (from the export email)</label>
            <input
              type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. MFGzJJcl" autoComplete="off"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
        <button
          onClick={() => run(true)} disabled={!files.length || !!busy}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {busy === "preview" ? "Reading…" : "Preview"}
        </button>
        <button
          onClick={() => run(false)} disabled={!files.length || !!busy}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          <Upload className="w-4 h-4" />
          {busy === "import" ? "Importing…" : "Import to InfluxDB"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {s && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${out.dryRun ? "bg-blue-900/20 border-blue-700/40 text-blue-200" : "bg-green-900/20 border-green-700/40 text-green-200"}`}>
          <p className="font-semibold flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4" />
            {out.dryRun
              ? `Preview: ${s.total} data points ready to import`
              : `Imported ${out.written} data points into InfluxDB (verified)`}
          </p>
          {s.from && (
            <p className="text-xs opacity-80 mb-2">
              {new Date(s.from).toLocaleDateString()} → {new Date(s.to).toLocaleDateString()} · Zepp user {s.userId}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {Object.entries(s.byMetric || {}).map(([m, n]) => (
              <span key={m} className="bg-gray-900/60 border border-gray-700 rounded-full px-3 py-1 text-xs">
                {m}: <strong>{out.verified?.[m] ?? n}</strong>
              </span>
            ))}
          </div>
          {s.files?.some((f) => f.rows > 0 && f.points === 0) && (
            <p className="text-xs opacity-80">
              No usable data in: {s.files.filter((f) => f.rows > 0 && f.points === 0).map((f) => f.file).join(", ")} (e.g. nights with zero sleep recorded).
            </p>
          )}
          {s.verifyError && <p className="text-xs text-yellow-300 mt-1">{s.verifyError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color = "text-white", subtitle }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>
        {value ?? "—"} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Mini Chart ───────────────────────────────────────────────────────────────
function MiniAreaChart({ data, dataKey = "value", color = "#3b82f6", height = 120 }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-24 text-gray-600 text-sm">No data yet — sync to load</div>
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fill: "#6b7280", fontSize: 10 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af" }}
          itemStyle={{ color: color }}
          labelFormatter={(v) => new Date(v).toLocaleString()}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#grad-${color.replace("#","")})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Sleep Bar Chart ──────────────────────────────────────────────────────────
function SleepBars({ data }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-24 text-gray-600 text-sm">No sleep data</div>
  );
  const bars = data.slice(-7).map((d) => ({
    date: fmtDate(d.time),
    deep:  d.deep  || 0,
    rem:   d.rem   || 0,
    light: Math.max(0, (d.total || 0) - (d.deep || 0) - (d.rem || 0)),
  }));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={bars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} unit="m" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Bar dataKey="deep"  name="Deep"  stackId="a" fill="#6366f1" />
        <Bar dataKey="rem"   name="REM"   stackId="a" fill="#a78bfa" />
        <Bar dataKey="light" name="Light" stackId="a" fill="#c4b5fd" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Phone Sync (Health Connect) Panel ───────────────────────────────────────
function PhoneSyncPanel() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/zepp/ingest-info`).then((r) => r.json()).then(setInfo).catch(() => setInfo({ error: true }));
  }, []);
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-4">
      <h2 className="text-white font-semibold text-lg mb-2">Phone Sync — Zepp → Health Connect (Android)</h2>
      <ol className="list-decimal ml-5 space-y-1 text-sm text-gray-300 mb-4">
        <li>Zepp app → Profile → your device / Add accounts → enable <b>Health Connect</b> and allow steps, heart rate, sleep, SpO₂.</li>
        <li>Install a Health Connect → webhook/HTTP bridge app on the phone and grant it read access.</li>
        <li>Point it at the URL below (phone and PC on the same Wi-Fi), add header <code className="bg-gray-700 px-1 rounded">x-api-key: &lt;your ZEPP_INGEST_KEY&gt;</code>, and run it.</li>
      </ol>
      {!info && <p className="text-gray-500 text-sm">Checking backend…</p>}
      {info?.error && <p className="text-red-400 text-sm">Backend not reachable. Restart it with the updated zepp.js.</p>}
      {info && !info.error && (
        <>
          <p className={`text-sm mb-2 ${info.keyConfigured ? "text-green-400" : "text-yellow-400"}`}>
            {info.keyConfigured ? "✓ API key configured" : "⚠ Add ZEPP_INGEST_KEY=<long random string> to backend/.env and restart the backend"}
          </p>
          {info.urls.map((u) => (
            <code key={u} className="block bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-blue-300 mb-1 select-all">{u}</code>
          ))}
          {info.urls.length === 0 && <p className="text-gray-500 text-xs">No LAN address found. Connect the PC to Wi-Fi.</p>}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ZeppSync() {
  // Auth state
  const [creds, setCreds]           = useState(() => {
    try { return JSON.parse(localStorage.getItem("zeppCreds") || "{}"); } catch { return {}; }
  });
  const [user,       setUser]       = useState(null);
  const [validating, setValidating] = useState(false);
  const [authError,  setAuthError]  = useState(null);
  const [loggingIn,  setLoggingIn]  = useState(false);

  // Sync state
  const [days,       setDays]       = useState(7);
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Dashboard data (loaded from InfluxDB after sync)
  const [tab,      setTab]      = useState("summary");
  const [metrics,  setMetrics]  = useState({});
  const [loading,  setLoading]  = useState(false);

  // ── Persist creds ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (creds.appToken && creds.userId) {
      localStorage.setItem("zeppCreds", JSON.stringify(creds));
    }
  }, [creds]);

  // ── Helper to safely parse API responses ──────────────────────────────────
  const safeParseResponse = async (r) => {
    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await r.json();
    }
    const text = await r.text();
    if (r.status === 404) {
      throw new Error("Backend route not found. Please restart the backend server with `npm run server`.");
    }
    throw new Error(`Server returned HTTP ${r.status}: ${text.slice(0, 120)}`);
  };

  // ── Email/password login -> real app token ────────────────────────────────
  const handleLogin = async ({ email, password }) => {
    setLoggingIn(true);
    setAuthError(null);
    try {
      const r = await fetch(`${API}/api/zepp/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeParseResponse(r);
      if (!r.ok || !data.appToken) { setAuthError(data.error || "Login failed"); return null; }
      return data;
    } catch (e) {
      setAuthError(e.message);
      return null;
    } finally {
      setLoggingIn(false);
    }
  };

  // ── Validate token ──────────────────────────────────────────────────────────
  const handleValidate = async (form) => {
    setValidating(true);
    setAuthError(null);
    try {
      const r = await fetch(`${API}/api/zepp/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await safeParseResponse(r);
      if (data.valid) {
        setCreds(form);
        setUser(data);
      } else {
        setAuthError(data.error || "Invalid token");
      }
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setValidating(false);
    }
  };

  // ── Full Sync ───────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await fetch(`${API}/api/zepp/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...creds, days }),
      });
      const data = await safeParseResponse(r);
      setSyncResult(data);
      if (data.success) loadMetrics();
    } catch (e) {
      setSyncResult({ success: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // ── Quick Sync (today) ──────────────────────────────────────────────────────
  const handleQuickSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await fetch(`${API}/api/zepp/sync-daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const data = await safeParseResponse(r);
      setSyncResult(data);
      if (data.success) loadMetrics();
    } catch (e) {
      setSyncResult({ success: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // ── Load metric data from InfluxDB ──────────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const metricList = [
      "HEART_RATE", "STEPS", "CALORIES", "SLEEP_SCORE", "SLEEP_DEEP",
      "SLEEP_REM", "SLEEP_TOTAL", "STRESS", "SPO2", "HRV",
      "WORKOUT_HR", "WORKOUT_DISTANCE", "WORKOUT_CALORIES", "RESTING_HR"
    ];
    try {
      const fetches = metricList.map((m) =>
        fetch(`${API}/api/zepp/data/${m}?userId=${creds.userId || ""}&days=${days}`)
          .then((r) => r.json())
          .then((d) => [m, d.data || []])
          .catch(() => [m, []])
      );
      const results = await Promise.all(fetches);
      const map = {};
      for (const [k, v] of results) map[k] = v;
      setMetrics(map);
    } finally {
      setLoading(false);
    }
  }, [creds.userId, days]);

  // Load on mount if already connected
  useEffect(() => {
    if (creds.appToken && creds.userId) {
      // Auto-validate stored creds silently (just to show user connected)
      handleValidate(creds).catch(() => {});
    }
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last  = (arr) => arr && arr.length ? arr[arr.length - 1] : null;
  const avg   = (arr) => arr && arr.length ? arr.reduce((s, d) => s + d.value, 0) / arr.length : null;
  const max   = (arr) => arr && arr.length ? Math.max(...arr.map((d) => d.value)) : null;

  const hrData      = metrics["HEART_RATE"]         || [];
  const stepsData   = metrics["STEPS"]              || [];
  const calData     = metrics["CALORIES"]           || [];
  const sleepScore  = metrics["SLEEP_SCORE"]        || [];
  const sleepDeep   = metrics["SLEEP_DEEP"]         || [];
  const sleepRem    = metrics["SLEEP_REM"]          || [];
  const sleepTotal  = metrics["SLEEP_TOTAL"]        || [];
  const stressData  = metrics["STRESS"]             || [];
  const spo2Data    = metrics["SPO2"]               || [];
  const hrvData     = metrics["HRV"]                || [];
  const whrData     = metrics["WORKOUT_HR"]         || [];
  const wDistData   = metrics["WORKOUT_DISTANCE"]   || [];
  const wCalData    = metrics["WORKOUT_CALORIES"]   || [];
  const rhrData     = metrics["RESTING_HR"]         || [];

  // Build combined sleep array for bar chart
  const sleepCombined = sleepScore.map((s, i) => ({
    time:  s.time,
    score: s.value,
    deep:  sleepDeep[i]?.value,
    rem:   sleepRem[i]?.value,
    total: sleepTotal[i]?.value,
  }));

  const tabs = [
    { id: "summary",  label: "Today's Summary", icon: Activity },
    { id: "sleep",    label: "Sleep",            icon: Moon     },
    { id: "stress",   label: "Stress",           icon: Zap      },
    { id: "workouts", label: "Workouts",         icon: Dumbbell },
    { id: "hrv_spo2", label: "HRV & SpO₂",      icon: Wind     },
  ];

  return (
    <div className="p-6 min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-blue-600/20 p-3 rounded-xl">
          <Watch className="w-7 h-7 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Zepp E Smartwatch Sync</h1>
          <p className="text-gray-400 text-sm">Sync real health data from your Amazfit Zepp E → InfluxDB time-series database</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <span className="flex items-center gap-2 text-green-400 text-sm bg-green-900/30 border border-green-700/40 px-3 py-1.5 rounded-full">
              <Wifi className="w-4 h-4" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-2 text-gray-500 text-sm">
              <WifiOff className="w-4 h-4" /> Not connected
            </span>
          )}
        </div>
      </div>

      {/* Auth error */}
      {authError && (
        <div className="mb-4 flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      <ImportPanel onImported={loadMetrics} />

      <PhoneSyncPanel />

      {/* Step 1: Token Setup */}
      <div className="mb-4">
        <TokenPanel
          creds={creds}
          setCreds={setCreds}
          onValidate={handleValidate}
          validating={validating}
          user={user}
          onLogin={handleLogin}
          loggingIn={loggingIn}
        />
      </div>

      {/* Step 2: Sync Controls */}
      <div className="mb-6">
        <SyncPanel
          connected={!!user}
          syncing={syncing}
          syncResult={syncResult}
          onSync={handleSync}
          onQuickSync={handleQuickSync}
          days={days}
          setDays={setDays}
        />
      </div>

      {/* Step 3: Data Dashboard */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-white font-semibold text-lg">Step 3 — Data Dashboard</h2>
            {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
          </div>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 bg-gray-900 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === t.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Today's Summary ── */}
        {tab === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Footprints} label="Steps" value={fmt(last(stepsData)?.value)} unit="steps" color="text-blue-400" subtitle={stepsData.length > 0 ? `${fmtDate(last(stepsData)?.time)}` : undefined} />
              <StatCard icon={Flame}      label="Calories" value={fmt(last(calData)?.value)} unit="kcal" color="text-orange-400" />
              <StatCard icon={Heart}      label="Resting HR" value={fmt(last(rhrData)?.value)} unit="bpm" color="text-red-400" />
              <StatCard icon={Activity}   label="Avg HR (7d)" value={fmt(avg(hrData), 0)} unit="bpm" color="text-rose-400" />
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Heart Rate (last {days}d)</p>
              <MiniAreaChart data={hrData.slice(-200)} color={COLORS.HEART_RATE} height={150} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-2 font-medium">Daily Steps</p>
                <MiniAreaChart data={stepsData} color={COLORS.STEPS} height={120} />
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-2 font-medium">Daily Calories</p>
                <MiniAreaChart data={calData} color={COLORS.CALORIES} height={120} />
              </div>
            </div>
          </div>
        )}

        {/* ── Sleep ── */}
        {tab === "sleep" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Moon}   label="Sleep Score" value={fmt(last(sleepScore)?.value)} unit="/ 100" color="text-purple-400" />
              <StatCard icon={Moon}   label="Total Sleep"  value={fmt(last(sleepTotal)?.value)} unit="min" color="text-violet-300" />
              <StatCard icon={Moon}   label="Deep Sleep"   value={fmt(last(sleepDeep)?.value)}  unit="min" color="text-indigo-400" />
              <StatCard icon={Moon}   label="REM Sleep"    value={fmt(last(sleepRem)?.value)}   unit="min" color="text-pink-400"   />
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Sleep Stages (last {days}d — stacked minutes)</p>
              <SleepBars data={sleepCombined} />
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Sleep Score Trend</p>
              <MiniAreaChart data={sleepScore} color={COLORS.SLEEP_SCORE} height={120} />
            </div>
          </div>
        )}

        {/* ── Stress ── */}
        {tab === "stress" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard icon={Zap} label="Latest Stress" value={fmt(last(stressData)?.value)} unit="/ 100" color="text-yellow-400" />
              <StatCard icon={Zap} label="Avg Stress"    value={fmt(avg(stressData), 0)}       unit="/ 100" color="text-yellow-300" subtitle="lower is better" />
              <StatCard icon={Zap} label="Peak Stress"   value={fmt(max(stressData))}          unit="/ 100" color="text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Stress Timeline</p>
              <MiniAreaChart data={stressData.slice(-200)} color={COLORS.STRESS} height={160} />
            </div>

            {/* Stress level legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>0–39 Relaxed</span>
              <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span>40–59 Normal</span>
              <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"></span>60–79 Medium</span>
              <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>80–100 High</span>
            </div>
          </div>
        )}

        {/* ── Workouts ── */}
        {tab === "workouts" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard icon={Dumbbell} label="Workouts Tracked" value={whrData.length}       unit="sessions" color="text-rose-400" />
              <StatCard icon={Heart}    label="Avg Workout HR"   value={fmt(avg(whrData), 0)} unit="bpm"      color="text-red-400"  />
              <StatCard icon={Flame}    label="Total Cal Burned" value={fmt(wCalData.reduce((s, d) => s + d.value, 0))} unit="kcal" color="text-orange-400" />
            </div>

            {whrData.length > 0 ? (
              <>
                <div>
                  <p className="text-gray-400 text-sm mb-2 font-medium">Workout Heart Rate History</p>
                  <MiniAreaChart data={whrData} color={COLORS.WORKOUT_HR} height={130} />
                </div>

                {/* Workout cards */}
                <p className="text-gray-400 text-sm font-medium">Recent Sessions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {whrData.slice(-6).reverse().map((w, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold text-sm">{fmtDate(w.time)} Workout</p>
                        <p className="text-gray-500 text-xs mt-0.5">Avg HR: {fmt(w.value)} bpm</p>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-semibold text-sm">{fmt(wCalData[wCalData.length - 1 - i]?.value)} kcal</p>
                        <p className="text-gray-500 text-xs">{fmt((wDistData[wDistData.length - 1 - i]?.value || 0) / 1000, 2)} km</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-600">
                <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No workout data yet. Sync your account to load workout history.</p>
              </div>
            )}
          </div>
        )}

        {/* ── HRV & SpO2 ── */}
        {tab === "hrv_spo2" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Wind}      label="Latest HRV"  value={fmt(last(hrvData)?.value)}  unit="ms"  color="text-green-400" subtitle="higher = better recovery" />
              <StatCard icon={Wind}      label="Avg HRV"     value={fmt(avg(hrvData), 0)}        unit="ms"  color="text-green-300" />
              <StatCard icon={Activity}  label="Latest SpO₂" value={fmt(last(spo2Data)?.value)} unit="%"   color="text-cyan-400"  subtitle={last(spo2Data)?.value >= 95 ? "Normal" : "Low — see a doctor"} />
              <StatCard icon={Activity}  label="Min SpO₂"    value={fmt(Math.min(...(spo2Data.map(d=>d.value)), 100))} unit="%" color="text-cyan-300" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-2 font-medium">HRV (Heart Rate Variability)</p>
                <MiniAreaChart data={hrvData} color={COLORS.HRV} height={140} />
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-2 font-medium">Blood Oxygen (SpO₂)</p>
                <MiniAreaChart data={spo2Data} color={COLORS.SPO2} height={140} />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-400">
              <p className="text-white font-medium mb-1 flex items-center gap-2"><Info className="w-4 h-4 text-blue-400" /> About these metrics</p>
              <ul className="space-y-1 ml-4 list-disc text-xs">
                <li><strong className="text-white">HRV</strong> — Higher values indicate better cardiovascular fitness and recovery. Normal: 20–100 ms.</li>
                <li><strong className="text-white">SpO₂</strong> — Blood oxygen saturation. Normal: 95–100%. Below 90% may require medical attention.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Empty state for no creds */}
        {!creds.userId && (
          <div className="text-center py-10 text-gray-600 mt-4">
            <Watch className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Connect your Zepp account above to see your data here.</p>
          </div>
        )}
      </div>

      {/* Academic note */}
      <div className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-5 text-sm text-gray-400">
        <p className="text-white font-semibold mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /> InfluxDB Integration (DBMS Assignment Note)</p>
        <p>This page demonstrates real-time data ingestion from a wearable device cloud API into <strong className="text-white">InfluxDB</strong> — a purpose-built time-series database.
          Each health metric is stored as a timestamped data point with tags (<code className="bg-gray-900 px-1 rounded">userId, deviceId, metricType, source</code>) and
          a float field (<code className="bg-gray-900 px-1 rounded">value</code>), enabling sub-millisecond time-range queries and downsampling that would be
          significantly slower in a relational database like Oracle.</p>
      </div>
    </div>
  );
}