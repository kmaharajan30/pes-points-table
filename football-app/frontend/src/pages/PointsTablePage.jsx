import { useState, useEffect } from 'react';
import { Box, Card, Chip, Skeleton, Stack, Typography, Avatar } from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { getTable } from '../api/footballApi';

const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (n='') => { let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (n='') => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

// ── Stat box ──────────────────────────────────────────────────────────────────
function Stat({ label, value, color = 'text.primary', highlight = false }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minWidth: { xs: 28, sm: 36 },
      px: { xs: 0.25, sm: 0.5 },
    }}>
      <Typography sx={{
        fontWeight: 800,
        fontSize: { xs: '0.8rem', sm: '0.9rem' },
        color,
        lineHeight: 1,
        ...(highlight && {
          bgcolor: 'rgba(0,230,118,0.12)',
          border: '1px solid rgba(0,230,118,0.25)',
          borderRadius: 1,
          px: 1, py: 0.25,
          minWidth: 28,
          textAlign: 'center',
        }),
      }}>
        {value}
      </Typography>
    </Box>
  );
}

// ── Rank medal ────────────────────────────────────────────────────────────────
function RankIcon({ rank }) {
  if (rank === 1) return <EmojiEventsRoundedIcon sx={{ color: '#FFD700', fontSize: { xs: 16, sm: 18 } }} />;
  if (rank === 2) return <EmojiEventsRoundedIcon sx={{ color: '#C0C0C0', fontSize: { xs: 16, sm: 18 } }} />;
  if (rank === 3) return <EmojiEventsRoundedIcon sx={{ color: '#CD7F32', fontSize: { xs: 16, sm: 18 } }} />;
  return (
    <Typography sx={{ fontWeight: 800, color: 'text.secondary', fontSize: { xs: 11, sm: 12 },
      width: { xs: 16, sm: 18 }, textAlign: 'center' }}>
      {rank}
    </Typography>
  );
}

// ── Table header row ──────────────────────────────────────────────────────────
function HeaderRow() {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      px: { xs: 1.25, sm: 2 }, py: 0.75,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* rank */}
      <Box sx={{ width: { xs: 20, sm: 24 }, flexShrink: 0 }} />
      {/* club */}
      <Box sx={{ flex: 1, minWidth: 0, ml: { xs: 1, sm: 1.5 } }}>
        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 10, color: 'text.secondary', letterSpacing: '0.08em' }}>
          CLUB
        </Typography>
      </Box>
      {/* stats */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.5 }, flexShrink: 0 }}>
        {['MP','W','D','L','GD','PTS'].map(h => (
          <Typography key={h} sx={{
            fontWeight: 800, fontSize: 10,
            color: h === 'PTS' ? 'primary.main' : 'text.secondary',
            minWidth: { xs: 28, sm: 36 },
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}>
            {h}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

// ── Single team row ───────────────────────────────────────────────────────────
function TeamRow({ row, rank, isLast }) {
  const color    = getColor(row.name);
  const isLeader = rank === 1 && row.mp > 0;
  const gdColor  = row.gd > 0 ? 'primary.main' : row.gd < 0 ? 'error.main' : 'text.secondary';
  const gdLabel  = row.gd > 0 ? `+${row.gd}` : String(row.gd);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      px: { xs: 1.25, sm: 2 },
      py: { xs: 1, sm: 1.25 },
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      background: isLeader
        ? 'linear-gradient(90deg, rgba(0,230,118,0.07) 0%, transparent 60%)'
        : 'transparent',
      borderLeft: isLeader ? '3px solid #00e676' : '3px solid transparent',
      transition: 'background 0.15s',
      '&:hover': { background: 'rgba(255,255,255,0.025)' },
    }}>
      {/* Rank */}
      <Box sx={{ width: { xs: 20, sm: 24 }, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <RankIcon rank={rank} />
      </Box>

      {/* Club */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 },
        flex: 1, minWidth: 0, ml: { xs: 0.75, sm: 1.5 } }}>
        <Avatar sx={{
          bgcolor: color, color: '#000', fontWeight: 800,
          fontSize: { xs: 9, sm: 11 },
          width: { xs: 26, sm: 30 }, height: { xs: 26, sm: 30 },
          flexShrink: 0,
          boxShadow: `0 2px 8px ${color}55`,
        }}>
          {getInit(row.name)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 700,
            fontSize: { xs: '0.72rem', sm: '0.82rem' },
            lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {row.name}
          </Typography>
          {/* mobile: show W-D-L inline under name */}
          <Typography sx={{
            display: { xs: 'block', sm: 'none' },
            fontSize: 9, color: 'text.secondary', fontWeight: 600,
          }}>
            {row.w}W · {row.d}D · {row.l}L
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.5 }, flexShrink: 0 }}>
        <Stat label="MP" value={row.mp} />
        {/* W D L hidden on xs — shown in name subtitle instead */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
          <Stat label="W" value={row.w} color={row.w > 0 ? 'primary.main' : 'text.secondary'} />
          <Stat label="D" value={row.d} color={row.d > 0 ? 'warning.main' : 'text.secondary'} />
          <Stat label="L" value={row.l} color={row.l > 0 ? 'error.main' : 'text.secondary'} />
        </Box>
        <Stat label="GD" value={gdLabel} color={gdColor} />
        <Stat label="PTS" value={row.pts} color={row.pts > 0 ? 'primary.main' : 'text.secondary'} highlight={row.pts > 0} />
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PointsTablePage({ tournament }) {
  const [table,   setTable]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const r = await getTable(tournament.id); setTable(r.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [tournament.id]);

  const leader = table[0];

  return (
    <Box>
      <PageHeader
        icon="📊"
        title="Table"
        subtitle={`${tournament.name} · Live standings`}
        action={leader?.mp > 0 ? (
          <Chip
            icon={<TrendingUpRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label={leader.name}
            size="small"
            sx={{
              bgcolor: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
              fontWeight: 700, color: 'primary.main',
              fontSize: { xs: 10, sm: 11 }, height: 24,
              maxWidth: { xs: 130, sm: 200 },
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        ) : null}
      />

      {loading ? (
        <Stack spacing={1}>
          {[1,2,3,4].map(n => (
            <Skeleton key={n} variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : table.length === 0 ? (
        <EmptyState icon="📊" title="No standings yet"
          subtitle="Add teams and play fixtures to see the table" />
      ) : (
        <Card sx={{
          background: 'linear-gradient(160deg, #111827 0%, #131d2e 100%)',
          borderRadius: { xs: 2, sm: 3 },
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <HeaderRow />
          {table.map((row, idx) => (
            <TeamRow
              key={row.teamId}
              row={row}
              rank={idx + 1}
              isLast={idx === table.length - 1}
            />
          ))}

          {/* Legend — only visible sm+ */}
          <Box sx={{
            display: { xs: 'none', sm: 'flex' },
            px: 2, py: 1,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            gap: 2.5, flexWrap: 'wrap',
          }}>
            {[['MP','Played'],['W','Won'],['D','Drawn'],['L','Lost'],['GD','Goal Diff'],['PTS','Points']].map(([k,v]) => (
              <Typography key={k} variant="caption"
                sx={{ color: 'text.secondary', opacity: 0.5, fontSize: 9 }}>
                {k} · {v}
              </Typography>
            ))}
          </Box>
        </Card>
      )}
    </Box>
  );
}
