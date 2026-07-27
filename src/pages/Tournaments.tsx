import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import { Box, Card, CardHeader, Typography, Button, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';
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

  const { data: formConfig } = useQuery({
    queryKey: ['form-config', 'add-tournament'],
    queryFn: () => api.get('/form-configs/add-tournament').then((r) => r.data),
  });

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const { venueAddress, ...rest } = data;
      return api.post('/tournaments', { ...rest, settings: venueAddress ? { venueAddress } : {} });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowForm(false);
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
            {formConfig ? (
              <div className="dynoform">
                <DynamicForm
                  fields={formConfig.fields}
                  onSubmit={(data) => createMutation.mutate(data)}
                  submitButtonLabel="Create"
                />
              </div>
            ) : (
              <Typography color="text.secondary" variant="body2">Loading form...</Typography>
            )}
            {createMutation.isSuccess && <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>Tournament created!</Typography>}
            {createMutation.isError && <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>Failed to create tournament</Typography>}
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
