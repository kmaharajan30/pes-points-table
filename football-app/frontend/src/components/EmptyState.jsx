import { Box, Typography } from '@mui/material';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <Box sx={{
      textAlign: 'center', py: 8, px: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
    }}>
      <Box sx={{ fontSize: 56, opacity: 0.3 }}>{icon}</Box>
      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>{subtitle}</Typography>}
    </Box>
  );
}
