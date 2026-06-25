import { useState, useEffect } from 'react';
import {
  Box, Tab, Tabs, Typography, Card, CardContent, Chip, Stack,
  Button, Alert, Skeleton, Avatar, IconButton
} from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  getGroupTables, getGroupFixtures, getGroupKnockout,
  generateFixtures, seedKnockout, seedFinal,
  addResult, deleteFixture
} from '../api/footballApi';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, InputAdornment
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

// ── Group Table ────────────────────────────────────────────────────────────────
function GroupTable({ groupName, table }) {
  return (
    <Box sx={{ mb:3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight:800, mb:1.25, color:'text.primary', fontSize:15 }}>
        Group {groupName}
      </Typography>
      <Card sx={{ background:'linear-gradient(160deg,#111827,#131d2e)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:2.5, overflow:'hidden' }}>
        {/* Header */}
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
        {/* Rows */}
        {table.map((row, idx) => {
          const isQualified = idx < 2;
          const gdLabel = row.gd > 0 ? `+${row.gd}` : String(row.gd);
          return (
            <Box key={row.teamId} sx={{
              display:'flex', alignItems:'center', px:2, py:1,
              borderBottom: idx===table.length-1?'none':'1px solid rgba(255,255,255,0.04)',
              borderLeft: isQualified ? '3px solid #00e676' : '3px solid transparent',
              background: isQualified && idx===0 ? 'linear-gradient(90deg,rgba(0,230,118,0.07),transparent)' : 'transparent',
            }}>
              <Box sx={{ width:20, display:'flex', justifyContent:'center', flexShrink:0 }}>
                {idx===0 ? <EmojiEventsRoundedIcon sx={{ color:'#FFD700', fontSize:16 }} />
                  : idx===1 ? <EmojiEventsRoundedIcon sx={{ color:'#C0C0C0', fontSize:16 }} />
                  : <Typography sx={{ fontWeight:800, color:'text.secondary', fontSize:11, width:16, textAlign:'center' }}>{idx+1}</Typography>}
              </Box>
              <Box sx={{ display:'flex', alignItems:'center', gap:1.25, flex:1, minWidth:0, ml:1.5 }}>
                <Avatar sx={{ bgcolor:getColor(row.name), color:'#000', fontWeight:800, fontSize:10, width:26, height:26 }}>
                  {getInit(row.name)}
                </Avatar>
                <Typography sx={{ fontWeight:700, fontSize:'0.8rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {row.name}
                </Typography>
                {isQualified && (
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
        <Box sx={{ px:2, py:0.75, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <Box sx={{ width:8, height:8, borderRadius:'50%', bgcolor:'#00e676' }} />
            <Typography variant="caption" sx={{ fontSize:9, color:'text.secondary' }}>Top 2 qualify for Semi-Finals</Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

// ── Fixture Card (group stage) ────────────────────────────────────────────────
function GroupFixtureCard({ fixture, onResult, onDelete }) {
  const home = fixture.homeTeam?.name || '?';
  const away = fixture.awayTeam?.name || '?';
  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#151e2e)', '&:hover':{ borderColor:'rgba(0,230,118,0.2)' } }}>
      <CardContent sx={{ p:'10px 12px !important' }}>
        {fixture.leg && (
          <Typography variant="caption" sx={{ color:'primary.main', fontWeight:700, fontSize:9, letterSpacing:'0.06em', display:'block', mb:0.25 }}>
            LEG {fixture.leg}
          </Typography>
        )}
        <Box sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, justifyContent:'flex-end', minWidth:0 }}>
            <Typography variant="caption" noWrap sx={{ fontWeight:700, textAlign:'right', fontSize:12 }}>{home}</Typography>
            <TeamBadge name={home} size={28} />
          </Box>
          <Box sx={{ flexShrink:0, px:0.5 }}>
            <ScorePill home={fixture.homeScore} away={fixture.awayScore} played={fixture.played} />
          </Box>
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, minWidth:0 }}>
            <TeamBadge name={away} size={28} />
            <Typography variant="caption" noWrap sx={{ fontWeight:700, fontSize:12 }}>{away}</Typography>
          </Box>
          <Box sx={{ display:'flex', flexShrink:0, ml:0.25 }}>
            <IconButton size="small" onClick={()=>onResult(fixture)} sx={{ color:'primary.main', p:0.5 }}>
              <EditNoteRoundedIcon sx={{ fontSize:18 }} />
            </IconButton>
            <IconButton size="small" onClick={()=>onDelete(fixture)} sx={{ color:'error.main', p:0.5 }}>
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
          {!match.isFinal && [1,2].map(l=>(
            <Box key={l} sx={{ display:'flex', alignItems:'center', gap:1, p:'6px 10px', mb:0.5, borderRadius:1.5,
              background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color:'text.disabled', fontWeight:700, minWidth:36, fontSize:10 }}>LEG {l}</Typography>
              <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.04)', color:'text.disabled', fontSize:10 }} />
            </Box>
          ))}
          {match.isFinal && (
            <Box sx={{ p:'6px 10px', borderRadius:1.5, background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)' }}>
              <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.04)', color:'text.disabled', fontSize:10 }} />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  const legs = match.isFinal ? [match.leg1] : [match.leg1, match.leg2];

  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#161f30)',
      border: match.winner ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
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
                  <IconButton size="small" onClick={()=>onResult(leg)} sx={{ color:'primary.main', p:0.4 }}>
                    <EditNoteRoundedIcon sx={{ fontSize:16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={()=>onDelete(leg)} sx={{ color:'error.main', p:0.4 }}>
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function GroupKnockoutPage({ tournament }) {
  const [tab, setTab]             = useState(0);
  const [groupTables, setGroupTables] = useState([]);
  const [groupFixtures, setGroupFixtures] = useState([]);
  const [bracket, setBracket]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding]     = useState(false);
  const [seedingFinal, setSeedingFinal] = useState(false);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resultFix, setResultFix] = useState(null);
  const [deleteFix, setDeleteFix] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [gtRes, gfRes, brRes] = await Promise.all([
        getGroupTables(tournament.id),
        getGroupFixtures(tournament.id),
        getGroupKnockout(tournament.id),
      ]);
      setGroupTables(gtRes.data);
      setGroupFixtures(gfRes.data);
      setBracket(brRes.data);
    } catch(e) { setError(e?.response?.data?.error || 'Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tournament.id]);

  const handleGenerate = async () => {
    const ok = groupFixtures.length > 0 ? window.confirm('Re-generate will reset all fixtures and results. Continue?') : true;
    if (!ok) return;
    setGenerating(true); setError('');
    try { await generateFixtures(tournament.id); await load(); setSuccessMsg('Fixtures generated!'); }
    catch(e) { setError(e?.response?.data?.error || 'Generation failed'); }
    setGenerating(false);
  };

  const handleSeedKnockout = async () => {
    setSeeding(true); setError('');
    try { await seedKnockout(tournament.id); await load(); setSuccessMsg('Semi-finals seeded from group standings!'); setTab(1); }
    catch(e) { setError(e?.response?.data?.error || 'Seeding failed'); }
    setSeeding(false);
  };

  const handleSeedFinal = async () => {
    setSeedingFinal(true); setError('');
    try { await seedFinal(tournament.id); await load(); setSuccessMsg('Final seeded!'); }
    catch(e) { setError(e?.response?.data?.error || 'Could not seed final — complete all semi-finals first'); }
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

  // Group stage stats
  const totalGroupFixtures = groupFixtures.length;
  const playedGroupFixtures = groupFixtures.filter(f=>f.played).length;
  const allGroupComplete = totalGroupFixtures > 0 && playedGroupFixtures === totalGroupFixtures;

  // Knockout bracket info
  const sfRound = bracket.find(r => r.roundName === 'Semi-Final');
  const finalRound = bracket.find(r => r.roundName === 'Final');
  const allSFComplete = sfRound?.matches.every(m => m.winner);
  const champion = finalRound?.matches[0]?.winner;

  // Group fixtures grouped by group
  const groups = [...new Set(groupFixtures.map(f => f.groupName).filter(Boolean))].sort();

  return (
    <Box>
      <PageHeader icon="🏆" title="Group + Knockout" subtitle={`${tournament.name} · ${tournament.numGroups||2} Groups`} />

      {error && <Alert severity="error" sx={{ mb:2, borderRadius:2 }} onClose={()=>setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb:2, borderRadius:2 }} onClose={()=>setSuccessMsg('')}>{successMsg}</Alert>}

      {champion && (
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:2, mb:2, borderRadius:2,
          background:'linear-gradient(135deg,rgba(255,215,64,0.15),rgba(255,183,0,0.08))',
          border:'1px solid rgba(255,215,64,0.3)' }}>
          <Typography sx={{ fontSize:32 }}>🏆</Typography>
          <Box>
            <Typography variant="caption" sx={{ color:'#ffd740', fontWeight:700, fontSize:10, letterSpacing:'0.08em', display:'block' }}>CHAMPION</Typography>
            <Typography variant="h6" sx={{ fontWeight:900, color:'#ffd740', lineHeight:1.1 }}>{champion.name}</Typography>
          </Box>
        </Box>
      )}

      {/* Generate button */}
      <Box sx={{ mb:2, display:'flex', gap:1, flexWrap:'wrap' }}>
        <Button variant="contained" size="small" startIcon={<AutoFixHighRoundedIcon sx={{ fontSize:'16px !important' }} />}
          onClick={handleGenerate} disabled={generating}
          sx={{ background:'linear-gradient(135deg,#651fff,#3500cb)', color:'#fff', fontSize:12 }}>
          {generating ? 'Generating…' : groupFixtures.length > 0 ? 'Re-draw Groups' : 'Generate Fixtures'}
        </Button>
        {allGroupComplete && !sfRound?.matches.some(m => !m.isPlaceholder) && (
          <Button variant="contained" size="small" startIcon={<AccountTreeRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={handleSeedKnockout} disabled={seeding}
            sx={{ background:'linear-gradient(135deg,#ff9800,#e65100)', color:'#000', fontWeight:800, fontSize:12 }}>
            {seeding ? 'Seeding…' : 'Seed Semi-Finals →'}
          </Button>
        )}
        {allSFComplete && finalRound?.matches[0]?.isPlaceholder && (
          <Button variant="contained" size="small" startIcon={<EmojiEventsRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={handleSeedFinal} disabled={seedingFinal}
            sx={{ background:'linear-gradient(135deg,#ffd740,#ff9800)', color:'#000', fontWeight:800, fontSize:12 }}>
            {seedingFinal ? 'Seeding…' : 'Seed Final →'}
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb:2, borderBottom:'1px solid rgba(255,255,255,0.07)',
        '& .MuiTab-root':{ fontWeight:700, fontSize:13, minWidth:0, px:2 },
        '& .Mui-selected':{ color:'primary.main' },
        '& .MuiTabs-indicator':{ bgcolor:'primary.main' } }}>
        <Tab label="Group Stage" icon={<SportsSoccerRoundedIcon sx={{ fontSize:16 }} />} iconPosition="start" />
        <Tab label="Knockout Stage" icon={<AccountTreeRoundedIcon sx={{ fontSize:16 }} />} iconPosition="start" />
      </Tabs>

      {loading ? (
        <Stack spacing={2}>{[1,2,3].map(n=><Skeleton key={n} variant="rectangular" height={80} sx={{ borderRadius:2 }} />)}</Stack>
      ) : tab === 0 ? (
        /* ── Group Stage Tab ── */
        <Box>
          {groupTables.length === 0 ? (
            <Box sx={{ textAlign:'center', py:6 }}>
              <Typography sx={{ fontSize:40, mb:1 }}>⚽</Typography>
              <Typography variant="h6" sx={{ fontWeight:700 }}>No fixtures yet</Typography>
              <Typography color="text.secondary" variant="body2">Click "Generate Fixtures" to create group stage matches</Typography>
            </Box>
          ) : (
            <Box>
              {/* Points tables */}
              {groupTables.map(({ group, table }) => (
                <GroupTable key={group} groupName={group} table={table} />
              ))}

              {/* Group fixtures */}
              {groups.length > 0 && (
                <Box sx={{ mt:2 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing:1.5, mb:1.5, display:'block', fontSize:9 }}>
                    FIXTURES · {playedGroupFixtures}/{totalGroupFixtures} played
                  </Typography>
                  {groups.map(grp => {
                    const grpFix = groupFixtures.filter(f => f.groupName === grp);
                    const leg1 = grpFix.filter(f=>f.leg===1||!f.leg);
                    const leg2 = grpFix.filter(f=>f.leg===2);
                    return (
                      <Box key={grp} sx={{ mb:3 }}>
                        <Typography variant="caption" sx={{ fontWeight:800, color:'#ff9800', letterSpacing:'0.08em', fontSize:10, display:'block', mb:1 }}>
                          GROUP {grp}
                        </Typography>
                        {leg1.length > 0 && (
                          <Box sx={{ mb:1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize:9, letterSpacing:1, display:'block', mb:0.75 }}>FIRST LEG</Typography>
                            <Stack spacing={0.75}>{leg1.map(f=><GroupFixtureCard key={f.id} fixture={f} onResult={setResultFix} onDelete={setDeleteFix} />)}</Stack>
                          </Box>
                        )}
                        {leg2.length > 0 && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize:9, letterSpacing:1, display:'block', mb:0.75 }}>SECOND LEG</Typography>
                            <Stack spacing={0.75}>{leg2.map(f=><GroupFixtureCard key={f.id} fixture={f} onResult={setResultFix} onDelete={setDeleteFix} />)}</Stack>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </Box>
      ) : (
        /* ── Knockout Stage Tab ── */
        <Box>
          {bracket.length === 0 ? (
            <Box sx={{ textAlign:'center', py:6 }}>
              <Typography sx={{ fontSize:40, mb:1 }}>🏆</Typography>
              <Typography variant="h6" sx={{ fontWeight:700 }}>Knockout stage not ready</Typography>
              <Typography color="text.secondary" variant="body2">Complete all group fixtures first, then seed the semi-finals</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX:'auto', pb:1 }}>
              <Box sx={{ display:'flex', gap:2, alignItems:'flex-start', minWidth: bracket.length > 1 ? bracket.length * 260 : 'auto' }}>
                {bracket.map((round, ri) => {
                  const isCurrent = round.roundName === 'Semi-Final' ? !allSFComplete : round.roundName === 'Final';
                  return (
                    <Box key={round.round} sx={{ flex:1, minWidth:240 }}>
                      <Box sx={{ textAlign:'center', mb:1.5, py:1, borderRadius:1.5,
                        background: isCurrent ? 'linear-gradient(135deg,rgba(255,152,0,0.15),rgba(255,87,34,0.1))' : 'rgba(255,255,255,0.03)',
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
                        {round.matches.map(match=>(
                          <KoMatchCard key={match.matchNumber} match={match}
                            onResult={setResultFix} onDelete={setDeleteFix} isActive={isCurrent} />
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
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
