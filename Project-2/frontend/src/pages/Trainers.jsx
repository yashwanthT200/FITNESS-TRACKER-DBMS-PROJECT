import { useEffect, useState } from "react";
import axios from "axios";

export default function Trainers() {
  const [trainers, setTrainers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    UserID: "",
    CertificationNo: "",
    YearsExperience: ""
  });

  const fetchTrainers = async () => {
    try {
      const response = await axios.get("/api/trainers");
      setTrainers(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load trainers");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get("/api/trainer-users");
      setUsers(response.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to load users"
      );
    }
  };

  useEffect(() => {
    fetchTrainers();
    fetchUsers();
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
      await axios.post("/api/trainers", {
        UserID: Number(form.UserID),
        CertificationNo: form.CertificationNo,
        YearsExperience: Number(form.YearsExperience)
      });

      setForm({
        UserID: "",
        CertificationNo: "",
        YearsExperience: ""
      });

      await fetchTrainers();

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to add trainer"
      );
    }
  };

  const viewTrainer = async (trainer) => {
    setError("");
    setSelectedTrainer(trainer);
    setDetailsLoading(true);

    try {
      const response = await axios.get(
        `/api/trainers/${trainer.TrainerID}/athletes`
      );

      setAthletes(response.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        "Failed to load trainer details"
      );
    } finally {
      setDetailsLoading(false);
    }
  };
const handleDelete = async (userId) => {
  if (!window.confirm("Remove this user from trainers?")) {
    return;
  }

  setError("");

  try {
    await axios.delete(`/api/trainers/${userId}`);

    if (
      selectedTrainer &&
      selectedTrainer.TrainerID === userId
    ) {
      closeDetails();
    }

    await fetchTrainers();

  } catch (err) {
    console.error(err);

    setError(
      err.response?.data?.error ||
      "Failed to delete trainer"
    );
  }
};
  const closeDetails = () => {
    setSelectedTrainer(null);
    setAthletes([]);
  };

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Trainers
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-bold mb-5">
          Make Existing User a Trainer
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >

          <div>
            <label className="block mb-1 font-medium">
              Select User
            </label>

            <select
              name="UserID"
              value={form.UserID}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-3"
            >
              <option value="">
                Select user
              </option>

              {users.map((user) => (
                <option
                  key={user.USERID}
                  value={user.USERID}
                >
                  {user.FIRSTNAME} {user.LASTNAME} - {user.EMAIL}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Certification Number
            </label>

            <input
              type="text"
              name="CertificationNo"
              value={form.CertificationNo}
              onChange={handleChange}
              placeholder="CERT-001"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Years of Experience
            </label>

            <input
              type="number"
              name="YearsExperience"
              value={form.YearsExperience}
              onChange={handleChange}
              min="0"
              required
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="bg-garmin-blue text-white px-6 py-3 rounded-lg font-semibold"
            >
              Make User a Trainer
            </button>
          </div>

        </form>
      </div>

      {loading ? (
        <p>Loading trainers...</p>
      ) : trainers.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-500">
            No trainers found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {trainers.map((trainer) => (
            <div
              key={trainer.TrainerID}
              className="bg-white rounded-xl shadow p-6"
            >

              <div className="text-4xl mb-4">
                🏋️
              </div>

              <h2 className="text-xl font-bold mb-2">
                {trainer.TrainerFirstName}{" "}
                {trainer.TrainerLastName}
              </h2>

              <div className="space-y-2 text-gray-600">

                <p>
                  <strong>Certification:</strong>{" "}
                  {trainer.CertificationNo}
                </p>

                <p>
                  <strong>Experience:</strong>{" "}
                  {trainer.YearsExperience} years
                </p>

                <p>
                  <strong>Athletes:</strong>{" "}
                  {trainer.AthleteCount}
                </p>

              </div>

              <div className="mt-5 flex gap-2">

  <button
    onClick={() => viewTrainer(trainer)}
    className="bg-garmin-blue text-white px-5 py-2 rounded-lg font-semibold"
  >
    View Trainer
  </button>

  <button
    onClick={() => handleDelete(trainer.TrainerID)}
    className="bg-red-100 text-red-700 px-5 py-2 rounded-lg font-semibold"
  >
    Delete
  </button>

</div>

            </div>
          ))}

        </div>
      )}

      {selectedTrainer && (
        <div className="mt-8 bg-white rounded-xl shadow p-6">

          <div className="flex justify-between items-center mb-6">

            <div>
              <h2 className="text-2xl font-bold">
                {selectedTrainer.TrainerFirstName}{" "}
                {selectedTrainer.TrainerLastName}
              </h2>

              <p className="text-gray-500">
                {selectedTrainer.CertificationNo} •{" "}
                {selectedTrainer.YearsExperience} years experience
              </p>
            </div>

            <button
              onClick={closeDetails}
              className="border px-4 py-2 rounded-lg"
            >
              Close
            </button>

          </div>

          <h3 className="text-xl font-bold mb-4">
            Supervised Athletes
          </h3>

          {detailsLoading ? (
            <p>Loading athletes...</p>
          ) : athletes.length === 0 ? (
            <p className="text-gray-500">
              No supervised athletes found.
            </p>
          ) : (
            <div className="space-y-5">

              {athletes.map((athlete) => (
                <div
                  key={`${athlete.AthleteID}-${athlete.ActivityID}`}
                  className="border rounded-xl p-5"
                >

                  <div className="flex justify-between items-start">

                    <div>
                      <h4 className="text-lg font-bold">
                        {athlete.AthleteFirstName}{" "}
                        {athlete.AthleteLastName}
                      </h4>

                      <p className="text-gray-500">
                        {athlete.SportType} •{" "}
                        {athlete.SkillLevel}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        Rating: {athlete.PerformanceRating}/10
                      </p>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-sm">

                    <div>
                      <p className="text-gray-500">
                        Activity
                      </p>
                      <p className="font-semibold">
                        {athlete.ActivityType}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">
                        Distance
                      </p>
                      <p className="font-semibold">
                        {athlete.Distance} km
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">
                        Duration
                      </p>
                      <p className="font-semibold">
                        {athlete.Duration} min
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">
                        Date
                      </p>
                      <p className="font-semibold">
                        {athlete.ActivityDate}
                      </p>
                    </div>

                  </div>

                  <div className="mt-4 bg-gray-50 rounded-lg p-3">
                    <p className="text-sm">
                      <strong>Session Notes:</strong>{" "}
                      {athlete.SessionNotes || "No notes"}
                    </p>
                  </div>

                </div>
              ))}

            </div>
          )}

        </div>
      )}

    </div>
  );
}