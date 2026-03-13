import axios from "axios";

// U dev modu (Vite): VITE_API_URL=http://localhost:8080 iz .env → direktno na backend
// U Docker modu: VITE_API_URL nije setovan pri buildu → "/api" → nginx prosledjuje na gateway:8080
const baseURL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
