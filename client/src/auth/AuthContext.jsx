import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearAuthToken, getAuthToken, setAuthToken } from "./tokenStorage.js";
import { fetchCurrentUser, loginRequest } from "../api/authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleExpired = () => logout();
    window.addEventListener("sppg-auth-expired", handleExpired);
    return () => window.removeEventListener("sppg-auth-expired", handleExpired);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    fetchCurrentUser()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        logout();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logout, token]);

  const login = useCallback(async ({ username, password }) => {
    const data = await loginRequest({ username, password });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === "admin",
    }),
    [token, user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  }
  return context;
}
