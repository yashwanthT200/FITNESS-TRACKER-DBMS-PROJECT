import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser({ loggedIn: true });
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }

    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post("/api/login", {
      Email: email,
      Password: password,
    });

    localStorage.setItem("token", res.data.token);

    setToken(res.data.token);
    setUser(res.data.user);

    axios.defaults.headers.common["Authorization"] =
      `Bearer ${res.data.token}`;

    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};