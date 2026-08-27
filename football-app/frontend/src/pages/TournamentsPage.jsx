import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  useMediaQuery, Chip, Skeleton, Alert, Divider, LinearProgress
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
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';
import {
  getTournaments, createTournament, deleteTournament,
  getGlobalTeams, getSeasonSummary,
  getSeasons, createSeason, completeSeason, migrateToSeason1
} from '../api/footballApi';

// ── Animations ────────────────────────────────────────────────────────────────
const goldShimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;
const crownBounce = keyframes`
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-2px) scale(1.1); }
`;
const starTwinkle = keyframes`
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1.2); }
`;
const activePulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,230,118,0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(0,230,118,0); }
`;
const glowSlide = keyframes`
  0%   { background-position: -100% center; }
  100% { background-position: 200% center; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_META = {
  league:         { color: '#00e676', bg: 'rgba(0,230,118,0.08)',     label: 'League',     Icon: SportsSoccerRoundedIcon },
  knockout:       { color: '#a255ff', bg: 'rgba(101,31,255,0.12)',   label: 'Knockout',   Icon: AccountTreeRoundedIcon },
  group_knockout: { color: '#ff9800', bg: 'rgba(255,152,0,0.12)',    label: 'Group+KO',   Icon: GroupsRoundedIcon },
};
const typeLabel = (t) => {
  if (t.type === 'group_knockout') return `Group+KO (${t.numGroups || 2}G)`;
  return TYPE_META[t.type]?.label ?? t.type;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function TournamentsPage({ onSelect, isAdmin }) {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ── Season state ───────────────────────────────────────────────────────────
  const [seasons, setSeasons]             = useState([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [activeSeasonNum, setActiveSeasonNum] = useState(null); // null = all
  const [filterSeasonNum, setFilterSeasonNum] = useState(null); // null = all

  // ── Tournament state ───────────────────────────────────────────────────────
  const [tournaments, setTournaments]     = useState([]);
  const [tourLoading, setTourLoading]     = useState(true);
  const [createOpen, setCreateOpen]       = useState(false);
  const [form, setForm]                   = useState({ name: '', season: '', type: 'league', num_groups: 2, legs: 2 });
  const [createError, setCreateError]     = useState('');
  const [deleteTarget, setDeleteTarget]   = useState(null);

  // ── Global teams for create dialog ────────────────────────────────────────
  const [globalTeams, setGlobalTeams]       = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  // ── Summary dialog ─────────────────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen]       = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData]       = useState(null);

  // ── Season action dialogs ──────────────────────────────────────────────────
  const [completeTarget, setCompleteTarget] = useState(null); // season to complete
  const [seasonActionLoading, setSeasonActionLoading] = useState(false);
  const [seasonError, setSeasonError] = useState('');

  // ── Load seasons ───────────────────────────────────────────────────────────
  const loadSeasons = useCallback(async () => {
    setSeasonsLoading(true);
    try {
      const r = await getSeasons();
      setSeasons(r.data);
      const active = r.data.find(s => s.status === 'active');
      setActiveSeasonNum(active?.seasonNumber ?? null);
      // Always default to the active season on first load
      if (active) {
        setFilterSeasonNum(prev => prev ?? active.seasonNumber);
      } else if (r.data.length > 0) {
        // No active season — default to the latest season
        setFilterSeasonNum(prev => prev ?? r.data[r.data.length - 1].seasonNumber);
      }
    } catch (_) {}
    setSeasonsLoading(false);
  }, []);

  // ── Load tournaments (respects filter) ────────────────────────────────────
  const loadTournaments = useCallback(async (seasonNum) => {
    setTourLoading(true);
    try {
      const r = await getTournaments(seasonNum !== null ? seasonNum : undefined);
      setTournaments(r.data);
    } catch (_) {}
    setTourLoading(false);
  }, []);

  useEffect(() => { loadSeasons(); }, [loadSeasons]);
  useEffect(() => { loadTournaments(filterSeasonNum); }, [filterSeasonNum, loadTournaments]);

  // ── Season tab change ────────────────────────────────────────────────────
  const handleFilterChange = (_, val) => {
    if (val === undefined || val === null) return;
    setFilterSeasonNum(val);
  };

  // ── Create season ──────────────────────────────────────────────────────────
  const handleCreateSeason = async () => {
    setSeasonActionLoading(true);
    setSeasonError('');
    try {
      await createSeason();
      await loadSeasons();
    } catch (e) {
      setSeasonError(e.response?.data?.error || 'Failed to create season');
    }
    setSeasonActionLoading(false);
  };

  // ── Migrate existing tournaments → Season 1 ────────────────────────────────
  const handleMigrate = async () => {
    setSeasonActionLoading(true);
    setSeasonError('');
    try {
      await migrateToSeason1();
      await loadSeasons();
      await loadTournaments(filterSeasonNum);
    } catch (e) {
      setSeasonError(e.response?.data?.error || 'Migration failed');
    }
    setSeasonActionLoading(false);
  };

  // ── Complete season ────────────────────────────────────────────────────────
  const handleCompleteSeason = async () => {
    if (!completeTarget) return;
    setSeasonActionLoading(true);
    setSeasonError('');
    try {
      await completeSeason(completeTarget.seasonNumber);
      setCompleteTarget(null);
      await loadSeasons();
      await loadTournaments(filterSeasonNum);
    } catch (e) {
      setSeasonError(e.response?.data?.error || 'Failed to complete season');
    }
    setSeasonActionLoading(false);
  };

  // ── Create tournament ──────────────────────────────────────────────────────
  const loadGlobalTeams = async () => {
    try { const r = await getGlobalTeams(); setGlobalTeams(r.data); } catch (_) {}
  };

  const handleOpenCreate = () => {
    loadGlobalTeams();
    setSelectedTeamIds([]);
    setCreateError('');
    setForm({ name: '', season: '', type: 'league', num_groups: 2, legs: 2 });
    setCreateOpen(true);
  };

  const toggleTeam  = (id) => setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const toggleAll   = () => setSelectedTeamIds(prev => prev.length === globalTeams.length ? [] : globalTeams.map(t => t.id));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreateError('');
    try {
      await createTournament({
        ...form,
        teamIds: selectedTeamIds,
        // Attach to the currently active season if one exists
        ...(activeSeasonNum !== null ? { season_number: activeSeasonNum } : {}),
      });
      setCreateOpen(false);
      await loadTournaments(filterSeasonNum);
    } catch (e) {
      setCreateError(e.response?.data?.error || 'Failed to create tournament');
    }
  };

  // ── Delete tournament ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTournament(deleteTarget.id);
    setDeleteTarget(null);
    loadTournaments(filterSeasonNum);
  };

  // ── Summary ────────────────────────────────────────────────────────────────
  const handleOpenSummary = async (t) => {
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await getSeasonSummary(t.id);
      setSummaryData(res.data);
    } catch (_) {}
    setSummaryLoading(false);
  };

  // ── Derived: current active season object ─────────────────────────────────
  const activeSeason = seasons.find(s => s.status === 'active') ?? null;
  const noSeasonsYet = !seasonsLoading && seasons.length === 0;
  const canCreateNewSeason = isAdmin && (!activeSeason || seasons.every(s => s.status !== 'active'));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        icon="🏆"
        title="Tournaments"
        subtitle="Manage seasons and tournaments"
        action={
          isAdmin && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {activeSeason && (
                <Button
                  variant="outlined" size="small"
                  startIcon={<LockRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => setCompleteTarget(activeSeason)}
                  disabled={seasonActionLoading}
                  sx={{
                    fontSize: { xs: 10, sm: 12 }, px: { xs: 1, sm: 1.5 }, py: { xs: 0.5, sm: 0.6 }, minWidth: 0,
                    borderColor: 'rgba(255,152,0,0.4)', color: '#ff9800',
                    '&:hover': { borderColor: '#ff9800', bgcolor: 'rgba(255,152,0,0.08)' },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Complete&nbsp;</Box>Season {activeSeason.seasonNumber}
                </Button>
              )}
              {activeSeason && (
                <Button
                  variant="contained" size="small"
                  startIcon={<AddRoundedIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={handleOpenCreate}
                  sx={{
                    background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000',
                    fontSize: { xs: 11, sm: 13 }, px: { xs: 1.5, sm: 2 }, py: { xs: 0.6, sm: 0.75 }, minWidth: 0,
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>New&nbsp;</Box>Tournament
                </Button>
              )}
            </Box>
          )
        }
      />

      {/* ── Season Management Panel ─────────────────────────────────────── */}
      <SeasonPanel
        seasons={seasons}
        loading={seasonsLoading}
        seasonError={seasonError}
        actionLoading={seasonActionLoading}
        isAdmin={isAdmin}
        filterSeasonNum={filterSeasonNum}
        onFilterChange={handleFilterChange}
        onCreateSeason={handleCreateSeason}
        canCreateNewSeason={canCreateNewSeason}
        noSeasonsYet={noSeasonsYet}
        existingTournamentCount={tournaments.length}
        onMigrate={handleMigrate}
      />

      {/* ── Tournament List ─────────────────────────────────────────────── */}
      <Box sx={{ mt: 2 }}>
        {tourLoading ? (
          <LoadingState variant="cards" count={4} />
        ) : tournaments.length === 0 ? (
          <EmptyState
            icon="🏟️"
            title={filterSeasonNum !== null ? `No tournaments in Season ${filterSeasonNum}` : 'No tournaments yet'}
            subtitle={
              noSeasonsYet
                ? 'Start Season 1 to begin creating tournaments'
                : !activeSeason && filterSeasonNum === activeSeasonNum
                ? 'Complete season or change filter to view past tournaments'
                : 'Create your first tournament to get started'
            }
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
            {tournaments.map(t => (
              <TournamentCard
                key={t.id}
                t={t}
                isAdmin={isAdmin}
                onSelect={onSelect}
                onSummary={handleOpenSummary}
                onDelete={setDeleteTarget}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Create Tournament Dialog ────────────────────────────────────── */}
      <Dialog
        open={createOpen} onClose={() => setCreateOpen(false)}
        maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: { xs: 15, sm: 18 } }}>
          Create Tournament
          {activeSeason && (
            <Chip
              label={`Season ${activeSeason.seasonNumber}`}
              size="small"
              icon={<CalendarTodayRoundedIcon sx={{ fontSize: '13px !important' }} />}
              sx={{ ml: 1.5, fontSize: 10, height: 20, bgcolor: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)' }}
            />
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          {createError && <Alert severity="error" sx={{ fontSize: 12 }}>{createError}</Alert>}

          <TextField
            label="Tournament Name" fullWidth size="small" autoFocus
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <TextField
            label="Season label (optional)" fullWidth size="small" placeholder="e.g. 2025-26"
            value={form.season} onChange={e => setForm({ ...form, season: e.target.value })}
          />

          {/* Type */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>
              Tournament Type
            </Typography>
            <ToggleButtonGroup value={form.type} exclusive fullWidth size="small"
              onChange={(_, v) => v && setForm({ ...form, type: v })}>
              {[
                { val: 'league',         label: 'League',    Icon: SportsSoccerRoundedIcon, sel: 'rgba(0,230,118,0.15)',  c: '#00e676', bc: 'rgba(0,230,118,0.4)' },
                { val: 'knockout',       label: 'Knockout',  Icon: AccountTreeRoundedIcon,  sel: 'rgba(101,31,255,0.15)', c: '#a255ff', bc: 'rgba(101,31,255,0.4)' },
                { val: 'group_knockout', label: 'Group+KO',  Icon: GroupsRoundedIcon,        sel: 'rgba(255,152,0,0.15)',  c: '#ff9800', bc: 'rgba(255,152,0,0.4)' },
              ].map(({ val, label, Icon, sel, c, bc }) => (
                <ToggleButton key={val} value={val}
                  sx={{ gap: 0.75, fontWeight: 700, fontSize: 12,
                    '&.Mui-selected': { bgcolor: sel, color: c, borderColor: bc } }}>
                  <Icon sx={{ fontSize: 16 }} />{label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 10 }}>
              {form.type === 'league'
                ? 'Each team plays every other team (home & away)'
                : form.type === 'knockout'
                ? 'Two-legged knockout — aggregate goals decide the winner'
                : form.num_groups >= 4
                ? 'Group stage → QF → SF → Final'
                : 'Group stage → Semi-finals → Final'}
            </Typography>

            {/* League legs */}
            {form.type === 'league' && (
              <LegsSelector value={form.legs} color="#00e676" onChange={v => setForm({ ...form, legs: v })} />
            )}

            {/* Group+KO: groups */}
            {form.type === 'group_knockout' && (
              <>
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>
                    Number of Groups
                  </Typography>
                  <ToggleButtonGroup value={form.num_groups} exclusive fullWidth size="small"
                    onChange={(_, v) => v && setForm({ ...form, num_groups: v, ...(v >= 4 ? { legs: 1 } : {}) })}>
                    {[2, 4].map(n => (
                      <ToggleButton key={n} value={n} sx={{ fontWeight: 700, fontSize: 12,
                        '&.Mui-selected': { bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', borderColor: 'rgba(255,152,0,0.4)' } }}>
                        {n} Groups
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 10 }}>
                    {form.num_groups >= 4
                      ? `4 groups · top 2 qualify → QF → SF → Final (need ≥ ${form.num_groups * 2} teams)`
                      : `Teams distributed across ${form.num_groups} groups (need ≥ ${form.num_groups * 2} teams)`}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>
                    Group Stage Legs
                  </Typography>
                  <ToggleButtonGroup value={form.legs} exclusive fullWidth size="small"
                    onChange={(_, v) => v && setForm({ ...form, legs: v })}>
                    <ToggleButton value={1} sx={{ fontWeight: 700, fontSize: 12,
                      '&.Mui-selected': { bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', borderColor: 'rgba(255,152,0,0.4)' } }}>
                      1 Leg
                    </ToggleButton>
                    <ToggleButton value={2} disabled={form.num_groups >= 4} sx={{ fontWeight: 700, fontSize: 12,
                      '&.Mui-selected': { bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', borderColor: 'rgba(255,152,0,0.4)' } }}>
                      2 Legs (Home &amp; Away)
                    </ToggleButton>
                  </ToggleButtonGroup>
                  {form.num_groups >= 4 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 10 }}>
                      4-group format uses 1 leg in group stage
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>

          {/* Team Selection */}
          <TeamSelector
            globalTeams={globalTeams}
            selectedTeamIds={selectedTeamIds}
            onToggle={toggleTeam}
            onToggleAll={toggleAll}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} variant="outlined" color="inherit" size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" size="small" disabled={!form.name.trim()}
            sx={{ background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000' }}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tournament"
        message={`Delete "${deleteTarget?.name}"? All teams, fixtures and results will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Complete season confirm ─────────────────────────────────────── */}
      <ConfirmDialog
        open={!!completeTarget}
        title={`Complete Season ${completeTarget?.seasonNumber}?`}
        message={`This will lock Season ${completeTarget?.seasonNumber}. No new tournaments can be added to it. You can start Season ${(completeTarget?.seasonNumber ?? 0) + 1} afterwards.`}
        onConfirm={handleCompleteSeason}
        onCancel={() => setCompleteTarget(null)}
      />

      {/* ── Summary Dialog ──────────────────────────────────────────────── */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, bgcolor: '#0d1220' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MilitaryTechRoundedIcon sx={{ color: '#ffd700', fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>
              {summaryData?.tournament?.name || 'Tournament Summary'}
              {summaryData?.tournament?.season ? ` · ${summaryData.tournament.season}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSummaryOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          {summaryLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
              {[100, 60, 60].map((h, i) => (
                <Skeleton key={i} variant="rounded" height={h} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }} />
              ))}
            </Box>
          ) : summaryData?.summary ? (
            <SummaryContent summary={summaryData.summary} />
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ fontSize: 36, mb: 1 }}>📊</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>No matches played yet</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Season Tabs Panel — pill-style scrollable tabs
// ─────────────────────────────────────────────────────────────────────────────
function SeasonPanel({
  seasons, loading, seasonError, actionLoading, isAdmin,
  filterSeasonNum, onFilterChange,
  onCreateSeason,
  canCreateNewSeason, noSeasonsYet,
  existingTournamentCount, onMigrate,
}) {
  const scrollRef = useRef(null);

  // Auto-scroll the selected tab into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const t = setTimeout(() => {
      const el = scrollRef.current?.querySelector('[data-selected="true"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 80);
    return () => clearTimeout(t);
  }, [filterSeasonNum]);

  if (loading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={52} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
      </Box>
    );
  }

  const hasMigratable = noSeasonsYet && existingTournamentCount > 0;

  return (
    <Box sx={{ mb: 2 }}>
      {seasonError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>{seasonError}</Alert>
      )}

      {noSeasonsYet ? (
        <Box sx={{
          p: 2.5, borderRadius: 2.5,
          background: 'linear-gradient(135deg, rgba(0,230,118,0.06), rgba(101,31,255,0.04))',
          border: '1px solid rgba(0,230,118,0.18)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#fff', mb: 0.25 }}>No seasons yet</Typography>
              {hasMigratable ? (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  You have <strong style={{ color: '#fff' }}>{existingTournamentCount}</strong> existing tournament{existingTournamentCount > 1 ? 's' : ''}.
                  Move {existingTournamentCount > 1 ? 'them' : 'it'} into Season 1, or start fresh.
                </Typography>
              ) : (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Start Season 1 to begin creating tournaments.
                </Typography>
              )}
            </Box>
            {isAdmin && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {hasMigratable && (
                  <Button
                    variant="outlined" size="small"
                    startIcon={<CalendarTodayRoundedIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={onMigrate}
                    disabled={actionLoading}
                    sx={{
                      fontSize: 11, py: 0.5, px: 1.5,
                      borderColor: 'rgba(0,230,118,0.4)', color: '#00e676',
                      '&:hover': { borderColor: '#00e676', bgcolor: 'rgba(0,230,118,0.08)' },
                    }}
                  >
                    Move all to Season 1
                  </Button>
                )}
                <Button
                  variant="contained" size="small"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={onCreateSeason}
                  disabled={actionLoading}
                  sx={{ background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000', fontWeight: 700 }}
                >
                  Start Season 1
                </Button>
              </Box>
            )}
          </Box>
          {actionLoading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
        </Box>
      ) : (
        <Box sx={{
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(17,24,39,0.8), rgba(26,32,53,0.6))',
          border: '1px solid rgba(255,255,255,0.06)',
          p: { xs: 1, sm: 1.25 },
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle background shimmer */}
          <Box sx={{
            position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.03) 30%, rgba(101,31,255,0.03) 70%, transparent)',
            backgroundSize: '200% 100%',
            animation: `${glowSlide} 8s ease-in-out infinite`,
          }} />

          {actionLoading && (
            <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 1, height: 2 }} />
          )}

          {/* Scrollable pills row */}
          <Box
            ref={scrollRef}
            sx={{
              display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 },
              overflowX: 'auto', overflowY: 'hidden',
              scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
              py: 0.5, px: 0.5,
              position: 'relative',
            }}
          >
            {seasons.map(s => {
              const isActive = s.status === 'active';
              const isSelected = filterSeasonNum === s.seasonNumber;
              const color = isActive ? '#00e676' : '#a0aec0';

              return (
                <Box
                  key={s.seasonNumber}
                  data-selected={isSelected}
                  onClick={() => onFilterChange(null, s.seasonNumber)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 },
                    px: { xs: 1.5, sm: 2 }, py: { xs: 0.75, sm: 0.9 },
                    borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    border: '1px solid',
                    ...(isSelected ? {
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(0,230,118,0.15), rgba(0,178,72,0.08))'
                        : 'linear-gradient(135deg, rgba(160,174,192,0.12), rgba(160,174,192,0.06))',
                      borderColor: isActive ? 'rgba(0,230,118,0.4)' : 'rgba(160,174,192,0.3)',
                      boxShadow: isActive
                        ? '0 0 16px rgba(0,230,118,0.2), inset 0 1px 0 rgba(0,230,118,0.15)'
                        : '0 0 12px rgba(160,174,192,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                    } : {
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.06)',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.06)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        transform: 'translateY(-1px)',
                      },
                    }),
                  }}
                >
                  {/* Active glow overlay */}
                  {isSelected && isActive && (
                    <Box sx={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.08), transparent)',
                      backgroundSize: '200% 100%',
                      animation: `${glowSlide} 3s ease-in-out infinite`,
                    }} />
                  )}

                  {/* Status dot */}
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    bgcolor: isActive ? '#00e676' : 'rgba(160,174,192,0.4)',
                    ...(isActive && isSelected ? {
                      animation: `${activePulse} 2s ease-in-out infinite`,
                    } : {}),
                  }} />

                  {/* Season label */}
                  <Typography sx={{
                    fontSize: { xs: 12, sm: 13 },
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? color : 'rgba(255,255,255,0.5)',
                    whiteSpace: 'nowrap', position: 'relative',
                    letterSpacing: isSelected ? 0.3 : 0,
                  }}>
                    Season {s.seasonNumber}
                  </Typography>

                  {/* Tournament count badge */}
                  <Box sx={{
                    px: 0.75, py: 0.1, borderRadius: 1,
                    fontSize: { xs: 9, sm: 10 }, fontWeight: 700,
                    bgcolor: isSelected
                      ? (isActive ? 'rgba(0,230,118,0.2)' : 'rgba(160,174,192,0.15)')
                      : 'rgba(255,255,255,0.06)',
                    color: isSelected ? color : 'rgba(255,255,255,0.35)',
                    lineHeight: 1.6, position: 'relative',
                  }}>
                    {s.tournamentCount}
                  </Box>

                  {/* Lock icon for completed seasons */}
                  {!isActive && (
                    <LockRoundedIcon sx={{
                      fontSize: 10, position: 'relative',
                      color: isSelected ? 'rgba(160,174,192,0.6)' : 'rgba(255,255,255,0.2)',
                    }} />
                  )}
                </Box>
              );
            })}

            {/* New season button (inline with tabs) */}
            {isAdmin && canCreateNewSeason && (
              <Box
                onClick={onCreateSeason}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: { xs: 1.25, sm: 1.75 }, py: { xs: 0.75, sm: 0.9 },
                  borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                  border: '1px dashed rgba(0,230,118,0.3)',
                  background: 'transparent',
                  transition: 'all 0.2s ease',
                  opacity: actionLoading ? 0.5 : 1,
                  pointerEvents: actionLoading ? 'none' : 'auto',
                  '&:hover': {
                    background: 'rgba(0,230,118,0.06)',
                    borderColor: 'rgba(0,230,118,0.5)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <AddRoundedIcon sx={{ fontSize: 14, color: '#00e676' }} />
                <Typography sx={{
                  fontSize: { xs: 11, sm: 12 }, fontWeight: 600, color: '#00e676', whiteSpace: 'nowrap',
                }}>
                  Season {(seasons[seasons.length - 1]?.seasonNumber ?? 0) + 1}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tournament Card
// ─────────────────────────────────────────────────────────────────────────────
function TournamentCard({ t, isAdmin, onSelect, onSummary, onDelete }) {
  const meta      = TYPE_META[t.type] ?? TYPE_META.league;
  const { color, bg } = meta;
  const TypeIcon  = meta.Icon;
  const label     = typeLabel(t);

  return (
    <Card sx={{
      background: 'linear-gradient(135deg,#111827 0%,#1a2035 100%)',
      borderLeft: `3px solid ${color}`,
      transition: 'all 0.2s ease',
      '&:hover': { transform: { xs: 'none', sm: 'translateY(-2px)' }, boxShadow: `0 8px 24px ${bg}` },
    }}>
      <CardActionArea onClick={() => onSelect(t)}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Left: icon + info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
              <Box sx={{
                width: { xs: 40, sm: 44 }, height: { xs: 40, sm: 44 }, borderRadius: 2, flexShrink: 0,
                background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                border: `1px solid ${color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <EmojiEventsRoundedIcon sx={{ color, fontSize: { xs: 20, sm: 22 } }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: { xs: 13, sm: 15 }, color: '#fff' }}>
                  {t.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
                  <TypeIcon sx={{ fontSize: 11, color }} />
                  <Typography sx={{ fontSize: { xs: 10, sm: 11 }, color, fontWeight: 600 }}>{label}</Typography>
                  {t.season && (
                    <>
                      <Box sx={{ width: 2.5, height: 2.5, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.25)' }} />
                      <Typography sx={{ fontSize: { xs: 10, sm: 11 }, color: 'text.secondary' }}>{t.season}</Typography>
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Center: winner trophy */}
            {t.winner && <WinnerBadge winner={t.winner} />}

            {/* Right: actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Tooltip title="Tournament Summary">
                <IconButton size="small" onClick={e => { e.stopPropagation(); onSummary(t); }}
                  sx={{ color: 'rgba(255,255,255,0.4)', p: 0.5, '&:hover': { bgcolor: 'rgba(0,230,118,0.1)', color: '#00e676' } }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />
                </IconButton>
              </Tooltip>
              {isAdmin && (
                <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(t); }}
                  sx={{ color: 'rgba(255,82,82,0.6)', p: 0.5, '&:hover': { bgcolor: 'rgba(255,82,82,0.1)', color: '#ff5252' } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />
                </IconButton>
              )}
              <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: { xs: 17, sm: 19 } }} />
            </Box>

          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Winner badge
// ─────────────────────────────────────────────────────────────────────────────
function WinnerBadge({ winner }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 },
      px: { xs: 1.25, sm: 2 }, py: { xs: 0.5, sm: 0.6 },
      borderRadius: 10,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
      border: '1px solid rgba(255,215,0,0.3)',
      boxShadow: '0 2px 12px rgba(255,215,0,0.15), inset 0 1px 0 rgba(255,215,0,0.1)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.12) 20%, rgba(255,255,255,0.08) 50%, rgba(255,215,0,0.12) 80%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: `${goldShimmer} 2.5s ease-in-out infinite`,
      }} />
      <Box sx={{ position: 'absolute', top: 3, left: 12, fontSize: 7, color: 'rgba(255,215,0,0.6)', animation: `${starTwinkle} 2s ease-in-out infinite` }}>✦</Box>
      <Box sx={{ position: 'absolute', bottom: 3, right: 14, fontSize: 6, color: 'rgba(255,215,0,0.5)', animation: `${starTwinkle} 2.5s ease-in-out infinite`, animationDelay: '0.8s' }}>✦</Box>
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography sx={{ fontSize: { xs: 6, sm: 7 }, lineHeight: 1, mb: '-2px', animation: `${crownBounce} 2s ease-in-out infinite`, color: '#ffd700' }}>👑</Typography>
        <Typography sx={{ fontSize: { xs: 14, sm: 17 }, lineHeight: 1, position: 'relative', filter: 'drop-shadow(0 2px 4px rgba(255,215,0,0.4))' }}>🏆</Typography>
      </Box>
      <Typography sx={{
        fontSize: { xs: 11, sm: 13 }, fontWeight: 900, letterSpacing: 0.5,
        background: 'linear-gradient(180deg, #fff8dc 0%, #ffd700 40%, #daa520 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', position: 'relative', textTransform: 'uppercase',
      }}>
        {winner}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legs selector (reused)
// ─────────────────────────────────────────────────────────────────────────────
function LegsSelector({ value, color, onChange }) {
  const sel = { bgcolor: `${color}26`, color, borderColor: `${color}66` };
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>Legs</Typography>
      <ToggleButtonGroup value={value} exclusive fullWidth size="small"
        onChange={(_, v) => v && onChange(v)}>
        <ToggleButton value={1} sx={{ fontWeight: 700, fontSize: 12, '&.Mui-selected': sel }}>1 Leg</ToggleButton>
        <ToggleButton value={2} sx={{ fontWeight: 700, fontSize: 12, '&.Mui-selected': sel }}>2 Legs (Home &amp; Away)</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team selector (create dialog)
// ─────────────────────────────────────────────────────────────────────────────
function TeamSelector({ globalTeams, selectedTeamIds, onToggle, onToggleAll }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Select Teams {selectedTeamIds.length > 0 && `(${selectedTeamIds.length})`}
        </Typography>
        {globalTeams.length > 0 && (
          <Button size="small" onClick={onToggleAll}
            sx={{ fontSize: 10, minWidth: 0, px: 1, py: 0.25, textTransform: 'none', color: 'primary.main' }}>
            {selectedTeamIds.length === globalTeams.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </Box>
      {globalTeams.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          No global teams available. Add teams from the Teams tab first.
        </Typography>
      ) : (
        <Box sx={{
          maxHeight: 200, overflowY: 'auto', borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.02)', p: 1,
        }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {globalTeams.map(team => {
              const sel = selectedTeamIds.includes(team.id);
              return (
                <Chip
                  key={team.id} label={team.name} size="small"
                  onClick={() => onToggle(team.id)}
                  icon={sel
                    ? <CheckBoxRoundedIcon sx={{ fontSize: '16px !important' }} />
                    : <CheckBoxOutlineBlankRoundedIcon sx={{ fontSize: '16px !important' }} />}
                  sx={{
                    fontWeight: 600, fontSize: 11,
                    borderColor: sel ? 'primary.main' : 'rgba(255,255,255,0.15)',
                    bgcolor: sel ? 'rgba(0,230,118,0.12)' : 'transparent',
                    color: sel ? '#00e676' : 'rgba(255,255,255,0.7)',
                    border: '1px solid',
                    '&:hover': { bgcolor: sel ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.06)' },
                    '& .MuiChip-icon': { color: sel ? '#00e676' : 'rgba(255,255,255,0.4)' },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 10 }}>
        Selected teams will be added automatically. You can add more later.
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary content (unchanged logic, cleaned up)
// ─────────────────────────────────────────────────────────────────────────────
function SummaryContent({ summary }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {summary.champion && (
        <Box sx={{
          p: 2.5, borderRadius: 3, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,160,0,0.04) 100%)',
          border: '1px solid rgba(255,215,0,0.2)',
        }}>
          <Typography sx={{ fontSize: 32, mb: 0.5 }}>🏆</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#ffd700', mb: 0.25 }}>{summary.champion}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Champion</Typography>
          {summary.runnerUp && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
              Runner-up: <strong style={{ color: '#c0c0c0' }}>{summary.runnerUp}</strong>
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
        {summary.bestAttack && (
          <SummaryStatCard icon={<SportsSoccerRoundedIcon sx={{ fontSize: 18, color: '#00e676' }} />}
            label="Best Attack" value={summary.bestAttack.team} detail={`${summary.bestAttack.goals} goals`} color="#00e676" />
        )}
        {summary.bestDefense && (
          <SummaryStatCard icon={<ShieldRoundedIcon sx={{ fontSize: 18, color: '#40c4ff' }} />}
            label="Best Defense" value={summary.bestDefense.team}
            detail={`${summary.bestDefense.ratio}/match (${summary.bestDefense.conceded} in ${summary.bestDefense.matches})`} color="#40c4ff" />
        )}
        <SummaryStatCard icon={<SportsSoccerRoundedIcon sx={{ fontSize: 18, color: '#ff6e40' }} />}
          label="Total Goals" value={summary.totalGoals} detail={`${summary.avgGoalsPerMatch} per match`} color="#ff6e40" />
        <SummaryStatCard icon={<LeaderboardRoundedIcon sx={{ fontSize: 18, color: '#a255ff' }} />}
          label="Matches" value={summary.totalMatches} detail={`${summary.teamsCount} teams`} color="#a255ff" />
      </Box>

      {summary.mostEntertainingMatch && (
        <Box sx={{
          p: 2, borderRadius: 2.5,
          background: 'linear-gradient(135deg, rgba(255,82,82,0.06) 0%, rgba(101,31,255,0.06) 100%)',
          border: '1px solid rgba(255,82,82,0.15)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <WhatshotRoundedIcon sx={{ fontSize: 16, color: '#ff5252' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#ff5252' }}>Most Entertaining Match</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 12, sm: 14 }, textAlign: 'right', flex: 1 }} noWrap>
              {summary.mostEntertainingMatch.homeTeam}
            </Typography>
            <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <Typography sx={{ fontWeight: 900, fontSize: 16, color: '#00e676' }}>
                {summary.mostEntertainingMatch.homeScore} - {summary.mostEntertainingMatch.awayScore}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 12, sm: 14 }, textAlign: 'left', flex: 1 }} noWrap>
              {summary.mostEntertainingMatch.awayTeam}
            </Typography>
          </Box>
          <Typography sx={{ textAlign: 'center', fontSize: 10, color: 'text.secondary', mt: 0.75 }}>
            {summary.mostEntertainingMatch.totalGoals} goals
          </Typography>
        </Box>
      )}

      {summary.biggestWin?.margin > 0 && (
        <Box sx={{ p: 2, borderRadius: 2.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <MilitaryTechRoundedIcon sx={{ fontSize: 16, color: '#ffd740' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#ffd740' }}>Biggest Win</Typography>
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            {summary.biggestWin.homeTeam} {summary.biggestWin.homeScore} – {summary.biggestWin.awayScore} {summary.biggestWin.awayTeam}
          </Typography>
          <Typography sx={{ textAlign: 'center', fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
            Margin: {summary.biggestWin.margin}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function SummaryStatCard({ icon, label, value, detail, color }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: 2,
      background: `linear-gradient(135deg, ${color}0d, ${color}05)`,
      border: `1px solid ${color}22`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>{icon}
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#fff', mb: 0.25 }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{detail}</Typography>
    </Box>
  );
}
