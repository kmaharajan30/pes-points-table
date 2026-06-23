import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Avatar, AvatarGroup, Box, Popover, Typography,
  Divider, Tooltip
} from '@mui/material';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';

const AVATAR_COLORS = [
  '#00e676', '#651fff', '#ff5252', '#ffd740', '#40c4ff',
  '#ff6e40', '#b2ff59', '#e040fb', '#64ffda', '#ff4081',
];

function getColor(name = '') {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ActiveUsers({ user }) {
  const [activeUsers, setActiveUsers] = useState([{ id: user.id, name: user.name }]);
  const [anchorEl, setAnchorEl] = useState(null);
  const controllerRef = useRef(null);
  const retryRef = useRef(null);

  const connectSSE = useCallback(() => {
    // Abort any previous connection
    if (controllerRef.current) controllerRef.current.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    // fetch-based SSE so we can send the x-user-id header (native EventSource doesn't support headers)
    fetch(`http://localhost:5000/api/presence/${encodeURIComponent(user.code)}`, {
      headers: { 'x-user-id': user.id },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const users = JSON.parse(line.slice(6));
                setActiveUsers(users);
              } catch (_) { /* skip malformed */ }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return; // intentional disconnect
        // Retry after 3 seconds on unexpected disconnect
        retryRef.current = setTimeout(connectSSE, 3000);
      });
  }, [user.id, user.code]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connectSSE]);

  const MAX_SHOWN = 3;
  const shown = activeUsers.slice(0, MAX_SHOWN);
  const extra = activeUsers.length - MAX_SHOWN;

  return (
    <>
      {/* Pill button */}
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          cursor: 'pointer',
          px: 1.5, py: 0.75, borderRadius: 99,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          transition: 'all 0.2s',
          userSelect: 'none',
          '&:hover': {
            background: 'rgba(0,230,118,0.07)',
            borderColor: 'rgba(0,230,118,0.25)',
          },
        }}
      >
        {/* Pulsing online dot */}
        <FiberManualRecordRoundedIcon
          sx={{
            fontSize: 9, color: '#00e676',
            '@keyframes onlinePulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.5, transform: 'scale(0.8)' },
            },
            animation: 'onlinePulse 2s ease-in-out infinite',
          }}
        />

        {/* Stacked avatars */}
        <AvatarGroup
          sx={{
            '& .MuiAvatar-root': {
              width: 24, height: 24, fontSize: 9, fontWeight: 800,
              border: '2px solid #0d1220',
              ml: '-6px',
              '&:first-of-type': { ml: 0 },
            },
          }}
        >
          {shown.map(u => (
            <Tooltip key={u.id} title={u.name} arrow placement="bottom">
              <Avatar sx={{ bgcolor: getColor(u.name), color: '#000' }}>
                {getInitials(u.name)}
              </Avatar>
            </Tooltip>
          ))}
          {extra > 0 && (
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#9aa3b8', fontSize: 9 }}>
              +{extra}
            </Avatar>
          )}
        </AvatarGroup>

        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 11 }}>
          {activeUsers.length} online
        </Typography>
      </Box>

      {/* Popover detail panel */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1.5, bgcolor: '#131c2e', minWidth: 230,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          background: 'linear-gradient(135deg, rgba(0,230,118,0.07), rgba(101,31,255,0.07))',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <FiberManualRecordRoundedIcon sx={{ fontSize: 9, color: '#00e676' }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '0.07em' }}>
            {activeUsers.length} ONLINE NOW
          </Typography>
        </Box>

        {/* User list */}
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {activeUsers.map((u) => (
            <Box
              key={u.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1, py: 0.75, borderRadius: 2,
                background: u.id === user.id ? 'rgba(0,230,118,0.06)' : 'transparent',
                border: u.id === user.id ? '1px solid rgba(0,230,118,0.12)' : '1px solid transparent',
              }}
            >
              <Avatar sx={{
                bgcolor: getColor(u.name), color: '#000',
                width: 34, height: 34, fontSize: 13, fontWeight: 800,
                flexShrink: 0,
                boxShadow: `0 0 12px ${getColor(u.name)}44`,
              }}>
                {getInitials(u.name)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {u.name}
                  </Typography>
                  {u.id === user.id && (
                    <Typography variant="caption" sx={{
                      px: 0.75, py: 0.1, borderRadius: 1,
                      bgcolor: 'rgba(0,230,118,0.12)',
                      color: 'primary.main', fontWeight: 700, fontSize: 9,
                      flexShrink: 0,
                    }}>
                      YOU
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FiberManualRecordRoundedIcon sx={{ fontSize: 7, color: '#00e676' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    Active
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{
          px: 2, py: 1,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            All members share the same tournaments &amp; data
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
