import axios, { AxiosError } from 'axios';

/** Axios instance pre-configured for ThingsBoard Cloud */
const api = axios.create({
  baseURL: import.meta.env.VITE_TB_BASE_URL,
});

let refreshPromise: Promise<string> | null = null;

/** Attach access token */
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('tb_access');
  if (token) cfg.headers['X-Authorization'] = `Bearer ${token}`;
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
      error.config!.headers['X-Authorization'] = `Bearer ${newToken}`;
      return api.request(error.config!); // retry original call once
    }
    throw error;
  }
);

export default api; 