import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Grid, Chip, Skeleton,
  IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { getTournaments, createTournament, deleteTournament } from '../api/footballApi';

export default function TournamentsPage({ onSelect }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [form, setForm]               = useState({ name:'', season:'', type:'league' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { const r = await getTournaments(); setTournaments(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createTournament(form);
    setForm({ name:'', season:'', type:'league' });
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
        <Grid container spacing={1.5}>
          {[1,2,3].map(n=>(
            <Grid item xs={12} sm={6} md={4} key={n}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius:2.5 }} />
            </Grid>
          ))}
        </Grid>
      ) : tournaments.length===0 ? (
        <EmptyState icon="🏟️" title="No tournaments yet" subtitle="Create your first tournament to get started" />
      ) : (
        <Grid container spacing={1.5}>
          {tournaments.map(t => (
            <Grid item xs={12} sm={6} md={4} key={t.id}>
              <Card sx={{ height:'100%', background:'linear-gradient(135deg,#111827,#1a2035)', transition:'all 0.2s',
                '&:hover':{ transform:'translateY(-2px)', boxShadow:'0 10px 32px rgba(0,230,118,0.12)', borderColor:'rgba(0,230,118,0.25)' } }}>
                <CardActionArea onClick={()=>onSelect(t)}>
                  <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
                    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1.5 }}>
                      <Box sx={{ width:{ xs:36, sm:40 }, height:{ xs:36, sm:40 }, borderRadius:2,
                        background:'linear-gradient(135deg,#00e676,#651fff)',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <EmojiEventsRoundedIcon sx={{ color:'#000', fontSize:{ xs:18, sm:20 } }} />
                      </Box>
                      <ArrowForwardRoundedIcon sx={{ color:'text.secondary', fontSize:18, mt:0.5 }} />
                    </Box>
                    <Typography variant="subtitle1" noWrap sx={{ fontWeight:800, mb:0.75, fontSize:{ xs:13, sm:15 } }}>
                      {t.name}
                    </Typography>
                    <Box sx={{ display:'flex', gap:0.75, flexWrap:'wrap' }}>
                      {t.season && (
                        <Chip icon={<CalendarTodayRoundedIcon sx={{ fontSize:'11px !important' }} />}
                          label={t.season} size="small"
                          sx={{ bgcolor:'rgba(255,255,255,0.07)', fontSize:10, height:20 }} />
                      )}
                      <Chip
                        icon={t.type==='knockout'
                          ? <AccountTreeRoundedIcon sx={{ fontSize:'11px !important' }} />
                          : <SportsSoccerRoundedIcon sx={{ fontSize:'11px !important' }} />}
                        label={t.type==='knockout'?'Knockout':'League'}
                        size="small"
                        sx={{ fontSize:10, height:20, fontWeight:700,
                          bgcolor: t.type==='knockout'?'rgba(101,31,255,0.15)':'rgba(0,230,118,0.12)',
                          color: t.type==='knockout'?'#a255ff':'#00e676',
                          border:`1px solid ${t.type==='knockout'?'rgba(101,31,255,0.3)':'rgba(0,230,118,0.3)'}` }} />
                    </Box>
                  </CardContent>
                </CardActionArea>
                <Box sx={{ px:1.5, pb:1.5, display:'flex', justifyContent:'flex-end' }}>
                  <IconButton size="small" onClick={e=>{ e.stopPropagation(); setDeleteTarget(t); }}
                    sx={{ color:'error.main', p:0.75, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)' } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize:18 }} />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
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
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block', fontSize:10 }}>
              {form.type==='league' ? 'Each team plays every other team twice (home & away)'
                : 'Two-legged knockout — aggregate goals decide the winner'}
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
    </Box>
  );
}
