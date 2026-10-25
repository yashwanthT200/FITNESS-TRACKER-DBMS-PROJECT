import { useEffect, useState } from "react";
import axios from "axios";

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    Brand: "",
    Model: "",
    SerialNumber: "",
    DeviceType: "Smartwatch",
    Features: "",
    HasGPS: false,
    WaterResistance: "",
    BandMaterial: "",
    HasHRSensor: false
  });

  const fetchDevices = async () => {
    try {
      const res = await axios.get("/api/devices");
      setDevices(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const resetForm = () => {
    setForm({
      Brand: "",
      Model: "",
      SerialNumber: "",
      DeviceType: "Smartwatch",
      Features: "",
      HasGPS: false,
      WaterResistance: "",
      BandMaterial: "",
      HasHRSensor: false
    });
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const features = form.Features
        .split(",")
        .map(feature => feature.trim())
        .filter(feature => feature);

      const data = {
        Brand: form.Brand,
        Model: form.Model,
        SerialNumber: form.SerialNumber,
        DeviceType: form.DeviceType,
        Features: features,
        HasGPS: form.HasGPS,
        WaterResistance: form.WaterResistance,
        BandMaterial: form.BandMaterial,
        HasHRSensor: form.HasHRSensor
      };

      if (editingId) {
        await axios.put(`/api/devices/${editingId}`, data);
      } else {
        await axios.post("/api/devices", data);
      }

      resetForm();
      await fetchDevices();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to save device"
      );
    }
  };

  const handleEdit = (device) => {
    setEditingId(device.DEVICEID);

    setForm({
      Brand: device.BRAND || "",
      Model: device.MODEL || "",
      SerialNumber: device.SERIALNUMBER || "",
      DeviceType: device.DEVICETYPE || "Smartwatch",
      Features: device.FEATURES || "",
      HasGPS:
  device.HASGPS === 1 ||
  device.HASGPS === true ||
  device.HASGPS === "Yes",
      WaterResistance: device.WATERRESISTANCE || "",
      BandMaterial: device.BANDMATERIAL || "",
      HasHRSensor:
  device.HASHRSENSOR === 1 ||
  device.HASHRSENSOR === true ||
  device.HASHRSENSOR === "Yes"
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm("Delete this device?")) {
      return;
    }

    setError("");

    try {
      await axios.delete(`/api/devices/${deviceId}`);
      await fetchDevices();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to delete device"
      );
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Devices
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-bold mb-5">
          {editingId ? "Edit Wearable Device" : "Add Wearable Device"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >

          <div>
            <label className="block mb-1 font-medium">
              Brand
            </label>

            <input
              name="Brand"
              value={form.Brand}
              onChange={handleChange}
              placeholder="Garmin"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Model
            </label>

            <input
              name="Model"
              value={form.Model}
              onChange={handleChange}
              placeholder="Forerunner 265"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Serial Number
            </label>

            <input
              name="SerialNumber"
              value={form.SerialNumber}
              onChange={handleChange}
              placeholder="GAR-004"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Device Type
            </label>

            <select
              name="DeviceType"
              value={form.DeviceType}
              onChange={handleChange}
              className="w-full border rounded-lg p-3"
            >
              <option value="Smartwatch">Smartwatch</option>
              <option value="Fitness Band">Fitness Band</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">
              Features
            </label>

            <input
              name="Features"
              value={form.Features}
              onChange={handleChange}
              placeholder="GPS, Heart Rate Monitoring, Sleep Tracking"
              className="w-full border rounded-lg p-3"
            />

            <p className="text-sm text-gray-500 mt-1">
              Separate features with commas.
            </p>
          </div>

          {form.DeviceType === "Smartwatch" && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="HasGPS"
                  checked={form.HasGPS}
                  onChange={handleChange}
                />

                <label>
                  Has GPS
                </label>
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Water Resistance
                </label>

                <input
                  name="WaterResistance"
                  value={form.WaterResistance}
                  onChange={handleChange}
                  placeholder="5 ATM"
                  className="w-full border rounded-lg p-3"
                />
              </div>
            </>
          )}

          {form.DeviceType === "Fitness Band" && (
            <>
              <div>
                <label className="block mb-1 font-medium">
                  Band Material
                </label>

                <input
                  name="BandMaterial"
                  value={form.BandMaterial}
                  onChange={handleChange}
                  placeholder="Silicone"
                  className="w-full border rounded-lg p-3"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="HasHRSensor"
                  checked={form.HasHRSensor}
                  onChange={handleChange}
                />

                <label>
                  Has HR Sensor
                </label>
              </div>
            </>
          )}

          <div className="md:col-span-2 flex gap-3">

            <button
              type="submit"
              className="bg-garmin-blue text-white px-6 py-3 rounded-lg font-semibold"
            >
              {editingId ? "Save Changes" : "Add Device"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
            )}

          </div>

        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-bold mb-5">
          My Devices
        </h2>

        {loading ? (
          <p>Loading devices...</p>
        ) : devices.length === 0 ? (
          <p className="text-gray-500">
            No devices found.
          </p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead>
                <tr className="border-b">
                  <th className="p-3">Brand</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Features</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.DEVICEID}
                    className="border-b"
                  >
                    <td className="p-3">
                      {device.BRAND}
                    </td>

                    <td className="p-3">
                      {device.MODEL}
                    </td>

                    <td className="p-3">
                      {device.SERIALNUMBER}
                    </td>

                    <td className="p-3">
                      {device.DEVICETYPE || "Device"}
                    </td>

                    <td className="p-3">
                      {device.FEATURES || "-"}
                    </td>

                    <td className="p-3 flex gap-2">

                      <button
                        onClick={() => handleEdit(device)}
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(device.DEVICEID)
                        }
                        className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium"
                      >
                        Delete
                      </button>

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