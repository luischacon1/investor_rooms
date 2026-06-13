import axios from 'axios';

// In dev, Vite proxies /api → localhost:3000 so we use relative URLs.
// In production, set VITE_API_URL to the backend base URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('founder_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
