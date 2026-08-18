/** Thin fetch wrapper: attaches the bearer token, unwraps JSON, surfaces API errors. */

const TOKEN_KEY = 'smartflow.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the SmartFlow API — is the server running?', 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    // A dead session should bounce the operator back to sign-in, not spin forever.
    if (res.status === 401) setToken(null);
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

const qs = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  meta: () => request('/network/meta'),
  corridors: () => request('/network/corridors'),
  state: (params, signal) => request(`/network/state${qs(params)}`, { signal }),
  profile: () => request('/network/profile'),
  corridor: (code, params) => request(`/network/corridors/${code}${qs(params)}`),

  run: (payload) => request('/simulations/run', { method: 'POST', body: payload }),
  recommendations: (params) => request(`/simulations/recommendations${qs(params)}`),
  saveSimulation: (payload) => request('/simulations', { method: 'POST', body: payload }),
  simulations: () => request('/simulations'),
  simulation: (id) => request(`/simulations/${id}`),
  applySimulation: (id) => request(`/simulations/${id}/apply`, { method: 'POST' }),
  deleteSimulation: (id) => request(`/simulations/${id}`, { method: 'DELETE' }),

  createReport: (payload) => request('/reports', { method: 'POST', body: payload }),
  reports: () => request('/reports'),
  report: (id) => request(`/reports/${id}`),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
};
