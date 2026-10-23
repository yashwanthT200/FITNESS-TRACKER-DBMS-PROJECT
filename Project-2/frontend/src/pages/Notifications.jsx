import { useEffect, useState } from "react";
import axios from "axios";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    SourceType: "Trainer",
    TrainerUserID: "",
    ContactChannel: "Email",
    NotificationPref: "All"
  });

  const fetchData = async () => {
    try {
      const [notificationRes, trainerRes] = await Promise.all([
        axios.get("/api/notifications"),
        axios.get("/api/trainers")
      ]);

      setNotifications(notificationRes.data);
      setTrainers(trainerRes.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to load notification settings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      await axios.post("/api/notifications", {
        SourceType: form.SourceType,
        TrainerUserID:
          form.TrainerUserID === ""
            ? null
            : Number(form.TrainerUserID),
        ContactChannel: form.ContactChannel,
        NotificationPref: form.NotificationPref
      });

      setForm({
        SourceType: "Trainer",
        TrainerUserID: "",
        ContactChannel: "Email",
        NotificationPref: "All"
      });

      await fetchData();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to create notification setting"
      );
    }
  };

  const handleDelete = async (recipientId) => {
    try {
      await axios.delete(
        `/api/notifications/${recipientId}`
      );

      await fetchData();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to delete notification setting"
      );
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Notifications
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-5">
          Add Notification Setting
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block mb-1 font-medium">
              Source Type
            </label>

            <select
              name="SourceType"
              value={form.SourceType}
              onChange={handleChange}
              className="w-full border rounded-lg p-3"
            >
              <option value="Trainer">Trainer</option>
              <option value="System">System</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Trainer
            </label>

            <select
              name="TrainerUserID"
              value={form.TrainerUserID}
              onChange={handleChange}
              className="w-full border rounded-lg p-3"
            >
              <option value="">Select trainer</option>

              {trainers.map((trainer) => (
                <option
                  key={trainer.TrainerID}
                  value={trainer.TrainerID}
                >
                  {trainer.TrainerFirstName}{" "}
                  {trainer.TrainerLastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Contact Channel
            </label>

            <select
              name="ContactChannel"
              value={form.ContactChannel}
              onChange={handleChange}
              className="w-full border rounded-lg p-3"
            >
              <option value="Email">Email</option>
              <option value="Mobile">Mobile</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Notification Preference
            </label>

            <select
              name="NotificationPref"
              value={form.NotificationPref}
              onChange={handleChange}
              className="w-full border rounded-lg p-3"
            >
              <option value="All">All</option>
              <option value="Activity">Activity</option>
              <option value="Achievement">Achievement</option>
              <option value="Health">Health</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="bg-garmin-blue text-white px-6 py-3 rounded-lg font-semibold"
            >
              Add Notification Setting
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-5">
          My Notification Settings
        </h2>

        {loading ? (
          <p>Loading notification settings...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500">
            No notification settings found.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {notifications.map((notification) => (
              <div
                key={notification.RecipientID}
                className="border rounded-xl p-5"
              >
                <div className="text-3xl mb-3">
                  🔔
                </div>

                <h3 className="text-xl font-bold mb-2">
                  {notification.SourceType}
                </h3>

                <div className="space-y-2 text-gray-600">
                  <p>
                    <strong>Trainer:</strong>{" "}
                    {notification.TrainerFirstName
                      ? `${notification.TrainerFirstName} ${notification.TrainerLastName}`
                      : "N/A"}
                  </p>

                  <p>
                    <strong>Channel:</strong>{" "}
                    {notification.ContactChannel}
                  </p>

                  <p>
                    <strong>Preference:</strong>{" "}
                    {notification.NotificationPref}
                  </p>
                </div>

                <button
                  onClick={() =>
                    handleDelete(notification.RecipientID)
                  }
                  className="mt-5 bg-red-600 text-white px-5 py-2 rounded-lg font-semibold"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}