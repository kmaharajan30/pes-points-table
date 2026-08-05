require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@libsql/client');
const path     = require('path');

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────
let db;

function initDb() {
  if (process.env.TURSO_DATABASE_URL) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('📡 Connected to Turso Cloud database');
  } else {
    const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'football.db');
    db = createClient({ url: 'file:' + DB_PATH });
    console.log('💾 Using local SQLite file:', DB_PATH);
  }
}

// ─── Presence ─────────────────────────────────────────────────────────────────
const presence = new Map();
function broadcastPresence(code) {
  if (!presence.has(code)) return;
  const users = Array.from(presence.get(code).values()).map(u => ({ id: u.id, name: u.name, joinedAt: u.joinedAt }));
  const data  = `data: ${JSON.stringify(users)}\n\n`;
  presence.get(code).forEach(u => { try { u.res.write(data); } catch(_) {} });
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.headers['x-user-id'] || ''] });
    if (result.rows.length === 0) return res.status(401).json({ error: 'Not authenticated' });
    req.user = result.rows[0];
    next();
  } catch(e) {
    res.status(500).json({ error: 'Server error' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function enrichFixture(f, tm) {
  return {
    id: f.id, tournamentId: f.tournament_id,
    homeTeamId: f.home_team_id, awayTeamId: f.away_team_id,
    date: f.date, played: f.played === 1,
    homeScore: f.home_score, awayScore: f.away_score,
    round: f.round, matchNumber: f.match_number, leg: f.leg,
    fixtureType: f.fixture_type,
    groupName: f.group_name || null,
    homeTeam: f.home_team_id && tm[f.home_team_id] ? { id: tm[f.home_team_id].id, name: tm[f.home_team_id].name } : null,
    awayTeam: f.away_team_id && tm[f.away_team_id] ? { id: tm[f.away_team_id].id, name: tm[f.away_team_id].name } : null,
  };
}

async function teamMap(tournamentId) {
  const result = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id = ?', args: [tournamentId] });
  return Object.fromEntries(result.rows.map(t => [t.id, t]));
}

async function computeTable(tournamentId) {
  const teamsRes = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id = ?', args: [tournamentId] });
  const fixRes   = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id = ? AND played = 1 AND fixture_type = ?', args: [tournamentId, 'league'] });
  const stats = {};
  teamsRes.rows.forEach(t => { stats[t.id] = { teamId: t.id, name: t.name, mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; });
  fixRes.rows.forEach(f => {
    const home = stats[f.home_team_id], away = stats[f.away_team_id];
    if (!home || !away) return;
    home.mp++; away.mp++;
    home.gf += f.home_score; home.ga += f.away_score;
    away.gf += f.away_score; away.ga += f.home_score;
    if      (f.home_score > f.away_score) { home.w++; home.pts+=3; away.l++; }
    else if (f.home_score < f.away_score) { away.w++; away.pts+=3; home.l++; }
    else                                   { home.d++; home.pts+=1; away.d++; away.pts+=1; }
  });
  return Object.values(stats).map(s => ({...s, gd: s.gf-s.ga}))
    .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
}

async function computeGroupTable(tournamentId, groupName) {
  const teamsRes = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id=? AND group_name=?', args: [tournamentId, groupName] });
  const fixRes   = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND played=1 AND fixture_type=? AND group_name=?', args: [tournamentId, 'group_league', groupName] });
  const stats = {};
  teamsRes.rows.forEach(t => { stats[t.id] = { teamId: t.id, name: t.name, groupName, mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; });
  fixRes.rows.forEach(f => {
    const home = stats[f.home_team_id], away = stats[f.away_team_id];
    if (!home || !away) return;
    home.mp++; away.mp++;
    home.gf += f.home_score; home.ga += f.away_score;
    away.gf += f.away_score; away.ga += f.home_score;
    if      (f.home_score > f.away_score) { home.w++; home.pts+=3; away.l++; }
    else if (f.home_score < f.away_score) { away.w++; away.pts+=3; home.l++; }
    else                                   { home.d++; home.pts+=1; away.d++; away.pts+=1; }
  });
  return Object.values(stats).map(s => ({...s, gd: s.gf-s.ga}))
    .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
}

// ─── Fixture generators (pure functions, no DB) ──────────────────────────────

function generateGroupLeagueFixtures(teams, tournamentId, legs=2) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[i].id, away_team_id: teams[j].id, fixture_type: 'group_league', group_name: teams[i].group_name, leg: 1 });
      if (legs === 2) {
        fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[j].id, away_team_id: teams[i].id, fixture_type: 'group_league', group_name: teams[i].group_name, leg: 2 });
      }
    }
  }
  return fixtures;
}

function generateGroupKnockoutStage(tournamentId, numGroups) {
  const fixtures = [];
  if (numGroups >= 4) {
    // 4 groups → Quarter-finals (4 matches, 2 legs each)
    for (let m = 1; m <= 4; m++) {
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: m, leg: 1, group_name: null });
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: m, leg: 2, group_name: null });
    }
    // Semi-finals (2 matches, 2 legs each)
    for (let m = 1; m <= 2; m++) {
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 2, match_number: m, leg: 1, group_name: null });
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 2, match_number: m, leg: 2, group_name: null });
    }
    // Final (1 leg)
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 3, match_number: 1, leg: 1, group_name: null });
  } else {
    // 2 groups → Semi-finals (2 matches, 2 legs each)
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 1, group_name: null });
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 2, group_name: null });
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 1, group_name: null });
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 2, group_name: null });
    // Final (1 leg)
    fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 2, match_number: 1, leg: 1, group_name: null });
  }
  return fixtures;
}

function roundName(bracketSize, round) {
  const totalRounds = Math.log2(bracketSize);
  const diff = totalRounds - round;
  if (diff === 0) return 'Final';
  if (diff === 1) return 'Semi-Final';
  if (diff === 2) return 'Quarter-Final';
  if (diff === 3) return 'Round of 16';
  if (diff === 4) return 'Round of 32';
  return `Round ${round}`;
}

function generateLeagueFixtures(teams, tournamentId, legs=2) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[i].id, away_team_id: teams[j].id, fixture_type: 'league', leg: 1 });
      if (legs === 2) {
        fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[j].id, away_team_id: teams[i].id, fixture_type: 'league', leg: 2 });
      }
    }
  }
  return fixtures;
}

function generateFullKnockoutBracket(teams, tournamentId) {
  const n = teams.length;
  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const padded = [...teams];
  while (padded.length < size) padded.push(null);
  for (let i = padded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [padded[i], padded[j]] = [padded[j], padded[i]];
  }
  const totalRounds = Math.ceil(Math.log2(size));
  const allFixtures = [];
  for (let m = 0; m < size / 2; m++) {
    const home = padded[m * 2];
    const away = padded[m * 2 + 1];
    if (!home || !away) continue;
    const mn = m + 1;
    allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: home.id, away_team_id: away.id, fixture_type: 'knockout', round: 1, match_number: mn, leg: 1 });
    allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: away.id, away_team_id: home.id, fixture_type: 'knockout', round: 1, match_number: mn, leg: 2 });
  }
  let matchesInRound = size / 2;
  for (let r = 2; r <= totalRounds; r++) {
    matchesInRound = matchesInRound / 2;
    for (let m = 1; m <= matchesInRound; m++) {
      allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: r, match_number: m, leg: 1 });
      allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: r, match_number: m, leg: 2 });
    }
  }
  return { fixtures: allFixtures, totalRounds, totalTeams: n };
}

