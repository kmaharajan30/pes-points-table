import { useState, useEffect } from 'react';
import {
  Box, CssBaseline, Drawer, AppBar, Toolbar, IconButton,
  Typography, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Divider, useMediaQuery, Tooltip,
  Avatar, Menu, MenuItem, BottomNavigation, BottomNavigationAction, Paper
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import theme from './theme/theme';
import LoginPage from './pages/LoginPage';
import TournamentsPage from './pages/TournamentsPage';
import TeamsPage from './pages/TeamsPage';
import FixturesPage from './pages/FixturesPage';
import PointsTablePage from './pages/PointsTablePage';
import ActiveUsers from './components/ActiveUsers';

const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
  { key: 'teams',    label: 'Teams',   icon: <GroupsRoundedIcon /> },
  { key: 'fixtures', label: 'Fixtures',icon: <SportsSoccerRoundedIcon /> },
  { key: 'table',    label: 'Table',   icon: <LeaderboardRoundedIcon /> },
];

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('fp_user') || 'null'));
  const [activeTournament, setActiveTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('teams');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('fp_user') || 'null');
    if (!stored?.id) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tournaments`, { headers: { 'x-user-id': stored.id } })
      .then(r => { if (r.status === 401) { localStorage.removeItem('fp_user'); setUser(null); } })
      .catch(() => {});
  }, []);

  const handleLogin    = (u) => setUser(u);
  const handleLogout   = () => { localStorage.removeItem('fp_user'); setUser(null); setActiveTournament(null); setAnchorEl(null); };
  const handleSelect   = (t) => { setActiveTournament(t); setActiveTab('teams'); setDrawerOpen(false); };
  const handleBack     = () => { setActiveTournament(null); setDrawerOpen(false); };

  const drawerContent = (
    <Box sx={{ display:'flex', flexDirection:'column', height:'100%', py:1.5 }}>
      {/* Logo */}
      <Box sx={{ px:2, mb:2, display:'flex', alignItems:'center', gap:1.5 }}>
        <Box sx={{ width:36, height:36, borderRadius:2, background:'linear-gradient(135deg,#00e676,#651fff)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          boxShadow:'0 4px 12px rgba(0,230,118,0.3)' }}>
          <SportsSoccerRoundedIcon sx={{ color:'#fff', fontSize:20 }} />
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight:800, lineHeight:1.1 }}>FootballPro</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>Points System</Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor:'rgba(255,255,255,0.06)', mb:1 }} />

      <List dense sx={{ px:0.75 }}>
        <ListItem disablePadding>
          <ListItemButton selected={!activeTournament} onClick={handleBack}
            sx={{ borderRadius:1.5, mb:0.25, py:0.75,
              '&.Mui-selected':{ background:'linear-gradient(90deg,rgba(0,230,118,0.15),rgba(101,31,255,0.08))',
                borderLeft:'3px solid #00e676',
                '& .MuiListItemIcon-root':{ color:'primary.main' },
                '& .MuiListItemText-primary':{ color:'primary.main', fontWeight:700 } },
              '&:hover':{ background:'rgba(255,255,255,0.04)' } }}>
            <ListItemIcon sx={{ minWidth:32 }}><EmojiEventsRoundedIcon sx={{ fontSize:18 }} /></ListItemIcon>
            <ListItemText primary="Tournaments" primaryTypographyProps={{ fontSize:13 }} />
          </ListItemButton>
        </ListItem>
      </List>

      {activeTournament && (
        <>
          <Box sx={{ px:1.5, mb:1 }}>
            <Box sx={{ p:1.25, borderRadius:1.5, background:'rgba(0,230,118,0.06)', border:'1px solid rgba(0,230,118,0.14)' }}>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight:700, fontSize:9, letterSpacing:'0.06em' }}>ACTIVE</Typography>
              <Typography variant="body2" sx={{ fontWeight:700, fontSize:12, mt:0.2 }} noWrap>{activeTournament.name}</Typography>
              {activeTournament.season && <Typography variant="caption" color="text.secondary" sx={{ fontSize:10 }}>{activeTournament.season}</Typography>}
            </Box>
          </Box>
          <Divider sx={{ borderColor:'rgba(255,255,255,0.06)', mb:1, mx:1.5 }} />
          <List dense sx={{ px:0.75 }}>
            {NAV_ITEMS.map(item => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton selected={activeTab===item.key}
                  onClick={()=>{ setActiveTab(item.key); setDrawerOpen(false); }}
                  sx={{ borderRadius:1.5, mb:0.25, py:0.75,
                    '&.Mui-selected':{ background:'linear-gradient(90deg,rgba(0,230,118,0.15),rgba(101,31,255,0.08))',
                      borderLeft:'3px solid #00e676',
                      '& .MuiListItemIcon-root':{ color:'primary.main' },
                      '& .MuiListItemText-primary':{ color:'primary.main', fontWeight:700 } },
                    '&:hover':{ background:'rgba(255,255,255,0.04)' } }}>
                  <ListItemIcon sx={{ minWidth:32 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize:13 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* User */}
      <Box sx={{ mt:'auto' }}>
        <Divider sx={{ borderColor:'rgba(255,255,255,0.06)', mb:1.5 }} />
        <Box sx={{ px:1.5 }}>
          <Box onClick={e=>setAnchorEl(e.currentTarget)}
            sx={{ display:'flex', alignItems:'center', gap:1.5, p:1.25, borderRadius:1.5, cursor:'pointer',
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              '&:hover':{ background:'rgba(255,255,255,0.06)' }, transition:'background 0.2s' }}>
            <Avatar sx={{ width:28, height:28, fontSize:10, fontWeight:800, background:'linear-gradient(135deg,#00e676,#651fff)', color:'#fff' }}>
              {getInitials(user?.name||'')}
            </Avatar>
            <Box sx={{ flex:1, minWidth:0 }}>
              <Typography variant="caption" sx={{ fontWeight:700, display:'block', fontSize:11 }} noWrap>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize:9 }}>Tap to sign out</Typography>
            </Box>
          </Box>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={()=>setAnchorEl(null)}
            PaperProps={{ sx:{ bgcolor:'#1a2035', border:'1px solid rgba(255,255,255,0.1)', borderRadius:2, minWidth:160 } }}>
            <MenuItem disabled sx={{ opacity:1 }}>
              <Typography variant="caption" color="text.secondary">Signed in as <strong style={{ color:'#f0f4ff' }}>{user?.name}</strong></Typography>
            </MenuItem>
            <Divider sx={{ borderColor:'rgba(255,255,255,0.08)' }} />
            <MenuItem onClick={handleLogout} sx={{ gap:1.5, color:'error.main' }}>
              <LogoutRoundedIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight:600 }}>Sign Out</Typography>
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    </Box>
  );

  const renderPage = () => {
    if (!activeTournament) return <TournamentsPage onSelect={handleSelect} />;
    switch (activeTab) {
      case 'teams':    return <TeamsPage tournament={activeTournament} />;
      case 'fixtures': return <FixturesPage tournament={activeTournament} />;
      case 'table':    return <PointsTablePage tournament={activeTournament} />;
      default:         return <TeamsPage tournament={activeTournament} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Box sx={{ display:'flex', minHeight:'100vh', bgcolor:'background.default' }}>

          {/* ── Desktop Sidebar ── */}
          {!isMobile && (
            <Drawer variant="permanent"
              sx={{ width:DRAWER_WIDTH, flexShrink:0,
                '& .MuiDrawer-paper':{ width:DRAWER_WIDTH, bgcolor:'#0d1220',
                  borderRight:'1px solid rgba(255,255,255,0.06)', boxSizing:'border-box' } }}>
              {drawerContent}
            </Drawer>
          )}

          {/* ── Mobile slide-out drawer ── */}
          {isMobile && (
            <Drawer variant="temporary" open={drawerOpen} onClose={()=>setDrawerOpen(false)}
              sx={{ '& .MuiDrawer-paper':{ width:DRAWER_WIDTH, bgcolor:'#0d1220',
                borderRight:'1px solid rgba(255,255,255,0.06)' } }}>
              {drawerContent}
            </Drawer>
          )}

          {/* ── Main ── */}
          <Box sx={{ flex:1, display:'flex', flexDirection:'column', minWidth:0,
            pb: isMobile && activeTournament ? '60px' : 0 }}>

            {/* Desktop topbar */}
            {!isMobile && (
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                px:3, py:1.25, borderBottom:'1px solid rgba(255,255,255,0.05)',
                bgcolor:'rgba(13,18,32,0.7)', backdropFilter:'blur(8px)',
                position:'sticky', top:0, zIndex:10 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight:600, fontSize:11 }}>FootballPro</Typography>
                  {activeTournament && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ opacity:0.4 }}>›</Typography>
                      <Typography variant="caption" sx={{ fontWeight:700, color:'primary.main', fontSize:11 }}>{activeTournament.name}</Typography>
                    </>
                  )}
                </Box>
                <ActiveUsers user={user} />
              </Box>
            )}

            {/* Mobile AppBar */}
            {isMobile && (
              <AppBar position="sticky" elevation={0} sx={{
                bgcolor:'rgba(10,14,26,0.97)', backdropFilter:'blur(12px)',
                borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <Toolbar sx={{ minHeight:'52px !important', px:1.5, gap:0.5 }}>
                  <IconButton size="small" onClick={()=>setDrawerOpen(true)} sx={{ color:'text.primary', p:1 }}>
                    <MenuRoundedIcon sx={{ fontSize:22 }} />
                  </IconButton>

                  {activeTournament && (
                    <IconButton size="small" onClick={handleBack} sx={{ color:'text.secondary', p:1 }}>
                      <ArrowBackIosNewRoundedIcon sx={{ fontSize:16 }} />
                    </IconButton>
                  )}

                  <Typography variant="subtitle2" sx={{ fontWeight:800, flex:1, fontSize:14 }} noWrap>
                    {activeTournament ? activeTournament.name : 'FootballPro'}
                  </Typography>

                  <ActiveUsers user={user} />

                  {!activeTournament && (
                    <Tooltip title="Sign Out">
                      <IconButton size="small" onClick={handleLogout} sx={{ color:'error.main', p:1 }}>
                        <LogoutRoundedIcon sx={{ fontSize:18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Toolbar>
              </AppBar>
            )}

            {/* Page content */}
            <Box sx={{ flex:1, p:{ xs:1.5, sm:2.5, md:3 }, maxWidth:1100, width:'100%', mx:'auto' }}>
              {renderPage()}
            </Box>

            {/* ── Mobile Bottom Navigation (only when inside a tournament) ── */}
            {isMobile && activeTournament && (
              <Paper elevation={0}
                sx={{ position:'fixed', bottom:0, left:0, right:0, zIndex:20,
                  bgcolor:'rgba(10,14,26,0.97)', borderTop:'1px solid rgba(255,255,255,0.08)',
                  backdropFilter:'blur(12px)' }}>
                <BottomNavigation value={activeTab} onChange={(_,v)=>setActiveTab(v)}
                  sx={{ bgcolor:'transparent', height:58 }}>
                  {NAV_ITEMS.map(item => (
                    <BottomNavigationAction key={item.key} value={item.key}
                      label={item.label} icon={item.icon}
                      sx={{
                        color:'text.secondary', minWidth:0,
                        '&.Mui-selected':{ color:'primary.main' },
                        '& .MuiBottomNavigationAction-label':{ fontSize:'10px !important', fontWeight:700 },
                        '& .MuiSvgIcon-root':{ fontSize:22 },
                      }} />
                  ))}
                </BottomNavigation>
              </Paper>
            )}
          </Box>
        </Box>
      )}
    </ThemeProvider>
  );
}
