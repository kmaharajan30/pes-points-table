import { useState, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Skeleton, IconButton, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { getTeams, createTeam, renameTeam, deleteTeam } from '../api/footballApi';

const PALETTE = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n = '') => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return PALETTE[Math.abs(h) % PALETTE.length]; };
const getInit  = (n = '') => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// generates a second complementary shade for gradient
const getDark  = (hex) => hex + '55';

function TeamCard({ team, index, onEdit, onDelete }) {
  const color = getColor(team.name);

  return (
    <Box sx={{
      position: 'relative',
      borderRadius: '18px',
      overflow: 'hidden',
      cursor: 'default',
      background: `linear-gradient(160deg, #0e1623 0%, #131d2d 100%)`,
      border: '1px solid rgba(255,255,255,0.07)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: `0 16px 40px ${color}30`,
        borderColor: color + '55',
        '& .card-actions': { opacity: 1, transform: 'translateY(0)' },
      },
    }}>

      {/* ── top colour band with mesh pattern ── */}
      <Box sx={{
        position: 'relative',
        height: 80,
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* subtle hex / dot grid */}
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${color}22 1px, transparent 1px)`,
          backgroundSize: '14px 14px',
        }} />

        {/* crest circle */}
        <Box sx={{
          position: 'relative',
          width: 56, height: 56, borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%, ${color}ee, ${color}88)`,
          border: `3px solid rgba(255,255,255,0.18)`,
          boxShadow: `0 0 0 1px ${color}55, 0 6px 20px ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, color: '#000',
          letterSpacing: '-0.5px',
        }}>
          {getInit(team.name)}
        </Box>
      </Box>

      {/* ── name section ── */}
      <Box sx={{ px: 2, pt: 1.25, pb: 1.75, textAlign: 'center' }}>
        <Typography noWrap sx={{
          fontWeight: 800, fontSize: { xs: 12, sm: 13 },
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: '0.03em',
        }}>
          {team.name}
        </Typography>
      </Box>

      {/* ── hover action strip — bottom right ── */}
      <Box className="card-actions" sx={{
        position: 'absolute', bottom: 8, right: 8,
        display: 'flex', gap: 0.5,
        opacity: 0, transform: 'translateY(6px)',
        transition: 'all 0.18s ease',
      }}>
        <IconButton size="small" onClick={() => onEdit(team)} sx={{
          p: 0.8, borderRadius: '10px',
          color: color,
          background: `${color}18`,
          border: `1px solid ${color}44`,
          backdropFilter: 'blur(8px)',
          '&:hover': { background: `${color}32` },
        }}>
          <EditRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(team)} sx={{
          p: 0.8, borderRadius: '10px',
          color: '#ff5252',
          background: 'rgba(255,82,82,0.1)',
          border: '1px solid rgba(255,82,82,0.3)',
          backdropFilter: 'blur(8px)',
          '&:hover': { background: 'rgba(255,82,82,0.22)' },
        }}>
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

    </Box>
  );
}

export default function TeamsPage({ tournament }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [teams, setTeams]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [addOpen, setAddOpen]           = useState(false);
  const [name, setName]                 = useState('');
  const [editTarget, setEditTarget]     = useState(null);
  const [editName, setEditName]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try { const r = await getTeams(tournament.id); setTeams(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [tournament.id]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await createTeam(tournament.id, { name: name.trim() });
    setName(''); setAddOpen(false); setSaving(false); load();
  };

  const openEdit = (team) => { setEditTarget(team); setEditName(team.name); };

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === editTarget.name) { setEditTarget(null); return; }
    setSaving(true);
    await renameTeam(tournament.id, editTarget.id, { name: editName.trim() });
    setEditTarget(null); setSaving(false); load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTeam(tournament.id, deleteTarget.id);
    setDeleteTarget(null); load();
  };

  return (
    <Box>
      <PageHeader icon="👥" title="Teams"
        subtitle={`${tournament.name} · ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
        action={
          <Button variant="contained" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize: '16px !important' }} />}
            onClick={() => setAddOpen(true)}
            sx={{
              background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000',
              fontSize: { xs: 11, sm: 13 }, px: { xs: 1.5, sm: 2 }, minWidth: 0,
            }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Add&nbsp;</Box>Team
          </Button>
        }
      />

      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
          {[1,2,3,4,5,6].map(n => (
            <Skeleton key={n} variant="rectangular" height={148} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : teams.length === 0 ? (
        <EmptyState icon={<GroupsRoundedIcon sx={{ fontSize: 48 }} />}
          title="No teams yet" subtitle="Add teams before creating fixtures" />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
          {teams.map((team, idx) => (
            <TeamCard key={team.id} team={team} index={idx} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </Box>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
        <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: { xs: 15, sm: 17 } }}>Add Team</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField label="Team Name" fullWidth autoFocus size="small"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setAddOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" size="small" disabled={!name.trim() || saving}
            sx={{ background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000', fontWeight: 800 }}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
        <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: { xs: 15, sm: 17 } }}>Rename Team</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField label="Team Name" fullWidth autoFocus size="small"
            value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEditTarget(null)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleRename} variant="contained" size="small"
            disabled={!editName.trim() || editName.trim() === editTarget?.name || saving}
            sx={{ background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000', fontWeight: 800 }}>Save</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Remove Team"
        message={`Remove "${deleteTarget?.name}"? Fixtures involving this team will also be deleted.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
}
