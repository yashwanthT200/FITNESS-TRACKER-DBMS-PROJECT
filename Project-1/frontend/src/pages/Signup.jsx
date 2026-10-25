import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    DOB: "",
    Gender: "",
    Password: "",
    ConfirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.Password !== form.ConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          FirstName: form.FirstName,
          LastName: form.LastName,
          Email: form.Email,
          DOB: form.DOB,
          Gender: form.Gender,
          Password: form.Password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      navigate("/login");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    marginTop: "8px",
    marginBottom: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fa",
      }}
    >
      <div
        style={{
          width: "400px",
          padding: "40px",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>Fitness Connect</h1>

        <p style={{ color: "#666", marginBottom: "30px" }}>
          Create your account
        </p>

        {error && (
          <div
            style={{
              background: "#ffe5e5",
              color: "#d00",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>First Name</label>
          <input
            type="text"
            name="FirstName"
            value={form.FirstName}
            onChange={handleChange}
            placeholder="Enter your first name"
            required
            style={inputStyle}
          />

          <label>Last Name</label>
          <input
            type="text"
            name="LastName"
            value={form.LastName}
            onChange={handleChange}
            placeholder="Enter your last name"
            required
            style={inputStyle}
          />

          <label>Email</label>
          <input
            type="email"
            name="Email"
            value={form.Email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
            style={inputStyle}
          />

          <label>Date of Birth</label>
          <input
            type="date"
            name="DOB"
            value={form.DOB}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <label>Gender</label>
          <select
            name="Gender"
            value={form.Gender}
            onChange={handleChange}
            required
            style={inputStyle}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          <label>Password</label>
          <input
            type="password"
            name="Password"
            value={form.Password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
            style={inputStyle}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            name="ConfirmPassword"
            value={form.ConfirmPassword}
            onChange={handleChange}
            placeholder="Confirm your password"
            required
            style={{
              ...inputStyle,
              marginBottom: "25px",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: "#0788d1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p
          style={{
            marginTop: "25px",
            fontSize: "13px",
            color: "#888",
            textAlign: "center",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{
              color: "#0788d1",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}