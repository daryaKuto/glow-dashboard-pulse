import axios, { AxiosError } from 'axios';

/** Axios instance pre-configured for ThingsBoard Cloud via Vite proxy */
const api = axios.create({
  baseURL: '/api/tb', // Use Vite proxy to avoid CORS issues
  timeout: 10000, // 10 second timeout for better UX
});

console.log('[tbClient] Initialized with proxy baseURL: /api/tb');

let refreshPromise: Promise<string> | null = null;

/** Attach access token */
api.interceptors.request.use((cfg) => {
  console.log('[tbClient] Making request to:', cfg.url, 'with baseURL:', cfg.baseURL);
  const token = localStorage.getItem('tb_access');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

/** Handle 401 → refresh token flow */
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const refresh = localStorage.getItem('tb_refresh');
    if (error.response?.status === 401 && refresh) {
      // -- debounce multiple 401s while a refresh is in flight
      if (!refreshPromise) {
        refreshPromise = api
          .post('/auth/token', { refreshToken: refresh })
          .then(({ data }: any) => {
            localStorage.setItem('tb_access', data.token);
            localStorage.setItem('tb_refresh', data.refreshToken);
            return data.token as string;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newToken = await refreshPromise;
      error.config!.headers['Authorization'] = `Bearer ${newToken}`;
      return api.request(error.config!); // retry original call once
    }
    throw error;
  }
);

export default api; 