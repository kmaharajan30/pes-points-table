const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path     = require('path');

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'football.db');
// Note: on free hosting without persistent disk, DB resets on redeploy
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    code TEXT NOT NULL,  created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY, code TEXT NOT NULL,
    name TEXT NOT NULL,  season TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'league',
    num_groups INTEGER DEFAULT 2,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT DEFAULT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS fixtures (
    id            TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    home_team_id  TEXT,
    away_team_id  TEXT,
    date          TEXT,
    played        INTEGER NOT NULL DEFAULT 0,
    home_score    INTEGER,
    away_score    INTEGER,
    round         INTEGER,
    match_number  INTEGER,
    leg           INTEGER DEFAULT 1,
    fixture_type  TEXT DEFAULT 'league',
    group_name    TEXT DEFAULT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS knockout_rounds (
    id            TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    round         INTEGER NOT NULL,
    round_name    TEXT NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  );
`);

// Migrate: add type column if not present
try { db.exec(`ALTER TABLE tournaments ADD COLUMN type TEXT NOT NULL DEFAULT 'league'`); } catch(_) {}
try { db.exec(`ALTER TABLE tournaments ADD COLUMN num_groups INTEGER DEFAULT 2`); } catch(_) {}
try { db.exec(`ALTER TABLE fixtures ADD COLUMN round INTEGER`); } catch(_) {}
try { db.exec(`ALTER TABLE fixtures ADD COLUMN match_number INTEGER`); } catch(_) {}
try { db.exec(`ALTER TABLE fixtures ADD COLUMN leg INTEGER DEFAULT 1`); } catch(_) {}
try { db.exec(`ALTER TABLE fixtures ADD COLUMN fixture_type TEXT DEFAULT 'league'`); } catch(_) {}
try { db.exec(`ALTER TABLE fixtures ADD COLUMN group_name TEXT DEFAULT NULL`); } catch(_) {}
try { db.exec(`ALTER TABLE teams ADD COLUMN group_name TEXT DEFAULT NULL`); } catch(_) {}

// ─── Presence ─────────────────────────────────────────────────────────────────
const presence = new Map();
function broadcastPresence(code) {
  if (!presence.has(code)) return;
  const users = Array.from(presence.get(code).values()).map(u => ({ id: u.id, name: u.name, joinedAt: u.joinedAt }));
  const data  = `data: ${JSON.stringify(users)}\n\n`;
  presence.get(code).forEach(u => { try { u.res.write(data); } catch(_) {} });
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.headers['x-user-id']);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user; next();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function teamMap(tournamentId) {
  return Object.fromEntries(db.prepare('SELECT * FROM teams WHERE tournament_id = ?').all(tournamentId).map(t => [t.id, t]));
}
function enrichFixture(f, tm) {
  return {
    id: f.id, tournamentId: f.tournament_id,
    homeTeamId: f.home_team_id, awayTeamId: f.away_team_id,
    date: f.date, played: f.played === 1,
    homeScore: f.home_score, awayScore: f.away_score,
    round: f.round, matchNumber: f.match_number, leg: f.leg,
    fixtureType: f.fixture_type,
    homeTeam: f.home_team_id && tm[f.home_team_id] ? { id: tm[f.home_team_id].id, name: tm[f.home_team_id].name } : null,
    awayTeam: f.away_team_id && tm[f.away_team_id] ? { id: tm[f.away_team_id].id, name: tm[f.away_team_id].name } : null,
  };
}

function computeTable(tournamentId) {
  const teams    = db.prepare('SELECT * FROM teams WHERE tournament_id = ?').all(tournamentId);
  const fixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id = ? AND played = 1 AND fixture_type = ?').all(tournamentId, 'league');
  const stats = {};
  teams.forEach(t => { stats[t.id] = { teamId: t.id, name: t.name, mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; });
  fixtures.forEach(f => {
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

// Compute table for a specific group
function computeGroupTable(tournamentId, groupName) {
  const teams    = db.prepare('SELECT * FROM teams WHERE tournament_id=? AND group_name=?').all(tournamentId, groupName);
  const fixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND played=1 AND fixture_type=? AND group_name=?').all(tournamentId, 'group_league', groupName);
  const stats = {};
  teams.forEach(t => { stats[t.id] = { teamId: t.id, name: t.name, groupName, mp:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; });
  fixtures.forEach(f => {
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

// Generate group_knockout: group stage league fixtures per group
function generateGroupLeagueFixtures(teams, tournamentId) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[i].id, away_team_id: teams[j].id, fixture_type: 'group_league', group_name: teams[i].group_name, leg: 1 });
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[j].id, away_team_id: teams[i].id, fixture_type: 'group_league', group_name: teams[i].group_name, leg: 2 });
    }
  }
  return fixtures;
}

// Generate group_knockout: semi-finals (2 legs) + final (1 leg) placeholder
// SF1: 1st GroupA vs 2nd GroupB, SF2: 1st GroupB vs 2nd GroupA
function generateGroupKnockoutStage(tournamentId) {
  const fixtures = [];
  // Semi-Final 1: match_number=1
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 1, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 1, leg: 2, group_name: null });
  // Semi-Final 2: match_number=2
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 1, group_name: null });
  fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: null, away_team_id: null, fixture_type: 'knockout', round: 1, match_number: 2, leg: 2, group_name: null });
  // Final: match_number=1, single leg
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

// Generate league fixtures: each team plays every other twice (home & away)
function generateLeagueFixtures(teams, tournamentId) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      // Leg 1
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[i].id, away_team_id: teams[j].id, fixture_type: 'league', leg: 1 });
      // Leg 2 (reversed home/away)
      fixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: teams[j].id, away_team_id: teams[i].id, fixture_type: 'league', leg: 2 });
    }
  }
  return fixtures;
}

// Generate knockout bracket — ALL rounds upfront with TBD placeholders
function generateFullKnockoutBracket(teams, tournamentId) {
  const n = teams.length;
  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const padded = [...teams];
  while (padded.length < size) padded.push(null); // null = bye

  // Shuffle for randomness
  for (let i = padded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [padded[i], padded[j]] = [padded[j], padded[i]];
  }

  const totalRounds = Math.ceil(Math.log2(size));
  const allFixtures = [];

  // Round 1: actual teams
  for (let m = 0; m < size / 2; m++) {
    const home = padded[m * 2];
    const away = padded[m * 2 + 1];
    if (!home || !away) continue; // skip bye matches
    const mn = m + 1;
    allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: home.id, away_team_id: away.id, fixture_type: 'knockout', round: 1, match_number: mn, leg: 1 });
    allFixtures.push({ id: uuidv4(), tournament_id: tournamentId, home_team_id: away.id, away_team_id: home.id, fixture_type: 'knockout', round: 1, match_number: mn, leg: 2 });
  }

  // Rounds 2+: placeholder fixtures (null teams = TBD)
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

// Determine knockout winner of a two-legged tie
// Returns winning team id, or null if both legs not complete
function knockoutWinner(leg1, leg2) {
  if (!leg1 || !leg2 || !leg1.played || !leg2.played) return null;
  // leg1: home_team_id is team A, leg2: home_team_id is team B
  // total goals: A = leg1.home_score + leg2.away_score, B = leg1.away_score + leg2.home_score
  const goalsA = leg1.home_score + leg2.away_score;
  const goalsB = leg1.away_score + leg2.home_score;
  if (goalsA > goalsB) return leg1.home_team_id;
  if (goalsB > goalsA) return leg1.away_team_id;
  // Tie on aggregate — away goals rule: away goals = leg1.away_score vs leg2.away_score
  if (leg1.away_score > leg2.away_score) return leg1.away_team_id;
  if (leg2.away_score > leg1.away_score) return leg1.home_team_id;
  // Still tied — pick randomly (can be changed to penalties)
  return Math.random() < 0.5 ? leg1.home_team_id : leg1.away_team_id;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { name, code } = req.body;
  if (!name || !code)         return res.status(400).json({ error: 'Name and code required' });
  if (code.trim().length < 4) return res.status(400).json({ error: 'Code must be ≥ 4 characters' });
  const [n, c] = [name.trim(), code.trim()];
  const existing = db.prepare('SELECT * FROM users WHERE code=? AND LOWER(name)=LOWER(?)').get(c, n);
  if (existing) return res.json({ user: { id: existing.id, name: existing.name, code: existing.code } });
  const user = { id: uuidv4(), name: n, code: c, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO users (id,name,code,created_at) VALUES (?,?,?,?)').run(user.id, user.name, user.code, user.created_at);
  res.status(201).json({ user: { id: user.id, name: user.name, code: user.code } });
});

app.get('/api/auth/group-members', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id,name,created_at FROM users WHERE code=?').all(req.user.code));
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
app.get('/api/tournaments', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM tournaments WHERE code=? ORDER BY created_at DESC').all(req.user.code)
    .map(r => ({ id:r.id, name:r.name, season:r.season, type:r.type, numGroups:r.num_groups, createdAt:r.created_at })));
});

app.post('/api/tournaments', requireAuth, (req, res) => {
  const { name, season, type='league', num_groups=2 } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (!['league','knockout','group_knockout'].includes(type)) return res.status(400).json({ error: 'type must be league, knockout, or group_knockout' });
  const numGroups = type === 'group_knockout' ? Math.max(2, parseInt(num_groups)||2) : null;
  const t = { id:uuidv4(), code:req.user.code, name:name.trim(), season:season||'', type, num_groups:numGroups, created_at:new Date().toISOString() };
  db.prepare('INSERT INTO tournaments (id,code,name,season,type,num_groups,created_at) VALUES (?,?,?,?,?,?,?)').run(t.id,t.code,t.name,t.season,t.type,t.num_groups,t.created_at);
  res.status(201).json({ id:t.id, name:t.name, season:t.season, type:t.type, numGroups:t.num_groups, createdAt:t.created_at });
});

app.delete('/api/tournaments/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.id, req.user.code);
  if (!t) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tournaments WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ─── Teams ────────────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/teams', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM teams WHERE tournament_id=?').all(req.params.tId)
    .map(r => ({ id:r.id, name:r.name, tournamentId:r.tournament_id, groupName:r.group_name })));
});

app.post('/api/tournaments/:tId/teams', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (!db.prepare('SELECT id FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code)) return res.status(404).json({ error: 'Tournament not found' });
  const team = { id:uuidv4(), tournament_id:req.params.tId, name:name.trim() };
  db.prepare('INSERT INTO teams (id,tournament_id,name) VALUES (?,?,?)').run(team.id, team.tournament_id, team.name);
  res.status(201).json({ id:team.id, name:team.name, tournamentId:team.tournament_id });
});

app.delete('/api/tournaments/:tId/teams/:teamId', requireAuth, (req, res) => {
  const { teamId } = req.params;
  // Delete all fixtures where this team is home OR away (cascade not on team columns)
  db.prepare('DELETE FROM fixtures WHERE home_team_id=? OR away_team_id=?').run(teamId, teamId);
  db.prepare('DELETE FROM teams WHERE id=?').run(teamId);
  res.json({ message: 'Team and related fixtures deleted' });
});

// ─── Generate Fixtures ────────────────────────────────────────────────────────
app.post('/api/tournaments/:tId/generate-fixtures', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t) return res.status(404).json({ error: 'Tournament not found' });

  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id=?').all(req.params.tId);
  if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams' });
  if (t.type === 'knockout' && teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams' });

  // Clear existing fixtures
  db.prepare('DELETE FROM fixtures WHERE tournament_id=?').run(req.params.tId);
  db.prepare('DELETE FROM knockout_rounds WHERE tournament_id=?').run(req.params.tId);

  const insertFix = db.prepare('INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,fixture_type,round,match_number,leg,group_name) VALUES (?,?,?,?,?,?,?,?,?)');

  if (t.type === 'league') {
    const fixtures = generateLeagueFixtures(teams, req.params.tId);
    const insertMany = db.transaction(() => fixtures.forEach(f => insertFix.run(f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,null,null,f.leg,null)));
    insertMany();
    res.json({ message: `Generated ${fixtures.length} league fixtures`, count: fixtures.length });
  } else if (t.type === 'knockout') {
    const { fixtures, totalRounds, totalTeams } = generateFullKnockoutBracket(teams, req.params.tId);
    const insertMany = db.transaction(() => fixtures.forEach(f => insertFix.run(f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,f.round,f.match_number,f.leg,null)));
    insertMany();
    const totalSize = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
    for (let r = 1; r <= totalRounds; r++) {
      db.prepare('INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)').run(uuidv4(), req.params.tId, r, roundName(totalSize, r));
    }
    res.json({ message: `Generated full knockout bracket`, count: fixtures.length, totalRounds });
  } else if (t.type === 'group_knockout') {
    const numGroups = t.num_groups || 2;
    if (teams.length < numGroups * 2) return res.status(400).json({ error: `Need at least ${numGroups * 2} teams for ${numGroups} groups` });

    // Distribute teams round-robin into groups
    const groupLetters = Array.from({length: numGroups}, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((team, idx) => {
      const grp = groupLetters[idx % numGroups];
      db.prepare('UPDATE teams SET group_name=? WHERE id=?').run(grp, team.id);
      team.group_name = grp;
    });

    // Generate group league fixtures per group
    const allGroupFixtures = [];
    for (const grp of groupLetters) {
      const grpTeams = shuffled.filter(t => t.group_name === grp);
      allGroupFixtures.push(...generateGroupLeagueFixtures(grpTeams, req.params.tId));
    }

    // Generate knockout stage placeholders (semis + final)
    const knockoutFixtures = generateGroupKnockoutStage(req.params.tId);

    db.transaction(() => {
      allGroupFixtures.forEach(f => insertFix.run(f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,null,null,f.leg,f.group_name));
      knockoutFixtures.forEach(f => insertFix.run(f.id,f.tournament_id,f.home_team_id,f.away_team_id,f.fixture_type,f.round,f.match_number,f.leg,null));
    })();

    // Store knockout round names
    db.prepare('INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)').run(uuidv4(), req.params.tId, 1, 'Semi-Final');
    db.prepare('INSERT INTO knockout_rounds (id,tournament_id,round,round_name) VALUES (?,?,?,?)').run(uuidv4(), req.params.tId, 2, 'Final');

    res.json({ message: `Generated group stage + knockout`, groupCount: numGroups, groupFixtures: allGroupFixtures.length, knockoutFixtures: knockoutFixtures.length });
  }
});

// Advance knockout to next round (called after all matches in current round are done)
app.post('/api/tournaments/:tId/knockout-advance', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || !['knockout','group_knockout'].includes(t.type)) return res.status(400).json({ error: 'Not a knockout tournament' });

  // Find current highest round
  const maxRound = db.prepare('SELECT MAX(round) as r FROM fixtures WHERE tournament_id=? AND fixture_type=?').get(req.params.tId, 'knockout')?.r;
  if (!maxRound) return res.status(400).json({ error: 'No knockout fixtures found' });

  // Get all matches in current round
  const allFixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=?').all(req.params.tId, 'knockout', maxRound);
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

  if (winners.length === 1) {
    return res.json({ message: 'Tournament complete', champion: winners[0], done: true });
  }

  // Update existing placeholder fixtures for next round with actual winner team IDs
  const nextRound = maxRound + 1;
  const nextFixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=? ORDER BY match_number,leg').all(req.params.tId, 'knockout', nextRound);

  if (nextFixtures.length === 0) {
    return res.status(400).json({ error: 'No next round fixtures found. Please re-generate the bracket.' });
  }

  const updateFix = db.prepare('UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?');
  db.transaction(() => {
    for (let i = 0; i < winners.length; i += 2) {
      const homeWinner = winners[i];
      const awayWinner = winners[i + 1];
      if (!awayWinner) continue;
      const mn = Math.floor(i / 2) + 1;
      const leg1 = nextFixtures.find(f => f.match_number === mn && f.leg === 1);
      const leg2 = nextFixtures.find(f => f.match_number === mn && f.leg === 2);
      if (leg1) updateFix.run(homeWinner, awayWinner, leg1.id);
      if (leg2) updateFix.run(awayWinner, homeWinner, leg2.id);
    }
  })();

  res.json({ message: `Advanced to round ${nextRound}`, done: false });
});

// Get knockout bracket structure
app.get('/api/tournaments/:tId/knockout-bracket', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || t.type !== 'knockout') return res.status(400).json({ error: 'Not a knockout tournament' });

  // Clean up only non-placeholder orphaned fixtures
  db.prepare(`
    DELETE FROM fixtures
    WHERE tournament_id = ?
      AND home_team_id IS NOT NULL
      AND (
        home_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?)
        OR away_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?)
      )
  `).run(req.params.tId, req.params.tId, req.params.tId);

  const tm = teamMap(req.params.tId);
  const allFixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg').all(req.params.tId, 'knockout');
  const rounds = db.prepare('SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round').all(req.params.tId);

  const bracket = rounds.map(r => {
    const roundFixtures = allFixtures.filter(f => f.round === r.round);
    const matchNums = [...new Set(roundFixtures.map(f => f.match_number))];

    const matches = matchNums.map(mn => {
      const legs = roundFixtures.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
      const leg1 = legs.find(f => f.leg === 1);
      const leg2 = legs.find(f => f.leg === 2);
      // Only compute winner if both teams are assigned and both legs played
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
});

// ─── Fixtures CRUD ────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/fixtures', requireAuth, (req, res) => {
  // First, clean up any orphaned fixtures (team was deleted without cascade)
  db.prepare(`
    DELETE FROM fixtures
    WHERE tournament_id = ?
      AND (
        (home_team_id IS NOT NULL AND home_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?))
        OR
        (away_team_id IS NOT NULL AND away_team_id NOT IN (SELECT id FROM teams WHERE tournament_id = ?))
      )
  `).run(req.params.tId, req.params.tId, req.params.tId);

  const rows = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? ORDER BY fixture_type,round,match_number,leg,rowid').all(req.params.tId);
  const tm   = teamMap(req.params.tId);
  res.json(rows.map(f => enrichFixture(f, tm)));
});

app.post('/api/tournaments/:tId/fixtures', requireAuth, (req, res) => {
  const { homeTeamId, awayTeamId, date } = req.body;
  if (!homeTeamId || !awayTeamId) return res.status(400).json({ error: 'Both teams required' });
  if (homeTeamId === awayTeamId)  return res.status(400).json({ error: 'Teams must differ' });
  const fix = { id:uuidv4(), tournament_id:req.params.tId, home_team_id:homeTeamId, away_team_id:awayTeamId, date:date||null, fixture_type:'league', leg:1 };
  db.prepare('INSERT INTO fixtures (id,tournament_id,home_team_id,away_team_id,date,fixture_type,leg) VALUES (?,?,?,?,?,?,?)').run(fix.id,fix.tournament_id,fix.home_team_id,fix.away_team_id,fix.date,fix.fixture_type,fix.leg);
  res.status(201).json(enrichFixture(fix, teamMap(req.params.tId)));
});

app.put('/api/tournaments/:tId/fixtures/:fId/result', requireAuth, (req, res) => {
  const { homeScore, awayScore } = req.body;
  if (homeScore===undefined||awayScore===undefined) return res.status(400).json({ error: 'Scores required' });
  if (!db.prepare('SELECT id FROM fixtures WHERE id=?').get(req.params.fId)) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE fixtures SET home_score=?,away_score=?,played=1 WHERE id=?').run(+homeScore,+awayScore,req.params.fId);
  res.json({ message: 'Saved' });
});

app.delete('/api/tournaments/:tId/fixtures/:fId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM fixtures WHERE id=?').run(req.params.fId);
  res.json({ message: 'Deleted' });
});

// ─── Group Stage API ──────────────────────────────────────────────────────────

// Get all group tables
app.get('/api/tournaments/:tId/group-tables', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || t.type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });
  const groups = [...new Set(db.prepare('SELECT DISTINCT group_name FROM teams WHERE tournament_id=? AND group_name IS NOT NULL').all(req.params.tId).map(r => r.group_name))].sort();
  const result = groups.map(grp => ({ group: grp, table: computeGroupTable(req.params.tId, grp) }));
  res.json(result);
});

// Get group stage fixtures
app.get('/api/tournaments/:tId/group-fixtures', requireAuth, (req, res) => {
  const tm = teamMap(req.params.tId);
  const rows = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY group_name,rowid').all(req.params.tId, 'group_league');
  res.json(rows.map(f => enrichFixture(f, tm)));
});

// Seed knockout stage from top-2 of each group
app.post('/api/tournaments/:tId/seed-knockout', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || t.type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

  const numGroups = t.num_groups || 2;
  const groupLetters = Array.from({length: numGroups}, (_, i) => String.fromCharCode(65 + i));

  // Get top 2 from each group
  const qualifiers = {}; // { A: [1st, 2nd], B: [1st, 2nd], ... }
  for (const grp of groupLetters) {
    const table = computeGroupTable(req.params.tId, grp);
    qualifiers[grp] = table.slice(0, 2);
  }

  // For 2 groups: SF1 = 1stA vs 2ndB, SF2 = 1stB vs 2ndA
  // For more groups: extend similarly
  const sfMatches = [];
  for (let i = 0; i < numGroups; i++) {
    const grpA = groupLetters[i];
    const grpB = groupLetters[(i + 1) % numGroups];
    const first  = qualifiers[grpA]?.[0];
    const second = qualifiers[grpB]?.[1];
    if (!first || !second) return res.status(400).json({ error: `Group ${grpA} or ${grpB} doesn't have enough results yet` });
    sfMatches.push({ matchNumber: i + 1, home: first.teamId, away: second.teamId });
  }

  // Update semi-final placeholders
  const updateFix = db.prepare('UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?');
  db.transaction(() => {
    for (const sf of sfMatches) {
      const leg1 = db.prepare('SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=1').get(req.params.tId, 'knockout', sf.matchNumber);
      const leg2 = db.prepare('SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 AND match_number=? AND leg=2').get(req.params.tId, 'knockout', sf.matchNumber);
      if (leg1) updateFix.run(sf.home, sf.away, leg1.id);
      if (leg2) updateFix.run(sf.away, sf.home, leg2.id);
    }
  })();

  res.json({ message: 'Knockout stage seeded', matches: sfMatches });
});

