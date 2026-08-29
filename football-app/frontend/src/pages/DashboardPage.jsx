import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Stack, Skeleton, Avatar, useMediaQuery,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton
} from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PageHeader from '../components/PageHeader';
import { getDashboard, getBirthdayWishes, createBirthdayWish, deleteBirthdayWish } from '../api/footballApi';

const pulse = keyframes`
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
`;

const scaleIn = keyframes`
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
`;

const glow = keyframes`
  0%, 100% { text-shadow: 0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3); }
  50% { text-shadow: 0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.5), 0 0 120px rgba(255,215,0,0.2); }
`;

const crackerBurst = keyframes`
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const slideUp = keyframes`
  0% { transform: translateY(30px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

const lightSweep = keyframes`
  0% { transform: translateX(-100%) rotate(25deg); }
  100% { transform: translateX(200%) rotate(25deg); }
`;

const trophyFloat = keyframes`
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-6px) rotate(2deg); }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

// Cracker particle component
function CrackerParticles({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }
    const createBurst = () => {
      const newParticles = [];
      const crackerPositions = [
        { x: 5, y: 10 }, { x: 95, y: 10 },
        { x: 15, y: 30 }, { x: 85, y: 30 },
        { x: 50, y: 5 }, { x: 30, y: 55 }, { x: 70, y: 55 },
        { x: 10, y: 75 }, { x: 90, y: 75 },
        { x: 40, y: 85 }, { x: 60, y: 85 },
        { x: 25, y: 15 }, { x: 75, y: 15 },
        { x: 50, y: 45 }, { x: 20, y: 60 }, { x: 80, y: 60 }
      ];
      crackerPositions.forEach((pos, ci) => {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * 360;
          const distance = 40 + Math.random() * 60;
          const tx = Math.cos(angle * Math.PI / 180) * distance;
          const ty = Math.sin(angle * Math.PI / 180) * distance;
          newParticles.push({
            id: `${ci}-${i}-${Date.now()}`,
            x: pos.x, y: pos.y, tx, ty,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            size: 3 + Math.random() * 4,
            delay: ci * 0.2 + Math.random() * 0.3,
            duration: 1 + Math.random() * 0.8
          });
        }
      });
      setParticles(newParticles);
    };
    createBurst();
    const interval = setInterval(createBurst, 3000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;
  return (
    <Box sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {particles.map(p => (
        <Box key={p.id} sx={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, borderRadius: '50%',
          bgcolor: p.color,
          '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
          animation: `${crackerBurst} ${p.duration}s ease-out ${p.delay}s both`,
          boxShadow: `0 0 4px ${p.color}`
        }} />
      ))}
    </Box>
  );
}

// Birthday Banner — clean, image-based design
function BirthdayBanner({ wishes, isAdmin, onDelete }) {
  if (!wishes || wishes.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      {wishes.map((wish) => (
        <Card key={wish.id} sx={{
          mb: 2, position: 'relative', overflow: 'hidden',
          borderRadius: 4,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.08)',
          animation: `${scaleIn} 0.5s ease-out`,
          border: '1px solid rgba(255,215,0,0.15)'
        }}>
          {/* Background Image */}
          <Box sx={{
            position: 'absolute', inset: 0,
            backgroundImage: 'url(/soccer.jpg)',
            backgroundSize: 'cover', backgroundPosition: 'center top',
            filter: 'brightness(0.35)',
          }} />

          {/* Light sweep effect */}
          <Box sx={{
            position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
            '&::after': {
              content: '""', position: 'absolute', top: 0, left: 0,
              width: '60%', height: '200%',
              background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.06), transparent)',
              animation: `${lightSweep} 4s ease-in-out infinite`,
            }
          }} />

          {/* Gradient overlay */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)',
          }} />

          <CardContent sx={{
            position: 'relative', zIndex: 1,
            p: { xs: 4, sm: 5 }, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minHeight: { xs: 220, sm: 280 }, justifyContent: 'center'
          }}>
            {/* Delete button for admin */}
            {isAdmin && (
              <IconButton size="small" onClick={() => onDelete(wish.id)}
                sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.3)', 
                  '&:hover': { color: '#ff5252', bgcolor: 'rgba(255,82,82,0.15)' } }}>
                <DeleteRoundedIcon fontSize="small" />
              </IconButton>
            )}

            {/* Happy Birthday label */}
            <Typography sx={{
              fontSize: { xs: 12, sm: 14 }, fontWeight: 600,
              letterSpacing: 4, textTransform: 'uppercase',
              color: 'rgba(255,215,0,0.8)', mb: 1.5,
              animation: `${slideUp} 0.6s ease-out 0.2s both`
            }}>
              Happy Birthday
            </Typography>

            {/* Name — the hero */}
            <Typography sx={{
              fontSize: { xs: 32, sm: 48, md: 56 }, fontWeight: 900,
              color: '#fff',
              animation: `${glow} 3s ease-in-out infinite, ${slideUp} 0.6s ease-out 0.4s both`,
              lineHeight: 1.1, mb: 1.5,
              letterSpacing: '-0.02em'
            }}>
              {wish.name}
            </Typography>

            {/* Bruh line */}
            <Typography sx={{
              fontSize: { xs: 16, sm: 20 }, fontWeight: 700,
              background: 'linear-gradient(90deg, #ffd700, #ff6b35, #ffd700)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: `${shimmer} 3s linear infinite, ${slideUp} 0.6s ease-out 0.6s both`,
              letterSpacing: 1
            }}>
              Bruh!
            </Typography>

            {/* Subtle gold line */}
            <Box sx={{
              mt: 2.5, width: 60, height: 2, borderRadius: 1,
              background: 'linear-gradient(90deg, transparent, #ffd700, transparent)',
              animation: `${slideUp} 0.6s ease-out 0.8s both`
            }} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ─── Season Hub Card ──────────────────────────────────────────────────────────
function SeasonHubCard({ seasonInfo, lastChampion, seasonTopScorer, seasonTopElo, seasonTopPerformer }) {
  if (!seasonInfo && !lastChampion) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2.5 }}>
      {/* Active Season Overview */}
      {seasonInfo && (
        <Card sx={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d1b2a 100%)',
          border: '1px solid rgba(0,230,118,0.15)',
          borderRadius: 3,
        }}>
          {/* Animated accent line */}
          <Box sx={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, #00e676, #651fff, #00e676)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 3s linear infinite`,
          }} />
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CalendarTodayRoundedIcon sx={{ color: '#00e676', fontSize: 18 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                Season {seasonInfo.seasonNumber}
              </Typography>
              <Chip
                label={seasonInfo.status === 'active' ? 'Live' : 'Completed'}
                size="small"
                sx={{
                  height: 18, fontSize: 9, fontWeight: 800,
                  bgcolor: seasonInfo.status === 'active' ? 'rgba(0,230,118,0.15)' : 'rgba(255,152,0,0.12)',
                  color: seasonInfo.status === 'active' ? '#00e676' : '#ff9800',
                  letterSpacing: 0.5,
                }}
              />
            </Box>

            {/* Stats grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
              <StatBox
                value={seasonInfo.tournamentCount}
                label="Tournaments"
                color="#40c4ff"
                delay="0s"
              />
              <StatBox
                value={seasonInfo.playedMatches}
                label="Matches"
                color="#a255ff"
                delay="0.1s"
              />
              <StatBox
                value={seasonInfo.totalGoals}
                label="Goals"
                color="#ff6e40"
                delay="0.2s"
              />
            </Box>

            {/* Season progress bar */}
            {seasonInfo.totalMatches > 0 && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>Season Progress</Typography>
                  <Typography sx={{ fontSize: 10, color: '#00e676', fontWeight: 700 }}>
                    {Math.round((seasonInfo.playedMatches / seasonInfo.totalMatches) * 100)}%
                  </Typography>
                </Box>
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 2,
                    width: `${Math.min(100, (seasonInfo.playedMatches / seasonInfo.totalMatches) * 100)}%`,
                    background: 'linear-gradient(90deg, #00e676, #651fff)',
                    transition: 'width 1s ease',
                  }} />
                </Box>
              </Box>
            )}

            {/* Season top scorer */}
            {seasonTopScorer && (
              <Box sx={{
                mt: 2, p: 1.25, borderRadius: 2,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 1.5,
              }}>
                <BoltRoundedIcon sx={{ fontSize: 16, color: '#ffd740' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>Top Scorer</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#ffd740' }}>{seasonTopScorer.team}</Typography>
                </Box>
                <Chip label={`⚽ ${seasonTopScorer.goals}`} size="small"
                  sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(255,215,64,0.12)', color: '#ffd740' }} />
              </Box>
            )}

            {/* Season highlights row */}
            {(seasonTopScorer || seasonTopElo || seasonTopPerformer) && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: seasonTopScorer ? 0 : 2 }}>
                {/* Top Performer */}
                {seasonTopPerformer && (
                  <Box sx={{
                    mt: seasonTopScorer ? 1 : 0, p: 1.25, borderRadius: 2,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}>
                    <EmojiEventsRoundedIcon sx={{ fontSize: 16, color: '#a255ff' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>Top Performer</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#a255ff' }}>{seasonTopPerformer.team}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {seasonTopPerformer.gold > 0 && (
                        <Chip label={`🥇 ${seasonTopPerformer.gold}`} size="small"
                          sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(255,215,0,0.12)', color: '#ffd700' }} />
                      )}
                      {seasonTopPerformer.silver > 0 && (
                        <Chip label={`🥈 ${seasonTopPerformer.silver}`} size="small"
                          sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(192,192,192,0.12)', color: '#c0c0c0' }} />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Top Power Rating */}
                {seasonTopElo && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                  }}>
                    <BoltRoundedIcon sx={{ fontSize: 16, color: '#ff9800' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>Top Power Rating</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#ff9800' }}>{seasonTopElo.team}</Typography>
                    </Box>
                    <Chip label={`⚡ ${seasonTopElo.elo}`} size="small"
                      sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(255,152,0,0.12)', color: '#ff9800' }} />
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Last Champion Trophy Card */}
      {lastChampion && (
        <Card sx={{
          flex: { xs: '1', md: '0 0 280px' }, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: 3,
        }}>
          {/* Gold shimmer overlay */}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.05) 30%, rgba(255,255,255,0.03) 50%, rgba(255,215,0,0.05) 70%, transparent)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 4s ease-in-out infinite`,
          }} />
          {/* Stars */}
          <Box sx={{ position: 'absolute', top: 12, left: 16, fontSize: 8, color: 'rgba(255,215,0,0.4)', animation: `${pulse} 2s ease-in-out infinite` }}>✦</Box>
          <Box sx={{ position: 'absolute', top: 24, right: 20, fontSize: 6, color: 'rgba(255,215,0,0.3)', animation: `${pulse} 2.5s ease-in-out infinite`, animationDelay: '0.5s' }}>✦</Box>
          <Box sx={{ position: 'absolute', bottom: 20, left: 24, fontSize: 7, color: 'rgba(255,215,0,0.35)', animation: `${pulse} 3s ease-in-out infinite`, animationDelay: '1s' }}>✦</Box>

          <CardContent sx={{
            p: { xs: 2.5, sm: 3 }, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', height: '100%', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,215,0,0.6)', mb: 1 }}>
              Reigning Champion
            </Typography>

            {/* Trophy */}
            <Box sx={{ animation: `${trophyFloat} 3s ease-in-out infinite`, mb: 1 }}>
              <Typography sx={{ fontSize: 40, filter: 'drop-shadow(0 4px 12px rgba(255,215,0,0.4))' }}>🏆</Typography>
            </Box>

            {/* Winner name */}
            <Typography sx={{
              fontWeight: 900, fontSize: { xs: 18, sm: 22 },
              background: 'linear-gradient(180deg, #fff8dc 0%, #ffd700 50%, #daa520 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              mb: 0.75, lineHeight: 1.2,
            }}>
              {lastChampion.winner}
            </Typography>

            {/* Tournament name */}
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, mb: 0.5 }}>
              {lastChampion.tournamentName}
            </Typography>

            {/* Season badge */}
            {lastChampion.seasonNumber && (
              <Chip
                label={`Season ${lastChampion.seasonNumber}`}
                size="small"
                sx={{
                  height: 18, fontSize: 9, fontWeight: 700,
                  bgcolor: 'rgba(255,215,0,0.1)', color: 'rgba(255,215,0,0.7)',
                  border: '1px solid rgba(255,215,0,0.2)',
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function StatBox({ value, label, color, delay }) {
  return (
    <Box sx={{
      p: 1.25, borderRadius: 2, textAlign: 'center',
      background: `linear-gradient(135deg, ${color}08, ${color}03)`,
      border: `1px solid ${color}18`,
      animation: `${countUp} 0.4s ease-out ${delay} both`,
    }}>
      <Typography sx={{ fontWeight: 900, fontSize: 22, color, lineHeight: 1.1, mb: 0.25 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [birthdayWishes, setBirthdayWishes] = useState([]);
  const [bdayDialogOpen, setBdayDialogOpen] = useState(false);
  const [bdayName, setBdayName] = useState('');
  const [bdayLoading, setBdayLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('fp_user') || 'null');
  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, bdayRes] = await Promise.all([getDashboard(), getBirthdayWishes()]);
        setData(dashRes.data);
        setBirthdayWishes(bdayRes.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const handleCreateBirthday = async () => {
    if (!bdayName.trim()) return;
    setBdayLoading(true);
    try {
      const res = await createBirthdayWish({ name: bdayName.trim() });
      setBirthdayWishes(prev => [...prev, res.data]);
      setBdayName('');
      setBdayDialogOpen(false);
    } catch(e) { console.error(e); }
    setBdayLoading(false);
  };

  const handleDeleteBirthday = async (id) => {
    try {
      await deleteBirthdayWish(id);
      setBirthdayWishes(prev => prev.filter(w => w.id !== id));
    } catch(e) { console.error(e); }
  };

  if (loading) {
    return (
      <Box>
        <PageHeader icon={<DashboardRoundedIcon />} title="Dashboard" subtitle="Season overview at a glance" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1,2,3].map(i => <Skeleton key={i} variant="rounded" height={140} sx={{ bgcolor:'rgba(255,255,255,0.05)', borderRadius:3 }} />)}
        </Box>
      </Box>
    );
  }

  if (!data || (!data.recentResults.length && !data.upcomingFixtures.length && !data.leagueLeaders.length)) {
    return (
      <Box>
        <PageHeader icon={<DashboardRoundedIcon />} title="Dashboard" subtitle="Season overview at a glance" />

        {/* Birthday Celebrations even on empty state */}
        <CrackerParticles active={birthdayWishes.length > 0} />
        <BirthdayBanner wishes={birthdayWishes} isAdmin={isAdmin} onDelete={handleDeleteBirthday} />

        {/* Admin: Show Birthday Button */}
        {isAdmin && (
          <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<CakeRoundedIcon />}
              onClick={() => setBdayDialogOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
                color: '#000', fontWeight: 800, fontSize: 12,
                borderRadius: 2, textTransform: 'none',
                boxShadow: '0 4px 15px rgba(255,215,0,0.3)',
                '&:hover': { background: 'linear-gradient(135deg, #ffed4a, #ff8c42)', boxShadow: '0 6px 20px rgba(255,215,0,0.4)' }
              }}>
              Show Birthday
            </Button>
          </Box>
        )}

        {/* Birthday Dialog */}
        <Dialog open={bdayDialogOpen} onClose={() => setBdayDialogOpen(false)}
          PaperProps={{ sx: { bgcolor: '#1a2035', borderRadius: 3, border: '1px solid rgba(255,215,0,0.2)', minWidth: 320 } }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, fontSize: 16 }}>
            <CakeRoundedIcon sx={{ color: '#ffd700' }} />
            Birthday Wish
            <IconButton size="small" onClick={() => setBdayDialogOpen(false)} sx={{ ml: 'auto', color: 'text.secondary' }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Typography color="text.secondary" sx={{ fontSize: 12, mb: 2 }}>
              Enter the birthday person's name. This will be visible to all users today only!
            </Typography>
            <TextField fullWidth autoFocus placeholder="Enter name..." value={bdayName}
              onChange={(e) => setBdayName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBirthday(); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setBdayDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button variant="contained" disabled={!bdayName.trim() || bdayLoading} onClick={handleCreateBirthday}
              sx={{ background: 'linear-gradient(135deg, #ffd700, #ff6b35)', color: '#000', fontWeight: 700,
                '&:hover': { background: 'linear-gradient(135deg, #ffed4a, #ff8c42)' } }}>
              {bdayLoading ? 'Sending...' : '🎉 Wish Now!'}
            </Button>
          </DialogActions>
        </Dialog>

        {birthdayWishes.length === 0 && (
          <Box sx={{ textAlign:'center', py:8 }}>
            <Typography sx={{ fontSize:48, mb:2 }}>📊</Typography>
            <Typography variant="h6" sx={{ fontWeight:700, mb:1 }}>No Activity Yet</Typography>
            <Typography color="text.secondary" sx={{ fontSize:13 }}>Create a tournament and play some matches to see your dashboard</Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader icon={<DashboardRoundedIcon />} title="Dashboard" subtitle="Season overview at a glance" />

      {/* Birthday Celebrations */}
      <CrackerParticles active={birthdayWishes.length > 0} />
      <BirthdayBanner wishes={birthdayWishes} isAdmin={isAdmin} onDelete={handleDeleteBirthday} />

      {/* Admin: Show Birthday Button */}
      {isAdmin && (
        <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<CakeRoundedIcon />}
            onClick={() => setBdayDialogOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
              color: '#000', fontWeight: 800, fontSize: 12,
              borderRadius: 2, textTransform: 'none',
              boxShadow: '0 4px 15px rgba(255,215,0,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #ffed4a, #ff8c42)', boxShadow: '0 6px 20px rgba(255,215,0,0.4)' }
            }}>
            Show Birthday
          </Button>
        </Box>
      )}

      {/* Birthday Dialog */}
      <Dialog open={bdayDialogOpen} onClose={() => setBdayDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1a2035', borderRadius: 3, border: '1px solid rgba(255,215,0,0.2)', minWidth: 320 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, fontSize: 16 }}>
          <CakeRoundedIcon sx={{ color: '#ffd700' }} />
          Birthday Wish
          <IconButton size="small" onClick={() => setBdayDialogOpen(false)} sx={{ ml: 'auto', color: 'text.secondary' }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ fontSize: 12, mb: 2 }}>
            Enter the birthday person's name. This will be visible to all users today only!
          </Typography>
          <TextField fullWidth autoFocus placeholder="Enter name..." value={bdayName}
            onChange={(e) => setBdayName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBirthday(); }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBdayDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" disabled={!bdayName.trim() || bdayLoading} onClick={handleCreateBirthday}
            sx={{ background: 'linear-gradient(135deg, #ffd700, #ff6b35)', color: '#000', fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #ffed4a, #ff8c42)' } }}>
            {bdayLoading ? 'Sending...' : '🎉 Wish Now!'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Season Hub & Last Champion */}
      <SeasonHubCard
        seasonInfo={data.seasonInfo}
        lastChampion={data.lastChampion}
        seasonTopScorer={data.seasonTopScorer}
        seasonTopElo={data.seasonTopElo}
        seasonTopPerformer={data.seasonTopPerformer}
      />

      {/* Win Streaks */}
      {data.streaks.length > 0 && (
        <Card sx={{ mb:2.5, background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(255,82,82,0.15)' }}>
          <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
              <WhatshotRoundedIcon sx={{ color:'#ff5252', fontSize:20 }} />
              <Typography sx={{ fontWeight:800, fontSize:14 }}>Hot Streaks</Typography>
            </Box>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
              {data.streaks.map((s, i) => (
                <Chip key={s.team} label={`${s.team} 🔥 ${s.wins}W`} size="small"
                  sx={{ fontWeight:700, fontSize:11,
                    bgcolor: i===0 ? 'rgba(255,82,82,0.15)' : 'rgba(255,255,255,0.05)',
                    color: i===0 ? '#ff5252' : 'text.primary',
                    border: i===0 ? '1px solid rgba(255,82,82,0.3)' : '1px solid rgba(255,255,255,0.08)'
                  }} />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* League Leaders */}
      {data.leagueLeaders.length > 0 && (
        <Card sx={{ mb:2.5, background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(0,230,118,0.15)' }}>
          <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <LeaderboardRoundedIcon sx={{ color:'#00e676', fontSize:20 }} />
              <Typography sx={{ fontWeight:800, fontSize:14 }}>League Leaders</Typography>
            </Box>
            <Stack spacing={1.5}>
              {data.leagueLeaders.map(l => (
                <Box key={l.tournament} sx={{ p:1.5, borderRadius:2, bgcolor:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight:600, fontSize:10 }}>
                      {l.tournament}
                    </Typography>
                    <Chip label={`Matchday ${l.matchday}/${l.totalMatchdays}`} size="small"
                      sx={{ fontSize:9, fontWeight:600, height:18, bgcolor:'rgba(255,255,255,0.05)' }} />
                  </Box>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                    <Avatar sx={{ width:28, height:28, fontSize:10, fontWeight:800, bgcolor:getColor(l.leader) }}>
                      {getInit(l.leader)}
                    </Avatar>
                    <Box sx={{ flex:1 }}>
                      <Typography sx={{ fontWeight:800, fontSize:13, color:'primary.main' }}>{l.leader}</Typography>
                    </Box>
                    <Chip label={`${l.pts} pts`} size="small"
                      sx={{ fontWeight:800, fontSize:11, bgcolor:'rgba(0,230,118,0.12)', color:'#00e676' }} />
                  </Box>
                  {l.table.length > 1 && (
                    <Box sx={{ mt:1, display:'flex', gap:0.5 }}>
                      {l.table.slice(1).map((t, i) => (
                        <Chip key={t.name} label={`${i+2}. ${t.name} (${t.pts})`} size="small"
                          sx={{ fontSize:9, fontWeight:600, height:18, bgcolor:'rgba(255,255,255,0.04)' }} />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display:'flex', flexDirection:{ xs:'column', md:'row' }, gap:2.5 }}>
        {/* Recent Results */}
        {data.recentResults.length > 0 && (
          <Card sx={{ flex:1, background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(101,31,255,0.15)' }}>
            <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
                <SportsSoccerRoundedIcon sx={{ color:'#651fff', fontSize:20 }} />
                <Typography sx={{ fontWeight:800, fontSize:14 }}>Recent Results</Typography>
              </Box>
              <Stack spacing={1}>
                {data.recentResults.map(m => (
                  <Box key={m.id} sx={{ display:'flex', alignItems:'center', gap:1, p:1, borderRadius:1.5,
                    bgcolor:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <Box sx={{ flex:1, textAlign:'right', minWidth:0 }}>
                      <Typography sx={{ fontWeight:700, fontSize:11, color: m.homeScore > m.awayScore ? '#00e676' : 'text.primary' }} noWrap>
                        {m.homeTeam}
                      </Typography>
                    </Box>
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.5, px:1, py:0.25, borderRadius:99,
                      bgcolor:'rgba(101,31,255,0.1)', border:'1px solid rgba(101,31,255,0.2)' }}>
                      <Typography sx={{ fontWeight:900, fontSize:13 }}>{m.homeScore}</Typography>
                      <Typography sx={{ fontSize:11, color:'text.secondary' }}>–</Typography>
                      <Typography sx={{ fontWeight:900, fontSize:13 }}>{m.awayScore}</Typography>
                    </Box>
                    <Box sx={{ flex:1, minWidth:0 }}>
                      <Typography sx={{ fontWeight:700, fontSize:11, color: m.awayScore > m.homeScore ? '#00e676' : 'text.primary' }} noWrap>
                        {m.awayTeam}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Fixtures */}
        {data.upcomingFixtures.length > 0 && (
          <Card sx={{ flex:1, background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(64,196,255,0.15)' }}>
            <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
                <ScheduleRoundedIcon sx={{ color:'#40c4ff', fontSize:20 }} />
                <Typography sx={{ fontWeight:800, fontSize:14 }}>Upcoming</Typography>
              </Box>
              <Stack spacing={1}>
                {data.upcomingFixtures.map(m => (
                  <Box key={m.id} sx={{ display:'flex', alignItems:'center', gap:1, p:1, borderRadius:1.5,
                    bgcolor:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <Box sx={{ flex:1, textAlign:'right', minWidth:0 }}>
                      <Typography sx={{ fontWeight:700, fontSize:11 }} noWrap>{m.homeTeam}</Typography>
                    </Box>
                    <Box sx={{ px:1.5, py:0.25, borderRadius:99, bgcolor:'rgba(64,196,255,0.08)', border:'1px solid rgba(64,196,255,0.2)' }}>
                      <Typography sx={{ fontWeight:700, fontSize:10, color:'#40c4ff' }}>vs</Typography>
                    </Box>
                    <Box sx={{ flex:1, minWidth:0 }}>
                      <Typography sx={{ fontWeight:700, fontSize:11 }} noWrap>{m.awayTeam}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Active Tournaments */}
      {data.activeTournaments.length > 0 && (
        <Card sx={{ mt:2.5, background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(255,215,0,0.12)' }}>
          <CardContent sx={{ p:{ xs:2, sm:2.5 } }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
              <EmojiEventsRoundedIcon sx={{ color:'#ffd740', fontSize:20 }} />
              <Typography sx={{ fontWeight:800, fontSize:14 }}>Active Tournaments</Typography>
            </Box>
            <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
              {data.activeTournaments.map(t => (
                <Chip key={t.id}
                  label={`${t.name} · ${t.matchesPlayed} played`}
                  size="small"
                  sx={{ fontWeight:600, fontSize:10, bgcolor:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.15)' }} />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
