import { useEffect, useState } from "react";
import axios from "axios";

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    Type: "",
    Duration: "",
    Distance: "",
    Date: ""
  });

  const fetchActivities = async () => {
    try {
      const res = await axios.get("/api/activities");
      setActivities(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const resetForm = () => {
    setForm({
      Type: "",
      Duration: "",
      Distance: "",
      Date: ""
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const data = {
        Type: form.Type,
        Duration: Number(form.Duration),
        Distance: Number(form.Distance),
        Date: form.Date
      };

      if (editingId) {
        await axios.put(`/api/activities/${editingId}`, data);
      } else {
        await axios.post("/api/activities", data);
      }

      resetForm();
      await fetchActivities();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        (editingId
          ? "Failed to update activity"
          : "Failed to create activity")
      );
    }
  };

  const handleEdit = (activity) => {
    setEditingId(activity.ACTIVITYID);

    setForm({
      Type: activity.TYPE || "",
      Duration: activity.DURATION || "",
      Distance: activity.DISTANCE || "",
      Date: activity.Date
        ? activity.Date.substring(0, 10)
        : activity.DATE
          ? activity.DATE.substring(0, 10)
          : ""
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const handleDelete = async (activityId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this activity?"
    );

    if (!confirmed) return;

    setError("");

    try {
      await axios.delete(`/api/activities/${activityId}`);
      await fetchActivities();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to delete activity"
      );
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Activities
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-bold mb-5">
          {editingId ? "Edit Activity" : "Add Activity"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >

          <div>
            <label className="block mb-1 font-medium">
              Activity Type
            </label>

            <select
              name="Type"
              value={form.Type}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            >
              <option value="">Select activity</option>
              <option value="Running">Running</option>
              <option value="Walking">Walking</option>
              <option value="Cycling">Cycling</option>
              <option value="Swimming">Swimming</option>
              <option value="Hiking">Hiking</option>
              <option value="Workout">Workout</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Duration (minutes)
            </label>

            <input
              type="number"
              name="Duration"
              value={form.Duration}
              onChange={handleChange}
              required
              min="1"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Distance (km)
            </label>

            <input
              type="number"
              name="Distance"
              value={form.Distance}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Date
            </label>

            <input
              type="date"
              name="Date"
              value={form.Date}
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
              {editingId ? "Save Changes" : "Add Activity"}
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
          My Activities
        </h2>

        {loading ? (
          <p>Loading activities...</p>
        ) : activities.length === 0 ? (
          <p className="text-gray-500">
            No activities found.
          </p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead>
                <tr className="border-b">
                  <th className="p-3">Type</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Distance</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>

                {activities.map((activity) => (
                  <tr
                    key={activity.ACTIVITYID}
                    className="border-b"
                  >

                    <td className="p-3">
                      {activity.TYPE}
                    </td>

                    <td className="p-3">
                      {activity.DURATION} min
                    </td>

                    <td className="p-3">
                      {activity.DISTANCE} km
                    </td>

                    <td className="p-3">
                      {activity.Date || activity.DATE}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2">

                        <button
                          onClick={() => handleEdit(activity)}
                          className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-200"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(activity.ACTIVITYID)
                          }
                          className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium hover:bg-red-200"
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