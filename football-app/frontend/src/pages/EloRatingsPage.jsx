import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Stack, Skeleton,
  Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  useMediaQuery, Button, Collapse
} from '@mui/material';
import { useTheme, keyframes } from '@mui/material/styles';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import PageHeader from '../components/PageHeader';
import SeasonFilter from '../components/SeasonFilter';
import { getEloRatings } from '../api/footballApi';

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
`;

const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

function EloBar({ elo, max }) {
  const pct = Math.max(0, Math.min(100, ((elo - 1000) / (max - 1000)) * 100));
  return (
    <Box sx={{ position:'relative', height:6, borderRadius:3, bgcolor:'rgba(255,255,255,0.06)', width:'100%', overflow:'hidden' }}>
      <Box sx={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:3,
        width:`${pct}%`, background:'linear-gradient(90deg, #00e676, #651fff)', transition:'width 0.5s ease' }} />
    </Box>
  );
}

export default function EloRatingsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState(null);

  const loadRatings = async (season) => {
    setLoading(true);
    try {
      const res = await getEloRatings(season === 'overall' ? undefined : season);
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (seasonFilter !== null) loadRatings(seasonFilter);
  }, [seasonFilter]);

  const handleSeasonChange = (val) => {
    setSeasonFilter(val);
    setShowAll(false);
    setExpandedTeam(null);
  };

  if (loading) {
    return (
      <Box>
        <PageHeader icon={<BoltRoundedIcon />} title="Power Ratings" subtitle="ELO-based team rankings"
          action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ff9800" />} />
        <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          {[1,2,3,4,5].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ bgcolor:'rgba(255,255,255,0.05)', borderRadius:2 }} />)}
        </Box>
      </Box>
    );
  }

  if (!data || data.ratings.length === 0) {
    return (
      <Box>
        <PageHeader icon={<BoltRoundedIcon />} title="Power Ratings" subtitle="ELO-based team rankings"
          action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ff9800" />} />
        <Box sx={{ textAlign:'center', py:8 }}>
          <Typography sx={{ fontSize:48, mb:2 }}>⚡</Typography>
          <Typography variant="h6" sx={{ fontWeight:700, mb:1 }}>No Ratings Yet</Typography>
          <Typography color="text.secondary" sx={{ fontSize:13 }}>Play tournament matches to generate ELO power ratings</Typography>
        </Box>
      </Box>
    );
  }

  const maxElo = Math.max(...data.ratings.map(r => r.elo));
  const displayRatings = showAll ? data.ratings : data.ratings.slice(0, 10);

  const subtitleLabel = seasonFilter === 'overall'
    ? `${data.ratings.length} teams ranked by ELO`
    : `Season ${seasonFilter} · ${data.ratings.length} teams ranked`;

  return (
    <Box>
      <PageHeader icon={<BoltRoundedIcon />} title="Power Ratings"
        subtitle={subtitleLabel}
        action={<SeasonFilter value={seasonFilter} onChange={handleSeasonChange} accentColor="#ff9800" />} />

      {/* Top 3 Podium */}
      {data.ratings.length >= 3 && (
        <Box sx={{ display:'flex', justifyContent:'center', gap:{ xs:1.5, sm:2.5 }, mb:3,
          flexDirection:{ xs:'column', sm:'row' }, alignItems:{ xs:'stretch', sm:'flex-end' } }}>
          {/* 2nd */}
          <Box sx={{ order:{ xs:2, sm:1 }, flex:'0 1 180px' }}>
            <Card sx={{ p:1.5, textAlign:'center', background:'linear-gradient(160deg, rgba(192,192,192,0.08), rgba(107,114,128,0.04))',
              border:'1px solid rgba(192,192,192,0.2)' }}>
              <Typography sx={{ fontSize:10, color:'text.secondary', fontWeight:700 }}>2nd</Typography>
              <Avatar sx={{ width:36, height:36, fontSize:12, fontWeight:800, bgcolor:getColor(data.ratings[1].name), mx:'auto', my:0.75 }}>
                {getInit(data.ratings[1].name)}
              </Avatar>
              <Typography sx={{ fontWeight:800, fontSize:12, mb:0.5 }} noWrap>{data.ratings[1].name}</Typography>
              <Typography sx={{ fontWeight:900, fontSize:18, color:'#c0c0c0' }}>{data.ratings[1].elo}</Typography>
              <ChangeChip change={data.ratings[1].lastChange} />
            </Card>
          </Box>
          {/* 1st */}
          <Box sx={{ order:{ xs:1, sm:2 }, flex:'0 1 200px' }}>
            <Card sx={{ p:2, textAlign:'center',
              background:'linear-gradient(160deg, rgba(255,215,0,0.12), rgba(255,160,0,0.06))',
              border:'1.5px solid rgba(255,215,0,0.3)', animation:`${pulse} 3s ease-in-out infinite` }}>
              <Typography sx={{ fontSize:20, mb:0.25 }}>👑</Typography>
              <Avatar sx={{ width:44, height:44, fontSize:14, fontWeight:800, bgcolor:getColor(data.ratings[0].name), mx:'auto', my:0.75 }}>
                {getInit(data.ratings[0].name)}
              </Avatar>
              <Typography sx={{ fontWeight:900, fontSize:14,
                background:'linear-gradient(180deg, #fff8dc, #ffd700)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                mb:0.5 }} noWrap>{data.ratings[0].name}</Typography>
              <Typography sx={{ fontWeight:900, fontSize:22, color:'#ffd700' }}>{data.ratings[0].elo}</Typography>
              <ChangeChip change={data.ratings[0].lastChange} />
            </Card>
          </Box>
          {/* 3rd */}
          <Box sx={{ order:3, flex:'0 1 170px' }}>
            <Card sx={{ p:1.5, textAlign:'center', background:'linear-gradient(160deg, rgba(205,127,50,0.08), rgba(139,69,19,0.03))',
              border:'1px solid rgba(205,127,50,0.2)' }}>
              <Typography sx={{ fontSize:10, color:'text.secondary', fontWeight:700 }}>3rd</Typography>
              <Avatar sx={{ width:32, height:32, fontSize:11, fontWeight:800, bgcolor:getColor(data.ratings[2].name), mx:'auto', my:0.75 }}>
                {getInit(data.ratings[2].name)}
              </Avatar>
              <Typography sx={{ fontWeight:700, fontSize:12, mb:0.5 }} noWrap>{data.ratings[2].name}</Typography>
              <Typography sx={{ fontWeight:900, fontSize:16, color:'#CD7F32' }}>{data.ratings[2].elo}</Typography>
              <ChangeChip change={data.ratings[2].lastChange} />
            </Card>
          </Box>
        </Box>
      )}

      {/* Full Table */}
      <Card sx={{ background:'linear-gradient(135deg, #111827, #1a2035)', border:'1px solid rgba(0,230,118,0.12)' }}>
        <CardContent sx={{ p:{ xs:1.5, sm:2.5 } }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor:'rgba(0,230,118,0.04)' }}>
                  <TableCell sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)', width:30 }}>#</TableCell>
                  <TableCell sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>Team</TableCell>
                  <TableCell align="center" sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>ELO</TableCell>
                  <TableCell align="center" sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)', display:{ xs:'none', sm:'table-cell' } }}>Peak</TableCell>
                  <TableCell align="center" sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>Change</TableCell>
                  <TableCell sx={{ fontWeight:800, fontSize:10, color:'text.secondary', borderBottom:'1px solid rgba(255,255,255,0.06)', display:{ xs:'none', md:'table-cell' }, width:'20%' }}>Rating</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRatings.map((r, idx) => (
                  <TableRow key={r.name}
                    onClick={() => setExpandedTeam(expandedTeam === r.name ? null : r.name)}
                    sx={{ cursor:'pointer', '&:hover':{ bgcolor:'rgba(0,230,118,0.04)' },
                      ...(idx < 3 && { bgcolor:'rgba(0,230,118,0.03)' }) }}>
                    <TableCell sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25 }}>
                      <Box sx={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:800,
                        bgcolor: idx===0 ? 'rgba(255,215,0,0.2)' : idx===1 ? 'rgba(192,192,192,0.15)' : idx===2 ? 'rgba(205,127,50,0.15)' : 'rgba(255,255,255,0.06)',
                        color: idx===0 ? '#ffd700' : idx===1 ? '#c0c0c0' : idx===2 ? '#CD7F32' : 'text.secondary' }}>
                        {idx + 1}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25 }}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        <Avatar sx={{ width:24, height:24, fontSize:9, fontWeight:800, bgcolor:getColor(r.name) }}>
                          {getInit(r.name)}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight:700, fontSize:12 }} noWrap>{r.name}</Typography>
                          <Typography sx={{ fontSize:9, color:'text.secondary' }}>{r.matches} matches</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25 }}>
                      <Typography sx={{ fontWeight:900, fontSize:14, color: r.elo >= 1200 ? '#00e676' : '#ff5252' }}>
                        {r.elo}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25, display:{ xs:'none', sm:'table-cell' } }}>
                      <Typography sx={{ fontSize:11, color:'text.secondary', fontWeight:600 }}>{r.peak}</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25 }}>
                      <ChangeChip change={r.lastChange} />
                    </TableCell>
                    <TableCell sx={{ borderBottom:'1px solid rgba(255,255,255,0.04)', py:1.25, display:{ xs:'none', md:'table-cell' } }}>
                      <EloBar elo={r.elo} max={maxElo} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {data.ratings.length > 10 && (
            <Box sx={{ display:'flex', justifyContent:'center', mt:2 }}>
              <Button size="small" onClick={() => setShowAll(!showAll)}
                endIcon={showAll ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                sx={{ fontSize:12, fontWeight:700, color:'#00e676', textTransform:'none', '&:hover':{ bgcolor:'rgba(0,230,118,0.08)' } }}>
                {showAll ? 'Show Less' : `Show All (${data.ratings.length - 10} more)`}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* How ELO Works */}
      <Card sx={{ mt:2.5, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
        <CardContent sx={{ p:2 }}>
          <Typography variant="caption" sx={{ fontWeight:700, color:'text.secondary', display:'block', mb:1 }}>
            How Power Ratings Work
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>
              • Every team starts at 1200 ELO. Winning gains points, losing drops points.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>
              • Beating a higher-rated team gives more points. Losing to a lower-rated team costs more.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>
              • Bigger goal margins = bigger rating changes. Knockout matches count 30% more.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function ChangeChip({ change }) {
  if (change === 0) return <Chip label="±0" size="small" sx={{ fontSize:10, fontWeight:700, height:20, bgcolor:'rgba(255,255,255,0.05)' }} />;
  const isPositive = change > 0;
  return (
    <Chip
      icon={isPositive ? <TrendingUpRoundedIcon sx={{ fontSize:'12px !important' }} /> : <TrendingDownRoundedIcon sx={{ fontSize:'12px !important' }} />}
      label={`${isPositive ? '+' : ''}${change}`}
      size="small"
      sx={{
        fontSize:10, fontWeight:700, height:20,
        bgcolor: isPositive ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)',
        color: isPositive ? '#00e676' : '#ff5252',
        '& .MuiChip-icon': { color: isPositive ? '#00e676' : '#ff5252' }
      }}
    />
  );
}
