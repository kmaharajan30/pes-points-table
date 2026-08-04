import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  useMediaQuery, Checkbox, FormControlLabel, Chip, Skeleton
} from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import { getTournaments, createTournament, deleteTournament, getGlobalTeams, getSeasonSummary } from '../api/footballApi';

const goldShimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const crownBounce = keyframes`
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.1); }
`;

const starTwinkle = keyframes`
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
`;

export default function TournamentsPage({ onSelect, isAdmin }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [form, setForm]               = useState({ name:'', season:'', type:'league', num_groups: 2, legs: 2 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [globalTeams, setGlobalTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  const load = async () => {
    try { const r = await getTournaments(); setTournaments(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const loadGlobalTeams = async () => {
    try { const r = await getGlobalTeams(); setGlobalTeams(r.data); } catch {}
  };

  const handleOpenCreate = () => {
    loadGlobalTeams();
    setSelectedTeamIds([]);
    setOpen(true);
  };

  const toggleTeam = (id) => {
    setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedTeamIds.length === globalTeams.length) {
      setSelectedTeamIds([]);
    } else {
      setSelectedTeamIds(globalTeams.map(t => t.id));
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createTournament({ ...form, teamIds: selectedTeamIds });
    setForm({ name:'', season:'', type:'league', num_groups: 2, legs: 2 });
    setSelectedTeamIds([]);
    setOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTournament(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const handleOpenSummary = async (t) => {
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await getSeasonSummary(t.id);
      setSummaryData(res.data);
    } catch (e) { console.error(e); }
    setSummaryLoading(false);
  };

  return (
    <Box>
      <PageHeader icon="🏆" title="Tournaments" subtitle="Your football tournaments"
        action={
          <Button variant="contained" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>handleOpenCreate()}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000',
              fontSize:{ xs:11, sm:13 }, px:{ xs:1.5, sm:2 }, py:{ xs:0.6, sm:0.75 }, minWidth:0 }}>
            <Box component="span" sx={{ display:{ xs:'none', sm:'inline' } }}>New&nbsp;</Box>Tournament
          </Button>
        }
      />

      {loading ? (
        <LoadingState variant="cards" count={6} />
      ) : tournaments.length===0 ? (
        <EmptyState icon="🏟️" title="No tournaments yet" subtitle="Create your first tournament to get started" />
      ) : (
        <Box sx={{ display:'flex', flexDirection:'column', gap:{ xs:1.5, sm:2 } }}>
          {tournaments.map(t => {
            const typeColor = t.type==='knockout'?'#a255ff':t.type==='group_knockout'?'#ff9800':'#00e676';
            const typeBg = t.type==='knockout'?'rgba(101,31,255,0.12)':t.type==='group_knockout'?'rgba(255,152,0,0.12)':'rgba(0,230,118,0.08)';
            const typeLabel = t.type==='knockout'?'Knockout':t.type==='group_knockout'?`Group+KO (${t.numGroups||2}G)`:'League';
            const TypeIcon = t.type==='knockout'?AccountTreeRoundedIcon:t.type==='group_knockout'?GroupsRoundedIcon:SportsSoccerRoundedIcon;
            return (
              <Card key={t.id} sx={{
                background:'linear-gradient(135deg,#111827 0%,#1a2035 100%)',
                borderLeft:`3px solid ${typeColor}`,
                transition:'all 0.2s ease',
                '&:hover':{ transform:{ xs:'none', sm:'translateY(-2px)' }, boxShadow:`0 8px 24px ${typeBg}`, borderColor:`rgba(255,255,255,0.1)` }
              }}>
                <CardActionArea onClick={()=>onSelect(t)}>
                  <CardContent sx={{ p:{ xs:1.5, sm:2.5 }, '&:last-child':{ pb:{ xs:1.5, sm:2.5 } } }}>
                    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      {/* Left: Icon + Info */}
                      <Box sx={{ display:'flex', alignItems:'center', gap:{ xs:1.25, sm:1.5 }, minWidth:0 }}>
                        <Box sx={{
                          width:{ xs:40, sm:44 }, height:{ xs:40, sm:44 }, borderRadius:2,
                          background:`linear-gradient(135deg, ${typeColor}22, ${typeColor}44)`,
                          border:`1px solid ${typeColor}33`,
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                        }}>
                          <EmojiEventsRoundedIcon sx={{ color:typeColor, fontSize:{ xs:20, sm:22 } }} />
                        </Box>
                        <Box sx={{ minWidth:0 }}>
                          <Typography noWrap sx={{ fontWeight:700, fontSize:{ xs:13, sm:15 }, color:'#fff' }}>
                            {t.name}
                          </Typography>
                          <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mt:0.25 }}>
                            <TypeIcon sx={{ fontSize:11, color:typeColor }} />
                            <Typography sx={{ fontSize:{ xs:10, sm:11 }, color:typeColor, fontWeight:600 }}>
                              {typeLabel}
                            </Typography>
                            {t.season && (
                              <>
                                <Box sx={{ width:2.5, height:2.5, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.25)' }} />
                                <Typography sx={{ fontSize:{ xs:10, sm:11 }, color:'text.secondary' }}>{t.season}</Typography>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Center: Winner Trophy */}
                      {t.winner && (
                        <Box sx={{ display:'flex', alignItems:'center', gap:{ xs:0.75, sm:1 },
                          px:{ xs:1.25, sm:2 }, py:{ xs:0.5, sm:0.6 },
                          borderRadius:10,
                          background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
                          border:'1px solid rgba(255,215,0,0.3)',
                          boxShadow:'0 2px 12px rgba(255,215,0,0.15), inset 0 1px 0 rgba(255,215,0,0.1)',
                          position:'relative', overflow:'hidden' }}>
                          {/* Animated gold shimmer streak */}
                          <Box sx={{ position:'absolute', inset:0,
                            background:'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.12) 20%, rgba(255,255,255,0.08) 50%, rgba(255,215,0,0.12) 80%, transparent 100%)',
                            backgroundSize:'200% 100%',
                            animation:`${goldShimmer} 2.5s ease-in-out infinite` }} />
                          {/* Star accents */}
                          <Box sx={{ position:'absolute', top:3, left:12, fontSize:7, color:'rgba(255,215,0,0.6)',
                            animation:`${starTwinkle} 2s ease-in-out infinite` }}>✦</Box>
                          <Box sx={{ position:'absolute', bottom:3, right:14, fontSize:6, color:'rgba(255,215,0,0.5)',
                            animation:`${starTwinkle} 2.5s ease-in-out infinite`, animationDelay:'0.8s' }}>✦</Box>
                          {/* Crown + Trophy */}
                          <Box sx={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center' }}>
                            <Typography sx={{ fontSize:{ xs:6, sm:7 }, lineHeight:1, mb:'-2px',
                              animation:`${crownBounce} 2s ease-in-out infinite`, color:'#ffd700' }}>👑</Typography>
                            <Typography sx={{ fontSize:{ xs:14, sm:17 }, lineHeight:1, position:'relative',
                              filter:'drop-shadow(0 2px 4px rgba(255,215,0,0.4))' }}>🏆</Typography>
                          </Box>
                          {/* Winner name */}
                          <Typography sx={{ fontSize:{ xs:11, sm:13 }, fontWeight:900, letterSpacing:0.5,
                            background:'linear-gradient(180deg, #fff8dc 0%, #ffd700 40%, #daa520 100%)',
                            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                            backgroundClip:'text', position:'relative',
                            textTransform:'uppercase' }}>
                            {t.winner}
                          </Typography>
                        </Box>
                      )}

                      {/* Right: Actions */}
                      <Box sx={{ display:'flex', alignItems:'center', gap:0.5, flexShrink:0 }}>
                        <Tooltip title="Tournament Summary">
                          <IconButton size="small" onClick={e=>{ e.stopPropagation(); handleOpenSummary(t); }}
                            sx={{ color:'rgba(255,255,255,0.4)', p:0.5,
                              '&:hover':{ bgcolor:'rgba(0,230,118,0.1)', color:'#00e676' } }}>
                            <AutoAwesomeRoundedIcon sx={{ fontSize:{ xs:17, sm:19 } }} />
                          </IconButton>
                        </Tooltip>
                        {isAdmin && (
                          <IconButton size="small" onClick={e=>{ e.stopPropagation(); setDeleteTarget(t); }}
                            sx={{ color:'rgba(255,82,82,0.6)', p:0.5, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)', color:'#ff5252' } }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize:{ xs:17, sm:19 } }} />
                          </IconButton>
                        )}
                        <ArrowForwardRoundedIcon sx={{ color:'rgba(255,255,255,0.25)', fontSize:{ xs:17, sm:19 } }} />
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Create dialog */}
      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
        <DialogTitle sx={{ pb:1, fontSize:{ xs:15, sm:18 } }}>Create Tournament</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'12px !important' }}>
          <TextField label="Tournament Name" fullWidth size="small" autoFocus
            value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
            onKeyDown={e=>e.key==='Enter'&&handleCreate()} />
          <TextField label="Season (optional)" fullWidth size="small" placeholder="e.g. 2025-26"
            value={form.season} onChange={e=>setForm({...form,season:e.target.value})} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb:0.75, display:'block', fontWeight:600 }}>
              Tournament Type
            </Typography>
            <ToggleButtonGroup value={form.type} exclusive fullWidth size="small"
              onChange={(_,v)=>v&&setForm({...form,type:v})}>
              <ToggleButton value="league" sx={{ gap:0.75, fontWeight:700, fontSize:12,
                '&.Mui-selected':{ bgcolor:'rgba(0,230,118,0.15)', color:'#00e676', borderColor:'rgba(0,230,118,0.4)' } }}>
                <SportsSoccerRoundedIcon sx={{ fontSize:16 }} /> League
              </ToggleButton>
              <ToggleButton value="knockout" sx={{ gap:0.75, fontWeight:700, fontSize:12,
                '&.Mui-selected':{ bgcolor:'rgba(101,31,255,0.15)', color:'#a255ff', borderColor:'rgba(101,31,255,0.4)' } }}>
                <AccountTreeRoundedIcon sx={{ fontSize:16 }} /> Knockout
              </ToggleButton>
              <ToggleButton value="group_knockout" sx={{ gap:0.75, fontWeight:700, fontSize:11,
                '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                <GroupsRoundedIcon sx={{ fontSize:16 }} /> Group+KO
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
              {form.type==='league' ? 'Each team plays every other team twice (home & away)'
                : form.type==='knockout' ? 'Two-legged knockout — aggregate goals decide the winner'
                : form.num_groups >= 4
                  ? 'Group stage (1 leg) → Top 2 per group → Quarter-finals (2 legs) → Semi-finals (2 legs) → Final'
                  : 'Group stage league → Top 2 per group → Semi-finals (2 legs) + Final (1 match)'}
            </Typography>
            {form.type === 'league' && (
              <Box sx={{ mt:1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb:0.75, display:'block', fontWeight:600 }}>
                  Legs
                </Typography>
                <ToggleButtonGroup value={form.legs} exclusive fullWidth size="small"
                  onChange={(_,v)=>v&&setForm({...form,legs:v})}>
                  <ToggleButton value={1} sx={{ fontWeight:700, fontSize:12,
                    '&.Mui-selected':{ bgcolor:'rgba(0,230,118,0.15)', color:'#00e676', borderColor:'rgba(0,230,118,0.4)' } }}>
                    1 Leg
                  </ToggleButton>
                  <ToggleButton value={2} sx={{ fontWeight:700, fontSize:12,
                    '&.Mui-selected':{ bgcolor:'rgba(0,230,118,0.15)', color:'#00e676', borderColor:'rgba(0,230,118,0.4)' } }}>
                    2 Legs (Home &amp; Away)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            {form.type==='group_knockout' && (
              <Box sx={{ mt:1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb:0.75, display:'block', fontWeight:600 }}>
                  Number of Groups
                </Typography>
                <ToggleButtonGroup value={form.num_groups} exclusive fullWidth size="small"
                  onChange={(_,v)=>v&&setForm({...form, num_groups:v, ...(v >= 4 ? { legs: 1 } : {})})}>
                  {[2,4].map(n=>(
                    <ToggleButton key={n} value={n} sx={{ fontWeight:700, fontSize:12,
                      '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                      {n} Groups
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
                  {form.num_groups >= 4
                    ? `4 groups · top 2 qualify → QF → SF → Final (need ≥ ${form.num_groups * 2} teams)`
                    : `Teams will be distributed evenly across ${form.num_groups} groups (need ≥ ${form.num_groups * 2} teams)`}
                </Typography>
              </Box>
            )}
            {form.type==='group_knockout' && (
              <Box sx={{ mt:1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb:0.75, display:'block', fontWeight:600 }}>
                  Group Stage Legs
                </Typography>
                <ToggleButtonGroup value={form.legs} exclusive fullWidth size="small"
                  onChange={(_,v)=>v&&setForm({...form,legs:v})}>
                  <ToggleButton value={1} sx={{ fontWeight:700, fontSize:12,
                    '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                    1 Leg
                  </ToggleButton>
                  <ToggleButton value={2} disabled={form.num_groups >= 4} sx={{ fontWeight:700, fontSize:12,
                    '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                    2 Legs (Home &amp; Away)
                  </ToggleButton>
                </ToggleButtonGroup>
                {form.num_groups >= 4 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
                    4-group format uses 1 leg in the group stage
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Team Selection */}
          <Box>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight:600 }}>
                Select Teams {selectedTeamIds.length > 0 && `(${selectedTeamIds.length})`}
              </Typography>
              {globalTeams.length > 0 && (
                <Button size="small" onClick={toggleAll}
                  sx={{ fontSize:10, minWidth:0, px:1, py:0.25, textTransform:'none', color:'primary.main' }}>
                  {selectedTeamIds.length === globalTeams.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </Box>
            {globalTeams.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize:11 }}>
                No global teams available. Add teams from the Teams tab first.
              </Typography>
            ) : (
              <Box sx={{
                maxHeight: 200, overflowY: 'auto', borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)',
                p: 1,
              }}>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.75 }}>
                  {globalTeams.map(team => {
                    const selected = selectedTeamIds.includes(team.id);
                    return (
                      <Chip
                        key={team.id}
                        label={team.name}
                        size="small"
                        onClick={() => toggleTeam(team.id)}
                        icon={selected
                          ? <CheckBoxRoundedIcon sx={{ fontSize:'16px !important' }} />
                          : <CheckBoxOutlineBlankRoundedIcon sx={{ fontSize:'16px !important' }} />
                        }
                        sx={{
                          fontWeight: 600, fontSize: 11,
                          borderColor: selected ? 'primary.main' : 'rgba(255,255,255,0.15)',
                          bgcolor: selected ? 'rgba(0,230,118,0.12)' : 'transparent',
                          color: selected ? '#00e676' : 'rgba(255,255,255,0.7)',
                          border: '1px solid',
                          '&:hover': { bgcolor: selected ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.06)' },
                          '& .MuiChip-icon': { color: selected ? '#00e676' : 'rgba(255,255,255,0.4)' },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
              Selected teams will be added to the tournament automatically. You can still add more later.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
          <Button onClick={()=>setOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" size="small" disabled={!form.name.trim()}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>Create</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Delete Tournament"
        message={`Delete "${deleteTarget?.name}"? All teams, fixtures and results will be removed.`}
        onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />

      {/* Summary Dialog */}
      <Dialog open={summaryOpen} onClose={()=>setSummaryOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 }, bgcolor:'#0d1220' } }}>
        <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', pb:1 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <MilitaryTechRoundedIcon sx={{ color:'#ffd700', fontSize:22 }} />
            <Typography sx={{ fontWeight:800, fontSize:{ xs:14, sm:16 } }}>
              {summaryData?.tournament?.name || 'Tournament Summary'}
              {summaryData?.tournament?.season ? ` · ${summaryData.tournament.season}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={()=>setSummaryOpen(false)} sx={{ color:'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize:20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb:3 }}>
          {summaryLoading ? (
            <Box sx={{ display:'flex', flexDirection:'column', gap:2, py:2 }}>
              <Skeleton variant="rounded" height={100} sx={{ bgcolor:'rgba(255,255,255,0.05)', borderRadius:2 }} />
              <Skeleton variant="rounded" height={60} sx={{ bgcolor:'rgba(255,255,255,0.05)', borderRadius:2 }} />
              <Skeleton variant="rounded" height={60} sx={{ bgcolor:'rgba(255,255,255,0.05)', borderRadius:2 }} />
            </Box>
          ) : summaryData?.summary ? (
            <SummaryContent summary={summaryData.summary} />
          ) : (
            <Box sx={{ textAlign:'center', py:4 }}>
              <Typography sx={{ fontSize:36, mb:1 }}>📊</Typography>
              <Typography color="text.secondary" sx={{ fontSize:13 }}>No matches played yet</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ── Summary Content Component ─────────────────────────────────────────────────
function SummaryContent({ summary }) {
  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2.5 }}>
      {/* Champion */}
      {summary.champion && (
        <Box sx={{
          p:2.5, borderRadius:3, textAlign:'center',
          background:'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,160,0,0.04) 100%)',
          border:'1px solid rgba(255,215,0,0.2)',
        }}>
          <Typography sx={{ fontSize:32, mb:0.5 }}>🏆</Typography>
          <Typography sx={{ fontWeight:900, fontSize:18, color:'#ffd700', mb:0.25 }}>
            {summary.champion}
          </Typography>
          <Typography sx={{ fontSize:11, color:'text.secondary', fontWeight:600 }}>Champion</Typography>
          {summary.runnerUp && (
            <Typography sx={{ fontSize:11, color:'text.secondary', mt:0.5 }}>
              Runner-up: <strong style={{ color:'#c0c0c0' }}>{summary.runnerUp}</strong>
            </Typography>
          )}
        </Box>
      )}

      {/* Stats Grid */}
      <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr 1fr', sm:'1fr 1fr 1fr' }, gap:1.5 }}>
        {summary.bestAttack && (
          <SummaryStatCard icon={<SportsSoccerRoundedIcon sx={{ fontSize:18, color:'#00e676' }} />}
            label="Best Attack" value={summary.bestAttack.team}
            detail={`${summary.bestAttack.goals} goals`} color="#00e676" />
        )}
        {summary.bestDefense && (
          <SummaryStatCard icon={<ShieldRoundedIcon sx={{ fontSize:18, color:'#40c4ff' }} />}
            label="Best Defense" value={summary.bestDefense.team}
            detail={`${summary.bestDefense.ratio} per match (${summary.bestDefense.conceded} in ${summary.bestDefense.matches})`} color="#40c4ff" />
        )}
        <SummaryStatCard icon={<SportsSoccerRoundedIcon sx={{ fontSize:18, color:'#ff6e40' }} />}
          label="Total Goals" value={summary.totalGoals}
          detail={`${summary.avgGoalsPerMatch} per match`} color="#ff6e40" />
        <SummaryStatCard icon={<LeaderboardRoundedIcon sx={{ fontSize:18, color:'#a255ff' }} />}
          label="Matches" value={summary.totalMatches}
          detail={`${summary.teamsCount} teams`} color="#a255ff" />
      </Box>

      {/* Most Entertaining Match */}
      {summary.mostEntertainingMatch && (
        <Box sx={{
          p:2, borderRadius:2.5,
          background:'linear-gradient(135deg, rgba(255,82,82,0.06) 0%, rgba(101,31,255,0.06) 100%)',
          border:'1px solid rgba(255,82,82,0.15)',
        }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mb:1.5 }}>
            <WhatshotRoundedIcon sx={{ fontSize:16, color:'#ff5252' }} />
            <Typography sx={{ fontWeight:700, fontSize:12, color:'#ff5252' }}>Most Entertaining Match</Typography>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
            <Typography sx={{ fontWeight:700, fontSize:{ xs:12, sm:14 }, textAlign:'right', flex:1 }} noWrap>
              {summary.mostEntertainingMatch.homeTeam}
            </Typography>
            <Box sx={{
              px:1.5, py:0.5, borderRadius:1.5,
              bgcolor:'rgba(0,230,118,0.1)', border:'1px solid rgba(0,230,118,0.2)',
            }}>
              <Typography sx={{ fontWeight:900, fontSize:16, color:'#00e676' }}>
                {summary.mostEntertainingMatch.homeScore} - {summary.mostEntertainingMatch.awayScore}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight:700, fontSize:{ xs:12, sm:14 }, textAlign:'left', flex:1 }} noWrap>
              {summary.mostEntertainingMatch.awayTeam}
            </Typography>
          </Box>
          <Typography sx={{ textAlign:'center', fontSize:10, color:'text.secondary', mt:0.75 }}>
            {summary.mostEntertainingMatch.totalGoals} goals
          </Typography>
        </Box>
      )}

      {/* Biggest Win */}
      {summary.biggestWin && summary.biggestWin.margin > 0 && (
        <Box sx={{
          p:2, borderRadius:2.5,
          background:'rgba(255,255,255,0.02)',
          border:'1px solid rgba(255,255,255,0.07)',
        }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mb:1 }}>
            <MilitaryTechRoundedIcon sx={{ fontSize:16, color:'#ffd740' }} />
            <Typography sx={{ fontWeight:700, fontSize:12, color:'#ffd740' }}>Biggest Win</Typography>
          </Box>
          <Typography sx={{ fontSize:13, fontWeight:600, textAlign:'center' }}>
            {summary.biggestWin.homeTeam} {summary.biggestWin.homeScore} - {summary.biggestWin.awayScore} {summary.biggestWin.awayTeam}
          </Typography>
          <Typography sx={{ textAlign:'center', fontSize:10, color:'text.secondary', mt:0.5 }}>
            {summary.biggestWin.winner} won by {summary.biggestWin.margin} goal{summary.biggestWin.margin > 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function SummaryStatCard({ icon, label, value, detail, color }) {
  return (
    <Box sx={{
      p:1.5, borderRadius:2,
      background:`${color}0D`,
      border:`1px solid ${color}22`,
    }}>
      {icon}
      <Typography sx={{ fontSize:10, color:'text.secondary', fontWeight:600, mt:0.5 }}>{label}</Typography>
      <Typography sx={{ fontWeight:800, fontSize:13, mt:0.25 }} noWrap>{value}</Typography>
      <Typography sx={{ fontSize:10, color:'text.secondary' }}>{detail}</Typography>
    </Box>
  );
}
