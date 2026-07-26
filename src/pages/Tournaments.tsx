import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardHeader, Typography, Button, List, ListItem, ListItemText, Chip, Stack, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import api from '../lib/api';

export default function Tournaments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  const { data: myRole } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
  });
  const isAdmin = myRole?.roles?.some((r: string) => r === 'org_admin' || r === 'super_admin');

  const [form, setForm] = useState({
    name: '', sportType: 'cricket', format: 'single_elimination',
    startDate: '', venueAddress: '', maxParticipants: 200,
  });

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/tournaments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowForm(false);
      setForm({ name: '', sportType: 'cricket', format: 'single_elimination', startDate: '', venueAddress: '', maxParticipants: 200 });
    },
  });

  if (!activeOrgId) {
    return (
      <Box sx={{ p: 4, maxWidth: 700, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Select an organization first</Typography>
        <Button variant="contained" onClick={() => navigate('/admin/orgs')}>Go to Organizations</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Tournaments</Typography>
        {isAdmin && <Button variant="contained" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Tournament'}
        </Button>}
      </Stack>

      {showForm && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Create Tournament" titleTypographyProps={{ variant: 'h6' }} />
          <Box sx={{ p: 3, pt: 0 }}>
            <Stack spacing={2}>
              <TextField label="Tournament Name" fullWidth size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <FormControl fullWidth size="small">
                <InputLabel>Sport Type</InputLabel>
                <Select value={form.sportType} label="Sport Type" onChange={(e) => setForm({ ...form, sportType: e.target.value })}>
                  <MenuItem value="cricket">Cricket</MenuItem>
                  <MenuItem value="football">Football</MenuItem>
                  <MenuItem value="basketball">Basketball</MenuItem>
                  <MenuItem value="chess">Chess</MenuItem>
                  <MenuItem value="badminton">Badminton</MenuItem>
                  <MenuItem value="tennis">Tennis</MenuItem>
                  <MenuItem value="volleyball">Volleyball</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Format</InputLabel>
                <Select value={form.format} label="Format" onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <MenuItem value="single_elimination">Single Elimination</MenuItem>
                  <MenuItem value="double_elimination">Double Elimination</MenuItem>
                  <MenuItem value="round_robin">Round Robin</MenuItem>
                  <MenuItem value="league">League</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Start Date & Time" type="datetime-local" fullWidth size="small" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <TextField label="Venue / Address (optional)" fullWidth size="small" value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} />
              <TextField label="Max Participants" type="number" fullWidth size="small" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: parseInt(e.target.value) || 0 })} />
              <Button variant="contained" fullWidth disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate({ ...form, settings: { venueAddress: form.venueAddress } })}>
                Create
              </Button>
              {createMutation.isSuccess && <Typography variant="body2" color="success.main">Tournament created!</Typography>}
              {createMutation.isError && <Typography variant="body2" color="error.main">Failed to create tournament</Typography>}
            </Stack>
          </Box>
        </Card>
      )}

      <Card>
        <CardHeader title="All Tournaments" titleTypographyProps={{ variant: 'h6' }} />
        {!isLoading && (!tournaments || tournaments.length === 0) && (
          <Box sx={{ p: 3 }}><Typography color="text.secondary">No tournaments yet.</Typography></Box>
        )}
        <List disablePadding>
          {tournaments?.map((t: any) => (
            <ListItem key={t.id} divider sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tournaments/${t.id}`)}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 600 }}>{t.name}</Typography>
                    <Chip label={t.sportType} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                    <Chip label={t.format?.replace('_', ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                  </Stack>
                }
                secondary={
                  <span>
                    {t.startDate && <span>{new Date(t.startDate).toLocaleDateString()} · </span>}
                    {t.settings?.venueAddress && <span>{t.settings.venueAddress} · </span>}
                    {t.maxParticipants || t.maxParticipants === 0 ? `${t.maxParticipants} max` : ''}
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
