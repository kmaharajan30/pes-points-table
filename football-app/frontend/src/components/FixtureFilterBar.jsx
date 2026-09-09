import { useState } from 'react';
import {
  Box, Chip, TextField, Typography, Autocomplete,
  ToggleButton, ToggleButtonGroup, Tooltip, Drawer, IconButton,
  Badge, Button, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

// ── Shared team badge (kept local so the bar is self-contained) ───────────────
const COLORS = ['#00e676','#651fff','#ff5252','#ffd740','#40c4ff','#ff6e40','#b2ff59','#e040fb','#64ffda','#ff4081'];
const getColor = (name='') => { let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; };
const getInit  = (name='') => name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

function TeamDot({ name='', size=22 }) {
  return (
    <Box sx={{ width:size, height:size, borderRadius:'50%', bgcolor:getColor(name), color:'#000',
      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:size*0.35, flexShrink:0 }}>
      {getInit(name)}
    </Box>
  );
}

const CONTROL_H = 38;

// ── Reusable segmented toggle (pill track) ────────────────────────────────────
function Segmented({ value, onChange, options, accent, fullWidth = false, size = 'sm' }) {
  const h = size === 'lg' ? 44 : CONTROL_H;
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, v) => v != null && onChange?.(v)}
      sx={{
        height: h,
        width: fullWidth ? '100%' : 'auto',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 2.5,
        p: 0.5,
        gap: 0.5,
        '& .MuiToggleButtonGroup-grouped': { border: 0, borderRadius: '10px !important', mx: 0, flex: fullWidth ? 1 : 'initial' },
        '& .MuiToggleButton-root': {
          px: size === 'lg' ? 1 : 1.5,
          py: 0,
          height: h - 8,
          fontSize: size === 'lg' ? 13 : 12,
          fontWeight: 700,
          textTransform: 'none',
          color: 'text.secondary',
          lineHeight: 1,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          '&.Mui-selected': {
            bgcolor: accent.bg,
            color: accent.fg,
            boxShadow: `0 0 0 1px ${accent.ring} inset`,
            '&:hover': { bgcolor: accent.bgHover },
          },
        },
      }}
    >
      {options.map(o => <ToggleButton key={String(o.value)} value={o.value}>{o.label}</ToggleButton>)}
    </ToggleButtonGroup>
  );
}

const STATUS_ACCENT = { bg:'rgba(0,230,118,0.16)', fg:'primary.main', bgHover:'rgba(0,230,118,0.24)', ring:'rgba(0,230,118,0.35)' };
const LEG_ACCENT    = { bg:'rgba(101,31,255,0.22)', fg:'#b39dff', bgHover:'rgba(101,31,255,0.3)', ring:'rgba(101,31,255,0.4)' };

/**
 * Reusable filter bar for fixtures across all tournament types.
 * Desktop: clean inline panel. Mobile: slim trigger + bottom-sheet.
 */
