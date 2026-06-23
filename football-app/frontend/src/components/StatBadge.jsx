import { Box, Typography } from '@mui/material';

export default function StatBadge({ label, value, color = 'text.primary' }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 40 }}>
      <Typography variant="body2" sx={{ fontWeight: 800, color, fontSize: '0.95rem' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
    </Box>
  );
}
