import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Card, Typography, Button, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const navigate = useNavigate();
  const { organizations } = useAuth();
  const activeOrgId = localStorage.getItem('gamesphere_org_id');
  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  const { data: tournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments').then((r) => r.data),
  });

  if (!activeOrg) {
    return (
      <Box sx={{ p: 4, maxWidth: 700, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Select an organization first</Typography>
        <Button variant="contained" onClick={() => navigate('/admin/orgs')}>Go to Organizations</Button>
      </Box>
    );
  }

  const total = (tournaments || []).length;

  const statCard = (label: string, value: number, color: string) => (
    <Card sx={{ p: 3, flex: 1 }}>
      <Typography variant="h3" sx={{ fontWeight: 700, color }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Card>
  );

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 1 }}>Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>{activeOrg.name}</Typography>

      <Box sx={{ display: 'flex', gap: 3, mb: 5 }}>
        {statCard('Total Tournaments', total, '#1e293b')}
      </Box>

      <Card>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Recent Tournaments</Typography>
        </Box>
        {(!tournaments || tournaments.length === 0) && (
          <Box sx={{ p: 3 }}><Typography color="text.secondary">No tournaments yet.</Typography></Box>
        )}
        <List disablePadding>
          {tournaments?.slice(0, 10).map((t: any) => (
            <ListItem key={t.id} divider sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tournaments/${t.id}`)}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 600 }}>{t.name}</Typography>
                    <Chip label={t.sportType} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                  </Stack>
                }
                secondary={
                  <span>
                    {t.startDate && <span>{new Date(t.startDate).toLocaleDateString()} · </span>}
                    {t.settings?.venueAddress && <span>{t.settings.venueAddress} · </span>}
                    {t.maxParticipants ? `${t.maxParticipants} max` : ''}
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
