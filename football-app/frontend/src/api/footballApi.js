import axios from 'axios';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// ── Attach user id to every request ──────────────────────────────────────────
axios.interceptors.request.use((config) => {
  try {
    const user = JSON.parse(localStorage.getItem('fp_user') || 'null');
    if (user?.id) {
      // Ensure headers object exists before writing
      config.headers = config.headers ?? {};
      config.headers['x-user-id'] = user.id;
    }
  } catch (_) { /* ignore parse errors */ }
  return config;
});

// ── Auto-logout on 401 (stale/invalid session) ────────────────────────────────
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fp_user');
      // Force a full page reload so App re-renders to the login screen
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login           = (data) => axios.post(`${BASE}/auth/login`, data);
export const getGroupMembers = ()     => axios.get(`${BASE}/auth/group-members`);

// Tournaments
export const getTournaments    = ()     => axios.get(`${BASE}/tournaments`);
export const createTournament  = (data) => axios.post(`${BASE}/tournaments`, data);
export const deleteTournament  = (id)   => axios.delete(`${BASE}/tournaments/${id}`);

// Teams
export const getTeams   = (tId)          => axios.get(`${BASE}/tournaments/${tId}/teams`);
export const createTeam = (tId, data)    => axios.post(`${BASE}/tournaments/${tId}/teams`, data);
export const deleteTeam = (tId, teamId)  => axios.delete(`${BASE}/tournaments/${tId}/teams/${teamId}`);

// Fixtures
export const getFixtures        = (tId)            => axios.get(`${BASE}/tournaments/${tId}/fixtures`);
export const createFixture      = (tId, data)      => axios.post(`${BASE}/tournaments/${tId}/fixtures`, data);
export const addResult          = (tId, fId, data) => axios.put(`${BASE}/tournaments/${tId}/fixtures/${fId}/result`, data);
export const deleteFixture      = (tId, fId)       => axios.delete(`${BASE}/tournaments/${tId}/fixtures/${fId}`);
export const generateFixtures   = (tId)            => axios.post(`${BASE}/tournaments/${tId}/generate-fixtures`);
export const knockoutAdvance    = (tId)            => axios.post(`${BASE}/tournaments/${tId}/knockout-advance`);
export const getKnockoutBracket = (tId)            => axios.get(`${BASE}/tournaments/${tId}/knockout-bracket`);

// Points Table
export const getTable = (tId) => axios.get(`${BASE}/tournaments/${tId}/table`);

// Group Knockout
export const getGroupTables        = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-tables`);
export const getGroupFixtures      = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-fixtures`);
export const getGroupKnockout      = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-knockout-bracket`);
export const seedKnockout          = (tId) => axios.post(`${BASE}/tournaments/${tId}/seed-knockout`);
export const seedFinal             = (tId) => axios.post(`${BASE}/tournaments/${tId}/seed-final`);
