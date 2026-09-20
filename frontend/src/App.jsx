import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { Card } from "./components/ui/Card";
import { useAuth } from "./contexts/AuthContext";
import Activities from "./pages/Activities";
import Nutrition from "./pages/Nutrition";
import Goals from "./pages/Goals";
import Devices from "./pages/Devices";
import Health from "./pages/Health";
import Achievements from "./pages/Achievements";
import Social from "./pages/Social";
import Trainers from "./pages/Trainers";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import SQLTerminal from "./pages/SQLTerminal";
const CookieBanner = () => {
  const [accepted, setAccepted] = useState(
    localStorage.getItem("cookiesAccepted") === "true"
  );

  if (accepted) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-2xl z-50 flex justify-between items-center">
      <div>
        <h4 className="font-bold text-lg mb-1">We use cookies</h4>
        <p className="text-sm text-gray-300">
          We use cookies to improve your experience on our site and to analyze
          site traffic.
        </p>
      </div>

      <button
        onClick={() => {
          localStorage.setItem("cookiesAccepted", "true");
          setAccepted(true);
        }}
        className="bg-garmin-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ml-4"
      >
        Accept All
      </button>
    </div>
  );
};

const PlaceholderPage = ({ title }) => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <Card>
      <p>This is the {title} page content based on schema data.</p>
    </Card>
  </div>
);

const ProtectedLayout = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
};

function App() {
  return (
    <Router>
      <CookieBanner />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="activities" element={<Activities />} />
          <Route path="nutrition" element={<Nutrition />} />
          <Route path="goals" element={<Goals />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="devices" element={<Devices />} />
          <Route path="health" element={<Health />} />
          <Route path="/social" element={<Social />} />
          <Route path="/trainers" element={<Trainers />} />
          <Route
  path="/notifications"
  element={<Notifications />}
/>
          <Route path="/profile" element={<Profile />} />
          <Route path="/sql-terminal" element={<SQLTerminal />} />
          <Route
            path="settings"
            element={<PlaceholderPage title="Settings" />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;