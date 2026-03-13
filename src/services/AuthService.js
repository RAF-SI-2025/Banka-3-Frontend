import api from "./api.js";

export const login = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
};

export const requestPasswordReset = (email) => {
  // TODO: Backend nema ovaj endpoint jos — ostaje mock
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Mock: password reset request for:", email);
      resolve({ message: "Email za reset lozinke je poslat" });
    }, 500);
  });
};