function knockoutWinner(leg1, leg2) {
  if (!leg1 || !leg2 || !leg1.played || !leg2.played) return null;
  const goalsA = leg1.home_score + leg2.away_score;
  const goalsB = leg1.away_score + leg2.home_score;
  if (goalsA > goalsB) return leg1.home_team_id;
  if (goalsB > goalsA) return leg1.away_team_id;
  if (leg1.away_score > leg2.away_score) return leg1.away_team_id;
  if (leg2.away_score > leg1.away_score) return leg1.home_team_id;
  return Math.random() < 0.5 ? leg1.home_team_id : leg1.away_team_id;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
    if (code.trim().length < 4) return res.status(400).json({ error: 'Code must be ≥ 4 characters' });
    const [n, c] = [name.trim().toLowerCase(), code.trim()];
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE code=? AND LOWER(name)=LOWER(?)', args: [c, n] });
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      return res.json({ user: { id: u.id, name: u.name, code: u.code, isAdmin: u.is_admin === 1 } });
    }
    const user = { id: uuidv4(), name: n, code: c, created_at: new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO users (id,name,code,created_at) VALUES (?,?,?,?)', args: [user.id, user.name, user.code, user.created_at] });
    res.status(201).json({ user: { id: user.id, name: user.name, code: user.code, isAdmin: false } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────
app.post('/api/admin/create', async (req, res) => {
  try {
    const { name, code, adminKey } = req.body;
    if (!name || !code || !adminKey) return res.status(400).json({ error: 'Name, code, and admin key required' });
    if (code.trim().length < 4) return res.status(400).json({ error: 'Code must be ≥ 4 characters' });
    // Validate admin key against DB
    const keyCheck = await db.execute({ sql: 'SELECT id, used_by FROM admin_keys WHERE key=?', args: [adminKey.trim()] });
    if (keyCheck.rows.length === 0) return res.status(403).json({ error: 'Invalid admin key' });
    // Check if key is already used by another user
    const keyRow = keyCheck.rows[0];
    if (keyRow.used_by) return res.status(403).json({ error: 'This admin key has already been used by another user' });
    const [n, c] = [name.trim().toLowerCase(), code.trim()];
    // Check if user already exists
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE code=? AND LOWER(name)=LOWER(?)', args: [c, n] });
    if (existing.rows.length > 0) {
      // Upgrade to admin if not already
      await db.execute({ sql: 'UPDATE users SET is_admin=1 WHERE id=?', args: [existing.rows[0].id] });
      // Mark the key as used by this user
      await db.execute({ sql: 'UPDATE admin_keys SET used_by=? WHERE id=?', args: [existing.rows[0].id, keyRow.id] });
      const u = existing.rows[0];
      return res.json({ user: { id: u.id, name: u.name, code: u.code, isAdmin: true } });
    }
    const user = { id: uuidv4(), name: n, code: c, created_at: new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO users (id,name,code,created_at,is_admin) VALUES (?,?,?,?,1)', args: [user.id, user.name, user.code, user.created_at] });
    // Mark the key as used by this new user
    await db.execute({ sql: 'UPDATE admin_keys SET used_by=? WHERE id=?', args: [user.id, keyRow.id] });
    res.status(201).json({ user: { id: user.id, name: user.name, code: user.code, isAdmin: true } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
    const [n, c] = [name.trim().toLowerCase(), code.trim()];
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE code=? AND LOWER(name)=LOWER(?) AND is_admin=1', args: [c, n] });
    if (existing.rows.length === 0) return res.status(401).json({ error: 'Invalid admin credentials' });
    const u = existing.rows[0];
    res.json({ user: { id: u.id, name: u.name, code: u.code, isAdmin: true } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/group-members', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT id,name,created_at FROM users WHERE code=?', args: [req.user.code] });
    res.json(result.rows);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Presence ─────────────────────────────────────────────────────────────────
app.get('/api/presence/:code', requireAuth, (req, res) => {
  const { code } = req.params;
  if (code !== req.user.code) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  if (!presence.has(code)) presence.set(code, new Map());
  const group = presence.get(code);
  group.set(req.user.id, { id: req.user.id, name: req.user.name, res, joinedAt: new Date().toISOString() });
  broadcastPresence(code);
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch(_) { clearInterval(hb); } }, 25000);
  req.on('close', () => { clearInterval(hb); group.delete(req.user.id); if (!group.size) presence.delete(code); else broadcastPresence(code); });
});

// ─── Tournaments ──────────────────────────────────────────────────────────────
app.get('/api/tournaments', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM tournaments WHERE code=? ORDER BY created_at DESC', args: [req.user.code] });
    const tournaments = await Promise.all(result.rows.map(async (r) => {
      let winner = null;
      try {
        if (r.type === 'league') {
          // League winner = top of the table (must have played at least 1 match)
          const table = await computeTable(r.id);
          if (table.length > 0 && table[0].mp > 0) {
            const allDone = await db.execute({ sql: 'SELECT COUNT(*) as c FROM fixtures WHERE tournament_id=? AND fixture_type=? AND played=0', args: [r.id, 'league'] });
            if (allDone.rows[0].c === 0) winner = table[0].name;
          }
        } else if (r.type === 'knockout') {
          // Knockout winner = winner of the final round
          const roundsRes = await db.execute({ sql: 'SELECT MAX(round) as r FROM fixtures WHERE tournament_id=? AND fixture_type=?', args: [r.id, 'knockout'] });
          const maxRound = roundsRes.rows[0]?.r;
          if (maxRound) {
            const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? ORDER BY leg', args: [r.id, 'knockout', maxRound] });
            const legs = finalFix.rows;
            const leg1 = legs.find(f => f.leg === 1);
            const leg2 = legs.find(f => f.leg === 2);
            const winnerId = knockoutWinner(leg1, leg2);
            if (winnerId) {
              const teamRes = await db.execute({ sql: 'SELECT name FROM teams WHERE id=?', args: [winnerId] });
              if (teamRes.rows.length > 0) winner = teamRes.rows[0].name;
            }
          }
        } else if (r.type === 'group_knockout') {
          // Group+KO winner = winner of the Final match
          const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round DESC, match_number, leg LIMIT 2', args: [r.id, 'knockout'] });
          const legs = finalFix.rows;
          if (legs.length > 0) {
            const maxRound = legs[0].round;
            const roundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? AND round=?', args: [r.id, maxRound] });
            const isFinal = roundsRes.rows.length > 0 && roundsRes.rows[0].round_name === 'Final';
            if (isFinal) {
              const leg1 = legs.find(f => f.leg === 1);
              // Final in group_knockout is single leg
              if (leg1 && leg1.played) {
                const winnerId = leg1.home_score > leg1.away_score ? leg1.home_team_id
                  : leg1.away_score > leg1.home_score ? leg1.away_team_id : null;
                if (winnerId) {
                  const teamRes = await db.execute({ sql: 'SELECT name FROM teams WHERE id=?', args: [winnerId] });
                  if (teamRes.rows.length > 0) winner = teamRes.rows[0].name;
                }
              }
            }
          }
        }
      } catch(_) {}
      return { id:r.id, name:r.name, season:r.season, type:r.type, numGroups:r.num_groups, legs:r.legs, createdAt:r.created_at, winner };
    }));
    res.json(tournaments);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, season, type='league', num_groups=2, legs=2, teamIds=[] } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!['league','knockout','group_knockout'].includes(type)) return res.status(400).json({ error: 'type must be league, knockout, or group_knockout' });
    // Prevent duplicate tournament names (case-insensitive) within same group
    const dupCheck = await db.execute({ sql: 'SELECT id FROM tournaments WHERE code=? AND LOWER(name)=LOWER(?)', args: [req.user.code, name.trim()] });
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Tournament with this name already exists' });
    const numGroups = type === 'group_knockout' ? Math.max(2, parseInt(num_groups)||2) : null;
    const numLegs   = type === 'group_knockout' ? (parseInt(legs)===1 ? 1 : 2) : (type === 'league' ? (parseInt(legs)===1 ? 1 : 2) : null);
    const t = { id:uuidv4(), code:req.user.code, name:name.trim(), season:season||'', type, num_groups:numGroups, legs:numLegs, created_at:new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO tournaments (id,code,name,season,type,num_groups,legs,created_at) VALUES (?,?,?,?,?,?,?,?)', args: [t.id,t.code,t.name,t.season,t.type,t.num_groups,t.legs,t.created_at] });

    // If global team IDs provided, copy them into this tournament
    if (Array.isArray(teamIds) && teamIds.length > 0) {
      const globalTeams = await db.execute({ sql: `SELECT * FROM global_teams WHERE code=? AND id IN (${teamIds.map(()=>'?').join(',')})`, args: [req.user.code, ...teamIds] });
      if (globalTeams.rows.length > 0) {
        const stmts = globalTeams.rows.map(gt => ({
          sql: 'INSERT INTO teams (id,tournament_id,name) VALUES (?,?,?)',
          args: [uuidv4(), t.id, gt.name]
        }));
        await db.batch(stmts, 'write');
      }
    }

    res.status(201).json({ id:t.id, name:t.name, season:t.season, type:t.type, numGroups:t.num_groups, legs:t.legs, createdAt:t.created_at });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tournaments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.id, req.user.code] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await db.execute({ sql: 'DELETE FROM tournaments WHERE id=?', args: [req.params.id] });
    res.json({ message: 'Deleted' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Global Teams ─────────────────────────────────────────────────────────────
app.get('/api/global-teams', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM global_teams WHERE code=? ORDER BY name ASC', args: [req.user.code] });
    res.json(result.rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at })));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/global-teams', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    const dupCheck = await db.execute({ sql: 'SELECT id FROM global_teams WHERE code=? AND LOWER(name)=LOWER(?)', args: [req.user.code, name.trim()] });
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Team with this name already exists' });
    const team = { id: uuidv4(), code: req.user.code, name: name.trim(), created_at: new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO global_teams (id,code,name,created_at) VALUES (?,?,?,?)', args: [team.id, team.code, team.name, team.created_at] });
    res.status(201).json({ id: team.id, name: team.name, createdAt: team.created_at });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/global-teams/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    const existing = await db.execute({ sql: 'SELECT * FROM global_teams WHERE id=? AND code=?', args: [req.params.id, req.user.code] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    const dupCheck = await db.execute({ sql: 'SELECT id FROM global_teams WHERE code=? AND LOWER(name)=LOWER(?) AND id!=?', args: [req.user.code, name.trim(), req.params.id] });
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Team with this name already exists' });
    await db.execute({ sql: 'UPDATE global_teams SET name=? WHERE id=?', args: [name.trim(), req.params.id] });
    res.json({ id: req.params.id, name: name.trim() });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/global-teams/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await db.execute({ sql: 'SELECT * FROM global_teams WHERE id=? AND code=?', args: [req.params.id, req.user.code] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    await db.execute({ sql: 'DELETE FROM global_teams WHERE id=?', args: [req.params.id] });
    res.json({ message: 'Deleted' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Teams ────────────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/teams', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id=?', args: [req.params.tId] });
    res.json(result.rows.map(r => ({ id:r.id, name:r.name, tournamentId:r.tournament_id, groupName:r.group_name })));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:tId/teams', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const tCheck = await db.execute({ sql: 'SELECT id FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tCheck.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    // Prevent duplicate team names (case-insensitive)
    const dupCheck = await db.execute({ sql: 'SELECT id FROM teams WHERE tournament_id=? AND LOWER(name)=LOWER(?)', args: [req.params.tId, name.trim()] });
    if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Team with this name already exists' });
    const team = { id:uuidv4(), tournament_id:req.params.tId, name:name.trim() };
    await db.execute({ sql: 'INSERT INTO teams (id,tournament_id,name) VALUES (?,?,?)', args: [team.id, team.tournament_id, team.name] });
    res.status(201).json({ id:team.id, name:team.name, tournamentId:team.tournament_id });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/tournaments/:tId/teams/:teamId', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    const tCheck = await db.execute({ sql: 'SELECT * FROM teams WHERE id=? AND tournament_id=?', args: [req.params.teamId, req.params.tId] });
    if (tCheck.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    await db.execute({ sql: 'UPDATE teams SET name=? WHERE id=?', args: [name.trim(), req.params.teamId] });
    res.json({ id: req.params.teamId, name: name.trim(), tournamentId: req.params.tId });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tournaments/:tId/teams/:teamId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { teamId } = req.params;
    await db.execute({ sql: 'DELETE FROM fixtures WHERE home_team_id=? OR away_team_id=?', args: [teamId, teamId] });
    await db.execute({ sql: 'DELETE FROM teams WHERE id=?', args: [teamId] });
    res.json({ message: 'Team and related fixtures deleted' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Generate Fixtures ────────────────────────────────────────────────────────
app.post('/api/tournaments/:tId/generate-fixtures', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const t = tRes.rows[0];

    const teamsRes = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id=?', args: [req.params.tId] });
    const teams = teamsRes.rows;
    if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams' });

    let overrideLegs = null;
    if (t.type === 'group_knockout') {
      const bodyLegs = Number(req.body?.legs);
      overrideLegs = (Number.isFinite(bodyLegs) && bodyLegs === 1) ? 1 : 2;
      // Allow overriding num_groups from the request body (e.g. re-draw with different group count)
      const bodyNumGroups = parseInt(req.body?.num_groups);
      if (Number.isFinite(bodyNumGroups) && bodyNumGroups >= 2) {
        await db.execute({ sql: 'UPDATE tournaments SET legs=?, num_groups=? WHERE id=?', args: [overrideLegs, bodyNumGroups, req.params.tId] });
        t.num_groups = bodyNumGroups;
      } else {
        await db.execute({ sql: 'UPDATE tournaments SET legs=? WHERE id=?', args: [overrideLegs, req.params.tId] });
      }
    }

    // Clear existing fixtures
    await db.execute({ sql: 'DELETE FROM fixtures WHERE tournament_id=?', args: [req.params.tId] });
    await db.execute({ sql: 'DELETE FROM knockout_rounds WHERE tournament_id=?', args: [req.params.tId] });

    if (t.type === 'league') {
      const fixtures = generateLeagueFixtures(teams, req.params.tId);
      const stmts = fixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,null,null,f.leg,null] }));
      await db.batch(stmts, 'write');
      res.json({ message: `Generated ${fixtures.length} league fixtures`, count: fixtures.length });

    } else if (t.type === 'knockout') {
      const { fixtures, totalRounds, totalTeams } = generateFullKnockoutBracket(teams, req.params.tId);
      const stmts = fixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,f.round,f.match_number,f.leg,null] }));
      await db.batch(stmts, 'write');
      const totalSize = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
      const roundStmts = [];
      for (let r = 1; r <= totalRounds; r++) {
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, r, roundName(totalSize, r)] });
      }
      await db.batch(roundStmts, 'write');
      res.json({ message: `Generated full knockout bracket`, count: fixtures.length, totalRounds });

    } else if (t.type === 'group_knockout') {
      const numGroups = t.num_groups || 2;
      if (teams.length < numGroups * 2) return res.status(400).json({ error: `Need at least ${numGroups * 2} teams for ${numGroups} groups` });
      const legsToUse = overrideLegs !== null ? overrideLegs : (t.legs || 2);

      const groupLetters = Array.from({length: numGroups}, (_, i) => String.fromCharCode(65 + i));
      const shuffled = [...teams];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const groupUpdates = [];
      shuffled.forEach((team, idx) => {
        const grp = groupLetters[idx % numGroups];
        groupUpdates.push({ sql: 'UPDATE teams SET group_name=? WHERE id=?', args: [grp, team.id] });
        team.group_name = grp;
      });
      await db.batch(groupUpdates, 'write');

      const allGroupFixtures = [];
      for (const grp of groupLetters) {
        const grpTeams = shuffled.filter(t => t.group_name === grp);
        allGroupFixtures.push(...generateGroupLeagueFixtures(grpTeams, req.params.tId, legsToUse));
      }
      const knockoutFixtures = generateGroupKnockoutStage(req.params.tId, numGroups);

      const roundStmts = [];
      if (numGroups >= 4) {
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 1, 'Quarter-Final'] });
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 2, 'Semi-Final'] });
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 3, 'Final'] });
      } else {
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 1, 'Semi-Final'] });
        roundStmts.push({ sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 2, 'Final'] });
      }

      const allStmts = [
        ...allGroupFixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,null,null,f.leg,f.group_name] })),
        ...knockoutFixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,f.round,f.match_number,f.leg,null] })),
        ...roundStmts,
      ];
      await db.batch(allStmts, 'write');
      res.json({ message: `Generated group stage + knockout`, groupCount: numGroups, groupFixtures: allGroupFixtures.length, knockoutFixtures: knockoutFixtures.length, legs: legsToUse, hasQuarterFinal: numGroups >= 4 });
    }
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Knockout advance ─────────────────────────────────────────────────────────
app.post('/api/tournaments/:tId/knockout-advance', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || !['knockout','group_knockout'].includes(tRes.rows[0].type)) return res.status(400).json({ error: 'Not a knockout tournament' });

    const maxRes = await db.execute({ sql: 'SELECT MAX(round) as r FROM fixtures WHERE tournament_id=? AND fixture_type=?', args: [req.params.tId, 'knockout'] });
    const maxRound = maxRes.rows[0]?.r;
    if (!maxRound) return res.status(400).json({ error: 'No knockout fixtures found' });

    const fixRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=?', args: [req.params.tId, 'knockout', maxRound] });
    const allFixtures = fixRes.rows;
    const matchNumbers = [...new Set(allFixtures.map(f => f.match_number))];

    const winners = [];
    for (const mn of matchNumbers) {
      const legs = allFixtures.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
      const leg1 = legs.find(f => f.leg === 1);
      const leg2 = legs.find(f => f.leg === 2);
      const winner = knockoutWinner(leg1, leg2);
      if (!winner) return res.status(400).json({ error: `Match ${mn} of round ${maxRound} is not complete yet` });
      winners.push(winner);
    }

    if (winners.length === 1) return res.json({ message: 'Tournament complete', champion: winners[0], done: true });

    const nextRound = maxRound + 1;
    const nextRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? ORDER BY match_number,leg', args: [req.params.tId, 'knockout', nextRound] });
    if (nextRes.rows.length === 0) return res.status(400).json({ error: 'No next round fixtures found.' });

    const updates = [];
    for (let i = 0; i < winners.length; i += 2) {
      const homeWinner = winners[i];
      const awayWinner = winners[i + 1];
      if (!awayWinner) continue;
      const mn = Math.floor(i / 2) + 1;
      const leg1 = nextRes.rows.find(f => f.match_number === mn && f.leg === 1);
      const leg2 = nextRes.rows.find(f => f.match_number === mn && f.leg === 2);
      if (leg1) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [homeWinner, awayWinner, leg1.id] });
      if (leg2) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [awayWinner, homeWinner, leg2.id] });
    }
    if (updates.length > 0) await db.batch(updates, 'write');
    res.json({ message: `Advanced to round ${nextRound}`, done: false });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Knockout bracket ─────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/knockout-bracket', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'knockout') return res.status(400).json({ error: 'Not a knockout tournament' });

    await db.execute({ sql: `DELETE FROM fixtures WHERE tournament_id = ? AND home_team_id IS NOT NULL AND (home_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?) OR away_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?))`, args: [req.params.tId, req.params.tId, req.params.tId] });

    const tm = await teamMap(req.params.tId);
    const fixRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg', args: [req.params.tId, 'knockout'] });
    const roundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round', args: [req.params.tId] });

    const bracket = roundsRes.rows.map(r => {
      const roundFixtures = fixRes.rows.filter(f => f.round === r.round);
      const matchNums = [...new Set(roundFixtures.map(f => f.match_number))];
      const matches = matchNums.map(mn => {
        const legs = roundFixtures.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
        const leg1 = legs.find(f => f.leg === 1);
        const leg2 = legs.find(f => f.leg === 2);
        const hasTeams = leg1?.home_team_id && leg1?.away_team_id;
        const winner = hasTeams ? knockoutWinner(leg1, leg2) : null;
        const aggHome = (leg1?.played && leg2?.played) ? (leg1.home_score + leg2.away_score) : null;
        const aggAway = (leg1?.played && leg2?.played) ? (leg1.away_score + leg2.home_score) : null;
        return {
          matchNumber: mn,
          leg1: leg1 ? enrichFixture(leg1, tm) : null,
          leg2: leg2 ? enrichFixture(leg2, tm) : null,
          winner: winner ? { id: winner, name: tm[winner]?.name } : null,
          aggregateHome: aggHome, aggregateAway: aggAway,
          homeTeam: leg1?.home_team_id ? { id: leg1.home_team_id, name: tm[leg1.home_team_id]?.name } : null,
          awayTeam: leg1?.away_team_id ? { id: leg1.away_team_id, name: tm[leg1.away_team_id]?.name } : null,
          isPlaceholder: !hasTeams,
        };
      });
      return { round: r.round, roundName: r.round_name, matches };
    });
    res.json(bracket);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Fixtures CRUD ────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/fixtures', requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: `DELETE FROM fixtures WHERE tournament_id = ? AND ((home_team_id IS NOT NULL AND home_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?)) OR (away_team_id IS NOT NULL AND away_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?)))`, args: [req.params.tId, req.params.tId, req.params.tId] });
    const rows = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? ORDER BY fixture_type,round,match_number,leg,rowid', args: [req.params.tId] });
    const tm = await teamMap(req.params.tId);
    res.json(rows.rows.map(f => enrichFixture(f, tm)));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:tId/fixtures', requireAuth, async (req, res) => {
  try {
    const { homeTeamId, awayTeamId, date } = req.body;
    if (!homeTeamId || !awayTeamId) return res.status(400).json({ error: 'Both teams required' });
    if (homeTeamId === awayTeamId) return res.status(400).json({ error: 'Teams must differ' });
    const fix = { id:uuidv4(), tournament_id:req.params.tId, home_team_id:homeTeamId, away_team_id:awayTeamId, date:date||null, fixture_type:'league', leg:1 };
    await db.execute({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,date,fixture_type,leg) VALUES (?,?,?,?,?,?,?)', args: [fix.id,fix.tournament_id,fix.home_team_id,fix.away_team_id,fix.date,fix.fixture_type,fix.leg] });
    const tm = await teamMap(req.params.tId);
    res.status(201).json(enrichFixture(fix, tm));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/tournaments/:tId/fixtures/:fId/result', requireAuth, async (req, res) => {
  try {
    const { homeScore, awayScore, homeUserId, awayUserId } = req.body;
    if (homeScore===undefined||awayScore===undefined) return res.status(400).json({ error: 'Scores required' });
    const check = await db.execute({ sql: 'SELECT * FROM fixtures WHERE id=?', args: [req.params.fId] });
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await db.execute({ sql: 'UPDATE fixtures SET home_score=?,away_score=?,played=1 WHERE id=?', args: [+homeScore,+awayScore,req.params.fId] });

    // Save user-team mappings if provided
    const fixture = check.rows[0];
    if (homeUserId && fixture.home_team_id) {
      const existingHome = await db.execute({ sql: 'SELECT id FROM user_team_mappings WHERE user_id=? AND tournament_id=? AND team_id=?', args: [homeUserId, req.params.tId, fixture.home_team_id] });
      if (existingHome.rows.length === 0) {
        await db.execute({ sql: 'INSERT INTO user_team_mappings (id,user_id,tournament_id,team_id) VALUES (?,?,?,?)', args: [uuidv4(), homeUserId, req.params.tId, fixture.home_team_id] });
      }
    }
    if (awayUserId && fixture.away_team_id) {
      const existingAway = await db.execute({ sql: 'SELECT id FROM user_team_mappings WHERE user_id=? AND tournament_id=? AND team_id=?', args: [awayUserId, req.params.tId, fixture.away_team_id] });
      if (existingAway.rows.length === 0) {
        await db.execute({ sql: 'INSERT INTO user_team_mappings (id,user_id,tournament_id,team_id) VALUES (?,?,?,?)', args: [uuidv4(), awayUserId, req.params.tId, fixture.away_team_id] });
      }
    }
    // Save fixture-user mapping for head-to-head tracking
    if (homeUserId || awayUserId) {
      await db.execute({ sql: 'DELETE FROM fixture_user_mappings WHERE fixture_id=?', args: [req.params.fId] });
      if (homeUserId) {
        await db.execute({ sql: 'INSERT INTO fixture_user_mappings (id,fixture_id,user_id,side) VALUES (?,?,?,?)', args: [uuidv4(), req.params.fId, homeUserId, 'home'] });
      }
      if (awayUserId) {
        await db.execute({ sql: 'INSERT INTO fixture_user_mappings (id,fixture_id,user_id,side) VALUES (?,?,?,?)', args: [uuidv4(), req.params.fId, awayUserId, 'away'] });
      }
    }

    res.json({ message: 'Saved' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tournaments/:tId/fixtures/:fId', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Check the fixture type before deleting
    const check = await db.execute({ sql: 'SELECT fixture_type FROM fixtures WHERE id=?', args: [req.params.fId] });
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (check.rows[0].fixture_type === 'knockout') {
      // For knockout fixtures, reset the score instead of deleting the row.
      // Deleting a leg row causes it to vanish from the bracket, making it impossible
      // to re-enter the result from the UI.
      await db.execute({
        sql: 'UPDATE fixtures SET home_score=NULL, away_score=NULL, played=0 WHERE id=?',
        args: [req.params.fId]
      });
    } else {
      await db.execute({ sql: 'DELETE FROM fixtures WHERE id=?', args: [req.params.fId] });
    }
    res.json({ message: 'Deleted' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Group Stage API ──────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/group-tables', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });
    const grpRes = await db.execute({ sql: 'SELECT DISTINCT group_name FROM teams WHERE tournament_id=? AND group_name IS NOT NULL', args: [req.params.tId] });
    const groups = grpRes.rows.map(r => r.group_name).sort();
    const result = [];
    for (const grp of groups) {
      result.push({ group: grp, table: await computeGroupTable(req.params.tId, grp) });
    }
    res.json(result);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/tournaments/:tId/group-fixtures', requireAuth, async (req, res) => {
  try {
    const tm = await teamMap(req.params.tId);
    const rows = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY group_name,rowid', args: [req.params.tId, 'group_league'] });
    res.json(rows.rows.map(f => enrichFixture(f, tm)));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Reset knockout team assignments (clear stale seeding so re-seed works) ──
app.post('/api/tournaments/:tId/reset-knockout-seeds', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });
    // Clear all team assignments from ALL knockout rounds (set back to placeholder TBD)
    await db.execute({
      sql: 'UPDATE fixtures SET home_team_id=NULL, away_team_id=NULL, home_score=NULL, away_score=NULL, played=0 WHERE tournament_id=? AND fixture_type=?',
      args: [req.params.tId, 'knockout']
    });
    res.json({ message: 'All knockout seeds cleared. You can now re-seed from group results.' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Regenerate Quarter-Final fixtures (preserves group data + scores) ────────
// Deletes only the QF fixture rows (round 1) and recreates them as blank
// placeholders, then re-seeds from current group results so the user can
// re-enter any missing scores.
app.post('/api/tournaments/:tId/regenerate-quarter-finals', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

    // Confirm round 1 is actually a Quarter-Final
    const roundRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? AND round=1', args: [req.params.tId] });
    if (roundRes.rows.length === 0 || roundRes.rows[0].round_name !== 'Quarter-Final') {
      return res.status(400).json({ error: 'This tournament does not have a Quarter-Final round' });
    }

    // Delete all QF fixtures (round 1) and anything seeded beyond (SF + Final)
    // so the bracket is consistent — user must re-seed SF/Final after this
    await db.execute({ sql: 'DELETE FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round>=1', args: [req.params.tId, 'knockout'] });

    // Recreate blank QF fixtures (4 matches × 2 legs)
    const newFixtures = [];
    for (let m = 1; m <= 4; m++) {
      newFixtures.push({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [uuidv4(), req.params.tId, null, null, 'knockout', 1, m, 1, null] });
      newFixtures.push({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [uuidv4(), req.params.tId, null, null, 'knockout', 1, m, 2, null] });
    }

    // Recreate blank SF fixtures (2 matches × 2 legs)
    for (let m = 1; m <= 2; m++) {
      newFixtures.push({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [uuidv4(), req.params.tId, null, null, 'knockout', 2, m, 1, null] });
      newFixtures.push({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [uuidv4(), req.params.tId, null, null, 'knockout', 2, m, 2, null] });
    }

    // Recreate blank Final fixture (1 leg)
    newFixtures.push({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [uuidv4(), req.params.tId, null, null, 'knockout', 3, 1, 1, null] });

    await db.batch(newFixtures, 'write');

    // Auto-seed QF from current group standings
    const grpRes = await db.execute({ sql: 'SELECT DISTINCT group_name FROM teams WHERE tournament_id=? AND group_name IS NOT NULL ORDER BY group_name', args: [req.params.tId] });
    const actualGroups = grpRes.rows.map(r => r.group_name).sort();
    if (actualGroups.length === 4) {
      const qualifiers = {};
      for (const grp of actualGroups) {
        const table = await computeGroupTable(req.params.tId, grp);
        qualifiers[grp] = table.slice(0, 2);
      }
      const [A, B, C, D] = actualGroups;
      const qfMatches = [
        { matchNumber: 1, home: qualifiers[A][0]?.teamId, away: qualifiers[D][1]?.teamId },
        { matchNumber: 2, home: qualifiers[A][1]?.teamId, away: qualifiers[D][0]?.teamId },
        { matchNumber: 3, home: qualifiers[B][0]?.teamId, away: qualifiers[C][1]?.teamId },
        { matchNumber: 4, home: qualifiers[B][1]?.teamId, away: qualifiers[C][0]?.teamId },
      ];
      const seedUpdates = [];
      for (const qf of qfMatches) {
        if (!qf.home || !qf.away) continue;
        const leg1 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=1', args: [req.params.tId, 'knockout', qf.matchNumber] });
        const leg2 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=2', args: [req.params.tId, 'knockout', qf.matchNumber] });
        if (leg1.rows.length > 0) seedUpdates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [qf.home, qf.away, leg1.rows[0].id] });
        if (leg2.rows.length > 0) seedUpdates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [qf.away, qf.home, leg2.rows[0].id] });
      }
      if (seedUpdates.length > 0) await db.batch(seedUpdates, 'write');
    }

    res.json({ message: 'Quarter-Finals regenerated and re-seeded. Re-enter QF scores, then seed Semi-Finals.' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:tId/seed-knockout', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });
    const t = tRes.rows[0];

    // ── Determine actual bracket structure from DB (not just num_groups) ──────
    // This is the source of truth: what rounds were actually generated?
    const roundsRes = await db.execute({
      sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round',
      args: [req.params.tId]
    });
    if (roundsRes.rows.length === 0) {
      return res.status(400).json({ error: 'No knockout rounds found. Generate fixtures first.' });
    }

    const firstRound = roundsRes.rows[0]; // round 1: either 'Quarter-Final' or 'Semi-Final'
    const isQFBracket = firstRound.round_name === 'Quarter-Final';

    // ── Determine actual groups from the DB ───────────────────────────────────
    const grpRes = await db.execute({
      sql: 'SELECT DISTINCT group_name FROM teams WHERE tournament_id=? AND group_name IS NOT NULL ORDER BY group_name',
      args: [req.params.tId]
    });
    const actualGroups = grpRes.rows.map(r => r.group_name).sort();
    const numActualGroups = actualGroups.length;

    if (numActualGroups < 2) {
      return res.status(400).json({ error: 'No groups found. Generate fixtures first.' });
    }

    // ── Validate: QF bracket needs exactly 4 groups; SF bracket needs exactly 2 ─
    if (isQFBracket && numActualGroups !== 4) {
      return res.status(400).json({
        error: `Quarter-Final bracket requires 4 groups but found ${numActualGroups}. Re-draw fixtures with 4 groups first.`
      });
    }
    if (!isQFBracket && numActualGroups !== 2) {
      return res.status(400).json({
        error: `Semi-Final bracket requires 2 groups but found ${numActualGroups}. Re-draw fixtures with 2 groups first.`
      });
    }

    // ── Validate ALL group fixtures are played ────────────────────────────────
    const groupFixRes = await db.execute({
      sql: 'SELECT COUNT(*) as total, SUM(played) as done FROM fixtures WHERE tournament_id=? AND fixture_type=?',
      args: [req.params.tId, 'group_league']
    });
    const totalGroupFix = Number(groupFixRes.rows[0].total);
    const playedGroupFix = Number(groupFixRes.rows[0].done);
    if (totalGroupFix === 0) return res.status(400).json({ error: 'No group fixtures found. Generate fixtures first.' });
    if (playedGroupFix < totalGroupFix) {
      return res.status(400).json({
        error: `All group matches must be played first. ${playedGroupFix}/${totalGroupFix} played.`
      });
    }

    // ── Collect top 2 from each actual group ──────────────────────────────────
    const qualifiers = {};
    for (const grp of actualGroups) {
      const table = await computeGroupTable(req.params.tId, grp);
      if (table.length < 2) {
        return res.status(400).json({ error: `Group ${grp} has fewer than 2 teams.` });
      }
      const unplayed = table.filter(row => row.mp === 0);
      if (unplayed.length > 0) {
        return res.status(400).json({
          error: `Group ${grp}: [${unplayed.map(r => r.name).join(', ')}] have not played yet.`
        });
      }
      // Strictly top 2 only
      qualifiers[grp] = table.slice(0, 2);
    }

    const updates = [];

    if (isQFBracket) {
      // 4 groups → QF: GA1 vs GD2, GA2 vs GD1, GB1 vs GC2, GB2 vs GC1
      const [A, B, C, D] = actualGroups; // 'A','B','C','D'
      const qfMatches = [
        { matchNumber: 1, home: qualifiers[A][0].teamId, away: qualifiers[D][1].teamId },
        { matchNumber: 2, home: qualifiers[A][1].teamId, away: qualifiers[D][0].teamId },
        { matchNumber: 3, home: qualifiers[B][0].teamId, away: qualifiers[C][1].teamId },
        { matchNumber: 4, home: qualifiers[B][1].teamId, away: qualifiers[C][0].teamId },
      ];

      for (const qf of qfMatches) {
        const leg1 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=1', args: [req.params.tId, 'knockout', qf.matchNumber] });
        const leg2 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=2', args: [req.params.tId, 'knockout', qf.matchNumber] });
        if (leg1.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [qf.home, qf.away, leg1.rows[0].id] });
        if (leg2.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [qf.away, qf.home, leg2.rows[0].id] });
      }
      if (updates.length > 0) await db.batch(updates, 'write');
      return res.json({
        message: 'Quarter-finals seeded',
        seeding: `${A}1 vs ${D}2 | ${A}2 vs ${D}1 | ${B}1 vs ${C}2 | ${B}2 vs ${C}1`,
        qualifiers: Object.fromEntries(actualGroups.map(g => [
          `Group ${g}`,
          qualifiers[g].map((team, i) => `${i + 1}. ${team.name} (${team.pts}pts, GD${team.gd >= 0 ? '+' : ''}${team.gd})`)
        ]))
      });

    } else {
      // 2 groups → SF: A1 vs B2, B1 vs A2
      const [A, B] = actualGroups;
      const sfMatches = [
        { matchNumber: 1, home: qualifiers[A][0].teamId, away: qualifiers[B][1].teamId },
        { matchNumber: 2, home: qualifiers[B][0].teamId, away: qualifiers[A][1].teamId },
      ];

      for (const sf of sfMatches) {
        const leg1 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=1', args: [req.params.tId, 'knockout', sf.matchNumber] });
        const leg2 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=2', args: [req.params.tId, 'knockout', sf.matchNumber] });
        if (leg1.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [sf.home, sf.away, leg1.rows[0].id] });
        if (leg2.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [sf.away, sf.home, leg2.rows[0].id] });
      }
      if (updates.length > 0) await db.batch(updates, 'write');
      return res.json({
        message: 'Semi-finals seeded',
        seeding: `${A}1 vs ${B}2 | ${B}1 vs ${A}2`,
        qualifiers: Object.fromEntries(actualGroups.map(g => [
          `Group ${g}`,
          qualifiers[g].map((team, i) => `${i + 1}. ${team.name} (${team.pts}pts, GD${team.gd >= 0 ? '+' : ''}${team.gd})`)
        ]))
      });
    }
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:tId/seed-final', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

    // Find the highest completed round (where all matches are played)
    const roundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round', args: [req.params.tId] });
    const fixRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg', args: [req.params.tId, 'knockout'] });
    
    // Find the latest round that has teams assigned
    let currentRound = null;
    for (const r of roundsRes.rows) {
      const roundFix = fixRes.rows.filter(f => f.round === r.round);
      const hasTeams = roundFix.some(f => f.home_team_id && f.away_team_id);
      if (hasTeams) currentRound = r.round;
    }

    if (!currentRound) return res.status(400).json({ error: 'No knockout round has been seeded yet' });

    // Check if current round is the final (single leg)
    const currentRoundInfo = roundsRes.rows.find(r => r.round === currentRound);
    if (currentRoundInfo.round_name === 'Final') return res.status(400).json({ error: 'Final is already seeded' });

    // Get all fixtures of the current round and determine winners
    const currentFix = fixRes.rows.filter(f => f.round === currentRound);
    const matchNums = [...new Set(currentFix.map(f => f.match_number))].sort((a,b) => a-b);

    const winners = [];
    for (const mn of matchNums) {
      const legs = currentFix.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
      const leg1 = legs.find(f => f.leg === 1);
      const leg2 = legs.find(f => f.leg === 2);
      if (!leg1?.played || !leg2?.played) return res.status(400).json({ error: `Match ${mn} of ${currentRoundInfo.round_name} is not complete` });
      const winner = knockoutWinner(leg1, leg2);
      if (!winner) return res.status(400).json({ error: `Could not determine winner of match ${mn}` });
      winners.push(winner);
    }

    const nextRound = currentRound + 1;
    const nextRoundInfo = roundsRes.rows.find(r => r.round === nextRound);
    if (!nextRoundInfo) return res.status(400).json({ error: 'No next round found' });

    const nextFix = fixRes.rows.filter(f => f.round === nextRound);

    if (nextRoundInfo.round_name === 'Final') {
      // Seed the final (single leg)
      if (winners.length < 2) return res.status(400).json({ error: 'Need at least 2 winners to seed the final' });
      const finalFixture = nextFix.find(f => f.match_number === 1 && f.leg === 1);
      if (!finalFixture) return res.status(400).json({ error: 'Final fixture not found' });
      await db.execute({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [winners[0], winners[1], finalFixture.id] });
      res.json({ message: 'Final seeded', finalist1: winners[0], finalist2: winners[1] });
    } else {
      // Seed the next 2-leg round (e.g., QF winners → SF)
      const updates = [];
      for (let i = 0; i < winners.length; i += 2) {
        const homeWinner = winners[i];
        const awayWinner = winners[i + 1];
        if (!awayWinner) continue;
        const mn = Math.floor(i / 2) + 1;
        const leg1 = nextFix.find(f => f.match_number === mn && f.leg === 1);
        const leg2 = nextFix.find(f => f.match_number === mn && f.leg === 2);
        if (leg1) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [homeWinner, awayWinner, leg1.id] });
        if (leg2) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [awayWinner, homeWinner, leg2.id] });
      }
      if (updates.length > 0) await db.batch(updates, 'write');
      res.json({ message: `${nextRoundInfo.round_name} seeded`, round: nextRound });
    }
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/tournaments/:tId/group-knockout-bracket', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

    const tm = await teamMap(req.params.tId);
    const roundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round', args: [req.params.tId] });
    const fixRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg', args: [req.params.tId, 'knockout'] });

    // ── Auto-repair: recreate any missing leg 2 rows for 2-leg rounds ─────────
    // If a leg 2 fixture was accidentally hard-deleted, restore the placeholder row
    // so users can re-enter the score from the UI.
    const repairStmts = [];
    const isFinalRoundMap = Object.fromEntries(roundsRes.rows.map(r => [r.round, r.round_name === 'Final']));
    for (const r of roundsRes.rows) {
      if (r.round_name === 'Final') continue; // Final is single-leg, skip
      const roundFix = fixRes.rows.filter(f => f.round === r.round);
      const matchNums = [...new Set(roundFix.map(f => f.match_number))];
      for (const mn of matchNums) {
        const matchLegs = roundFix.filter(f => f.match_number === mn);
        const hasLeg1 = matchLegs.some(f => f.leg === 1);
        const hasLeg2 = matchLegs.some(f => f.leg === 2);
        if (hasLeg1 && !hasLeg2) {
          // leg 2 was deleted — recreate it with swapped home/away from leg 1
          const leg1 = matchLegs.find(f => f.leg === 1);
          repairStmts.push({
            sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)',
            args: [uuidv4(), req.params.tId, leg1.away_team_id, leg1.home_team_id, 'knockout', r.round, mn, 2, null]
          });
        }
      }
    }
    if (repairStmts.length > 0) {
      await db.batch(repairStmts, 'write');
    }

    // Re-fetch fixtures if we made repairs
    const allFix = repairStmts.length > 0
      ? (await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg', args: [req.params.tId, 'knockout'] })).rows
      : fixRes.rows;

    const bracket = roundsRes.rows.map(r => {
      const roundFixtures = allFix.filter(f => f.round === r.round);
      const matchNums = [...new Set(roundFixtures.map(f => f.match_number))];
      const isFinalRound = r.round_name === 'Final';

      const matches = matchNums.map(mn => {
        const legs = roundFixtures.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
        const leg1 = legs[0];
        const leg2 = isFinalRound ? null : legs[1];
        const hasTeams = leg1?.home_team_id && leg1?.away_team_id;
        let winner = null;
        let aggHome = null, aggAway = null;
        if (hasTeams && isFinalRound) {
          if (leg1.played) {
            winner = leg1.home_score > leg1.away_score ? leg1.home_team_id
              : leg1.away_score > leg1.home_score ? leg1.away_team_id : null;
          }
        } else if (hasTeams && leg1 && leg2) {
          winner = knockoutWinner(leg1, leg2);
          if (leg1.played && leg2.played) {
            aggHome = leg1.home_score + leg2.away_score;
            aggAway = leg1.away_score + leg2.home_score;
          }
        }
        return {
          matchNumber: mn,
          leg1: leg1 ? enrichFixture(leg1, tm) : null,
          leg2: leg2 ? enrichFixture(leg2, tm) : null,
          isFinal: isFinalRound,
          winner: winner ? { id: winner, name: tm[winner]?.name } : null,
          aggregateHome: aggHome, aggregateAway: aggAway,
          homeTeam: leg1?.home_team_id ? { id: leg1.home_team_id, name: tm[leg1.home_team_id]?.name } : null,
          awayTeam: leg1?.away_team_id ? { id: leg1.away_team_id, name: tm[leg1.away_team_id]?.name } : null,
          isPlaceholder: !hasTeams,
        };
      });
      return { round: r.round, roundName: r.round_name, matches };
    });
    res.json(bracket);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Points Table ─────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/table', requireAuth, async (req, res) => {
  try {
    res.json(await computeTable(req.params.tId));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Top Performances & Stats (cross-tournament) ──────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const code = req.user.code;

    // Get all tournaments for this code
    const tournamentsRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE code=? ORDER BY created_at DESC', args: [code] });
    const tournaments = tournamentsRes.rows;

    if (tournaments.length === 0) {
      return res.json({ topPerformers: [], bestMatch: null, topScorers: [], totalTournaments: 0 });
    }

    const tIds = tournaments.map(t => t.id);
    const placeholders = tIds.map(() => '?').join(',');

    // ─── Batch load ALL data in 4 queries total ───────────────────────────────
    const [allTeamsRes, allFixturesRes, allKnockoutRoundsRes] = await Promise.all([
      db.execute({ sql: `SELECT * FROM teams WHERE tournament_id IN (${placeholders})`, args: tIds }),
      db.execute({ sql: `SELECT * FROM fixtures WHERE tournament_id IN (${placeholders})`, args: tIds }),
      db.execute({ sql: `SELECT * FROM knockout_rounds WHERE tournament_id IN (${placeholders})`, args: tIds }),
    ]);

    // Build lookup maps
    const teamsByTournament = {}; // tId -> [teams]
    const teamById = {};          // teamId -> team
    for (const t of allTeamsRes.rows) {
      if (!teamsByTournament[t.tournament_id]) teamsByTournament[t.tournament_id] = [];
      teamsByTournament[t.tournament_id].push(t);
      teamById[t.id] = t;
    }

    const fixturesByTournament = {}; // tId -> [fixtures]
    for (const f of allFixturesRes.rows) {
      if (!fixturesByTournament[f.tournament_id]) fixturesByTournament[f.tournament_id] = [];
      fixturesByTournament[f.tournament_id].push(f);
    }

    const knockoutRoundsByTournament = {}; // tId -> [rounds]
    for (const r of allKnockoutRoundsRes.rows) {
      if (!knockoutRoundsByTournament[r.tournament_id]) knockoutRoundsByTournament[r.tournament_id] = [];
      knockoutRoundsByTournament[r.tournament_id].push(r);
    }

    // ─── Top Performers: winners & runners-up ─────────────────────────────────
    const winnerCounts = {};

    for (const t of tournaments) {
      const fixtures = fixturesByTournament[t.id] || [];
      const teams = teamsByTournament[t.id] || [];
      let winner = null, runnerUp = null;

      if (t.type === 'league') {
        // Compute table in-memory
        const leagueFixtures = fixtures.filter(f => f.played === 1 && f.fixture_type === 'league');
        const unplayed = fixtures.filter(f => f.played === 0 && f.fixture_type === 'league');
        if (leagueFixtures.length > 0 && unplayed.length === 0) {
          const stats = {};
          teams.forEach(tm => { stats[tm.id] = { name: tm.name, mp:0, gf:0, ga:0, gd:0, pts:0 }; });
          leagueFixtures.forEach(f => {
            const home = stats[f.home_team_id], away = stats[f.away_team_id];
            if (!home || !away) return;
            home.mp++; away.mp++;
            home.gf += f.home_score; home.ga += f.away_score;
            away.gf += f.away_score; away.ga += f.home_score;
            if (f.home_score > f.away_score) { home.pts += 3; }
            else if (f.home_score < f.away_score) { away.pts += 3; }
            else { home.pts += 1; away.pts += 1; }
          });
          const table = Object.values(stats)
            .map(s => ({ ...s, gd: s.gf - s.ga }))
            .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
          if (table.length > 0 && table[0].mp > 0) {
            winner = table[0].name;
            runnerUp = table[1]?.name || null;
          }
        }
      } else if (t.type === 'knockout') {
        const koFixtures = fixtures.filter(f => f.fixture_type === 'knockout');
        const maxRound = koFixtures.reduce((max, f) => Math.max(max, f.round || 0), 0);
        if (maxRound) {
          const finalLegs = koFixtures.filter(f => f.round === maxRound).sort((a, b) => a.leg - b.leg);
          const leg1 = finalLegs.find(f => f.leg === 1);
          const leg2 = finalLegs.find(f => f.leg === 2);
          const winnerId = knockoutWinner(leg1, leg2);
          if (winnerId) {
            winner = teamById[winnerId]?.name || null;
            const loserId = winnerId === leg1?.home_team_id ? leg1?.away_team_id : leg1?.home_team_id;
            runnerUp = loserId ? (teamById[loserId]?.name || null) : null;
          }
        }
      } else if (t.type === 'group_knockout') {
        const rounds = knockoutRoundsByTournament[t.id] || [];
        const finalRound = rounds.find(r => r.round_name === 'Final');
        if (finalRound) {
          const koFixtures = fixtures.filter(f => f.fixture_type === 'knockout');
          const finalFix = koFixtures.find(f => f.round === finalRound.round && f.match_number === 1 && f.leg === 1);
          if (finalFix && finalFix.played) {
            const winnerId = finalFix.home_score > finalFix.away_score ? finalFix.home_team_id
              : finalFix.away_score > finalFix.home_score ? finalFix.away_team_id : null;
            const loserId = winnerId === finalFix.home_team_id ? finalFix.away_team_id : finalFix.home_team_id;
            winner = winnerId ? (teamById[winnerId]?.name || null) : null;
            runnerUp = loserId ? (teamById[loserId]?.name || null) : null;
          }
        }
      }

      if (winner) {
        winnerCounts[winner] = winnerCounts[winner] || { gold: 0, silver: 0 };
        winnerCounts[winner].gold++;
      }
      if (runnerUp) {
        winnerCounts[runnerUp] = winnerCounts[runnerUp] || { gold: 0, silver: 0 };
        winnerCounts[runnerUp].silver++;
      }
    }

    const topPerformers = Object.entries(winnerCounts)
      .map(([name, medals]) => ({ name, ...medals, total: medals.gold * 2 + medals.silver }))
      .sort((a, b) => b.total - a.total || b.gold - a.gold || b.silver - a.silver);

    // ─── Best Match + Top Scorers (single pass over all played fixtures) ─────
    let bestMatch = null;
    let bestScore = -1;
    const teamGoals = {};

    for (const t of tournaments) {
      const fixtures = fixturesByTournament[t.id] || [];
      const playedFixtures = fixtures.filter(f => f.played === 1);

      for (const f of playedFixtures) {
        const homeTeam = teamById[f.home_team_id];
        const awayTeam = teamById[f.away_team_id];
        const homeName = homeTeam?.name;
        const awayName = awayTeam?.name;

        // Best match calculation
        const totalGoals = (f.home_score || 0) + (f.away_score || 0);
        const margin = Math.abs((f.home_score || 0) - (f.away_score || 0));
        const score = totalGoals * 10 - margin;
        if (score > bestScore && totalGoals > 0) {
          bestScore = score;
          bestMatch = {
            homeTeam: homeName || 'Unknown',
            awayTeam: awayName || 'Unknown',
            homeScore: f.home_score,
            awayScore: f.away_score,
            totalGoals,
            margin,
            tournament: t.name,
            fixtureType: f.fixture_type,
            round: f.round,
          };
        }

        // Goals aggregation
        if (homeName) {
          teamGoals[homeName] = teamGoals[homeName] || { goals: 0, matches: 0 };
          teamGoals[homeName].goals += f.home_score || 0;
          teamGoals[homeName].matches++;
        }
        if (awayName) {
          teamGoals[awayName] = teamGoals[awayName] || { goals: 0, matches: 0 };
          teamGoals[awayName].goals += f.away_score || 0;
          teamGoals[awayName].matches++;
        }
      }
    }

    const topScorers = Object.entries(teamGoals)
      .map(([name, data]) => ({ name, goals: data.goals, matches: data.matches, avgGoals: data.matches > 0 ? +(data.goals / data.matches).toFixed(2) : 0 }))
      .sort((a, b) => b.goals - a.goals || b.avgGoals - a.avgGoals);

    res.json({ topPerformers, bestMatch, topScorers, totalTournaments: tournaments.length });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Team Profiles (Team-Specific Stats) ──────────────────────────────────────
app.get('/api/team-profiles', requireAuth, async (req, res) => {
  try {
    // Get all unique team names across all tournaments in this group
    const result = await db.execute({
      sql: `SELECT DISTINCT t.name FROM teams t
            JOIN tournaments tn ON t.tournament_id = tn.id
            WHERE tn.code=? ORDER BY t.name`,
      args: [req.user.code]
    });
    res.json(result.rows.map(r => ({ name: r.name })));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/team-profiles/:teamName', requireAuth, async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);

    // Find all team instances with this name across tournaments in this group
    const teamsRes = await db.execute({
      sql: `SELECT t.*, tn.name as tournament_name, tn.type as tournament_type, tn.season as tournament_season
            FROM teams t JOIN tournaments tn ON t.tournament_id = tn.id
            WHERE t.name=? AND tn.code=?`,
      args: [teamName, req.user.code]
    });
    if (teamsRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const teamIds = teamsRes.rows.map(t => t.id);
    const tournamentIds = teamsRes.rows.map(t => t.tournament_id);

    // Get all played fixtures involving this team (as home or away)
    const placeholders = teamIds.map(() => '?').join(',');
    const fixturesRes = await db.execute({
      sql: `SELECT f.*, tn.name as tournament_name, tn.season as tournament_season
            FROM fixtures f JOIN tournaments tn ON f.tournament_id = tn.id
            WHERE f.played=1 AND (f.home_team_id IN (${placeholders}) OR f.away_team_id IN (${placeholders}))`,
      args: [...teamIds, ...teamIds]
    });

    // Get all teams for name resolution
    const allTeamsRes = await db.execute({
      sql: 'SELECT id, name, tournament_id FROM teams WHERE tournament_id IN (SELECT id FROM tournaments WHERE code=?)',
      args: [req.user.code]
    });
    const teamById = Object.fromEntries(allTeamsRes.rows.map(t => [t.id, t]));

    // Calculate stats
    let totalMatches = 0, wins = 0, draws = 0, losses = 0, goalsScored = 0, goalsConceded = 0;

    for (const f of fixturesRes.rows) {
      totalMatches++;
      const isHome = teamIds.includes(f.home_team_id);
      const myGoals = isHome ? f.home_score : f.away_score;
      const oppGoals = isHome ? f.away_score : f.home_score;
      goalsScored += myGoals;
      goalsConceded += oppGoals;
      if (myGoals > oppGoals) wins++;
      else if (myGoals === oppGoals) draws++;
      else losses++;
    }

    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Tournaments participated in
    const tournamentsPlayed = teamsRes.rows.map(t => ({
      tournamentId: t.tournament_id,
      tournamentName: t.tournament_name,
      season: t.tournament_season,
      type: t.tournament_type,
    }));

    // Count trophies for this team
    let trophies = [];
    for (const t of teamsRes.rows) {
      if (t.tournament_type === 'league') {
        const table = await computeTable(t.tournament_id);
        const allDone = await db.execute({ sql: 'SELECT COUNT(*) as c FROM fixtures WHERE tournament_id=? AND fixture_type=? AND played=0', args: [t.tournament_id, 'league'] });
        if (table.length > 0 && table[0].mp > 0 && allDone.rows[0].c === 0) {
          if (table[0].teamId === t.id) {
            trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'gold' });
          } else if (table.length > 1 && table[1].teamId === t.id) {
            trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'silver' });
          }
        }
      } else if (t.tournament_type === 'knockout') {
        const roundsRes2 = await db.execute({ sql: 'SELECT MAX(round) as r FROM fixtures WHERE tournament_id=? AND fixture_type=?', args: [t.tournament_id, 'knockout'] });
        const maxRound = roundsRes2.rows[0]?.r;
        if (maxRound) {
          const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? ORDER BY leg', args: [t.tournament_id, 'knockout', maxRound] });
          const legs = finalFix.rows;
          const leg1 = legs.find(f => f.leg === 1);
          const leg2 = legs.find(f => f.leg === 2);
          const winnerId = knockoutWinner(leg1, leg2);
          if (winnerId) {
            if (winnerId === t.id) {
              trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'gold' });
            } else {
              const loserId = winnerId === leg1.home_team_id ? leg1.away_team_id : leg1.home_team_id;
              if (loserId === t.id) {
                trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'silver' });
              }
            }
          }
        }
      } else if (t.tournament_type === 'group_knockout') {
        const knockoutRoundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=?', args: [t.tournament_id] });
        const finalRound = knockoutRoundsRes.rows.find(r => r.round_name === 'Final');
        if (finalRound) {
          const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? AND match_number=1 AND leg=1', args: [t.tournament_id, 'knockout', finalRound.round] });
          if (finalFix.rows.length > 0 && finalFix.rows[0].played) {
            const f = finalFix.rows[0];
            const winnerId = f.home_score > f.away_score ? f.home_team_id : (f.away_score > f.home_score ? f.away_team_id : null);
            const loserId = winnerId === f.home_team_id ? f.away_team_id : f.home_team_id;
            if (winnerId === t.id) {
              trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'gold' });
            } else if (loserId === t.id) {
              trophies.push({ tournamentId: t.tournament_id, tournamentName: t.tournament_name, season: t.tournament_season, type: 'silver' });
            }
          }
        }
      }
    }

    // Players who used this team (from user_team_mappings)
    const playersRes = await db.execute({
      sql: `SELECT DISTINCT u.id, u.name FROM user_team_mappings utm
            JOIN users u ON utm.user_id = u.id
            WHERE utm.team_id IN (${placeholders})`,
      args: teamIds
    });
    const playedBy = playersRes.rows.map(r => ({ id: r.id, name: r.name }));

    // Recent matches (last 10)
    const recentMatches = fixturesRes.rows
      .slice(-10)
      .reverse()
      .map(f => {
        const isHome = teamIds.includes(f.home_team_id);
        const oppTeamId = isHome ? f.away_team_id : f.home_team_id;
        const myGoals = isHome ? f.home_score : f.away_score;
        const oppGoals = isHome ? f.away_score : f.home_score;
        const result = myGoals > oppGoals ? 'W' : (myGoals === oppGoals ? 'D' : 'L');
        return {
          oppTeam: teamById[oppTeamId]?.name || 'Unknown',
          myGoals, oppGoals, result,
          tournamentName: f.tournament_name,
          season: f.tournament_season,
          fixtureType: f.fixture_type,
        };
      });

    res.json({
      team: { name: teamName },
      stats: { totalMatches, wins, draws, losses, goalsScored, goalsConceded, winRate, goalDifference: goalsScored - goalsConceded },
      tournamentsPlayed,
      trophies,
      playedBy,
      recentMatches,
    });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Keep old players endpoint (may be used elsewhere)
