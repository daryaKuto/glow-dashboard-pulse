import api from '@/lib/tbClient';

/* ----------  AUTH  ---------- */
export const login = (email: string, password: string) =>
  api.post('/auth/login', { username: email, password }).then(r => r.data);

export const logout = () => api.post('/auth/logout');

/* ----------  DEVICES  ---------- */
export const listDevices = (
  page = 0,
  limit = 100,
  textSearch = ''
) =>
  api
    .get('/tenant/devices', {
      params: { page, limit, textSearch },
    })
    .then(r => (r.data.data ? r.data.data : r.data)); // TB CE vs PE shape

/* ----------  TELEMETRY  ---------- */
export const latestTelemetry = (deviceId: string, keys: string[]) =>
  api
    .get(
      `/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
      { params: { keys: keys.join(',') } }
    )
    .then(r => r.data);

/* ----------  LIVE WS  ---------- */
export const openTelemetryWS = (accessToken: string) =>
  new WebSocket(
    `${import.meta.env.VITE_TB_WS_URL}?token=${accessToken}`
  ); 