// Advance group_knockout to Final after semi-finals complete
app.post('/api/tournaments/:tId/seed-final', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || t.type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

  const numGroups = t.num_groups || 2;
  const sfFixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=1 ORDER BY match_number,leg').all(req.params.tId, 'knockout');
  const matchNums = [...new Set(sfFixtures.map(f => f.match_number))];

  const finalists = [];
  for (const mn of matchNums) {
    const legs = sfFixtures.filter(f => f.match_number === mn);
    const leg1 = legs.find(f => f.leg === 1);
    const leg2 = legs.find(f => f.leg === 2);
    if (!leg1?.played || !leg2?.played) return res.status(400).json({ error: `Semi-final ${mn} is not complete` });
    const winner = knockoutWinner(leg1, leg2);
    if (!winner) return res.status(400).json({ error: `Could not determine winner of semi-final ${mn}` });
    finalists.push(winner);
  }

  if (finalists.length < 2) return res.status(400).json({ error: 'Need at least 2 semi-finals complete' });

  const finalFix = db.prepare('SELECT id FROM fixtures WHERE tournament_id=? AND fixture_type=? AND round=2 AND match_number=1 AND leg=1').get(req.params.tId, 'knockout');
  if (!finalFix) return res.status(400).json({ error: 'Final fixture not found' });
  db.prepare('UPDATE fixtures SET home_team_id=?, away_team_id=? WHERE id=?').run(finalists[0], finalists[1], finalFix.id);

  res.json({ message: 'Final seeded', finalist1: finalists[0], finalist2: finalists[1] });
});

