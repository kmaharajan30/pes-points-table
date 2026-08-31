import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton,
  TextField, Tooltip, Typography, MenuItem, Select,
  FormControl, InputLabel, Stack, Alert, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import {
  getFixtures, createFixture, addResult, deleteFixture,
  getTeams, generateFixtures, knockoutAdvance, getKnockoutBracket, getPlayers,
  createTeam, deleteTeam, addTeamToFixtures, getGlobalTeams
} from '../api/footballApi';

// ─── Shared utils ─────────────────────────────────────────────────────────────
const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (name='') => { let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (name='') => name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

function TeamBadge({ name='', size=36 }) {
  return (
    <Box sx={{ width:size, height:size, borderRadius:'50%', bgcolor:getColor(name), color:'#000',
      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:size*0.35, flexShrink:0 }}>
      {getInit(name)}
    </Box>
  );
}

function ScorePill({ home, away, played, compact=false }) {
  if (!played) return <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.06)', color:'text.secondary', fontWeight:600, fontSize:10 }} />;
  const isDraw = home===away;
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:0.5, px:compact?1:2, py:0.4, borderRadius:99,
      background: isDraw?'rgba(255,215,64,0.12)':'rgba(0,230,118,0.10)',
      border:`1px solid ${isDraw?'rgba(255,215,64,0.25)':'rgba(0,230,118,0.2)'}` }}>
      <Typography sx={{ fontWeight:900, fontSize:compact?'0.85rem':'1.05rem', color: home>away?'primary.main':(isDraw?'warning.main':'text.secondary') }}>{home}</Typography>
      <Typography sx={{ fontWeight:700, color:'text.secondary', mx:0.3 }}>–</Typography>
      <Typography sx={{ fontWeight:900, fontSize:compact?'0.85rem':'1.05rem', color: away>home?'primary.main':(isDraw?'warning.main':'text.secondary') }}>{away}</Typography>
    </Box>
  );
}

