import { useState, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, IconButton, useMediaQuery, Avatar, Chip, Stack, Card
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import { getGlobalTeams, createGlobalTeam, renameGlobalTeam, deleteGlobalTeam, getTeamProfile } from '../api/footballApi';

const PALETTE = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n = '') => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return PALETTE[Math.abs(h) % PALETTE.length]; };
const getInit  = (n = '') => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

function StatCard({ label, value, color = 'primary.main', icon }) {
  return (
    <Card sx={{ p: 1.5, flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        {icon}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', color }}>{value}</Typography>
    </Card>
  );
}

function TeamCard({ team, onEdit, onDelete, onClick, isAdmin }) {
  const color = getColor(team.name);
  return (
    <Box onClick={() => onClick(team)} sx={{
      position: 'relative', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer',
      background: 'linear-gradient(160deg, #0e1623 0%, #131d2d 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      '&:hover': { transform: 'translateY(-5px)', boxShadow: `0 16px 40px ${color}30`, borderColor: color + '55',
        '& .card-actions': { opacity: 1, transform: 'translateY(0)' } },
    }}>
      <Box sx={{ position: 'relative', height: 80,
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${color}22 1px, transparent 1px)`, backgroundSize: '14px 14px' }} />
        <Box sx={{ position: 'relative', width: 56, height: 56, borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%, ${color}ee, ${color}88)`,
          border: '3px solid rgba(255,255,255,0.18)',
          boxShadow: `0 0 0 1px ${color}55, 0 6px 20px ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, color: '#000', letterSpacing: '-0.5px' }}>
          {getInit(team.name)}
        </Box>
      </Box>
      <Box sx={{ px: 2, pt: 1.25, pb: 1.75, textAlign: 'center' }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: { xs: 12, sm: 13 }, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.03em' }}>
          {team.name}
        </Typography>
      </Box>
      <Box className="card-actions" sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 0.5,
        opacity: 0, transform: 'translateY(6px)', transition: 'all 0.18s ease' }}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(team); }} sx={{
          p: 0.8, borderRadius: '10px', color: color, background: `${color}18`,
          border: `1px solid ${color}44`, backdropFilter: 'blur(8px)', '&:hover': { background: `${color}32` } }}>
          <EditRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {isAdmin && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(team); }} sx={{
            p: 0.8, borderRadius: '10px', color: '#ff5252', background: 'rgba(255,82,82,0.1)',
            border: '1px solid rgba(255,82,82,0.3)', backdropFilter: 'blur(8px)', '&:hover': { background: 'rgba(255,82,82,0.22)' } }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

export default function GlobalTeamsPage({ isAdmin }) {
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
  const [profileOpen, setProfileOpen]   = useState(false);
  const [profile, setProfile]           = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const load = async () => {
    try { const r = await getGlobalTeams(); setTeams(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await createGlobalTeam({ name: name.trim() });
    setName(''); setAddOpen(false); setSaving(false); load();
  };

  const openEdit = (team) => { setEditTarget(team); setEditName(team.name); };

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === editTarget.name) { setEditTarget(null); return; }
    setSaving(true);
    await renameGlobalTeam(editTarget.id, { name: editName.trim() });
    setEditTarget(null); setSaving(false); load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteGlobalTeam(deleteTarget.id);
    setDeleteTarget(null); load();
  };

  const handleTeamClick = async (team) => {
    setProfileOpen(true);
    setProfileLoading(true);
    setProfile(null);
    try {
      const res = await getTeamProfile(team.name);
      setProfile(res.data);
    } catch (e) { console.error(e); }
    setProfileLoading(false);
  };

  return (
    <Box>
      <PageHeader icon="👥" title="Teams"
        subtitle={`All teams · ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
        action={
          <Button variant="contained" size="small"
            startIcon={<AddRoundedIcon sx={{ fontSize: '16px !important' }} />}
            onClick={() => setAddOpen(true)}
            sx={{ background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000',
              fontSize: { xs: 11, sm: 13 }, px: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Add&nbsp;</Box>Team
          </Button>
        }
      />

      {loading ? (
        <LoadingState variant="cards" count={6} />
      ) : teams.length === 0 ? (
        <EmptyState icon={<GroupsRoundedIcon sx={{ fontSize: 48 }} />}
          title="No teams yet" subtitle="Add teams here and select them when creating tournaments" />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onEdit={openEdit} onDelete={setDeleteTarget} onClick={handleTeamClick} isAdmin={isAdmin} />
          ))}
        </Box>
      )}

      {/* Team Profile Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, bgcolor: '#0d1220', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 15, sm: 17 } }}>
            {profile?.team?.name || 'Team'} Profile
          </Typography>
          <IconButton size="small" onClick={() => setProfileOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {profileLoading && <LoadingState />}
          {profile && !profileLoading && (
            <Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 2 }}>
                <StatCard label="Matches" value={profile.stats.totalMatches} icon={<SportsSoccerRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />} />
                <StatCard label="Wins" value={profile.stats.wins} color="#00e676" icon={<TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#00e676' }} />} />
                <StatCard label="Goals Scored" value={profile.stats.goalsScored} color="#40c4ff" icon={<SportsSoccerRoundedIcon sx={{ fontSize: 14, color: '#40c4ff' }} />} />
                <StatCard label="Win Rate" value={`${profile.stats.winRate}%`} color="#ffd740" icon={<EmojiEventsRoundedIcon sx={{ fontSize: 14, color: '#ffd740' }} />} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 2 }}>
                <StatCard label="Draws" value={profile.stats.draws} color="text.secondary" icon={<Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: 'text.secondary' }} />} />
                <StatCard label="Losses" value={profile.stats.losses} color="#ff5252" icon={<Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#ff5252' }} />} />
                <StatCard label="Goals Conceded" value={profile.stats.goalsConceded} color="#ff6e40" icon={<SportsSoccerRoundedIcon sx={{ fontSize: 14, color: '#ff6e40' }} />} />
                <StatCard label="Goal Diff" value={profile.stats.goalDifference > 0 ? `+${profile.stats.goalDifference}` : profile.stats.goalDifference} color={profile.stats.goalDifference >= 0 ? '#00e676' : '#ff5252'} icon={<TrendingUpRoundedIcon sx={{ fontSize: 14, color: profile.stats.goalDifference >= 0 ? '#00e676' : '#ff5252' }} />} />
              </Box>

              {/* Trophies Cabinet */}
              {profile.trophies.length > 0 && (
                <Card sx={{ p: 1.5, mb: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11 }}>
                    🏆 Trophies
                    <Box component="span" sx={{
                      fontSize: 9, fontWeight: 800, px: 0.75, py: 0.2, borderRadius: 1,
                      bgcolor: 'rgba(255,215,0,0.15)', color: '#ffd700', ml: 0.25
                    }}>
                      {profile.trophies.length}
                    </Box>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {profile.trophies.map((t, i) => (
                      <Box key={i} sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        px: 1, py: 0.5, borderRadius: 1.5,
                        bgcolor: t.type === 'gold' ? 'rgba(255,215,0,0.08)' : 'rgba(192,192,192,0.08)',
                        border: `1px solid ${t.type === 'gold' ? 'rgba(255,215,0,0.2)' : 'rgba(192,192,192,0.2)'}`,
                      }}>
                        <Box sx={{
                          width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: t.type === 'gold'
                            ? 'linear-gradient(135deg, #ffd700, #ff8f00)'
                            : 'linear-gradient(135deg, #c0c0c0, #78909c)',
                          fontSize: 9, flexShrink: 0,
                        }}>
                          🏆
                        </Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: t.type === 'gold' ? '#ffe082' : '#b0bec5', whiteSpace: 'nowrap' }}>
                          {t.tournamentName}
                        </Typography>
                        {t.season && (
                          <Typography sx={{ fontSize: 8, color: 'text.secondary', fontWeight: 600, opacity: 0.7 }}>
                            {t.season}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Card>
              )}



              {/* Played By */}
              {profile.playedBy.length > 0 && (
                <Card sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                    <PersonRoundedIcon sx={{ fontSize: 16, color: '#64ffda' }} /> Played By
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {profile.playedBy.map((p, i) => (
                      <Chip key={i}
                        avatar={<Avatar sx={{ width: 18, height: 18, fontSize: 8, bgcolor: getColor(p.name) }}>{getInit(p.name)}</Avatar>}
                        label={p.name} size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 11 }} />
                    ))}
                  </Stack>
                </Card>
              )}

              {/* Recent Matches */}
              {profile.recentMatches.length > 0 && (
                <Card sx={{ p: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, fontSize: 12 }}>Recent Matches</Typography>
                  <Stack spacing={0.75}>
                    {profile.recentMatches.slice(0, 5).map((m, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Chip label={m.result} size="small" sx={{ fontWeight: 900, fontSize: 10, minWidth: 24, height: 22,
                          bgcolor: m.result === 'W' ? 'rgba(0,230,118,0.15)' : m.result === 'D' ? 'rgba(255,215,64,0.15)' : 'rgba(255,82,82,0.15)',
                          color: m.result === 'W' ? '#00e676' : m.result === 'D' ? '#ffd740' : '#ff5252',
                          border: `1px solid ${m.result === 'W' ? 'rgba(0,230,118,0.3)' : m.result === 'D' ? 'rgba(255,215,64,0.3)' : 'rgba(255,82,82,0.3)'}` }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 11 }} noWrap>
                            {profile.team.name} {m.myGoals} – {m.oppGoals} {m.oppTeam}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                            {m.tournamentName}{m.season ? ` · ${m.season}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              )}

              {profile.stats.totalMatches === 0 && (
                <EmptyState message="No match data yet for this team." icon={<SportsSoccerRoundedIcon sx={{ fontSize: 40 }} />} />
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

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
        message={`Remove "${deleteTarget?.name}" from the global team list?`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </Box>
  );
}
