import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Stack,
  Button, Alert, Avatar, IconButton
} from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import {
  getGroupTables, getGroupFixtures, getGroupKnockout,
  generateFixtures, seedKnockout, seedFinal,
  addResult, deleteFixture
} from '../api/footballApi';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField
} from '@mui/material';

// ── Shared helpers ─────────────────────────────────────────────────────────────
const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

function TeamBadge({ name='', size=28 }) {
  return (
    <Box sx={{ width:size, height:size, borderRadius:'50%', bgcolor:getColor(name), color:'#000',
      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:size*0.35, flexShrink:0 }}>
      {getInit(name)}
    </Box>
  );
}

function ScorePill({ home, away, played }) {
  if (!played) return <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.06)', color:'text.secondary', fontWeight:600, fontSize:10 }} />;
  const isDraw = home===away;
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:0.5, px:1.5, py:0.4, borderRadius:99,
      background: isDraw?'rgba(255,215,64,0.12)':'rgba(0,230,118,0.10)',
      border:`1px solid ${isDraw?'rgba(255,215,64,0.25)':'rgba(0,230,118,0.2)'}` }}>
      <Typography sx={{ fontWeight:900, fontSize:'0.85rem', color: home>away?'primary.main':(isDraw?'warning.main':'text.secondary') }}>{home}</Typography>
      <Typography sx={{ fontWeight:700, color:'text.secondary', mx:0.3 }}>–</Typography>
      <Typography sx={{ fontWeight:900, fontSize:'0.85rem', color: away>home?'primary.main':(isDraw?'warning.main':'text.secondary') }}>{away}</Typography>
    </Box>
  );
}

// ── Result Dialog ──────────────────────────────────────────────────────────────
function ResultDialog({ open, fixture, onSave, onClose }) {
  const [score, setScore] = useState({ home:'', away:'' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (fixture) setScore({ home: fixture.played ? String(fixture.homeScore) : '', away: fixture.played ? String(fixture.awayScore) : '' });
  }, [fixture]);
  const handleSave = async () => {
    if (score.home===''||score.away==='') return;
    setSaving(true);
    await onSave(fixture.id, { homeScore:Number(score.home), awayScore:Number(score.away) });
    setSaving(false); onClose();
  };
  const home = fixture?.homeTeam?.name || '?';
  const away = fixture?.awayTeam?.name || '?';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
      <DialogTitle sx={{ pb:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}>
          <CheckCircleOutlineRoundedIcon sx={{ color:'primary.main', fontSize:20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight:700 }}>Enter Result</Typography>
          {fixture?.leg && <Chip label={`Leg ${fixture.leg}`} size="small"
            sx={{ bgcolor:'rgba(0,230,118,0.1)', color:'primary.main', fontWeight:700, height:20, fontSize:10 }} />}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt:'12px !important' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2.5 }}>
          <Box sx={{ flex:1, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:0.5 }}>
            <TeamBadge name={home} size={36} />
            <Typography variant="caption" sx={{ fontWeight:700, fontSize:11 }}>{home}</Typography>
          </Box>
          <Typography sx={{ fontWeight:800, color:'text.secondary', fontSize:13 }}>vs</Typography>
          <Box sx={{ flex:1, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:0.5 }}>
            <TeamBadge name={away} size={36} />
            <Typography variant="caption" sx={{ fontWeight:700, fontSize:11 }}>{away}</Typography>
          </Box>
        </Box>
        <Box sx={{ display:'flex', gap:1.5, alignItems:'center' }}>
          <TextField label="Home" type="number" fullWidth size="small" inputProps={{ min:0 }} autoFocus
            value={score.home} onChange={e=>setScore({...score,home:e.target.value})} />
          <Typography sx={{ fontWeight:800, color:'text.secondary', flexShrink:0 }}>–</Typography>
          <TextField label="Away" type="number" fullWidth size="small" inputProps={{ min:0 }}
            value={score.away} onChange={e=>setScore({...score,away:e.target.value})} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" size="small" sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" size="small"
          disabled={score.home===''||score.away===''||saving}
          sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Group Table (used in Table view) ──────────────────────────────────────────