// ─── Result Dialog (shared) ───────────────────────────────────────────────────
function ResultDialog({ open, fixture, onSave, onClose, players = [] }) {
  const theme   = useTheme();
  const isMobile= useMediaQuery(theme.breakpoints.down('sm'));
  const [score, setScore] = useState({ home:'', away:'' });
  const [homeUserId, setHomeUserId] = useState('');
  const [awayUserId, setAwayUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fixture) {
      setScore({ home: fixture.played ? String(fixture.homeScore) : '', away: fixture.played ? String(fixture.awayScore) : '' });
      setHomeUserId('');
      setAwayUserId('');
    }
  }, [fixture]);

  const handleSave = async () => {
    if (score.home===''||score.away==='') return;
    setSaving(true);
    await onSave(fixture.id, { homeScore:Number(score.home), awayScore:Number(score.away), homeUserId: homeUserId || undefined, awayUserId: awayUserId || undefined });
    setSaving(false); onClose();
  };

  const homeName = fixture?.homeTeam?.name || '?';
  const awayName = fixture?.awayTeam?.name || '?';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}
      PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
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
            <TeamBadge name={homeName} size={40} />
            <Typography variant="caption" sx={{ fontWeight:700, fontSize:11 }}>{homeName}</Typography>
          </Box>
          <Typography sx={{ fontWeight:800, color:'text.secondary', fontSize:13 }}>vs</Typography>
          <Box sx={{ flex:1, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:0.5 }}>
            <TeamBadge name={awayName} size={40} />
            <Typography variant="caption" sx={{ fontWeight:700, fontSize:11 }}>{awayName}</Typography>
          </Box>
        </Box>
        <Box sx={{ display:'flex', gap:1.5, alignItems:'center' }}>
          <TextField label="Home" type="number" fullWidth size="small" inputProps={{ min:0 }} autoFocus
            value={score.home} onChange={e=>setScore({...score,home:e.target.value})} />
          <Typography sx={{ fontWeight:800, color:'text.secondary', flexShrink:0 }}>–</Typography>
          <TextField label="Away" type="number" fullWidth size="small" inputProps={{ min:0 }}
            value={score.away} onChange={e=>setScore({...score,away:e.target.value})} />
        </Box>
        {players.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block', fontSize: 10 }}>
              Assign Players (optional)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Home Player</InputLabel>
                <Select value={homeUserId} label="Home Player" onChange={e => setHomeUserId(e.target.value)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {players.filter(p => p.id !== awayUserId).map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Away Player</InputLabel>
                <Select value={awayUserId} label="Away Player" onChange={e => setAwayUserId(e.target.value)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {players.filter(p => p.id !== homeUserId).map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" size="small"
          sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" size="small"
          disabled={score.home===''||score.away===''||saving}
          sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Single fixture card ──────────────────────────────────────────────────────
function FixtureCard({ fixture, onResult, onDelete, isAdmin }) {
  const homeName = fixture.homeTeam?.name || '?';
  const awayName = fixture.awayTeam?.name || '?';
  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#151e2e)', transition:'all 0.15s',
      '&:active':{ opacity:0.85 },
      '&:hover':{ borderColor:'rgba(0,230,118,0.2)' } }}>
      <CardContent sx={{ p:'10px 12px !important' }}>
        {fixture.leg && (
          <Typography variant="caption" sx={{ color:'primary.main', fontWeight:700, fontSize:9, letterSpacing:'0.06em', display:'block', mb:0.25 }}>
            LEG {fixture.leg}
          </Typography>
        )}
        <Box sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
          {/* Home */}
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, justifyContent:'flex-end', minWidth:0 }}>
            <Typography variant="caption" noWrap sx={{ fontWeight:700, textAlign:'right', fontSize:{ xs:11, sm:12 } }}>{homeName}</Typography>
            <TeamBadge name={homeName} size={28} />
          </Box>
          {/* Score */}
          <Box sx={{ flexShrink:0, px:0.5 }}>
            <ScorePill home={fixture.homeScore} away={fixture.awayScore} played={fixture.played} compact />
          </Box>
          {/* Away */}
          <Box sx={{ flex:1, display:'flex', alignItems:'center', gap:0.75, minWidth:0 }}>
            <TeamBadge name={awayName} size={28} />
            <Typography variant="caption" noWrap sx={{ fontWeight:700, fontSize:{ xs:11, sm:12 } }}>{awayName}</Typography>
          </Box>
          {/* Actions */}
          <Box sx={{ display:'flex', flexShrink:0, ml:0.25 }}>
            <IconButton size="small" onClick={()=>onResult(fixture)}
              sx={{ color:'primary.main', p:0.5, '&:hover':{ bgcolor:'rgba(0,230,118,0.1)' } }}>
              <EditNoteRoundedIcon sx={{ fontSize:18 }} />
            </IconButton>
            {isAdmin && (
              <IconButton size="small" onClick={()=>onDelete(fixture)}
                sx={{ color:'error.main', p:0.5, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize:18 }} />
              </IconButton>
            )}
          </Box>
        </Box>
        {fixture.date && (
          <Typography variant="caption" color="text.secondary"
            sx={{ display:'block', textAlign:'center', mt:0.5, fontSize:9 }}>
            📅 {new Date(fixture.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── League Fixtures View ─────────────────────────────────────────────────────
function LeagueFixtures({ tournament, teams, fixtures, onResult, onDelete, onRegenerate, generating, isAdmin, onTeamsChanged }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [addOpen, setAddOpen]             = useState(false);
  const [form, setForm]                   = useState({ homeTeamId:'', awayTeamId:'', date:'' });
  const [saving, setSaving]               = useState(false);

  // ── Add Team to fixtures state ─────────────────────────────────────────────
  const [addTeamOpen, setAddTeamOpen]         = useState(false);
  const [globalTeams, setGlobalTeams]         = useState([]);
  const [globalTeamsLoading, setGlobalTeamsLoading] = useState(false);
  const [selectedGlobalTeam, setSelectedGlobalTeam] = useState(null);
  const [addTeamSaving, setAddTeamSaving]     = useState(false);
  const [addTeamError, setAddTeamError]       = useState('');

  // ── Remove Team state ──────────────────────────────────────────────────────
  const [removeTeamOpen, setRemoveTeamOpen]     = useState(false);
  const [teamToRemove, setTeamToRemove]          = useState(null);
  const [removeTeamSaving, setRemoveTeamSaving] = useState(false);

  const leg1 = fixtures.filter(f=>f.leg===1||!f.leg);
  const leg2 = fixtures.filter(f=>f.leg===2);

  const handleAdd = async () => {
    if (!form.homeTeamId||!form.awayTeamId) return;
    setSaving(true);
    await createFixture(tournament.id, form);
    setForm({ homeTeamId:'', awayTeamId:'', date:'' });
    setAddOpen(false); setSaving(false); onRegenerate?.();
  };

  // Load global teams and open the Add Team dialog
  const handleOpenAddTeam = async () => {
    setSelectedGlobalTeam(null);
    setAddTeamError('');
    setAddTeamOpen(true);
    setGlobalTeamsLoading(true);
    try {
      const res = await getGlobalTeams();
      // Filter out teams already in this tournament (by name, case-insensitive)
      const existingNames = new Set(teams.map(t => t.name.toLowerCase()));
      setGlobalTeams(res.data.filter(gt => !existingNames.has(gt.name.toLowerCase())));
    } catch (e) {
      setAddTeamError('Failed to load global teams');
    }
    setGlobalTeamsLoading(false);
  };

  // Add selected global team then generate its fixtures
  const handleAddTeam = async () => {
    if (!selectedGlobalTeam) return;
    setAddTeamSaving(true);
    setAddTeamError('');
    try {
      const teamRes = await createTeam(tournament.id, { name: selectedGlobalTeam.name });
      const newTeamId = teamRes.data.id;
      // Only generate fixtures if there are already other teams
      if (teams.length >= 1) {
        await addTeamToFixtures(tournament.id, newTeamId);
      }
      setSelectedGlobalTeam(null);
      setAddTeamOpen(false);
      onTeamsChanged?.();
    } catch (e) {
      setAddTeamError(e?.response?.data?.error || 'Failed to add team');
    }
    setAddTeamSaving(false);
  };

  // Delete team and all their fixtures (cascade recalculates points table automatically)
  const handleRemoveTeam = async () => {
    if (!teamToRemove) return;
    setRemoveTeamSaving(true);
    try {
      await deleteTeam(tournament.id, teamToRemove.id);
      setTeamToRemove(null);
      setRemoveTeamOpen(false);
      onTeamsChanged?.();
    } catch (e) {
      // fallback — still close
      setTeamToRemove(null);
      setRemoveTeamOpen(false);
    }
    setRemoveTeamSaving(false);
  };

  // Count fixtures involving a team (to show in remove warning)
  const teamFixtureCount = (teamId) =>
    fixtures.filter(f => f.homeTeamId === teamId || f.awayTeamId === teamId).length;
  const teamPlayedCount = (teamId) =>
    fixtures.filter(f => (f.homeTeamId === teamId || f.awayTeamId === teamId) && f.played).length;

  return (
    <Box>
      {isAdmin && (
        <Box sx={{ display:'flex', gap:1, mb:2, flexWrap:'wrap' }}>
          <Button variant="contained" size="small"
            startIcon={<AutoFixHighRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>onRegenerate(true)} disabled={generating}
            sx={{ background:'linear-gradient(135deg,#651fff,#3500cb)', color:'#fff', fontSize:{ xs:11, sm:13 } }}>
            {generating?'Generating…':'Auto-Generate'}
          </Button>
          <Button variant="outlined" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>setAddOpen(true)} disabled={teams.length<2}
            sx={{ borderColor:'rgba(255,255,255,0.15)', fontSize:{ xs:11, sm:13 } }}>
            Add Fixture
          </Button>
          <Button variant="outlined" size="small"
            startIcon={<PersonAddAlt1RoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={handleOpenAddTeam}
            sx={{ borderColor:'rgba(0,230,118,0.35)', color:'primary.main', fontSize:{ xs:11, sm:13 },
              '&:hover':{ borderColor:'primary.main', bgcolor:'rgba(0,230,118,0.06)' } }}>
            Add Team
          </Button>
          {teams.length > 0 && (
            <Button variant="outlined" size="small"
              startIcon={<PersonRemoveRoundedIcon sx={{ fontSize:'16px !important' }} />}
              onClick={()=>setRemoveTeamOpen(true)}
              sx={{ borderColor:'rgba(255,82,82,0.35)', color:'error.main', fontSize:{ xs:11, sm:13 },
                '&:hover':{ borderColor:'error.main', bgcolor:'rgba(255,82,82,0.06)' } }}>
              Remove Team
            </Button>
          )}
        </Box>
      )}

      {fixtures.length===0 ? (
        <EmptyState icon={<SportsSoccerRoundedIcon sx={{ fontSize:48 }}/>} title="No fixtures yet"
          subtitle="Tap 'Auto-Generate' to create the full fixture list" />
      ) : (
        <Stack spacing={2.5}>
          {leg1.length>0 && (
            <Box>
              <Typography variant="overline" color="text.secondary"
                sx={{ letterSpacing:1.5, mb:1, display:'block', fontSize:9 }}>
                First Leg · {leg1.filter(f=>f.played).length}/{leg1.length} played
              </Typography>
              <Stack spacing={1}>{leg1.map(f=><FixtureCard key={f.id} fixture={f} onResult={onResult} onDelete={onDelete} isAdmin={isAdmin} />)}</Stack>
            </Box>
          )}
          {leg2.length>0 && (
            <Box>
              <Typography variant="overline" color="text.secondary"
                sx={{ letterSpacing:1.5, mb:1, display:'block', fontSize:9 }}>
                Second Leg · {leg2.filter(f=>f.played).length}/{leg2.length} played
              </Typography>
              <Stack spacing={1}>{leg2.map(f=><FixtureCard key={f.id} fixture={f} onResult={onResult} onDelete={onDelete} isAdmin={isAdmin} />)}</Stack>
            </Box>
          )}
        </Stack>
      )}

      {/* ── Add Fixture dialog ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={()=>setAddOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
        <DialogTitle sx={{ pb:1 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}>
            <SportsSoccerRoundedIcon sx={{ color:'primary.main', fontSize:18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight:700 }}>Add Fixture</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'12px !important' }}>
          <FormControl fullWidth size="small"><InputLabel>Home Team</InputLabel>
            <Select value={form.homeTeamId} label="Home Team" onChange={e=>setForm({...form,homeTeamId:e.target.value})}>
              {teams.filter(t=>t.id!==form.awayTeamId).map(t=>(
                <MenuItem key={t.id} value={t.id}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}><TeamBadge name={t.name} size={22}/><Typography variant="body2">{t.name}</Typography></Box>
                </MenuItem>))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small"><InputLabel>Away Team</InputLabel>
            <Select value={form.awayTeamId} label="Away Team" onChange={e=>setForm({...form,awayTeamId:e.target.value})}>
              {teams.filter(t=>t.id!==form.homeTeamId).map(t=>(
                <MenuItem key={t.id} value={t.id}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}><TeamBadge name={t.name} size={22}/><Typography variant="body2">{t.name}</Typography></Box>
                </MenuItem>))}
            </Select>
          </FormControl>
          <TextField label="Match Date (optional)" type="date" fullWidth size="small"
            value={form.date} onChange={e=>setForm({...form,date:e.target.value})} InputLabelProps={{ shrink:true }} />
        </DialogContent>
        <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
          <Button onClick={()=>setAddOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" size="small"
            disabled={!form.homeTeamId||!form.awayTeamId||saving}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>Schedule</Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Team to Fixtures dialog ────────────────────────────────── */}
      <Dialog open={addTeamOpen} onClose={()=>setAddTeamOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
        <DialogTitle sx={{ pb:1 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}>
            <PersonAddAlt1RoundedIcon sx={{ color:'primary.main', fontSize:18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight:700 }}>Add Team to League</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:1.5, pt:'12px !important' }}>
          {addTeamError && <Alert severity="error" sx={{ fontSize:12 }}>{addTeamError}</Alert>}
          {globalTeamsLoading ? (
            <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
              {[1,2,3].map(i => (
                <Box key={i} sx={{ height:48, borderRadius:1.5, bgcolor:'rgba(255,255,255,0.05)', animation:'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </Box>
          ) : globalTeams.length === 0 ? (
            <Box sx={{ textAlign:'center', py:3 }}>
              <Typography sx={{ fontSize:28, mb:1 }}>🏟️</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize:12 }}>
                No global teams available to add.<br/>All global teams are already in this tournament.
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize:11 }}>
                Select a team to add. Fixtures against all {teams.length} existing team{teams.length!==1?'s':''} will be generated automatically.
              </Typography>
              <Stack spacing={0.75}>
                {globalTeams.map(gt => {
                  const isSelected = selectedGlobalTeam?.id === gt.id;
                  return (
                    <Box key={gt.id}
                      onClick={()=>setSelectedGlobalTeam(isSelected ? null : gt)}
                      sx={{
                        display:'flex', alignItems:'center', gap:1.5,
                        p:'10px 14px', borderRadius:1.5, cursor:'pointer',
                        border:`1px solid ${isSelected ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        bgcolor: isSelected ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.02)',
                        transition:'all 0.15s',
                        '&:hover':{ bgcolor: isSelected ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.05)', borderColor:'rgba(0,230,118,0.3)' },
                      }}>
                      <TeamBadge name={gt.name} size={30} />
                      <Typography variant="body2" sx={{ fontWeight:700, flex:1 }}>{gt.name}</Typography>
                      {isSelected && (
                        <Box sx={{ width:18, height:18, borderRadius:'50%', bgcolor:'primary.main',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Typography sx={{ fontSize:11, color:'#000', fontWeight:900, lineHeight:1 }}>✓</Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
              {teams.length >= 1 && selectedGlobalTeam && (
                <Alert severity="info" sx={{ fontSize:11 }}>
                  <strong>{selectedGlobalTeam.name}</strong> will play against all {teams.length} team{teams.length!==1?'s':''}.
                  {(tournament.legs||2) === 2 ? ' Home & away legs will be created.' : ' 1 leg per pair will be created.'}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
          <Button onClick={()=>setAddTeamOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleAddTeam} variant="contained" size="small"
            disabled={!selectedGlobalTeam||addTeamSaving}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>
            {addTeamSaving ? 'Adding…' : 'Add Team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove Team dialog ─────────────────────────────────────────── */}
      <Dialog open={removeTeamOpen} onClose={()=>{ setRemoveTeamOpen(false); setTeamToRemove(null); }}
        maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
        <DialogTitle sx={{ pb:1 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}>
            <PersonRemoveRoundedIcon sx={{ color:'error.main', fontSize:18 }} />
            <Typography variant="subtitle1" sx={{ fontWeight:700 }}>Remove Team from League</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'12px !important' }}>
          {!teamToRemove ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize:12 }}>
                Select a team to remove. All their fixtures and results will be permanently deleted, and the points table will update automatically.
              </Typography>
              <Stack spacing={1}>
                {teams.map(t => {
                  const total  = teamFixtureCount(t.id);
                  const played = teamPlayedCount(t.id);
                  return (
                    <Box key={t.id}
                      onClick={()=>setTeamToRemove(t)}
                      sx={{ display:'flex', alignItems:'center', gap:1.5, p:1.25, borderRadius:1.5, cursor:'pointer',
                        border:'1px solid rgba(255,82,82,0.15)', bgcolor:'rgba(255,82,82,0.04)',
                        '&:hover':{ bgcolor:'rgba(255,82,82,0.1)', borderColor:'rgba(255,82,82,0.4)' },
                        transition:'all 0.15s' }}>
                      <TeamBadge name={t.name} size={30} />
                      <Box sx={{ flex:1, minWidth:0 }}>
                        <Typography variant="body2" sx={{ fontWeight:700 }} noWrap>{t.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>
                          {total} fixture{total!==1?'s':''} · {played} played
                        </Typography>
                      </Box>
                      <DeleteOutlineRoundedIcon sx={{ fontSize:18, color:'error.main', flexShrink:0 }} />
                    </Box>
                  );
                })}
              </Stack>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ fontSize:12 }}>
                Remove <strong>{teamToRemove.name}</strong>? This will permanently delete{' '}
                <strong>{teamFixtureCount(teamToRemove.id)} fixture{teamFixtureCount(teamToRemove.id)!==1?'s':''}</strong>
                {teamPlayedCount(teamToRemove.id) > 0 && (
                  <> including <strong>{teamPlayedCount(teamToRemove.id)} played result{teamPlayedCount(teamToRemove.id)!==1?'s':''}</strong></>
                )}
                . The points table will update automatically.
              </Alert>
              <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:1.25, borderRadius:1.5,
                border:'1px solid rgba(255,82,82,0.3)', bgcolor:'rgba(255,82,82,0.06)' }}>
                <TeamBadge name={teamToRemove.name} size={32} />
                <Typography variant="body2" sx={{ fontWeight:700 }}>{teamToRemove.name}</Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
          <Button onClick={()=>{ setRemoveTeamOpen(false); setTeamToRemove(null); }}
            variant="outlined" color="inherit" size="small"
            sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
          {teamToRemove && (
            <Button onClick={handleRemoveTeam} variant="contained" color="error" size="small"
              disabled={removeTeamSaving}>
              {removeTeamSaving ? 'Removing…' : `Remove ${teamToRemove.name}`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Knockout Bracket View ────────────────────────────────────────────────────
function KnockoutBracket({ tournament, teams, bracket, onResult, onDelete, onAdvance, advancing, onRegenerate, generating, isAdmin }) {
  if (!bracket || bracket.length===0) {
    return (
      <Box>
        {isAdmin && (
          <Button variant="contained" size="small"
            startIcon={<AutoFixHighRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>onRegenerate(true)} disabled={generating||teams.length<2}
            sx={{ background:'linear-gradient(135deg,#651fff,#3500cb)', color:'#fff', mb:2, fontSize:{ xs:11, sm:13 } }}>
            {generating?'Drawing…':'Draw Knockout Bracket'}
          </Button>
        )}
        <EmptyState icon={<AccountTreeRoundedIcon sx={{ fontSize:48 }}/>} title="No bracket yet"
          subtitle={isAdmin ? "Tap 'Draw Knockout Bracket' to auto-generate the first round" : "Waiting for admin to draw the bracket"} />
      </Box>
    );
  }

  // Find current active round = first round that has teams but not all matches complete
  const activeRoundIndex = bracket.findIndex(r =>
    r.matches.some(m => !m.isPlaceholder) && !r.matches.every(m => m.isPlaceholder || m.winner)
  );
  const currentRoundIndex = activeRoundIndex === -1
    ? bracket.findIndex(r => r.matches.some(m => !m.isPlaceholder && m.winner)) // last completed round
    : activeRoundIndex;

  const currentRound       = bracket[currentRoundIndex] || bracket[bracket.length - 1];
  const allMatchesComplete = currentRound?.matches
    .filter(m => !m.isPlaceholder)
    .every(m => m.winner);
  const isFinal            = currentRound?.roundName === 'Final';
  const champion           = isFinal && allMatchesComplete ? currentRound.matches.find(m => m.winner)?.winner : null;

  return (
    <Box>
      {/* Action bar */}
      <Box sx={{ display:'flex', gap:1, mb:2, flexWrap:'wrap', alignItems:'center' }}>
        {champion ? (
          <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:1.5, borderRadius:2, flex:1,
            background:'linear-gradient(135deg,rgba(255,215,64,0.15),rgba(255,183,0,0.08))',
            border:'1px solid rgba(255,215,64,0.3)' }}>
            <Typography sx={{ fontSize:28 }}>🏆</Typography>
            <Box>
              <Typography variant="caption" sx={{ color:'#ffd740', fontWeight:700, fontSize:9, letterSpacing:'0.08em', display:'block' }}>CHAMPION</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight:900, color:'#ffd740', lineHeight:1.1 }}>{champion.name}</Typography>
            </Box>
          </Box>
        ) : allMatchesComplete && !isFinal ? (
          <Button variant="contained" size="small"
            startIcon={<AccountTreeRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={onAdvance} disabled={advancing}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000', fontWeight:800, fontSize:{ xs:11, sm:13 } }}>
            {advancing?'Advancing…':'Next Round →'}
          </Button>
        ) : null}
        {isAdmin && (
          <Button variant="outlined" size="small"
            startIcon={<AutoFixHighRoundedIcon sx={{ fontSize:'14px !important' }} />}
            onClick={()=>onRegenerate(true)} disabled={generating}
            sx={{ borderColor:'rgba(255,255,255,0.15)', ml:'auto', fontSize:{ xs:10, sm:12 } }}>
            Re-draw
          </Button>
        )}
      </Box>

      {/* Bracket — horizontal scroll on mobile */}
      <Box sx={{ overflowX:'auto', pb:1, mx:-1.5, px:1.5 }}>
        <Box sx={{ display:'flex', gap:{ xs:1.5, sm:2 }, alignItems:'flex-start',
          minWidth: bracket.length > 1 ? bracket.length * 230 : 'auto' }}>
          {bracket.map((round, ri) => {
            const isActive = ri === currentRoundIndex;
            const isPast   = ri < currentRoundIndex;
            return (
              <Box key={round.round} sx={{ flex:1, minWidth:{ xs:200, sm:240 } }}>
                <Box sx={{ textAlign:'center', mb:1.5, py:1, borderRadius:1.5,
                  background: isActive
                    ? 'linear-gradient(135deg,rgba(0,230,118,0.15),rgba(101,31,255,0.15))'
                    : isPast
                      ? 'rgba(0,230,118,0.05)'
                      : 'rgba(255,255,255,0.02)',
                  border:`1px solid ${isActive ? 'rgba(0,230,118,0.3)' : isPast ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                  <Typography variant="overline" sx={{ fontWeight:800, letterSpacing:'0.08em', fontSize:9,
                    color: isActive ? 'primary.main' : isPast ? 'rgba(0,230,118,0.6)' : 'text.disabled' }}>
                    {round.roundName}
                  </Typography>
                  {isPast && (
                    <Typography variant="caption" sx={{ display:'block', color:'rgba(0,230,118,0.5)', fontSize:9 }}>✓ Completed</Typography>
                  )}
                  {!isActive && !isPast && round.matches.every(m => m.isPlaceholder) && (
                    <Typography variant="caption" sx={{ display:'block', color:'text.disabled', fontSize:9 }}>Awaiting results</Typography>
                  )}
                </Box>
                <Stack spacing={1.5}>
                  {round.matches.map(match=>(
                    <KnockoutMatch key={match.matchNumber} match={match}
                      onResult={onResult} onDelete={onDelete} isCurrentRound={isActive} isAdmin={isAdmin} />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function KnockoutMatch({ match, onResult, onDelete, isCurrentRound, isAdmin }) {
  const homeName = match.homeTeam?.name;
  const awayName = match.awayTeam?.name;
  const winnerName = match.winner?.name;
  const both = match.leg1?.played && match.leg2?.played;
  const isPlaceholder = match.isPlaceholder || (!homeName && !awayName);

  if (isPlaceholder) {
    return (
      <Card sx={{ background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:2 }}>
        <CardContent sx={{ p:'14px !important' }}>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <Box sx={{ width:28, height:28, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.06)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography sx={{ fontSize:11, color:'text.disabled', fontWeight:700 }}>?</Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight:600, color:'text.disabled' }}>TBD</Typography>
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight:700 }}>vs</Typography>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <Typography variant="body2" sx={{ fontWeight:600, color:'text.disabled' }}>TBD</Typography>
              <Box sx={{ width:28, height:28, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.06)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography sx={{ fontSize:11, color:'text.disabled', fontWeight:700 }}>?</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display:'flex', flexDirection:'column', gap:0.75 }}>
            {[1,2].map(leg => (
              <Box key={leg} sx={{ display:'flex', alignItems:'center', gap:1, p:'6px 10px', borderRadius:1.5,
                background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color:'text.disabled', fontWeight:700, minWidth:36, fontSize:10 }}>LEG {leg}</Typography>
                <Chip label="TBD" size="small" sx={{ bgcolor:'rgba(255,255,255,0.04)', color:'text.disabled', fontWeight:600, fontSize:10 }} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ background:'linear-gradient(135deg,#111827,#161f30)',
      border: match.winner ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.07)',
      transition:'all 0.2s',
      '&:hover':{ boxShadow:'0 6px 24px rgba(0,0,0,0.4)', borderColor:'rgba(0,230,118,0.25)' } }}>
      <CardContent sx={{ p:'14px !important' }}>
        {/* Teams header */}
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <TeamBadge name={homeName} size={28} />
            <Typography variant="body2" sx={{ fontWeight:700 }} noWrap>{homeName}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight:700 }}>vs</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <Typography variant="body2" sx={{ fontWeight:700 }} noWrap>{awayName}</Typography>
            <TeamBadge name={awayName} size={28} />
          </Box>
        </Box>

        {/* Legs */}
        <Stack spacing={1}>
          {[match.leg1, match.leg2].filter(Boolean).map((leg, i) => (
            <Box key={i} sx={{ display:'flex', alignItems:'center', gap:1,
              p:'6px 10px', borderRadius:1.5,
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" sx={{ color:'text.secondary', fontWeight:700, minWidth:36, fontSize:10 }}>
                LEG {i+1}
              </Typography>
              <Box sx={{ flex:1 }}>
                <ScorePill home={leg.homeScore} away={leg.awayScore} played={leg.played} compact />
              </Box>
              {isCurrentRound && (
                <Box sx={{ display:'flex', gap:0.25 }}>
                  <IconButton size="small" onClick={()=>onResult(leg)}
                    sx={{ color:'primary.main', p:0.4,'&:hover':{ background:'rgba(0,230,118,0.1)' } }}>
                    <EditNoteRoundedIcon sx={{ fontSize:16 }} />
                  </IconButton>
                  {isAdmin && (
                    <IconButton size="small" onClick={()=>onDelete(leg)}
                      sx={{ color:'error.main', p:0.4,'&:hover':{ background:'rgba(255,82,82,0.1)' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize:16 }} />
                    </IconButton>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Stack>

        {/* Aggregate + winner */}
        {both && (
          <Box sx={{ mt:1.5, pt:1.5, borderTop:'1px solid rgba(255,255,255,0.06)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>Aggregate</Typography>
              <Typography variant="body2" sx={{ fontWeight:800 }}>
                {match.aggregateHome} – {match.aggregateAway}
              </Typography>
            </Box>
            {winnerName && (
              <Chip
                icon={<EmojiEventsRoundedIcon sx={{ fontSize:'14px !important', color:'#ffd740 !important' }} />}
                label={winnerName}
                size="small"
                sx={{ bgcolor:'rgba(255,215,64,0.12)', color:'#ffd740', fontWeight:800, border:'1px solid rgba(255,215,64,0.3)', fontSize:11 }}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main FixturesPage ────────────────────────────────────────────────────────
export default function FixturesPage({ tournament, isAdmin }) {
  const isKnockout = tournament.type === 'knockout';

  const [fixtures,    setFixtures]   = useState([]);
  const [bracket,     setBracket]    = useState([]);
  const [teams,       setTeams]      = useState([]);
  const [players,     setPlayers]    = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [generating,  setGenerating] = useState(false);
  const [advancing,   setAdvancing]  = useState(false);
  const [resultFix,   setResultFix]  = useState(null);
  const [deleteFix,   setDeleteFix]  = useState(null);
  const [tab,         setTab]        = useState(0);
  const [error,       setError]      = useState('');
  const [advanceMsg,  setAdvanceMsg] = useState('');

  const load = async () => {
    try {
      const [fxRes, tmRes, plRes] = await Promise.all([getFixtures(tournament.id), getTeams(tournament.id), getPlayers()]);
      setFixtures(fxRes.data);
      setTeams(tmRes.data);
      setPlayers(plRes.data);
      if (isKnockout) {
        const brRes = await getKnockoutBracket(tournament.id);
        setBracket(brRes.data);
      }
    } catch(e) { setError(e?.response?.data?.error || 'Failed to load fixtures'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tournament.id]);

  const handleGenerate = async (confirm=false) => {
    if (fixtures.length>0 && !confirm) return;
    if (fixtures.length>0) {
      const ok = window.confirm('This will replace all existing fixtures. Continue?');
      if (!ok) return;
    }
    setGenerating(true); setError('');
    try {
      await generateFixtures(tournament.id);
      await load();
    } catch(e) { setError(e?.response?.data?.error || 'Generation failed'); }
    setGenerating(false);
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

  const handleAdvance = async () => {
    setAdvancing(true); setError(''); setAdvanceMsg('');
    try {
      const res = await knockoutAdvance(tournament.id);
      if (res.data.done) {
        const champion = teams.find(t=>t.id===res.data.champion);
        setAdvanceMsg(`🏆 Tournament complete! Champion: ${champion?.name || 'Unknown'}`);
      } else {
        setAdvanceMsg(res.data.message);
      }
      await load();
    } catch(e) { setError(e?.response?.data?.error || 'Advance failed'); }
    setAdvancing(false);
  };

  const leagueFixtures   = fixtures.filter(f=>f.fixtureType==='league'||!f.fixtureType);
  const knockoutFixtures = fixtures.filter(f=>f.fixtureType==='knockout');

  const totalFixtures = isKnockout ? knockoutFixtures.length : leagueFixtures.length;
  const playedCount   = isKnockout
    ? knockoutFixtures.filter(f=>f.played).length
    : leagueFixtures.filter(f=>f.played).length;

  return (
    <Box>
      <PageHeader
        icon={isKnockout ? '🏆' : '⚽'}
        title="Fixtures"
        subtitle={`${tournament.name} · ${playedCount}/${totalFixtures} played`}
      />

      {error   && <Alert severity="error"   sx={{ mb:2, borderRadius:2 }} onClose={()=>setError('')}>{error}</Alert>}
      {advanceMsg && <Alert severity="success" sx={{ mb:2, borderRadius:2 }} onClose={()=>setAdvanceMsg('')}>{advanceMsg}</Alert>}

      {!loading && teams.length < 2 && (
        <Alert severity="warning" sx={{ mb:3, borderRadius:2 }}>
          No teams in this tournament yet — click <strong>Auto-Generate</strong> to import your global teams and create fixtures automatically.
        </Alert>
      )}

      {loading ? (
        <LoadingState variant="rows" count={4} />
      ) : isKnockout ? (
        <KnockoutBracket
          tournament={tournament} teams={teams} bracket={bracket}
          onResult={setResultFix} onDelete={setDeleteFix}
          onAdvance={handleAdvance} advancing={advancing}
          onRegenerate={handleGenerate} generating={generating}
          isAdmin={isAdmin}
        />
      ) : (
        <LeagueFixtures
          tournament={tournament} teams={teams} fixtures={leagueFixtures}
          onResult={setResultFix} onDelete={setDeleteFix}
          onRegenerate={handleGenerate} generating={generating}
          isAdmin={isAdmin} onTeamsChanged={load}
        />
      )}

      {/* Result dialog */}
      <ResultDialog
        open={!!resultFix} fixture={resultFix}
        onSave={handleResult} onClose={()=>setResultFix(null)}
        players={players}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteFix}
        title="Delete Fixture"
        message={`Delete this match between "${deleteFix?.homeTeam?.name||'?'}" and "${deleteFix?.awayTeam?.name||'?'}"?`}
        onConfirm={handleDelete}
        onCancel={()=>setDeleteFix(null)}
      />
    </Box>
  );
}
