import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Chip, ClickAwayListener, Grow, Paper, Popper
} from '@mui/material';
import { keyframes } from '@mui/material/styles';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { getSeasons } from '../api/footballApi';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/**
 * SeasonFilter – a neat dropdown to pick Overall / Season N.
 *
 * Props:
 *  - value        : current season number or 'overall'
 *  - onChange(val) : called with season number (int) or 'overall'
 *  - accentColor  : primary accent color (default '#ffd700')
 */
export default function SeasonFilter({ value, onChange, accentColor = '#ffd700' }) {
  const [seasons, setSeasons] = useState([]);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getSeasons();
        setSeasons(r.data);
        // On first load, default to the active season
        if (!initializedRef.current) {
          initializedRef.current = true;
          const active = r.data.find(s => s.status === 'active');
          if (active) {
            onChange(active.seasonNumber);
          } else if (value === null || value === undefined) {
            onChange('overall');
          }
        }
      } catch (_) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve display value — treat null as 'overall' for display
  const resolvedValue = value ?? 'overall';

  const selectedLabel =
    resolvedValue === 'overall'
      ? 'Overall'
      : seasons.find(s => s.seasonNumber === resolvedValue)
        ? `Season ${resolvedValue}`
        : 'Overall';

  const activeSeason = seasons.find(s => s.status === 'active');
  const isActiveSeason = activeSeason && resolvedValue === activeSeason.seasonNumber;

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger */}
      <Box
        ref={anchorRef}
        onClick={() => setOpen(prev => !prev)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          px: 1.5, py: 0.6,
          borderRadius: 2.5, cursor: 'pointer',
          background: open
            ? `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? `${accentColor}40` : 'rgba(255,255,255,0.08)'}`,
          transition: 'all 0.2s ease',
          '&:hover': {
            background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}06)`,
            borderColor: `${accentColor}30`,
          },
        }}
      >
        <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: accentColor, opacity: 0.8 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
          {selectedLabel}
        </Typography>
        {isActiveSeason && (
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%',
            bgcolor: '#00e676',
            boxShadow: '0 0 6px rgba(0,230,118,0.6)',
          }} />
        )}
        <KeyboardArrowDownRoundedIcon
          sx={{
            fontSize: 16, color: accentColor, opacity: 0.6,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </Box>

      {/* Dropdown */}
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        transition
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: 'top left' }}>
            <Paper>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{
                  mt: 0.75, py: 0.75, minWidth: 180, maxHeight: 280, overflowY: 'auto',
                  borderRadius: 2.5,
                  background: 'linear-gradient(160deg, #141b2d, #111827)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                  animation: `${fadeIn} 0.15s ease`,
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}>
                  {/* Overall option */}
                  <DropdownItem
                    label="Overall"
                    sublabel="All seasons"
                    selected={resolvedValue === 'overall'}
                    accentColor={accentColor}
                    onClick={() => handleSelect('overall')}
                  />

                  {/* Divider */}
                  {seasons.length > 0 && (
                    <Box sx={{
                      mx: 1.5, my: 0.5,
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }} />
                  )}

                  {/* Season items */}
                  {[...seasons].reverse().map(s => {
                    const isActive = s.status === 'active';
                    return (
                      <DropdownItem
                        key={s.seasonNumber}
                        label={`Season ${s.seasonNumber}`}
                        sublabel={
                          isActive
                            ? `${s.tournamentCount} tournaments · Active`
                            : `${s.tournamentCount} tournaments`
                        }
                        selected={resolvedValue === s.seasonNumber}
                        accentColor={accentColor}
                        isActive={isActive}
                        isLocked={!isActive}
                        onClick={() => handleSelect(s.seasonNumber)}
                      />
                    );
                  })}

                  {seasons.length === 0 && (
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        No seasons available
                      </Typography>
                    </Box>
                  )}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </Box>
  );
}

function DropdownItem({ label, sublabel, selected, accentColor, isActive, isLocked, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 2, py: 1, mx: 0.5, borderRadius: 1.5,
        cursor: 'pointer', transition: 'all 0.15s ease',
        background: selected
          ? `linear-gradient(90deg, ${accentColor}15, ${accentColor}08)`
          : 'transparent',
        '&:hover': {
          background: selected
            ? `linear-gradient(90deg, ${accentColor}20, ${accentColor}10)`
            : 'rgba(255,255,255,0.04)',
        },
      }}
    >
      {/* Left indicator */}
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        bgcolor: selected
          ? accentColor
          : isActive
          ? '#00e676'
          : 'rgba(255,255,255,0.12)',
        ...(isActive && !selected ? { boxShadow: '0 0 6px rgba(0,230,118,0.5)' } : {}),
      }} />

      {/* Text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{
            fontSize: 12, fontWeight: selected ? 700 : 600,
            color: selected ? accentColor : '#f0f4ff',
          }}>
            {label}
          </Typography>
          {isActive && (
            <Chip
              label="Live"
              size="small"
              sx={{
                height: 16, fontSize: 8, fontWeight: 800,
                bgcolor: 'rgba(0,230,118,0.15)', color: '#00e676',
                letterSpacing: 0.5,
              }}
            />
          )}
          {isLocked && (
            <LockRoundedIcon sx={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }} />
          )}
        </Box>
        {sublabel && (
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.1 }}>
            {sublabel}
          </Typography>
        )}
      </Box>

      {/* Check mark */}
      {selected && (
        <CheckRoundedIcon sx={{ fontSize: 15, color: accentColor, flexShrink: 0 }} />
      )}
    </Box>
  );
}
