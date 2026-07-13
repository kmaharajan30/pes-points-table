import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  useMediaQuery
} from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import { getTournaments, createTournament, deleteTournament } from '../api/footballApi';

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

export default function TournamentsPage({ onSelect }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [form, setForm]               = useState({ name:'', season:'', type:'league', num_groups: 2, legs: 2 });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { const r = await getTournaments(); setTournaments(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createTournament(form);
    setForm({ name:'', season:'', type:'league', num_groups: 2, legs: 2 });
    setOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTournament(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  return (
    <Box>
      <PageHeader icon="🏆" title="Tournaments" subtitle="Your football tournaments"
        action={
          <Button variant="contained" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>setOpen(true)}
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
                        <IconButton size="small" onClick={e=>{ e.stopPropagation(); setDeleteTarget(t); }}
                          sx={{ color:'rgba(255,82,82,0.6)', p:0.5, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)', color:'#ff5252' } }}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize:{ xs:17, sm:19 } }} />
                        </IconButton>
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
                  onChange={(_,v)=>v&&setForm({...form,num_groups:v})}>
                  {[2,3,4].map(n=>(
                    <ToggleButton key={n} value={n} disabled={n > 2} sx={{ fontWeight:700, fontSize:12,
                      '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                      {n} Groups{n > 2 ? ' (soon)' : ''}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
                  Teams will be distributed evenly across {form.num_groups} groups (need ≥ {form.num_groups * 2} teams)
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
                  <ToggleButton value={2} sx={{ fontWeight:700, fontSize:12,
                    '&.Mui-selected':{ bgcolor:'rgba(255,152,0,0.15)', color:'#ff9800', borderColor:'rgba(255,152,0,0.4)' } }}>
                    2 Legs (Home &amp; Away)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
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
    </Box>
  );
}
