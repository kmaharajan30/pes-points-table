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

function generateGroupKnockoutStage(tournamentId) {
  const fixtures = [];
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 1, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 2, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 1, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 2, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 2, match_number: 1, leg: 1, group_name: null });
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
    const [n, c] = [name.trim(), code.trim()];
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE code=? AND LOWER(name)=LOWER(?)', args: [c, n] });
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      return res.json({ user: { id: u.id, name: u.name, code: u.code } });
    }
    const user = { id: uuidv4(), name: n, code: c, created_at: new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO users (id,name,code,created_at) VALUES (?,?,?,?)', args: [user.id, user.name, user.code, user.created_at] });
    res.status(201).json({ user: { id: user.id, name: user.name, code: user.code } });
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
    res.json(result.rows.map(r => ({ id:r.id, name:r.name, season:r.season, type:r.type, numGroups:r.num_groups, legs:r.legs, createdAt:r.created_at })));
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments', requireAuth, async (req, res) => {
  try {
    const { name, season, type='league', num_groups=2, legs=2 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!['league','knockout','group_knockout'].includes(type)) return res.status(400).json({ error: 'type must be league, knockout, or group_knockout' });
    const numGroups = type === 'group_knockout' ? Math.max(2, parseInt(num_groups)||2) : null;
    const numLegs   = type === 'group_knockout' ? (parseInt(legs)===1 ? 1 : 2) : (type === 'league' ? (parseInt(legs)===1 ? 1 : 2) : null);
    const t = { id:uuidv4(), code:req.user.code, name:name.trim(), season:season||'', type, num_groups:numGroups, legs:numLegs, created_at:new Date().toISOString() };
    await db.execute({ sql: 'INSERT INTO tournaments (id,code,name,season,type,num_groups,legs,created_at) VALUES (?,?,?,?,?,?,?,?)', args: [t.id,t.code,t.name,t.season,t.type,t.num_groups,t.legs,t.created_at] });
    res.status(201).json({ id:t.id, name:t.name, season:t.season, type:t.type, numGroups:t.num_groups, legs:t.legs, createdAt:t.created_at });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tournaments/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.id, req.user.code] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await db.execute({ sql: 'DELETE FROM tournaments WHERE id=?', args: [req.params.id] });
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

app.delete('/api/tournaments/:tId/teams/:teamId', requireAuth, async (req, res) => {
  try {
    const { teamId } = req.params;
    await db.execute({ sql: 'DELETE FROM fixtures WHERE home_team_id=? OR away_team_id=?', args: [teamId, teamId] });
    await db.execute({ sql: 'DELETE FROM teams WHERE id=?', args: [teamId] });
    res.json({ message: 'Team and related fixtures deleted' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── Generate Fixtures ────────────────────────────────────────────────────────
app.post('/api/tournaments/:tId/generate-fixtures', requireAuth, async (req, res) => {
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
      await db.execute({ sql: 'UPDATE tournaments SET legs=? WHERE id=?', args: [overrideLegs, req.params.tId] });
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
      const knockoutFixtures = generateGroupKnockoutStage(req.params.tId);

      const allStmts = [
        ...allGroupFixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,null,null,f.leg,f.group_name] })),
        ...knockoutFixtures.map(f => ({ sql: 'INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)', args: [f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,f.round,f.match_number,f.leg,null] })),
        { sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 1, 'Semi-Final'] },
        { sql: 'INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)', args: [uuidv4(), req.params.tId, 2, 'Final'] },
      ];
      await db.batch(allStmts, 'write');
      res.json({ message: `Generated group stage + knockout`, groupCount: numGroups, groupFixtures: allGroupFixtures.length, knockoutFixtures: knockoutFixtures.length, legs: legsToUse });
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
    const { homeScore, awayScore } = req.body;
    if (homeScore===undefined||awayScore===undefined) return res.status(400).json({ error: 'Scores required' });
    const check = await db.execute({ sql: 'SELECT id FROM fixtures WHERE id=?', args: [req.params.fId] });
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await db.execute({ sql: 'UPDATE fixtures SET home_score=?,away_score=?,played=1 WHERE id=?', args: [+homeScore,+awayScore,req.params.fId] });
    res.json({ message: 'Saved' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tournaments/:tId/fixtures/:fId', requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM fixtures WHERE id=?', args: [req.params.fId] });
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

app.post('/api/tournaments/:tId/seed-knockout', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });
    const t = tRes.rows[0];
    const numGroups = t.num_groups || 2;
    const groupLetters = Array.from({length: numGroups}, (_, i) => String.fromCharCode(65 + i));

    const qualifiers = {};
    for (const grp of groupLetters) {
      const table = await computeGroupTable(req.params.tId, grp);
      qualifiers[grp] = table.slice(0, 2);
    }

    const sfMatches = [];
    for (let i = 0; i < numGroups; i++) {
      const grpA = groupLetters[i];
      const grpB = groupLetters[(i + 1) % numGroups];
      const first = qualifiers[grpA]?.[0];
      const second = qualifiers[grpB]?.[1];
      if (!first || !second) return res.status(400).json({ error: `Group ${grpA} or ${grpB} doesn't have enough results yet` });
      sfMatches.push({ matchNumber: i + 1, home: first.teamId, away: second.teamId });
    }

    const updates = [];
    for (const sf of sfMatches) {
      const leg1 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=1', args: [req.params.tId, 'knockout', sf.matchNumber] });
      const leg2 = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=2', args: [req.params.tId, 'knockout', sf.matchNumber] });
      if (leg1.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [sf.home, sf.away, leg1.rows[0].id] });
      if (leg2.rows.length > 0) updates.push({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [sf.away, sf.home, leg2.rows[0].id] });
    }
    if (updates.length > 0) await db.batch(updates, 'write');
    res.json({ message: 'Knockout stage seeded', matches: sfMatches });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:tId/seed-final', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

    const sfRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 ORDER BY match_number,leg', args: [req.params.tId, 'knockout'] });
    const matchNums = [...new Set(sfRes.rows.map(f => f.match_number))];

    const finalists = [];
    for (const mn of matchNums) {
      const legs = sfRes.rows.filter(f => f.match_number === mn);
      const leg1 = legs.find(f => f.leg === 1);
      const leg2 = legs.find(f => f.leg === 2);
      if (!leg1?.played || !leg2?.played) return res.status(400).json({ error: `Semi-final ${mn} is not complete` });
      const winner = knockoutWinner(leg1, leg2);
      if (!winner) return res.status(400).json({ error: `Could not determine winner of semi-final ${mn}` });
      finalists.push(winner);
    }

    if (finalists.length < 2) return res.status(400).json({ error: 'Need at least 2 semi-finals complete' });

    const finalRes = await db.execute({ sql: 'SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=2 AND match_number=1 AND leg=1', args: [req.params.tId, 'knockout'] });
    if (finalRes.rows.length === 0) return res.status(400).json({ error: 'Final fixture not found' });
    await db.execute({ sql: 'UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?', args: [finalists[0], finalists[1], finalRes.rows[0].id] });
    res.json({ message: 'Final seeded', finalist1: finalists[0], finalist2: finalists[1] });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/tournaments/:tId/group-knockout-bracket', requireAuth, async (req, res) => {
  try {
    const tRes = await db.execute({ sql: 'SELECT * FROM tournaments WHERE id=? AND code=?', args: [req.params.tId, req.user.code] });
    if (tRes.rows.length === 0 || tRes.rows[0].type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

    const tm = await teamMap(req.params.tId);
    const roundsRes = await db.execute({ sql: 'SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round', args: [req.params.tId] });
    const fixRes = await db.execute({ sql: 'SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg', args: [req.params.tId, 'knockout'] });

    const bracket = roundsRes.rows.map(r => {
      const roundFixtures = fixRes.rows.filter(f => f.round === r.round);
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

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`⚽  Football API on :${PORT}`));
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
