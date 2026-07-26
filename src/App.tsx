import { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Select, MenuItem, IconButton, Drawer, Box, useMediaQuery, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './lib/auth';
import api from './lib/api';
import LoginPage from './pages/Login';
import OrgPicker from './pages/OrgPicker';
import Dashboard from './pages/Dashboard';
import AdminOrganizations from './pages/AdminOrganizations';
import AdminUsers from './pages/AdminUsers';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import ChessScore from './pages/ChessScore';
import MatchDetail from './pages/MatchDetail';
import MatchScore from './pages/MatchScore';
import FormConfigs from './pages/FormConfigs';
import AccessDenied from './pages/AccessDenied';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: myRole, isLoading: roleLoading } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
    enabled: !!user,
  });
  if (authLoading || roleLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!myRole?.roles?.some((r: string) => roles.includes(r))) return <Navigate to="/access-denied" replace />;
  return <>{children}</>;
}

function SidebarContent({ navItems, activeOrgId, switchOrg, organizations, user, logout, onNavigate }: {
  navItems: { path: string; label: string }[];
  activeOrgId: string | null;
  switchOrg: (id: string) => void;
  organizations: any[];
  user: any;
  logout: () => void;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <Box sx={{ width: 260, bgcolor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ height: 64, display: 'flex', alignItems: 'center', gap: 1.5, px: 3, borderBottom: '1px solid', borderColor: 'rgba(255,255,255,0.1)' }}>
        <img src="/logo.svg" alt="GameSphere" width={32} height={32} />
        <span className="font-bold text-lg tracking-tight">GameSphere</span>
      </Box>
      {organizations.length > 0 && (
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'rgba(255,255,255,0.1)' }}>
          <Select
            value={activeOrgId || ''}
            onChange={(e) => switchOrg(e.target.value)}
            size="small"
            fullWidth
            sx={{
              color: 'white', bgcolor: 'rgba(255,255,255,0.08)',
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
              '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
              fontWeight: 600, fontSize: '0.875rem',
            }}
          >
            {organizations.map((org) => (
              <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
            ))}
          </Select>
        </Box>
      )}
      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate}
              className={`sidebar-link ${active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              {item.label}
            </Link>
          );
        })}
      </Box>
      <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</Box>
            <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</Box>
          </Box>
          <Box component="button" onClick={logout} sx={{ color: 'rgba(255,255,255,0.4)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, '&:hover': { color: 'rgba(255,255,255,0.8)' } }}>✕</Box>
        </Box>
      </Box>
    </Box>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, organizations, setActiveOrg } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  const { data: myRole } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
  });

  const isSuperAdmin = myRole?.roles?.includes('super_admin');
  const isOrgAdmin = myRole?.roles?.some((r: string) => r === 'org_admin' || r === 'super_admin');

  const navItems = [
    ...(isSuperAdmin ? [{ path: '/admin/orgs' as const, label: 'Orgs' }] : []),
    { path: '/dashboard' as const, label: 'Dashboard' },
    { path: '/tournaments' as const, label: 'Tournaments' },
    ...(isOrgAdmin ? [{ path: '/admin/users' as const, label: 'Users' }, { path: '/admin/form-configs' as const, label: 'Forms' }] : []),
    { path: '/profile' as const, label: 'Profile' },
  ];

  const switchOrg = (orgId: string) => {
    setActiveOrg(orgId);
    navigate('/dashboard');
  };

  const sidebar = (
    <SidebarContent
      navItems={navItems}
      activeOrgId={activeOrgId}
      switchOrg={switchOrg}
      organizations={organizations}
      user={user}
      logout={logout}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Box sx={{ height: 56, bgcolor: '#0f172a', display: 'flex', alignItems: 'center', px: 2, gap: 1.5 }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ color: 'white', p: 1 }}>
            <MenuIcon />
          </IconButton>
          <img src="/logo.svg" alt="GameSphere" width={28} height={28} />
          <span className="font-bold text-base tracking-tight" style={{ color: 'white' }}>GameSphere</span>
        </Box>
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { border: 'none' } }}>
          {sidebar}
        </Drawer>
        <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#f9fafb' }}>{children}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {sidebar}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#f9fafb' }}>{children}</Box>
    </Box>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/org-picker" element={<ProtectedRoute><OrgPicker /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/tournaments" element={<ProtectedRoute><Layout><Tournaments /></Layout></ProtectedRoute>} />
      <Route path="/tournaments/:id" element={<ProtectedRoute><Layout><TournamentDetail /></Layout></ProtectedRoute>} />
      <Route path="/matches/:id" element={<ProtectedRoute><Layout><MatchDetail /></Layout></ProtectedRoute>} />
      <Route path="/matches/:id/score" element={<ProtectedRoute><Layout><MatchScore /></Layout></ProtectedRoute>} />
      <Route path="/matches/:id/chess-score" element={<ProtectedRoute><Layout><ChessScore /></Layout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><Layout><AdminRoute roles={['super_admin', 'org_admin']}><AdminUsers /></AdminRoute></Layout></ProtectedRoute>} />
      <Route path="/admin/orgs" element={<ProtectedRoute><Layout><AdminRoute roles={['super_admin']}><AdminOrganizations /></AdminRoute></Layout></ProtectedRoute>} />
      <Route path="/admin/form-configs" element={<ProtectedRoute><Layout><AdminRoute roles={['super_admin', 'org_admin']}><FormConfigs /></AdminRoute></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
