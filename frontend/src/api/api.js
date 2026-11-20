import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// ----- Token storage helpers -----
// Remember Me ticked  -> localStorage   (survives closing the browser)
// Remember Me unticked -> sessionStorage (cleared when the tab closes)
export const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

export const saveToken = (token, remember = false) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem("token", token);
};

export const clearToken = () => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
};

// Before EVERY request: attach the JWT token if we have one
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// After EVERY response: if the token is rejected, force the user to log in again
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isLoginRequest = url.includes("/auth/login") || url.includes("/auth/google");
    if (error.response?.status === 401 && !isLoginRequest) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;