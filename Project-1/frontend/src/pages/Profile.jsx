import { useEffect, useState } from "react";
import axios from "axios";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    DOB: "",
    Gender: "",
    PhoneNumber: ""
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await axios.get("/api/profile");

      setProfile(response.data);

      setForm({
        FirstName: response.data.FirstName || "",
        LastName: response.data.LastName || "",
        Email: response.data.Email || "",
        DOB: response.data.DOB || "",
        Gender: response.data.Gender || "",
        PhoneNumber: response.data.PhoneNumber || ""
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load profile");
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      const response = await axios.put("/api/profile", form);

      setMessage(response.data.message);

      await loadProfile();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to update profile"
      );
    }
  };

  if (!profile) {
    return (
      <div className="profile-loading">
        Loading profile...
      </div>
    );
  }

  const initials =
    `${form.FirstName?.[0] || ""}${form.LastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="profile-page">

      <div className="profile-heading">
        <div>
          <h1>My Profile</h1>
          <p>Manage your personal information and account details.</p>
        </div>
      </div>

      <div className="profile-layout">

        <div className="profile-card profile-summary">

          <div className="profile-avatar">
            {initials}
          </div>

          <h2>
            {form.FirstName} {form.LastName}
          </h2>

          <p className="profile-email">
            {form.Email}
          </p>

          <div className="profile-divider"></div>

          <div className="profile-summary-item">
            <span>Account ID</span>
            <strong>#{profile.UserID}</strong>
          </div>

          <div className="profile-summary-item">
            <span>Gender</span>
            <strong>{form.Gender || "Not specified"}</strong>
          </div>

          <div className="profile-summary-item">
            <span>Phone</span>
            <strong>{form.PhoneNumber || "Not added"}</strong>
          </div>

        </div>

        <div className="profile-card profile-form-card">

          <div className="section-title">
            <h2>Personal Information</h2>
            <p>Update the information associated with your account.</p>
          </div>

          {message && (
            <div className="profile-success">
              ✓ {message}
            </div>
          )}

          {error && (
            <div className="profile-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="form-grid">

              <div className="form-group">
                <label>First Name</label>
                <input
                  name="FirstName"
                  value={form.FirstName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  name="LastName"
                  value={form.LastName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Email Address</label>
                <input
                  name="Email"
                  type="email"
                  value={form.Email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  name="DOB"
                  type="date"
                  value={form.DOB}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select
                  name="Gender"
                  value={form.Gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Phone Number</label>
                <input
                  name="PhoneNumber"
                  type="tel"
                  value={form.PhoneNumber}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </div>

            </div>

            <div className="form-actions">
              <button type="submit" className="save-profile-btn">
                Save Changes
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
}