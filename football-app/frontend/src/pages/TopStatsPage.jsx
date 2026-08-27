import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  Button, Collapse, Skeleton, useMediaQuery
} from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import PageHeader from '../components/PageHeader';
import SeasonFilter from '../components/SeasonFilter';
import { getStats } from '../api/footballApi';

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const MEDAL_COLORS = {
  0: { bg: 'linear-gradient(135deg, #FFD700, #FFA000)', text: '#000', label: '🥇' },
  1: { bg: 'linear-gradient(135deg, #C0C0C0, #808080)', text: '#000', label: '🥈' },
};

export default function TopStatsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllScorers, setShowAllScorers] = useState(false);
  const [showAllPerformers, setShowAllPerformers] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState(null);

  const loadStats = async (season) => {
    setLoading(true);
    try {
      const res = await getStats(season === 'overall' ? undefined : season);
      setStats(res.data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (seasonFilter !== null) loadStats(seasonFilter);
  }, [seasonFilter]);

  const handleSeasonChange = (val) => {
    setSeasonFilter(val);
    setShowAllScorers(false);
    setShowAllPerformers(false);
  };

  if (loading) {
    return (
      <Box>
        <PageHeader icon="⭐" title="Top Performances & Stats" subtitle="Cross-tournament highlights"
          action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ffd700" />} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={180}
              sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (!stats || (!stats.topPerformers.length && !stats.bestMatch && !stats.topScorers.length)) {
    return (
      <Box>
        <PageHeader icon="⭐" title="Top Performances & Stats" subtitle="Cross-tournament highlights"
          action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ffd700" />} />
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 48, mb: 2 }}>📊</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No Stats Yet</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            Play some tournament matches to see performances and stats here
          </Typography>
        </Box>
      </Box>
    );
  }

  const subtitleLabel = seasonFilter === 'overall'
    ? `Across ${stats.totalTournaments} tournament${stats.totalTournaments !== 1 ? 's' : ''}`
    : `Season ${seasonFilter} · ${stats.totalTournaments} tournament${stats.totalTournaments !== 1 ? 's' : ''}`;

  const topFour = showAllPerformers ? stats.topPerformers : stats.topPerformers.slice(0, 3);
  const scorersToShow = showAllScorers ? stats.topScorers : stats.topScorers.slice(0, 5);

  return (
    <Box>
      <PageHeader icon="⭐" title="Top Performances & Stats"
        subtitle={subtitleLabel}
        action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ffd700" />} />

      {/* ─── Top Performers (Rank 1, 2, 3, 3) ─── */}
      {topFour.length > 0 && (
        <Card sx={{
          mb: 3, background: 'linear-gradient(135deg, #111827 0%, #1a2035 100%)',
          border: '1px solid rgba(255,215,0,0.15)',
          overflow: 'visible'
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <EmojiEventsRoundedIcon sx={{ color: '#ffd700', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>
                Top Performers
              </Typography>
              <Chip label={seasonFilter === 'overall' ? 'All Tournaments' : `Season ${seasonFilter}`} size="small"
                sx={{ ml: 'auto', fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,215,0,0.12)', color: '#ffd700' }} />
            </Box>

            {/* Podium: Top 3 with distinct styles */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 1st, 2nd, 3rd in a podium layout */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-end' }, justifyContent: 'center', gap: { xs: 2, sm: 2.5 }, px: { xs: 0, sm: 2 } }}>

                {/* 2nd Place - Left */}
                {topFour.length > 1 && (
                  <Box sx={{ order: { xs: 2, sm: 1 }, flex: '0 1 220px' }}>
                    <Box sx={{
                      position: 'relative', p: 2, borderRadius: 3,
                      background: 'linear-gradient(160deg, rgba(192,192,192,0.12) 0%, rgba(107,114,128,0.06) 100%)',
                      border: '1px solid rgba(192,192,192,0.25)',
                      backdropFilter: 'blur(8px)',
                      transition: 'transform 0.25s, box-shadow 0.25s',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 12px 32px rgba(192,192,192,0.15)' },
                    }}>
                      <Box sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #e8e8e8, #a0a0a0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 900, color: '#1a1a2e',
                        boxShadow: '0 4px 12px rgba(192,192,192,0.4)',
                        border: '2px solid rgba(255,255,255,0.3)' }}>
                        2
                      </Box>
                      <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                        <Typography sx={{ fontSize: 20, mb: 0.5 }}>🥈</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }} noWrap>{topFour[1].name}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {topFour[1].gold > 0 && <Chip label={`🥇 ${topFour[1].gold}`} size="small" sx={{ fontSize: 11, fontWeight: 700, height: 22, bgcolor: 'rgba(255,215,0,0.15)', color: '#ffd700' }} />}
                          {topFour[1].silver > 0 && <Chip label={`🥈 ${topFour[1].silver}`} size="small" sx={{ fontSize: 11, fontWeight: 700, height: 22, bgcolor: 'rgba(192,192,192,0.15)', color: '#c0c0c0' }} />}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* 1st Place - Center (Tallest) */}
                {topFour.length > 0 && (
                  <Box sx={{ order: { xs: 1, sm: 2 }, flex: '0 1 260px' }}>
                    <Box sx={{
                      position: 'relative', p: 2.5, borderRadius: 3.5,
                      background: 'linear-gradient(160deg, rgba(255,215,0,0.15) 0%, rgba(255,160,0,0.08) 50%, rgba(255,215,0,0.03) 100%)',
                      border: '1.5px solid rgba(255,215,0,0.35)',
                      boxShadow: '0 0 30px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,215,0,0.15)',
                      backdropFilter: 'blur(8px)',
                      transition: 'transform 0.25s, box-shadow 0.25s',
                      animation: `${pulse} 3s ease-in-out infinite`,
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 40px rgba(255,215,0,0.2), 0 0 30px rgba(255,215,0,0.08)' },
                    }}>
                      {/* Shimmer overlay */}
                      <Box sx={{ position: 'absolute', inset: 0, borderRadius: 3.5, overflow: 'hidden', pointerEvents: 'none' }}>
                        <Box sx={{ position: 'absolute', inset: 0,
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.06) 25%, rgba(255,255,255,0.04) 50%, rgba(255,215,0,0.06) 75%, transparent 100%)',
                          backgroundSize: '200% 100%', animation: `${shimmer} 3s ease-in-out infinite` }} />
                      </Box>
                      <Box sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900, color: '#1a1a2e',
                        boxShadow: '0 4px 16px rgba(255,215,0,0.5)',
                        border: '2px solid rgba(255,255,255,0.4)' }}>
                        1
                      </Box>
                      <Box sx={{ textAlign: 'center', mt: 1.5, position: 'relative' }}>
                        <Typography sx={{ fontSize: 28, mb: 0.25 }}>👑</Typography>
                        <Typography sx={{ fontSize: 22, mb: 0.5 }}>🏆</Typography>
                        <Typography sx={{ fontWeight: 900, fontSize: 17,
                          background: 'linear-gradient(180deg, #fff8dc 0%, #ffd700 60%, #daa520 100%)',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 1 }} noWrap>
                          {topFour[0].name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {topFour[0].gold > 0 && <Chip label={`🥇 ${topFour[0].gold}`} size="small" sx={{ fontSize: 11, fontWeight: 700, height: 22, bgcolor: 'rgba(255,215,0,0.2)', color: '#ffd700' }} />}
                          {topFour[0].silver > 0 && <Chip label={`🥈 ${topFour[0].silver}`} size="small" sx={{ fontSize: 11, fontWeight: 700, height: 22, bgcolor: 'rgba(192,192,192,0.15)', color: '#c0c0c0' }} />}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* 3rd Place - Right */}
                {topFour.length > 2 && (
                  <Box sx={{ order: 3, flex: '0 1 200px' }}>
                    <Box sx={{
                      position: 'relative', p: 1.75, borderRadius: 2.5,
                      background: 'linear-gradient(160deg, rgba(205,127,50,0.1) 0%, rgba(139,69,19,0.04) 100%)',
                      border: '1px solid rgba(205,127,50,0.2)',
                      backdropFilter: 'blur(8px)',
                      transition: 'transform 0.25s, box-shadow 0.25s',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 28px rgba(205,127,50,0.12)' },
                    }}>
                      <Box sx={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #CD7F32, #8B5E2B)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 900, color: '#fff',
                        boxShadow: '0 3px 10px rgba(205,127,50,0.4)',
                        border: '2px solid rgba(255,255,255,0.2)' }}>
                        3
                      </Box>
                      <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                        <Typography sx={{ fontSize: 18, mb: 0.5 }}>🥉</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75, color: 'rgba(240,244,255,0.85)' }} noWrap>{topFour[2].name}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {topFour[2].gold > 0 && <Chip label={`🥇 ${topFour[2].gold}`} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(255,215,0,0.15)', color: '#ffd700' }} />}
                          {topFour[2].silver > 0 && <Chip label={`🥈 ${topFour[2].silver}`} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(192,192,192,0.15)', color: '#c0c0c0' }} />}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* 4th onwards - simple compact rows */}
              {topFour.length > 3 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: { xs: 0, sm: 2 } }}>
                  {topFour.slice(3).map((team, idx) => (
                    <Box key={team.name} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.25, borderRadius: 2,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'background 0.2s',
                      '&:hover': { background: 'rgba(255,255,255,0.04)' },
                    }}>
                      <Box sx={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: 'text.secondary'
                      }}>
                        {idx + 4}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }} noWrap>{team.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {team.gold > 0 && <Chip label={`🥇 ${team.gold}`} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(255,215,0,0.1)', color: '#ffd700' }} />}
                        {team.silver > 0 && <Chip label={`🥈 ${team.silver}`} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: 'rgba(192,192,192,0.1)', color: '#c0c0c0' }} />}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {stats.topPerformers.length > 3 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  size="small"
                  onClick={() => setShowAllPerformers(!showAllPerformers)}
                  endIcon={showAllPerformers ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  sx={{
                    fontSize: 12, fontWeight: 700, color: '#ffd700',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,215,0,0.08)' }
                  }}
                >
                  {showAllPerformers ? 'Show Less' : `Show More (${stats.topPerformers.length - 3} more)`}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Best Match of the Season ─── */}
      {stats.bestMatch && (
        <Card sx={{
          mb: 3, background: 'linear-gradient(135deg, #111827 0%, #1a2035 100%)',
          border: '1px solid rgba(255,82,82,0.15)',
          overflow: 'hidden', position: 'relative'
        }}>
          {/* Glow effect */}
          <Box sx={{
            position: 'absolute', top: -50, right: -50,
            width: 150, height: 150, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,82,82,0.08) 0%, transparent 70%)',
          }} />
          <CardContent sx={{ p: { xs: 2, sm: 3 }, position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <WhatshotRoundedIcon sx={{ color: '#ff5252', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>
                Best Match of the Season
              </Typography>
            </Box>

            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: { xs: 2, sm: 4 }, py: { xs: 2, sm: 3 },
              px: { xs: 1.5, sm: 3 },
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(255,82,82,0.06) 0%, rgba(101,31,255,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              {/* Home Team */}
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 18 }, mb: 0.5 }} noWrap>
                  {stats.bestMatch.homeTeam}
                </Typography>
              </Box>

              {/* Score */}
              <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 },
                  px: { xs: 2, sm: 3 }, py: { xs: 1, sm: 1.5 },
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, rgba(0,230,118,0.1), rgba(101,31,255,0.1))',
                  border: '1px solid rgba(0,230,118,0.2)'
                }}>
                  <Typography sx={{
                    fontWeight: 900, fontSize: { xs: 24, sm: 36 },
                    background: 'linear-gradient(135deg, #00e676, #66ffa6)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>
                    {stats.bestMatch.homeScore}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, sm: 20 }, color: 'text.secondary' }}>-</Typography>
                  <Typography sx={{
                    fontWeight: 900, fontSize: { xs: 24, sm: 36 },
                    background: 'linear-gradient(135deg, #651fff, #a255ff)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>
                    {stats.bestMatch.awayScore}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.75, fontWeight: 600 }}>
                  {stats.bestMatch.totalGoals} goals • margin of {stats.bestMatch.margin}
                </Typography>
              </Box>

              {/* Away Team */}
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 18 }, mb: 0.5 }} noWrap>
                  {stats.bestMatch.awayTeam}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
              <Chip
                icon={<EmojiEventsRoundedIcon sx={{ fontSize: 14 }} />}
                label={stats.bestMatch.tournament}
                size="small"
                sx={{ fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ─── Most Goals Scored by a Team ─── */}
      {stats.topScorers.length > 0 && (
        <Card sx={{
          background: 'linear-gradient(135deg, #111827 0%, #1a2035 100%)',
          border: '1px solid rgba(0,230,118,0.15)',
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SportsSoccerRoundedIcon sx={{ color: '#00e676', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 14, sm: 16 } }}>
                Most Goals Scored
              </Typography>
              <Chip label="By Team" size="small"
                sx={{ ml: 'auto', fontSize: 10, fontWeight: 700, bgcolor: 'rgba(0,230,118,0.12)', color: '#00e676' }} />
            </Box>

            <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(0,230,118,0.04)' }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Team</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Goals</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.06)', display: { xs: 'none', sm: 'table-cell' } }}>Matches</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Avg/Match</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scorersToShow.map((team, idx) => (
                    <TableRow key={team.name}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(0,230,118,0.04)' },
                        ...(idx === 0 && { bgcolor: 'rgba(0,230,118,0.06)' })
                      }}>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.25 }}>
                        <Box sx={{
                          width: 22, height: 22, borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                          bgcolor: idx === 0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.06)',
                          color: idx === 0 ? '#00e676' : 'text.secondary'
                        }}>
                          {idx + 1}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {idx === 0 && <StarRoundedIcon sx={{ fontSize: 14, color: '#00e676' }} />}
                          <Typography sx={{ fontWeight: idx === 0 ? 800 : 600, fontSize: { xs: 12, sm: 13 } }}>
                            {team.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.25 }}>
                        <Typography sx={{
                          fontWeight: 800, fontSize: { xs: 13, sm: 14 },
                          color: idx === 0 ? '#00e676' : '#f0f4ff'
                        }}>
                          {team.goals}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.25, display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {team.matches}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)', py: 1.25 }}>
                        <Chip label={team.avgGoals} size="small"
                          sx={{
                            fontSize: 11, fontWeight: 700, height: 20,
                            bgcolor: team.avgGoals >= 2 ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)',
                            color: team.avgGoals >= 2 ? '#00e676' : 'text.secondary'
                          }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {stats.topScorers.length > 5 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  size="small"
                  onClick={() => setShowAllScorers(!showAllScorers)}
                  endIcon={showAllScorers ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                  sx={{
                    fontSize: 12, fontWeight: 700, color: '#00e676',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(0,230,118,0.08)' }
                  }}
                >
                  {showAllScorers ? 'Show Less' : `More Stats (${stats.topScorers.length - 5} more)`}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