// Get group knockout bracket (SF + Final)
app.get('/api/tournaments/:tId/group-knockout-bracket', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND code=?').get(req.params.tId, req.user.code);
  if (!t || t.type !== 'group_knockout') return res.status(400).json({ error: 'Not a group_knockout tournament' });

  const tm = teamMap(req.params.tId);
  const rounds = db.prepare('SELECT * FROM knockout_rounds WHERE tournament_id=? ORDER BY round').all(req.params.tId);
  const allKoFixtures = db.prepare('SELECT * FROM fixtures WHERE tournament_id=? AND fixture_type=? ORDER BY round,match_number,leg').all(req.params.tId, 'knockout');

  const bracket = rounds.map(r => {
    const roundFixtures = allKoFixtures.filter(f => f.round === r.round);
    const matchNums = [...new Set(roundFixtures.map(f => f.match_number))];
    const isFinalRound = r.round_name === 'Final';

    const matches = matchNums.map(mn => {
      const legs = roundFixtures.filter(f => f.match_number === mn).sort((a,b) => a.leg - b.leg);
      const leg1 = legs[0];
      const leg2 = isFinalRound ? null : legs[1]; // Final is single leg
      const hasTeams = leg1?.home_team_id && leg1?.away_team_id;

      let winner = null;
      let aggHome = null, aggAway = null;
      if (hasTeams && isFinalRound) {
        // Single leg final
        if (leg1.played) {
          winner = leg1.home_score > leg1.away_score ? leg1.home_team_id
            : leg1.away_score > leg1.home_score ? leg1.away_team_id
            : null; // draw in final — no winner yet (could add ET/pens)
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
});

// ─── Points Table ─────────────────────────────────────────────────────────────
app.get('/api/tournaments/:tId/table', requireAuth, (req, res) => {
  res.json(computeTable(req.params.tId));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`⚽  Football API on :${PORT}  |  DB: football.db`));
