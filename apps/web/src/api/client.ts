import axios from 'axios';

export const http = axios.create({ baseURL: '/api', timeout: 60000 });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function errMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const m = (e.response?.data as { message?: string | string[] })?.message;
    if (Array.isArray(m)) return m.join('；');
    return m || e.message || '请求失败';
  }
  return String(e);
}
