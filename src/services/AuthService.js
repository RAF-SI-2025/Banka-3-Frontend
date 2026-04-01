import api from "./api.js";
import { clearClientCache } from "./ClientService.js";

export const login = async (email, password) => {
  const response = await api.post("/login", { email, password });
  return {
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    userId: response.data.userId,
  };
};

export const logout = async () => {
  await api.post("/logout");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userId");
  localStorage.removeItem("userRole");
  clearClientCache();
};

export const refreshToken = async (refreshToken) => {
  const response = await api.post("/token/refresh", {
    refresh_token: refreshToken,
  });
  return {
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
  };
};

export const requestPasswordReset = async (email) => {
  const response = await api.post("/password-reset/request", { email });
  return response.data;
};

export const confirmPasswordReset = async (token, newPassword) => {
  await api.post("/password-reset/confirm", {
    token,
    password: newPassword,
  });
};

export const getCurrentUserId = () => {
  return localStorage.getItem("userId");
};

export const getTokenPayload = () => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

export const getCurrentUserEmail = () => {
  return getTokenPayload()?.sub || null;
};
