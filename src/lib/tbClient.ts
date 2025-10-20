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
  console.log('[tbClient] Making request to:', cfg.url);
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
      console.log('[tbClient] 401 error detected, attempting token refresh...');
      
      // -- debounce multiple 401s while a refresh is in flight
      if (!refreshPromise) {
        refreshPromise = api
          .post('/auth/token', { refreshToken: refresh })
          .then(({ data }: any) => {
            console.log('[tbClient] Token refresh successful');
            localStorage.setItem('tb_access', data.token);
            localStorage.setItem('tb_refresh', data.refreshToken);
            return data.token as string;
          })
          .catch((refreshError) => {
            console.error('[tbClient] Token refresh failed:', refreshError);
            // Clear invalid tokens
            localStorage.removeItem('tb_access');
            localStorage.removeItem('tb_refresh');
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      
      try {
        const newToken = await refreshPromise;
        error.config!.headers['Authorization'] = `Bearer ${newToken}`;
        return api.request(error.config!); // retry original call once
      } catch (refreshError) {
        console.log('[tbClient] Token refresh failed, clearing tokens and triggering re-auth');
        localStorage.removeItem('tb_access');
        localStorage.removeItem('tb_refresh');
        
        // Trigger secure re-authentication
        try {
          const { unifiedDataService } = await import('@/services/unified-data');
          const { data: { user } } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getUser());
          if (user) {
            console.log('[tbClient] Triggering secure re-authentication');
            await unifiedDataService.getThingsBoardData(user.id, user.email);
          }
        } catch (reAuthError) {
          console.log('[tbClient] Re-authentication failed, user may need to logout/login');
        }
        
        throw error; // Re-throw original error
      }
    }
    throw error;
  }
);

export default api; 