export default function FixtureFilterBar({
  teams = [],
  filterTeam = null,
  onTeamChange,
  statusFilter = 'all',
  onStatusChange,
  showStatus = true,
  legFilter = 'all',
  onLegChange,
  showLeg = false,
  shownCount = 0,
  onClear,
  copyText = '',
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = copyText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const isFiltering = !!filterTeam
    || (showStatus && statusFilter !== 'all')
    || (showLeg && legFilter !== 'all');
  const activeCount = (filterTeam ? 1 : 0)
    + (showStatus && statusFilter !== 'all' ? 1 : 0)
    + (showLeg && legFilter !== 'all' ? 1 : 0);
  const showCopy = showStatus && statusFilter === 'pending' && shownCount > 0 && !!copyText;

  // ── Search field (shared) ───────────────────────────────────────────────────
  const searchField = (
    <Autocomplete
      size="small"
      options={teams}
      value={filterTeam}
      onChange={(_, v) => onTeamChange?.(v)}
      getOptionLabel={(t) => t?.name || ''}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      sx={{
        flex: 1,
        minWidth: 0,
        '& .MuiOutlinedInput-root': {
          height: CONTROL_H,
          borderRadius: 2.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
          '&.Mui-focused fieldset': { borderColor: 'primary.main' },
        },
      }}
      renderInput={(params) => {
        const inputSlot = params.slotProps?.input || {};
        return (
          <TextField
            {...params}
            placeholder="Search team…"
            slotProps={{
              ...params.slotProps,
              input: {
                ...inputSlot,
                startAdornment: (
                  <>
                    <FilterListRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.75 }} />
                    {inputSlot.startAdornment}
                  </>
                ),
              },
            }}
          />
        );
      }}
      renderOption={(props, t) => (
        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <TeamDot name={t.name} size={22} />
          <Typography variant="body2">{t.name}</Typography>
        </Box>
      )}
    />
  );

  const copyChip = showCopy && (
    <Tooltip title={copied ? 'Copied!' : 'Copy pending matches'} arrow>
      <Chip
        icon={copied
          ? <CheckRoundedIcon sx={{ fontSize: '16px !important' }} />
          : <ContentCopyRoundedIcon sx={{ fontSize: '15px !important' }} />}
        label={copied ? 'Copied' : `Copy ${shownCount}`}
        onClick={handleCopy}
        sx={{
          height: CONTROL_H - 8,
          fontWeight: 700,
          fontSize: 12,
          borderRadius: 2,
          transition: 'all 0.15s',
          bgcolor: copied ? 'rgba(0,230,118,0.16)' : 'rgba(64,196,255,0.12)',
          color: copied ? 'primary.main' : '#40c4ff',
          border: `1px solid ${copied ? 'rgba(0,230,118,0.3)' : 'rgba(64,196,255,0.28)'}`,
          '& .MuiChip-icon': { color: 'inherit' },
          '&:hover': { bgcolor: copied ? 'rgba(0,230,118,0.22)' : 'rgba(64,196,255,0.2)' },
        }}
      />
    </Tooltip>
  );

  // ── DESKTOP: inline panel ─────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <Box sx={{
        display: 'flex', gap: 1.25, mb: 2.5, alignItems: 'center', flexWrap: 'wrap',
        p: 1, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Box sx={{ display: 'flex', flex: '1 1 220px', minWidth: 220 }}>{searchField}</Box>

        {showStatus && (
          <Segmented
            value={statusFilter} onChange={onStatusChange} accent={STATUS_ACCENT}
            options={[{ value:'all', label:'All' }, { value:'pending', label:'Pending' }, { value:'played', label:'Played' }]}
          />
        )}
        {showLeg && (
          <Segmented
            value={legFilter} onChange={onLegChange} accent={LEG_ACCENT}
            options={[{ value:'all', label:'All Legs' }, { value:1, label:'Leg 1' }, { value:2, label:'Leg 2' }]}
          />
        )}

        {copyChip}

        {isFiltering && (
          <Chip
            icon={<ClearRoundedIcon sx={{ fontSize: '16px !important' }} />}
            label={`${shownCount} shown · Clear`}
            onClick={onClear}
            sx={{
              ml: showCopy ? 0 : 'auto',
              height: CONTROL_H - 8, fontWeight: 700, fontSize: 12, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary',
              '& .MuiChip-icon': { color: 'inherit' },
              '&:hover': { bgcolor: 'rgba(255,82,82,0.14)', color: 'error.main' },
            }}
          />
        )}
      </Box>
    );
  }

  // ── MOBILE: slim trigger row + bottom sheet ─────────────────────────────────
  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        {searchField}
        <Badge
          color="primary"
          badgeContent={activeCount}
          invisible={activeCount === 0}
          sx={{ '& .MuiBadge-badge': { fontWeight: 800, fontSize: 10, minWidth: 16, height: 16 } }}
        >
          <IconButton
            onClick={() => setSheetOpen(true)}
            sx={{
              width: CONTROL_H, height: CONTROL_H, borderRadius: 2.5,
              bgcolor: isFiltering ? 'rgba(0,230,118,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isFiltering ? 'rgba(0,230,118,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: isFiltering ? 'primary.main' : 'text.secondary',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Badge>
      </Box>

      <Drawer
        anchor="bottom"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            background: 'linear-gradient(180deg,#151e2e,#0f1521)',
            border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none',
            px: 2.5, pt: 1, pb: 3,
          },
        }}
      >
        {/* Grab handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.18)' }} />
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TuneRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>Filters</Typography>
          {isFiltering && (
            <Button
              size="small" onClick={onClear}
              startIcon={<ClearRoundedIcon sx={{ fontSize: '16px !important' }} />}
              sx={{ color: 'error.main', fontWeight: 700, fontSize: 12, textTransform: 'none' }}
            >
              Reset
            </Button>
          )}
          <IconButton size="small" onClick={() => setSheetOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Status */}
        {showStatus && (
          <Box sx={{ mb: 2.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', display: 'block', mb: 1, fontSize: 10 }}>
              STATUS
            </Typography>
            <Segmented
              size="lg" fullWidth value={statusFilter} onChange={onStatusChange} accent={STATUS_ACCENT}
              options={[{ value:'all', label:'All' }, { value:'pending', label:'Pending' }, { value:'played', label:'Played' }]}
            />
          </Box>
        )}

        {/* Leg */}
        {showLeg && (
          <Box sx={{ mb: 2.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', display: 'block', mb: 1, fontSize: 10 }}>
              LEG
            </Typography>
            <Segmented
              size="lg" fullWidth value={legFilter} onChange={onLegChange} accent={LEG_ACCENT}
              options={[{ value:'all', label:'All Legs' }, { value:1, label:'Leg 1' }, { value:2, label:'Leg 2' }]}
            />
          </Box>
        )}

        {/* Copy pending */}
        {showCopy && (
          <Button
            fullWidth
            onClick={handleCopy}
            startIcon={copied
              ? <CheckRoundedIcon />
              : <ContentCopyRoundedIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              mb: 2, height: 44, borderRadius: 2.5, fontWeight: 800, textTransform: 'none', fontSize: 13,
              transition: 'all 0.15s',
              bgcolor: copied ? 'rgba(0,230,118,0.16)' : 'rgba(64,196,255,0.12)',
              color: copied ? 'primary.main' : '#40c4ff',
              border: `1px solid ${copied ? 'rgba(0,230,118,0.3)' : 'rgba(64,196,255,0.28)'}`,
              '&:hover': { bgcolor: copied ? 'rgba(0,230,118,0.22)' : 'rgba(64,196,255,0.2)' },
            }}
          >
            {copied ? 'Copied to clipboard' : `Copy ${shownCount} pending match${shownCount !== 1 ? 'es' : ''}`}
          </Button>
        )}

        {/* Apply / show count */}
        <Button
          fullWidth variant="contained"
          onClick={() => setSheetOpen(false)}
          sx={{
            height: 46, borderRadius: 2.5, fontWeight: 800, textTransform: 'none', fontSize: 14,
            background: 'linear-gradient(135deg,#00e676,#00b248)', color: '#000',
          }}
        >
          Show {shownCount} match{shownCount !== 1 ? 'es' : ''}
        </Button>
      </Drawer>
    </>
  );
}
