import { useEffect, useState } from "react";
import axios from "axios";

export default function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    Title: "",
    Description: "",
    DateAwarded: "",
    ActivityID: ""
  });

  const fetchData = async () => {
    try {
      const [achievementRes, activityRes] = await Promise.all([
        axios.get("/api/achievements"),
        axios.get("/api/activities")
      ]);

      setAchievements(achievementRes.data);
      setActivities(activityRes.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to load achievements"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({
      Title: "",
      Description: "",
      DateAwarded: "",
      ActivityID: ""
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

    const data = {
      Title: form.Title,
      Description: form.Description,
      DateAwarded: form.DateAwarded,
      ActivityID: Number(form.ActivityID)
    };

    try {
      if (editingId) {
        await axios.put(`/api/achievements/${editingId}`, data);
      } else {
        await axios.post("/api/achievements", data);
      }

      resetForm();
      await fetchData();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to save achievement"
      );
    }
  };

  const handleEdit = (achievement) => {
    const achievementId =
      achievement.ACHIEVEMENTID ??
      achievement.AchievementID;

    const activityId =
      achievement.ACTIVITYID ??
      achievement.ActivityID;

    const title =
      achievement.TITLE ??
      achievement.Title;

    const description =
      achievement.DESCRIPTION ??
      achievement.Description;

    const dateAwarded =
      achievement.DATEAWARDED ??
      achievement.DateAwarded;

    setEditingId(achievementId);

    setForm({
      Title: title || "",
      Description: description || "",
      DateAwarded: dateAwarded
        ? String(dateAwarded).substring(0, 10)
        : "",
      ActivityID: activityId ?? ""
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const handleDelete = async (achievementId) => {
    if (!window.confirm("Delete this achievement?")) {
      return;
    }

    setError("");

    try {
      await axios.delete(`/api/achievements/${achievementId}`);
      await fetchData();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to delete achievement"
      );
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Achievements
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-5">
          {editingId ? "Edit Achievement" : "Add Achievement"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block mb-1 font-medium">
              Achievement Title
            </label>

            <input
              type="text"
              name="Title"
              value={form.Title}
              onChange={handleChange}
              placeholder="Example: 5K Runner"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Date Awarded
            </label>

            <input
              type="date"
              name="DateAwarded"
              value={form.DateAwarded}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-1 font-medium">
              Description
            </label>

            <textarea
              name="Description"
              value={form.Description}
              onChange={handleChange}
              placeholder="Describe the achievement"
              required
              rows="3"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Activity
            </label>

            <select
              name="ActivityID"
              value={form.ActivityID}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            >
              <option value="">
                Select activity
              </option>

              {activities.map((activity) => (
                <option
                  key={activity.ACTIVITYID}
                  value={activity.ACTIVITYID}
                >
                  {activity.TYPE} - {activity.DISTANCE} km -{" "}
                  {activity.DURATION} min
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="bg-garmin-blue text-white px-6 py-3 rounded-lg font-semibold"
            >
              {editingId ? "Save Changes" : "Add Achievement"}
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
          My Achievements
        </h2>

        {loading ? (
          <p>Loading achievements...</p>
        ) : achievements.length === 0 ? (
          <p className="text-gray-500">
            No achievements found.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {achievements.map((achievement) => {
              const achievementId =
                achievement.ACHIEVEMENTID ??
                achievement.AchievementID;

              const activityId =
                achievement.ACTIVITYID ??
                achievement.ActivityID;

              const title =
                achievement.TITLE ??
                achievement.Title;

              const description =
                achievement.DESCRIPTION ??
                achievement.Description;

              const activityType =
                achievement.ACTIVITYTYPE ??
                achievement.ActivityType;

              const distance =
                achievement.DISTANCE ??
                achievement.Distance;

              const duration =
                achievement.DURATION ??
                achievement.Duration;

              const dateAwarded =
                achievement.DATEAWARDED ??
                achievement.DateAwarded;

              return (
                <div
                  key={`${achievementId}-${activityId}`}
                  className="border rounded-xl p-5 shadow-sm"
                >
                  <div className="text-3xl mb-3">
                    🏆
                  </div>

                  <h3 className="text-xl font-bold mb-2">
                    {title || "Achievement"}
                  </h3>

                  <p className="text-gray-600 mb-4">
                    {description || "No description"}
                  </p>

                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Activity:</strong>{" "}
                      {activityType || "N/A"}
                    </p>

                    <p>
                      <strong>Distance:</strong>{" "}
                      {distance != null
                        ? `${distance} km`
                        : "N/A"}
                    </p>

                    <p>
                      <strong>Duration:</strong>{" "}
                      {duration != null
                        ? `${duration} min`
                        : "N/A"}
                    </p>

                    <p>
                      <strong>Date Awarded:</strong>{" "}
                      {dateAwarded || "N/A"}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => handleEdit(achievement)}
                      className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(achievementId)
                      }
                      className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}