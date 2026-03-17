import api from "./api.js";

export const login = async (email, password) => {
  const response = await api.post("/login", { email, password });
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
};

export const logout = async () => {
  await api.post("/logout");
};

export const refreshToken = async (refreshToken) => {
  const response = await api.post("/token/refresh", {
    refresh_token: refreshToken,
  });
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
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
