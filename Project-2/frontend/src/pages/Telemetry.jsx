import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Activity,
  HeartPulse,
  Flame,
  Zap,
  TrendingUp,
  RefreshCw,
  Database,
  Play,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Save
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const METRICS = [
  { id: "HEART_RATE", name: "Heart Rate", unit: "bpm", color: "#ef4444", icon: HeartPulse },
  { id: "SPEED", name: "Pace / Speed", unit: "km/h", color: "#3b82f6", icon: Activity },
  { id: "CADENCE", name: "Cadence", unit: "spm", color: "#8b5cf6", icon: Zap },
  { id: "ELEVATION", name: "Elevation", unit: "m", color: "#10b981", icon: TrendingUp },
  { id: "SPO2", name: "Blood Oxygen (SpO2)", unit: "%", color: "#06b6d4", icon: Flame }
];

const TIME_RANGES = [
  { label: "15m", value: "15m", defaultWindow: "10s" },
  { label: "1h", value: "1h", defaultWindow: "30s" },
  { label: "6h", value: "6h", defaultWindow: "1m" },
  { label: "24h", value: "24h", defaultWindow: "5m" },
  { label: "48h", value: "48h", defaultWindow: "15m" },
  { label: "7d", value: "7d", defaultWindow: "1h" }
];

