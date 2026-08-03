import { useState } from 'react';
import {
  Box, Button, Card, CardContent, CircularProgress,
  InputAdornment, TextField, Typography, Alert, Divider,
  ToggleButton, ToggleButtonGroup, Tab, Tabs
} from '@mui/material';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import { adminCreate, adminLogin } from '../api/footballApi';

export default function AdminLoginPage({ onLogin }) {
  const [tab, setTab] = useState(0); // 0 = login, 1 = create
  const [form, setForm] = useState({ name: '', code: '', adminKey: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminLogin({ name: form.name.trim(), code: form.code.trim() });
      localStorage.setItem('fp_user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid admin credentials');
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.adminKey.trim()) return;
    if (form.code.trim().length < 4) { setError('Code must be at least 4 characters'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminCreate({ name: form.name.trim(), code: form.code.trim(), adminKey: form.adminKey.trim() });
      setSuccess('Admin account created! You can now login.');
      localStorage.setItem('fp_user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create admin');
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
      background: 'radial-gradient(ellipse at 20% 50%, rgba(255,82,82,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,215,0,0.08) 0%, transparent 60%), #0a0e1a',
    }}>
      <Box sx={{
        position: 'fixed', top: '10%', left: '5%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,82,82,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'fixed', bottom: '15%', right: '8%',
        width: 250, height: 250, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Box sx={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: 4,
            background: 'linear-gradient(135deg, #ff5252 0%, #ffd700 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
            boxShadow: '0 8px 32px rgba(255,82,82,0.35)',
          }}>
            <AdminPanelSettingsRoundedIcon sx={{ color: '#fff', fontSize: 38 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.5px' }}>
            Admin Panel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            FootballPro Administration
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
            <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(''); setSuccess(''); }}
              variant="fullWidth" sx={{ mb: 3,
                '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none' },
                '& .Mui-selected': { color: '#ff5252' },
                '& .MuiTabs-indicator': { backgroundColor: '#ff5252' },
              }}>
              <Tab label="Login" />
              <Tab label="Create Account" />
            </Tabs>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setSuccess('')}>
                {success}
              </Alert>
            )}

            {tab === 0 ? (
              /* Login Form */
              <form onSubmit={handleLogin} noValidate autoComplete="off">
                <input type="text" name="username" style={{ display:'none' }} readOnly tabIndex={-1} />
                <input type="password" name="password" style={{ display:'none' }} readOnly tabIndex={-1} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField
                    label="Admin Name"
                    fullWidth autoFocus
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
                    placeholder="Your admin name"
                  />
                  <TextField
                    label="Group Code"
                    fullWidth
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    inputProps={{ autoComplete: 'new-password' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="Your group code"
                  />
                  <Button
                    type="submit" variant="contained" fullWidth size="large"
                    disabled={loading || !form.name.trim() || !form.code.trim()}
                    sx={{
                      mt: 0.5, height: 50,
                      background: 'linear-gradient(135deg, #ff5252 0%, #d32f2f 100%)',
                      color: '#fff', fontWeight: 800, fontSize: '1rem',
                      borderRadius: 2.5, boxShadow: '0 4px 20px rgba(255,82,82,0.3)',
                      '&:hover': { background: 'linear-gradient(135deg, #ff6b6b 0%, #e53935 100%)' },
                      '&:disabled': { opacity: 0.5 },
                    }}
                  >
                    {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Admin Login →'}
                  </Button>
                </Box>
              </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleCreate} noValidate autoComplete="off">
                <input type="text" name="username" style={{ display:'none' }} readOnly tabIndex={-1} />
                <input type="password" name="password" style={{ display:'none' }} readOnly tabIndex={-1} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField
                    label="Admin Name"
                    fullWidth autoFocus
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
                    placeholder="Your name"
                  />
                  <TextField
                    label="Group Code"
                    fullWidth
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    inputProps={{ minLength: 4, autoComplete: 'new-password' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="Min 4 characters"
                  />
                  <TextField
                    label="Admin Key"
                    fullWidth
                    type="password"
                    value={form.adminKey}
                    onChange={e => setForm({ ...form, adminKey: e.target.value })}
                    inputProps={{ autoComplete: 'new-password' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VpnKeyRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="Secret admin key"
                  />
                  <Button
                    type="submit" variant="contained" fullWidth size="large"
                    disabled={loading || !form.name.trim() || !form.code.trim() || !form.adminKey.trim()}
                    sx={{
                      mt: 0.5, height: 50,
                      background: 'linear-gradient(135deg, #ff5252 0%, #d32f2f 100%)',
                      color: '#fff', fontWeight: 800, fontSize: '1rem',
                      borderRadius: 2.5, boxShadow: '0 4px 20px rgba(255,82,82,0.3)',
                      '&:hover': { background: 'linear-gradient(135deg, #ff6b6b 0%, #e53935 100%)' },
                      '&:disabled': { opacity: 0.5 },
                    }}
                  >
                    {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create Admin Account'}
                  </Button>
                </Box>
              </form>
            )}

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.07)' }} />
            <Box sx={{
              p: 2, borderRadius: 2,
              background: 'rgba(255,82,82,0.04)',
              border: '1px solid rgba(255,82,82,0.12)',
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
                ADMIN PRIVILEGES
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                {[
                  { icon: '🗑️', text: 'Delete tournaments, teams & fixtures' },
                  { icon: '👁️', text: 'View all tournaments & data' },
                  { icon: '🔐', text: 'Requires valid admin key to create' },
                ].map(item => (
                  <Box key={item.text} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 14 }}>{item.icon}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.text}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Back to normal login */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button size="small" href="/"
                sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'none', '&:hover': { color: '#00e676' } }}>
                ← Back to User Login
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
