import { useState } from 'react';
import {
  Box, Button, Card, CardContent, CircularProgress,
  IconButton, InputAdornment, TextField, Typography, Alert, Divider
} from '@mui/material';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { login } from '../api/footballApi';

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ name: '', code: '' });
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    if (form.code.trim().length < 4) {
      setError('Code must be at least 4 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await login({ name: form.name.trim(), code: form.code.trim() });
      localStorage.setItem('fp_user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      p: 2,
      // Animated background
      background: 'radial-gradient(ellipse at 20% 50%, rgba(0,230,118,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(101,31,255,0.08) 0%, transparent 60%), #0a0e1a',
    }}>
      {/* Decorative blobs */}
      <Box sx={{
        position: 'fixed', top: '10%', left: '5%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,230,118,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'fixed', bottom: '15%', right: '8%',
        width: 250, height: 250, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(101,31,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Box sx={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: 4,
            background: 'linear-gradient(135deg, #00e676 0%, #651fff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
            boxShadow: '0 8px 32px rgba(0,230,118,0.35)',
          }}>
            <SportsSoccerRoundedIcon sx={{ color: '#fff', fontSize: 38 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.5px' }}>
            FootballPro
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Points System & Tournament Manager
          </Typography>
        </Box>

        {/* Card */}
        <Card sx={{
          background: 'linear-gradient(135deg, #111827 0%, #161f30 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Welcome back 👋
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your name and code to access your tournaments
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate autoComplete="off">
              {/* hidden inputs trick Chrome into not showing the save-password prompt */}
              <input type="text" name="username" style={{ display:'none' }} readOnly tabIndex={-1} />
              <input type="password" name="password" style={{ display:'none' }} readOnly tabIndex={-1} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Your Name"
                  fullWidth
                  autoFocus
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  inputProps={{ autoComplete: 'new-password' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="e.g. Maharajan"
                />

                <TextField
                  label="Your Code"
                  fullWidth
                  type={showCode ? 'text' : 'password'}
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  inputProps={{ minLength: 4, autoComplete: 'new-password' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowCode(v => !v)} edge="end" size="small">
                          {showCode
                            ? <VisibilityOffRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            : <VisibilityRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          }
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  placeholder="Min 4 characters"
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading || !form.name.trim() || !form.code.trim()}
                  sx={{
                    mt: 0.5,
                    height: 50,
                    background: 'linear-gradient(135deg, #00e676 0%, #00b248 100%)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '1rem',
                    borderRadius: 2.5,
                    boxShadow: '0 4px 20px rgba(0,230,118,0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #00ff85 0%, #00c853 100%)',
                      boxShadow: '0 6px 28px rgba(0,230,118,0.45)',
                    },
                    '&:disabled': { opacity: 0.5 },
                  }}
                >
                  {loading ? <CircularProgress size={22} sx={{ color: '#000' }} /> : 'Enter App →'}
                </Button>
              </Box>
            </form>

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.07)' }} />

            {/* How it works */}
            <Box sx={{
              p: 2, borderRadius: 2,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
                HOW IT WORKS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                {[
                  { icon: '🆕', text: 'New code → creates a new group' },
                  { icon: '👥', text: 'Same code → join the same group' },
                  { icon: '🔗', text: 'Share your code with friends' },
                  { icon: '💾', text: 'All data saved to database' },
                ].map(item => (
                  <Box key={item.text} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 14 }}>{item.icon}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.text}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3, opacity: 0.5 }}>
          FootballPro v1.0.0 · Your data is private to your code
        </Typography>
      </Box>
    </Box>
  );
}