export default function Telemetry() {
  const [selectedMetric, setSelectedMetric] = useState("HEART_RATE");
  const [timeRange, setTimeRange] = useState("24h");
  const [window, setWindow] = useState("5m");
  const [aggregation, setAggregation] = useState("mean");

  const [dataPoints, setDataPoints] = useState([]);
  const [stats, setStats] = useState([]);
  const [rawPoints, setRawPoints] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);

  // CRUD Form State
  const [editingPoint, setEditingPoint] = useState(null);
  const [form, setForm] = useState({
    metricType: "HEART_RATE",
    value: "",
    unit: "bpm",
    deviceId: "1",
    timestamp: new Date().toISOString().slice(0, 16)
  });

  const activeMetricObj = METRICS.find(m => m.id === selectedMetric) || METRICS[0];

  // Fetch InfluxDB health & status
  const fetchHealth = async () => {
    try {
      const res = await axios.get("/api/telemetry/health");
      setHealth(res.data);
    } catch {
      setHealth({ status: "unreachable", database: "InfluxDB 2.x" });
    }
  };

  // Fetch telemetry downsampled chart data and summary stats
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const [queryRes, statsRes] = await Promise.all([
        axios.get("/api/telemetry/query", {
          params: {
            metricType: selectedMetric,
            timeRange,
            window,
            fn: aggregation
          }
        }),
        axios.get("/api/telemetry/stats", {
          params: { timeRange }
        })
      ]);

      const formatted = (queryRes.data.data || []).map((pt) => {
        const d = new Date(pt.time);
        return {
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          fullTime: d.toLocaleString(),
          value: Math.round(pt.value * 10) / 10
        };
      });

      setDataPoints(formatted);
      setStats(statsRes.data.stats || []);
    } catch (err) {
      console.error("Failed to query telemetry:", err);
      setDataPoints([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch raw individual points for CRUD table
  const fetchRawPoints = async () => {
    setLoadingPoints(true);
    try {
      const res = await axios.get("/api/telemetry/points", {
        params: {
          metricType: selectedMetric,
          timeRange,
          limit: 50
        }
      });
      setRawPoints(res.data || []);
    } catch (err) {
      console.error("Failed to fetch raw points:", err);
      setRawPoints([]);
    } finally {
      setLoadingPoints(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    fetchTelemetry();
    fetchRawPoints();
  }, [selectedMetric, timeRange, window, aggregation]);

  const handleSimulate = async () => {
    setSimulating(true);
    setNotice(null);
    try {
      const res = await axios.post("/api/telemetry/simulate", {
        durationMinutes: 30,
        intervalSeconds: 5
      });
      setNotice({
        type: "success",
        text: `Simulated 30-min workout: ${res.data.totalPointsWritten} data points written to InfluxDB!`
      });
      await fetchTelemetry();
      await fetchRawPoints();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.error || "Simulation failed. Ensure InfluxDB is running."
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleSyncOracle = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await axios.post("/api/telemetry/sync-oracle");
      setNotice({
        type: "success",
        text: `Synced ${res.data.syncedRows} records from Oracle HEALTH_METRIC to InfluxDB!`
      });
      await fetchTelemetry();
      await fetchRawPoints();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.error || "Sync failed. Ensure Oracle and InfluxDB are running."
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Form Change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === "metricType") {
        const found = METRICS.find(m => m.id === value);
        if (found) updated.unit = found.unit;
      }
      return updated;
    });
  };

  // Submit Add or Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setNotice(null);

    if (!form.value) {
      setNotice({ type: "error", text: "Please provide a value." });
      return;
    }

    try {
      if (editingPoint) {
        // Edit existing point
        await axios.put("/api/telemetry/points", {
          oldTime: editingPoint.time,
          oldMetricType: editingPoint.metricType,
          time: new Date(form.timestamp).toISOString(),
          metricType: form.metricType,
          value: Number(form.value),
          unit: form.unit,
          deviceId: form.deviceId
        });
        setNotice({ type: "success", text: "Telemetry point updated in InfluxDB!" });
        setEditingPoint(null);
      } else {
        // Add new point
        await axios.post("/api/telemetry/points", {
          metricType: form.metricType,
          value: Number(form.value),
          unit: form.unit,
          deviceId: form.deviceId,
          timestamp: new Date(form.timestamp).toISOString()
        });
        setNotice({ type: "success", text: "Telemetry point added to InfluxDB!" });
      }

      setForm({
        metricType: selectedMetric,
        value: "",
        unit: activeMetricObj.unit,
        deviceId: "1",
        timestamp: new Date().toISOString().slice(0, 16)
      });

      await fetchTelemetry();
      await fetchRawPoints();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.error || "Failed to save point to InfluxDB"
      });
    }
  };

  // Start Editing a Point
  const handleStartEdit = (pt) => {
    setEditingPoint(pt);
    const d = new Date(pt.time);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setForm({
      metricType: pt.metricType,
      value: String(pt.value),
      unit: pt.unit,
      deviceId: String(pt.deviceId || "1"),
      timestamp: localIso
    });
    window.scrollTo({ top: 750, behavior: "smooth" });
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingPoint(null);
    setForm({
      metricType: selectedMetric,
      value: "",
      unit: activeMetricObj.unit,
      deviceId: "1",
      timestamp: new Date().toISOString().slice(0, 16)
    });
  };

  // Delete a Point
  const handleDeletePoint = async (pt) => {
    if (!window.confirm(`Delete ${pt.metricType} point (${pt.value} ${pt.unit}) at ${new Date(pt.time).toLocaleString()} from InfluxDB?`)) {
      return;
    }
    setNotice(null);
    try {
      await axios.delete("/api/telemetry/points", {
        data: {
          time: pt.time,
          metricType: pt.metricType
        }
      });
      setNotice({ type: "success", text: "Point deleted from InfluxDB!" });
      await fetchTelemetry();
      await fetchRawPoints();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.error || "Failed to delete point from InfluxDB"
      });
    }
  };

  const currentMetricStat = stats.find(s => s.metricType === selectedMetric) || {
    latest: 0,
    min: 0,
    max: 0,
    avg: 0,
    count: 0
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Time-Series Telemetry (InfluxDB)</h1>
              <p className="text-sm text-gray-400">
                High-Frequency Wearable Pipeline • Full CRUD & Time-Bucket Downsampling
              </p>
            </div>
          </div>
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              health?.status === "healthy"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
            }`}
          >
            {health?.status === "healthy" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>
              InfluxDB: {health?.status === "healthy" ? "Online" : "Waiting for Port 8086"}
            </span>
          </div>

          <button
            onClick={handleSyncOracle}
            disabled={syncing}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition border border-gray-700 disabled:opacity-50"
            title="Import existing records from Oracle HEALTH_METRIC table"
          >
            <ArrowRightLeft className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync from Oracle"}</span>
          </button>

          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-red-600/30 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${simulating ? "animate-spin" : "fill-current"}`} />
            <span>{simulating ? "Streaming..." : "Simulate Live Workout"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between ${
            notice.type === "success"
              ? "bg-emerald-950/60 border border-emerald-800/80 text-emerald-200"
              : "bg-rose-950/60 border border-rose-800/80 text-rose-200"
          }`}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-xs underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {METRICS.map((m) => {
          const isSelected = selectedMetric === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMetric(m.id);
                setForm(prev => ({ ...prev, metricType: m.id, unit: m.unit }));
              }}
              className={`p-4 rounded-xl border text-left transition flex items-center gap-3 ${
                isSelected
                  ? "bg-gray-800 border-red-500 shadow-md ring-1 ring-red-500/50"
                  : "bg-gray-900 border-gray-800 hover:bg-gray-800/60 text-gray-400"
              }`}
            >
              <div
                className="p-2.5 rounded-lg"
                style={{ backgroundColor: `${m.color}20`, color: m.color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{m.name}</p>
                <p className="text-sm font-bold text-white uppercase">{m.unit}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Latest Sample
          </span>
          <p className="text-2xl font-bold text-white mt-1">
            {currentMetricStat.latest || 0}{" "}
            <span className="text-xs text-gray-400 font-normal">{activeMetricObj.unit}</span>
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Period Peak (Max)
          </span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {currentMetricStat.max || 0}{" "}
            <span className="text-xs text-gray-400 font-normal">{activeMetricObj.unit}</span>
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Period Average
          </span>
          <p className="text-2xl font-bold text-indigo-300 mt-1">
            {currentMetricStat.avg || 0}{" "}
            <span className="text-xs text-gray-400 font-normal">{activeMetricObj.unit}</span>
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" /> Aggregated Buckets
          </span>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {dataPoints.length}{" "}
            <span className="text-xs text-gray-400 font-normal">points</span>
          </p>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        {/* Controls: TimeRange, Window, Aggregation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Range:</span>
            <div className="flex bg-gray-800 rounded-lg p-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    setTimeRange(r.value);
                    setWindow(r.defaultWindow);
                  }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                    timeRange === r.value
                      ? "bg-red-500 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Downsampling Window:</span>
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value)}
                className="bg-gray-800 text-gray-200 border border-gray-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
              >
                <option value="5s">5 seconds (Raw)</option>
                <option value="10s">10 seconds</option>
                <option value="30s">30 seconds</option>
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Function:</span>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                className="bg-gray-800 text-gray-200 border border-gray-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
              >
                <option value="mean">Mean (Average)</option>
                <option value="max">Max (Peak)</option>
                <option value="min">Min (Valley)</option>
                <option value="sum">Sum</option>
                <option value="count">Count</option>
              </select>
            </div>

            <button
              onClick={() => {
                fetchTelemetry();
                fetchRawPoints();
              }}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
              title="Refresh Query"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="h-80 w-full pt-2">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Querying InfluxDB time-series buckets...
            </div>
          ) : dataPoints.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm space-y-3">
              <Activity className="w-10 h-10 opacity-30" />
              <p>No telemetry recorded in this time range.</p>
              <button
                onClick={handleSimulate}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-xl text-xs font-semibold border border-gray-700"
              >
                Click to Simulate 30-min Workout Telemetry
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataPoints}>
                <defs>
                  <linearGradient id="metricColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricObj.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activeMetricObj.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  domain={["auto", "auto"]}
                  unit={` ${activeMetricObj.unit}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderColor: "#374151",
                    borderRadius: "0.75rem",
                    color: "#fff"
                  }}
                  labelFormatter={(l, payload) =>
                    payload?.[0]?.payload?.fullTime || l
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={activeMetricObj.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#metricColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CRUD OPERATIONS SECTION: Add / Edit Form + Points Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add / Edit Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {editingPoint ? (
                <>
                  <Edit2 className="w-4 h-4 text-amber-400" />
                  <span>Edit InfluxDB Point</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Add Telemetry Point</span>
                </>
              )}
            </h2>
            {editingPoint && (
              <button
                onClick={handleCancelEdit}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium">Metric Type</label>
              <select
                name="metricType"
                value={form.metricType}
                onChange={handleFormChange}
                className="w-full mt-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              >
                {METRICS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium">Value ({form.unit})</label>
              <input
                type="number"
                step="any"
                name="value"
                value={form.value}
                onChange={handleFormChange}
                placeholder="e.g. 145"
                required
                className="w-full mt-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={form.unit}
                  onChange={handleFormChange}
                  className="w-full mt-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Device ID</label>
                <input
                  type="number"
                  name="deviceId"
                  value={form.deviceId}
                  onChange={handleFormChange}
                  className="w-full mt-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium">Timestamp</label>
              <input
                type="datetime-local"
                name="timestamp"
                value={form.timestamp}
                onChange={handleFormChange}
                required
                className="w-full mt-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg ${
                editingPoint
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
              }`}
            >
              {editingPoint ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update in InfluxDB</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to InfluxDB</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: InfluxDB Data Table with Edit & Delete Actions */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-red-500" />
                <span>InfluxDB Telemetry Records ({selectedMetric})</span>
              </h2>
              <p className="text-xs text-gray-400">
                Latest raw points with individual Edit and Delete capabilities
              </p>
            </div>
            <button
              onClick={fetchRawPoints}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPoints ? "animate-spin" : ""}`} />
              <span>Refresh Records</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {loadingPoints ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-500" />
                Loading records from InfluxDB...
              </div>
            ) : rawPoints.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm space-y-2">
                <p>No records found in InfluxDB for {selectedMetric}.</p>
                <p className="text-xs text-gray-600">
                  Use the form on the left or click "Simulate Live Workout" to add points.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3">Value</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Device</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {rawPoints.map((pt, idx) => (
                    <tr
                      key={pt.id || idx}
                      className="hover:bg-gray-800/40 transition"
                    >
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-200 border border-gray-700">
                          {pt.metricType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">
                        {pt.value}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        {pt.unit}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        Device #{pt.deviceId}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">
                        {new Date(pt.time).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleStartEdit(pt)}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeletePoint(pt)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Academic Justification & Architectural Comparison (For submission report) */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4 text-gray-300">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-red-500" />
          Academic Justification: InfluxDB vs. Relational Oracle for Wearable IoT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1.5">
            <h4 className="font-semibold text-emerald-400">1. High Write Throughput</h4>
            <p>
              Smartwatches stream biometric data every second. Traditional RDBMS uses B-Tree indexes
              and row-level locks, causing write stalls at high concurrencies. InfluxDB uses Time-Structured
              Merge (TSM) trees, optimized for append-only, sequential time-ordered ingest.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1.5">
            <h4 className="font-semibold text-blue-400">2. Gorilla Data Compression</h4>
            <p>
              InfluxDB applies double-delta timestamp compression and XOR floating-point compression
              (Gorilla algorithm). Sensor metrics achieve <strong>80–90% storage savings</strong> compared
              to storing identical tuples across normalized Oracle tables.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1.5">
            <h4 className="font-semibold text-purple-400">3. Built-In Downsampling & Retention</h4>
            <p>
              RDBMS requires custom cron scripts to delete or aggregate millions of old rows.
              InfluxDB manages retention policies natively (e.g. 7-day raw resolution, 30-day 5-minute
              downsampled rollups) without consuming application compute.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
