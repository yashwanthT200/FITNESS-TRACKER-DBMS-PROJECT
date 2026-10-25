import { useEffect, useState } from "react";
import axios from "axios";

export default function Health() {
  const [metrics, setMetrics] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    DeviceID: "",
    MetricType: "",
    Value: "",
    Unit: "",
    Timestamp: ""
  });

  const fetchData = async () => {
    try {
      const [healthRes, deviceRes] = await Promise.all([
        axios.get("/api/health"),
        axios.get("/api/devices")
      ]);

      setMetrics(healthRes.data);
      setDevices(deviceRes.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load health data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({
      DeviceID: "",
      MetricType: "",
      Value: "",
      Unit: "",
      Timestamp: ""
    });
    setEditingId(null);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const timestamp = form.Timestamp.replace("T", " ");

      const data = {
        DeviceID: Number(form.DeviceID),
        MetricType: form.MetricType,
        Value: Number(form.Value),
        Unit: form.Unit,
        Timestamp: `${timestamp}:00`
      };

      if (editingId) {
        await axios.put(`/api/health/${editingId}`, data);
      } else {
        await axios.post("/api/health", data);
      }

      resetForm();
      await fetchData();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to save health metric"
      );
    }
  };

  const handleEdit = (metric) => {
    setEditingId(metric.METRICID);

    let timestamp = metric.TIMESTAMP;

    if (timestamp) {
      timestamp = timestamp.toString().replace(" ", "T").slice(0, 16);
    }

    const device = devices.find(
      (d) => d.DEVICEID === metric.DEVICEID
    );

    setForm({
      DeviceID: metric.DEVICEID || "",
      MetricType: metric.METRICTYPE || "",
      Value: metric.VALUE ?? "",
      Unit: metric.UNIT || "",
      Timestamp: timestamp || ""
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const handleDelete = async (metricId) => {
    if (!window.confirm("Delete this health metric?")) {
      return;
    }

    setError("");

    try {
      await axios.delete(`/api/health/${metricId}`);
      await fetchData();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to delete health metric"
      );
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Health Metrics
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-bold mb-5">
          {editingId ? "Edit Health Metric" : "Add Health Metric"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >

          <div>
            <label className="block mb-1 font-medium">
              Device
            </label>

            <select
              name="DeviceID"
              value={form.DeviceID}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            >
              <option value="">
                Select device
              </option>

              {devices.map((device) => (
                <option
                  key={device.DEVICEID}
                  value={device.DEVICEID}
                >
                  {device.BRAND} {device.MODEL} - {device.SERIALNUMBER}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Metric Type
            </label>

            <select
              name="MetricType"
              value={form.MetricType}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            >
              <option value="">
                Select metric
              </option>
              <option value="Heart Rate">Heart Rate</option>
              <option value="Steps">Steps</option>
              <option value="SpO2">SpO2</option>
              <option value="Calories">Calories</option>
              <option value="Sleep">Sleep</option>
              <option value="Stress">Stress</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Value
            </label>

            <input
              type="number"
              name="Value"
              value={form.Value}
              onChange={handleChange}
              required
              step="0.01"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Unit
            </label>

            <input
              type="text"
              name="Unit"
              value={form.Unit}
              onChange={handleChange}
              placeholder="BPM, steps, %, kcal"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Timestamp
            </label>

            <input
              type="datetime-local"
              name="Timestamp"
              value={form.Timestamp}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div className="md:col-span-2 flex gap-3">

            <button
              type="submit"
              className="bg-garmin-blue text-white px-6 py-3 rounded-lg font-semibold"
            >
              {editingId ? "Update Health Metric" : "Add Health Metric"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
            )}

          </div>

        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-bold mb-5">
          My Health Metrics
        </h2>

        {loading ? (
          <p>Loading health metrics...</p>
        ) : metrics.length === 0 ? (
          <p className="text-gray-500">
            No health metrics found.
          </p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead>
                <tr className="border-b">
                  <th className="p-3">Metric</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {metrics.map((metric) => (
                  <tr
                    key={metric.METRICID}
                    className="border-b"
                  >

                    <td className="p-3">
                      {metric.METRICTYPE}
                    </td>

                    <td className="p-3">
                      {metric.VALUE}
                    </td>

                    <td className="p-3">
                      {metric.UNIT}
                    </td>

                    <td className="p-3">
                      {metric.BRAND} {metric.MODEL}
                    </td>

                    <td className="p-3">
                      {metric.TIMESTAMP}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2">

                        <button
                          onClick={() => handleEdit(metric)}
                          className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(metric.METRICID)}
                          className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold"
                        >
                          Delete
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}