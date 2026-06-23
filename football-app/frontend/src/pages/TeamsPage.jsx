import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Typography,
  Avatar, Skeleton, IconButton, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { getTeams, createTeam, deleteTeam } from '../api/footballApi';

const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

export default function TeamsPage({ tournament }) {
  const theme   = useTheme();
  const isMobile= useMediaQuery(theme.breakpoints.down('sm'));

  const [teams, setTeams]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { const r = await getTeams(tournament.id); setTeams(r.data); } catch {}
    setLoading(false);
  };
  useEffect(()=>{ load(); },[tournament.id]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createTeam(tournament.id, { name:name.trim() });
    setName(''); setOpen(false); load();
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTeam(tournament.id, deleteTarget.id);
    setDeleteTarget(null); load();
  };

  return (
    <Box>
      <PageHeader icon="👥" title="Teams"
        subtitle={`${tournament.name} · ${teams.length} team${teams.length!==1?'s':''}`}
        action={
          <Button variant="contained" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize:'16px !important' }} />}
            onClick={()=>setOpen(true)}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000',
              fontSize:{ xs:11, sm:13 }, px:{ xs:1.5, sm:2 }, minWidth:0 }}>
            <Box component="span" sx={{ display:{ xs:'none', sm:'inline' } }}>Add&nbsp;</Box>Team
          </Button>
        }
      />

      {loading ? (
        <Grid container spacing={1.25}>
          {[1,2,3,4].map(n=>(
            <Grid item xs={6} sm={4} md={3} key={n}>
              <Skeleton variant="rectangular" height={72} sx={{ borderRadius:2 }} />
            </Grid>
          ))}
        </Grid>
      ) : teams.length===0 ? (
        <EmptyState icon={<GroupsRoundedIcon sx={{ fontSize:48 }} />}
          title="No teams yet" subtitle="Add teams before creating fixtures" />
      ) : (
        <Grid container spacing={1.25}>
          {teams.map(team => {
            const color = getColor(team.name);
            return (
              <Grid item xs={6} sm={4} md={3} key={team.id}>
                <Card sx={{ background:'linear-gradient(135deg,#111827,#1a2035)', transition:'all 0.2s',
                  '&:hover':{ transform:'translateY(-2px)', boxShadow:`0 6px 24px ${color}20`, borderColor:`${color}40` } }}>
                  <CardContent sx={{ display:'flex', alignItems:'center', gap:1.25, p:'12px !important' }}>
                    <Avatar sx={{ bgcolor:color, color:'#000', fontWeight:800, fontSize:12,
                      width:{ xs:34, sm:38 }, height:{ xs:34, sm:38 }, flexShrink:0 }}>
                      {getInit(team.name)}
                    </Avatar>
                    <Typography variant="caption" noWrap sx={{ fontWeight:700, flex:1, fontSize:{ xs:11, sm:12 } }}>
                      {team.name}
                    </Typography>
                    <IconButton size="small" onClick={()=>setDeleteTarget(team)}
                      sx={{ color:'error.main', flexShrink:0, p:0.5, '&:hover':{ bgcolor:'rgba(255,82,82,0.1)' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize:16 }} />
                    </IconButton>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx:{ borderRadius:{ xs:0, sm:3 } } }}>
        <DialogTitle sx={{ fontSize:{ xs:15, sm:17 } }}>Add Team</DialogTitle>
        <DialogContent sx={{ pt:'12px !important' }}>
          <TextField label="Team Name" fullWidth autoFocus size="small"
            value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleCreate()} />
        </DialogContent>
        <DialogActions sx={{ px:2.5, pb:2.5, gap:1 }}>
          <Button onClick={()=>setOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor:'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" size="small" disabled={!name.trim()}
            sx={{ background:'linear-gradient(135deg,#00e676,#00b248)', color:'#000' }}>Add</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Remove Team"
        message={`Remove "${deleteTarget?.name}"? Fixtures involving this team will also be deleted.`}
        onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
    </Box>
  );
}