function GroupTable({ groupName, table }) {
  return (
    <Box sx={{ mb:3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight:800, mb:1.25, color:'text.primary', fontSize:15 }}>
        Group {groupName}
      </Typography>
      <Card sx={{ background:'linear-gradient(160deg,#111827,#131d2e)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:2.5, overflow:'hidden' }}>
        <Box sx={{ display:'flex', alignItems:'center', px:2, py:0.75, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ width:20, flexShrink:0 }} />
          <Box sx={{ flex:1, ml:1.5 }}>
            <Typography variant="caption" sx={{ fontWeight:800, fontSize:10, color:'text.secondary', letterSpacing:'0.08em' }}>CLUB</Typography>
          </Box>
          {['MP','W','D','L','GD','PTS'].map(h=>(
            <Typography key={h} sx={{ fontWeight:800, fontSize:10, color:h==='PTS'?'primary.main':'text.secondary',
              minWidth:32, textAlign:'center', letterSpacing:'0.04em' }}>{h}</Typography>
          ))}
        </Box>
        {table.map((row, idx) => {
          const isQ = idx < 2;
          const gdLabel = row.gd > 0 ? `+${row.gd}` : String(row.gd);
          return (
            <Box key={row.teamId} sx={{
              display:'flex', alignItems:'center', px:2, py:1,
              borderBottom: idx===table.length-1?'none':'1px solid rgba(255,255,255,0.04)',
              borderLeft: isQ ? '3px solid #00e676' : '3px solid transparent',
              background: isQ && idx===0 ? 'linear-gradient(90deg,rgba(0,230,118,0.07),transparent)' : 'transparent',
              '&:hover':{ background:'rgba(255,255,255,0.025)' },
            }}>
              <Box sx={{ width:20, display:'flex', justifyContent:'center', flexShrink:0 }}>
                {idx===0 ? <EmojiEventsRoundedIcon sx={{ color:'#FFD700', fontSize:16 }} />
                  : idx===1 ? <EmojiEventsRoundedIcon sx={{ color:'#C0C0C0', fontSize:16 }} />
                  : <Typography sx={{ fontWeight:800, color:'text.secondary', fontSize:11, width:16, textAlign:'center' }}>{idx+1}</Typography>}
              </Box>
              <Box sx={{ display:'flex', alignItems:'center', gap:1.25, flex:1, minWidth:0, ml:1.5 }}>
                <Avatar sx={{ bgcolor:getColor(row.name), color:'#000', fontWeight:800, fontSize:10, width:26, height:26, boxShadow:`0 2px 8px ${getColor(row.name)}55` }}>
                  {getInit(row.name)}
                </Avatar>
                <Typography sx={{ fontWeight:700, fontSize:'0.8rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {row.name}
                </Typography>
                {isQ && (
                  <Chip label="Q" size="small" sx={{ bgcolor:'rgba(0,230,118,0.12)', color:'primary.main', fontWeight:800, fontSize:9, height:16, ml:0.5 }} />
                )}
              </Box>
              {[row.mp, row.w, row.d, row.l].map((v,i)=>(
                <Typography key={i} sx={{ fontWeight:700, fontSize:'0.8rem', minWidth:32, textAlign:'center',
                  color: i===1&&v>0?'primary.main':i===3&&v>0?'error.main':i===2&&v>0?'warning.main':'text.secondary' }}>{v}</Typography>
              ))}
              <Typography sx={{ fontWeight:700, fontSize:'0.8rem', minWidth:32, textAlign:'center',
                color: row.gd>0?'primary.main':row.gd<0?'error.main':'text.secondary' }}>{gdLabel}</Typography>
              <Typography sx={{ fontWeight:900, fontSize:'0.85rem', minWidth:32, textAlign:'center', color:'primary.main',
                bgcolor:'rgba(0,230,118,0.1)', border:'1px solid rgba(0,230,118,0.2)', borderRadius:1, px:0.5 }}>{row.pts}</Typography>
            </Box>
          );
        })}
        <Box sx={{ px:2, py:0.75, borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:1 }}>
          <Box sx={{ width:8, height:8, borderRadius:'50%', bgcolor:'#00e676' }} />
          <Typography variant="caption" sx={{ fontSize:9, color:'text.secondary' }}>Top 2 qualify for Semi-Finals</Typography>
        </Box>
      </Card>
    </Box>
  );
}

// ── Fixture Card (group stage) ─────────────────────────────────────────────────
function GroupFixtureCard({ fixture, onResult, onDelete }) {
  const home = fixture.homeTeam?.name || '?';
  const away = fixture.awayTeam?.name || '?';
  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#151e2e)', transition:'all 0.15s',
      '&:hover':{ borderColor:'rgba(0,230,118,0.2)' } }}>
      <CardContent sx={{ p:'10px 12px !important' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, justifyContent:'flex-end', minWidth:0 }}>
            <Typography variant="caption" noWrap sx={{ fontWeight:700, textAlign:'right', fontSize:{ xs:11, sm:12 } }}>{home}</Typography>
            <TeamBadge name={home} size={28} />
          </Box>
          <Box sx={{ flexShrink:0, px:0.5 }}>
            <ScorePill home={fixture.homeScore} away={fixture.awayScore} played={fixture.played} />
          </Box>
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, minWidth:0 }}>
            <TeamBadge name={away} size={28} />
            <Typography variant="caption" noWrap sx={{ fontWeight:700, fontSize:{ xs:11, sm:12 } }}>{away}</Typography>
          </Box>
          <Box sx={{ display:'flex', flexShrink:0, ml:0.25 }}>
            <IconButton size="small" onClick={()=>onResult(fixture)}
              sx={{ color:'primary.main', p:0.5, '&:hover':{ bgcolor:'rgba(0,230,118,0.1)' } }}>
              <EditNoteRoundedIcon sx={{ fontSize:18 }} />
            </IconButton>
            <IconButton size="small" onClick={()=>onDelete(fixture)}
              sx={{ color:'error.main', p:0.5, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)' } }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize:18 }} />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Knockout Match Card ────────────────────────────────────────────────────────
function KoMatchCard({ match, onResult, onDelete, isActive }) {
  const home = match.homeTeam?.name;
  const away = match.awayTeam?.name;
  const both = match.leg1?.played && (match.isFinal || match.leg2?.played);

  if (match.isPlaceholder) {
    return (
      <Card sx={{ background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:2 }}>
        <CardContent sx={{ p:'14px !important' }}>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
            <Typography variant="body2" sx={{ color:'text.disabled', fontWeight:600 }}>TBD</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight:700 }}>vs</Typography>
            <Typography variant="body2" sx={{ color:'text.disabled', fontWeight:600 }}>TBD</Typography>
          </Box>
          {match.isFinal ? (
            <Box sx={{ p:'6px 10px', borderRadius:1.5, background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)' }}>
              <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.04)', color:'text.disabled', fontSize:10 }} />
            </Box>
          ) : (
            [1, 2].map(l => (
              <Box key={l} sx={{ display:'flex', alignItems:'center', gap:1, p:'6px 10px', mb:0.5, borderRadius:1.5,
                background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color:'text.disabled', fontWeight:700, minWidth:36, fontSize:10 }}>LEG {l}</Typography>
                <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.04)', color:'text.disabled', fontSize:10 }} />
              </Box>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  const legs = match.isFinal ? [match.leg1] : [match.leg1, match.leg2];

  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#161f30)', transition:'all 0.2s',
      border: match.winner ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.07)',
      '&:hover':{ boxShadow:'0 6px 24px rgba(0,0,0,0.4)', borderColor:'rgba(0,230,118,0.25)' } }}>
      <CardContent sx={{ p:'14px !important' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <TeamBadge name={home||'?'} size={28} />
            <Typography variant="body2" sx={{ fontWeight:700 }} noWrap>{home}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight:700 }}>vs</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <Typography variant="body2" sx={{ fontWeight:700 }} noWrap>{away}</Typography>
            <TeamBadge name={away||'?'} size={28} />
          </Box>
        </Box>
        <Stack spacing={1}>
          {legs.filter(Boolean).map((leg,i)=>(
            <Box key={i} sx={{ display:'flex', alignItems:'center', gap:1, p:'6px 10px', borderRadius:1.5,
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
              {!match.isFinal && <Typography variant="caption" sx={{ color:'text.secondary', fontWeight:700, minWidth:36, fontSize:10 }}>LEG {i+1}</Typography>}
              <Box sx={{ flex:1 }}><ScorePill home={leg.homeScore} away={leg.awayScore} played={leg.played} /></Box>
              {isActive && (
                <Box sx={{ display:'flex', gap:0.25 }}>
                  <IconButton size="small" onClick={()=>onResult(leg)}
                    sx={{ color:'primary.main', p:0.4, '&:hover':{ bgcolor:'rgba(0,230,118,0.1)' } }}>
                    <EditNoteRoundedIcon sx={{ fontSize:16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={()=>onDelete(leg)}
                    sx={{ color:'error.main', p:0.4, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)' } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize:16 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
        {both && match.winner && (
          <Box sx={{ mt:1.5, pt:1.5, borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            {!match.isFinal && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>Aggregate</Typography>
                <Typography variant="body2" sx={{ fontWeight:800 }}>{match.aggregateHome} – {match.aggregateAway}</Typography>
              </Box>
            )}
            <Chip icon={<EmojiEventsRoundedIcon sx={{ fontSize:'14px !important', color:'#ffd740 !important' }} />}
              label={match.winner.name} size="small"
              sx={{ bgcolor:'rgba(255,215,64,0.12)', color:'#ffd740', fontWeight:800, border:'1px solid rgba(255,215,64,0.3)', fontSize:11 }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared data hook ───────────────────────────────────────────────────────────
function useGroupKnockoutData(tournamentId) {
  const [groupTables,   setGroupTables]   = useState([]);
  const [groupFixtures, setGroupFixtures] = useState([]);
  const [bracket,       setBracket]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [gtRes, gfRes, brRes] = await Promise.all([
        getGroupTables(tournamentId),
        getGroupFixtures(tournamentId),
        getGroupKnockout(tournamentId),
      ]);
      setGroupTables(gtRes.data);
      setGroupFixtures(gfRes.data);
      setBracket(brRes.data);
    } catch(e) { setError(e?.response?.data?.error || 'Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tournamentId]);

  return { groupTables, groupFixtures, bracket, loading, error, setError, load };
}

// ── TABLE VIEW ─────────────────────────────────────────────────────────────────
function TableView({ tournament, groupTables, loading, error, setError }) {
  // All rows across groups to find the overall leader
  const allRows = groupTables.flatMap(g => g.table);
  const leader  = allRows.reduce((best, r) => (!best || r.pts > best.pts) ? r : best, null);

  return (
    <Box>
      <PageHeader
        icon="📊"
        title="Table"
        subtitle={`${tournament.name} · Group standings`}
        action={leader?.pts > 0 ? (
          <Chip
            icon={<TrendingUpRoundedIcon sx={{ fontSize:'13px !important' }} />}
            label={leader.name}
            size="small"
            sx={{ bgcolor:'rgba(0,230,118,0.12)', border:'1px solid rgba(0,230,118,0.3)',
              fontWeight:700, color:'primary.main', fontSize:{ xs:10, sm:11 }, height:24,
              maxWidth:{ xs:130, sm:200 },
              '& .MuiChip-label':{ overflow:'hidden', textOverflow:'ellipsis' } }}
          />
        ) : null}
      />

      {error && <Alert severity="error" sx={{ mb:2, borderRadius:2 }} onClose={()=>setError('')}>{error}</Alert>}

      {loading ? (
        <LoadingState variant="rows" count={4} />
      ) : groupTables.length === 0 ? (
        <Box sx={{ textAlign:'center', py:6 }}>
          <Typography sx={{ fontSize:40, mb:1 }}>📊</Typography>
          <Typography variant="h6" sx={{ fontWeight:700 }}>No standings yet</Typography>
          <Typography color="text.secondary" variant="body2">Generate fixtures and enter results to see group tables</Typography>
        </Box>
      ) : (
        <Box>
          {groupTables.map(({ group, table }) => (
            <GroupTable key={group} groupName={group} table={table} />
          ))}
          {/* Legend */}
          <Box sx={{ display:{ xs:'none', sm:'flex' }, px:0.5, py:1, gap:2.5, flexWrap:'wrap' }}>
            {[['MP','Played'],['W','Won'],['D','Drawn'],['L','Lost'],['GD','Goal Diff'],['PTS','Points']].map(([k,v])=>(
              <Typography key={k} variant="caption" sx={{ color:'text.secondary', opacity:0.5, fontSize:9 }}>
                {k} · {v}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── FIXTURES VIEW ──────────────────────────────────────────────────────────────
export default function GroupKnockoutPage({ tournament, view = 'fixtures' }) {
  // All hooks must be called unconditionally (Rules of Hooks)
  const { groupTables, groupFixtures, bracket, loading, error, setError, load } = useGroupKnockoutData(tournament.id);

  const [generating,   setGenerating]   = useState(false);
  const [seeding,      setSeeding]      = useState(false);
  const [seedingFinal, setSeedingFinal] = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');
  const [resultFix,    setResultFix]    = useState(null);
  const [deleteFix,    setDeleteFix]    = useState(null);

  // Table view delegates to TableView after all hooks are called
  if (view === 'table') return <TableView groupTables={groupTables} loading={loading} error={error} setError={setError} tournament={tournament} />;

  const handleGenerate = async () => {
    if (groupFixtures.length > 0) {
      const ok = window.confirm('Re-draw will reset all group fixtures and results. Continue?');
      if (!ok) return;
    }
    setGenerating(true); setError('');
    try {
      // Use legs stored on the tournament (set at creation time)
      const legs = tournament.legs || 2;
      await generateFixtures(tournament.id, { legs });
      await load();
      setSuccessMsg(`Fixtures generated (${legs === 1 ? '1 leg' : '2 legs'})!`);
    } catch(e) { setError(e?.response?.data?.error || 'Generation failed'); }
    setGenerating(false);
  };

  const handleSeedKnockout = async () => {
    setSeeding(true); setError('');
    try { await seedKnockout(tournament.id); await load(); setSuccessMsg('Semi-finals seeded!'); }
    catch(e) { setError(e?.response?.data?.error || 'Seeding failed'); }
    setSeeding(false);
  };

  const handleSeedFinal = async () => {
    setSeedingFinal(true); setError('');
    try { await seedFinal(tournament.id); await load(); setSuccessMsg('Final seeded!'); }
    catch(e) { setError(e?.response?.data?.error || 'Could not seed final yet'); }
    setSeedingFinal(false);
  };

  const handleResult = async (fixtureId, scores) => {
    await addResult(tournament.id, fixtureId, scores);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteFix) return;
    await deleteFixture(tournament.id, deleteFix.id);
    setDeleteFix(null);
    await load();
  };

  const totalGroupFixtures  = groupFixtures.length;
  const playedGroupFixtures = groupFixtures.filter(f=>f.played).length;
  const allGroupComplete    = totalGroupFixtures > 0 && playedGroupFixtures === totalGroupFixtures;
  const sfRound    = bracket.find(r => r.roundName === 'Semi-Final');
  const finalRound = bracket.find(r => r.roundName === 'Final');
  const allSFComplete = sfRound?.matches.every(m => m.winner);
  const champion   = finalRound?.matches[0]?.winner;
  const groups     = [...new Set(groupFixtures.map(f => f.groupName).filter(Boolean))].sort();

  return (
    <Box>
      <PageHeader
        icon="⚽"
        title="Fixtures"
        subtitle={`${tournament.name} · ${playedGroupFixtures}/${totalGroupFixtures} group played`}
      />

      {error      && <Alert severity="error"   sx={{ mb:2, borderRadius:2 }} onClose={()=>setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb:2, borderRadius:2 }} onClose={()=>setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Champion banner */}
      {champion && (
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:2, mb:2.5, borderRadius:2,
          background:'linear-gradient(135deg,rgba(255,215,64,0.15),rgba(255,183,0,0.08))',
          border:'1px solid rgba(255,215,64,0.3)' }}>
          <Typography sx={{ fontSize:32 }}>🏆</Typography>
          <Box>
            <Typography variant="caption" sx={{ color:'#ffd740', fontWeight:700, fontSize:10, letterSpacing:'0.08em', display:'block' }}>CHAMPION</Typography>
            <Typography variant="h6" sx={{ fontWeight:900, color:'#ffd740', lineHeight:1.1 }}>{champion.name}</Typography>
          </Box>
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ mb:2.5, display:'flex', gap:1, flexWrap:'wrap' }}>
        <Button variant="contained" size="small"
          startIcon={<AutoFixHighRoundedIcon sx={{ fontSize:'16px !important' }} />}
          onClick={handleGenerate} disabled={generating}
          sx={{ background:'linear-gradient(135deg,#651fff,#3500cb)', color:'#fff', fontSize:{ xs:11, sm:13 } }}>
          {generating ? 'Generating…' : groupFixtures.length > 0 ? 'Re-draw Groups' : 'Generate Fixtures'}
        </Button>
        {allGroupComplete && !sfRound?.matches.some(m => !m.isPlaceholder) && (
          <Button variant="contained" size="small"
            startIcon={<AccountTreeRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={handleSeedKnockout} disabled={seeding}
            sx={{ background:'linear-gradient(135deg,#ff9800,#e65100)', color:'#000', fontWeight:800, fontSize:{ xs:11, sm:13 } }}>
            {seeding ? 'Seeding…' : 'Seed Semi-Finals →'}
          </Button>
        )}
        {allSFComplete && finalRound?.matches[0]?.isPlaceholder && (
          <Button variant="contained" size="small"
            startIcon={<EmojiEventsRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={handleSeedFinal} disabled={seedingFinal}
            sx={{ background:'linear-gradient(135deg,#ffd740,#ff9800)', color:'#000', fontWeight:800, fontSize:{ xs:11, sm:13 } }}>
            {seedingFinal ? 'Seeding…' : 'Seed Final →'}
          </Button>
        )}
      </Box>

      {loading ? (
        <LoadingState variant="rows" count={4} />
      ) : (
        <Box>
          {/* ── Group Fixtures ── */}
          {groups.length === 0 ? (
            <Box sx={{ textAlign:'center', py:6 }}>
              <Typography sx={{ fontSize:40, mb:1 }}>⚽</Typography>
              <Typography variant="h6" sx={{ fontWeight:700 }}>No fixtures yet</Typography>
              <Typography color="text.secondary" variant="body2">Click "Generate Fixtures" to create group stage matches</Typography>
            </Box>
          ) : (
            <Box sx={{ mb:4 }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
                <SportsSoccerRoundedIcon sx={{ fontSize:15, color:'primary.main' }} />
                <Typography variant="overline" sx={{ fontWeight:800, fontSize:10, letterSpacing:'0.12em', color:'primary.main' }}>
                  GROUP STAGE
                </Typography>
                <Chip label={`${playedGroupFixtures}/${totalGroupFixtures} played`} size="small"
                  sx={{ height:18, fontSize:9, fontWeight:700,
                    bgcolor:'rgba(0,230,118,0.1)', color:'primary.main', border:'1px solid rgba(0,230,118,0.2)', ml:0.5 }} />
              </Box>
              {groups.map(grp => {
                const grpFix = groupFixtures.filter(f => f.groupName === grp);
                const leg1   = grpFix.filter(f => f.leg===1 || !f.leg);
                const leg2   = grpFix.filter(f => f.leg===2);
                const hasTwoLegs = leg2.length > 0;
                return (
                  <Box key={grp} sx={{ mb:3 }}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mb:1 }}>
                      <Box sx={{ width:6, height:6, borderRadius:'50%', bgcolor:'#ff9800' }} />
                      <Typography variant="caption" sx={{ fontWeight:800, color:'#ff9800', letterSpacing:'0.08em', fontSize:10 }}>
                        GROUP {grp}
                      </Typography>
                    </Box>
                    {leg1.length > 0 && (
                      <Box sx={{ mb: hasTwoLegs ? 1.5 : 0 }}>
                        {hasTwoLegs && (
                          <Typography variant="caption" color="text.secondary"
                            sx={{ fontSize:9, letterSpacing:1, display:'block', mb:0.75, fontWeight:700 }}>FIRST LEG</Typography>
                        )}
                        <Stack spacing={0.75}>{leg1.map(f=><GroupFixtureCard key={f.id} fixture={f} onResult={setResultFix} onDelete={setDeleteFix} />)}</Stack>
                      </Box>
                    )}
                    {leg2.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary"
                          sx={{ fontSize:9, letterSpacing:1, display:'block', mb:0.75, fontWeight:700 }}>SECOND LEG</Typography>
                        <Stack spacing={0.75}>{leg2.map(f=><GroupFixtureCard key={f.id} fixture={f} onResult={setResultFix} onDelete={setDeleteFix} />)}</Stack>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* ── Knockout Stage ── */}
          {bracket.length > 0 && (
            <Box>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
                <AccountTreeRoundedIcon sx={{ fontSize:15, color:'#ff9800' }} />
                <Typography variant="overline" sx={{ fontWeight:800, fontSize:10, letterSpacing:'0.12em', color:'#ff9800' }}>
                  KNOCKOUT STAGE
                </Typography>
              </Box>
              <Box sx={{ overflowX:'auto', pb:1, mx:-1.5, px:1.5 }}>
                <Box sx={{ display:'flex', gap:2, alignItems:'flex-start',
                  minWidth: bracket.length > 1 ? bracket.length * 260 : 'auto' }}>
                  {bracket.map(round => {
                    const isCurrent = round.roundName === 'Semi-Final' ? !allSFComplete : round.roundName === 'Final';
                    return (
                      <Box key={round.round} sx={{ flex:1, minWidth:240 }}>
                        <Box sx={{ textAlign:'center', mb:1.5, py:1, borderRadius:1.5,
                          background: isCurrent
                            ? 'linear-gradient(135deg,rgba(255,152,0,0.15),rgba(255,87,34,0.1))'
                            : 'rgba(255,255,255,0.03)',
                          border:`1px solid ${isCurrent ? 'rgba(255,152,0,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                          <Typography variant="overline" sx={{ fontWeight:800, letterSpacing:'0.08em', fontSize:10,
                            color: isCurrent ? '#ff9800' : 'text.secondary' }}>
                            {round.roundName}
                          </Typography>
                          {round.roundName === 'Semi-Final' && (
                            <Typography variant="caption" sx={{ display:'block', fontSize:9, color:'text.secondary' }}>2 legs · aggregate</Typography>
                          )}
                          {round.roundName === 'Final' && (
                            <Typography variant="caption" sx={{ display:'block', fontSize:9, color:'text.secondary' }}>Single match</Typography>
                          )}
                        </Box>
                        <Stack spacing={1.5}>
                          {round.matches.map(match => (
                            <KoMatchCard key={match.matchNumber} match={match}
                              onResult={setResultFix} onDelete={setDeleteFix} isActive={isCurrent} />
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <ResultDialog open={!!resultFix} fixture={resultFix} onSave={handleResult} onClose={()=>setResultFix(null)} />
      <ConfirmDialog open={!!deleteFix} title="Delete Fixture"
        message={`Delete this match between "${deleteFix?.homeTeam?.name||'?'}" and "${deleteFix?.awayTeam?.name||'?'}"?`}
        onConfirm={handleDelete} onCancel={()=>setDeleteFix(null)} />
    </Box>
  );
}
