import axios from 'axios';
import { config } from '../config';

const api = axios.create({
  baseURL: config.apiUrl as string,
});

export function createMatchSse(matchId: string): EventSource {
  const token = localStorage.getItem('gamesphere_token');
  const base = config.apiUrl.replace(/\/+$/, '');
  const url = `${base}/sse/${matchId}?token=${token}`;
  return new EventSource(url);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gamesphere_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const orgId = localStorage.getItem('gamesphere_org_id');
  if (orgId) {
    config.headers['X-Org-Id'] = orgId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('auth/google')) {
      localStorage.removeItem('gamesphere_token');
      localStorage.removeItem('gamesphere_org_id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
