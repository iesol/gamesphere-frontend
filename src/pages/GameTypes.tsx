import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import { Box, Card, CardHeader, Typography, Button, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';
import api from '../lib/api';

export default function GameTypes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  if (!activeOrgId) {
    return (
      <Box sx={{ p: 4, maxWidth: 700, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Select an organization first</Typography>
        <Button variant="contained" onClick={() => navigate('/admin/orgs')}>Go to Organizations</Button>
      </Box>
    );
  }

  const { data: gameTypes } = useQuery({
    queryKey: ['game-types'],
    queryFn: () => api.get('/game-types').then((r) => r.data),
  });

  const { data: formConfig } = useQuery({
    queryKey: ['form-config', 'add-game-type'],
    queryFn: () => api.get('/form-configs/add-game-type').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/game-types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-types'] });
      setShowForm(false);
    },
  });

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Game Types</Typography>
        <Button variant="contained" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Game'}
        </Button>
      </Stack>

      {showForm && formConfig && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Create Game Type" titleTypographyProps={{ variant: 'h6' }} />
          <Box sx={{ p: 3, pt: 0 }}>
            <div className="dynoform"><DynamicForm fields={formConfig.fields} onSubmit={(data) => createMutation.mutate(data)} submitButtonLabel="Create" /></div>
          </Box>
        </Card>
      )}

      <Card>
        <CardHeader title="All Game Types" titleTypographyProps={{ variant: 'h6' }} />
        {gameTypes?.length === 0 && <Box sx={{ p: 3 }}><Typography color="text.secondary">No game types yet.</Typography></Box>}
        <List disablePadding>
          {gameTypes?.map((gt: any) => (
            <ListItem key={gt.id} divider>
              <ListItemText primary={gt.name} secondary={gt.description || ''} />
              <Chip label={gt.sportType} size="small" variant="outlined" />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
