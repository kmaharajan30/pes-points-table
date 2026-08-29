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
      // Don't redirect if we're on the admin page or if it's an admin login attempt
      const isAdminPage = window.location.pathname.startsWith('/admin');
      const isLoginAttempt = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/admin/');
      if (!isAdminPage && !isLoginAttempt) {
        localStorage.removeItem('fp_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const login           = (data) => axios.post(`${BASE}/auth/login`, data);
export const getGroupMembers = ()     => axios.get(`${BASE}/auth/group-members`);

// Admin Auth
export const adminCreate = (data) => axios.post(`${BASE}/admin/create`, data);
export const adminLogin  = (data) => axios.post(`${BASE}/admin/login`, data);

// Global Teams
export const getGlobalTeams    = ()           => axios.get(`${BASE}/global-teams`);
export const createGlobalTeam  = (data)       => axios.post(`${BASE}/global-teams`, data);
export const renameGlobalTeam  = (id, data)   => axios.put(`${BASE}/global-teams/${id}`, data);
export const deleteGlobalTeam  = (id)         => axios.delete(`${BASE}/global-teams/${id}`);

// Seasons
export const getSeasons           = ()         => axios.get(`${BASE}/seasons`);
export const createSeason         = ()         => axios.post(`${BASE}/seasons`);
export const completeSeason       = (num)      => axios.post(`${BASE}/seasons/${num}/complete`);
export const migrateToSeason1     = ()         => axios.post(`${BASE}/seasons/migrate-to-season1`);

// Tournaments
export const getTournaments    = (season)   => axios.get(`${BASE}/tournaments${season !== undefined ? `?season=${season}` : ''}`);
export const createTournament  = (data)     => axios.post(`${BASE}/tournaments`, data);
export const deleteTournament  = (id)       => axios.delete(`${BASE}/tournaments/${id}`);

// Teams
export const getTeams   = (tId)          => axios.get(`${BASE}/tournaments/${tId}/teams`);
export const createTeam = (tId, data)    => axios.post(`${BASE}/tournaments/${tId}/teams`, data);
export const renameTeam = (tId, teamId, data) => axios.put(`${BASE}/tournaments/${tId}/teams/${teamId}`, data);
export const deleteTeam = (tId, teamId)  => axios.delete(`${BASE}/tournaments/${tId}/teams/${teamId}`);

// Fixtures
export const getFixtures        = (tId)            => axios.get(`${BASE}/tournaments/${tId}/fixtures`);
export const createFixture      = (tId, data)      => axios.post(`${BASE}/tournaments/${tId}/fixtures`, data);
export const addResult          = (tId, fId, data) => axios.put(`${BASE}/tournaments/${tId}/fixtures/${fId}/result`, data);
export const deleteFixture      = (tId, fId)       => axios.delete(`${BASE}/tournaments/${tId}/fixtures/${fId}`);
export const generateFixtures   = (tId, data) => axios.post(`${BASE}/tournaments/${tId}/generate-fixtures`, data || {});
export const knockoutAdvance    = (tId)            => axios.post(`${BASE}/tournaments/${tId}/knockout-advance`);
export const getKnockoutBracket = (tId)            => axios.get(`${BASE}/tournaments/${tId}/knockout-bracket`);

// Points Table
export const getTable = (tId) => axios.get(`${BASE}/tournaments/${tId}/table`);

// Cross-tournament Stats
export const getStats = (season) => axios.get(`${BASE}/stats${season !== undefined ? `?season=${season}` : ''}`);

// Group Knockout
export const getGroupTables           = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-tables`);
export const getGroupFixtures         = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-fixtures`);
export const getGroupKnockout         = (tId) => axios.get(`${BASE}/tournaments/${tId}/group-knockout-bracket`);
export const seedKnockout             = (tId) => axios.post(`${BASE}/tournaments/${tId}/seed-knockout`);
export const resetKnockoutSeeds       = (tId) => axios.post(`${BASE}/tournaments/${tId}/reset-knockout-seeds`);
export const seedFinal                = (tId) => axios.post(`${BASE}/tournaments/${tId}/seed-final`);
export const regenerateQuarterFinals  = (tId) => axios.post(`${BASE}/tournaments/${tId}/regenerate-quarter-finals`);

// Team Profiles
export const getTeamProfiles    = ()          => axios.get(`${BASE}/team-profiles`);
export const getTeamProfile     = (teamName)  => axios.get(`${BASE}/team-profiles/${encodeURIComponent(teamName)}`);

// Player Profiles & Rival Tracker
export const getPlayers       = ()                  => axios.get(`${BASE}/players`);
export const getTeamRivals    = (teamName1, teamName2) => axios.get(`${BASE}/team-rivals/${encodeURIComponent(teamName1)}/${encodeURIComponent(teamName2)}`);

// Season Summary
export const getSeasonSummary    = (tId)   => axios.get(`${BASE}/tournaments/${tId}/season-summary`);

// Dashboard
export const getDashboard = () => axios.get(`${BASE}/dashboard`);

// ELO Ratings
export const getEloRatings = (season) => axios.get(`${BASE}/elo-ratings${season !== undefined ? `?season=${season}` : ''}`);

// Birthday Wishes
export const getBirthdayWishes  = ()     => axios.get(`${BASE}/birthday`);
export const createBirthdayWish = (data) => axios.post(`${BASE}/birthday`, data);
export const deleteBirthdayWish = (id)   => axios.delete(`${BASE}/birthday/${id}`);