app.get('/api/players', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT id, name FROM users WHERE code=?', args: [req.user.code] });
    res.json(result.rows.map(r => ({ id: r.id, name: r.name })));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Rival Tracker (Team Head-to-Head) ────────────────────────────────────────
app.get('/api/team-rivals/:teamName1/:teamName2', requireAuth, async (req, res) => {
  try {
    const teamName1 = decodeURIComponent(req.params.teamName1);
    const teamName2 = decodeURIComponent(req.params.teamName2);

    // Find all team instances with these names across tournaments in this group (case-insensitive)
    const team1Res = await db.execute({
      sql: `SELECT t.id, t.tournament_id FROM teams t JOIN tournaments tn ON t.tournament_id = tn.id WHERE LOWER(t.name)=LOWER(?) AND tn.code=?`,
      args: [teamName1, req.user.code]
    });
    const team2Res = await db.execute({
      sql: `SELECT t.id, t.tournament_id FROM teams t JOIN tournaments tn ON t.tournament_id = tn.id WHERE LOWER(t.name)=LOWER(?) AND tn.code=?`,
      args: [teamName2, req.user.code]
    });

    if (team1Res.rows.length === 0 || team2Res.rows.length === 0) {
      return res.status(404).json({ error: 'One or both teams not found' });
    }

    const team1Ids = team1Res.rows.map(t => t.id);
    const team2Ids = team2Res.rows.map(t => t.id);

    // Find all played fixtures where team1 played against team2 (includes group_league, knockout, league)
    const ph1 = team1Ids.map(() => '?').join(',');
    const ph2 = team2Ids.map(() => '?').join(',');

    const fixturesRes = await db.execute({
      sql: `SELECT f.*, tn.name as tournament_name, kr.round_name as knockout_round_name FROM fixtures f
            JOIN tournaments tn ON f.tournament_id = tn.id
            LEFT JOIN knockout_rounds kr ON f.tournament_id = kr.tournament_id AND f.round = kr.round AND f.fixture_type = 'knockout'
            WHERE f.played=1 AND (
              (f.home_team_id IN (${ph1}) AND f.away_team_id IN (${ph2}))
              OR (f.home_team_id IN (${ph2}) AND f.away_team_id IN (${ph1}))
            )
            ORDER BY tn.created_at ASC, f.fixture_type ASC, f.round ASC, f.match_number ASC, f.leg ASC`,
      args: [...team1Ids, ...team2Ids, ...team2Ids, ...team1Ids]
    });

    let team1Wins = 0, team2Wins = 0, draws = 0;
    let team1Goals = 0, team2Goals = 0;
    const matches = [];

    for (const f of fixturesRes.rows) {
      const team1IsHome = team1Ids.includes(f.home_team_id);
      const t1Goals = team1IsHome ? f.home_score : f.away_score;
      const t2Goals = team1IsHome ? f.away_score : f.home_score;

      team1Goals += t1Goals;
      team2Goals += t2Goals;

      let result;
      if (t1Goals > t2Goals) { team1Wins++; result = 'team1'; }
      else if (t2Goals > t1Goals) { team2Wins++; result = 'team2'; }
      else { draws++; result = 'draw'; }

      matches.push({
        fixtureId: f.id,
        team1Goals: t1Goals,
        team2Goals: t2Goals,
        result,
        tournamentName: f.tournament_name,
        fixtureType: f.fixture_type,
        round: f.round,
        leg: f.leg,
        roundName: f.knockout_round_name || null,
      });
    }

    res.json({
      team1: { name: teamName1 },
      team2: { name: teamName2 },
      stats: {
        totalMatches: fixturesRes.rows.length,
        team1Wins, team2Wins, draws,
        team1Goals, team2Goals,
      },
      matches: matches.reverse(),
    });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Season Summary (auto-generated wrap for a specific tournament) ───────────
app.get('/api/tournaments/:tId/season-summary', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const tournament = tRes.rows[0];

    const teamsRes = await db.execute({ sql: 'SELECT * FROM teams WHERE tournament_id=?', args: [req.params.tId] });
    const teams = teamsRes.rows;
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

    const fixturesRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND played=1', args: [req.params.tId] });
    const fixtures = fixturesRes.rows;

    if (fixtures.length === 0) {
      return res.json({
        tournament: { id: tournament.id, name: tournament.name, season: tournament.season, type: tournament.type },
        summary: null,
        message: 'No matches played yet'
      });
    }

    // Champion & Runner-up
    let champion = null, runnerUp = null;
    if (tournament.type === 'league') {
      const table = await computeTable(req.params.tId);
      const unplayedRes = await db.execute({ sql: 'SELECT COUNT(*) as c FROM fixtures WHERE tournament_id=? AND fixture_type=? AND played=0', args: [req.params.tId, 'league'] });
      if (table.length > 0 && table[0].mp > 0 && unplayedRes.rows[0].c === 0) {
        champion = table[0].name;
        runnerUp = table[1]?.name || null;
      } else if (table.length > 0 && table[0].mp > 0) {
        champion = table[0].name + ' (leading)';
        runnerUp = table[1]?.name || null;
      }
    } else if (tournament.type === 'knockout') {
      const roundsRes = await db.execute({ sql: 'SELECT MAX(round) as r FROM fixtures WHERE tournament_id=? AND fixture_type=?', args: [req.params.tId, 'knockout'] });
      const maxRound = roundsRes.rows[0]?.r;
      if (maxRound) {
        const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? ORDER BY leg', args: [req.params.tId, 'knockout', maxRound] });
        const leg1 = finalFix.rows.find(f => f.leg === 1);
        const leg2 = finalFix.rows.find(f => f.leg === 2);
        const winnerId = knockoutWinner(leg1, leg2);
        if (winnerId) {
          champion = teamById[winnerId]?.name || null;
          const loserId = winnerId === leg1?.home_team_id ? leg1?.away_team_id : leg1?.home_team_id;
          runnerUp = loserId ? (teamById[loserId]?.name || null) : null;
        }
      }
    } else if (tournament.type === 'group_knockout') {
      const knockoutRoundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=?', args: [req.params.tId] });
      const finalRound = knockoutRoundsRes.rows.find(r => r.round_name === 'Final');
      if (finalRound) {
        const finalFix = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? AND match_number=1 AND leg=1', args: [req.params.tId, 'knockout', finalRound.round] });
        if (finalFix.rows.length > 0 && finalFix.rows[0].played) {
          const f = finalFix.rows[0];
          const winnerId = f.home_score > f.away_score ? f.home_team_id : (f.away_score > f.home_score ? f.away_team_id : null);
          const loserId = winnerId === f.home_team_id ? f.away_team_id : f.home_team_id;
          champion = winnerId ? (teamById[winnerId]?.name || null) : null;
          runnerUp = loserId ? (teamById[loserId]?.name || null) : null;
        }
      }
    }

    // Best Attack (most goals scored) & Best Defense (lowest goals conceded per match)
    const teamGoals = {};
    const teamConceded = {};
    const teamMatches = {};
    for (const f of fixtures) {
      const homeName = teamById[f.home_team_id]?.name;
      const awayName = teamById[f.away_team_id]?.name;
      if (homeName) {
        teamGoals[homeName] = (teamGoals[homeName] || 0) + (f.home_score || 0);
        teamConceded[homeName] = (teamConceded[homeName] || 0) + (f.away_score || 0);
        teamMatches[homeName] = (teamMatches[homeName] || 0) + 1;
      }
      if (awayName) {
        teamGoals[awayName] = (teamGoals[awayName] || 0) + (f.away_score || 0);
        teamConceded[awayName] = (teamConceded[awayName] || 0) + (f.home_score || 0);
        teamMatches[awayName] = (teamMatches[awayName] || 0) + 1;
      }
    }

    const bestAttack = Object.entries(teamGoals)
      .sort((a, b) => b[1] - a[1])[0];
    // Best defense = lowest conceded-per-match ratio (more matches = better if ratio is same)
    const bestDefense = Object.entries(teamConceded)
      .map(([name, conceded]) => {
        const matches = teamMatches[name] || 1;
        return { name, conceded, matches, ratio: +(conceded / matches).toFixed(2) };
      })
      .sort((a, b) => a.ratio - b.ratio || b.matches - a.matches)[0];

    // Most Entertaining Match (highest goals + closest margin)
    let bestMatch = null;
    let bestScore = -1;
    for (const f of fixtures) {
      const totalGoals = (f.home_score || 0) + (f.away_score || 0);
      const margin = Math.abs((f.home_score || 0) - (f.away_score || 0));
      const score = totalGoals * 10 - margin;
      if (score > bestScore && totalGoals > 0) {
        bestScore = score;
        bestMatch = {
          homeTeam: teamById[f.home_team_id]?.name || 'Unknown',
          awayTeam: teamById[f.away_team_id]?.name || 'Unknown',
          homeScore: f.home_score,
          awayScore: f.away_score,
          totalGoals,
          margin
        };
      }
    }

    // Biggest Win
    let biggestWin = null;
    let biggestMargin = 0;
    for (const f of fixtures) {
      const margin = Math.abs((f.home_score || 0) - (f.away_score || 0));
      if (margin > biggestMargin) {
        biggestMargin = margin;
        const winnerId = f.home_score > f.away_score ? f.home_team_id : f.away_team_id;
        biggestWin = {
          winner: teamById[winnerId]?.name || 'Unknown',
          homeTeam: teamById[f.home_team_id]?.name || 'Unknown',
          awayTeam: teamById[f.away_team_id]?.name || 'Unknown',
          homeScore: f.home_score,
          awayScore: f.away_score,
          margin
        };
      }
    }

    // Total stats
    const totalGoals = fixtures.reduce((sum, f) => sum + (f.home_score || 0) + (f.away_score || 0), 0);
    const totalMatches = fixtures.length;
    const avgGoalsPerMatch = totalMatches > 0 ? +(totalGoals / totalMatches).toFixed(2) : 0;

    res.json({
      tournament: { id: tournament.id, name: tournament.name, season: tournament.season, type: tournament.type, archived: tournament.archived === 1 },
      summary: {
        champion,
        runnerUp,
        bestAttack: bestAttack ? { team: bestAttack[0], goals: bestAttack[1] } : null,
        bestDefense: bestDefense ? { team: bestDefense.name, conceded: bestDefense.conceded, matches: bestDefense.matches, ratio: bestDefense.ratio } : null,
        mostEntertainingMatch: bestMatch,
        biggestWin,
        totalGoals,
        totalMatches,
        avgGoalsPerMatch,
        teamsCount: teams.length,
      }
    });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  initDb();

  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    code TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY, code TEXT NOT NULL,
    name TEXT NOT NULL, season TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'league',
    num_groups INTEGER DEFAULT 2,
    legs INTEGER DEFAULT 2,
    created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL,
    name TEXT NOT NULL, group_name TEXT DEFAULT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS fixtures (
    id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL,
    home_team_id TEXT, away_team_id TEXT,
    date TEXT, played INTEGER NOT NULL DEFAULT 0,
    home_score INTEGER, away_score INTEGER,
    round INTEGER, match_number INTEGER,
    leg INTEGER DEFAULT 1,
    fixture_type TEXT DEFAULT 'league',
    group_name TEXT DEFAULT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS knockout_rounds (
    id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL,
    round INTEGER NOT NULL, round_name TEXT NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS global_teams (
    id TEXT PRIMARY KEY, code TEXT NOT NULL,
    name TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS admin_keys (
    id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS user_team_mappings (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    tournament_id TEXT NOT NULL, team_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS fixture_user_mappings (
    id TEXT PRIMARY KEY, fixture_id TEXT NOT NULL,
    user_id TEXT NOT NULL, side TEXT NOT NULL,
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  // Add is_admin column if not exists (safe for existing DBs)
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
  } catch(_) { /* column already exists */ }
  // Add used_by column to admin_keys if not exists
  try {
    await db.execute(`ALTER TABLE admin_keys ADD COLUMN used_by TEXT DEFAULT NULL`);
  } catch(_) { /* column already exists */ }
  // Seed admin keys (10 unique keys, one per admin user)
  const adminKeys = [
    'Admin@3012',
    'Admin@4523',
    'Admin@5678',
    'Admin@6789',
    'Admin@7890',
    'Admin@8901',
    'Admin@9012',
    'Admin@1234',
    'Admin@2345',
    'Admin@3456',
  ];
  for (const key of adminKeys) {
    const existingKey = await db.execute({ sql: "SELECT id FROM admin_keys WHERE key=?", args: [key] });
    if (existingKey.rows.length === 0) {
      await db.execute({ sql: "INSERT INTO admin_keys (id, key, created_at) VALUES (?, ?, ?)", args: [uuidv4(), key, new Date().toISOString()] });
    }
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`⚽  Football API on :${PORT}`));
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
