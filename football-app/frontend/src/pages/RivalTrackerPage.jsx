import { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Avatar, Chip, Stack, Button,
  FormControl, InputLabel, Select, MenuItem, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { getTeamProfiles, getTeamRivals } from '../api/footballApi';

const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

export default function RivalTrackerPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [teams, setTeams] = useState([]);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [rivalData, setRivalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getTeamProfiles();
        setTeams(res.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const handleCompare = async () => {
    if (!team1 || !team2 || team1 === team2) return;
    setComparing(true);
    try {
      const res = await getTeamRivals(team1, team2);
      setRivalData(res.data);
    } catch (e) { console.error(e); setRivalData(null); }
    setComparing(false);
  };

  if (loading) return <LoadingState />;

  return (
    <Box>
      <PageHeader
        title="Rival Tracker"
        subtitle="Head-to-head record between two teams across all tournaments"
        icon={<CompareArrowsRoundedIcon />}
      />

      {/* Team Selection */}
      <Card sx={{ p: 2, mb: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, alignItems: 'flex-end' }}>
          <FormControl sx={{ flex: 1 }} size="small">
            <InputLabel>Team 1</InputLabel>
            <Select value={team1} label="Team 1" onChange={(e) => setTeam1(e.target.value)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 200, '& .MuiMenuItem-root': { py: 0.5, minHeight: 28 } } } }}>
              {teams.filter(t => t.name !== team2).map(t => (
                <MenuItem key={t.name} value={t.name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 20, height: 20, fontSize: 8, fontWeight: 800, bgcolor: getColor(t.name) }}>{getInit(t.name)}</Avatar>
                    <Typography sx={{ fontSize: 13 }}>{t.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <CompareArrowsRoundedIcon sx={{ color: 'text.secondary', fontSize: 28, alignSelf: 'center' }} />

          <FormControl sx={{ flex: 1 }} size="small">
            <InputLabel>Team 2</InputLabel>
            <Select value={team2} label="Team 2" onChange={(e) => setTeam2(e.target.value)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 200, '& .MuiMenuItem-root': { py: 0.5, minHeight: 28 } } } }}>
              {teams.filter(t => t.name !== team1).map(t => (
                <MenuItem key={t.name} value={t.name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 20, height: 20, fontSize: 8, fontWeight: 800, bgcolor: getColor(t.name) }}>{getInit(t.name)}</Avatar>
                    <Typography sx={{ fontSize: 13 }}>{t.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={handleCompare}
            disabled={!team1 || !team2 || team1 === team2 || comparing}
            sx={{ minWidth: 100, fontWeight: 700 }}>
            {comparing ? 'Loading...' : 'Compare'}
          </Button>
        </Box>
      </Card>

      {comparing && <LoadingState />}

      {rivalData && !comparing && (
        <Box>
          {/* Head-to-Head Summary */}
          <Card sx={{ p: 2.5, mb: 2.5,
            background: 'linear-gradient(135deg, rgba(0,230,118,0.06), rgba(101,31,255,0.06))',
            border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              {/* Team 1 */}
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Avatar sx={{ width: 48, height: 48, fontSize: 18, fontWeight: 900, bgcolor: getColor(team1), mx: 'auto', mb: 0.75 }}>
                  {getInit(team1)}
                </Avatar>
                <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{team1}</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#00e676', mt: 0.5 }}>
                  {rivalData.stats.team1Wins}
                </Typography>
                <Typography variant="caption" color="text.secondary">Wins</Typography>
              </Box>

              {/* Center Stats */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {rivalData.stats.totalMatches} matches
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75,
                  borderRadius: 2, bgcolor: 'rgba(255,215,64,0.1)', border: '1px solid rgba(255,215,64,0.2)' }}>
                  <Typography sx={{ fontWeight: 900, color: '#00e676' }}>{rivalData.stats.team1Wins}</Typography>
                  <Typography color="text.secondary" sx={{ fontWeight: 600 }}>-</Typography>
                  <Typography sx={{ fontWeight: 900, color: '#ffd740' }}>{rivalData.stats.draws}</Typography>
                  <Typography color="text.secondary" sx={{ fontWeight: 600 }}>-</Typography>
                  <Typography sx={{ fontWeight: 900, color: '#651fff' }}>{rivalData.stats.team2Wins}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Draws: {rivalData.stats.draws}
                </Typography>
              </Box>

              {/* Team 2 */}
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Avatar sx={{ width: 48, height: 48, fontSize: 18, fontWeight: 900, bgcolor: getColor(team2), mx: 'auto', mb: 0.75 }}>
                  {getInit(team2)}
                </Avatar>
                <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{team2}</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#651fff', mt: 0.5 }}>
                  {rivalData.stats.team2Wins}
                </Typography>
                <Typography variant="caption" color="text.secondary">Wins</Typography>
              </Box>
            </Box>

            {/* Goals comparison */}
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Goals Scored</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                  <Chip label={rivalData.stats.team1Goals} size="small" sx={{ fontWeight: 800, bgcolor: 'rgba(0,230,118,0.1)', color: '#00e676' }} />
                  <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>vs</Typography>
                  <Chip label={rivalData.stats.team2Goals} size="small" sx={{ fontWeight: 800, bgcolor: 'rgba(101,31,255,0.1)', color: '#651fff' }} />
                </Box>
              </Box>
            </Box>
          </Card>

          {/* Match History */}
          {rivalData.matches.length > 0 ? (
            <Card sx={{ p: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Match History</Typography>
              <Stack spacing={1}>
                {rivalData.matches.map((m, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <Box sx={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: m.result === 'team1' ? '#00e676' : 'text.primary' }} noWrap>
                        {team1}
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.4, borderRadius: 99,
                      background: m.result === 'draw' ? 'rgba(255,215,64,0.12)' : 'rgba(0,230,118,0.08)',
                      border: `1px solid ${m.result === 'draw' ? 'rgba(255,215,64,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: m.result === 'team1' ? '#00e676' : 'text.secondary' }}>
                        {m.team1Goals}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, color: 'text.secondary', mx: 0.25 }}>–</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: m.result === 'team2' ? '#651fff' : 'text.secondary' }}>
                        {m.team2Goals}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, color: m.result === 'team2' ? '#651fff' : 'text.primary' }} noWrap>
                        {team2}
                      </Typography>
                    </Box>
                    <Chip label={m.tournamentName} size="small"
                      sx={{ fontSize: 9, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.05)', display: isMobile ? 'none' : 'flex' }} />
                    {m.fixtureType === 'knockout' && (
                      <Chip
                        label={m.roundName ? (m.roundName === 'Quarter-Final' ? 'QF' : m.roundName === 'Semi-Final' ? 'SF' : m.roundName === 'Final' ? 'F' : m.roundName) : 'KO'}
                        size="small"
                        sx={{ fontSize: 8, fontWeight: 700, bgcolor: 'rgba(255,152,0,0.1)', color: '#ff9800', minWidth: 28, display: isMobile ? 'none' : 'flex' }}
                      />
                    )}
                    {m.fixtureType === 'group_league' && (
                      <Chip label="GRP" size="small"
                        sx={{ fontSize: 8, fontWeight: 700, bgcolor: 'rgba(0,230,118,0.1)', color: '#00e676', minWidth: 28, display: isMobile ? 'none' : 'flex' }} />
                    )}
                    {m.fixtureType === 'knockout' && m.leg && m.roundName !== 'Final' && (
                      <Chip label={`L${m.leg}`} size="small"
                        sx={{ fontSize: 8, fontWeight: 600, bgcolor: 'rgba(101,31,255,0.1)', color: '#651fff', minWidth: 22, display: isMobile ? 'none' : 'flex' }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </Card>
          ) : (
            <EmptyState
              message="No head-to-head matches found between these teams."
              icon={<CompareArrowsRoundedIcon sx={{ fontSize: 48 }} />}
            />
          )}
        </Box>
      )}

      {!rivalData && !comparing && team1 && team2 && team1 !== team2 && (
        <EmptyState message="Click Compare to see the head-to-head record" icon={<CompareArrowsRoundedIcon sx={{ fontSize: 48 }} />} />
      )}
    </Box>
  );
}
